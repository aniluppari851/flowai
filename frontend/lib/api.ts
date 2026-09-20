const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function fetchAPI(endpoint: string, options?: RequestInit) {
  const timeoutMs = 60_000; // 60 second timeout for deep ML predictions

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    console.debug(`[FlowSight API] ${endpoint} info:`, err?.message || err);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}


export const api = {
  getNetworkTopology: () => fetchAPI("/api/network/topology"),
  getLandmarks: () => fetchAPI("/api/nodes/landmarks"),
  planRoute: (origin: string, destination: string, timestamp?: string) =>
    fetchAPI("/api/route/plan", {
      method: "POST",
      body: JSON.stringify({ origin_node: origin, destination_node: destination, timestamp }),
    }),
  getAlerts: (timestamp?: string) =>
    fetchAPI(`/api/alerts${timestamp ? `?timestamp=${encodeURIComponent(timestamp)}` : ""}`),
  getCurrentTraffic: () => fetchAPI("/api/traffic/current"),
  getTrafficSnapshot: (ts: string) => fetchAPI(`/api/traffic/snapshot?timestamp=${encodeURIComponent(ts)}`),
  getReplayTimestamps: () => fetchAPI("/api/traffic/replay"),
  getSegmentDetails: (id: string) => fetchAPI(`/api/segments/${id}`),
  getForecast: (id: string) => fetchAPI(`/api/forecast/${id}`),
  getAnomalies: (ts?: string) => fetchAPI(`/api/anomalies${ts ? `?timestamp=${encodeURIComponent(ts)}` : ""}`),
  getSpillback: (id: string) => fetchAPI(`/api/spillback/${id}`),
  simulateDiversion: (segmentId: string, flow: number, pct: number) =>
    fetchAPI("/api/simulation/diversion", {
      method: "POST",
      body: JSON.stringify({ segment_id: segmentId, baseline_flow_vph: flow, diversion_pct: pct }),
    }),
  simulateInfrastructure: (candidateId: string, flow?: number) =>
    fetchAPI("/api/simulation/infrastructure", {
      method: "POST",
      body: JSON.stringify({ candidate_id: candidateId, baseline_flow_vph: flow }),
    }),
  getBottlenecks: () => fetchAPI("/api/bottlenecks"),
  getPlanningCandidates: () => fetchAPI("/api/planning/candidates"),
  getModels: () => fetchAPI("/api/models"),
  getDataQuality: () => fetchAPI("/api/data-quality"),
  getSystemStatus: () => fetchAPI("/api/system/status"),
  getWorkflows: () => fetchAPI("/api/workflows"),
  triggerWorkflow: (workflowKey: string) =>
    fetchAPI(`/api/workflows/trigger/${workflowKey}`, {
      method: "POST",
    }),
  sendChatMessage: (message: string, sender: string = "web-dashboard", channel: string = "web") =>
    fetchAPI("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message, sender, channel }),
    }),
};
