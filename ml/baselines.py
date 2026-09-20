"""
FlowSight AI — Baseline Forecasting & Seasonal Profile Engine
Computes the Level 0 empirical baseline:
Historical mean and std grouped by (segment_id, day_of_week, hour, 5-minute bucket).
Evaluates Level 0 baseline on unseen validation dataset to establish quality gate benchmark.
"""

import os
import json
import numpy as np
import pandas as pd
from datetime import datetime

PROJECT_ROOT = r"c:\Users\Naveen Uppari\OneDrive\Desktop\neurax3.O"
VALIDATED_DIR = os.path.join(PROJECT_ROOT, "dataset", "validated")
MODELS_DIR = os.path.join(PROJECT_ROOT, "ml", "models")
REPORTS_DIR = os.path.join(PROJECT_ROOT, "ml", "reports")


def calculate_metrics(y_true, y_pred):
    mask = ~np.isnan(y_true) & ~np.isnan(y_pred)
    yt = y_true[mask]
    yp = y_pred[mask]
    if len(yt) == 0:
        return {"mae": 0.0, "rmse": 0.0, "smape": 0.0}

    mae = float(np.mean(np.abs(yt - yp)))
    rmse = float(np.sqrt(np.mean((yt - yp) ** 2)))
    # Symmetric Mean Absolute Percentage Error
    denom = (np.abs(yt) + np.abs(yp)) / 2.0
    valid_denom = denom > 1e-3
    if np.any(valid_denom):
        smape = float(np.mean(np.abs(yt[valid_denom] - yp[valid_denom]) / denom[valid_denom]) * 100.0)
    else:
        smape = 0.0

    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "smape": round(smape, 2)
    }


class SeasonalBaseline:
    def __init__(self):
        self.profile = {}
        self.network_default = {}

    def fit(self, df_train):
        print("Fitting seasonal baseline on training observations...")
        # Ensure timestamp is parsed
        if not pd.api.types.is_datetime64_any_dtype(df_train['timestamp']):
            df_train['dt'] = pd.to_datetime(df_train['timestamp'])
        else:
            df_train['dt'] = df_train['timestamp']

        df_train['dow'] = df_train['dt'].dt.dayofweek
        df_train['hour'] = df_train['dt'].dt.hour
        df_train['minute'] = df_train['dt'].dt.minute

        # Group by segment, dow, hour, minute
        grouped = df_train.groupby(['segment_id', 'dow', 'hour', 'minute'])[['speed_kmh', 'flow_vph', 'congestion_index', 'delay_min']].agg(['mean', 'std']).reset_index()
        
        # Flatten columns
        grouped.columns = ['_'.join(c).strip('_') for c in grouped.columns]

        # Convert to fast lookup dict
        for _, row in grouped.iterrows():
            key = (row['segment_id'], int(row['dow']), int(row['hour']), int(row['minute']))
            self.profile[key] = {
                'speed_mean': float(row['speed_kmh_mean']),
                'speed_std': float(row['speed_kmh_std']) if not np.isnan(row['speed_kmh_std']) else 1.0,
                'flow_mean': float(row['flow_vph_mean']),
                'congestion_mean': float(row['congestion_index_mean']),
                'delay_mean': float(row['delay_min_mean'])
            }

        # Overall defaults per segment
        seg_grouped = df_train.groupby('segment_id')[['speed_kmh', 'flow_vph', 'congestion_index', 'delay_min']].mean()
        for seg_id, row in seg_grouped.iterrows():
            self.network_default[seg_id] = {
                'speed_mean': float(row['speed_kmh']),
                'speed_std': 3.0,
                'flow_mean': float(row['flow_vph']),
                'congestion_mean': float(row['congestion_index']),
                'delay_mean': float(row['delay_min'])
            }

        print(f"Baseline fitted for {len(self.profile)} seasonal buckets across {len(self.network_default)} segments.")

    def predict_point(self, segment_id, dt):
        key = (segment_id, dt.dayofweek, dt.hour, dt.minute)
        if key in self.profile:
            return self.profile[key]
        return self.network_default.get(segment_id, {
            'speed_mean': 45.0, 'speed_std': 5.0, 'flow_mean': 1000.0, 'congestion_mean': 0.1, 'delay_mean': 0.2
        })

    def evaluate_validation(self, df_val, df_targets_val):
        print("Evaluating Seasonal Baseline against Unseen Validation Targets...")
        if not pd.api.types.is_datetime64_any_dtype(df_targets_val['timestamp']):
            df_targets_val['dt'] = pd.to_datetime(df_targets_val['timestamp'])
        else:
            df_targets_val['dt'] = df_targets_val['timestamp']

        horizons = [15, 30, 45, 60]
        results = {}

        for h in horizons:
            target_speed_col = f"target_speed_{h}m"
            target_cong_col = f"target_congestion_{h}m"
            target_flow_col = f"target_flow_{h}m"

            pred_speeds = []
            pred_congs = []
            pred_flows = []

            # Target times are dt + h minutes
            target_dts = df_targets_val['dt'] + pd.Timedelta(minutes=h)
            segments = df_targets_val['segment_id'].values

            for seg, t_dt in zip(segments, target_dts):
                pred = self.predict_point(seg, t_dt)
                pred_speeds.append(pred['speed_mean'])
                pred_congs.append(pred['congestion_mean'])
                pred_flows.append(pred['flow_mean'])

            pred_speeds = np.array(pred_speeds)
            pred_congs = np.array(pred_congs)
            pred_flows = np.array(pred_flows)

            speed_metrics = calculate_metrics(df_targets_val[target_speed_col].values, pred_speeds)
            cong_metrics = calculate_metrics(df_targets_val[target_cong_col].values, pred_congs)
            flow_metrics = calculate_metrics(df_targets_val[target_flow_col].values, pred_flows)

            results[f"{h}m"] = {
                "speed": speed_metrics,
                "congestion": cong_metrics,
                "flow": flow_metrics
            }
            print(f"Horizon {h}m Baseline Results -> Speed MAE: {speed_metrics['mae']:.2f} km/h, RMSE: {speed_metrics['rmse']:.2f}")

        return results


def run_baseline_training():
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)

    train_path = os.path.join(VALIDATED_DIR, "traffic_train.csv")
    val_path = os.path.join(VALIDATED_DIR, "traffic_validation.csv")
    targets_val_path = os.path.join(VALIDATED_DIR, "forecast_targets_validation.csv")

    print(f"Reading training data from {train_path}...")
    df_train = pd.read_csv(train_path)
    baseline = SeasonalBaseline()
    baseline.fit(df_train)

    print(f"Reading validation data from {targets_val_path}...")
    df_targets_val = pd.read_csv(targets_val_path)
    df_val = pd.read_csv(val_path)

    metrics = baseline.evaluate_validation(df_val, df_targets_val)

    # Save baseline profile
    # Convert tuple keys to string for JSON serialization
    serialized_profile = {
        f"{k[0]}_{k[1]}_{k[2]}_{k[3]}": v for k, v in baseline.profile.items()
    }
    with open(os.path.join(MODELS_DIR, "baseline_seasonal_profile.json"), "w") as f:
        json.dump({
            "model_type": "Seasonal_Baseline_L0",
            "created_at": datetime.now().isoformat(),
            "metrics_validation": metrics,
            "profile": serialized_profile,
            "network_default": baseline.network_default
        }, f)

    with open(os.path.join(REPORTS_DIR, "baseline_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"Baseline training & evaluation complete! Metrics saved to {REPORTS_DIR}/baseline_metrics.json")


if __name__ == "__main__":
    run_baseline_training()
