import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routers import analysis, health
from app.services.firebase_service import initialize_firebase
from app.services.gee_service import initialize_gee

load_dotenv()

app = FastAPI(
    title="CropHealth AI API",
    description="Crop health monitoring using Sentinel-1 SAR data and LSTM",
    version="1.0.0",
)

origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    initialize_firebase()
    initialize_gee()


app.include_router(health.router, tags=["Health"])
app.include_router(analysis.router, prefix="/api", tags=["Analysis"])
