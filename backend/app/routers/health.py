from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def root():
    return {"message": "CropHealth AI API is running"}


@router.get("/health")
async def health_check():
    return {"status": "ok"}
