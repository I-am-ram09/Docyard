import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import api, { getErrorMessage } from "../api";
import { useLang } from "../i18n/index.jsx";

const COLORS = ["#1447FF", "#1FAE6B", "#FF9500", "#FF4757", "#8A3FFC", "#0E9AA7", "#C2185B", "#6D4C41"];
const colorFor = (s) => COLORS[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

// ws(s)://<backend>/collab - derived from the same VITE_API_URL the REST client uses.
function wsUrl() {
  const u = new URL(import.meta.env.VITE_API_URL || "/api", window.location.origin);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/collab";
  u.search = "";
  return u.toString();
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Creates the live connection (and the on-device copy) once per document + token.
export default function CollabEditor({ docId, token, role, name, title, isOwner }) {
  const { t } = useLang();
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("connecting");
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: wsUrl(),
      name: docId,
      token,
      document: ydoc,
      onStatus: ({ status }) => setStatus(status),
      onAuthenticationFailed: () => setRevoked(true),
    });
    // A copy of the document is kept in THIS browser, so it still opens and edits offline.
    const local = new IndexeddbPersistence(`docyard-collab-${docId}`, ydoc);
    setSession({ ydoc, provider });
    return () => {
      provider.destroy();
      local.destroy();
      ydoc.destroy();
      setSession(null);
    };
  }, [docId, token]);

  if (revoked) {
    return (
      <main className="container upload-shell">
        <div className="error-banner">{t("collab.revokedMsg")}</div>
        {isOwner && <Link to="/dashboard" className="btn btn-sm">{t("collab.back")}</Link>}
      </main>
    );
  }
  if (!session) return null;
  return <Workspace session={session} status={status} docId={docId} token={token} role={role} name={name} title={title} isOwner={isOwner} />;
}

function Workspace({ session, status, docId, token, role, name, title, isOwner }) {
  const { t, lang } = useLang();
  const color = useMemo(() => colorFor(name), [name]);
  const canEdit = role !== "viewer";

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }), // Yjs provides undo/redo
        Collaboration.configure({ document: session.ydoc }),
        CollaborationCursor.configure({ provider: session.provider, user: { name, color } }),
      ],
      editable: canEdit,
    },
    [session]
  );

  // Who is online right now
  const [online, setOnline] = useState([]);
  useEffect(() => {
    const aw = session.provider.awareness;
    if (!aw) return;
    const update = () => {
      const names = new Set();
      aw.getStates().forEach((s) => s.user?.name && names.add(s.user.name));
      setOnline([...names]);
    };
    update();
    aw.on("change", update);
    return () => aw.off("change", update);
  }, [session]);

  // Activity log: who edited / joined, and when
  const [activity, setActivity] = useState([]);
  useEffect(() => {
    let stop = false;
    const load = () =>
      api
        .get("/collab/session/activity", { headers: { "x-collab-token": token } })
        .then((res) => !stop && setActivity(res.data.activity))
        .catch(() => {});
    load();
    const id = setInterval(load, 15000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [token]);

  const locale = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" }[lang] || "en-IN";
  const fmt = (d) => new Date(d).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });

  // ---- download a copy to this device ----
  const safeName = (title || "document").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
  const save = (ext, mime, content) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
    a.download = `${safeName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };
  const page = (word) =>
    `<!doctype html><html ${word ? 'xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"' : ""}>` +
    `<head><meta charset="utf-8"><title>${esc(title)}</title></head><body><h1>${esc(title)}</h1>${editor?.getHTML() || ""}</body></html>`;
  const downloads = {
    html: () => save("html", "text/html", page(false)),
    doc: () => save("doc", "application/msword", page(true)),
    txt: () => save("txt", "text/plain", `${title}\n\n${editor?.getText({ blockSeparator: "\n\n" }) || ""}`),
  };

  const statusLabel = status === "connected" ? t("collab.connected") : status === "connecting" ? t("collab.connecting") : t("collab.offline");
  const run = (fn) => () => editor && fn(editor.chain().focus()).run();

  return (
    <main className="container collab-shell">
      <div className="page-head">
        <div>
          {isOwner && <Link to="/dashboard" className="btn btn-sm btn-ghost">{t("collab.back")}</Link>}
          <h1 className="page-title">{title}</h1>
          <p className="page-sub">
            <span className={`live-dot ${status}`} /> {statusLabel}
            {online.length > 0 && (
              <> · {t("collab.online")} {online.map((n) => (n === name ? `${n} (${t("collab.you")})` : n)).join(", ")}</>
            )}
          </p>
        </div>
        <details className="menu">
          <summary className="btn btn-sm">{t("collab.download")}</summary>
          <div className="menu-list">
            <button className="btn btn-sm" onClick={downloads.html}>{t("collab.dlHtml")}</button>
            <button className="btn btn-sm" onClick={downloads.doc}>{t("collab.dlDoc")}</button>
            <button className="btn btn-sm" onClick={downloads.txt}>{t("collab.dlTxt")}</button>
          </div>
        </details>
      </div>

      <div className="collab-layout">
        <section>
          {canEdit ? (
            <div className="editor-toolbar">
              <button className="btn btn-sm" onClick={run((c) => c.toggleBold())}><b>B</b></button>
              <button className="btn btn-sm" onClick={run((c) => c.toggleItalic())}><i>I</i></button>
              <button className="btn btn-sm" onClick={run((c) => c.toggleHeading({ level: 1 }))}>H1</button>
              <button className="btn btn-sm" onClick={run((c) => c.toggleHeading({ level: 2 }))}>H2</button>
              <button className="btn btn-sm" onClick={run((c) => c.toggleBulletList())}>•</button>
              <button className="btn btn-sm" onClick={run((c) => c.toggleOrderedList())}>1.</button>
              <button className="btn btn-sm" onClick={run((c) => c.undo())}>↶</button>
              <button className="btn btn-sm" onClick={run((c) => c.redo())}>↷</button>
            </div>
          ) : (
            <div className="error-banner">{t("collab.viewOnly")}</div>
          )}
          <div className="editor-wrap">
            <EditorContent editor={editor} />
          </div>
        </section>

        <aside className="collab-side">
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>{t("collab.activity")}</h3>
            {activity.length === 0 ? (
              <p className="field-hint">{t("collab.noActivity")}</p>
            ) : (
              <ul className="activity-list">
                {activity.map((a, i) => (
                  <li key={i}>
                    <strong>
                      {t(a.action === "edit" ? "collab.actEdit" : "collab.actJoin", { name: a.actorName })}
                      {a.isYou ? ` (${t("collab.you")})` : ""}
                    </strong>
                    <span>{fmt(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {isOwner && <InvitePanel docId={docId} />}
        </aside>
      </div>
    </main>
  );
}

function InvitePanel({ docId }) {
  const { t } = useLang();
  const [invites, setInvites] = useState([]);
  const [role, setRole] = useState("editor");
  const [days, setDays] = useState("7");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const msgTimer = useRef(null);

  const load = () => api.get(`/collab/${docId}/invites`).then((r) => setInvites(r.data.invites)).catch(() => {});
  useEffect(() => {
    load();
    return () => clearTimeout(msgTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const create = async () => {
    setError("");
    try {
      const res = await api.post(`/collab/${docId}/invites`, { role, expiresInDays: Number(days) });
      const link = `${window.location.origin}/collab/join/${res.data.token}`;
      await navigator.clipboard.writeText(link).catch(() => window.prompt("Invite link", link));
      setMsg(t("collab.linkCopied"));
      clearTimeout(msgTimer.current);
      msgTimer.current = setTimeout(() => setMsg(""), 8000);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const revoke = async (id) => {
    await api.delete(`/collab/${docId}/invites/${id}`).catch((e) => setError(getErrorMessage(e)));
    load();
  };

  const roleLabel = (r) => (r === "viewer" ? t("collab.viewer") : t("collab.editor"));

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h3 style={{ marginBottom: 8 }}>{t("collab.invite")}</h3>
      <p className="field-hint" style={{ marginBottom: 14, textTransform: "none" }}>{t("collab.inviteHint")}</p>
      {error && <div className="error-banner">{error}</div>}
      <div className="field">
        <label>{t("collab.access")}</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="editor">{t("collab.editor")}</option>
          <option value="viewer">{t("collab.viewer")}</option>
        </select>
      </div>
      <div className="field">
        <label>{t("collab.linkExpires")}</label>
        <select value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="1">{t("collab.exp1")}</option>
          <option value="7">{t("collab.exp7")}</option>
          <option value="30">{t("collab.exp30")}</option>
          <option value="0">{t("collab.exp0")}</option>
        </select>
      </div>
      <button className="btn btn-sm btn-primary btn-block" onClick={create}>{t("collab.createLink")}</button>
      {msg && <p className="field-hint" style={{ marginTop: 10, textTransform: "none" }}>{msg}</p>}

      {invites.length > 0 && (
        <>
          <h4 style={{ margin: "18px 0 8px" }}>{t("collab.activeInvites")}</h4>
          <ul className="activity-list">
            {invites.map((i) => (
              <li key={i.id}>
                <strong>{roleLabel(i.role)}</strong>
                <span>{i.expiresAt ? new Date(i.expiresAt).toLocaleDateString() : t("collab.exp0")}</span>
                <button className="btn btn-sm btn-danger" onClick={() => revoke(i.id)}>{t("collab.revoke")}</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
