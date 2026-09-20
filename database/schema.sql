-- ==============================================================================
-- FlowSight AI — Supabase PostgreSQL Database Schema
-- Multi-Tier Urban Traffic Intelligence, Forecasting & Network Advisory Platform
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. NETWORK TOPOLOGY TABLES
CREATE TABLE IF NOT EXISTS network_nodes (
    node_id VARCHAR(16) PRIMARY KEY,
    x DOUBLE PRECISION NOT NULL,
    y DOUBLE PRECISION NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS network_segments (
    segment_id VARCHAR(16) PRIMARY KEY,
    source_node VARCHAR(16) REFERENCES network_nodes(node_id),
    target_node VARCHAR(16) REFERENCES network_nodes(node_id),
    road_class VARCHAR(32) NOT NULL,
    lanes INT NOT NULL,
    free_flow_speed_kmh DOUBLE PRECISION NOT NULL,
    capacity_vph DOUBLE PRECISION NOT NULL,
    length_km DOUBLE PRECISION NOT NULL,
    grade_pct DOUBLE PRECISION DEFAULT 0.0,
    signal_id VARCHAR(32),
    structural_bottleneck INT DEFAULT 0,
    importance DOUBLE PRECISION DEFAULT 0.5,
    peak_capacity_factor DOUBLE PRECISION DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signal_plans (
    signal_id VARCHAR(32) PRIMARY KEY,
    node_id VARCHAR(16) REFERENCES network_nodes(node_id),
    cycle_s INT NOT NULL,
    green_ratio DOUBLE PRECISION NOT NULL,
    offset_s INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS turn_restrictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id VARCHAR(16) REFERENCES network_nodes(node_id),
    from_segment VARCHAR(16) REFERENCES network_segments(segment_id),
    to_segment VARCHAR(16) REFERENCES network_segments(segment_id),
    restriction VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TRAFFIC OBSERVATIONS & FORECASTS
CREATE TABLE IF NOT EXISTS traffic_snapshots (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    segment_id VARCHAR(16) REFERENCES network_segments(segment_id),
    speed_kmh DOUBLE PRECISION NOT NULL,
    flow_vph DOUBLE PRECISION NOT NULL,
    occupancy_pct DOUBLE PRECISION NOT NULL,
    travel_time_min DOUBLE PRECISION NOT NULL,
    delay_min DOUBLE PRECISION NOT NULL,
    queue_length_veh DOUBLE PRECISION NOT NULL,
    congestion_index DOUBLE PRECISION NOT NULL,
    congestion_regime VARCHAR(16) NOT NULL,
    sensor_quality DOUBLE PRECISION DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_snapshot UNIQUE (timestamp, segment_id)
);

CREATE TABLE IF NOT EXISTS traffic_forecasts (
    id BIGSERIAL PRIMARY KEY,
    forecast_base_time TIMESTAMPTZ NOT NULL,
    segment_id VARCHAR(16) REFERENCES network_segments(segment_id),
    horizon_minutes INT NOT NULL, -- 15, 30, 45, 60
    predicted_speed_kmh DOUBLE PRECISION NOT NULL,
    predicted_flow_vph DOUBLE PRECISION NOT NULL,
    predicted_congestion DOUBLE PRECISION NOT NULL,
    confidence_level VARCHAR(16) NOT NULL,
    model_version VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_forecast UNIQUE (forecast_base_time, segment_id, horizon_minutes)
);

-- 4. ANOMALIES & INCIDENTS
CREATE TABLE IF NOT EXISTS traffic_anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL,
    segment_id VARCHAR(16) REFERENCES network_segments(segment_id),
    attribution VARCHAR(32) NOT NULL, -- CONFIRMED_INCIDENT, CONFIRMED_ROADWORK, INCIDENT_LIKE_ANOMALY
    title VARCHAR(128) NOT NULL,
    severity VARCHAR(16) NOT NULL, -- NORMAL, WARNING, CRITICAL
    speed_drop_kmh DOUBLE PRECISION NOT NULL,
    speed_drop_pct DOUBLE PRECISION NOT NULL,
    iso_score DOUBLE PRECISION NOT NULL,
    confidence VARCHAR(16) NOT NULL,
    details TEXT NOT NULL,
    evidence JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BOTTLENECKS & PLANNING
CREATE TABLE IF NOT EXISTS bottlenecks_profile (
    segment_id VARCHAR(16) PRIMARY KEY REFERENCES network_segments(segment_id),
    recurrence_rate DOUBLE PRECISION NOT NULL,
    mean_delay_min DOUBLE PRECISION NOT NULL,
    p95_travel_time_min DOUBLE PRECISION NOT NULL,
    avg_queue_veh DOUBLE PRECISION NOT NULL,
    spillback_frequency INT NOT NULL,
    bottleneck_type VARCHAR(32) NOT NULL, -- STRUCTURAL vs EPISODIC
    rank INT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planning_candidates (
    candidate_id VARCHAR(32) PRIMARY KEY,
    target_segment VARCHAR(16) REFERENCES network_segments(segment_id),
    intervention_type VARCHAR(64) NOT NULL,
    capacity_delta_vph DOUBLE PRECISION NOT NULL,
    cost_index INT NOT NULL,
    feasibility_band VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS simulation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    simulation_type VARCHAR(32) NOT NULL, -- DIVERSION vs INFRASTRUCTURE
    target_id VARCHAR(32) NOT NULL,
    parameters JSONB NOT NULL,
    baseline_metrics JSONB NOT NULL,
    scenario_metrics JSONB NOT NULL,
    impact_summary JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MODEL REGISTRY & AUDIT
CREATE TABLE IF NOT EXISTS model_registry (
    model_id VARCHAR(64) PRIMARY KEY,
    model_version VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL, -- PRODUCTION_READY, EXPERIMENTAL, RETIRED
    training_timestamp TIMESTAMPTZ NOT NULL,
    validation_metrics JSONB NOT NULL,
    feature_list JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_quality_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id VARCHAR(64) NOT NULL,
    dataset_name VARCHAR(64) NOT NULL,
    input_rows BIGINT NOT NULL,
    output_rows BIGINT NOT NULL,
    missing_values BIGINT NOT NULL,
    duplicates BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_ts_seg ON traffic_snapshots(timestamp DESC, segment_id);
CREATE INDEX IF NOT EXISTS idx_traffic_forecasts_ts_seg ON traffic_forecasts(forecast_base_time DESC, segment_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_ts ON traffic_anomalies(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bottlenecks_rank ON bottlenecks_profile(rank ASC);
