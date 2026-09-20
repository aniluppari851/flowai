# FlowSight AI — Comprehensive Data Dictionary

## 1. Overview
This Data Dictionary documents the schema, data types, physical units, allowable ranges, and operational descriptions for all 17 organizer-provided dataset files for the **FlowSight AI** Urban Traffic Intelligence Platform.

---

## 2. Dataset Files & Entity Relationships

| Dataset File | Rows | Columns | Primary Key / Index | Description |
| :--- | :--- | :--- | :--- | :--- |
| `network.csv` | 436 | 13 | `segment_id` | Directed road segments with physical and geometric attributes |
| `nodes.csv` | 120 | 5 | `node_id` | Network intersections and centroid junctions with spatial coordinates |
| `signal_plans.csv` | 89 | 5 | `signal_id` | Signalized junction cycle timings, green splits, and coordination offsets |
| `turn_restrictions.csv` | 61 | 4 | (`node_id`, `from_segment`, `to_segment`) | Intersection turn prohibitions and time-window restrictions |
| `planning_candidates.csv` | 90 | 6 | `candidate_id` | Catalog of hypothetical infrastructure and traffic engineering interventions |
| `od_demand_profiles.csv` | 1,500 | 5 | `od_id` | Origin-destination base traffic demand matrices between network nodes |
| `scenario_examples.csv` | 30 | 8 | `scenario_id` | Benchmark operational scenarios (incidents, surges) for counterfactual evaluation |
| `roadworks_train.csv` | 8 | 6 | `work_id` | Scheduled maintenance and construction records (training window) |
| `roadworks_validation.csv` | 3 | 6 | `work_id` | Scheduled maintenance records (validation window) |
| `incidents_train.csv` | 49 | 7 | `incident_id` | Verified traffic incident logs (training window) |
| `incidents_validation.csv` | 11 | 7 | `incident_id` | Verified traffic incident logs (validation window) |
| `context_train.csv` | 4,320 | 8 | `timestamp` | Ambient weather, calendar, and public event context (training window) |
| `context_validation.csv` | 1,152 | 8 | `timestamp` | Ambient weather, calendar, and public event context (validation window) |
| `traffic_train.csv` | 1,883,520 | 13 | (`timestamp`, `segment_id`) | Continuous 5-minute traffic observations across 15 days (training) |
| `traffic_validation.csv` | 502,272 | 13 | (`timestamp`, `segment_id`) | Continuous 5-minute traffic observations across 4 days (validation) |
| `forecast_targets_train.csv` | 366,240 | 14 | (`timestamp`, `segment_id`) | Multi-horizon forward truth targets (15m, 30m, 45m, 60m) for training |
| `forecast_targets_validation.csv` | 481,344 | 14 | (`timestamp`, `segment_id`) | Multi-horizon forward truth targets (15m, 30m, 45m, 60m) for validation |

---

## 3. Detailed File Schemas

### 3.1 `network.csv`
Defines the directed link graph of the urban road network.
* `segment_id` (String, e.g., `R0001`–`R0436`): Unique identifier of the directed road link.
* `source_node` (String, e.g., `N001`): Upstream intersection node ID.
* `target_node` (String, e.g., `N002`): Downstream intersection node ID.
* `road_class` (Categorical: `arterial`, `collector`): Functional roadway classification. (182 arterial links, 254 collector links).
* `lanes` (Integer, 1–4): Number of through lanes.
* `free_flow_speed_kmh` (Float, km/h): Theoretical speed under zero-traffic conditions (range: 40.0 – 80.0 km/h).
* `capacity_vph` (Float, veh/hr): Maximum throughput capacity of the link under ideal conditions.
* `length_km` (Float, km): Segment length (range: 0.51 – 2.85 km).
* `grade_pct` (Float, %): Road incline/decline gradient percentage.
* `signal_id` (String or empty): Associated traffic signal ID at the downstream junction.
* `structural_bottleneck` (Binary, 0 or 1): Ground-truth indicator denoting segments prone to chronic geometric bottlenecks (16 segments flagged).
* `importance` (Float, 0.0–1.0): Network centrality / topological criticality weight.
* `peak_capacity_factor` (Float, e.g., 0.85–1.0): Degradation factor applied to capacity during peak demand periods.

### 3.2 `nodes.csv`
Defines the physical junction nodes in geographic space (Hyderabad metropolitan coordinate frame).
* `node_id` (String, `N001`–`N120`): Unique junction identifier.
* `x` (Float): Local Cartesian coordinate X (arbitrary network origin).
* `y` (Float): Local Cartesian coordinate Y.
* `lat` (Float, degrees): WGS84 Latitude (17.3000°N to 17.4620°N).
* `lon` (Float, degrees): WGS84 Longitude (78.3500°E to 78.5480°E).

### 3.3 `signal_plans.csv`
Operational parameters for signalized intersections.
* `signal_id` (String, `SIG001`–`SIG089`): Unique signal identifier.
* `node_id` (String): Junction node where the signal is situated.
* `cycle_s` (Integer, seconds): Total cycle time (range: 60s to 120s).
* `green_ratio` (Float, 0.0–1.0): Proportion of cycle allocated to effective green time for primary approach.
* `offset_s` (Integer, seconds): Coordination progression offset relative to network master clock.

### 3.4 `turn_restrictions.csv`
Movement constraints at intersection nodes.
* `node_id` (String): Junction where restriction applies.
* `from_segment` (String): Inbound segment.
* `to_segment` (String): Outbound segment.
* `restriction` (Categorical: `no_turn`, `no_left`, `time_window`): Legal turn limitation.

### 3.5 `planning_candidates.csv`
Pre-evaluated civil infrastructure and operational intervention options.
* `candidate_id` (String, `PLAN0001`–`PLAN0090`): Unique planning candidate ID.
* `target_segment` (String): Affected road segment.
* `intervention_type` (Categorical: `capacity_upgrade`, `lane_addition`, `connector`, `turn_lane`, `signal_retiming`).
* `capacity_delta_vph` (Float, veh/hr): Expected change in maximum link capacity.
* `cost_index` (Integer, 1–25): Relative capital expenditure rating.
* `feasibility_band` (Categorical: `high`, `medium`, `low`): Implementation practicality / right-of-way difficulty.

### 3.6 `od_demand_profiles.csv`
Static origin-destination baseline demand patterns.
* `od_id` (String, `OD0001`–`OD1500`): Unique OD pair ID.
* `origin_node` (String): Trip production centroid node.
* `destination_node` (String): Trip attraction centroid node.
* `base_demand_vph` (Integer, veh/hr): Baseline trip generation rate.
* `purpose` (Categorical: `commute`, `commercial`, `freight`).

### 3.7 `incidents_train.csv` & `incidents_validation.csv`
Confirmed abnormal disruptions on the network.
* `incident_id` (String): Unique incident event code.
* `start_time` (Timestamp, `YYYY-MM-DD HH:MM:SS`): Event onset time.
* `end_time` (Timestamp, `YYYY-MM-DD HH:MM:SS`): Event clearance time.
* `segment_id` (String): Location link.
* `incident_type` (Categorical: `stalled_vehicle`, `accident_like`, `lane_blockage`, `road_closure`, `demand_surge`).
* `severity` (Integer: 1, 2, 3): Operational impact level.
* `lanes_blocked` (Integer: 0–3): Physical lane reduction.

### 3.8 `roadworks_train.csv` & `roadworks_validation.csv`
Scheduled roadway construction and maintenance activities.
* `work_id` (String): Work authorization ID.
* `segment_id` (String): Affected road segment.
* `start_time` (Timestamp): Construction window start.
* `end_time` (Timestamp): Construction window end.
* `closure_fraction` (Float, 0.0–1.0): Portion of roadway cross-section obstructed.
* `work_type` (Categorical: `lane_maintenance`, `resurfacing`, `utility_work`).

### 3.9 `context_train.csv` & `context_validation.csv`
Exogenous temporal and environmental variables matching the 5-minute time steps.
* `timestamp` (Timestamp, `YYYY-MM-DD HH:MM:SS`): 5-minute interval timestamp.
* `temperature_c` (Float, °C): Ambient temperature.
* `rain_intensity` (Float, mm/hr): Precipitation rate.
* `event_level` (Integer, 0–3): Public stadium/cultural event impact level.
* `event_id` (String): Unique event reference.
* `holiday_flag` (Binary, 0 or 1): Public holiday indicator.
* `day_of_week` (Integer, 0=Monday to 6=Sunday).
* `hour` (Float, 0.0 to 23.9167): Fractional hour of the day.

### 3.10 `traffic_train.csv` & `traffic_validation.csv`
Core 5-minute link observations.
* `timestamp` (Timestamp, `YYYY-MM-DD HH:MM:SS`): 5-minute observation epoch.
* `segment_id` (String): Road link ID.
* `source_node` (String): Upstream node.
* `target_node` (String): Downstream node.
* `speed_kmh` (Float, km/h): Space mean speed (range: 8.38 to 60.00 km/h).
* `flow_vph` (Float, veh/hr): Equivalent hourly flow rate (range: 0.0 to 4,502.2 veh/hr).
* `occupancy_pct` (Float, %): Detector time-occupancy percentage (range: 7.0% to 98.0%).
* `travel_time_min` (Float, min): Estimated corridor traversal time.
* `free_flow_time_min` (Float, min): Traversal time under free-flow conditions ($\text{length} / \text{free\_flow\_speed} \times 60$).
* `delay_min` (Float, min): Additional traversal time due to congestion ($\max(0, \text{travel\_time} - \text{free\_flow\_time})$).
* `queue_length_veh` (Float, vehicles): Estimated back-of-queue vehicle count (range: 0.0 to 1,603.3 veh).
* `congestion_index` (Float, 0.0–1.0): Operational congestion severity index ($\text{delay} / \text{travel\_time}$).
* `sensor_quality` (Float, 0.0–1.0): Telemetry reliability indicator (1.0 = optimal reading).

### 3.11 `forecast_targets_train.csv` & `forecast_targets_validation.csv`
Target prediction labels for 4 distinct forward time horizons (15 min, 30 min, 45 min, 60 min).
* `timestamp` (Timestamp): Base observation timestamp.
* `segment_id` (String): Road segment ID.
* `target_speed_15m` / `target_speed_30m` / `target_speed_45m` / `target_speed_60m` (Float, km/h): Forward speed.
* `target_flow_15m` / `target_flow_30m` / `target_flow_45m` / `target_flow_60m` (Float, veh/hr): Forward flow rate.
* `target_congestion_15m` / `target_congestion_30m` / `target_congestion_45m` / `target_congestion_60m` (Float, 0.0–1.0): Forward congestion index.
