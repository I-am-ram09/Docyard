import React, { useState } from "react";
import { getErrorMessage } from "../api";
import { useLang } from "../i18n/index.jsx";

// Generic "type a password" dialog.
// fields: [{ name, label }] (all rendered as password inputs). onSubmit(values) must throw on failure
// (the server's error is shown in the user's language) and the parent closes the modal on success.
export default function PasswordModal({ title, hint, fields, submitLabel, onSubmit, onClose }) {
  const { t } = useLang();
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(values);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal card" onSubmit={submit}>
        <h3 style={{ marginBottom: 8 }}>{title}</h3>
        {hint && <p className="field-hint" style={{ marginBottom: 16, textTransform: "none" }}>{hint}</p>}
        {error && <div className="error-banner">{error}</div>}
        {fields.map((f, i) => (
          <div className="field" key={f.name}>
            <label>{f.label}</label>
            <input
              type="password"
              autoFocus={i === 0}
              required
              autoComplete="off"
              value={values[f.name] || ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            />
          </div>
        ))}
        <div className="doc-actions" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-sm" onClick={onClose}>{t("pw.cancel")}</button>
          <button className="btn btn-sm btn-primary" disabled={busy}>
            {busy ? <span className="spinner" /> : submitLabel || t("pw.continue")}
          </button>
        </div>
      </form>
    </div>
  );
}
