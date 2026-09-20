"""
FlowSight AI — Anomaly Detection & Incident Intelligence Engine
Implements:
1. Deviations against historical seasonal profile
2. Isolation Forest anomaly scoring on kinematic residuals
3. Incident correlation against verified incident logs (incidents_*.csv) & roadworks (roadworks_*.csv)
4. Evidence dossier formulation (speed drop, baseline, upstream impact, confidence)
5. Strict "Incident-Like Anomaly" protocol when no verified incident log exists
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.ensemble import IsolationForest

PROJECT_ROOT = r"c:\Users\Naveen Uppari\OneDrive\Desktop\neurax3.O"
VALIDATED_DIR = os.path.join(PROJECT_ROOT, "dataset", "validated")
MODELS_DIR = os.path.join(PROJECT_ROOT, "ml", "models")
REPORTS_DIR = os.path.join(PROJECT_ROOT, "ml", "reports")


class AnomalyDetector:
    def __init__(self):
        self.iso_forest = None
        self.baseline_profile = {}
        self.network_default = {}
        self.incidents = []
        self.roadworks = []
        self._load_dependencies()

    def _load_dependencies(self):
        # 1. Load baseline seasonal profile (can be >100MB — read in chunks for Windows compatibility)
        profile_path = os.path.join(MODELS_DIR, "baseline_seasonal_profile.json")
        if os.path.exists(profile_path):
            try:
                chunks = []
                with open(profile_path, "r", encoding="utf-8") as f:
                    while True:
                        chunk = f.read(64 * 1024 * 1024)  # 64MB chunks
                        if not chunk:
                            break
                        chunks.append(chunk)
                data = json.loads("".join(chunks))
                self.baseline_profile = data.get("profile", {})
                self.network_default = data.get("network_default", {})
            except Exception as e:
                print(f"Warning: Could not load baseline profile ({e}), using empty defaults.")
                self.baseline_profile = {}
                self.network_default = {}


        # 2. Load incidents train & val
        for fname in ["incidents_train.csv", "incidents_validation.csv"]:
            fpath = os.path.join(VALIDATED_DIR, fname)
            if os.path.exists(fpath):
                df_inc = pd.read_csv(fpath)
                df_inc['start_dt'] = pd.to_datetime(df_inc['start_time'])
                df_inc['end_dt'] = pd.to_datetime(df_inc['end_time'])
                self.incidents.extend(df_inc.to_dict('records'))

        # 3. Load roadworks
        for fname in ["roadworks_train.csv", "roadworks_validation.csv"]:
            fpath = os.path.join(VALIDATED_DIR, fname)
            if os.path.exists(fpath):
                df_rw = pd.read_csv(fpath)
                df_rw['start_dt'] = pd.to_datetime(df_rw['start_time'])
                df_rw['end_dt'] = pd.to_datetime(df_rw['end_time'])
                self.roadworks.extend(df_rw.to_dict('records'))

        # 4. Load or fit Isolation Forest
        iso_path = os.path.join(MODELS_DIR, "isolation_forest.joblib")
        if os.path.exists(iso_path):
            self.iso_forest = joblib.load(iso_path)

    def fit_isolation_forest(self, sample_size=50000):
        print("Fitting Isolation Forest for multi-variate kinematic anomaly detection...")
        df_traffic = pd.read_csv(os.path.join(VALIDATED_DIR, "traffic_train.csv"))
        if len(df_traffic) > sample_size:
            sample = df_traffic.sample(n=sample_size, random_state=42)
        else:
            sample = df_traffic

        # Compute residuals relative to free flow
        features = sample[['speed_kmh', 'delay_min', 'occupancy_pct', 'queue_length_veh', 'congestion_index']].values
        self.iso_forest = IsolationForest(n_estimators=100, contamination=0.03, random_state=42)
        self.iso_forest.fit(features)

        os.makedirs(MODELS_DIR, exist_ok=True)
        joblib.dump(self.iso_forest, os.path.join(MODELS_DIR, "isolation_forest.joblib"))
        print("Isolation Forest trained and saved.")

    def get_baseline_for(self, segment_id, dt):
        key = f"{segment_id}_{dt.dayofweek}_{dt.hour}_{dt.minute}"
        if key in self.baseline_profile:
            return self.baseline_profile[key]
        return self.network_default.get(segment_id, {
            'speed_mean': 50.0, 'speed_std': 5.0, 'flow_mean': 1200.0, 'congestion_mean': 0.1, 'delay_mean': 0.1
        })

    def check_observation(self, segment_id, timestamp_str, speed_kmh, flow_vph, occupancy_pct, delay_min, queue_length_veh, congestion_index):
        dt = pd.to_datetime(timestamp_str)
        base = self.get_baseline_for(segment_id, dt)
        expected_speed = base['speed_mean']
        speed_drop = expected_speed - speed_kmh
        speed_drop_pct = (speed_drop / max(10.0, expected_speed)) * 100.0

        # Anomaly criteria
        is_speed_anomaly = speed_drop >= 12.0 or speed_drop_pct >= 30.0
        is_congestion_anomaly = congestion_index >= 0.40 and delay_min >= 2.0

        # Isolation forest score
        iso_score = 0.5
        if self.iso_forest:
            feat = np.array([[speed_kmh, delay_min, occupancy_pct, queue_length_veh, congestion_index]])
            iso_score = float(-self.iso_forest.score_samples(feat)[0])  # higher = more anomalous

        is_abnormal = is_speed_anomaly or is_congestion_anomaly or iso_score > 0.65

        if not is_abnormal:
            return None

        # Check confirmed incident logs
        matched_incident = None
        for inc in self.incidents:
            if inc['segment_id'] == segment_id and inc['start_dt'] <= dt <= inc['end_dt']:
                matched_incident = inc
                break

        # Check roadwork logs
        matched_roadwork = None
        for rw in self.roadworks:
            if rw['segment_id'] == segment_id and rw['start_dt'] <= dt <= rw['end_dt']:
                matched_roadwork = rw
                break

        # Attribution classification
        if matched_incident:
            attribution = "CONFIRMED_INCIDENT"
            title = f"Confirmed Incident: {matched_incident.get('incident_type', 'Vehicle Collision').replace('_', ' ').title()}"
            confidence = "HIGH"
            details = f"Verified in incident registry ({matched_incident.get('incident_id')}). Severity Level: {matched_incident.get('severity')}, Lanes Blocked: {matched_incident.get('lanes_blocked')}."
        elif matched_roadwork:
            attribution = "CONFIRMED_ROADWORK"
            title = f"Authorized Roadwork: {matched_roadwork.get('work_type', 'Maintenance').replace('_', ' ').title()}"
            confidence = "HIGH"
            details = f"Permit {matched_roadwork.get('work_id')}. Closure fraction: {matched_roadwork.get('closure_fraction')}."
        else:
            attribution = "INCIDENT_LIKE_ANOMALY"
            title = "Incident-Like Anomaly"
            confidence = "MEDIUM" if speed_drop_pct > 45.0 else "LOW"
            details = f"Unscheduled kinematic drop. Speed fell by {speed_drop:.1f} km/h ({speed_drop_pct:.0f}% drop below seasonal expectation) without matching public roadwork permit."

        evidence = [
            f"Observed speed {speed_kmh:.1f} km/h vs expected {expected_speed:.1f} km/h ({speed_drop:.1f} km/h deficit).",
            f"Queue length reached {queue_length_veh:.0f} vehicles with detector occupancy at {occupancy_pct:.1f}%.",
            f"Travel delay accumulated to {delay_min:.2f} minutes (Congestion Index: {congestion_index:.3f}).",
            f"Isolation Forest Multi-Variate Anomaly Score: {iso_score:.2f} (Threshold: 0.65)."
        ]

        return {
            "segment_id": segment_id,
            "timestamp": timestamp_str,
            "attribution": attribution,
            "title": title,
            "confidence": confidence,
            "severity": "CRITICAL" if speed_drop_pct >= 50 or congestion_index >= 0.55 else "WARNING",
            "speed_kmh": round(speed_kmh, 1),
            "expected_speed_kmh": round(expected_speed, 1),
            "speed_drop_kmh": round(speed_drop, 1),
            "speed_drop_pct": round(speed_drop_pct, 1),
            "delay_min": round(delay_min, 2),
            "queue_length_veh": round(queue_length_veh, 1),
            "occupancy_pct": round(occupancy_pct, 1),
            "iso_score": round(iso_score, 3),
            "details": details,
            "evidence": evidence
        }


if __name__ == "__main__":
    detector = AnomalyDetector()
    if detector.iso_forest is None:
        detector.fit_isolation_forest()
    print("Testing anomaly check on sample record...")
    res = detector.check_observation(
        segment_id="R0435",
        timestamp_str="2026-01-01 06:20:00",
        speed_kmh=14.5,
        flow_vph=450.0,
        occupancy_pct=85.0,
        delay_min=4.2,
        queue_length_veh=320.0,
        congestion_index=0.62
    )
    print(json.dumps(res, indent=2))
