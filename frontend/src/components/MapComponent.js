import React, { useState, useCallback, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  DrawingManager,
  Polygon,
} from "@react-google-maps/api";
import "./MapComponent.css";

const MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const libraries = ["drawing", "places"];

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const defaultCenter = {
  lat: 30.3753,
  lng: 69.3451,
};

const defaultZoom = 6;

const mapOptions = {
  mapTypeId: "hybrid",
  mapTypeControl: true,
  streetViewControl: false,
  fullscreenControl: true,
};

const drawingOptions = {
  drawingControl: true,
  drawingControlOptions: {
    position: 2,
    drawingModes: ["polygon"],
  },
  polygonOptions: {
    fillColor: "#1a7a5c",
    fillOpacity: 0.2,
    strokeColor: "#1a7a5c",
    strokeWeight: 2,
    editable: true,
    draggable: false,
  },
};

export default function MapComponent({ onPolygonComplete, rviMapUrl, aoiGeojson }) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: MAPS_API_KEY,
    libraries,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const mapRef = useRef(null);
  const polygonRef = useRef(null);
  const [rviLayerVisible, setRviLayerVisible] = useState(true);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const handlePolygonComplete = useCallback(
    (polygon) => {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
      polygonRef.current = polygon;

      onPolygonComplete(polygon);

      const path = polygon.getPath();
      window.google.maps.event.addListener(path, "set_at", () => {
        onPolygonComplete(polygon);
      });
      window.google.maps.event.addListener(path, "insert_at", () => {
        onPolygonComplete(polygon);
      });
    },
    [onPolygonComplete]
  );

  const handleSearch = useCallback(
    (e) => {
      e.preventDefault();
      if (!searchQuery.trim() || !mapRef.current) return;

      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: searchQuery }, (results, status) => {
        if (status === "OK" && results[0]) {
          const location = results[0].geometry.location;
          mapRef.current.panTo(location);
          mapRef.current.setZoom(14);
        }
      });
    },
    [searchQuery]
  );

  if (loadError) {
    return <div className="map-error">Error loading Google Maps. Check your API key.</div>;
  }

  if (!isLoaded) {
    return <div className="map-loading">Loading map...</div>;
  }

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

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={defaultZoom}
        options={mapOptions}
        onLoad={onMapLoad}
      >
        <DrawingManager
          options={drawingOptions}
          onPolygonComplete={handlePolygonComplete}
        />

        {rviMapUrl && rviLayerVisible && (
          <RviOverlay url={rviMapUrl} map={mapRef.current} />
        )}
      </GoogleMap>

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

function RviOverlay({ url, map }) {
  React.useEffect(() => {
    if (!map || !url) return;

    const tileLayer = new window.google.maps.ImageMapType({
      getTileUrl: (coord, zoom) => {
        return url.replace("{z}", zoom).replace("{x}", coord.x).replace("{y}", coord.y);
      },
      tileSize: new window.google.maps.Size(256, 256),
      opacity: 0.7,
      name: "RVI",
    });

    map.overlayMapTypes.push(tileLayer);

    return () => {
      const idx = map.overlayMapTypes.getArray().indexOf(tileLayer);
      if (idx >= 0) {
        map.overlayMapTypes.removeAt(idx);
      }
    };
  }, [url, map]);

  return null;
}
