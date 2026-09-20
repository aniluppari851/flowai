# FlowSight AI — Comprehensive Model Evaluation & Error Analysis Report

## 1. Evaluation Methodology
To guarantee that model evaluation adheres strictly to the Golden Principles (Rules 4, 5, 6, 7, 8):
* **Chronological Split:** The training dataset covers `2026-01-01` to `2026-01-15` (15 days, 1.88M observations). The validation dataset covers `2026-01-16` to `2026-01-19` (4 days, 502k observations). No future information was accessible during model training.
* **Baseline Hierarchy:** A Level 0 Seasonal Baseline was constructed using historical segment $\times$ day-of-week $\times$ hour $\times$ 5-minute distributions (878,976 seasonal bins).
* **Quality Gate Criteria:** A candidate model must outperform the Level 0 baseline across all time horizons (15m, 30m, 45m, 60m) on unseen validation data to achieve `PRODUCTION_READY` status.

---

## 2. Quantitative Evaluation Results (Unseen Validation Period)

### 2.1 Space Mean Speed Forecasting (`speed_kmh`)
| Horizon | Model Architecture | MAE (km/h) | RMSE (km/h) | SMAPE (%) | Relative Improvement vs Baseline |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **15m** | Level 0 Seasonal Baseline | 0.8100 | 1.7265 | 1.98% | Benchmark |
| | **FlowSight GBDT (Production)** | **0.5503** | **1.2140** | **1.32%** | **+32.06%** |
| **30m** | Level 0 Seasonal Baseline | 0.8102 | 1.7265 | 1.98% | Benchmark |
| | **FlowSight GBDT (Production)** | **0.6726** | **1.4510** | **1.64%** | **+16.98%** |
| **45m** | Level 0 Seasonal Baseline | 0.8102 | 1.7265 | 1.98% | Benchmark |
| | **FlowSight GBDT (Production)** | **0.7214** | **1.5620** | **1.77%** | **+10.96%** |
| **60m** | Level 0 Seasonal Baseline | 0.8102 | 1.7265 | 1.98% | Benchmark |
| | **FlowSight GBDT (Production)** | **0.7819** | **1.6890** | **1.91%** | **+3.49%** |

### 2.2 Operational Congestion Index (`congestion_index`)
| Horizon | Baseline MAE | Production GBDT MAE | Relative Improvement |
| :--- | :--- | :--- | :--- |
| **15m** | 0.0183 | **0.0131** | **+28.42%** |
| **30m** | 0.0183 | **0.0152** | **+16.94%** |
| **45m** | 0.0183 | **0.0162** | **+11.48%** |
| **60m** | 0.0183 | **0.0173** | **+5.46%** |

### 2.3 Traffic Flow Throughput (`flow_vph`)
| Horizon | Baseline MAE | Production GBDT MAE | Relative Improvement |
| :--- | :--- | :--- | :--- |
| **15m** | 184.65 vph | **153.14 vph** | **+17.06%** |
| **30m** | 184.63 vph | **154.65 vph** | **+16.24%** |
| **45m** | 184.60 vph | **155.19 vph** | **+15.93%** |
| **60m** | 184.62 vph | **156.40 vph** | **+15.29%** |

---

## 3. Systematic Error & Failure Analysis

### 3.1 Error Horizon Progression
* As expected in physical transport dynamics, predictive uncertainty increases monotonically from 15 minutes ($\text{MAE} = 0.55\text{ km/h}$) to 60 minutes ($\text{MAE} = 0.78\text{ km/h}$).
* At 15 minutes, the model heavily relies on kinematic inertia (recent speed and flow), yielding an outstanding 32.06% error reduction over seasonal averages.
* By 60 minutes, kinematic inertia attenuates, and the model relies more on time-of-day cyclicity, demand peaks, and link geometry.

### 3.2 Peak vs Off-Peak Performance
* Peak periods (08:00–11:00 and 17:30–20:30) exhibit higher variance ($\text{MAE} \approx 1.12\text{ km/h}$) due to platoon compression and signal cycle friction.
* Off-peak free-flow conditions achieve ultra-high precision ($\text{MAE} \approx 0.38\text{ km/h}$).

### 3.3 Anomaly & Shockwave Sensitivity
* Under confirmed incidents (`incidents_validation.csv`), the model captures sudden speed collapse within the first forward horizon step.
* For unscheduled slowdowns, the **Isolation Forest** scoring layer activates, flagging the corridor with statistical confidence bands.

---

## 4. Final Quality Gate Certification
* **Decision:** `PRODUCTION_READY`
* **Audit Trail:**
  * Model Version: `2.0.0-gbdt`
  * Artifacts: `ml/models/gbdt_speed_*.joblib`, `ml/models/gbdt_congestion_*.joblib`, `ml/models/gbdt_flow_*.joblib`
  * Registry Entry: Stored in `ml/models/model_metadata.json` and Supabase `model_registry`.
