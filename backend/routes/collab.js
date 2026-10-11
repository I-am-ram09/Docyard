const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const tokens = require("../utils/tokens");
const { requireAuth } = require("../middleware/auth");
const { disconnectDocument } = require("../collab/hocuspocus");
const { wrap, fail } = require("../utils/http");

const router = express.Router();

const CLUSTERS = ["academic", "personal", "work", "other"];
const ROLES = ["editor", "viewer"];
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => fail(res, 429, "TOO_MANY_ATTEMPTS", "Too many attempts. Please wait a few minutes."),
});

async function findOwnedCollab(req, res) {
  const doc = await db.one("SELECT * FROM documents WHERE id = $1 AND kind = 'collab'", [req.params.id]);
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

const inviteIsLive = (inv) => inv && !inv.revoked && (!inv.expires_at || new Date(inv.expires_at) > new Date());

// ---------- Guests (no account needed) ----------

// Preview an invite link: which document, and what role it grants.
router.get(
  "/join/:token",
  joinLimiter,
  wrap(async (req, res) => {
    const inv = await db.one(
      `SELECT i.*, d.name AS doc_name, u.name AS owner_name
       FROM doc_invites i JOIN documents d ON d.id = i.doc_id JOIN users u ON u.id = d.user_id
       WHERE i.token_hash = $1`,
      [sha256(req.params.token)]
    );
    if (!inviteIsLive(inv)) return fail(res, 404, "INVITE_INVALID", "This invite link is invalid or has been revoked.");
    res.json({ title: inv.doc_name, role: inv.role, ownerName: inv.owner_name });
  })
);

// Accept an invite: pick a display name, get a token that opens THIS document only.
router.post(
  "/join/:token",
  joinLimiter,
  wrap(async (req, res) => {
    const inv = await db.one(
      `SELECT i.*, d.name AS doc_name FROM doc_invites i JOIN documents d ON d.id = i.doc_id WHERE i.token_hash = $1`,
      [sha256(req.params.token)]
    );
    if (!inviteIsLive(inv)) return fail(res, 404, "INVITE_INVALID", "This invite link is invalid or has been revoked.");

    const name = String(req.body?.displayName || "").trim().slice(0, 40);
    if (!name) return fail(res, 400, "DISPLAY_NAME_REQUIRED", "Please enter your name.");

    const guestId = req.body?.guestId && /^guest:[\w-]{8,}$/.test(req.body.guestId) ? req.body.guestId : `guest:${uuidv4()}`;
    const token = tokens.sign(
      "collab",
      { doc: inv.doc_id, role: inv.role, sub: guestId, name, inv: inv.id },
      "12h"
    );
    res.json({ token, role: inv.role, name, guestId, docId: inv.doc_id, title: inv.doc_name });
  })
);

// Collaborator-token auth (owner or guest) for the activity log.
function requireCollab(req, res, next) {
  try {
    req.collab = tokens.verify("collab", req.headers["x-collab-token"] || "");
    next();
  } catch {
    fail(res, 401, "SESSION_EXPIRED", "Session expired. Please log in again.");
  }
}

router.get(
  "/session/activity",
  requireCollab,
  wrap(async (req, res) => {
    if (req.collab.inv) {
      const inv = await db.one("SELECT * FROM doc_invites WHERE id = $1", [req.collab.inv]);
      if (!inviteIsLive(inv)) return fail(res, 401, "INVITE_INVALID", "This invite link is invalid or has been revoked.");
    }
    const rows = await db.many(
      `SELECT actor_id, actor_name, role, action, at FROM doc_activity WHERE doc_id = $1 ORDER BY at DESC LIMIT 100`,
      [req.collab.doc]
    );
    res.json({
      activity: rows.map((r) => ({
        actorName: r.actor_name,
        role: r.role,
        action: r.action,
        at: r.at,
        isYou: r.actor_id === req.collab.sub,
      })),
    });
  })
);

// ---------- Owner (logged in) ----------

// Create a new collaborative document.
router.post(
  "/",
  requireAuth,
  wrap(async (req, res) => {
    const { name, cluster, category } = req.body;
    if (!name || !String(name).trim()) return fail(res, 400, "NAME_REQUIRED", "Please give the document a name.");
    const id = uuidv4();
    await db.run(
      `INSERT INTO documents (id, user_id, name, kind, cluster, category) VALUES ($1, $2, $3, 'collab', $4, $5)`,
      [id, req.user.id, String(name).trim(), CLUSTERS.includes(cluster) ? cluster : "other", category ? String(category).slice(0, 60) : null]
    );
    res.status(201).json({ document: { id, name: String(name).trim(), kind: "collab" } });
  })
);

// Owner gets a collaborator token for their own document (needs the password if the document is locked).
router.post(
  "/:id/token",
  requireAuth,
  wrap(async (req, res) => {
    const doc = await findOwnedCollab(req, res);
    if (!doc) return;
    if (doc.lock_hash) {
      let ok = false;
      try {
        const p = tokens.verify("unlock", req.headers["x-unlock-token"] || "");
        ok = p.doc === doc.id && p.sub === req.user.id;
      } catch {
        /* not unlocked */
      }
      if (!ok) return fail(res, 423, "DOC_LOCKED", "This document is password protected.");
    }
    const token = tokens.sign("collab", { doc: doc.id, role: "owner", sub: req.user.id, name: req.user.name }, "12h");
    res.json({ token, role: "owner", name: req.user.name, title: doc.name, docId: doc.id });
  })
);

router.get(
  "/:id/invites",
  requireAuth,
  wrap(async (req, res) => {
    const doc = await findOwnedCollab(req, res);
    if (!doc) return;
    const rows = await db.many(
      `SELECT id, role, label, expires_at, created_at FROM doc_invites
       WHERE doc_id = $1 AND revoked = false AND (expires_at IS NULL OR expires_at > now()) ORDER BY created_at DESC`,
      [doc.id]
    );
    res.json({
      invites: rows.map((r) => ({ id: r.id, role: r.role, label: r.label, expiresAt: r.expires_at, createdAt: r.created_at })),
    });
  })
);

// The raw invite token is shown ONCE (only its hash is stored), so the owner copies the link right away.
router.post(
  "/:id/invites",
  requireAuth,
  wrap(async (req, res) => {
    const doc = await findOwnedCollab(req, res);
    if (!doc) return;
    const role = ROLES.includes(req.body?.role) ? req.body.role : "editor";
    const days = Number(req.body?.expiresInDays);
    const expiresAt = days > 0 ? new Date(Date.now() + Math.min(days, 365) * 86400000) : null;
    const raw = crypto.randomBytes(24).toString("hex");
    const id = uuidv4();
    await db.run(
      `INSERT INTO doc_invites (id, doc_id, token_hash, role, label, expires_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, doc.id, sha256(raw), role, req.body?.label ? String(req.body.label).slice(0, 60) : null, expiresAt]
    );
    res.status(201).json({ invite: { id, role, expiresAt }, token: raw });
  })
);

router.delete(
  "/:id/invites/:inviteId",
  requireAuth,
  wrap(async (req, res) => {
    const doc = await findOwnedCollab(req, res);
    if (!doc) return;
    await db.run("UPDATE doc_invites SET revoked = true WHERE id = $1 AND doc_id = $2", [req.params.inviteId, doc.id]);
    disconnectDocument(doc.id); // kick live connections; revoked guests are refused when they reconnect
    res.json({ ok: true });
  })
);

module.exports = router;
