import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import { useLang } from "../i18n/index.jsx";
import ClusterFields from "../components/ClusterFields.jsx";

export default function NewCollab() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [name, setName] = useState("");
  const [fields, setFields] = useState({ cluster: "academic", category: "", tags: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/collab", { name, cluster: fields.cluster, category: fields.category });
      navigate(`/collab/${res.data.document.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <main className="container upload-shell">
      <h1 className="page-title" style={{ marginBottom: 6 }}>{t("collab.newTitle")}</h1>
      <p className="page-sub" style={{ marginBottom: 26 }}>{t("collab.newSub")}</p>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={onSubmit} className="card">
        <div className="field">
          <label htmlFor="title">{t("collab.nameLabel")}</label>
          <input id="title" required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("collab.namePh")} />
        </div>
        <ClusterFields value={fields} onChange={(patch) => setFields((f) => ({ ...f, ...patch }))} />
        <button className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <span className="spinner" /> : t("collab.create")}
        </button>
      </form>
    </main>
  );
}
