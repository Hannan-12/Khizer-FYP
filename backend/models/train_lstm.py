import os
import sys
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import joblib

from models.lstm_model import CropHealthLSTM

INPUT_SIZE = 5
HIDDEN_SIZE = 64
NUM_LAYERS = 2
NUM_CLASSES = 3
SEQ_LENGTH = 12
DROPOUT = 0.3
BATCH_SIZE = 32
EPOCHS = 50
LEARNING_RATE = 0.001

SAVE_DIR = os.path.join(os.path.dirname(__file__), "saved")
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def generate_synthetic_data(n_samples=500, seq_length=SEQ_LENGTH, n_features=INPUT_SIZE):
    X_all = []
    y_all = []

    for label in range(3):
        n = n_samples // 3

        for _ in range(n):
            t = np.linspace(0, 1, seq_length)

            if label == 0:
                rvi_base = np.random.uniform(0.55, 0.8)
                rvi = rvi_base + 0.1 * np.sin(2 * np.pi * t) + np.random.normal(0, 0.03, seq_length)
                vv = np.random.uniform(-12, -8) + np.random.normal(0, 0.5, seq_length)
                vh = np.random.uniform(-18, -14) + np.random.normal(0, 0.5, seq_length)

            elif label == 1:
                rvi_base = np.random.uniform(0.3, 0.55)
                rvi = rvi_base + 0.05 * np.sin(2 * np.pi * t) + np.random.normal(0, 0.05, seq_length)
                vv = np.random.uniform(-14, -10) + np.random.normal(0, 0.8, seq_length)
                vh = np.random.uniform(-20, -16) + np.random.normal(0, 0.8, seq_length)

            else:
                rvi_base = np.random.uniform(0.1, 0.3)
                decline = -0.15 * t
                rvi = rvi_base + decline + np.random.normal(0, 0.06, seq_length)
                vv = np.random.uniform(-16, -12) + np.random.normal(0, 1.2, seq_length)
                vh = np.random.uniform(-22, -18) + np.random.normal(0, 1.2, seq_length)

            rvi = np.clip(rvi, 0, 1)
            vv_vh_ratio = vv - vh
            rvi_std = np.abs(np.random.normal(0.02 + label * 0.03, 0.01, seq_length))

            sample = np.column_stack([rvi, vv, vh, vv_vh_ratio, rvi_std])
            X_all.append(sample)
            y_all.append(label)

    X = np.array(X_all, dtype=np.float32)
    y = np.array(y_all, dtype=np.int64)

    idx = np.random.permutation(len(X))
    return X[idx], y[idx]


def load_real_data(csv_path: str):
    df = pd.read_csv(csv_path)
    labels = df["label"].values.astype(np.int64)

    feature_cols = [c for c in df.columns if c != "label"]
    n_features = INPUT_SIZE
    seq_length = len(feature_cols) // n_features

    features = df[feature_cols].values.astype(np.float32)
    X = features.reshape(-1, seq_length, n_features)

    return X, labels


def train():
    os.makedirs(SAVE_DIR, exist_ok=True)

    csv_path = os.path.join(DATA_DIR, "training_data.csv")
    if os.path.exists(csv_path):
        print(f"[Train] Loading real data from {csv_path}")
        X, y = load_real_data(csv_path)
    else:
        print("[Train] No training data found. Generating synthetic data for prototyping...")
        X, y = generate_synthetic_data(n_samples=600)

    print(f"[Train] Data shape: X={X.shape}, y={y.shape}")
    print(f"[Train] Class distribution: {np.bincount(y)}")

    n_samples, seq_len, n_feat = X.shape
    X_flat = X.reshape(-1, n_feat)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_flat).reshape(n_samples, seq_len, n_feat)

    scaler_path = os.path.join(SAVE_DIR, "scaler.pkl")
    joblib.dump(scaler, scaler_path)
    print(f"[Train] Scaler saved to {scaler_path}")

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42, stratify=y,
    )

    train_dataset = TensorDataset(torch.FloatTensor(X_train), torch.LongTensor(y_train))
    test_dataset = TensorDataset(torch.FloatTensor(X_test), torch.LongTensor(y_test))

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False)

    model = CropHealthLSTM(
        input_size=INPUT_SIZE,
        hidden_size=HIDDEN_SIZE,
        num_layers=NUM_LAYERS,
        num_classes=NUM_CLASSES,
        dropout=DROPOUT,
    )

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=15, gamma=0.5)

    print(f"\n[Train] Starting training for {EPOCHS} epochs...")
    best_accuracy = 0.0

    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0.0
        correct = 0
        total = 0

        for X_batch, y_batch in train_loader:
            optimizer.zero_grad()
            outputs = model(X_batch)
            loss = criterion(outputs, y_batch)
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            _, predicted = torch.max(outputs, 1)
            total += y_batch.size(0)
            correct += (predicted == y_batch).sum().item()

        scheduler.step()
        train_acc = 100 * correct / total
        avg_loss = total_loss / len(train_loader)

        if (epoch + 1) % 5 == 0 or epoch == EPOCHS - 1:
            model.eval()
            test_correct = 0
            test_total = 0

            with torch.no_grad():
                for X_batch, y_batch in test_loader:
                    outputs = model(X_batch)
                    _, predicted = torch.max(outputs, 1)
                    test_total += y_batch.size(0)
                    test_correct += (predicted == y_batch).sum().item()

            test_acc = 100 * test_correct / test_total
            print(f"  Epoch [{epoch+1}/{EPOCHS}] Loss: {avg_loss:.4f} | Train Acc: {train_acc:.1f}% | Test Acc: {test_acc:.1f}%")

            if test_acc > best_accuracy:
                best_accuracy = test_acc
                model_path = os.path.join(SAVE_DIR, "lstm_model.pt")
                torch.save(model.state_dict(), model_path)
                print(f"  → Best model saved ({test_acc:.1f}%)")

    print(f"\n[Train] Training complete. Best test accuracy: {best_accuracy:.1f}%")
    print(f"[Train] Model saved to {os.path.join(SAVE_DIR, 'lstm_model.pt')}")
    print(f"[Train] Scaler saved to {scaler_path}")


if __name__ == "__main__":
    train()
