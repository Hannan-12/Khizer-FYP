import React from "react";
import TimeSeriesChart from "./TimeSeriesChart";
import "./ResultsPanel.css";

export default function ResultsPanel({ result }) {
  if (!result) return null;

  const { status, prediction, time_series, warning, error } = result;

  if (status === "pending" || status === "processing") {
    return (
      <div className="results-panel">
        <div className="results-loading">
          <div className="spinner" />
          <p>
            {status === "pending" ? "Queued..." : "Processing Sentinel-1 data..."}
          </p>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="results-panel">
        <div className="results-error">
          <h3>Analysis Failed</h3>
          <p>{error || "An unexpected error occurred."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="results-panel">
      <h3>Analysis Results</h3>

      {warning && <div className="results-warning">{warning}</div>}

      {prediction && (
        <div className="prediction-section">
          <div className={`prediction-label ${prediction.label.toLowerCase()}`}>
            {prediction.label}
          </div>
          <div className="confidence">
            Confidence: {prediction.confidence}%
          </div>

          <div className="probability-bars">
            <ProbBar label="Healthy" value={prediction.healthy} color="#2d9b6e" />
            <ProbBar label="Normal" value={prediction.normal} color="#f0ad4e" />
            <ProbBar label="Stressed" value={prediction.stressed} color="#d9534f" />
          </div>
        </div>
      )}

      {time_series && time_series.length > 0 && (
        <div className="chart-section">
          <h4>RVI Time Series</h4>
          <TimeSeriesChart data={time_series} />
        </div>
      )}
    </div>
  );
}

function ProbBar({ label, value, color }) {
  return (
    <div className="prob-bar">
      <div className="prob-header">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="prob-track">
        <div
          className="prob-fill"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}
