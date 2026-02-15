import os
import numpy as np
import torch
import joblib
from models.lstm_model import CropHealthLSTM

_model = None
_scaler = None

LABELS = ["Healthy", "Normal", "Stressed"]
MODEL_PATH = os.path.join(os.path.dirname(__file__), "../../models/saved/lstm_model.pt")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "../../models/saved/scaler.pkl")

INPUT_SIZE = 5
HIDDEN_SIZE = 64
NUM_LAYERS = 2
NUM_CLASSES = 3
SEQ_LENGTH = 12


def load_model():
    global _model, _scaler

    if _model is not None:
        return

    if os.path.exists(SCALER_PATH):
        _scaler = joblib.load(SCALER_PATH)
        print(f"[ML] Scaler loaded from {SCALER_PATH}")
    else:
        print(f"[ML] WARNING: No scaler found at {SCALER_PATH}. Using identity scaling.")
        _scaler = None

    _model = CropHealthLSTM(
        input_size=INPUT_SIZE,
        hidden_size=HIDDEN_SIZE,
        num_layers=NUM_LAYERS,
        num_classes=NUM_CLASSES,
    )

    if os.path.exists(MODEL_PATH):
        state_dict = torch.load(MODEL_PATH, map_location=torch.device("cpu"))
        _model.load_state_dict(state_dict)
        print(f"[ML] Model loaded from {MODEL_PATH}")
    else:
        print(f"[ML] WARNING: No model found at {MODEL_PATH}. Using untrained model.")

    _model.eval()


def predict_crop_health(features: np.ndarray) -> dict:
    load_model()

    df_features = _fill_missing(features)

    if _scaler is not None:
        df_features = _scaler.transform(df_features)

    if len(df_features) < SEQ_LENGTH:
        pad_count = SEQ_LENGTH - len(df_features)
        padding = np.tile(df_features[-1:], (pad_count, 1))
        df_features = np.vstack([df_features, padding])
    elif len(df_features) > SEQ_LENGTH:
        df_features = df_features[-SEQ_LENGTH:]

    x = torch.FloatTensor(df_features).unsqueeze(0)

    with torch.no_grad():
        output = _model(x)
        probabilities = torch.softmax(output, dim=1).squeeze().numpy()

    healthy_prob = float(probabilities[0])
    normal_prob = float(probabilities[1])
    stressed_prob = float(probabilities[2])

    max_idx = int(np.argmax(probabilities))
    label = LABELS[max_idx]
    confidence = float(probabilities[max_idx])

    return {
        "healthy": round(healthy_prob * 100, 1),
        "normal": round(normal_prob * 100, 1),
        "stressed": round(stressed_prob * 100, 1),
        "confidence": round(confidence * 100, 1),
        "label": label,
    }


def _fill_missing(features: np.ndarray) -> np.ndarray:
    import pandas as pd
    df = pd.DataFrame(features)
    df = df.ffill().bfill()
    df = df.fillna(0)
    return df.values
