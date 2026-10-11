const express = require("express");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { pipeline } = require("stream");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const storage = require("../utils/storage");
const tokens = require("../utils/tokens");
const { requireAuth } = require("../middleware/auth");
const { wrap, fail, contentDisposition, fixFilename } = require("../utils/http");

const router = express.Router();

const WARNING_DAYS = Number(process.env.EXPIRY_WARNING_DAYS || 21);
const CLUSTERS = ["academic", "personal", "work", "other"];
const MIN_LOCK_PASSWORD = 6;

// Files are held in memory just long enough to be sent to cloud storage - never written to this server's disk.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB cap

const DAY_MS = 1000 * 60 * 60 * 24;

// Guessing a document password is rate limited per logged-in user.
const lockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
  handler: (req, res) => fail(res, 429, "TOO_MANY_ATTEMPTS", "Too many attempts. Please wait a few minutes."),
});

function computeStatus(expiry_date) {
  if (!expiry_date) return "active";
  const daysLeft = Math.ceil((new Date(expiry_date) - new Date()) / DAY_MS);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= WARNING_DAYS) return "expiring_soon";
  return "active";
}

function toPublicDoc(doc) {
  const daysLeft = doc.expiry_date ? Math.ceil((new Date(doc.expiry_date) - new Date()) / DAY_MS) : null;
  const locked = !!doc.lock_hash;
  return {
    id: doc.id,
    kind: doc.kind || "file",
    name: doc.name,
    // A locked document hides its credentials until it is unlocked.
    credentials: locked ? null : doc.credentials,
    originalFilename: doc.original_filename,
    mimeType: doc.mime_type,
    sizeBytes: doc.size_bytes,
    expiryDate: doc.expiry_date,
    daysLeft,
    status: computeStatus(doc.expiry_date),
    shareToken: doc.share_token,
    cluster: doc.cluster || "other",
    category: doc.category || null,
    tags: doc.tags ? doc.tags.split(",").filter(Boolean) : [],
    locked,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

const cleanCluster = (v) => (CLUSTERS.includes(v) ? v : "other");
const cleanCategory = (v) => (v ? String(v).trim().slice(0, 60) : null);
const cleanTags = (v) =>
  v
    ? String(v)
        .split(",")
        .map((x) => x.trim().toLowerCase().slice(0, 30))
        .filter(Boolean)
        .slice(0, 10)
        .join(",")
    : null;

// --- Password lock helpers ---------------------------------------------------------------
// A locked document's file can only be read with a short-lived token that proves the password was entered.
function isUnlocked(req, doc) {
  try {
    const p = tokens.verify("unlock", req.headers["x-unlock-token"] || "");
    return p.doc === doc.id && p.sub === req.user.id;
  } catch {
    return false;
  }
}

function requireUnlocked(req, res, doc) {
  if (doc.lock_hash && !isUnlocked(req, doc)) {
    fail(res, 423, "DOC_LOCKED", "This document is password protected.");
    return false;
  }
  return true;
}

// Streams a file from cloud storage to the browser.
async function sendFile(res, doc, disposition) {
  if (doc.kind === "collab" || !doc.storage_key) {
    return fail(res, 400, "COLLAB_NO_FILE", "This is a collaborative document - open it in the editor.");
  }
  const file = await storage.getFile(doc.storage_key);
  if (!file) return fail(res, 404, "FILE_MISSING", "The file couldn't be found in storage.");
  res.setHeader("Content-Type", doc.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", contentDisposition(disposition, doc.original_filename));
  if (file.contentLength) res.setHeader("Content-Length", file.contentLength);
  pipeline(file.body, res, (err) => {
    if (err) console.error("[storage] stream error:", err.message);
  });
}

// --- Upload a new document ---
router.post(
  "/",
  requireAuth,
  upload.single("file"),
  wrap(async (req, res) => {
    if (!req.file) return fail(res, 400, "FILE_REQUIRED", "Please attach a file.");

    const { name, credentials, expiryDate, cluster, category, tags, lockPassword } = req.body;
    if (!name || !name.trim()) return fail(res, 400, "NAME_REQUIRED", "Please give the document a name.");
    if (lockPassword && lockPassword.length < MIN_LOCK_PASSWORD) {
      return fail(res, 400, "PASSWORD_SHORT", "Password must be at least 6 characters.");
    }

    const id = uuidv4();
    const originalName = fixFilename(req.file.originalname);
    const storageKey = `${req.user.id}/${id}${path.extname(originalName).slice(0, 12)}`;
    const lockHash = lockPassword ? await bcrypt.hash(lockPassword, 10) : null;

    // 1) file -> cloud storage, 2) details -> cloud database
    await storage.putFile(storageKey, req.file.buffer, req.file.mimetype);
    try {
      await db.run(
        `INSERT INTO documents
          (id, user_id, name, credentials, original_filename, storage_key, mime_type, size_bytes, expiry_date,
           cluster, category, tags, lock_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          id,
          req.user.id,
          name.trim(),
          credentials || null,
          originalName,
          storageKey,
          req.file.mimetype,
          req.file.size,
          expiryDate || null,
          cleanCluster(cluster),
          cleanCategory(category),
          cleanTags(tags),
          lockHash,
        ]
      );
    } catch (err) {
      await storage.deleteFile(storageKey).catch(() => {}); // don't leave an orphaned file behind
      throw err;
    }

    const doc = await db.one("SELECT * FROM documents WHERE id = $1", [id]);
    res.status(201).json({ document: toPublicDoc(doc) });
  })
);

// --- List my documents (search + cluster/category filter + sort) ---
// GET /api/documents?q=aadhaar&cluster=personal&category=aadhaar&sort=name_asc
const SORTS = {
  newest: "created_at DESC",
  oldest: "created_at ASC",
  name_asc: "lower(name) ASC",
  name_desc: "lower(name) DESC",
  expiry: "expiry_date ASC NULLS LAST",
  size: "size_bytes DESC NULLS LAST",
  edited: "updated_at DESC",
};

router.get(
  "/",
  requireAuth,
  wrap(async (req, res) => {
    const { q, cluster, category, sort } = req.query;
    const where = ["user_id = $1"];
    const params = [req.user.id];

    if (cluster && CLUSTERS.includes(cluster)) {
      params.push(cluster);
      where.push(`cluster = $${params.length}`);
    }
    if (category) {
      params.push(String(category));
      where.push(`category = $${params.length}`);
    }
    if (q && String(q).trim()) {
      // Escape LIKE wildcards so a search for "100%" is literal. Credentials are deliberately NOT searched,
      // so a locked document's hidden details can't be discovered through search.
      const like = `%${String(q).trim().replace(/[\\%_]/g, (c) => "\\" + c)}%`;
      params.push(like);
      const n = params.length;
      where.push(
        `(name ILIKE $${n} OR original_filename ILIKE $${n} OR tags ILIKE $${n} OR category ILIKE $${n})`
      );
    }

    const orderBy = SORTS[sort] || SORTS.newest;
    const docs = await db.many(
      `SELECT * FROM documents WHERE ${where.join(" AND ")} ORDER BY ${orderBy} LIMIT 500`,
      params
    );
    res.json({ documents: docs.map(toPublicDoc) });
  })
);

// --- Dashboard stats (plus how many documents are in each cluster) ---
router.get(
  "/stats",
  requireAuth,
  wrap(async (req, res) => {
    const docs = await db.many("SELECT expiry_date, cluster FROM documents WHERE user_id = $1", [req.user.id]);
    const stats = { total: docs.length, active: 0, expiring_soon: 0, expired: 0 };
    const clusters = { academic: 0, personal: 0, work: 0, other: 0 };
    for (const doc of docs) {
      stats[computeStatus(doc.expiry_date)] += 1;
      clusters[cleanCluster(doc.cluster)] += 1;
    }
    res.json({ stats, clusters });
  })
);

async function findOwnedDoc(req, res) {
  const doc = await db.one("SELECT * FROM documents WHERE id = $1", [req.params.id]);
  if (!doc) {
    fail(res, 404, "DOC_NOT_FOUND", "Document not found.");
    return null;
  }
  if (doc.user_id !== req.user.id) {
    fail(res, 403, "DOC_FORBIDDEN", "You don't have access to this document.");
    return null;
  }
  return doc;
}

// --- Edit details (name, cluster, category, tags, expiry) ---
router.patch(
  "/:id",
  requireAuth,
  wrap(async (req, res) => {
    const doc = await findOwnedDoc(req, res);
    if (!doc) return;
    const { name, cluster, category, tags, expiryDate } = req.body;
    if (name !== undefined && !String(name).trim()) {
      return fail(res, 400, "NAME_REQUIRED", "Please give the document a name.");
    }
    await db.run(
      `UPDATE documents SET
         name = COALESCE($1, name),
         cluster = COALESCE($2, cluster),
         category = $3,
         tags = $4,
         expiry_date = CASE WHEN $5::boolean THEN $6 ELSE expiry_date END,
         reminder_sent = CASE WHEN $5::boolean THEN 0 ELSE reminder_sent END,
         updated_at = now()
       WHERE id = $7`,
      [
        name !== undefined ? String(name).trim() : null,
        cluster !== undefined ? cleanCluster(cluster) : null,
        category !== undefined ? cleanCategory(category) : doc.category,
        tags !== undefined ? cleanTags(tags) : doc.tags,
        expiryDate !== undefined,
        expiryDate || null,
        doc.id,
      ]
    );
    const fresh = await db.one("SELECT * FROM documents WHERE id = $1", [doc.id]);
    res.json({ document: toPublicDoc(fresh) });
  })
);

// --- Password lock: set / change ---
router.post(
  "/:id/lock",
  requireAuth,
  lockLimiter,
  wrap(async (req, res) => {
    const doc = await findOwnedDoc(req, res);
    if (!doc) return;
    const { password, currentPassword } = req.body;
    if (!password || password.length < MIN_LOCK_PASSWORD) {
      return fail(res, 400, "PASSWORD_SHORT", "Password must be at least 6 characters.");
    }
    if (doc.lock_hash && !(await bcrypt.compare(currentPassword || "", doc.lock_hash))) {
      return fail(res, 401, "WRONG_PASSWORD", "Wrong password.");
    }
    const hash = await bcrypt.hash(password, 10);
    // A public share link would bypass the lock, so locking a document revokes any existing link.
    await db.run("UPDATE documents SET lock_hash = $1, share_token = NULL, updated_at = now() WHERE id = $2", [
      hash,
      doc.id,
    ]);
    res.json({ ok: true });
  })
);

// --- Password lock: remove ---
router.delete(
  "/:id/lock",
  requireAuth,
  lockLimiter,
  wrap(async (req, res) => {
    const doc = await findOwnedDoc(req, res);
    if (!doc) return;
    if (!doc.lock_hash) return fail(res, 400, "NOT_LOCKED", "This document isn't locked.");
    if (!(await bcrypt.compare(req.body?.password || "", doc.lock_hash))) {
      return fail(res, 401, "WRONG_PASSWORD", "Wrong password.");
    }
    await db.run("UPDATE documents SET lock_hash = NULL, updated_at = now() WHERE id = $1", [doc.id]);
    res.json({ ok: true });
  })
);

// --- Password lock: unlock (returns a 5-minute token; also returns the hidden credentials) ---
router.post(
  "/:id/unlock",
  requireAuth,
  lockLimiter,
  wrap(async (req, res) => {
    const doc = await findOwnedDoc(req, res);
    if (!doc) return;
    if (!doc.lock_hash) return fail(res, 400, "NOT_LOCKED", "This document isn't locked.");
    if (!(await bcrypt.compare(req.body?.password || "", doc.lock_hash))) {
      return fail(res, 401, "WRONG_PASSWORD", "Wrong password.");
    }
    const token = tokens.sign("unlock", { doc: doc.id, sub: req.user.id }, "5m");
    res.json({ unlockToken: token, credentials: doc.credentials });
  })
);

// --- Download (owner) ---
router.get(
  "/:id/download",
  requireAuth,
  wrap(async (req, res) => {
    const doc = await findOwnedDoc(req, res);
    if (doc && requireUnlocked(req, res, doc)) await sendFile(res, doc, "attachment");
  })
);

// --- Preview (owner, inline) ---
router.get(
  "/:id/preview",
  requireAuth,
  wrap(async (req, res) => {
    const doc = await findOwnedDoc(req, res);
    if (doc && requireUnlocked(req, res, doc)) await sendFile(res, doc, "inline");
  })
);

// --- Create / rotate a public share link ---
router.post(
  "/:id/share",
  requireAuth,
  wrap(async (req, res) => {
    const doc = await findOwnedDoc(req, res);
    if (!doc) return;
    if (doc.kind === "collab") {
      return fail(res, 400, "COLLAB_NO_FILE", "This is a collaborative document - invite people from the editor.");
    }
    if (doc.lock_hash) {
      return fail(res, 423, "LOCKED_NO_SHARE", "Remove the password lock before creating a public share link.");
    }
    const token = uuidv4();
    await db.run("UPDATE documents SET share_token = $1 WHERE id = $2", [token, doc.id]);
    res.json({ shareToken: token, shareUrl: `/api/share/${token}` });
  })
);

// --- Revoke a public share link ---
router.delete(
  "/:id/share",
  requireAuth,
  wrap(async (req, res) => {
    const doc = await findOwnedDoc(req, res);
    if (!doc) return;
    await db.run("UPDATE documents SET share_token = NULL WHERE id = $1", [doc.id]);
    res.json({ ok: true });
  })
);

// --- Delete a document (file + database row) ---
router.delete(
  "/:id",
  requireAuth,
  wrap(async (req, res) => {
    const doc = await findOwnedDoc(req, res);
    if (!doc) return;
    if (doc.storage_key) {
      await storage.deleteFile(doc.storage_key).catch((err) => console.error("[storage] delete failed:", err.message));
    }
    await db.run("DELETE FROM documents WHERE id = $1", [doc.id]);
    res.json({ ok: true });
  })
);

module.exports = router;
