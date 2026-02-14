import os
import numpy as np
import torch
import joblib
from models.lstm_model import CropHealthLSTM

# Global model references
_model = None
_scaler = None

LABELS = ["Healthy", "Normal", "Stressed"]
MODEL_PATH = os.path.join(os.path.dirname(__file__), "../../models/saved/lstm_model.pt")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "../../models/saved/scaler.pkl")

# LSTM configuration (must match training)
INPUT_SIZE = 5  # rvi_mean, vv_mean, vh_mean, vv_vh_ratio, rvi_std
HIDDEN_SIZE = 64
NUM_LAYERS = 2
NUM_CLASSES = 3
SEQ_LENGTH = 12  # expected sequence length


def load_model():
    """Load the trained LSTM model and scaler."""
    global _model, _scaler

    if _model is not None:
        return

    # Load scaler
    if os.path.exists(SCALER_PATH):
        _scaler = joblib.load(SCALER_PATH)
        print(f"[ML] Scaler loaded from {SCALER_PATH}")
    else:
        print(f"[ML] WARNING: No scaler found at {SCALER_PATH}. Using identity scaling.")
        _scaler = None

    # Load model
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
    """Run LSTM inference on the feature time series.

    Args:
        features: numpy array of shape (T, num_features) where T is the number of time steps.

    Returns:
        dict with keys: healthy, normal, stressed, confidence, label
    """
    load_model()

    # Handle NaN values via forward fill then backward fill
    df_features = _fill_missing(features)

    # Normalize using the saved scaler
    if _scaler is not None:
        df_features = _scaler.transform(df_features)

    # Pad or truncate to SEQ_LENGTH
    if len(df_features) < SEQ_LENGTH:
        # Pad with the last available value (repeat last row)
        pad_count = SEQ_LENGTH - len(df_features)
        padding = np.tile(df_features[-1:], (pad_count, 1))
        df_features = np.vstack([df_features, padding])
    elif len(df_features) > SEQ_LENGTH:
        # Take the most recent SEQ_LENGTH time steps
        df_features = df_features[-SEQ_LENGTH:]

    # Convert to tensor: (1, seq_len, input_size)
    x = torch.FloatTensor(df_features).unsqueeze(0)

    # Run inference
    with torch.no_grad():
        output = _model(x)
        probabilities = torch.softmax(output, dim=1).squeeze().numpy()

    healthy_prob = float(probabilities[0])
    normal_prob = float(probabilities[1])
    stressed_prob = float(probabilities[2])

    # Determine label and confidence
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
    """Forward-fill then backward-fill NaN values in feature array."""
    import pandas as pd
    df = pd.DataFrame(features)
    df = df.ffill().bfill()
    # If still NaN (all values were NaN for a column), fill with 0
    df = df.fillna(0)
    return df.values
