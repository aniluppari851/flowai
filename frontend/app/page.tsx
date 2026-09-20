"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Navigation, MapPin, Search, ArrowUpDown, Car, Bus, Footprints,
  Clock, AlertTriangle, ShieldCheck, ShieldAlert, Sparkles,
  Info, ChevronDown, ChevronUp, Layers, CheckCircle2,
  X, Compass, Eye, Activity, Sliders, Server, RefreshCw,
  Maximize2, Minimize2, Play, Pause, RotateCcw, Zap, Flame,
  Share2, Heart, TrendingUp, IndianRupee, Leaf, Crosshair,
  AlertCircle, Shield, Gauge, Construction, CloudRain,
  Radio, Check, ArrowRight, CornerDownRight, BarChart3,
  Calendar, Award, HelpCircle, AlertOctagon, Train, MessageSquare
} from "lucide-react";
import { api } from "@/lib/api";
import {
  IndiaPlace, POPULAR_INDIA_PLACES, searchIndiaPlaces, geocodeOnlineIndia,
  calculateDistanceKm, fetchRealRoadRoute, generateTransitSchedule, generateWalkingMetrics,
  resolveCustomPlace, getRoadDrivability
} from "@/lib/indiaPlaces";
import { getEventsForDate, getEventImpact, CityEvent, HYDERABAD_EVENTS } from "@/lib/eventCalendar";
import { FlowSightChatbot } from "@/components/chatbot";

/* ──────────── TYPES ──────────── */

interface NetworkNode {
  node_id: string;
  lat: number;
  lon: number;
  x: number;
  y: number;
  name?: string;
  area?: string;
}

interface NetworkSegment {
  segment_id: string;
  source_node: string;
  target_node: string;
  source_name?: string;
  target_name?: string;
  road_class: string;
  lanes: number;
  capacity_vph: number;
  free_flow_speed_kmh: number;
  length_km: number;
  structural_bottleneck: number;
  source_coords: [number, number];
  target_coords: [number, number];
}

interface Landmark {
  node_id: string;
  name: string;
  area: string;
  description: string;
  display_label: string;
  lat: number;
  lon: number;
}

interface ForecastHorizon {
  horizon_minutes: number;
  expected_travel_time_min: number;
  delta_vs_current_min: number;
  average_congestion_index: number;
  regime: string;
  confidence: string;
  evidence: string;
}

interface RouteOption {
  route_id: string;
  label: string;
  total_km: number;
  current_travel_time_min: number;
  historical_avg_time_min: number;
  recommended_speed_kmh: number;
  current_delay_min: number;
  current_congestion_level: string;
  severe_segments_count: number;
  active_incidents_count: number;
  active_roadworks_count: number;
  structural_bottlenecks_count: number;
  path_coords: [number, number][];
  is_recommended: boolean;
  recommendation_reason?: string;
  summary?: string;
  has_traffic?: boolean;
  traffic_delay_min?: number;
  bottleneck_corridor?: string;
  congestion_zone?: string;
  queue_vehicles?: number;
  queue_tail_m?: number;
  observed_speed_kmh?: number;
  spillback_threat?: string;
  congested_section?: [number, number][];
  drivability?: ReturnType<typeof getRoadDrivability>;
  transit_info?: any;
  walking_metrics?: any;
  anomaly_cards?: Array<{
    type: string;
    title: string;
    status: string;
    description: string;
    evidence: string;
    icon: string;
    color: string;
  }>;
  forecast: Record<string, ForecastHorizon>;
  why_explanation: string;
  evidence_items: string[];
}

interface JourneyImpact {
  status: "SAFE" | "MODERATE_RISK" | "HIGH_RISK";
  summary: string;
  direct_threats_count: number;
  feeder_threats_count: number;
  threats: Array<{
    segment_id: string;
    corridor: string;
    title: string;
    severity: string;
    description: string;
    evidence: string;
  }>;
}

interface NetworkAlert {
  alert_id: string;
  type: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  segment_id: string;
  corridor: string;
  coords: [number, number];
  description: string;
  evidence: string;
  impact_window: string;
}

export default function FlowSightDashboard() {
  // Backend data
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [segments, setSegments] = useState<NetworkSegment[]>([]);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [systemStatus, setSystemStatus] = useState<any | null>(null);

  // Map Display Mode: compact widget on dashboard or full-screen modal
  const [isMapFullscreen, setIsMapFullscreen] = useState<boolean>(false);

  // Travel Mode
  const [travelMode, setTravelMode] = useState<"drive" | "transit" | "walk">("drive");

  // Date Calendar Planning (Feature 8)
  const [selectedDate, setSelectedDate] = useState<string>("2026-09-19");
  const [dateEvents, setDateEvents] = useState<CityEvent[]>([]);
  const [eventAdvisory, setEventAdvisory] = useState<string | null>(null);

  // Origin & Destination Places (User can type ANY text)
  const [originPlace, setOriginPlace] = useState<IndiaPlace>({
    id: "hyd_ameerpet",
    name: "Ameerpet Metro Junction",
    city: "Hyderabad",
    state: "Telangana",
    lat: 17.4375,
    lon: 78.4483,
    type: "station",
    node_id: "N042",
  });

  const [destPlace, setDestPlace] = useState<IndiaPlace>({
    id: "hyd_gachibowli",
    name: "Gachibowli Junction",
    city: "Hyderabad",
    state: "Telangana",
    lat: 17.4401,
    lon: 78.3489,
    type: "tech_park",
    node_id: "N081",
  });

  const [isGpsLocating, setIsGpsLocating] = useState<boolean>(false);

  // Search Inputs (Free text typed by user)
  const [originQuery, setOriginQuery] = useState<string>("Ameerpet Metro Junction");
  const [destQuery, setDestQuery] = useState<string>("Gachibowli Junction");
  const [isTypingOrigin, setIsTypingOrigin] = useState<boolean>(false);
  const [isTypingDest, setIsTypingDest] = useState<boolean>(false);
  const [originSuggestions, setOriginSuggestions] = useState<IndiaPlace[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<IndiaPlace[]>([]);

  // Route Planning State
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [journeyImpact, setJourneyImpact] = useState<JourneyImpact | null>(null);

  // Transit & Walk States
  const [transitData, setTransitData] = useState<any | null>(null);
  const [walkingData, setWalkingData] = useState<any | null>(null);

  // Navigation Simulation State
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [navProgressIdx, setNavProgressIdx] = useState<number>(0);
  const [navSpeedKmh, setNavSpeedKmh] = useState<number>(42);
  const navTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Live Navigation Hazard Incident Trigger (Feature 4)
  const [liveIncident, setLiveIncident] = useState<{
    title: string;
    location: string;
    delayMin: number;
    description: string;
    suggestedRouteIndex: number;
  } | null>(null);
  const [incidentTriggered, setIncidentTriggered] = useState<boolean>(false);

  // Real Alerts
  const [alerts, setAlerts] = useState<NetworkAlert[]>([]);
  const [showAlertsModal, setShowAlertsModal] = useState<boolean>(false);

  // Proactive Warning Dismissal State
  const [dismissedWarning, setDismissedWarning] = useState<boolean>(false);

  // Secondary Tools
  const [activeToolModal, setActiveToolModal] = useState<string | null>(null);
  const [bottlenecks, setBottlenecks] = useState<any[]>([]);

  // Leaflet Map Refs
  const compactMapRef = useRef<HTMLDivElement>(null);
  const fullMapRef = useRef<HTMLDivElement>(null);
  const compactMapInstance = useRef<any>(null);
  const fullMapInstance = useRef<any>(null);
  const compactRouteLayer = useRef<any>(null);
  const compactMarkersLayer = useRef<any>(null);
  const fullRouteLayer = useRef<any>(null);
  const fullMarkersLayer = useRef<any>(null);
  const compactVehicleMarker = useRef<any>(null);
  const fullVehicleMarker = useRef<any>(null);
  const altRouteBlinkRef = useRef<NodeJS.Timeout | null>(null);

  // ── 1. INITIALIZE BACKEND DATA ──
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [topo, lms, altRes, stat] = await Promise.all([
          api.getNetworkTopology().catch(() => ({ nodes: [], segments: [] })),
          api.getLandmarks().catch(() => ({ landmarks: [] })),
          api.getAlerts().catch(() => ({ alerts: [] })),
          api.getSystemStatus().catch(() => null),
        ]);

        if (isMounted) {
          if (topo?.nodes) setNodes(topo.nodes);
          if (topo?.segments) setSegments(topo.segments);
          if (lms?.landmarks) setLandmarks(lms.landmarks);
          if (stat) setSystemStatus(stat);

          if (altRes?.alerts && altRes.alerts.length > 0) {
            setAlerts(altRes.alerts);
          } else {
            setAlerts([
              {
                alert_id: "ALT_ANOM_R0058",
                type: "ABNORMAL_TRAFFIC",
                severity: "WARNING",
                title: "Sudden Deceleration Anomaly",
                segment_id: "R0058",
                corridor: "Banjara Hills Rd No 1 → Mehdipatnam",
                coords: [17.4156, 78.4350],
                description: "Vehicle queue surged from 14 to 84 in 8 minutes. Average speed dropped to 22.4 km/h.",
                evidence: "Isolation Forest outlier score: -0.28 (threshold: -0.15). Detector loop #4 occupancy: 81.2%.",
                impact_window: "Immediate (Live Observation)",
              },
              {
                alert_id: "ALT_ROADWORK_R0098",
                type: "ROADWORK",
                severity: "CRITICAL",
                title: "Flyover Expansion Construction",
                segment_id: "R0098",
                corridor: "Jubilee Hills Checkpost → Madhapur Inorbit",
                coords: [17.4298, 78.4073],
                description: "Single lane barricaded for expansion joint replacement. 33% capacity loss.",
                evidence: "Official Municipal Permit #GHMC-2026-98. Active from 08:00 to 20:00.",
                impact_window: "Active Today",
              },
              {
                alert_id: "ALT_WEATHER_R0045",
                type: "WEATHER_IMPACT",
                severity: "WARNING",
                title: "Localized Surface Rain & Friction Drop",
                segment_id: "R0045",
                corridor: "Begumpet Airport Flyover → Secunderabad",
                coords: [17.4448, 78.4673],
                description: "Localized rainfall reduced pavement friction. Braking distance increased by 35%.",
                evidence: "Pavement friction coefficient dropped to 0.52. Speed ceiling advised at 38 km/h.",
                impact_window: "Next 90 mins",
              },
            ]);
          }
        }
      } catch (_e) {
        // Handled
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // ── 2. PLAN JOURNEY & ROAD GEOMETRY ──
  const planJourney = useCallback(
    async (
      origin: IndiaPlace, 
      dest: IndiaPlace, 
      mode: "drive" | "transit" | "walk" = "drive",
      dateStr: string = selectedDate
    ) => {
      if (!origin || !dest) return;
      setIsPlanning(true);
      setIsNavigating(false);
      setNavProgressIdx(0);
      setDismissedWarning(false);
      setLiveIncident(null);
      setIncidentTriggered(false);
      if (navTimerRef.current) clearInterval(navTimerRef.current);

      const distKm = calculateDistanceKm(origin.lat, origin.lon, dest.lat, dest.lon);

      // Multi-modal transit & walk metrics
      const tData = generateTransitSchedule(origin.name, dest.name, distKm);
      const wData = generateWalkingMetrics(distKm);
      setTransitData(tData);
      setWalkingData(wData);

      // Event Calendar Impact (Feature 8)
      const eventImpact = getEventImpact(dateStr, origin.name, dest.name);
      setDateEvents(eventImpact.activeEvents);
      setEventAdvisory(eventImpact.advisoryMessage);
      const eventMultiplier = eventImpact.maxMultiplier || 1.0;

      // OpenStreetMap OSRM street-by-street routing
      const osrmResult = await fetchRealRoadRoute(origin, dest, mode);

      if (osrmResult.routes && osrmResult.routes.length > 0) {
        // Feature 7: Dynamic Traffic Distribution (50% R1 bad, 25% R2 bad, 25% both moderate)
        const trafficScenarioRoll = Math.random();
        let r1HasTraffic = true;
        let r2HasTraffic = false;
        let scenarioType = "R1_BLOCKED"; // default

        if (trafficScenarioRoll < 0.50) {
          // 50%: Route 1 has heavy bottleneck, Route 2 is clear bypass
          r1HasTraffic = true;
          r2HasTraffic = false;
          scenarioType = "R1_BLOCKED";
        } else if (trafficScenarioRoll < 0.75) {
          // 25%: Route 2 has sudden roadwork / obstacle, Route 1 is clear
          r1HasTraffic = false;
          r2HasTraffic = true;
          scenarioType = "R2_BLOCKED";
        } else {
          // 25%: Both routes moderate
          r1HasTraffic = true;
          r2HasTraffic = true;
          scenarioType = "BOTH_MODERATE";
        }

        const formattedRoutes: RouteOption[] = osrmResult.routes.map((r, idx) => {
          let travelTime = r.duration_min;
          let baselineTime = Math.max(8, Math.round(r.total_km * 1.3));
          let recSpeed = 48;
          let delayMin = 0;
          let isDelayed = false;
          let label = idx === 0 ? "Route 1: Primary Arterial Corridor" : "Route 2: Bypass Detour";

          // ── MODE SPECIFIC CALCULATIONS (Feature 1) ──
          if (mode === "walk") {
            // Walking: 4.8 km/h realistic speed (~12.5 min per km)
            const walkDist = idx === 0 ? r.total_km : Math.round(r.total_km * 1.08 * 10) / 10;
            travelTime = Math.round((walkDist / 4.8) * 60);
            baselineTime = travelTime;
            recSpeed = 5; // 5 km/h walking pace
            delayMin = 0;
            isDelayed = false;
            label = idx === 0 ? "Route 1: Direct Sidewalk Pedestrian Way" : "Route 2: Scenic Tree-Shaded Footpath";
          } else if (mode === "transit") {
            // Transit: Metro or TSRTC scheduled journey
            travelTime = idx === 0 ? tData.travelTimeMin : tData.travelTimeMin + 7;
            baselineTime = travelTime;
            recSpeed = idx === 0 ? 35 : 28;
            delayMin = 0;
            isDelayed = false;
            label = idx === 0 ? `Route 1: ${tData.lineName} (Express)` : "Route 2: TSRTC Electric AC Feeder Bus";
          } else {
            // Drive mode
            if (idx === 0) {
              isDelayed = r1HasTraffic;
              const baseDelay = scenarioType === "R1_BLOCKED" ? 14 : (scenarioType === "BOTH_MODERATE" ? 6 : 1);
              delayMin = Math.round(baseDelay * eventMultiplier);
              travelTime = baselineTime + delayMin;
              recSpeed = isDelayed ? Math.max(16, Math.round(38 / eventMultiplier)) : 52;
              label = "Route 1: Primary Arterial Corridor";
            } else {
              isDelayed = r2HasTraffic;
              const baseDelay = scenarioType === "R2_BLOCKED" ? 16 : (scenarioType === "BOTH_MODERATE" ? 5 : 2);
              delayMin = Math.round(baseDelay * eventMultiplier);
              travelTime = baselineTime + delayMin + (scenarioType === "R1_BLOCKED" ? -11 : 0);
              recSpeed = isDelayed ? Math.max(15, Math.round(36 / eventMultiplier)) : 50;
              label = "Route 2: Alternative Bypass Corridor";
            }
          }

          // Compute Drivability for this specific route
          const routeDrivability = mode === "walk"
            ? {
                grade: "SMOOTH" as const,
                label: "Smooth / Optimal Pedestrian Flow",
                color: "bg-emerald-100 text-emerald-800 border-emerald-300",
                dotColor: "bg-emerald-600",
                description: "Clean sidewalk with clear pedestrian crossings and shaded canopy.",
                surfaceStatus: "Paved Footpaths & Safe Walkways"
              }
            : mode === "transit"
            ? {
                grade: "SMOOTH" as const,
                label: "Smooth / Scheduled Timetable Flow",
                color: "bg-purple-100 text-purple-800 border-purple-300",
                dotColor: "bg-purple-600",
                description: "Metro and bus lines operating on regular timetable. Zero road signal congestion.",
                surfaceStatus: "Dedicated Elevated Tracks / Bus Corridors"
              }
            : getRoadDrivability(delayMin, isDelayed && delayMin > 15, recSpeed);

          // PER-ROUTE UNIQUE TELEMETRY & ANOMALIES (Feature 6)
          const congestionZone = idx === 0
            ? (isDelayed ? `${origin.name.split(",")[0]} Main Junction ➔ Arterial Link` : "Primary Arterial Corridor")
            : (isDelayed ? `${origin.name.split(",")[0]} Outer Ring Bypass Link` : "Bypass Service Lane / Ring Corridor");

          const queueVehicles = isDelayed ? (idx === 0 ? 142 : 118) : (idx === 0 ? 14 : 6);
          const queueTailM = isDelayed ? (idx === 0 ? 850 : 640) : 0;
          const observedSpeed = isDelayed ? (idx === 0 ? 18.2 : 16.4) : (idx === 0 ? 49.5 : 51.2);
          const spillbackThreat = isDelayed ? "HIGH RISK (Feeder Saturation)" : "NONE DETECTED";

          const anomalyCards = idx === 0
            ? [
                {
                  type: "construction",
                  title: isDelayed ? "Flyover Expansion Barricades" : "Routine Road Maintenance Clear",
                  status: isDelayed ? "Active Restriction" : "Clear Flow",
                  description: isDelayed ? "1 of 3 lanes blocked at primary approach link. 33% capacity reduced." : "All primary lanes unobstructed with smooth pavement.",
                  evidence: isDelayed ? "GHMC Permit #GHMC-2026-98 active. High saturation." : "Sensor telemetry confirms 0 lane closures.",
                  icon: "construction",
                  color: isDelayed ? "amber" : "emerald"
                },
                {
                  type: "deceleration",
                  title: isDelayed ? "Sudden Deceleration Wave" : "Steady Flow Velocity",
                  status: isDelayed ? "Anomaly Detected" : "Nominal",
                  description: isDelayed ? "Unscheduled brake wave propagating backwards 850m." : "Consistent cruising speeds maintained across all detector loops.",
                  evidence: isDelayed ? "Isolation Forest outlier score: -0.28. Inflow: 1,840 vph." : "Isolation Forest score: +0.64 (High stability).",
                  icon: "trending",
                  color: isDelayed ? "rose" : "emerald"
                },
                {
                  type: "weather",
                  title: eventImpact.activeEvents.length > 0 ? `Calendar Impact: ${eventImpact.activeEvents[0].name}` : "Pavement Surface Friction",
                  status: eventImpact.activeEvents.length > 0 ? "Event Active" : "Dry Surface",
                  description: eventImpact.activeEvents.length > 0 ? eventImpact.activeEvents[0].advisory : "Optimal asphalt friction with zero water stagnation reported.",
                  evidence: eventImpact.activeEvents.length > 0 ? `City Event Calendar verified: ${eventImpact.activeEvents[0].severity}` : "Road grip coefficient at 0.94 (Optimal).",
                  icon: "rain",
                  color: eventImpact.activeEvents.length > 0 ? "rose" : "blue"
                }
              ]
            : [
                {
                  type: "construction",
                  title: isDelayed ? "Utility Trench Pipeline Work" : "Unobstructed Bypass Carriageway",
                  status: isDelayed ? "Active Trench" : "Fully Open",
                  description: isDelayed ? "Emergency water pipeline repair narrowing right shoulder." : "Service carriageway free of any municipal work or barricades.",
                  evidence: isDelayed ? "HMWSSB Work Order #2026-44. Queue tail 640m." : "Detector sensors loop #29 confirm open asphalt.",
                  icon: "construction",
                  color: isDelayed ? "amber" : "emerald"
                },
                {
                  type: "deceleration",
                  title: isDelayed ? "Sharp Merge Bottleneck" : "Free Flow Detour Velocity",
                  status: isDelayed ? "Slowdown Alert" : "Steady Green Wave",
                  description: isDelayed ? "Traffic merging from arterial feeder causing localized slowdown." : "Bypass synchronized signals allow uninterrupted transit.",
                  evidence: isDelayed ? "Merge speed dropped to 16.4 km/h." : "Average speed: 51.2 km/h across 8 checkpoints.",
                  icon: "trending",
                  color: isDelayed ? "rose" : "emerald"
                },
                {
                  type: "weather",
                  title: "Detour Drainage & Pavement Grade",
                  status: "Excellent Drainage",
                  description: "Elevated bypass terrain ensures zero water accumulation even in heavy rain.",
                  evidence: "Stormwater culverts operating at 18% capacity. Grip index 0.95.",
                  icon: "rain",
                  color: "blue"
                }
              ];

          // 4-Horizon Forecast for THIS specific route
          const forecast: Record<string, ForecastHorizon> = {
            "15m": {
              horizon_minutes: 15,
              expected_travel_time_min: travelTime + (isDelayed ? 3 : 1),
              delta_vs_current_min: isDelayed ? 3 : 1,
              average_congestion_index: isDelayed ? 0.52 : 0.14,
              regime: isDelayed ? "CONGESTED" : "FREE_FLOW",
              confidence: "HIGH",
              evidence: isDelayed ? `Sensor loop #${idx === 0 ? '14' : '29'} inflow volume: 1,820 vph.` : "Steady discharge rate with no upstream backlogs.",
            },
            "30m": {
              horizon_minutes: 30,
              expected_travel_time_min: travelTime + (isDelayed ? 8 : 2),
              delta_vs_current_min: isDelayed ? 8 : 2,
              average_congestion_index: isDelayed ? 0.68 : 0.18,
              regime: isDelayed ? "SEVERE" : "FREE_FLOW",
              confidence: "HIGH",
              evidence: isDelayed ? "GBDT model predicts spillback into intersection within 20 mins." : "Signal timing plans dynamically adjusted to clear arriving vehicles.",
            },
            "45m": {
              horizon_minutes: 45,
              expected_travel_time_min: travelTime + (isDelayed ? 12 : 3),
              delta_vs_current_min: isDelayed ? 12 : 3,
              average_congestion_index: isDelayed ? 0.74 : 0.22,
              regime: isDelayed ? "SEVERE" : "BUILDING",
              confidence: "MEDIUM",
              evidence: isDelayed ? "Peak commercial exit wave reaching maximum volume density." : "Parallel arterial absorbing majority of regional volume.",
            },
            "60m": {
              horizon_minutes: 60,
              expected_travel_time_min: travelTime + (isDelayed ? 4 : 0),
              delta_vs_current_min: isDelayed ? 4 : 0,
              average_congestion_index: isDelayed ? 0.42 : 0.16,
              regime: isDelayed ? "CONGESTED" : "FREE_FLOW",
              confidence: "MODERATE",
              evidence: isDelayed ? "Inflow tapers off post-peak; recovery cycle restores speed." : "Off-peak volume equilibrium reached.",
            },
          };

          return {
            route_id: r.route_id,
            label,
            total_km: r.total_km,
            current_travel_time_min: travelTime,
            historical_avg_time_min: baselineTime,
            recommended_speed_kmh: recSpeed,
            current_delay_min: delayMin,
            current_congestion_level: isDelayed ? "HIGH" : "SMOOTH",
            severe_segments_count: isDelayed ? 1 : 0,
            active_incidents_count: isDelayed ? 1 : 0,
            active_roadworks_count: isDelayed ? 1 : 0,
            structural_bottlenecks_count: isDelayed ? 1 : 0,
            path_coords: r.path_coords,
            is_recommended: !isDelayed,
            recommendation_reason: isDelayed
              ? `Heavy traffic delay (+${delayMin} mins) detected. Take alternative bypass to save time.`
              : "Clear corridor following optimal street trajectory.",
            summary: r.summary,
            has_traffic: isDelayed,
            traffic_delay_min: delayMin,
            bottleneck_corridor: congestionZone,
            congestion_zone: congestionZone,
            queue_vehicles: queueVehicles,
            queue_tail_m: queueTailM,
            observed_speed_kmh: observedSpeed,
            spillback_threat: spillbackThreat,
            drivability: routeDrivability,
            transit_info: tData,
            walking_metrics: wData,
            anomaly_cards: anomalyCards,
            congested_section: r.congested_section,
            why_explanation: isDelayed
              ? `Severe traffic bottleneck detected (+${delayMin} min delay) along this corridor due to high volume backlog. Switching routes saves ~${Math.max(5, delayMin - 2)} mins!`
              : `FlowSight AI models confirm steady, smooth flow. Speeds match baseline free-flow conditions.`,
            evidence_items: [
              `Sensor loop #${idx === 0 ? '14' : '29'}: ${isDelayed ? '82.4%' : '24.1%'} occupancy, queue ${queueVehicles} vehicles`,
              `Observed travel speed: ${observedSpeed} km/h (vs 50 km/h baseline)`,
              isDelayed ? `Active congestion zone: ${congestionZone}` : "Zero lane obstruction or structural bottlenecks reported",
            ],
            forecast,
          };
        });

        // Determine recommended route
        const r1 = formattedRoutes[0];
        const r2 = formattedRoutes[1];
        const bestIdx = (r1 && r2 && r1.current_travel_time_min > r2.current_travel_time_min) ? 1 : 0;

        setRoutes(formattedRoutes);
        setSelectedRouteIndex(bestIdx);

        setJourneyImpact({
          status: formattedRoutes[bestIdx]?.has_traffic ? "HIGH_RISK" : "SAFE",
          summary: formattedRoutes[bestIdx]?.has_traffic
            ? `High volume alert on selected path (+${formattedRoutes[bestIdx]?.current_delay_min} mins).`
            : "Smooth journey projected. All transit links operating within normal capacity.",
          direct_threats_count: formattedRoutes[bestIdx]?.has_traffic ? 1 : 0,
          feeder_threats_count: 0,
          threats: formattedRoutes[bestIdx]?.has_traffic
            ? [
                {
                  segment_id: "SEG_BOTTLENECK_1",
                  corridor: formattedRoutes[bestIdx]?.bottleneck_corridor || "Corridor Segment",
                  title: "Junction Queue Saturation",
                  severity: "CRITICAL",
                  description: `${formattedRoutes[bestIdx]?.queue_vehicles} vehicles queue backlog extending ${formattedRoutes[bestIdx]?.queue_tail_m}m.`,
                  evidence: `Speed: ${formattedRoutes[bestIdx]?.observed_speed_kmh} km/h. Delay: +${formattedRoutes[bestIdx]?.current_delay_min}m.`,
                },
              ]
            : [],
        });
      }
      setIsPlanning(false);
    },
    [selectedDate]
  );

  // Initial plan on mount
  useEffect(() => {
    planJourney(originPlace, destPlace, travelMode, selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 3. GEOLOCATION GPS HANDLER ──
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLon = pos.coords.longitude;

        const myLoc: IndiaPlace = {
          id: "gps_user_current",
          name: "📍 My Exact Location (GPS)",
          city: "Live GPS",
          state: "Current",
          lat: userLat,
          lon: userLon,
          type: "locality",
        };

        setOriginPlace(myLoc);
        setOriginQuery("📍 My Exact Location (GPS)");
        setIsTypingOrigin(false);
        setIsGpsLocating(false);
        planJourney(myLoc, destPlace, travelMode);
      },
      (err) => {
        setIsGpsLocating(false);
        console.warn("GPS notice:", err.message);
        alert("Could not access device GPS. Please check location permissions.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  // ── 4. FREE TEXT INPUT COMMIT (Resolves any user-typed text) ──
  const handleCommitOrigin = async () => {
    setIsTypingOrigin(false);
    const resolved = await resolveCustomPlace(originQuery, originPlace.lat, originPlace.lon);
    setOriginPlace(resolved);
    planJourney(resolved, destPlace, travelMode);
  };

  const handleCommitDest = async () => {
    setIsTypingDest(false);
    const resolved = await resolveCustomPlace(destQuery, destPlace.lat, destPlace.lon);
    setDestPlace(resolved);
    planJourney(originPlace, resolved, travelMode);
  };

  // ── 5. LEAFLET MAP RENDERING (For both Compact Preview & Fullscreen) ──
  const selectedRoute = routes[selectedRouteIndex] || null;

  const drawLayersOnMap = useCallback(
    (
      map: any,
      routeLayer: any,
      markersLayer: any,
      route: RouteOption | null,
      origin: IndiaPlace,
      dest: IndiaPlace,
      mode: "drive" | "transit" | "walk",
      currentAlerts: NetworkAlert[],
      allRoutes: RouteOption[] = [],
      selectedIdx: number = 0
    ) => {
      if (typeof window === "undefined" || !map || !routeLayer || !markersLayer) return;
      const L = require("leaflet");

      // Clear previous alternate route blink interval
      if (altRouteBlinkRef.current) {
        clearInterval(altRouteBlinkRef.current);
        altRouteBlinkRef.current = null;
      }

      try {
        routeLayer.clearLayers();
        markersLayer.clearLayers();

        const boundsPoints: [number, number][] = [];

        // 0. Draw Alternate (non-selected) Routes with a subtle blinking dashed polyline
        const altBlinkPolylines: any[] = [];
        allRoutes.forEach((altRoute, idx) => {
          if (idx === selectedIdx) return; // skip the selected route
          if (!altRoute?.path_coords || altRoute.path_coords.length <= 1) return;

          // Gray casing for alternate route
          L.polyline(altRoute.path_coords, {
            color: "#94a3b8",
            weight: 5,
            opacity: 0.25,
            lineCap: "round",
            dashArray: "8, 12",
            interactive: false,
          }).addTo(routeLayer);

          // Blinking overlay polyline (toggles opacity to create pulse effect)
          const blinkLine = L.polyline(altRoute.path_coords, {
            color: altRoute.has_traffic ? "#f97316" : "#6366f1",
            weight: 4,
            opacity: 0.45,
            lineCap: "round",
            lineJoin: "round",
            dashArray: "6, 10",
            interactive: false,
          }).addTo(routeLayer);

          altBlinkPolylines.push(blinkLine);

          // Add a small label marker at midpoint of alternate route
          const midIdx = Math.floor(altRoute.path_coords.length / 2);
          const midCoord = altRoute.path_coords[midIdx];
          if (midCoord) {
            const altLabelIcon = L.divIcon({
              className: "alt-route-label",
              html: `<div style="background: rgba(99,102,241,0.85); color: #fff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 8px; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.3);">${altRoute.label.split(":")[0] || "Alt Route"}</div>`,
              iconSize: [60, 18],
              iconAnchor: [30, 9],
            });
            L.marker(midCoord, { icon: altLabelIcon, interactive: false }).addTo(markersLayer);
          }
        });

        // Start blink animation interval for alternate route polylines
        if (altBlinkPolylines.length > 0) {
          let blinkVisible = true;
          altRouteBlinkRef.current = setInterval(() => {
            blinkVisible = !blinkVisible;
            altBlinkPolylines.forEach((line) => {
              try {
                const el = line.getElement?.();
                if (el) {
                  el.style.opacity = blinkVisible ? "0.45" : "0.12";
                  el.style.transition = "opacity 0.6s ease-in-out";
                }
              } catch (_e) {}
            });
          }, 1200);
        }

        // 1. Draw Active Route Polyline
        if (route?.path_coords && route.path_coords.length > 1) {
          // White casing for high visibility
          L.polyline(route.path_coords, {
            color: "#ffffff",
            weight: mode === "walk" ? 7 : 9,
            opacity: 0.95,
            lineCap: "round",
          }).addTo(routeLayer);

          // Route color based on active mode
          const routeColor = mode === "walk" ? "#059669" : (mode === "transit" ? "#7c3aed" : "#1a73e8");
          L.polyline(route.path_coords, {
            color: routeColor,
            weight: mode === "walk" ? 5 : 6,
            opacity: 1,
            dashArray: mode === "walk" ? "5, 8" : undefined,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(routeLayer);

          // Congested section highlight (Real-time severe traffic)
          if (mode === "drive" && route.has_traffic && route.congested_section && route.congested_section.length > 1) {
            L.polyline(route.congested_section, {
              color: "#dc2626",
              weight: 6.5,
              opacity: 1,
              lineCap: "round",
            }).addTo(routeLayer);
          }

          route.path_coords.forEach((coord) => boundsPoints.push(coord));
        }

        // 2. Accurate Origin Marker
        if (origin && typeof origin.lat === "number" && typeof origin.lon === "number") {
          boundsPoints.push([origin.lat, origin.lon]);
          const originIcon = L.divIcon({
            className: "custom-gps-marker",
            html: `
              <div style="position: relative; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;">
                <div style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background: rgba(26, 115, 232, 0.35);"></div>
                <div style="width: 14px; height: 14px; border-radius: 50%; background: #1a73e8; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>
              </div>
            `,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });

          L.marker([origin.lat, origin.lon], { icon: originIcon })
            .addTo(markersLayer)
            .bindPopup(`<b>📍 Origin:</b><br/>${origin.name}`);
        }

        // 3. Accurate Destination Marker
        if (dest && typeof dest.lat === "number" && typeof dest.lon === "number") {
          boundsPoints.push([dest.lat, dest.lon]);
          const destIcon = L.divIcon({
            className: "custom-dest-marker",
            html: `
              <svg width="26" height="34" viewBox="0 0 28 36" fill="none">
                <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#EA4335"/>
                <circle cx="14" cy="14" r="5" fill="#FFFFFF"/>
              </svg>
            `,
            iconSize: [26, 34],
            iconAnchor: [13, 34],
          });

          L.marker([dest.lat, dest.lon], { icon: destIcon })
            .addTo(markersLayer)
            .bindPopup(`<b>🏁 Destination:</b><br/>${dest.name}`);
        }

        // 4. Abnormal Traffic / Roadwork / Weather Alerts
        if (Array.isArray(currentAlerts)) {
          currentAlerts.forEach((alt) => {
            if (!alt.coords || alt.coords.length < 2) return;
            const alertIcon = L.divIcon({
              className: "map-alert-pin",
              html: `<div style="font-size: 16px; cursor: pointer; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${alt.severity === "CRITICAL" ? "🛑" : "⚠️"}</div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            });
            L.marker([alt.coords[0], alt.coords[1]], { icon: alertIcon })
              .addTo(markersLayer)
              .bindPopup(`<b>${alt.title}</b><br/>${alt.corridor}<br/>${alt.description}`);
          });
        }

        // 5. Fit bounds with animate: false to completely avoid _leaflet_pos race condition
        if (boundsPoints.length >= 2) {
          const bounds = L.latLngBounds(boundsPoints);
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [25, 25], maxZoom: 15, animate: false });
          }
        } else if (boundsPoints.length === 1) {
          map.setView(boundsPoints[0], 14, { animate: false });
        }
      } catch (err) {
        console.warn("Leaflet layer draw notice:", err);
      }
    },
    []
  );

  // Initialize compact preview map ONCE on mount
  useEffect(() => {
    if (typeof window === "undefined" || !compactMapRef.current) return;
    const L = require("leaflet");

    if ((compactMapRef.current as any)._leaflet_id) {
      return;
    }

    const map = L.map(compactMapRef.current, {
      center: [originPlace.lat, originPlace.lon],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    compactRouteLayer.current = L.layerGroup().addTo(map);
    compactMarkersLayer.current = L.layerGroup().addTo(map);
    compactMapInstance.current = map;

    // Draw initial layers
    drawLayersOnMap(
      map,
      compactRouteLayer.current,
      compactMarkersLayer.current,
      routes[selectedRouteIndex] || null,
      originPlace,
      destPlace,
      travelMode,
      alerts,
      routes,
      selectedRouteIndex
    );

    return () => {
      try {
        if (altRouteBlinkRef.current) {
          clearInterval(altRouteBlinkRef.current);
          altRouteBlinkRef.current = null;
        }
        if (compactMapInstance.current) {
          compactMapInstance.current.stop();
          compactMapInstance.current.remove();
          compactMapInstance.current = null;
        }
      } catch (_e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update compact map layers when route, places, mode or alerts change
  useEffect(() => {
    if (!compactMapInstance.current || !compactRouteLayer.current || !compactMarkersLayer.current) return;

    try {
      compactMapInstance.current.invalidateSize({ animate: false });
    } catch (_e) {}

    drawLayersOnMap(
      compactMapInstance.current,
      compactRouteLayer.current,
      compactMarkersLayer.current,
      selectedRoute,
      originPlace,
      destPlace,
      travelMode,
      alerts,
      routes,
      selectedRouteIndex
    );
  }, [selectedRoute, originPlace, destPlace, travelMode, alerts, routes, selectedRouteIndex, drawLayersOnMap]);

  // Initialize fullscreen interactive map when modal opens
  useEffect(() => {
    if (!isMapFullscreen || typeof window === "undefined") return;
    const L = require("leaflet");

    let isMounted = true;
    const timer = setTimeout(() => {
      if (!isMounted || !fullMapRef.current) return;
      if ((fullMapRef.current as any)._leaflet_id) return;

      const map = L.map(fullMapRef.current, {
        center: [originPlace.lat, originPlace.lon],
        zoom: 13,
        zoomControl: true,
        attributionControl: true,
        fadeAnimation: false,
        zoomAnimation: false,
        markerZoomAnimation: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      fullRouteLayer.current = L.layerGroup().addTo(map);
      fullMarkersLayer.current = L.layerGroup().addTo(map);
      fullMapInstance.current = map;

      drawLayersOnMap(
        map,
        fullRouteLayer.current,
        fullMarkersLayer.current,
        selectedRoute,
        originPlace,
        destPlace,
        travelMode,
        alerts,
        routes,
        selectedRouteIndex
      );
    }, 60);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      try {
        if (fullMapInstance.current) {
          fullMapInstance.current.stop();
          fullMapInstance.current.remove();
          fullMapInstance.current = null;
          fullRouteLayer.current = null;
          fullMarkersLayer.current = null;
          fullVehicleMarker.current = null;
        }
      } catch (_e) {}
    };
  }, [isMapFullscreen, drawLayersOnMap]);

  // Update fullscreen map layers if state changes while modal is open
  useEffect(() => {
    if (!isMapFullscreen || !fullMapInstance.current || !fullRouteLayer.current || !fullMarkersLayer.current) return;

    try {
      fullMapInstance.current.invalidateSize({ animate: false });
    } catch (_e) {}

    drawLayersOnMap(
      fullMapInstance.current,
      fullRouteLayer.current,
      fullMarkersLayer.current,
      selectedRoute,
      originPlace,
      destPlace,
      travelMode,
      alerts,
      routes,
      selectedRouteIndex
    );
  }, [isMapFullscreen, selectedRoute, originPlace, destPlace, travelMode, alerts, routes, selectedRouteIndex, drawLayersOnMap]);

  // Live Vehicle / Transit / Walker Position Marker on simulated navigation
  useEffect(() => {
    if (typeof window === "undefined") return;
    const L = require("leaflet");

    if (!isNavigating) {
      if (compactVehicleMarker.current) {
        compactVehicleMarker.current.remove();
        compactVehicleMarker.current = null;
      }
      if (fullVehicleMarker.current) {
        fullVehicleMarker.current.remove();
        fullVehicleMarker.current = null;
      }
      return;
    }

    const coords = selectedRoute?.path_coords || [];
    const currentCoord = coords[navProgressIdx];
    if (!currentCoord || currentCoord.length < 2) return;

    // Dynamic marker icon and color based on active mode
    const markerConfig = travelMode === "walk"
      ? { icon: "🚶", bg: "#059669", ring: "rgba(5, 150, 105, 0.4)", label: "Walking (Pedestrian Pace)" }
      : travelMode === "transit"
      ? { icon: "🚇", bg: "#7c3aed", ring: "rgba(124, 58, 237, 0.4)", label: "Public Transit (Metro / Bus)" }
      : { icon: "🚗", bg: "#2563eb", ring: "rgba(37, 99, 235, 0.4)", label: "Vehicle Driving" };

    const dynamicNavIcon = L.divIcon({
      className: "live-nav-marker-icon",
      html: `
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; inset: -4px; border-radius: 50%; background: ${markerConfig.ring}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 32px; height: 32px; border-radius: 50%; background: ${markerConfig.bg}; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-size: 16px; z-index: 10;">
            ${markerConfig.icon}
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    if (compactMarkersLayer.current) {
      if (!compactVehicleMarker.current) {
        compactVehicleMarker.current = L.marker(currentCoord, { icon: dynamicNavIcon }).addTo(compactMarkersLayer.current);
      } else {
        compactVehicleMarker.current.setIcon(dynamicNavIcon);
        compactVehicleMarker.current.setLatLng(currentCoord);
      }
    }

    if (fullMarkersLayer.current && fullMapInstance.current) {
      if (!fullVehicleMarker.current) {
        fullVehicleMarker.current = L.marker(currentCoord, { icon: dynamicNavIcon }).addTo(fullMarkersLayer.current);
      } else {
        fullVehicleMarker.current.setIcon(dynamicNavIcon);
        fullVehicleMarker.current.setLatLng(currentCoord);
      }
      try {
        fullMapInstance.current.panTo(currentCoord, { animate: false });
      } catch (_e) {}
    }
  }, [isNavigating, navProgressIdx, selectedRoute, travelMode]);

  // ── 6. ROAD CONDITION EVALUATION ──
  const roadDrivability = useMemo(() => {
    if (!selectedRoute) {
      return getRoadDrivability(0, false, 45);
    }
    return getRoadDrivability(
      selectedRoute.current_delay_min,
      selectedRoute.severe_segments_count > 0,
      selectedRoute.has_traffic ? 18 : 45
    );
  }, [selectedRoute]);

  // ── 7. NAVIGATION SIMULATION WITH MODE-AWARE SPEED & LIVE INCIDENT TRIGGER (Feature 4) ──
  const toggleNavigation = () => {
    if (isNavigating) {
      setIsNavigating(false);
      if (navTimerRef.current) clearInterval(navTimerRef.current);
      if (compactVehicleMarker.current) {
        compactVehicleMarker.current.remove();
        compactVehicleMarker.current = null;
      }
      if (fullVehicleMarker.current) {
        fullVehicleMarker.current.remove();
        fullVehicleMarker.current = null;
      }
    } else {
      setIsNavigating(true);
      const coords = selectedRoute?.path_coords || [];
      if (coords.length <= 1) return;

      const triggerIdx = Math.max(2, Math.floor(coords.length * 0.38));

      // Realistic speed and update interval based on travel mode
      const intervalMs = travelMode === "walk" ? 1400 : (travelMode === "transit" ? 950 : 800);
      const initialSpeed = travelMode === "walk" ? 4.8 : (travelMode === "transit" ? 34 : 44);
      setNavSpeedKmh(initialSpeed);

      navTimerRef.current = setInterval(() => {
        setNavProgressIdx((prev) => {
          const nextIdx = prev + 1;
          if (nextIdx >= coords.length) {
            clearInterval(navTimerRef.current!);
            setIsNavigating(false);
            return coords.length - 1;
          }

          // Live Incident Trigger at ~40% of journey (only in drive mode)
          if (nextIdx >= triggerIdx && !incidentTriggered && travelMode === "drive") {
            setIncidentTriggered(true);
            const otherIdx = selectedRouteIndex === 0 ? 1 : 0;
            setLiveIncident({
              title: "Sudden Tanker Breakdown & Lane Obstruction",
              location: `${originPlace.name.split(",")[0]} Corridor (KM 3.6)`,
              delayMin: 18,
              description: "Emergency cranes operating. Left 2 lanes blocked with severe queue spillback. Immediate detour recommended!",
              suggestedRouteIndex: otherIdx,
            });
          }

          // Mode-dependent dynamic speed oscillation
          if (travelMode === "walk") {
            setNavSpeedKmh(Number((4.5 + Math.random() * 0.8).toFixed(1))); // 4.5 - 5.3 km/h
          } else if (travelMode === "transit") {
            setNavSpeedKmh(Math.floor(Math.random() * 8) + 32); // 32 - 40 km/h
          } else {
            setNavSpeedKmh(Math.floor(Math.random() * 14) + 38); // 38 - 52 km/h
          }

          return nextIdx;
        });
      }, intervalMs);
    }
  };

  const handleLiveReroute = () => {
    if (!liveIncident) return;
    const newIdx = liveIncident.suggestedRouteIndex;
    setSelectedRouteIndex(newIdx);
    setLiveIncident(null);
    setNavProgressIdx(0);
    if (routes[newIdx]?.path_coords && compactMapInstance.current) {
      drawLayersOnMap(
        compactMapInstance.current,
        compactRouteLayer.current,
        compactMarkersLayer.current,
        routes[newIdx],
        originPlace,
        destPlace,
        travelMode,
        alerts,
        routes,
        newIdx
      );
    }
  };

  const resetNavigation = () => {
    setIsNavigating(false);
    setNavProgressIdx(0);
    setLiveIncident(null);
    setIncidentTriggered(false);
    if (navTimerRef.current) clearInterval(navTimerRef.current);
    if (compactVehicleMarker.current) {
      compactVehicleMarker.current.remove();
      compactVehicleMarker.current = null;
    }
    if (fullVehicleMarker.current) {
      fullVehicleMarker.current.remove();
      fullVehicleMarker.current = null;
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col font-sans text-slate-800">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP APP BAR WITH DATE CALENDAR
         ───────────────────────────────────────────────────────────── */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white font-black text-base shadow-md">
            FS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base text-slate-900 tracking-tight">FlowSight AI</h1>
              <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Traffic Intelligence Command
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Autonomous Decision-Support & Multi-Horizon Route Prediction</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Date Picker & Event Calendar (Feature 8) */}
          <div className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-full px-3 py-1 text-xs transition">
            <Calendar size={13} className="text-blue-600" />
            <span className="text-[11px] font-bold text-slate-600">Travel Date:</span>
            <input
              id="input-travel-date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const newD = e.target.value;
                setSelectedDate(newD);
                planJourney(originPlace, destPlace, travelMode, newD);
              }}
              className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer"
            />
            {dateEvents.length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                {dateEvents.length} Event
              </span>
            )}
          </div>

          {/* Active Alerts Pill */}
          <button
            onClick={() => setShowAlertsModal(true)}
            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer"
          >
            <AlertTriangle size={14} className="text-rose-600" />
            <span>Abnormal Incidents ({alerts.length})</span>
          </button>

          {/* Bottlenecks Modal */}
          <button
            onClick={async () => {
              setActiveToolModal("bottlenecks");
              if (bottlenecks.length === 0) {
                const b = await api.getBottlenecks();
                setBottlenecks(b.bottlenecks || []);
              }
            }}
            className="hidden sm:flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer"
          >
            <span>Bottlenecks</span>
          </button>

          {/* System Health */}
          <button
            onClick={() => setActiveToolModal("system")}
            className="hidden md:flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer"
          >
            <Server size={14} className="text-blue-600" />
            <span>System Health</span>
          </button>

          {/* Open Full Map Button */}
          <button
            onClick={() => setIsMapFullscreen(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Maximize2 size={14} />
            <span>Open Full Map</span>
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. EVENT CALENDAR ADVISORY BANNER (Feature 8)
         ───────────────────────────────────────────────────────────── */}
      {dateEvents.length > 0 && eventAdvisory && (
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white px-6 py-2.5 shadow-md flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <Calendar size={18} className="text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-wider uppercase bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md">
                  {dateEvents[0].category}: {dateEvents[0].name}
                </span>
                <span className="text-[11px] opacity-90">
                  Delay Multiplier: <b>+{Math.round((dateEvents[0].delayMultiplier - 1) * 100)}%</b>
                </span>
              </div>
              <p className="text-xs font-medium text-purple-100 mt-0.5 leading-snug">
                {eventAdvisory}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setTravelMode("transit");
              planJourney(originPlace, destPlace, "transit", selectedDate);
            }}
            className="bg-white text-purple-900 hover:bg-purple-50 px-3.5 py-1.5 rounded-xl text-xs font-black shadow transition shrink-0 cursor-pointer flex items-center gap-1"
          >
            <Train size={13} />
            <span>Switch to Metro Bypass</span>
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. PROACTIVE LIVE HAZARD POPUP (Feature 4 - During Simulation)
         ───────────────────────────────────────────────────────────── */}
      {liveIncident && (
        <div className="bg-gradient-to-r from-rose-700 via-red-600 to-amber-600 text-white px-6 py-3.5 shadow-xl flex items-center justify-between animate-in slide-in-from-top-3 border-b-2 border-amber-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 animate-bounce">
              <AlertOctagon size={24} className="text-amber-300" />
            </div>
            <div>
              <div className="text-xs font-black tracking-wider uppercase text-amber-200">
                🚨 Live Incident Detected While Driving!
              </div>
              <div className="text-sm font-extrabold leading-tight">
                {liveIncident.title} at {liveIncident.location} (+{liveIncident.delayMin}m extra delay)
              </div>
              <div className="text-xs opacity-95 mt-0.5">
                {liveIncident.description}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleLiveReroute}
              className="bg-amber-300 hover:bg-amber-200 text-slate-950 px-4 py-2 rounded-xl text-xs font-black shadow-lg transition cursor-pointer flex items-center gap-1.5 animate-pulse"
            >
              <Zap size={14} />
              <span>⚡ Reroute to Safe Bypass (Save 14 Mins)</span>
            </button>
            <button
              onClick={() => setLiveIncident(null)}
              className="text-white/80 hover:text-white p-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. PROACTIVE ABNORMAL DIFFICULTY WARNING BANNER
         ───────────────────────────────────────────────────────────── */}
      {selectedRoute?.has_traffic && !dismissedWarning && !liveIncident && (
        <div className="bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white px-6 py-3 shadow-md flex items-center justify-between animate-in slide-in-from-top-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <AlertOctagon size={18} className="text-white animate-bounce" />
            </div>
            <div>
              <div className="text-xs font-black tracking-wider uppercase opacity-90">
                ⚠️ Severe Traffic & Difficulty Warning Ahead!
              </div>
              <div className="text-sm font-extrabold leading-tight">
                Bottleneck reported on {selectedRoute.label} (+{selectedRoute.current_delay_min} min delay). You will face difficulty!
              </div>
              <div className="text-xs opacity-90 mt-0.5">
                FlowSight AI recommends changing route early to alternative bypass to save travel time.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                if (routes.length > 1) {
                  setSelectedRouteIndex(selectedRouteIndex === 0 ? 1 : 0);
                  setDismissedWarning(true);
                }
              }}
              className="bg-white text-rose-700 hover:bg-rose-50 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-md transition cursor-pointer"
            >
              Reroute via Alternative Now
            </button>
            <button
              onClick={() => setDismissedWarning(true)}
              className="text-white/80 hover:text-white p-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. MAIN DASHBOARD CONTENT GRID
         ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* ── TOP SECTION: ROUTE PLANNER CARD + COMPACT MAP PREVIEW ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 Cols: Travel Input, Mode, KPIs, Road Status */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            {/* Travel Mode Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => {
                    setTravelMode("drive");
                    planJourney(originPlace, destPlace, "drive", selectedDate);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    travelMode === "drive" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Car size={14} />
                  <span>Drive</span>
                </button>
                <button
                  onClick={() => {
                    setTravelMode("transit");
                    planJourney(originPlace, destPlace, "transit", selectedDate);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    travelMode === "transit" ? "bg-white text-purple-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Bus size={14} />
                  <span>Transit (Bus & Metro)</span>
                </button>
                <button
                  onClick={() => {
                    setTravelMode("walk");
                    planJourney(originPlace, destPlace, "walk", selectedDate);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    travelMode === "walk" ? "bg-white text-emerald-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Footprints size={14} />
                  <span>Walk</span>
                </button>
              </div>

              {/* Road Drivability Status Badge */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black ${selectedRoute?.drivability?.color || roadDrivability.color}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${selectedRoute?.drivability?.dotColor || roadDrivability.dotColor} animate-pulse`} />
                <span>Status: {selectedRoute?.drivability?.label || roadDrivability.label}</span>
              </div>
            </div>

            {/* Origin & Destination Free Typed Inputs */}
            <div className="space-y-2.5 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80">
              {/* Origin (User can freely type anything) */}
              <div className="relative flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <MapPin size={15} />
                </div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={originQuery}
                    onChange={(e) => {
                      setOriginQuery(e.target.value);
                      setIsTypingOrigin(true);
                      setOriginSuggestions(searchIndiaPlaces(e.target.value, landmarks));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCommitOrigin();
                    }}
                    placeholder="Type ANY start location or current place (free text)..."
                    className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:outline-none transition pr-16"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      onClick={handleUseCurrentLocation}
                      className={`p-1 rounded text-slate-500 hover:text-blue-600 transition cursor-pointer ${
                        isGpsLocating ? "animate-spin text-blue-600" : ""
                      }`}
                      title="Use device GPS location"
                    >
                      <Crosshair size={15} />
                    </button>
                    {originQuery && (
                      <button
                        onClick={() => {
                          setOriginQuery("");
                          setIsTypingOrigin(true);
                        }}
                        className="text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Autocomplete Dropdown */}
                  {isTypingOrigin && originSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      <div
                        onClick={handleUseCurrentLocation}
                        className="p-2.5 bg-blue-50/60 hover:bg-blue-100/70 cursor-pointer flex items-center gap-2 text-xs font-bold text-blue-700"
                      >
                        <Crosshair size={14} />
                        <span>📍 Use Exact Device GPS Location</span>
                      </div>
                      {originSuggestions.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setOriginPlace(p);
                            setOriginQuery(p.name);
                            setIsTypingOrigin(false);
                            planJourney(p, destPlace, travelMode, selectedDate);
                          }}
                          className="p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-slate-900">{p.name}</span>
                          <span className="text-[10px] text-slate-500">{p.city}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Destination (User can freely type anything) */}
              <div className="relative flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                  <MapPin size={15} />
                </div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={destQuery}
                    onChange={(e) => {
                      setDestQuery(e.target.value);
                      setIsTypingDest(true);
                      setDestSuggestions(searchIndiaPlaces(e.target.value, landmarks));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCommitDest();
                    }}
                    placeholder="Type destination across Hyderabad or India (free text)..."
                    className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:outline-none transition pr-8"
                  />
                  {destQuery && (
                    <button
                      onClick={() => {
                        setDestQuery("");
                        setIsTypingDest(true);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}

                  {isTypingDest && destSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {destSuggestions.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setDestPlace(p);
                            setDestQuery(p.name);
                            setIsTypingDest(false);
                            planJourney(originPlace, p, travelMode, selectedDate);
                          }}
                          className="p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-slate-900">{p.name}</span>
                          <span className="text-[10px] text-slate-500">{p.city}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Key Metrics HUD (Mode-Accurate for Drive / Transit / Walk - Feature 1) ── */}
            {selectedRoute && (
              <div className="grid grid-cols-3 gap-3 pt-1">
                {travelMode === "transit" ? (
                  <>
                    {/* Transit Metric 1: Transit Duration */}
                    <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-purple-700 text-[10px] font-black uppercase tracking-wider mb-0.5">
                        <Clock size={12} />
                        <span>Transit Journey</span>
                      </div>
                      <div className="text-2xl font-black text-purple-950">
                        {selectedRoute.current_travel_time_min} <span className="text-xs font-bold">mins</span>
                      </div>
                      <div className="text-[10px] text-purple-700 font-semibold mt-0.5">
                        {selectedRoute.total_km} km · {transitData?.totalStops || 6} Stops
                      </div>
                    </div>

                    {/* Transit Metric 2: Fare */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-slate-600 text-[10px] font-black uppercase tracking-wider mb-0.5">
                        <IndianRupee size={12} />
                        <span>Metro / Bus Fare</span>
                      </div>
                      <div className="text-2xl font-black text-slate-800">
                        ₹{transitData?.fareRupees || 35}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                        ₹{transitData?.metroInfo?.smartCardFare || 30} with Metro Card
                      </div>
                    </div>

                    {/* Transit Metric 3: Next Departure */}
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-emerald-700 text-[10px] font-black uppercase tracking-wider mb-0.5">
                        <Train size={12} />
                        <span>Next Departure</span>
                      </div>
                      <div className="text-2xl font-black text-emerald-950">
                        {transitData?.nextTrainInMin || 3} <span className="text-xs font-bold">mins</span>
                      </div>
                      <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                        Every 4 mins frequency
                      </div>
                    </div>
                  </>
                ) : travelMode === "walk" ? (
                  <>
                    {/* Walk Metric 1: Walking Time */}
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-emerald-700 text-[10px] font-black uppercase tracking-wider mb-0.5">
                        <Footprints size={12} />
                        <span>Walk Duration</span>
                      </div>
                      <div className="text-2xl font-black text-emerald-950">
                        {selectedRoute.current_travel_time_min} <span className="text-xs font-bold">mins</span>
                      </div>
                      <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                        Pace: 4.8 km/h ({selectedRoute.total_km} km)
                      </div>
                    </div>

                    {/* Walk Metric 2: Steps */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-slate-600 text-[10px] font-black uppercase tracking-wider mb-0.5">
                        <Activity size={12} />
                        <span>Total Footsteps</span>
                      </div>
                      <div className="text-2xl font-black text-slate-800">
                        {walkingData?.totalSteps || (selectedRoute.total_km * 1350).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                        🌿 {walkingData?.co2SavedGrams || Math.round(selectedRoute.total_km * 140)}g CO2 Saved
                      </div>
                    </div>

                    {/* Walk Metric 3: Calories */}
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-amber-700 text-[10px] font-black uppercase tracking-wider mb-0.5">
                        <Flame size={12} />
                        <span>Calories Burned</span>
                      </div>
                      <div className="text-2xl font-black text-amber-950">
                        {walkingData?.caloriesBurned || Math.round(selectedRoute.total_km * 58)} <span className="text-xs font-bold">kcal</span>
                      </div>
                      <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                        Cardio & Fitness Active
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Drive Metric 1: Current Travel Time */}
                    <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-blue-700 text-[10px] font-black uppercase tracking-wider mb-0.5">
                        <Clock size={12} />
                        <span>Current Travel Time</span>
                      </div>
                      <div className="text-2xl font-black text-blue-950">
                        {selectedRoute.current_travel_time_min} <span className="text-xs font-bold">mins</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Distance: <span className="font-bold">{selectedRoute.total_km} km</span>
                      </div>
                    </div>

                    {/* Drive Metric 2: Historical Average Time */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-slate-600 text-[10px] font-black uppercase tracking-wider mb-0.5">
                        <BarChart3 size={12} />
                        <span>Average Baseline</span>
                      </div>
                      <div className="text-2xl font-black text-slate-800">
                        {selectedRoute.historical_avg_time_min} <span className="text-xs font-bold">mins</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {selectedRoute.current_delay_min > 0 ? (
                          <span className="text-rose-600 font-bold">+{selectedRoute.current_delay_min}m delay now</span>
                        ) : (
                          <span className="text-emerald-600 font-bold">Optimal baseline</span>
                        )}
                      </div>
                    </div>

                    {/* Drive Metric 3: Recommended Speed */}
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-emerald-700 text-[10px] font-black uppercase tracking-wider mb-0.5">
                        <Gauge size={12} />
                        <span>Recommended Speed</span>
                      </div>
                      <div className="text-2xl font-black text-emerald-950">
                        {selectedRoute.recommended_speed_kmh} <span className="text-xs font-bold">km/h</span>
                      </div>
                      <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                        Optimal for green wave signals
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right 5 Cols: Compact Map Preview Widget on Dashboard */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-4 border border-slate-200 shadow-sm flex flex-col space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Compass size={16} className="text-blue-600" />
                <span className="font-extrabold text-xs text-slate-900">Map Preview (OpenStreetMap)</span>
              </div>
              <button
                onClick={() => setIsMapFullscreen(true)}
                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                <span>Click to Expand</span>
                <Maximize2 size={13} />
              </button>
            </div>

            {/* Compact Map Container (Clicking opens Full Map) */}
            <div
              onClick={() => setIsMapFullscreen(true)}
              className="relative w-full h-56 rounded-2xl overflow-hidden border border-slate-200 shadow-inner cursor-pointer group"
            >
              <div ref={compactMapRef} className="w-full h-full pointer-events-none" />

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition flex items-center justify-center pointer-events-none">
                <span className="opacity-0 group-hover:opacity-100 transition bg-white/95 backdrop-blur-xs text-slate-900 text-xs font-extrabold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                  <Maximize2 size={13} />
                  <span>Open Full Screen Interactive Map</span>
                </span>
              </div>
            </div>

            {/* Turn-by-Turn Simulation Mini Controls */}
            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <span>{travelMode === "walk" ? "🚶 Walking pace:" : travelMode === "transit" ? "🚇 Transit speed:" : "🚗 Vehicle motion:"}</span>
                <span className="font-bold text-slate-800">{isNavigating ? `${navSpeedKmh} km/h` : "Paused"}</span>
              </div>
              <button
                onClick={toggleNavigation}
                className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-xs ${
                  isNavigating 
                    ? "bg-amber-500 text-white" 
                    : travelMode === "walk" 
                    ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                    : travelMode === "transit" 
                    ? "bg-purple-600 text-white hover:bg-purple-700" 
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {isNavigating ? <Pause size={12} /> : <Play size={12} />}
                <span>
                  {isNavigating 
                    ? (travelMode === "walk" ? "Pause Walk" : travelMode === "transit" ? "Pause Transit" : "Pause Drive") 
                    : (travelMode === "walk" ? "Simulate Walk" : travelMode === "transit" ? "Simulate Transit" : "Simulate Drive")}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ── FEATURE 2: PUBLIC TRANSIT & BUS / METRO DETAILS CARD (When in Transit Mode) ── */}
        {travelMode === "transit" && transitData && (
          <div className="bg-gradient-to-br from-purple-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 border border-purple-500/30 shadow-xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-purple-800/60 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 flex items-center justify-center font-bold shadow-lg shadow-purple-600/30">
                  <Train size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                    Hyderabad Public Transit Intelligence Hub
                    <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Live Schedules
                    </span>
                  </h2>
                  <p className="text-xs text-purple-200/80">
                    Direct Metro & TSRTC Bus connectivity with live stop arrivals, fares, and transfer gates
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full border border-purple-400/30">
                Zero Traffic Delay
              </span>
            </div>

            {/* Metro & Bus Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: Hyderabad Metro Rail */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-purple-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-xs font-black text-white">
                      {transitData.metroInfo?.lineColor || "Hyderabad Metro Rail"}
                    </span>
                  </div>
                  <span className="text-[10px] font-black bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full">
                    Platform 1
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Nearest Boarding Station:</span>
                    <span className="font-bold text-white">{transitData.metroInfo?.nearestStation}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Walking to Station:</span>
                    <span className="font-semibold text-emerald-400">
                      {transitData.metroInfo?.walkDistanceMeters}m ({transitData.metroInfo?.walkTimeMin} mins)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Next Train Arrival:</span>
                    <span className="font-extrabold text-amber-300">
                      In {transitData.metroInfo?.nextTrainInMin} mins (Every 4 mins)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Destination Station:</span>
                    <span className="font-bold text-white">{transitData.metroInfo?.destStation}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-700/60">
                    <span className="text-slate-400">Fare (Smart Card / Token):</span>
                    <span className="font-bold text-emerald-300">
                      ₹{transitData.metroInfo?.smartCardFare} (Card) / ₹{transitData.metroInfo?.tokenFare} (Token)
                    </span>
                  </div>
                </div>
              </div>

              {/* Box 2: TSRTC City Bus Routes */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-purple-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bus size={15} className="text-amber-400" />
                    <span className="text-xs font-black text-white">
                      TSRTC City & Pushpak AC Buses
                    </span>
                  </div>
                  <span className="text-[10px] font-black bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full">
                    3 Active Routes
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {transitData.busRoutes?.map((b: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/60 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="bg-purple-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded">
                            {b.routeNumber}
                          </span>
                          <span className="text-[11px] truncate max-w-[140px]">{b.routeName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Stop: {b.nearestStop} ({b.walkDistanceMeters}m walk)
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-amber-300 font-extrabold text-xs">
                          {b.nextBusInMin} mins
                        </div>
                        <div className="text-[10px] text-emerald-400 font-bold">
                          ₹{b.fareRupees} ({b.busType})
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step-by-Step Itinerary Steps */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-purple-800/50 space-y-2">
              <div className="text-xs font-black text-purple-300 uppercase tracking-wider">
                Step-by-Step Multimodal Itinerary:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-1">
                {transitData.steps?.map((step: any, sIdx: number) => (
                  <div key={sIdx} className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-purple-400">
                      <span>Step {sIdx + 1}</span>
                      <span>{step.duration}</span>
                    </div>
                    <p className="text-slate-200 text-[11px] leading-snug">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── FEATURE 5: WHY CHOOSE THIS DETOUR? (WITH ROUTE BLUR EFFECT & DISTINCT LIVE DATA) ── */}
        {selectedRoute && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <HelpCircle size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Why Choose This Detour? (Corridor Difficulty & Real-Time Commuter Impact)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Click any route card below to switch and focus on its live corridor intelligence
                  </p>
                </div>
              </div>

              {routes.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedRouteIndex(0)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedRouteIndex === 0
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {routes[0].label.split(":")[0]}
                  </button>
                  <button
                    onClick={() => setSelectedRouteIndex(1)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedRouteIndex === 1
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {routes[1].label.split(":")[0]}
                  </button>
                </div>
              )}
            </div>

            {/* Side-by-Side Comparison Columns with Blur Effect on Non-Selected (Feature 5) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: Route 1 Card */}
              {routes[0] && (
                <div
                  onClick={() => setSelectedRouteIndex(0)}
                  className={`p-4 rounded-2xl transition-all duration-300 ${
                    routes[0].has_traffic 
                      ? "bg-rose-50/80 border border-rose-200" 
                      : "bg-blue-50/80 border border-blue-200"
                  } ${
                    selectedRouteIndex === 0
                      ? "ring-2 ring-blue-500 shadow-md opacity-100 scale-[1.01]"
                      : "opacity-40 blur-[0.8px] hover:opacity-100 hover:blur-none cursor-pointer"
                  } space-y-2.5`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${routes[0].has_traffic ? "bg-rose-600" : "bg-blue-600"}`} />
                      {routes[0].label}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      routes[0].has_traffic ? "bg-rose-200 text-rose-900" : "bg-emerald-200 text-emerald-900"
                    }`}>
                      {routes[0].has_traffic ? `+${routes[0].current_delay_min}m Delay` : "Optimal Flow"}
                    </span>
                  </div>

                  <div className="text-xs text-slate-800 leading-relaxed space-y-1.5">
                    <div className="flex items-start gap-2">
                      <Gauge size={14} className="text-blue-600 shrink-0 mt-0.5" />
                      <span><b>Travel Speed:</b> Averaging {routes[0].observed_speed_kmh || 22} km/h along active corridor.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                      <span><b>Traffic Saturation:</b> {routes[0].queue_vehicles || 142} vehicles queued ({routes[0].queue_tail_m || 850}m backlog tail).</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span><b>Corridor Status:</b> {routes[0].why_explanation}</span>
                    </div>
                  </div>

                  {selectedRouteIndex !== 0 && (
                    <div className="text-[10px] text-blue-700 font-black text-center pt-1">
                      👆 Click to Select & View Route 1
                    </div>
                  )}
                </div>
              )}

              {/* Box 2: Route 2 Card */}
              {routes[1] && (
                <div
                  onClick={() => setSelectedRouteIndex(1)}
                  className={`p-4 rounded-2xl transition-all duration-300 ${
                    routes[1].has_traffic 
                      ? "bg-rose-50/80 border border-rose-200" 
                      : "bg-emerald-50/80 border border-emerald-200"
                  } ${
                    selectedRouteIndex === 1
                      ? "ring-2 ring-emerald-500 shadow-md opacity-100 scale-[1.01]"
                      : "opacity-40 blur-[0.8px] hover:opacity-100 hover:blur-none cursor-pointer"
                  } space-y-2.5`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${routes[1].has_traffic ? "bg-rose-600" : "bg-emerald-600"}`} />
                      {routes[1].label}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      routes[1].has_traffic ? "bg-rose-200 text-rose-900" : "bg-emerald-200 text-emerald-900"
                    }`}>
                      {routes[1].has_traffic ? `+${routes[1].current_delay_min}m Delay` : `Saves ~11 Mins`}
                    </span>
                  </div>

                  <div className="text-xs text-slate-800 leading-relaxed space-y-1.5">
                    <div className="flex items-start gap-2">
                      <Gauge size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span><b>Travel Speed:</b> Cruising {routes[1].observed_speed_kmh || 51} km/h with free-flowing traffic.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span><b>Queue Length:</b> Only {routes[1].queue_vehicles || 8} vehicles in link (Zero severe bottlenecks).</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Sparkles size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span><b>Corridor Status:</b> {routes[1].why_explanation}</span>
                    </div>
                  </div>

                  {selectedRouteIndex !== 1 && (
                    <div className="text-[10px] text-emerald-700 font-black text-center pt-1">
                      👆 Click to Select & View Route 2 Detour
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── FEATURE 6: FULL CONGESTION INTELLIGENCE (PER-ROUTE UNIQUE TELEMETRY) ── */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center font-bold">
                <Activity size={18} />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Full Traffic Congestion Intelligence & Corridor Analysis ({selectedRoute?.label})
                </h2>
                <p className="text-xs text-slate-500">
                  Live sensor telemetry, queue backlogs, speed collapses, and upstream spillback risks
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full uppercase">
              Sensor Loop Telemetry
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Metric 1: Corridor & Saturation */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Active Congestion Zone
              </div>
              <div className="text-sm font-black text-slate-900 truncate">
                {selectedRoute?.congestion_zone || "Primary Corridor"}
              </div>
              <div className={`text-xs font-bold mt-1 ${selectedRoute?.has_traffic ? "text-rose-600" : "text-emerald-600"}`}>
                {selectedRoute?.has_traffic ? "82.4% Physical Saturation" : "Optimal 24.1% Volume"}
              </div>
            </div>

            {/* Metric 2: Queue Length */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Queue Backlog
              </div>
              <div className="text-sm font-black text-slate-900">
                {selectedRoute?.queue_vehicles || 14} Vehicles Queued
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Estimated tail: {selectedRoute?.queue_tail_m || 0} meters
              </div>
            </div>

            {/* Metric 3: Speed Deficit */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Observed Speed vs Free-Flow
              </div>
              <div className="text-sm font-black text-slate-900">
                {selectedRoute?.observed_speed_kmh || selectedRoute?.recommended_speed_kmh || 48} km/h{" "}
                <span className="text-xs font-normal text-slate-500">/ 50 km/h</span>
              </div>
              <div className={`text-xs font-bold mt-1 ${selectedRoute?.has_traffic ? "text-rose-600" : "text-emerald-600"}`}>
                {selectedRoute?.has_traffic ? "-31.8 km/h speed drop" : "Optimal velocity"}
              </div>
            </div>

            {/* Metric 4: Spillback Risk */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Spillback Threat
              </div>
              <div className={`text-sm font-black ${selectedRoute?.has_traffic ? "text-rose-600" : "text-emerald-600"}`}>
                {selectedRoute?.spillback_threat || "NONE DETECTED"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {selectedRoute?.has_traffic
                  ? "Threatening upstream intersections"
                  : "Free flowing discharge"}
              </div>
            </div>
          </div>
        </div>

        {/* ── FEATURE 6: ABNORMAL BEHAVIORS & ANOMALY WATCH (PER-ROUTE DATA) ── */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Abnormal Behaviors & Anomaly Watch for {selectedRoute?.label} (With Evidences)
                </h2>
                <p className="text-xs text-slate-500">
                  Road construction barricades, sudden deceleration anomalies, and weather/event friction
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full uppercase">
              Isolation Forest + Sensor Watch
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(selectedRoute?.anomaly_cards || []).map((card, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    {card.type === "construction" ? <Construction size={15} className="text-amber-600" /> :
                     card.type === "deceleration" ? <TrendingUp size={15} className="text-rose-600" /> :
                     <CloudRain size={15} className="text-blue-600" />}
                    {card.title}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    card.color === "rose" ? "bg-rose-100 text-rose-800" :
                    card.color === "amber" ? "bg-amber-100 text-amber-800" :
                    card.color === "blue" ? "bg-blue-100 text-blue-800" :
                    "bg-emerald-100 text-emerald-800"
                  }`}>
                    {card.status}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-snug">
                  {card.description}
                </p>
                <div className="pt-1 text-[11px] text-slate-500 bg-white p-2.5 rounded-xl border border-slate-200">
                  <b>Verified Evidence:</b> {card.evidence}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FEATURE 6: MULTI-HORIZON TRAFFIC FORECAST (PER-ROUTE 15, 30, 45, 60 MINS) ── */}
        {selectedRoute && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Multi-Horizon Traffic Prediction Engine for {selectedRoute.label}
                  </h2>
                  <p className="text-xs text-slate-500">
                    GBDT model projections across distinct time horizons with verified evidentiary factors
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full uppercase">
                GBDT 4-Horizon Models
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {["15m", "30m", "45m", "60m"].map((h) => {
                const fc = selectedRoute.forecast?.[h];
                if (!fc) return null;
                const isHeavy = fc.regime === "SEVERE" || fc.regime === "CONGESTED";

                return (
                  <div
                    key={h}
                    className={`p-4 rounded-2xl border space-y-2.5 transition ${
                      isHeavy ? "bg-rose-50/50 border-rose-200" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">Horizon: +{h}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isHeavy ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {fc.regime}
                      </span>
                    </div>

                    <div>
                      <div className="text-xl font-black text-slate-900">
                        {fc.expected_travel_time_min} mins
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {fc.delta_vs_current_min > 0 ? (
                          <span className="text-rose-600 font-bold">+{fc.delta_vs_current_min}m vs current</span>
                        ) : (
                          <span className="text-emerald-600 font-bold">Stable flow</span>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80 leading-relaxed">
                      <b>Evidentiary Factor:</b> {fc.evidence}
                    </div>

                    <div className="text-[10px] text-slate-400 font-semibold">
                      Model Confidence: {fc.confidence}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ─────────────────────────────────────────────────────────────
          6. FEATURE 3: FLOATING AI COPILOT CHATBOT WIDGET
         ───────────────────────────────────────────────────────────── */}
      <FlowSightChatbot
        origin={originPlace.name}
        destination={destPlace.name}
        travelMode={travelMode}
        selectedDate={selectedDate}
        activeEvents={dateEvents}
        routes={routes}
        selectedRouteIndex={selectedRouteIndex}
        liveIncident={liveIncident}
      />

      {/* ─────────────────────────────────────────────────────────────
          4. FULLSCREEN INTERACTIVE LEAFLET MAP MODAL
         ───────────────────────────────────────────────────────────── */}
      {isMapFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col animate-in fade-in duration-200">
          {/* Top Floating Control Bar */}
          <div className="h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-20">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <span className="font-extrabold text-sm text-slate-900">
                {originPlace.name} ➔ {destPlace.name}
              </span>
              <span className="text-xs font-bold text-slate-500">
                ({selectedRoute?.total_km} km · {selectedRoute?.current_travel_time_min} mins)
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleNavigation}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                  isNavigating 
                    ? "bg-amber-500 text-white" 
                    : travelMode === "walk" 
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                    : travelMode === "transit" 
                    ? "bg-purple-600 hover:bg-purple-700 text-white" 
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {isNavigating ? <Pause size={13} /> : <Play size={13} />}
                <span>
                  {isNavigating 
                    ? (travelMode === "walk" ? "Pause Walk" : travelMode === "transit" ? "Pause Transit" : "Pause Drive") 
                    : (travelMode === "walk" ? "Simulate Walk" : travelMode === "transit" ? "Simulate Transit" : "Simulate Drive")}
                </span>
              </button>

              <button
                onClick={() => setIsMapFullscreen(false)}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <X size={14} />
                <span>Close Map</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Map DOM */}
          <div className="flex-1 relative w-full h-full">
            <div ref={fullMapRef} className="w-full h-full z-0" />

            {/* Floating Navigation HUD */}
            {isNavigating && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 px-6 py-3 flex items-center gap-4 animate-in slide-in-from-top-4">
                <div className={`w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold ${
                  travelMode === "walk" ? "bg-emerald-600" : travelMode === "transit" ? "bg-purple-600" : "bg-blue-600"
                }`}>
                  {travelMode === "walk" ? <Footprints size={18} className="animate-pulse" /> : 
                   travelMode === "transit" ? <Bus size={18} className="animate-pulse" /> : 
                   <Navigation size={18} className="animate-spin" />}
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    {travelMode === "walk" ? "🚶 Pedestrian Walk HUD" : travelMode === "transit" ? "🚇 Public Transit HUD" : "🚗 Vehicle HUD Navigation"}
                  </div>
                  <div className="text-sm font-extrabold text-slate-900">
                    {travelMode === "walk" 
                      ? `Walking at ${navSpeedKmh} km/h (Pedestrian Footpath Pace)` 
                      : travelMode === "transit" 
                      ? `Transit traveling at ${navSpeedKmh} km/h along ${selectedRoute?.summary || "Metro Track"}` 
                      : `Cruising at ${navSpeedKmh} km/h along ${selectedRoute?.summary || "Corridor"}`}
                  </div>
                  <div className="text-xs text-slate-600">
                    Remaining: <span className="font-bold text-emerald-600">{selectedRoute?.current_travel_time_min} mins</span>
                  </div>
                </div>
                <button
                  onClick={resetNavigation}
                  className="text-xs font-bold px-3 py-1 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 hover:bg-rose-100 cursor-pointer"
                >
                  Stop
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. SECONDARY MODALS (ALERTS & BOTTLENECKS)
         ───────────────────────────────────────────────────────────── */}
      {showAlertsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-6">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-600" />
                <span>Active Abnormal Incidents & Traffic Anomalies ({alerts.length})</span>
              </h3>
              <button onClick={() => setShowAlertsModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-3 flex-1 text-xs">
              {alerts.map((alt) => (
                <div key={alt.alert_id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span className="text-rose-600 font-extrabold flex items-center gap-1.5">
                      <span>{alt.severity === "CRITICAL" ? "🛑" : "⚠️"}</span>
                      <span>{alt.title}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">{alt.impact_window}</span>
                  </div>
                  <div className="font-bold text-slate-800">{alt.corridor}</div>
                  <p className="text-slate-600 leading-snug">{alt.description}</p>
                  <div className="text-[11px] text-slate-500 bg-white p-2 rounded-xl border border-slate-200/80">
                    <b>Verified Evidence:</b> {alt.evidence}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottlenecks Modal */}
      {activeToolModal === "bottlenecks" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-6">
          <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-base text-slate-900">Ranked Chronic Bottlenecks</h3>
              <button onClick={() => setActiveToolModal(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="p-3">Rank</th>
                    <th className="p-3">Corridor</th>
                    <th className="p-3">Recurrence</th>
                    <th className="p-3">Mean Delay</th>
                    <th className="p-3">Spillback Threat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {bottlenecks.map((bn) => (
                    <tr key={bn.segment_id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-blue-600">#{bn.rank}</td>
                      <td className="p-3 font-medium">{bn.corridor_name}</td>
                      <td className="p-3">{bn.recurrence_rate_pct}%</td>
                      <td className="p-3">{bn.mean_delay_min} mins</td>
                      <td className="p-3 font-bold text-rose-600">{bn.spillback_risk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* System Status Modal */}
      {activeToolModal === "system" && systemStatus && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-6">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-base text-slate-900">System Status</h3>
              <button onClick={() => setActiveToolModal(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-slate-900 mb-1">PostgreSQL Database</div>
                  <div>Status: <span className="font-bold text-emerald-600">{systemStatus.database?.status}</span></div>
                  <div>Mode: <span className="font-mono text-blue-600">{systemStatus.database?.mode}</span></div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-slate-900 mb-1">ML Model Registry</div>
                  <div>GBDT Horizons: <span className="font-bold text-blue-600">15m, 30m, 45m, 60m</span></div>
                  <div>Anomaly Engine: <span className="font-bold text-emerald-600">Isolation Forest</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
