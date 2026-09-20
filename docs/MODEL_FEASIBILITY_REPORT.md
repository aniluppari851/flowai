# FlowSight AI — Model Feasibility & Capability Analysis Report

## 1. Objective
This report provides a systematic evaluation of all platform capabilities requested in the FlowSight AI specification against empirical evidence from the 17 organizer-provided datasets. It categorizes each capability into:
* **Category A:** Directly supported by data
* **Category B:** Supported through derived features and network modeling
* **Category C:** Not sufficiently supported / requires strict guardrails

---

## 2. Feasibility Categorization Matrix

| Platform Capability | Feasibility Category | Data Sources Available | Modeling & Operational Approach |
| :--- | :--- | :--- | :--- |
| **1. Multi-Horizon Traffic Forecasting (15m, 30m, 45m, 60m)** | **Category A** | `traffic_*.csv`, `forecast_targets_*.csv`, `context_*.csv` | Direct supervised regression on provided targets (`target_speed_*m`, `target_flow_*m`, `target_congestion_*m`). Evaluate Baseline vs LightGBM/XGBoost. |
| **2. Operational Congestion Regimes** | **Category A** | `traffic_*.csv`, `network.csv` | Empirical thresholds based on `congestion_index` and speed ratio: `FREE FLOW` ($<0.15$), `BUILDING` ($0.15–0.35$), `CONGESTED` ($0.35–0.55$), `SEVERE` ($>0.55$). |
| **3. Structural Bottleneck Identification** | **Category A** | `network.csv.structural_bottleneck`, historical delay & queue length | Direct ground-truth classification (16 labeled segments) + empirical recurrence ranking (frequency of delay > 3 min, 95th percentile travel time). |
| **4. Context-Aware Traffic Conditioning** | **Category A** | `context_*.csv` (`rain_intensity`, `event_level`, `holiday_flag`, `hour`) | Exogenous feature enrichment directly attached to 5-minute temporal records. |
| **5. Abnormal Traffic & Shockwave Detection** | **Category B** | `traffic_*.csv` speed/delay vs historical time-of-day baselines | Historical seasonal baseline ($\mu, \sigma$ per segment-hour-weekday) + Isolation Forest on speed deficit, delay deviation, and queue spikes. |
| **6. Incident Intelligence & Attribution** | **Category B** | `incidents_*.csv`, `roadworks_*.csv`, detected anomalies | Spatial-temporal join with verified incident/roadwork windows. If matched $\rightarrow$ "Confirmed Incident" / "Confirmed Roadwork". If unmatched anomaly $\rightarrow$ "Incident-Like Anomaly" with confidence and evidence breakdown. |
| **7. Queue Spillback & Network Propagation** | **Category B** | `network.csv`, `traffic_*.csv.queue_length_veh`, segment lengths | Directed graph propagation tracking: when link queue length approaches physical storage capacity ($\text{length\_km} \times \text{lanes} \times 125\text{ veh/km}$), alert upstream feeder links. |
| **8. Tactical Diversion Simulation** | **Category B** | `network.csv`, `turn_restrictions.csv`, BPR latency formulation | K-shortest path search avoiding congested segment; flow reallocation at 0%, 10%, 20%, 30% diversion fractions; network travel time delta calculation. |
| **9. Infrastructure What-If Planning** | **Category B** | `planning_candidates.csv`, `network.csv`, BPR model | Counterfactual scenario simulation applying `capacity_delta_vph`, new lanes, or connectors; compare baseline vs modified network vehicle-hours traveled (VHT) and delay. |
| **10. Microscopic Vehicle GPS Tracking / Actuation** | **Category C** | Not present | **Strict Guardrail:** Platform remains macro/meso software-only advisory. No individual vehicle telemetry or real-world signal controller actuation is permitted or simulated. |

---

## 3. Modeling Specifications & Training Boundaries

### 3.1 Forecasting Model Architecture
* **Algorithm Hierarchy:**
  1. *Level 0 (Heuristic Baseline):* Historical time-of-day/day-of-week mean speed and congestion index per segment.
  2. *Level 1 (Linear/Ridge Baseline):* Regularized linear model on lag features.
  3. *Level 2 (Production Tree Model):* Gradient Boosted Decision Trees (LightGBM/XGBoost/HistGradientBoosting) trained on temporal lags, rolling statistics, network link metadata, and context variables.
* **Forecasting Targets:**
  * Target 1: `target_speed_15m`, `target_speed_30m`, `target_speed_45m`, `target_speed_60m` (km/h)
  * Target 2: `target_congestion_15m`, `target_congestion_30m`, `target_congestion_45m`, `target_congestion_60m` (index 0–1)
* **Quality Gates:**
  * Regression: MAE, RMSE, SMAPE evaluated independently per horizon on unseen validation period (`2026-01-16` to `2026-01-19`).
  * No model marked `PRODUCTION_READY` unless outperforming Level 0 baseline on unseen validation.

### 3.2 Network Simulation Architecture
* **Graph Engine:** Directed Multigraph $G=(V, E)$ constructed from `nodes.csv` (120 nodes) and `network.csv` (436 edges).
* **Turn Restrictions:** Filtered during path exploration using `turn_restrictions.csv`.
* **Latency Curve (Bureau of Public Roads - BPR):**
  $$t(V) = t_0 \cdot \left[ 1 + \alpha \cdot \left(\frac{V}{C}\right)^\beta \right]$$
  where $t_0$ is free-flow travel time, $V$ is volume (flow vph), $C$ is capacity (capacity vph), and $\alpha \approx 0.15, \beta \approx 4$ calibrated to empirical observation delay.
