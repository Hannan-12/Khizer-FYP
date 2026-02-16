import React, { useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, FeatureGroup } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "./MapComponent.css";

const defaultCenter = [30.3753, 69.3451];
const defaultZoom = 6;

export default function MapComponent({ onPolygonComplete, rviMapUrl, aoiGeojson }) {
  const [searchQuery, setSearchQuery] = useState("");
  const mapRef = useRef(null);
  const featureGroupRef = useRef(null);
  const [rviLayerVisible, setRviLayerVisible] = useState(true);

  const handleCreated = useCallback(
    (e) => {
      // Remove previous polygon if any
      const fg = featureGroupRef.current;
      if (fg) {
        const layers = fg.getLayers();
        if (layers.length > 1) {
          fg.removeLayer(layers[0]);
        }
      }

      const layer = e.layer;
      const latlngs = layer.getLatLngs()[0];
      const coordinates = latlngs.map((ll) => [ll.lng, ll.lat]);
      coordinates.push(coordinates[0]);

      const geojson = {
        type: "Polygon",
        coordinates: [coordinates],
      };
      onPolygonComplete(geojson);
    },
    [onPolygonComplete]
  );

  const handleEdited = useCallback(
    (e) => {
      const layers = e.layers;
      layers.eachLayer((layer) => {
        const latlngs = layer.getLatLngs()[0];
        const coordinates = latlngs.map((ll) => [ll.lng, ll.lat]);
        coordinates.push(coordinates[0]);

        const geojson = {
          type: "Polygon",
          coordinates: [coordinates],
        };
        onPolygonComplete(geojson);
      });
    },
    [onPolygonComplete]
  );

  const handleDeleted = useCallback(() => {
    onPolygonComplete(null);
  }, [onPolygonComplete]);

  const handleSearch = useCallback(
    async (e) => {
      e.preventDefault();
      if (!searchQuery.trim() || !mapRef.current) return;

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
        );
        const data = await res.json();
        if (data && data.length > 0) {
          const { lat, lon } = data[0];
          mapRef.current.setView([parseFloat(lat), parseFloat(lon)], 14);
        }
      } catch (err) {
        console.error("Search failed:", err);
      }
    },
    [searchQuery]
  );

  return (
    <div className="map-component">
      <form className="map-search" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ width: "100%", height: "100%" }}
        ref={mapRef}
      >
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
      </MapContainer>

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
