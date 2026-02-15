import uuid
import asyncio
from fastapi import APIRouter, HTTPException, Depends

from app.schemas.analysis import AnalysisRequest, AnalysisResponse, AnalysisResult
from app.services.firebase_service import get_firestore_client
from app.services.pipeline import run_analysis_pipeline
from app.services.auth_service import verify_firebase_token

router = APIRouter()


@router.post("/analyze", response_model=AnalysisResponse)
async def create_analysis(
    request: AnalysisRequest,
    user_id: str = Depends(verify_firebase_token),
):
    job_id = str(uuid.uuid4())

    db = get_firestore_client()
    job_ref = db.collection("analysis_jobs").document(job_id)
    job_ref.set({
        "job_id": job_id,
        "user_id": user_id,
        "status": "pending",
        "aoi_geojson": request.aoi_geojson,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "crop_type": request.crop_type,
        "season": request.season,
    })

    asyncio.create_task(run_analysis_pipeline(job_id, request))

    return AnalysisResponse(
        job_id=job_id,
        status="pending",
        message="Analysis job created. Poll /api/result/{job_id} for status.",
    )


@router.get("/result/{job_id}", response_model=AnalysisResult)
async def get_result(
    job_id: str,
    user_id: str = Depends(verify_firebase_token),
):
    db = get_firestore_client()
    job_ref = db.collection("analysis_jobs").document(job_id)
    doc = job_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Job not found")

    data = doc.to_dict()

    if data.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return AnalysisResult(
        job_id=job_id,
        status=data.get("status", "pending"),
        prediction=data.get("prediction"),
        time_series=data.get("time_series"),
        rvi_map_url=data.get("rvi_map_url"),
        warning=data.get("warning"),
        error=data.get("error"),
    )


@router.get("/jobs", response_model=list[AnalysisResult])
async def list_jobs(
    user_id: str = Depends(verify_firebase_token),
):
    db = get_firestore_client()
    jobs = (
        db.collection("analysis_jobs")
        .where("user_id", "==", user_id)
        .order_by("start_date")
        .stream()
    )

    results = []
    for doc in jobs:
        data = doc.to_dict()
        results.append(AnalysisResult(
            job_id=data["job_id"],
            status=data.get("status", "pending"),
            prediction=data.get("prediction"),
            time_series=data.get("time_series"),
            warning=data.get("warning"),
            error=data.get("error"),
        ))

    return results
