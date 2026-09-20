"""
FlowSight AI — Model Evaluation CLI
Evaluates multi-horizon GBDT models against unseen validation data (traffic_validation.csv).
Computes MAE, RMSE, SMAPE and enforces Quality Gate against Level 0 baseline.

Usage:
  python -m ml.training.evaluate_models
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.features.build_features import extract_features, FEATURE_COLS

VALIDATED_DIR = PROJECT_ROOT / "dataset" / "validated"
MODELS_DIR = PROJECT_ROOT / "ml" / "models"
REPORTS_DIR = PROJECT_ROOT / "ml" / "reports"


def calculate_metrics(y_true, y_pred):
    mask = ~np.isnan(y_true) & ~np.isnan(y_pred)
    yt = y_true[mask]
    yp = y_pred[mask]
    if len(yt) == 0:
        return {"mae": 0.0, "rmse": 0.0, "smape": 0.0}

    mae = float(np.mean(np.abs(yt - yp)))
    rmse = float(np.sqrt(np.mean((yt - yp) ** 2)))
    denom = (np.abs(yt) + np.abs(yp)) / 2.0
    valid_denom = denom > 1e-3
    smape = float(np.mean(np.abs(yt[valid_denom] - yp[valid_denom]) / denom[valid_denom]) * 100.0) if np.any(valid_denom) else 0.0

    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "smape": round(smape, 2)
    }


def evaluate():
    print("=" * 65)
    print(" FlowSight AI — Model Evaluation on Unseen Validation Data")
    print("=" * 65)

    df_net = pd.read_csv(VALIDATED_DIR / "network.csv")
    df_ctx_val = pd.read_csv(VALIDATED_DIR / "context_validation.csv")

    print("Loading unseen validation observations & forward targets...")
    df_traffic_val = pd.read_csv(VALIDATED_DIR / "traffic_validation.csv")
    df_targets_val = pd.read_csv(VALIDATED_DIR / "forecast_targets_validation.csv")

    print("Merging validation inputs with ground-truth forward targets on ['timestamp', 'segment_id']...")
    val_data = df_targets_val.merge(df_traffic_val, on=['timestamp', 'segment_id'], how='inner')
    val_sample = val_data.sample(n=min(50000, len(val_data)), random_state=42).copy()

    df_features = extract_features(val_sample, df_net, df_ctx_val)
    X_val = df_features[FEATURE_COLS].values

    # Seasonal baseline reference for speed
    base_mae = {15: 0.8100, 30: 0.8102, 45: 0.8102, 60: 0.8102}
    eval_results = {}

    print("\nEvaluating multi-horizon models:")
    for h in [15, 30, 45, 60]:
        speed_model_file = MODELS_DIR / f"gbdt_speed_{h}m.joblib"
        if not speed_model_file.exists():
            print(f"[ERROR] Model {speed_model_file.name} not found. Run training first.")
            return

        m_speed = joblib.load(speed_model_file)
        y_true_speed = val_sample[f'target_speed_{h}m'].values
        y_pred_speed = m_speed.predict(X_val)
        m_speed_metrics = calculate_metrics(y_true_speed, y_pred_speed)

        # Baseline comparison
        b_mae = base_mae[h]
        imp = ((b_mae - m_speed_metrics["mae"]) / b_mae) * 100.0
        m_speed_metrics["baseline_mae"] = b_mae
        m_speed_metrics["mae_improvement_pct"] = round(imp, 2)
        m_speed_metrics["quality_gate"] = "PASSED" if imp > 0 else "FAILED"

        eval_results[f"horizon_{h}m"] = m_speed_metrics
        print(f" -> +{h}m Speed: MAE={m_speed_metrics['mae']} km/h (Baseline={b_mae}, Imp={imp:+.2f}%) [{m_speed_metrics['quality_gate']}]")

    # Save metrics report
    report_file = REPORTS_DIR / "model_evaluation_metrics.json"
    with open(report_file, "w") as f:
        json.dump(eval_results, f, indent=2)

    print(f"\n[SUCCESS] Evaluation report saved to {report_file}")
    print("=" * 65)


if __name__ == "__main__":
    evaluate()
