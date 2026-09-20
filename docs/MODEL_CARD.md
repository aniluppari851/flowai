# FlowSight AI — Model Card

## 1. Model Overview
* **Model Identifier:** `flow-gbdt-v2`
* **Model Type:** Multi-Horizon Gradient Boosted Decision Tree (HistGradientBoostingRegressor)
* **Model Release Version:** `2.0.0-gbdt`
* **Release Date:** 2026-09-19
* **Developer:** FlowSight AI Engineering Team
* **License:** Advisory / Decision-Support Open Evaluation
* **Target Horizons:** 15 minutes, 30 minutes, 45 minutes, 60 minutes
* **Target Variables:**
  * Space Mean Speed (`target_speed_*m`, km/h)
  * Operational Congestion Index (`target_congestion_*m`, 0.0 to 1.0)
  * Vehicle Throughput Flow Rate (`target_flow_*m`, veh/hr)

---

## 2. Intended Use & Operating Boundaries
* **Primary Use Case:** Operational situational awareness, anticipatory queue mitigation, tactical diversion decision support, and urban bottleneck diagnostics for the Hyderabad metropolitan network.
* **Prohibited Real-World Actuations:**
  * Must NOT be used for direct automated traffic signal phase actuation.
  * Must NOT be connected to real-world municipal dynamic message signs without human review.
  * Must NOT be assumed to provide micro-simulation or individual vehicle route tracking.

---

## 3. Training & Validation Datasets
* **Training Dataset:** `traffic_train.csv` (1,883,520 records across 15 days, `2026-01-01 00:00:00` to `2026-01-15 23:55:00`).
* **Unseen Validation Dataset:** `traffic_validation.csv` & `forecast_targets_validation.csv` (502,272 records across 4 days, `2026-01-16 00:00:00` to `2026-01-19 23:55:00`).
* **Data Splitting Principle:** Strict chronological split. Zero future-data leakage.

---

## 4. Input Features (21 Features)
* **Kinematic & Sensor States:** `speed_kmh`, `flow_vph`, `occupancy_pct`, `delay_min`, `queue_length_veh`, `congestion_index`, `vc_ratio`.
* **Network Geometry:** `lanes`, `free_flow_speed_kmh`, `capacity_vph`, `length_km`, `grade_pct`, `structural_bottleneck`, `importance`.
* **Exogenous Environmental Context:** `temperature_c`, `rain_intensity`, `event_level`, `holiday_flag`.
* **Temporal Cyclicity:** `hour`, `day_of_week`, `is_weekend`.

---

## 5. Performance Summary (Unseen Validation Benchmark)

| Horizon | Metric | Level 0 Seasonal Baseline | FlowSight GBDT Model | Delta Improvement | Quality Gate Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **15 Minutes** | **Speed MAE** | 0.8100 km/h | **0.5503 km/h** | **+32.06%** | **PRODUCTION_READY** |
| | **Congestion MAE** | 0.0183 | **0.0131** | **+28.42%** | **PRODUCTION_READY** |
| | **Flow MAE** | 184.65 vph | **153.14 vph** | **+17.06%** | **PRODUCTION_READY** |
| **30 Minutes** | **Speed MAE** | 0.8102 km/h | **0.6726 km/h** | **+16.98%** | **PRODUCTION_READY** |
| | **Congestion MAE** | 0.0183 | **0.0152** | **+16.94%** | **PRODUCTION_READY** |
| | **Flow MAE** | 184.63 vph | **154.65 vph** | **+16.24%** | **PRODUCTION_READY** |
| **45 Minutes** | **Speed MAE** | 0.8102 km/h | **0.7214 km/h** | **+10.96%** | **PRODUCTION_READY** |
| | **Congestion MAE** | 0.0183 | **0.0162** | **+11.48%** | **PRODUCTION_READY** |
| | **Flow MAE** | 184.60 vph | **155.19 vph** | **+15.93%** | **PRODUCTION_READY** |
| **60 Minutes** | **Speed MAE** | 0.8102 km/h | **0.7819 km/h** | **+3.49%** | **PRODUCTION_READY** |
| | **Congestion MAE** | 0.0183 | **0.0173** | **+5.46%** | **PRODUCTION_READY** |
| | **Flow MAE** | 184.62 vph | **156.40 vph** | **+15.29%** | **PRODUCTION_READY** |

---

## 6. Known Failure Modes & Guardrails
1. **Severe Extreme Anomalies:** Under abrupt lane closures with $>70\%$ capacity loss, 60-minute forecasts experience mild lag before fully projecting queue dissipation.
2. **Rare Weather Spikes:** High rainfall ($>15$ mm/hr) occurred in $<2\%$ of training epochs; the model falls back to wider uncertainty bounds during extreme downpours.
3. **No Fabricated Confirmations:** Unverified traffic slowdowns are categorized as **"Incident-Like Anomaly"** with statistical confidence scores.
