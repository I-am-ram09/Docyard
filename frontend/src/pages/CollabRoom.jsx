import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import { useLang } from "../i18n/index.jsx";
import PasswordModal from "../components/PasswordModal.jsx";
import CollabEditor from "../components/CollabEditor.jsx";

// mode="owner": /collab/:id        (logged in; asks for the document password if it is locked)
// mode="guest": /collab/join/:token (invite link; no account - just a display name)
export default function CollabRoom({ mode }) {
  const { id, token: inviteToken } = useParams();
  const { t } = useLang();
  const [session, setSession] = useState(null); // { token, role, name, title, docId }
  const [error, setError] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [unlockToken, setUnlockToken] = useState(null);

  // ---- owner ----
  useEffect(() => {
    if (mode !== "owner") return;
    let cancelled = false;
    api
      .post(`/collab/${id}/token`, null, { headers: unlockToken ? { "x-unlock-token": unlockToken } : {} })
      .then((res) => !cancelled && (setSession(res.data), setNeedPassword(false)))
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 423) setNeedPassword(true);
        else setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [mode, id, unlockToken]);

  const submitPassword = async ({ password }) => {
    const res = await api.post(`/documents/${id}/unlock`, { password });
    setUnlockToken(res.data.unlockToken);
  };

  // ---- guest ----
  const storeKey = `docyard_guest_${inviteToken}`;
  const [invite, setInvite] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [joining, setJoining] = useState(false);

  const join = async (name, guestId) => {
    setJoining(true);
    setError("");
    try {
      const res = await api.post(`/collab/join/${inviteToken}`, { displayName: name, guestId });
      sessionStorage.setItem(storeKey, JSON.stringify({ name: res.data.name, guestId: res.data.guestId }));
      setSession(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
      setJoining(false);
    }
  };

  useEffect(() => {
    if (mode !== "guest") return;
    api
      .get(`/collab/join/${inviteToken}`)
      .then((res) => {
        setInvite(res.data);
        try {
          const saved = JSON.parse(sessionStorage.getItem(storeKey) || "null");
          if (saved?.name) join(saved.name, saved.guestId); // same browser tab: skip the form
        } catch {
          /* ignore */
        }
      })
      .catch((err) => setError(getErrorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, inviteToken]);

  if (session) {
    return (
      <CollabEditor
        docId={session.docId}
        token={session.token}
        role={session.role}
        name={session.name}
        title={session.title}
        isOwner={mode === "owner"}
      />
    );
  }

  return (
    <main className="container upload-shell">
      {error && <div className="error-banner">{error}</div>}

      {mode === "owner" && (
        <>
          <Link to="/dashboard" className="btn btn-sm btn-ghost">{t("collab.back")}</Link>
          {needPassword && (
            <PasswordModal
              title={t("pw.unlockTitle")}
              hint={t("err.DOC_LOCKED")}
              fields={[{ name: "password", label: t("pw.password") }]}
              onSubmit={submitPassword}
              onClose={() => window.history.back()}
            />
          )}
          {!needPassword && !error && <p>{t("collab.connecting")}</p>}
        </>
      )}

      {mode === "guest" && invite && !joining && (
        <>
          <h1 className="page-title" style={{ marginBottom: 6 }}>{t("collab.joinTitle", { title: invite.title })}</h1>
          <p className="page-sub" style={{ marginBottom: 26 }}>
            {t("collab.joinSub", {
              owner: invite.ownerName,
              role: invite.role === "viewer" ? t("collab.viewer") : t("collab.editor"),
            })}
          </p>
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              join(displayName.trim());
            }}
          >
            <div className="field">
              <label htmlFor="dn">{t("collab.yourName")}</label>
              <input id="dn" required maxLength={40} autoFocus value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t("collab.yourNamePh")} />
              <span className="field-hint">{t("collab.guestNote")}</span>
            </div>
            <button className="btn btn-primary btn-block">{t("collab.join")}</button>
          </form>
        </>
      )}
    </main>
  );
}
