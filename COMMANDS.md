# FlowSight AI — Operator & Developer Command Guide

Complete, step-by-step commands for running the data pipelines, training ML models, initializing Supabase migrations, starting the backend and frontend, and executing integration tests.

---

## 1. Environment Setup & Installation

### Backend Dependencies
```powershell
# From the project root (neurax3.O)
pip install -r requirements.txt
```

### Frontend Dependencies
```powershell
cd frontend
npm install
cd ..
```

### Environment Variables (.env)
Copy the template and configure your Supabase credentials:
```powershell
copy .env.example .env
```
*(If Supabase credentials are not provided, FlowSight AI automatically operates in local verified mode without crashing).*

---

## 2. Data Validation & Feature Engineering

### Validate Organizer Datasets (Zero Data Loss Check)
```powershell
python ml/data_validation.py
```
*Validates schema, checks null/duplicate rates, verifies network referential integrity, and generates `dataset/reports/validation_pipeline_run.json`.*

### Build Kinematic & Contextual Features
```powershell
python -m ml.features.build_features
```
*Extracts volume-to-capacity ratios, temporal harmonics, weather factors, and creates `dataset/features/feature_metadata.json` with strict chronological splitting (no leakage).*

---

## 3. Machine Learning Training & Evaluation (Manual Only)

> [!IMPORTANT]
> Model training is strictly manual and will never execute automatically on application startup.

### Train Multi-Horizon GBDT Regressors
```powershell
python -m ml.training.train_forecasting
```
*Trains HistGradientBoostingRegressor models for 15m, 30m, 45m, and 60m horizons across speed, congestion index, and flow rate. Serializes artifacts to `ml/models/`.*

### Evaluate Models Against Unseen Validation Targets
```powershell
python -m ml.training.evaluate_models
```
*Evaluates models on `traffic_validation.csv` (1,152 unseen epochs). Computes MAE, RMSE, SMAPE, compares with seasonal baselines, and generates `ml/reports/model_evaluation_metrics.json`.*

### Register Production Model
```powershell
python -m ml.training.register_model
```
*Registers the validated GBDT v2.0.0 model in `ml/models/model_metadata.json` and in Supabase `model_registry` (if connected).*

---

## 4. One-Command Complete Pipeline (Optional)

To run validation, feature engineering, model training, evaluation, registration, and database import in sequence:
```powershell
python scripts/run_pipeline.py
```

---

## 5. Database & Supabase Population

### Apply Supabase Migrations
If using the Supabase CLI:
```powershell
supabase db push
# or to reset from scratch:
supabase db reset
```
If executing via SQL Editor in Supabase Dashboard:
- Run the SQL statements inside `supabase/migrations/20260919000000_initial_schema.sql`.

### Import Real Network & Telemetry to Supabase
```powershell
python scripts/import_data.py
```
*Loads 120 network nodes, 436 road segments, and 20 planning candidates into Supabase PostgreSQL (or caches to local verified storage).*

---

## 6. Running the Application

### Start FastAPI Backend (Terminal 1)
```powershell
# From the project root:
python backend/app/main.py

# Or from the backend directory:
cd backend
python app/main.py
```
*API will be operational at: `http://127.0.0.1:8000` (docs at `http://127.0.0.1:8000/docs`).*

### Start Next.js Command Center (Terminal 2)
```powershell
cd frontend
npm run dev
```
*Command Center will be live at: `http://localhost:3000`.*

---

## 7. Verification & Automated Tests

### Run Backend Integration Tests
```powershell
cd backend
python -m unittest tests/test_api.py
cd ..
```

### Run Frontend Production Build Check
```powershell
cd frontend
npm run build
cd ..
```

### Verify End-to-End System Health Endpoint
```powershell
curl http://127.0.0.1:8000/api/system/status
```
*(Returns real-time status of backend, database, GBDT models, anomaly detector, and network engine).*
