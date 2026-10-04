import React from "react";

export default function StatCard({ label, value, highlight }) {
  return (
    <div className={`stat-card ${highlight ? "stat-blue" : ""}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
