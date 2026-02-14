from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date


class Coordinate(BaseModel):
    lat: float
    lng: float


class AnalysisRequest(BaseModel):
    """Request body for creating a new analysis job."""
    aoi_geojson: dict  # GeoJSON polygon
    start_date: str  # YYYY-MM-DD
    end_date: str  # YYYY-MM-DD
    crop_type: Optional[str] = None
    season: Optional[str] = None

    @field_validator("start_date", "end_date")
    @classmethod
    def validate_date_format(cls, v):
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"Invalid date format: {v}. Use YYYY-MM-DD.")
        return v

    @field_validator("aoi_geojson")
    @classmethod
    def validate_geojson(cls, v):
        if v.get("type") not in ("Polygon", "Feature"):
            raise ValueError("aoi_geojson must be a GeoJSON Polygon or Feature.")
        return v


class AnalysisResponse(BaseModel):
    """Response after creating an analysis job."""
    job_id: str
    status: str
    message: str


class TimeSeriesPoint(BaseModel):
    date: str
    rvi_mean: Optional[float] = None
    rvi_median: Optional[float] = None
    rvi_std: Optional[float] = None
    vv_mean: Optional[float] = None
    vh_mean: Optional[float] = None
    vv_vh_ratio: Optional[float] = None


class PredictionResult(BaseModel):
    healthy: float
    normal: float
    stressed: float
    confidence: float
    label: str  # "Healthy", "Normal", or "Stressed"


class AnalysisResult(BaseModel):
    """Full analysis result returned to frontend."""
    job_id: str
    status: str  # "pending", "processing", "completed", "failed"
    prediction: Optional[PredictionResult] = None
    time_series: Optional[list[TimeSeriesPoint]] = None
    rvi_map_url: Optional[str] = None
    warning: Optional[str] = None
    error: Optional[str] = None
