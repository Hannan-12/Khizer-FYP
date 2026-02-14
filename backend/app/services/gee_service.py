import os
import ee
import numpy as np
import pandas as pd
from datetime import datetime, timedelta


def initialize_gee():
    """Initialize Google Earth Engine with service account credentials."""
    try:
        key_path = os.getenv("GEE_PRIVATE_KEY_PATH", "./gee-service-account-key.json")
        service_account = os.getenv("GEE_SERVICE_ACCOUNT_EMAIL", "")

        credentials = ee.ServiceAccountCredentials(service_account, key_path)
        ee.Initialize(credentials)
        print("[GEE] Initialized successfully")
    except Exception as e:
        print(f"[GEE] Initialization failed: {e}")
        print("[GEE] Attempting default initialization...")
        try:
            ee.Initialize()
            print("[GEE] Default initialization successful")
        except Exception as e2:
            print(f"[GEE] Default initialization also failed: {e2}")


def fetch_sentinel1_timeseries(aoi_geojson: dict, start_date: str, end_date: str) -> pd.DataFrame:
    """Fetch Sentinel-1 time-series features for the given AOI and date range.

    Returns a DataFrame with columns:
        date, vv_mean, vh_mean, rvi_mean, rvi_median, rvi_std, vv_vh_ratio
    """
    # Convert GeoJSON to EE geometry
    if aoi_geojson.get("type") == "Feature":
        geometry = ee.Geometry(aoi_geojson["geometry"])
    else:
        geometry = ee.Geometry(aoi_geojson)

    # Filter Sentinel-1 GRD collection
    collection = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(geometry)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .select(["VV", "VH"])
    )

    # Compute RVI for each image
    def compute_features(image):
        vv = image.select("VV")
        vh = image.select("VH")

        # Convert from dB to linear
        vv_linear = ee.Image(10).pow(vv.divide(10))
        vh_linear = ee.Image(10).pow(vh.divide(10))

        # RVI = 4 * VH / (VV + VH) in linear scale
        rvi = vh_linear.multiply(4).divide(vv_linear.add(vh_linear)).rename("RVI")

        # VV/VH ratio
        vv_vh_ratio = vv.subtract(vh).rename("VV_VH_ratio")  # dB difference = ratio in linear

        return image.addBands([rvi, vv_vh_ratio]).set("system:time_start", image.get("system:time_start"))

    collection_with_features = collection.map(compute_features)

    # Create weekly composites for regular time steps
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")

    records = []
    current = start
    while current < end:
        week_end = current + timedelta(days=10)  # 10-day composites
        if week_end > end:
            week_end = end

        composite = (
            collection_with_features
            .filterDate(current.strftime("%Y-%m-%d"), week_end.strftime("%Y-%m-%d"))
            .median()
        )

        # Reduce region to get stats
        stats = composite.reduceRegion(
            reducer=ee.Reducer.mean()
            .combine(ee.Reducer.median(), sharedInputs=True)
            .combine(ee.Reducer.stdDev(), sharedInputs=True),
            geometry=geometry,
            scale=10,
            maxPixels=1e9,
        )

        stats_dict = stats.getInfo()

        if stats_dict and stats_dict.get("VV_mean") is not None:
            records.append({
                "date": current.strftime("%Y-%m-%d"),
                "vv_mean": stats_dict.get("VV_mean"),
                "vh_mean": stats_dict.get("VH_mean"),
                "rvi_mean": stats_dict.get("RVI_mean"),
                "rvi_median": stats_dict.get("RVI_median"),
                "rvi_std": stats_dict.get("RVI_stdDev"),
                "vv_vh_ratio": stats_dict.get("VV_VH_ratio_mean"),
            })

        current = week_end

    df = pd.DataFrame(records)
    return df


def get_rvi_map_tile_url(aoi_geojson: dict, start_date: str, end_date: str) -> str:
    """Generate a tile URL for RVI visualization on the map."""
    if aoi_geojson.get("type") == "Feature":
        geometry = ee.Geometry(aoi_geojson["geometry"])
    else:
        geometry = ee.Geometry(aoi_geojson)

    collection = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(geometry)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .select(["VV", "VH"])
    )

    # Compute mean RVI
    def add_rvi(image):
        vv_linear = ee.Image(10).pow(image.select("VV").divide(10))
        vh_linear = ee.Image(10).pow(image.select("VH").divide(10))
        rvi = vh_linear.multiply(4).divide(vv_linear.add(vh_linear)).rename("RVI")
        return image.addBands(rvi)

    mean_rvi = collection.map(add_rvi).select("RVI").mean().clip(geometry)

    # Get tile URL with visualization
    vis_params = {
        "min": 0,
        "max": 1,
        "palette": ["red", "yellow", "green"],
    }

    map_id = mean_rvi.getMapId(vis_params)
    return map_id["tile_fetcher"].url_format
