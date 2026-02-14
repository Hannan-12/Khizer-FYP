import traceback
import numpy as np
import pandas as pd
from app.services.firebase_service import get_firestore_client
from app.services.gee_service import fetch_sentinel1_timeseries, get_rvi_map_tile_url
from app.services.ml_service import predict_crop_health
from app.schemas.analysis import AnalysisRequest


async def run_analysis_pipeline(job_id: str, request: AnalysisRequest):
    """Run the full analysis pipeline: GEE fetch → feature engineering → LSTM prediction."""
    db = get_firestore_client()
    job_ref = db.collection("analysis_jobs").document(job_id)

    try:
        # Update status to processing
        job_ref.update({"status": "processing"})

        # Step 1: Fetch Sentinel-1 time series from GEE
        df = fetch_sentinel1_timeseries(
            aoi_geojson=request.aoi_geojson,
            start_date=request.start_date,
            end_date=request.end_date,
        )

        if df.empty or len(df) < 3:
            job_ref.update({
                "status": "completed",
                "warning": "Insufficient Sentinel-1 data for this AOI and date range. "
                           f"Only {len(df)} time steps found (minimum 3 required).",
                "time_series": df.to_dict("records") if not df.empty else [],
            })
            return

        # Step 2: Prepare time series for LSTM
        time_series_records = []
        for _, row in df.iterrows():
            time_series_records.append({
                "date": row["date"],
                "rvi_mean": _safe_float(row.get("rvi_mean")),
                "rvi_median": _safe_float(row.get("rvi_median")),
                "rvi_std": _safe_float(row.get("rvi_std")),
                "vv_mean": _safe_float(row.get("vv_mean")),
                "vh_mean": _safe_float(row.get("vh_mean")),
                "vv_vh_ratio": _safe_float(row.get("vv_vh_ratio")),
            })

        # Step 3: Run LSTM prediction
        feature_cols = ["rvi_mean", "vv_mean", "vh_mean", "vv_vh_ratio", "rvi_std"]
        features = df[feature_cols].values
        prediction = predict_crop_health(features)

        # Step 4: Get RVI map tile URL
        rvi_map_url = None
        try:
            rvi_map_url = get_rvi_map_tile_url(
                aoi_geojson=request.aoi_geojson,
                start_date=request.start_date,
                end_date=request.end_date,
            )
        except Exception as e:
            print(f"[Pipeline] RVI map generation failed: {e}")

        # Step 5: Store results
        job_ref.update({
            "status": "completed",
            "prediction": prediction,
            "time_series": time_series_records,
            "rvi_map_url": rvi_map_url,
        })

    except Exception as e:
        traceback.print_exc()
        job_ref.update({
            "status": "failed",
            "error": str(e),
        })


def _safe_float(value) -> float | None:
    """Convert value to float, returning None for NaN/None."""
    if value is None:
        return None
    try:
        f = float(value)
        return None if np.isnan(f) else round(f, 6)
    except (ValueError, TypeError):
        return None
