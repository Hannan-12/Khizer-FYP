import React, { useState, useCallback } from "react";
import MapComponent from "../components/MapComponent";
import DateRangeSelector from "../components/DateRangeSelector";
import ResultsPanel from "../components/ResultsPanel";
import HowToUse from "../components/HowToUse";
import Navbar from "../components/Navbar";
import { createAnalysis } from "../services/api";
import usePolling from "../hooks/usePolling";
import "./Dashboard.css";

export default function Dashboard({ user, onLogout }) {
  const [aoiGeojson, setAoiGeojson] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [jobId, setJobId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const { result, polling } = usePolling(jobId);

  const handlePolygonComplete = useCallback((polygon) => {
    // Convert Google Maps polygon to GeoJSON
    const path = polygon.getPath().getArray();
    const coordinates = path.map((p) => [p.lng(), p.lat()]);
    coordinates.push(coordinates[0]); // close the ring

    const geojson = {
      type: "Polygon",
      coordinates: [coordinates],
    };
    setAoiGeojson(geojson);
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
