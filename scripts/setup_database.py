"""
FlowSight AI — Supabase Database Setup & Data Import (REST API)
================================================================
Creates all tables via the Supabase SQL API, then imports reference
data (nodes, segments, signal plans, planning candidates) via REST.

Usage:
    python scripts/setup_database.py

Prerequisites:
    - .env must contain SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    - pip install httpx python-dotenv
"""

import os
import sys
import csv
import json
import time
from pathlib import Path
from datetime import datetime

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import httpx

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
VALIDATED_DIR = PROJECT_ROOT / "dataset" / "validated"
SCHEMA_FILE = PROJECT_ROOT / "database" / "schema.sql"
REPORTS_DIR = PROJECT_ROOT / "dataset" / "reports"

SEPARATOR = "=" * 70


def check_credentials():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[FATAL] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
        sys.exit(1)
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Service Role Key: {SUPABASE_KEY[:20]}...{SUPABASE_KEY[-8:]}")
    print()


def rest_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }


def execute_sql(sql_text: str) -> bool:
    """Execute raw SQL via Supabase's pg-meta SQL endpoint (available with service_role key)."""
    # Supabase exposes a SQL execution endpoint via the Management API
    # Using the /rest/v1/rpc approach won't work for DDL, so we use pg-meta
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"

    # First try the rpc approach (if a helper function exists)
    # If not, we'll use the alternative approach
    headers = rest_headers()

    # Try the pg-meta endpoint that Supabase Dashboard uses internally
    # This endpoint allows raw SQL execution with service_role key
    pg_meta_url = f"{SUPABASE_URL}/pg/query"
    try:
        resp = httpx.post(
            pg_meta_url,
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
            },
            json={"query": sql_text},
            timeout=30.0
        )
        if resp.status_code in [200, 201]:
            return True
        # If pg/query doesn't work, fallback to creating an RPC function
    except Exception:
        pass

    # Alternative: Create tables via individual REST API calls
    # This won't work for DDL - return False to trigger manual fallback
    return False


def create_tables_via_sql_chunks():
    """Break schema into individual CREATE statements and execute each."""
    print("[Step 1/5] Creating database tables ...")

    schema_sql = SCHEMA_FILE.read_text(encoding="utf-8")

    # Split into individual statements
    statements = []
    current = []
    for line in schema_sql.split("\n"):
        stripped = line.strip()
        if stripped.startswith("--") or not stripped:
            continue
        current.append(line)
        if stripped.endswith(";"):
            statements.append("\n".join(current))
            current = []

    # Try pg-meta endpoint
    pg_meta_url = f"{SUPABASE_URL}/pg/query"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }

    # Test if pg/query endpoint exists
    test_resp = httpx.post(
        pg_meta_url,
        headers=headers,
        json={"query": "SELECT 1 as test;"},
        timeout=10.0
    )

    if test_resp.status_code in [200, 201]:
        print("  Using Supabase SQL execution endpoint (pg/query)...")
        success = 0
        for i, stmt in enumerate(statements):
            try:
                resp = httpx.post(
                    pg_meta_url,
                    headers=headers,
                    json={"query": stmt},
                    timeout=30.0
                )
                if resp.status_code in [200, 201]:
                    success += 1
                else:
                    print(f"  [WARN] Statement {i+1}: HTTP {resp.status_code} - {resp.text[:100]}")
            except Exception as e:
                print(f"  [WARN] Statement {i+1}: {e}")
        print(f"  [OK] {success}/{len(statements)} SQL statements executed.\n")
        return True
    else:
        # Fallback: try using the full schema as one batch
        print("  pg/query endpoint not available. Trying full schema batch...")
        full_resp = httpx.post(
            pg_meta_url,
            headers=headers,
            json={"query": schema_sql},
            timeout=60.0
        )
        if full_resp.status_code in [200, 201]:
            print("  [OK] Full schema executed successfully.\n")
            return True

        # If nothing works, output instructions for manual execution
        print()
        print("  ⚠️  Cannot execute DDL via REST API.")
        print("  ╔══════════════════════════════════════════════════════════════╗")
        print("  ║  MANUAL STEP REQUIRED:                                      ║")
        print("  ║                                                              ║")
        print("  ║  1. Open your Supabase Dashboard:                           ║")
        print(f"  ║     {SUPABASE_URL.replace('/rest/v1','')}")
        print("  ║                                                              ║")
        print("  ║  2. Go to 'SQL Editor' in the left sidebar                  ║")
        print("  ║                                                              ║")
        print("  ║  3. Copy & paste the contents of:                           ║")
        print("  ║     database/schema.sql                                     ║")
        print("  ║                                                              ║")
        print("  ║  4. Click 'Run' to execute                                  ║")
        print("  ║                                                              ║")
        print("  ║  5. Re-run this script to import data                       ║")
        print("  ╚══════════════════════════════════════════════════════════════╝")
        print()
        return False


def upload_table(table_name: str, records: list, batch_size: int = 200):
    """Upload records to a Supabase table via REST API with upsert."""
    print(f"  Uploading {len(records)} records to '{table_name}' ...")
    headers = rest_headers()
    headers["Prefer"] = "resolution=merge-duplicates"

    uploaded = 0
    errors = 0
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        try:
            resp = httpx.post(
                f"{SUPABASE_URL}/rest/v1/{table_name}",
                headers=headers,
                json=batch,
                timeout=30.0
            )
            if resp.status_code in [200, 201]:
                uploaded += len(batch)
            else:
                errors += 1
                if errors <= 3:
                    print(f"    [WARN] Batch {i//batch_size + 1}: HTTP {resp.status_code} - {resp.text[:120]}")
        except Exception as e:
            errors += 1
            if errors <= 3:
                print(f"    [WARN] Batch {i//batch_size + 1}: {e}")

    status = "OK" if uploaded > 0 else "FAIL"
    print(f"  [{status}] {uploaded}/{len(records)} rows uploaded to '{table_name}'.")
    return uploaded


def check_table_exists(table_name: str) -> bool:
    """Check if a table is accessible via REST API."""
    headers = rest_headers()
    try:
        resp = httpx.get(
            f"{SUPABASE_URL}/rest/v1/{table_name}?select=count&limit=0",
            headers=headers,
            timeout=5.0
        )
        return resp.status_code == 200
    except:
        return False


def import_nodes():
    csv_path = VALIDATED_DIR / "nodes.csv"
    if not csv_path.exists():
        print(f"  [SKIP] nodes.csv not found.")
        return 0
    rows = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append({
                "node_id": r["node_id"],
                "x": float(r["x"]),
                "y": float(r["y"]),
                "lat": float(r["lat"]),
                "lon": float(r["lon"]),
            })
    return upload_table("network_nodes", rows)


def import_segments():
    csv_path = VALIDATED_DIR / "network.csv"
    if not csv_path.exists():
        print(f"  [SKIP] network.csv not found.")
        return 0
    rows = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append({
                "segment_id": r["segment_id"],
                "source_node": r["source_node"],
                "target_node": r["target_node"],
                "road_class": r["road_class"],
                "lanes": int(r["lanes"]),
                "free_flow_speed_kmh": float(r["free_flow_speed_kmh"]),
                "capacity_vph": float(r["capacity_vph"]),
                "length_km": float(r["length_km"]),
                "grade_pct": float(r.get("grade_pct", 0.0)),
                "structural_bottleneck": int(r.get("structural_bottleneck", 0)),
                "importance": float(r.get("importance", 0.5)),
            })
    return upload_table("network_segments", rows)


def import_signal_plans():
    csv_path = VALIDATED_DIR / "signal_plans.csv"
    if not csv_path.exists():
        print(f"  [SKIP] signal_plans.csv not found.")
        return 0
    rows = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append({
                "signal_id": r["signal_id"],
                "node_id": r["node_id"],
                "cycle_s": int(r["cycle_s"]),
                "green_ratio": float(r["green_ratio"]),
                "offset_s": int(r.get("offset_s", 0)),
            })
    return upload_table("signal_plans", rows)


def import_planning_candidates():
    csv_path = VALIDATED_DIR / "planning_candidates.csv"
    if not csv_path.exists():
        print(f"  [SKIP] planning_candidates.csv not found.")
        return 0
    rows = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append({
                "candidate_id": r["candidate_id"],
                "target_segment": r["target_segment"],
                "intervention_type": r["intervention_type"],
                "capacity_delta_vph": float(r["capacity_delta_vph"]),
                "cost_index": int(r["cost_index"]),
                "feasibility_band": r["feasibility_band"],
            })
    return upload_table("planning_candidates", rows)


def main():
    print(SEPARATOR)
    print(" FlowSight AI — Supabase Database Setup & Data Import")
    print(f" Timestamp: {datetime.utcnow().isoformat()}")
    print(SEPARATOR)
    print()

    check_credentials()

    # Step 1: Create Tables
    tables_created = create_tables_via_sql_chunks()

    if not tables_created:
        # Check if tables already exist (user may have created them manually before)
        if check_table_exists("network_nodes"):
            print("  [INFO] Tables already exist — proceeding with data import.\n")
        else:
            print("  [STOP] Tables do not exist. Follow the manual steps above, then re-run.\n")
            sys.exit(1)

    # Step 2-4: Import data
    print("[Step 2/5] Importing network nodes ...")
    n_nodes = import_nodes()

    print("\n[Step 3/5] Importing network segments ...")
    n_segs = import_segments()

    print("\n[Step 4a/5] Importing signal plans ...")
    n_signals = import_signal_plans()

    print("\n[Step 4b/5] Importing planning candidates ...")
    n_plans = import_planning_candidates()

    # Step 5: Verify
    print(f"\n[Step 5/5] Verifying data ...")
    tables_to_check = ["network_nodes", "network_segments", "signal_plans", "planning_candidates"]
    for t in tables_to_check:
        headers = rest_headers()
        try:
            resp = httpx.get(
                f"{SUPABASE_URL}/rest/v1/{t}?select=count",
                headers={**headers, "Prefer": "count=exact"},
                timeout=10.0
            )
            count = resp.headers.get("content-range", "unknown")
            print(f"  ✅ {t}: {count}")
        except:
            print(f"  ⚠️  {t}: could not verify")

    # Save report
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report = {
        "timestamp": datetime.utcnow().isoformat(),
        "status": "DATABASE_IMPORT_COMPLETE",
        "supabase_url": SUPABASE_URL,
        "imported": {
            "network_nodes": n_nodes,
            "network_segments": n_segs,
            "signal_plans": n_signals,
            "planning_candidates": n_plans,
        }
    }
    report_path = REPORTS_DIR / "database_setup_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    print()
    print(SEPARATOR)
    print(f" ✅ DATABASE IMPORT COMPLETE")
    print(f"    Nodes: {n_nodes} | Segments: {n_segs}")
    print(f"    Signals: {n_signals} | Candidates: {n_plans}")
    print(f"    Report: {report_path}")
    print(SEPARATOR)


if __name__ == "__main__":
    main()
