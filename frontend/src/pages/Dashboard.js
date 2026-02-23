import React, { useState, useCallback } from "react";
import MapComponent from "../components/MapComponent";
import DateRangeSelector from "../components/DateRangeSelector";
import ResultsPanel from "../components/ResultsPanel";
import HowToUse from "../components/HowToUse";
import Navbar from "../components/Navbar";
import { createAnalysis } from "../services/api";
import usePolling from "../hooks/usePolling";
import "./Dashboard.css";

function CoordPanel({ aoiGeojson }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  if (!aoiGeojson) return null;

  // Drop the closing duplicate vertex for display; GEE doesn't need it
  const ring = aoiGeojson.coordinates[0];
  const vertices = ring[ring.length - 1][0] === ring[0][0] && ring[ring.length - 1][1] === ring[0][1]
    ? ring.slice(0, -1)
    : ring;

  const geeSnippet =
    `ee.Geometry.Polygon(\n  [[\n` +
    vertices.map(([lng, lat]) => `    [${lng.toFixed(6)}, ${lat.toFixed(6)}]`).join(",\n") +
    `\n  ]]\n)`;

  const handleCopy = () => {
    navigator.clipboard.writeText(geeSnippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="coord-panel">
      <button className="coord-toggle" onClick={() => setOpen((o) => !o)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points={open ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
        </svg>
        {vertices.length} vertices — GEE coordinates
      </button>

      {open && (
        <>
          <pre className="coord-pre">{geeSnippet}</pre>
          <button className="coord-copy" onClick={handleCopy}>
            {copied ? "✓ Copied!" : "Copy for Google Earth Engine"}
          </button>
        </>
      )}
    </div>
  );
}

export default function Dashboard({ user, onLogout }) {
  const [aoiGeojson, setAoiGeojson] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [jobId, setJobId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const { result, polling } = usePolling(jobId);

  const handlePolygonComplete = useCallback((geojson) => {
    setAoiGeojson(geojson);
    if (geojson) {
      const ring = geojson.coordinates[0];
      const vertices = ring[ring.length - 1][0] === ring[0][0] && ring[ring.length - 1][1] === ring[0][1]
        ? ring.slice(0, -1)
        : ring;
      console.group("Polygon AOI");
      console.log("GeoJSON:", JSON.stringify(geojson, null, 2));
      console.log("Vertices [lng, lat]:", vertices);
      console.log(
        "GEE snippet:\nee.Geometry.Polygon(\n  [[\n" +
        vertices.map(([lng, lat]) => `    [${lng.toFixed(6)}, ${lat.toFixed(6)}]`).join(",\n") +
        "\n  ]]\n)"
      );
      console.groupEnd();
    }
  }, []);

  const handleAnalyze = async () => {
    if (!aoiGeojson) {
      setError("Please draw an Area of Interest on the map.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Please select a date range.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const response = await createAnalysis({
        aoiGeojson,
        startDate,
        endDate,
      });
      setJobId(response.job_id);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create analysis. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setAoiGeojson(null);
    setJobId(null);
    setError(null);
  };

  return (
    <div className="dashboard">
      <Navbar user={user} onLogout={onLogout} />

      <div className="dashboard-content">
        <div className="sidebar">
          <HowToUse />

          <DateRangeSelector
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />

          <div className="aoi-status">
            <h3>Area of Interest</h3>
            {aoiGeojson ? (
              <p className="status-ok">Polygon drawn on map</p>
            ) : (
              <p className="status-pending">Draw a polygon on the map</p>
            )}
            <CoordPanel aoiGeojson={aoiGeojson} />
          </div>

          {error && <div className="error-banner">{error}</div>}

          <div className="action-buttons">
            <button
              className="btn-analyze"
              onClick={handleAnalyze}
              disabled={submitting || polling}
            >
              {submitting ? "Submitting..." : polling ? "Analyzing..." : "Analyze"}
            </button>
            <button className="btn-reset" onClick={handleReset}>
              Reset
            </button>
          </div>

          {result && <ResultsPanel result={result} />}
        </div>

        <div className="map-area">
          <MapComponent
            onPolygonComplete={handlePolygonComplete}
            rviMapUrl={result?.rvi_map_url}
            aoiGeojson={aoiGeojson}
          />
        </div>
      </div>
    </div>
  );
}
