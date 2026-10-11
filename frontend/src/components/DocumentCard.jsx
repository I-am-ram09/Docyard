import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiUrl, getErrorMessage, getErrorMessageAsync } from "../api";
import { useLang } from "../i18n/index.jsx";
import { categoryLabel } from "../data/documentTypes.js";
import PasswordModal from "./PasswordModal.jsx";
import EditDocModal from "./EditDocModal.jsx";

function formatSize(bytes) {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

const UNLOCK_TTL_MS = 4 * 60 * 1000; // server tokens last 5 minutes; reuse ours for 4

// onChanged() asks the dashboard to reload the list (after lock/edit changes).
export default function DocumentCard({ doc, onDeleted, onToast, onChanged }) {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [busy, setBusy] = useState("");
  const [modal, setModal] = useState(null); // "unlock" | "setLock" | "removeLock" | "edit"
  const [revealed, setRevealed] = useState(null);
  const unlockRef = useRef(null); // { token, at }
  const pendingRef = useRef(null); // the action to continue with after unlocking
  const isCollab = doc.kind === "collab";

  const unlockHeaders = () =>
    unlockRef.current && Date.now() - unlockRef.current.at < UNLOCK_TTL_MS
      ? { "x-unlock-token": unlockRef.current.token }
      : {};

  const askToUnlock = (mode) => {
    unlockRef.current = null;
    pendingRef.current = mode;
    setModal("unlock");
  };

  // Files are fetched from cloud storage through the API, so this works on any device you log in from.
  const openBlob = async (mode) => {
    if (doc.locked && !unlockHeaders()["x-unlock-token"]) return askToUnlock(mode);
    setBusy(mode);
    try {
      const res = await api.get(`/documents/${doc.id}/${mode}`, { responseType: "blob", headers: unlockHeaders() });
      const url = URL.createObjectURL(res.data);
      if (mode === "preview") {
        window.open(url, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.originalFilename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      if (err?.response?.status === 423) askToUnlock(mode);
      else onToast(await getErrorMessageAsync(err));
    } finally {
      setBusy("");
    }
  };

  const submitUnlock = async ({ password }) => {
    const res = await api.post(`/documents/${doc.id}/unlock`, { password });
    unlockRef.current = { token: res.data.unlockToken, at: Date.now() };
    setRevealed(res.data.credentials || null);
    setModal(null);
    const next = pendingRef.current;
    pendingRef.current = null;
    if (next) openBlob(next);
  };

  const submitSetLock = async ({ current, next }) => {
    await api.post(`/documents/${doc.id}/lock`, { password: next, currentPassword: current });
    unlockRef.current = null;
    setRevealed(null);
    setModal(null);
    onToast(t("doc.lockSet"));
    onChanged();
  };

  const submitRemoveLock = async ({ password }) => {
    await api.delete(`/documents/${doc.id}/lock`, { data: { password } });
    unlockRef.current = null;
    setRevealed(null);
    setModal(null);
    onToast(t("doc.lockRemoved"));
    onChanged();
  };

  const share = async () => {
    setBusy("share");
    try {
      const res = await api.post(`/documents/${doc.id}/share`);
      await navigator.clipboard.writeText(apiUrl(`/share/${res.data.shareToken}/download`));
      onToast(t("doc.shareCopied"));
    } catch (err) {
      onToast(getErrorMessage(err));
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    if (!window.confirm(t("doc.confirmDelete", { name: doc.name }))) return;
    setBusy("delete");
    try {
      await api.delete(`/documents/${doc.id}`);
      onDeleted(doc.id);
    } catch (err) {
      onToast(getErrorMessage(err));
      setBusy("");
    }
  };

  const credentials = doc.locked ? revealed : doc.credentials;

  return (
    <div className="doc-card">
      <div className="doc-main">
        <span className="doc-name">{doc.locked ? "🔒 " : ""}{doc.name}</span>
        <div className="doc-chips">
          <span className="chip">{t(`cluster.${doc.cluster}`)}</span>
          {doc.category && <span className="chip">{categoryLabel(doc.category, lang)}</span>}
          {isCollab && <span className="chip chip-collab">{t("doc.collab")}</span>}
          {doc.tags.map((tag) => (
            <span className="chip chip-tag" key={tag}>#{tag}</span>
          ))}
        </div>
        <div className="doc-meta">
          {!isCollab && <span>{doc.originalFilename}</span>}
          {!isCollab && <span>{formatSize(doc.sizeBytes)}</span>}
          {doc.expiryDate && (
            <span>
              {t("doc.expires", { date: doc.expiryDate })}
              {doc.status !== "expired" && ` (${t("doc.daysLeft", { n: doc.daysLeft })})`}
            </span>
          )}
          {credentials && <span>{t("doc.credentials", { value: credentials })}</span>}
          {doc.locked && !credentials && <span>{t("doc.hidden")}</span>}
        </div>
        <span className={`badge badge-${doc.status}`}>
          <span className="badge-dot" />
          {t(`status.${doc.status}`)}
        </span>
      </div>

      <div className="doc-actions">
        {isCollab ? (
          <button className="btn btn-sm btn-primary" onClick={() => navigate(`/collab/${doc.id}`)}>{t("doc.open")}</button>
        ) : (
          <>
            <button className="btn btn-sm" disabled={!!busy} onClick={() => openBlob("preview")}>
              {busy === "preview" ? <span className="spinner dark" /> : t("doc.preview")}
            </button>
            <button className="btn btn-sm" disabled={!!busy} onClick={() => openBlob("download")}>
              {busy === "download" ? <span className="spinner dark" /> : t("doc.download")}
            </button>
            {!doc.locked && (
              <button className="btn btn-sm btn-yellow" disabled={!!busy} onClick={share}>
                {busy === "share" ? <span className="spinner dark" /> : t("doc.share")}
              </button>
            )}
          </>
        )}
        <button className="btn btn-sm" disabled={!!busy} onClick={() => setModal("edit")}>{t("doc.edit")}</button>
        {doc.locked ? (
          <>
            <button className="btn btn-sm" disabled={!!busy} onClick={() => setModal("setLock")}>{t("doc.changePw")}</button>
            <button className="btn btn-sm" disabled={!!busy} onClick={() => setModal("removeLock")}>{t("doc.removeLock")}</button>
          </>
        ) : (
          <button className="btn btn-sm" disabled={!!busy} onClick={() => setModal("setLock")}>🔒 {t("doc.lock")}</button>
        )}
        <button className="btn btn-sm btn-danger" disabled={!!busy} onClick={remove}>
          {busy === "delete" ? <span className="spinner" /> : t("doc.delete")}
        </button>
      </div>

      {modal === "unlock" && (
        <PasswordModal
          title={t("pw.unlockTitle")}
          hint={t("pw.unlockHint", { name: doc.name })}
          fields={[{ name: "password", label: t("pw.password") }]}
          onSubmit={submitUnlock}
          onClose={() => { pendingRef.current = null; setModal(null); }}
        />
      )}
      {modal === "setLock" && (
        <PasswordModal
          title={doc.locked ? t("pw.changeTitle") : t("pw.setTitle")}
          hint={t("upload.lockHint")}
          fields={[
            ...(doc.locked ? [{ name: "current", label: t("pw.current") }] : []),
            { name: "next", label: doc.locked ? t("pw.new") : t("pw.password") },
          ]}
          submitLabel={t("pw.save")}
          onSubmit={submitSetLock}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "removeLock" && (
        <PasswordModal
          title={t("pw.removeTitle")}
          fields={[{ name: "password", label: t("pw.password") }]}
          onSubmit={submitRemoveLock}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "edit" && (
        <EditDocModal
          doc={doc}
          onSaved={() => { setModal(null); onToast(t("doc.saved")); onChanged(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
