"""
FlowSight AI — Multi-Horizon GBDT Model Training CLI
Trains HistGradientBoostingRegressor for multi-horizon traffic state prediction:
- 15m, 30m, 45m, 60m horizons
- Targets: Space Mean Speed (speed_kmh), Congestion Index, Flow Rate

Usage:
  python -m ml.training.train_forecasting
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from sklearn.ensemble import HistGradientBoostingRegressor

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.features.build_features import extract_features, FEATURE_COLS

VALIDATED_DIR = PROJECT_ROOT / "dataset" / "validated"
MODELS_DIR = PROJECT_ROOT / "ml" / "models"
REPORTS_DIR = PROJECT_ROOT / "ml" / "reports"
MODEL_VERSION = "2.0.0-gbdt"


def train_models():
    print("=" * 65)
    print(" FlowSight AI — Multi-Horizon GBDT Model Training")
    print(f" Version: {MODEL_VERSION} | Horizons: 15m, 30m, 45m, 60m")
    print("=" * 65)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    print("\n[Step 1/3] Ingesting training observations & forward targets...")
    df_net = pd.read_csv(VALIDATED_DIR / "network.csv")
    df_ctx_train = pd.read_csv(VALIDATED_DIR / "context_train.csv")

    df_targets_train = pd.read_csv(VALIDATED_DIR / "forecast_targets_train.csv")
    df_traffic_train = pd.read_csv(VALIDATED_DIR / "traffic_train.csv")

    print("Merging training inputs with forward targets on ['timestamp', 'segment_id']...")
    train_data = df_targets_train.merge(df_traffic_train, on=['timestamp', 'segment_id'], how='inner')

    # Subsample 100,000 representative records for high-speed robust training
    if len(train_data) > 100000:
        print(f"Subsampling 100,000 representative training records from {len(train_data)}...")
        train_sample = train_data.sample(n=100000, random_state=42).copy()
    else:
        train_sample = train_data.copy()

    print("\n[Step 2/3] Extracting kinematic and temporal features...")
    df_features = extract_features(train_sample, df_net, df_ctx_train)
    X_train = df_features[FEATURE_COLS].values

    horizons = [15, 30, 45, 60]
    trained_artifacts = {}

    print("\n[Step 3/3] Training multi-horizon GBDT estimators...")
    for h in horizons:
        print(f"\n--- Training Horizon +{h} Minutes ---")
        
        # 1. Speed target
        y_speed = train_sample[f'target_speed_{h}m'].values
        valid_speed = ~np.isnan(y_speed)
        print(f" -> Fitting GBDT Speed Regressor (+{h}m)...")
        m_speed = HistGradientBoostingRegressor(
            max_iter=100, learning_rate=0.1, max_depth=8, min_samples_leaf=20, random_state=42
        )
        m_speed.fit(X_train[valid_speed], y_speed[valid_speed])
        speed_path = MODELS_DIR / f"gbdt_speed_{h}m.joblib"
        joblib.dump(m_speed, speed_path)
        trained_artifacts[f"speed_{h}m"] = str(speed_path)

        # 2. Congestion Index target
        y_cong = train_sample[f'target_congestion_{h}m'].values
        valid_cong = ~np.isnan(y_cong)
        print(f" -> Fitting GBDT Congestion Regressor (+{h}m)...")
        m_cong = HistGradientBoostingRegressor(
            max_iter=100, learning_rate=0.1, max_depth=8, min_samples_leaf=20, random_state=42
        )
        m_cong.fit(X_train[valid_cong], y_cong[valid_cong])
        cong_path = MODELS_DIR / f"gbdt_congestion_{h}m.joblib"
        joblib.dump(m_cong, cong_path)
        trained_artifacts[f"congestion_{h}m"] = str(cong_path)

        # 3. Flow target
        y_flow = train_sample[f'target_flow_{h}m'].values
        valid_flow = ~np.isnan(y_flow)
        print(f" -> Fitting GBDT Flow Regressor (+{h}m)...")
        m_flow = HistGradientBoostingRegressor(
            max_iter=100, learning_rate=0.1, max_depth=8, min_samples_leaf=20, random_state=42
        )
        m_flow.fit(X_train[valid_flow], y_flow[valid_flow])
        flow_path = MODELS_DIR / f"gbdt_flow_{h}m.joblib"
        joblib.dump(m_flow, flow_path)
        trained_artifacts[f"flow_{h}m"] = str(flow_path)

    print("\n[SUCCESS] All 12 GBDT model artifacts successfully serialized.")
    print("=" * 65)


if __name__ == "__main__":
    train_models()
