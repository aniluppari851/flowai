# FlowSight AI — Comprehensive System Audit & Diagnosis Report

**Audit Date:** September 19, 2026  
**Platform:** FlowSight AI — Urban Traffic Intelligence, Forecasting & Network Advisory  
**Target Environment:** Dense Urban Network (Hyderabad Metropolitan Grid: 120 Nodes, 436 Road Segments)  
**Standard Enforced:** Zero synthetic data fabrication, strict organizer dataset fidelity, simulated advisory boundary only.

---

## 1. Executive Diagnosis Summary

| Component | Status | Integrity | Details |
|-----------|--------|-----------|---------|
| **Organizer Datasets** | ✅ EXCELLENT | 100% | 17 CSV files in `Datasets/` (3.2M rows). Zero data corruption. Intact original state. |
| **Validated Dataset** | ✅ VERIFIED | 100% | Copied to `dataset/validated/` with identical SHA-256 hashes and schema validation. |
| **ML Models** | ⚠️ PARTIAL | 80% | GBDT models for 15/30/45/60m speed/congestion/flow exist in `ml/models/`. Isolation Forest exists. However, automated training CLI commands (`ml.training.*`), explicit evaluation scripts, and standalone evaluation pipelines are not modularized into standard commands. |
| **Backend API** | ⚠️ PARTIAL | 75% | FastAPI runs with `TrafficService`, but lacks dedicated `/api/system/status`, Supabase database integration endpoints, and dynamic filtering. |
| **Supabase / Database** | ❌ DISCONNECTED | 20% | PostgreSQL schema exists in `database/schema.sql`, but no Supabase client exists in Python/TypeScript, no migrations directory (`supabase/migrations/`) exists, and no `scripts/import_data.py` exists to populate it. |
| **Frontend UI/UX** | ⚠️ INCOMPLETE | 40% | Command Center overview and Data tab are built, but **6 out of 8 sidebar tabs** (Replay, Forecast, Incidents, Bottlenecks, Simulation, Planning) render as empty placeholder screens. The map is a static SVG projection without zoom/pan controls or live timestamp scrubbing. |
| **n8n Orchestration** | ⚠️ UNCONNECTED | 50% | 4 workflow JSON files exist in `n8n/workflows/`, but lack an active environment connection or test triggers. |
| **Configuration & Guides** | ❌ MISSING | 10% | No `requirements.txt`, no `.env.example`, no `COMMANDS.md` exist in the repository. |

---

## 2. Detailed Component Audit

### 2.1 Organizer Datasets & Integrity
- **Original Path:** `c:\Users\Naveen Uppari\OneDrive\Desktop\neurax3.O\Datasets\`
- **Files Verified (17):**
  1. `traffic_train.csv` (162.7 MB, 2,636,928 rows) — 5-minute telemetry over 436 segments.
  2. `traffic_validation.csv` (43.4 MB, 502,272 rows) — 4 unseen validation days (1,152 epochs).
  3. `forecast_targets_train.csv` (37.3 MB) — ground truth for 15m, 30m, 45m, 60m speed/flow/congestion.
  4. `forecast_targets_validation.csv` (49.0 MB) — unseen evaluation targets.
  5. `network.csv` (436 rows) — road attributes: lanes, capacity_vph, free_flow_speed_kmh, length_km, grade_pct.
  6. `nodes.csv` (120 rows) — geographic lat/lon (17.300–17.480, 78.350–78.548) and grid (x: 0–11, y: 0–9).
  7. `incidents_train.csv` & `incidents_validation.csv` — confirmed incident logs.
  8. `roadworks_train.csv` & `roadworks_validation.csv` — confirmed construction/maintenance events.
  9. `context_train.csv` & `context_validation.csv` — weather, precipitation, event flags.
  10. `signal_plans.csv` — signal cycle lengths and green splits.
  11. `turn_restrictions.csv` — prohibited turn pairs at intersections.
  12. `planning_candidates.csv` — 20 infrastructure expansion candidates (PLAN0001 to PLAN0436).
  13. `od_demand_profiles.csv` — origin-destination trips.
  14. `scenario_examples.csv` — predefined simulation scenarios.
- **Rule Adherence:** Zero modification of files in `Datasets/`. All transformations kept in `dataset/validated/` and `dataset/processed/`.

---

### 2.2 Database & Supabase Integration
- **Current Status:** Incomplete / Disconnected.
- **Identified Issues:**
  1. `database/schema.sql` defines tables (`network_nodes`, `network_segments`, `traffic_snapshots`, `traffic_forecasts`, `traffic_anomalies`, `bottlenecks_profile`, `planning_candidates`, `simulation_runs`, `model_registry`, `data_quality_logs`), but:
  2. No `supabase/migrations/` directory exists for reproducible Supabase migrations (`supabase db reset` or CLI execution).
  3. No Python Supabase client or connection layer exists in `backend/`.
  4. No `.env.example` exists documenting `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL`.
  5. No `scripts/import_data.py` exists to validate, preprocess, and load data into Supabase.

---

### 2.3 Machine Learning & Model Registry
- **Current Status:** Models exist, but modular CLI commands and standalone evaluation pipelines are missing.
- **Identified Issues:**
  1. `ml/train_forecast.py` trains GBDT models, but it does not conform to the standard modular command structure:
     - `python -m ml.training.train_forecasting`
     - `python -m ml.training.evaluate_models`
     - `python -m ml.training.register_model`
  2. The model training must NEVER be auto-triggered on application startup.
  3. Feature generation needs to be explicitly separate: `python -m ml.features.build_features`.
  4. `ml/models/model_metadata.json` exists, but needs a full audit trail conforming to Section 21 (`model_id`, `model_version`, `model_type`, `target`, `horizon`, `training_dataset_version`, `feature_version`, `training_timestamp`, `validation_metrics`, `test_metrics`, `status`).

---

### 2.4 FastAPI Backend
- **Current Status:** Partially working.
- **Identified Issues:**
  1. Missing `/api/system/status` endpoint (required by Section 47) returning backend, database, model, data, and pipeline health.
  2. Missing Supabase read/write fallback: when Supabase is configured, data should sync to/from Supabase; when not yet configured, it should gracefully fall back to local validated datasets with clear warning indicators.
  3. Missing replay state filtering: the replay timeline scrubber needs to return complete traffic snapshots for any arbitrary timestamp in the validation/train set.
  4. Missing detailed spillback propagation route tracing for visualization on the map.

---

### 2.5 Frontend UI/UX (Next.js 16 + Tailwind CSS 4)
- **Current Status:** Severely incomplete in terms of module views.
- **Identified Issues:**
  1. **Empty Screens:** Lines 440-449 of `frontend/app/page.tsx` display generic placeholder messages for:
     - Traffic Replay (`replay`)
     - Forecasting (`forecast`)
     - Incident Intelligence (`incidents`)
     - Bottleneck Analysis (`bottlenecks`)
     - Diversion Simulation (`simulation`)
     - Infrastructure What-If (`planning`)
  2. **Map Limitations:** The current SVG map lacks interactive pan/zoom, link hover tooltips, and directional flow arrows. When a timestamp changes, it does not re-render network states smoothly.
  3. **No Replay Controls:** Missing interactive timeline scrubber (play, pause, 0.5x, 1x, 2x, 5x, 10x, previous, next) bound to dataset epochs.
  4. **Diversion Simulation UI Missing:** User cannot select diversion scenarios (10%, 20%, 30%), view baseline vs. scenario travel time comparison, or see affected alternative routes.
  5. **Infrastructure What-If UI Missing:** Cannot select from the 20 `planning_candidates.csv` and view before/after capacity delta, queue reduction, or ROI delay improvements.
  6. **Design Alignment:** Must adhere to the glassmorphic aesthetics, typography, and card hierarchy shown in `design.jpg`.

---

### 2.6 Project Structure & Developer Experience
- **Missing Required Files:**
  - `requirements.txt` / backend dependency definitions.
  - `.env.example` with Supabase credentials and API base URLs.
  - `COMMANDS.md` with complete, copy-pasteable manual instructions for all lifecycle steps.
  - `scripts/import_data.py` for database loading.
  - `scripts/run_pipeline.py` for manual full pipeline execution.

---

## 3. Broken, Missing, and Placeholder Features Matrix

| Feature | Current State | Root Cause | Required Action |
|---------|---------------|------------|-----------------|
| **Traffic Replay View** | Placeholder text | Not implemented in `page.tsx` | Build timeline slider, playback controls (0.5x–10x), epoch selector, dynamic map and KPI re-rendering. |
| **Forecasting Page** | Placeholder text | Not implemented in `page.tsx` | Build multi-horizon view (+15, +30, +45, +60 min) with speed, flow, congestion curves and GBDT rationale. |
| **Incident Intelligence** | Partial (cards in command) | Dedicated page missing | Build full incident view with Isolation Forest residuals, confirmed incident join, and causal evidence. |
| **Spillback Propagation** | API exists, UI missing | No visual network trace | Implement upstream queue and downstream bottleneck spillback highlighting on the map. |
| **Diversion Simulation** | API exists, UI is placeholder | UI missing in `page.tsx` | Build diversion control panel (0%, 10%, 20%, 30%), baseline vs scenario diff cards, and detour route graph. |
| **Bottleneck Analysis** | Basic table on dashboard | Dedicated page is placeholder | Build full bottleneck explorer with recurrence rate, mean delay, and spillback risk metrics. |
| **Infrastructure What-If** | API exists, UI is placeholder | UI missing in `page.tsx` | Build candidate selector (`PLAN0001`–`PLAN0436`), capacity delta calculation, and before/after metrics. |
| **Supabase Database** | Completely disconnected | No client or migrations | Create `supabase/migrations/`, `backend/database/supabase_client.py`, and `scripts/import_data.py`. |
| **System Status Endpoint** | Missing | Missing `/api/system/status` | Implement endpoint returning backend, database, model, data, and pipeline health. |
| **Manual CLI Commands** | Fragmented | Missing modular training structure | Modularize ML into `ml.training.train_forecasting`, `evaluate_models`, `register_model`, etc. |

---

## 4. Remediation Plan Overview

1. **Database & Supabase Layer**:
   - Create `supabase/migrations/20260919000000_initial_schema.sql`.
   - Implement `backend/database/supabase_client.py` with dual-mode support (Supabase PostgreSQL when credentials exist; local verified cache fallback with explicit health status).
   - Create `scripts/import_data.py` for manual validation, preprocessing, and database ingestion.
2. **ML Pipeline Modularization**:
   - Structure `ml/training/` with `train_forecasting.py`, `evaluate_models.py`, `register_model.py`.
   - Structure `ml/features/` with `build_features.py`.
   - Create `scripts/run_pipeline.py` (strictly manual, never auto-executed).
3. **Backend API Enhancements**:
   - Add `/api/system/status` and `/api/health`.
   - Add comprehensive replay endpoint returning indexed epochs.
   - Connect Supabase queries where active.
4. **Frontend Complete Overhaul**:
   - Implement ALL 8 views in `frontend/app/page.tsx` and dedicated modular components.
   - Add SVG map pan/zoom and dynamic segment coloring based on active replay timestamp.
   - Build interactive Diversion Simulation and Infrastructure What-If comparison interfaces.
   - Build interactive Replay timeline with 0.5x–10x playback speed.
   - Match the exact visual hierarchy, card glassmorphism, and color scheme of `design.jpg`.
5. **Configuration & Documentation**:
   - Create `requirements.txt`, `.env.example`, and `COMMANDS.md`.
   - Update `MODEL_EVALUATION_REPORT.md` and test suites.
