import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import { useAuth } from "../App.jsx";
import { useLang } from "../i18n/index.jsx";
import { CLUSTERS, typesFor } from "../data/documentTypes.js";
import StatCard from "../components/StatCard.jsx";
import DocumentCard from "../components/DocumentCard.jsx";

const SORTS = ["newest", "oldest", "name_asc", "name_desc", "expiry", "size", "edited"];

export default function Dashboard() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [docs, setDocs] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, expiring_soon: 0, expired: 0 });
  const [clusterCounts, setClusterCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Filters: search / group / type / sort go to the server; the status chips filter what came back.
  const [search, setSearch] = useState("");
  const [q, setQ] = useState(""); // debounced copy of `search`
  const [cluster, setCluster] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const [docsRes, statsRes] = await Promise.all([
          api.get("/documents", { params: { q: q || undefined, cluster: cluster || undefined, category: category || undefined, sort } }),
          api.get("/documents/stats"),
        ]);
        setDocs(docsRes.data.documents);
        setStats(statsRes.data.stats);
        setClusterCounts(statsRes.data.clusters || {});
        setError("");
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [q, cluster, category, sort]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleDeleted = () => {
    setToast(t("dash.deleted"));
    load({ silent: true });
  };

  const pickCluster = (c) => {
    setCluster(c);
    setCategory("");
  };
  const clearFilters = () => {
    setSearch("");
    setCluster("");
    setCategory("");
    setFilter("all");
  };

  const filtered = filter === "all" ? docs : docs.filter((d) => d.status === filter);
  const filterLabel = (f) => (f === "all" ? t("filter.all") : t(`status.${f}`));
  const hasFilters = !!(q || cluster || category || filter !== "all");

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("dash.hey", { name: user?.name?.split(" ")[0] || "" })}</h1>
          <p className="page-sub">{t("dash.sub")}</p>
        </div>
        <div className="doc-actions">
          <Link to="/collab/new" className="btn">{t("dash.newCollab")}</Link>
          <Link to="/upload" className="btn btn-primary">{t("dash.upload")}</Link>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="stat-grid">
        <StatCard label={t("dash.total")} value={stats.total} highlight />
        <StatCard label={t("status.active")} value={stats.active} />
        <StatCard label={t("status.expiring_soon")} value={stats.expiring_soon} />
        <StatCard label={t("status.expired")} value={stats.expired} />
      </div>

      {/* Clusters */}
      <div className="doc-actions" style={{ marginBottom: 14 }}>
        <button className={`btn btn-sm ${cluster === "" ? "btn-primary" : ""}`} onClick={() => pickCluster("")}>
          {t("filter.all")}
        </button>
        {CLUSTERS.map((c) => (
          <button key={c} className={`btn btn-sm ${cluster === c ? "btn-primary" : ""}`} onClick={() => pickCluster(c)}>
            {t(`cluster.${c}`)} ({clusterCounts[c] || 0})
          </button>
        ))}
      </div>

      {/* Search, type, sort */}
      <div className="toolbar-row">
        <input
          className="toolbar-input"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("dash.search")}
          aria-label={t("dash.search")}
        />
        {cluster && (
          <select className="toolbar-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t("field.category")}>
            <option value="">{t("dash.allTypes")}</option>
            {typesFor(cluster, lang).map((x) => (
              <option key={x.key} value={x.key}>{x.label}</option>
            ))}
          </select>
        )}
        <select className="toolbar-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t("dash.sort")}>
          {SORTS.map((s) => (
            <option key={s} value={s}>{t("dash.sort")}: {t(`sort.${s}`)}</option>
          ))}
        </select>
      </div>

      {/* Status chips */}
      <div className="doc-actions" style={{ marginBottom: 18 }}>
        {["all", "active", "expiring_soon", "expired"].map((f) => (
          <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : ""}`} onClick={() => setFilter(f)}>
            {filterLabel(f)}
          </button>
        ))}
        {hasFilters && (
          <button className="btn btn-sm btn-ghost" onClick={clearFilters}>{t("dash.clear")}</button>
        )}
      </div>

      {loading ? (
        <p>{t("dash.loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>{stats.total === 0 ? t("dash.emptyTitle") : t("dash.filterEmptyTitle")}</h3>
          <p>{stats.total === 0 ? t("dash.emptyText") : t("dash.filterEmptyText")}</p>
        </div>
      ) : (
        <div className="doc-list">
          {filtered.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onDeleted={handleDeleted}
              onToast={setToast}
              onChanged={() => load({ silent: true })}
            />
          ))}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
