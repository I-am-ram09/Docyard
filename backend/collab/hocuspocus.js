// Real-time collaborative editing (Yjs + Hocuspocus), running inside the same Express process.
// Browsers connect to wss://<backend>/collab with a short-lived collaborator token (see routes/collab.js).
const { Hocuspocus } = require("@hocuspocus/server");
const { WebSocketServer } = require("ws");
const Y = require("yjs");
const db = require("../db");
const tokens = require("../utils/tokens");

const EDIT_MERGE_MS = 10 * 60 * 1000; // consecutive edits by one person within 10 min = one activity line
const JOIN_MERGE_MS = 30 * 60 * 1000;

// docId -> Map(actorId -> { name, role, at }) : who changed the document since the last save
const pendingEditors = new Map();

async function logJoin(docId, user) {
  const recent = await db.one(
    `SELECT id FROM doc_activity WHERE doc_id = $1 AND actor_id = $2 AND action = 'join' AND at > $3 LIMIT 1`,
    [docId, user.id, new Date(Date.now() - JOIN_MERGE_MS)]
  );
  if (recent) return;
  await db.run(
    `INSERT INTO doc_activity (doc_id, actor_id, actor_name, role, action) VALUES ($1, $2, $3, $4, 'join')`,
    [docId, user.id, user.name, user.role]
  );
}

async function logEdit(docId, actorId, e) {
  const recent = await db.one(
    `SELECT id FROM doc_activity
     WHERE doc_id = $1 AND actor_id = $2 AND action = 'edit' AND at > $3
     ORDER BY at DESC LIMIT 1`,
    [docId, actorId, new Date(e.at.getTime() - EDIT_MERGE_MS)]
  );
  if (recent) {
    await db.run(`UPDATE doc_activity SET at = $1, actor_name = $2 WHERE id = $3`, [e.at, e.name, recent.id]);
  } else {
    await db.run(
      `INSERT INTO doc_activity (doc_id, actor_id, actor_name, role, action, at) VALUES ($1, $2, $3, $4, 'edit', $5)`,
      [docId, actorId, e.name, e.role, e.at]
    );
  }
}

const hocuspocus = new Hocuspocus({
  name: "docyard-collab",
  quiet: true,
  debounce: 4000, // save to the database 4s after the last keystroke...
  maxDebounce: 20000, // ...but never wait more than 20s while people keep typing

  // Runs for every connection. Throwing = access denied.
  async onAuthenticate({ token, documentName, connection }) {
    let p;
    try {
      p = tokens.verify("collab", token || "");
    } catch {
      throw new Error("unauthorized");
    }
    if (p.doc !== documentName) throw new Error("unauthorized"); // a token only ever opens ITS document

    const doc = await db.one("SELECT id, user_id FROM documents WHERE id = $1 AND kind = 'collab'", [documentName]);
    if (!doc) throw new Error("unauthorized");

    if (p.role === "owner") {
      if (doc.user_id !== p.sub) throw new Error("unauthorized");
    } else {
      // Guests: the invite must still exist (not revoked, not expired) every time they connect.
      const inv = await db.one(
        `SELECT id FROM doc_invites WHERE id = $1 AND doc_id = $2 AND revoked = false
           AND (expires_at IS NULL OR expires_at > now())`,
        [p.inv, documentName]
      );
      if (!inv) throw new Error("unauthorized");
    }

    if (p.role === "viewer") connection.readOnly = true;

    const user = { id: p.sub, name: p.name, role: p.role };
    await logJoin(documentName, user).catch((e) => console.error("[collab] join log failed:", e.message));
    return { user };
  },

  async onLoadDocument({ documentName, document }) {
    const row = await db.one("SELECT collab_state FROM documents WHERE id = $1", [documentName]);
    if (row && row.collab_state) Y.applyUpdate(document, new Uint8Array(row.collab_state));
    return document;
  },

  // Fires on every change: remember WHO made it (the actual time/user log is written when we save).
  async onChange({ documentName, context }) {
    const u = context && context.user;
    if (!u || u.role === "viewer") return;
    let m = pendingEditors.get(documentName);
    if (!m) pendingEditors.set(documentName, (m = new Map()));
    m.set(u.id, { name: u.name, role: u.role, at: new Date() });
  },

  async onStoreDocument({ documentName, document }) {
    const state = Buffer.from(Y.encodeStateAsUpdate(document));
    const editors = pendingEditors.get(documentName);
    pendingEditors.delete(documentName);

    await db.run("UPDATE documents SET collab_state = $1, updated_at = now() WHERE id = $2 AND kind = 'collab'", [
      state,
      documentName,
    ]);
    if (editors) {
      for (const [actorId, e] of editors) {
        await logEdit(documentName, actorId, e).catch((err) => console.error("[collab] edit log failed:", err.message));
      }
    }
  },
});

// Wire the WebSocket endpoint (/collab) onto the Node HTTP server that Express runs on.
function attach(server, allowedOrigins) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 });
  wss.on("connection", (ws, req) => hocuspocus.handleConnection(ws, req));

  server.on("upgrade", (req, socket, head) => {
    const pathname = (req.url || "").split("?")[0];
    const origin = req.headers.origin;
    const originOk = !origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin);
    if (pathname !== "/collab" || !originOk) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });
}

// Used when an invite is revoked: drop live connections so the person can't keep typing.
const disconnectDocument = (docId) => hocuspocus.closeConnections(docId);

module.exports = { attach, disconnectDocument };
