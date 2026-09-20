"""
FlowSight AI — Network Graph & Simulation Engine
Represents Hyderabad urban road network (120 nodes, 436 directed segments).
Implements:
- Directed network topology & turn restrictions
- BPR (Bureau of Public Roads) travel time latency curves
- K-shortest alternative route search respecting turn prohibitions
- Queue spillback propagation & upstream bottleneck tracing
- Tactical diversion simulation (0%, 10%, 20%, 30%) with secondary overload safeguards
- Infrastructure what-if scenario counterfactual evaluation (planning candidates)
"""

import os
import csv
import math
import heapq
from collections import defaultdict, deque

PROJECT_ROOT = r"c:\Users\Naveen Uppari\OneDrive\Desktop\neurax3.O"
DATASETS_DIR = os.path.join(PROJECT_ROOT, "Datasets")


class RoadSegment:
    def __init__(self, data):
        self.segment_id = data["segment_id"]
        self.source_node = data["source_node"]
        self.target_node = data["target_node"]
        self.road_class = data.get("road_class", "collector")
        self.lanes = int(data.get("lanes", 2))
        self.free_flow_speed_kmh = float(data.get("free_flow_speed_kmh", 50.0))
        self.capacity_vph = float(data.get("capacity_vph", 1800.0))
        self.length_km = float(data.get("length_km", 1.0))
        self.grade_pct = float(data.get("grade_pct", 0.0))
        self.signal_id = data.get("signal_id", "")
        self.structural_bottleneck = int(data.get("structural_bottleneck", 0))
        self.importance = float(data.get("importance", 0.5))
        self.peak_capacity_factor = float(data.get("peak_capacity_factor", 1.0))

        # Physical attributes
        self.free_flow_time_min = (self.length_km / max(1.0, self.free_flow_speed_kmh)) * 60.0
        # Storage capacity assuming standard 8 meters (125 veh/km/lane)
        self.max_storage_veh = self.length_km * self.lanes * 125.0

    def compute_bpr_travel_time(self, volume_vph, alpha=0.15, beta=4.0):
        effective_capacity = self.capacity_vph * self.peak_capacity_factor
        vc_ratio = max(0.0, volume_vph) / max(100.0, effective_capacity)
        return self.free_flow_time_min * (1.0 + alpha * (vc_ratio ** beta))

    def compute_delay(self, current_travel_time_min):
        return max(0.0, current_travel_time_min - self.free_flow_time_min)


class NetworkEngine:
    def __init__(self, data_dir=DATASETS_DIR):
        self.data_dir = data_dir
        self.nodes = {}
        self.segments = {}
        self.adj = defaultdict(list)          # node -> list of (target_node, segment_id)
        self.incoming = defaultdict(list)     # node -> list of (source_node, segment_id)
        self.turn_restrictions = set()        # set of (node_id, from_seg, to_seg)
        self.signals = {}
        self.planning_candidates = {}
        self.structural_bottlenecks = []

        self._load_network()

    def _load_network(self):
        # 1. Load Nodes
        nodes_file = os.path.join(self.data_dir, "nodes.csv")
        with open(nodes_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                self.nodes[r["node_id"]] = {
                    "node_id": r["node_id"],
                    "x": float(r["x"]),
                    "y": float(r["y"]),
                    "lat": float(r["lat"]),
                    "lon": float(r["lon"])
                }

        # 2. Load Segments
        net_file = os.path.join(self.data_dir, "network.csv")
        with open(net_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                seg = RoadSegment(r)
                self.segments[seg.segment_id] = seg
                self.adj[seg.source_node].append((seg.target_node, seg.segment_id))
                self.incoming[seg.target_node].append((seg.source_node, seg.segment_id))
                if seg.structural_bottleneck == 1:
                    self.structural_bottlenecks.append(seg.segment_id)

        # 3. Load Turn Restrictions
        turn_file = os.path.join(self.data_dir, "turn_restrictions.csv")
        if os.path.exists(turn_file):
            with open(turn_file, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    self.turn_restrictions.add((r["node_id"], r["from_segment"], r["to_segment"]))

        # 4. Load Signals
        sig_file = os.path.join(self.data_dir, "signal_plans.csv")
        if os.path.exists(sig_file):
            with open(sig_file, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    self.signals[r["signal_id"]] = r

        # 5. Load Planning Candidates
        plan_file = os.path.join(self.data_dir, "planning_candidates.csv")
        if os.path.exists(plan_file):
            with open(plan_file, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    self.planning_candidates[r["candidate_id"]] = r

    def find_alternative_routes(self, origin_node, destination_node, avoid_segment_id=None, k=3):
        """
        K-shortest loopless paths between origin and destination,
        avoiding avoid_segment_id and respecting turn restrictions.
        """
        paths = []
        pq = [(0.0, [origin_node], [])]  # (cost, node_path, seg_path)
        visited_paths = set()

        while pq and len(paths) < k:
            cost, node_path, seg_path = heapq.heappop(pq)
            curr = node_path[-1]

            if curr == destination_node and len(seg_path) > 0:
                paths.append({
                    "nodes": list(node_path),
                    "segments": list(seg_path),
                    "estimated_time_min": round(cost, 2),
                    "length_km": round(sum(self.segments[s].length_km for s in seg_path), 2)
                })
                continue

            last_seg = seg_path[-1] if seg_path else None

            for next_node, seg_id in self.adj[curr]:
                if seg_id == avoid_segment_id:
                    continue
                if next_node in node_path:  # avoid cycles
                    continue
                if last_seg and (curr, last_seg, seg_id) in self.turn_restrictions:
                    continue  # turn restriction violated

                seg = self.segments[seg_id]
                edge_cost = seg.free_flow_time_min
                new_cost = cost + edge_cost
                new_path = tuple(node_path + [next_node])

                if new_path not in visited_paths:
                    visited_paths.add(new_path)
                    heapq.heappush(pq, (new_cost, node_path + [next_node], seg_path + [seg_id]))

        return paths

    def check_spillback(self, segment_id, current_queue_veh, current_occupancy_pct):
        """
        Evaluates queue spillback risk and returns upstream affected segments.
        """
        if segment_id not in self.segments:
            return None

        seg = self.segments[segment_id]
        storage_ratio = current_queue_veh / max(1.0, seg.max_storage_veh)
        is_spillback = storage_ratio >= 0.70 or current_occupancy_pct >= 75.0

        upstream_links = []
        source_node = seg.source_node
        for up_node, up_seg_id in self.incoming[source_node]:
            up_seg = self.segments[up_seg_id]
            upstream_links.append({
                "segment_id": up_seg_id,
                "source_node": up_node,
                "road_class": up_seg.road_class,
                "lanes": up_seg.lanes,
                "risk": "HIGH" if is_spillback else "LOW"
            })

        return {
            "target_segment": segment_id,
            "queue_length_veh": round(current_queue_veh, 1),
            "max_storage_veh": round(seg.max_storage_veh, 1),
            "storage_saturation_pct": round(storage_ratio * 100, 1),
            "is_spillback_active": is_spillback,
            "severity": "CRITICAL" if storage_ratio >= 0.85 else ("WARNING" if is_spillback else "NORMAL"),
            "upstream_feeder_segments": upstream_links
        }

    def simulate_diversion(self, segment_id, baseline_flow_vph, diversion_pct=0.20):
        """
        Simulates tactical diversion (10%, 20%, 30%) away from a congested corridor.
        Calculates corridor and bypass delay before vs after, and checks secondary capacity.
        """
        if segment_id not in self.segments:
            return {"error": f"Segment {segment_id} not found."}

        target_seg = self.segments[segment_id]
        origin = target_seg.source_node
        dest = target_seg.target_node

        alt_routes = self.find_alternative_routes(origin, dest, avoid_segment_id=segment_id, k=2)
        if not alt_routes:
            return {
                "error": "No viable alternative topological route found respecting turn restrictions.",
                "segment_id": segment_id
            }

        # Baseline conditions
        baseline_tt = target_seg.compute_bpr_travel_time(baseline_flow_vph)
        baseline_delay = target_seg.compute_delay(baseline_tt)

        # Diverted flows
        diverted_flow = baseline_flow_vph * diversion_pct
        remaining_flow = baseline_flow_vph - diverted_flow

        # Post-diversion corridor condition
        scenario_tt = target_seg.compute_bpr_travel_time(remaining_flow)
        scenario_delay = target_seg.compute_delay(scenario_tt)

        # Allocate diverted flow across alternate routes
        alt_route = alt_routes[0]
        secondary_warnings = []
        bypass_tts = []

        flow_per_route = diverted_flow / len(alt_routes)
        for r in alt_routes:
            route_tt = 0.0
            for s_id in r["segments"]:
                s = self.segments[s_id]
                # Check baseline capacity + added diverted flow
                added_load = s.capacity_vph * 0.5 + flow_per_route
                seg_tt = s.compute_bpr_travel_time(added_load)
                route_tt += seg_tt
                if added_load > s.capacity_vph:
                    secondary_warnings.append({
                        "segment_id": s_id,
                        "road_class": s.road_class,
                        "vc_ratio": round(added_load / s.capacity_vph, 2),
                        "warning": "Secondary link approaching saturation."
                    })
            bypass_tts.append(route_tt)

        time_saved_min = baseline_tt - scenario_tt
        delay_reduction_pct = ((baseline_delay - scenario_delay) / max(0.01, baseline_delay)) * 100.0 if baseline_delay > 0 else 0.0

        return {
            "target_segment": segment_id,
            "diversion_percentage": int(diversion_pct * 100),
            "baseline_corridor": {
                "flow_vph": round(baseline_flow_vph, 1),
                "travel_time_min": round(baseline_tt, 2),
                "delay_min": round(baseline_delay, 2)
            },
            "simulated_scenario": {
                "flow_vph": round(remaining_flow, 1),
                "travel_time_min": round(scenario_tt, 2),
                "delay_min": round(scenario_delay, 2)
            },
            "impact_summary": {
                "corridor_time_saved_min": round(time_saved_min, 2),
                "corridor_delay_reduction_pct": round(delay_reduction_pct, 1),
                "recommended": len(secondary_warnings) == 0,
                "advisory_note": "Favorable diversion; primary delay drops with safe bypass capacity." if len(secondary_warnings) == 0 else "CAUTION: Rerouting induces localized congestion on secondary arterial."
            },
            "bypass_routes": alt_routes,
            "secondary_overload_warnings": secondary_warnings
        }

    def simulate_infrastructure_what_if(self, candidate_id, baseline_flow_vph=None):
        """
        Simulates counterfactual infrastructure intervention from planning_candidates.csv.
        """
        if candidate_id not in self.planning_candidates:
            return {"error": f"Candidate {candidate_id} not found."}

        cand = self.planning_candidates[candidate_id]
        target_seg_id = cand["target_segment"]
        if target_seg_id not in self.segments:
            return {"error": f"Target segment {target_seg_id} not found."}

        seg = self.segments[target_seg_id]
        flow = baseline_flow_vph or (seg.capacity_vph * 0.90)  # default peak flow
        cap_delta = float(cand.get("capacity_delta_vph", 500.0))

        # Baseline
        base_tt = seg.compute_bpr_travel_time(flow)
        base_delay = seg.compute_delay(base_tt)

        # Scenario: Modified capacity
        new_capacity = seg.capacity_vph + cap_delta
        # Temp override
        old_cap = seg.capacity_vph
        seg.capacity_vph = new_capacity
        scen_tt = seg.compute_bpr_travel_time(flow)
        scen_delay = seg.compute_delay(scen_tt)
        seg.capacity_vph = old_cap  # restore

        delay_delta = base_delay - scen_delay
        delay_drop_pct = (delay_delta / max(0.01, base_delay)) * 100.0

        return {
            "candidate_id": candidate_id,
            "target_segment": target_seg_id,
            "intervention_type": cand.get("intervention_type"),
            "capacity_delta_vph": cap_delta,
            "cost_index": int(cand.get("cost_index", 10)),
            "feasibility_band": cand.get("feasibility_band", "medium"),
            "baseline": {
                "capacity_vph": old_cap,
                "flow_vph": round(flow, 1),
                "travel_time_min": round(base_tt, 2),
                "delay_min": round(base_delay, 2)
            },
            "scenario": {
                "capacity_vph": new_capacity,
                "flow_vph": round(flow, 1),
                "travel_time_min": round(scen_tt, 2),
                "delay_min": round(scen_delay, 2)
            },
            "evaluated_impact": {
                "travel_time_reduction_min": round(base_tt - scen_tt, 2),
                "delay_reduction_pct": round(delay_drop_pct, 1),
                "cost_effectiveness_ratio": round((delay_drop_pct / max(1, int(cand.get("cost_index", 1)))), 2),
                "recommendation_rank": "HIGH PRIORITY" if delay_drop_pct > 25 and cand.get("feasibility_band") in ["high", "medium"] else "MODERATE"
            }
        }
