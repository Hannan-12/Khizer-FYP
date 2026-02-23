import React, { useState, useCallback, useRef, useEffect } from "react";
import { MapContainer, TileLayer, FeatureGroup, Marker, Popup, useMap } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "./MapComponent.css";

const defaultCenter = [30.3753, 69.3451];
const defaultZoom = 6;

// Fix default marker icon broken by webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// Custom search-result pin icon
const searchPin = new L.Icon({
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Inner component that can call useMap() hook
function MapController({ flyTo }) {
  const map = useMap();
  useEffect(() => {
    if (flyTo) {
      map.flyTo(flyTo.center, flyTo.zoom, { duration: 1.2 });
    }
  }, [flyTo, map]);
  return null;
}

export default function MapComponent({ onPolygonComplete, rviMapUrl, aoiGeojson }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResult, setSearchResult] = useState(null); // { center, zoom, label }
  const [flyTo, setFlyTo] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [rviLayerVisible, setRviLayerVisible] = useState(true);

  const featureGroupRef = useRef(null);
  const debounceTimer = useRef(null);
  const searchWrapperRef = useRef(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleOutsideClick(e) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Debounced autocomplete
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const q = searchQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 350);

    return () => clearTimeout(debounceTimer.current);
  }, [searchQuery]);

  const goToResult = useCallback((item) => {
    const center = [parseFloat(item.lat), parseFloat(item.lon)];
    const zoom = item.type === "country" ? 5 : item.type === "state" ? 7 : 14;
    setFlyTo({ center, zoom });
    setSearchResult({ center, label: item.display_name });
    setSearchQuery(item.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchError("");
  }, []);

  const handleSearch = useCallback(
    async (e) => {
      e.preventDefault();
      const q = searchQuery.trim();
      if (!q) return;

      setIsSearching(true);
      setSearchError("");
      setSuggestions([]);
      setShowSuggestions(false);

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        if (data && data.length > 0) {
          goToResult(data[0]);
        } else {
          setSearchError("No results found for that location.");
          setSearchResult(null);
        }
      } catch {
        setSearchError("Search failed. Check your connection.");
        setSearchResult(null);
      } finally {
        setIsSearching(false);
      }
    },
    [searchQuery, goToResult]
  );

  const handleClear = useCallback(() => {
    setSearchQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchError("");
    setSearchResult(null);
    setFlyTo(null);
  }, []);

  const handleCreated = useCallback(
    (e) => {
      const fg = featureGroupRef.current;
      if (fg) {
        const layers = fg.getLayers();
        if (layers.length > 1) fg.removeLayer(layers[0]);
      }
      const layer = e.layer;
      const latlngs = layer.getLatLngs()[0];
      const coordinates = latlngs.map((ll) => [ll.lng, ll.lat]);
      coordinates.push(coordinates[0]);
      onPolygonComplete({ type: "Polygon", coordinates: [coordinates] });
    },
    [onPolygonComplete]
  );

  const handleEdited = useCallback(
    (e) => {
      e.layers.eachLayer((layer) => {
        const latlngs = layer.getLatLngs()[0];
        const coordinates = latlngs.map((ll) => [ll.lng, ll.lat]);
        coordinates.push(coordinates[0]);
        onPolygonComplete({ type: "Polygon", coordinates: [coordinates] });
      });
    },
    [onPolygonComplete]
  );

  const handleDeleted = useCallback(() => {
    onPolygonComplete(null);
  }, [onPolygonComplete]);

  return (
    <div className="map-component">
      {/* ── Search bar ── */}
      <div className="map-search-wrapper" ref={searchWrapperRef}>
        <form className="map-search" onSubmit={handleSearch}>
          <span className="search-icon" aria-hidden="true">
            {isSearching ? (
              <span className="search-spinner" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            )}
          </span>

          <input
            type="text"
            placeholder="Search your area..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchError("");
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            autoComplete="off"
          />

          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={handleClear}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}

          <button type="submit" className="search-submit-btn" disabled={isSearching}>
            Search
          </button>
        </form>

        {/* Autocomplete suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <ul className="search-suggestions">
            {suggestions.map((item) => (
              <li
                key={item.place_id}
                className="search-suggestion-item"
                onMouseDown={() => goToResult(item)}
              >
                <span className="suggestion-icon" aria-hidden="true">📍</span>
                <span className="suggestion-text">{item.display_name}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Error / no-results message */}
        {searchError && (
          <div className="search-error-msg">{searchError}</div>
        )}
      </div>

      {/* ── Map ── */}
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ width: "100%", height: "100%" }}
      >
        <MapController flyTo={flyTo} />

        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
        />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          attribution=""
        />

        <FeatureGroup ref={featureGroupRef}>
          <EditControl
            position="topright"
            onCreated={handleCreated}
            onEdited={handleEdited}
            onDeleted={handleDeleted}
            draw={{
              polygon: {
                shapeOptions: {
                  color: "#1a7a5c",
                  fillColor: "#1a7a5c",
                  fillOpacity: 0.2,
                  weight: 2,
                },
              },
              rectangle: false,
              circle: false,
              circlemarker: false,
              marker: false,
              polyline: false,
            }}
          />
        </FeatureGroup>

        {rviMapUrl && rviLayerVisible && (
          <TileLayer url={rviMapUrl} opacity={0.7} />
        )}

        {/* Search result marker */}
        {searchResult && (
          <Marker position={searchResult.center} icon={searchPin}>
            <Popup maxWidth={280}>
              <span className="search-popup-label">{searchResult.label}</span>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* ── RVI toggle ── */}
      {rviMapUrl && (
        <div className="rvi-toggle">
          <label>
            <input
              type="checkbox"
              checked={rviLayerVisible}
              onChange={(e) => setRviLayerVisible(e.target.checked)}
            />
            Show RVI Layer
          </label>
          <div className="rvi-legend">
            <span className="legend-label">Low</span>
            <div className="legend-bar" />
            <span className="legend-label">High</span>
          </div>
        </div>
      )}
    </div>
  );
}
