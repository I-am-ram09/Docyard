import React, { useState } from "react";
import { useLang } from "../i18n/index.jsx";
import { CLUSTERS, typesFor, isKnownType } from "../data/documentTypes.js";

// Group (academic / personal / work / other) + document type + tags.
// value = { cluster, category, tags }; onChange receives only the fields that changed.
export default function ClusterFields({ value, onChange }) {
  const { t, lang } = useLang();
  const { cluster, category, tags } = value;
  const [custom, setCustom] = useState(!!category && !isKnownType(cluster, category));

  const setCluster = (c) => {
    const keep = custom || !category || isKnownType(c, category);
    onChange({ cluster: c, ...(keep ? {} : { category: "" }) });
  };

  const setCategory = (v) => {
    if (v === "__custom") {
      setCustom(true);
      onChange({ category: "" });
    } else {
      setCustom(false);
      onChange({ category: v });
    }
  };

  return (
    <>
      <div className="field">
        <label htmlFor="cluster">{t("field.cluster")}</label>
        <select id="cluster" value={cluster} onChange={(e) => setCluster(e.target.value)}>
          {CLUSTERS.map((c) => (
            <option key={c} value={c}>{t(`cluster.${c}`)}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="category">{t("field.category")}</label>
        <select id="category" value={custom ? "__custom" : category || ""} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t("field.pickType")}</option>
          {typesFor(cluster, lang).map((x) => (
            <option key={x.key} value={x.key}>{x.label}</option>
          ))}
          <option value="__custom">{t("field.custom")}</option>
        </select>
        {custom && (
          <input
            value={category || ""}
            maxLength={60}
            onChange={(e) => onChange({ category: e.target.value })}
            placeholder={t("field.customPh")}
          />
        )}
      </div>

      <div className="field">
        <label htmlFor="tags">{t("field.tags")}</label>
        <input id="tags" value={tags} onChange={(e) => onChange({ tags: e.target.value })} placeholder={t("field.tagsPh")} />
      </div>
    </>
  );
}
