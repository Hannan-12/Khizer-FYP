import torch
import torch.nn as nn


class CropHealthLSTM(nn.Module):

    def __init__(self, input_size=5, hidden_size=64, num_layers=2, num_classes=3, dropout=0.3):
        super(CropHealthLSTM, self).__init__()

        self.hidden_size = hidden_size
        self.num_layers = num_layers

        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
        )

        self.classifier = nn.Sequential(
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, num_classes),
        )

    def forward(self, x):
        lstm_out, (h_n, _) = self.lstm(x)

        last_hidden = h_n[-1]

        out = self.classifier(last_hidden)
        return out
