"""
FlowSight AI — Full End-to-End Pipeline Orchestration Script
Runs:
1. Data Integrity Validation (ml.data_validation)
2. Feature Engineering (ml.features.build_features)
3. Model Training (ml.training.train_forecasting)
4. Model Evaluation on Unseen Validation Data (ml.training.evaluate_models)
5. Model Registration (ml.training.register_model)
6. Database Population (scripts.import_data)

Usage:
  python scripts/run_pipeline.py

NOTE:
  This script is designed for manual execution by the developer/operator.
  Never run automatically on application startup.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.data_validation import run_validation_pipeline
from ml.features.build_features import run_feature_engineering
from ml.training.train_forecasting import train_models
from ml.training.evaluate_models import evaluate
from ml.training.register_model import register
from scripts.import_data import run_import


def main():
    print("=" * 70)
    print(" FlowSight AI — Complete End-to-End Orchestration Pipeline")
    print("=" * 70)

    # 1. Validation
    print("\n>>> STAGE 1: Data Integrity & Schema Validation")
    val = run_validation_pipeline()
    if not val["all_passed"]:
        print("[ABORT] Data validation failed. Exiting.")
        sys.exit(1)

    # 2. Features
    print("\n>>> STAGE 2: Feature Engineering & Target Alignment")
    run_feature_engineering()

    # 3. Model Training
    print("\n>>> STAGE 3: Multi-Horizon GBDT Model Training")
    train_models()

    # 4. Evaluation
    print("\n>>> STAGE 4: Model Evaluation on Unseen Validation Data")
    evaluate()

    # 5. Registration
    print("\n>>> STAGE 5: Production Model Registration")
    register()

    # 6. Database Population
    print("\n>>> STAGE 6: Data Import to Database / Verified Local Cache")
    run_import()

    print("\n" + "=" * 70)
    print(" [COMPLETE] FlowSight AI pipeline executed successfully!")
    print(" All models, features, metadata, and database tables are up to date.")
    print("=" * 70)


if __name__ == "__main__":
    main()
