# CropHealth AI - Crop Health Monitoring System

A satellite-based crop health monitoring system using Sentinel-1 SAR data, LSTM deep learning, and Google Earth Engine.

## Architecture

```
User → React Frontend → Python Backend → Google Earth Engine
                ↕              ↕                ↕
            Firebase      LSTM Model      Sentinel-1 Data
```

## Pipeline

1. **User** draws AOI polygon on Google Maps, selects date range
2. **Backend** fetches Sentinel-1 time-series from GEE (VV/VH/RVI)
3. **Backend** resamples, normalizes, runs LSTM inference
4. **Frontend** displays health prediction (Healthy/Normal/Stressed) + charts

## Tech Stack

- **Frontend**: React, Google Maps API, Firebase Auth, Recharts
- **Backend**: FastAPI (Python), Google Earth Engine API, PyTorch
- **Database**: Firebase Firestore
- **ML Model**: LSTM trained on Sentinel-1 SAR features

## Setup

### Prerequisites
- Node.js 18+
- Python 3.9+
- Google Earth Engine account (approved)
- Firebase project
- Google Maps API key

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local  # fill in your keys
npm start
```

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in your keys
uvicorn app.main:app --reload
```

### Train LSTM (one-time)
```bash
cd backend
python -m models.train_lstm
```

## Project Structure
```
├── frontend/              # React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components (Auth, Dashboard, Results)
│   │   ├── services/      # API & Firebase services
│   │   ├── hooks/         # Custom React hooks
│   │   └── utils/         # Utility functions
│   └── public/
├── backend/               # Python FastAPI server
│   ├── app/
│   │   ├── main.py        # FastAPI app entry point
│   │   ├── routers/       # API route handlers
│   │   ├── services/      # GEE, Firebase, ML services
│   │   └── schemas/       # Pydantic models
│   ├── models/
│   │   ├── lstm_model.py  # LSTM architecture
│   │   ├── train_lstm.py  # Training script
│   │   └── saved/         # Saved model weights & scaler
│   └── requirements.txt
```
