import React, { useState } from "react";
import api, { getErrorMessage } from "../api";
import { useLang } from "../i18n/index.jsx";
import ClusterFields from "./ClusterFields.jsx";

// Edit a document's name, group, type, tags and (for uploaded files) expiry date.
export default function EditDocModal({ doc, onSaved, onClose }) {
  const { t } = useLang();
  const [name, setName] = useState(doc.name);
  const [expiry, setExpiry] = useState(doc.expiryDate || "");
  const [fields, setFields] = useState({ cluster: doc.cluster, category: doc.category || "", tags: doc.tags.join(", ") });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { name, ...fields };
      if (doc.kind !== "collab") body.expiryDate = expiry || null;
      await api.patch(`/documents/${doc.id}`, body);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal card" onSubmit={save}>
        <h3 style={{ marginBottom: 16 }}>{t("edit.title")}</h3>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label>{t("upload.nameLabel")}</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <ClusterFields value={fields} onChange={(patch) => setFields((f) => ({ ...f, ...patch }))} />
        {doc.kind !== "collab" && (
          <div className="field">
            <label>{t("upload.expiryLabel")}</label>
            <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
        )}
        <div className="doc-actions" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-sm" onClick={onClose}>{t("pw.cancel")}</button>
          <button className="btn btn-sm btn-primary" disabled={busy}>
            {busy ? <span className="spinner" /> : t("edit.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
