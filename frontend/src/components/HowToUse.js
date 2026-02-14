import React, { useState } from "react";
import "./HowToUse.css";

export default function HowToUse() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="how-to-use">
      <div className="how-header" onClick={() => setCollapsed(!collapsed)}>
        <h3>How to Use</h3>
        <span className="toggle">{collapsed ? "+" : "-"}</span>
      </div>
      {!collapsed && (
        <ol className="steps">
          <li>Search for your farm location on the map</li>
          <li>Draw a polygon around your area of interest</li>
          <li>Select a date range (3-6 months recommended)</li>
          <li>Click <strong>Analyze</strong> to start</li>
          <li>View crop health results and RVI time series</li>
        </ol>
      )}
    </div>
  );
}
