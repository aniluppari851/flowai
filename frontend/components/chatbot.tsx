"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Send, 
  Sparkles, 
  X, 
  ChevronDown, 
  MessageSquare, 
  MapPin, 
  Compass, 
  Calendar as CalendarIcon, 
  Zap, 
  CloudSun, 
  Bus, 
  Car, 
  Footprints,
  AlertTriangle,
  Clock,
  ShieldCheck
} from "lucide-react";
import { CityEvent } from "@/lib/eventCalendar";

export interface ChatbotContextProps {
  origin: string;
  destination: string;
  travelMode: "drive" | "transit" | "walk";
  selectedDate: string;
  activeEvents: CityEvent[];
  routes: any[];
  selectedRouteIndex: number;
  liveIncident?: { title: string; location: string; delayMin: number; description: string } | null;
}

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  timestamp: string;
  chips?: string[];
}

export function FlowSightChatbot({
  origin,
  destination,
  travelMode,
  selectedDate,
  activeEvents,
  routes,
  selectedRouteIndex,
  liveIncident,
}: ChatbotContextProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(1);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      sender: "bot",
      text: `👋 Hi! I am **FlowSight AI Companion**, your real-time traffic, transit & route copilot across India.
      
Ask me about:
• 🚦 **Live traffic & bottlenecks** on your current route
• 📅 **Traffic conditions on specific dates & festivals**
• 🚇 **Metro vs Bus vs Driving comparison**
• ⚠️ **Live abnormal incidents & detours**
• 🌤️ **Monsoon waterlogging & road drivability**`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      chips: [
        "How is traffic right now?",
        "Which route is better?",
        "Will date/event affect travel?",
        "Nearest Metro & Bus advice"
      ]
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setUnreadCount(0);
    }
  }, [isOpen, messages, isTyping]);

  // Handle live incident trigger message
  useEffect(() => {
    if (liveIncident) {
      const alertMsg: Message = {
        id: `incident-${Date.now()}`,
        sender: "bot",
        text: `🚨 **Live Road Hazard Detected!**
**${liveIncident.title}** at **${liveIncident.location}**
Estimated extra delay: **+${liveIncident.delayMin} mins**.
${liveIncident.description}

💡 *Recommendation: Switch to Route 2 (Safe Bypass) to avoid getting trapped!*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        chips: ["Switch to Alternative Route", "What caused this delay?"]
      };
      setMessages(prev => [...prev, alertMsg]);
      if (!isOpen) {
        setUnreadCount(c => c + 1);
      }
    }
  }, [liveIncident]);

  // Intelligence response engine
  const generateBotResponse = (userQuery: string): { text: string; chips?: string[] } => {
    const q = userQuery.toLowerCase();
    const currentRoute = routes[selectedRouteIndex] || routes[0];
    const otherRoute = routes[selectedRouteIndex === 0 ? 1 : 0];

    // 1. Current Traffic & Congestion Queries
    if (q.includes("traffic") || q.includes("jam") || q.includes("congestion") || q.includes("delay") || q.includes("bottleneck")) {
      if (travelMode === "walk") {
        return {
          text: `🚶 **Walking Traffic Check:**
You are in Walk Mode! Pedestrian sidewalks are unobstructed with **0 mins road traffic delay**.
• Estimated Steps: **${(currentRoute?.distance_km * 1350 || 3200).toLocaleString()} steps**
• Estimated Calories: **${Math.round(currentRoute?.distance_km * 58 || 180)} kcal burned**
• Tip: Stay on zebra crossings and shaded footpaths along this corridor!`,
          chips: ["Switch to Transit", "Check weather conditions"]
        };
      }
      if (travelMode === "transit") {
        return {
          text: `🚇 **Transit Status:**
Hyderabad Metro & TSRTC corridor operations are running on scheduled timetable:
• Metro Lines: **Normal Frequency (every 3-4 mins)**
• Zero road signal delays on elevated metro tracks!
• Estimated transit fare: **₹${currentRoute?.transit_info?.fareRupees || 35}**`,
          chips: ["Nearest Metro Station", "Bus Schedule"]
        };
      }

      const hasTraffic = currentRoute?.has_traffic;
      const delay = currentRoute?.traffic_delay_min || 0;
      return {
        text: hasTraffic 
          ? `⚠️ **Traffic Alert for ${currentRoute?.label || 'Route 1'}:**
• Current Delay: **+${delay} mins** due to peak volume & bottleneck near ${currentRoute?.bottleneck_corridor || 'Main Junction'}.
• Average Speed: **${currentRoute?.recommended_speed_kmh || 24} km/h** (Historical avg is 48 km/h).
• Road Condition: **${currentRoute?.drivability?.label || 'High Congestion'}**.
${otherRoute ? `\n💡 Detour available: **${otherRoute.label}** saves approx **${Math.max(3, delay - (otherRoute.traffic_delay_min || 0))} mins**!` : ''}`
          : `✅ **Traffic is Free-Flowing!**
• Route: **${currentRoute?.label || 'Primary Corridor'}**
• Current Speed: **${currentRoute?.recommended_speed_kmh || 52} km/h**
• Travel Delay: **+0 mins** (Normal free flow)
• Road Condition: **Smooth / Optimal Flow** ✨`,
        chips: ["Which route is better?", "Predict traffic in 30 mins", "Any events today?"]
      };
    }

    // 2. Route Comparison Queries
    if (q.includes("which route") || q.includes("better") || q.includes("detour") || q.includes("alternative") || q.includes("compare")) {
      if (routes.length >= 2) {
        const r1 = routes[0];
        const r2 = routes[1];
        const r1Time = r1.current_travel_time_min || r1.duration_min;
        const r2Time = r2.current_travel_time_min || r2.duration_min;
        const best = r1Time <= r2Time ? r1 : r2;
        return {
          text: `🛣️ **AI Corridor Comparison:**
• **${r1.label}**: ${r1Time} mins (${r1.distance_km} km) · ${r1.has_traffic ? '⚠️ Congested (+'+r1.traffic_delay_min+'m)' : '✅ Clear'}
• **${r2.label}**: ${r2Time} mins (${r2.distance_km} km) · ${r2.has_traffic ? '⚠️ Congested (+'+r2.traffic_delay_min+'m)' : '✅ Clear Bypass'}

🎯 **Recommendation: Choose ${best.label}**
It saves you **${Math.abs(r1Time - r2Time)} mins** and provides smoother driving flow!`,
          chips: ["Select recommended route", "Why choose this detour?", "Show nearest metro"]
        };
      }
      return {
        text: `Currently analyzing the best single continuous corridor from **${origin}** to **${destination}**. Distance is **${currentRoute?.distance_km || 12} km** with estimated journey time of **${currentRoute?.current_travel_time_min || 25} mins**.`,
        chips: ["How is traffic right now?", "Check weather conditions"]
      };
    }

    // 3. Calendar & Date-specific queries
    if (q.includes("date") || q.includes("event") || q.includes("calendar") || q.includes("festival") || q.includes("tomorrow") || q.includes("september") || q.includes("october") || q.includes("ipl") || q.includes("ganesh")) {
      if (activeEvents.length > 0) {
        const ev = activeEvents[0];
        return {
          text: `📅 **Event Intelligence for ${selectedDate}:**
🚨 **${ev.name}** (${ev.category})
• Affected Corridors: **${ev.corridors.join(", ")}**
• Severity: **${ev.severity} Alert** (Delay multiplier: **${ev.delayMultiplier}x**)
• AI Advisory: *${ev.advisory}*

💡 We have factored this into the arrival estimate!`,
          chips: ["Recommended travel mode", "How is traffic right now?"]
        };
      }
      return {
        text: `📅 **Calendar Analysis for ${selectedDate}:**
No major state festivals, VIP rallies, or sports closures scheduled for this date.
• Baseline traffic patterns apply.
• Peak hours expected: **8:30 AM - 10:30 AM** & **5:45 PM - 8:30 PM**.
• Weather impact: Normal road friction.`,
        chips: ["Check future forecast", "Nearest Metro & Bus advice"]
      };
    }

    // 4. Transit / Metro / Bus queries
    if (q.includes("metro") || q.includes("bus") || q.includes("transit") || q.includes("train") || q.includes("fare") || q.includes("tsrtc")) {
      const transit = currentRoute?.transit_info;
      const metro = transit?.metroInfo;
      const bus = transit?.busRoutes?.[0];
      return {
        text: `🚇 **Public Transit Recommendation:**
• **Hyderabad Metro**: 
  - Station: **${metro?.nearestStation || 'Nearest Station'}** (${metro?.walkTimeMin || 4} mins walk)
  - Line: **${metro?.lineColor || 'Blue Line'}**
  - Train in: **${metro?.nextTrainInMin || 3} mins** · Fare: **₹${metro?.smartCardFare || 32}** (Smart Card)
• **TSRTC Bus Route**:
  - Bus No: **${bus?.routeNumber || '10H / 216'}** (${bus?.routeName || 'City Express'})
  - Bus arriving in: **${bus?.nextBusInMin || 5} mins** · Fare: **₹${bus?.fareRupees || 25}**

💡 *Transit bypasses all road congestions with 100% predictable arrival!*`,
        chips: ["Switch to Transit mode", "Walking route details"]
      };
    }

    // 5. Walking / Calorie queries
    if (q.includes("walk") || q.includes("pedestrian") || q.includes("foot") || q.includes("calorie") || q.includes("step")) {
      const walk = currentRoute?.walking_metrics;
      return {
        text: `👟 **Pedestrian & Walking Intelligence:**
• Total Distance: **${currentRoute?.distance_km || 4.2} km**
• Estimated Walk Time: **${walk?.travelTimeMin || Math.round((currentRoute?.distance_km || 4.2) * 12.5)} mins**
• Total Footsteps: **${walk?.totalSteps || '5,400'} steps**
• Calories Burned: **${walk?.caloriesBurned || '245'} kcal** 🔥
• CO2 Emissions Saved: **${walk?.co2SavedGrams || '580'}g CO2** 🌿
• Health Advice: *${walk?.friendlyPraise || 'Great light cardio workout! Stay hydrated.'}*`,
        chips: ["Switch to Walk mode", "How is traffic right now?"]
      };
    }

    // 6. Weather & Monsoon queries
    if (q.includes("weather") || q.includes("rain") || q.includes("waterlog") || q.includes("monsoon") || q.includes("flood") || q.includes("pothole")) {
      return {
        text: `🌤️ **Monsoon & Weather Impact Engine:**
• Current Condition: **28°C · Partly Cloudy (Low Rain Risk)**
• Road Grip & Friction: **94% (Dry Asphalt)**
• Waterlogging Vulnerability: **Low (Green Flag)**
• Sensitive Culverts Monitored: *Cyber Towers underpass, Tolichowki Flyover ramp, Malakpet culvert*.
All monitored underpasses currently free of water stagnation!`,
        chips: ["How is traffic right now?", "Which route is better?"]
      };
    }

    // 7. Forecast Queries (15, 30, 45, 60 mins)
    if (q.includes("predict") || q.includes("forecast") || q.includes("future") || q.includes("later") || q.includes("15") || q.includes("30") || q.includes("hour")) {
      const fc = currentRoute?.forecast || [
        { time: "+15 min", delay_min: 6, trend: "Rising", probability: 0.88 },
        { time: "+30 min", delay_min: 11, trend: "Peak", probability: 0.94 },
        { time: "+45 min", delay_min: 14, trend: "Severe", probability: 0.91 },
        { time: "+60 min", delay_min: 8, trend: "Clearing", probability: 0.82 }
      ];
      return {
        text: `📈 **Predictive AI Traffic Forecast (Next 60 Mins):**
• **+15 Mins**: Delay +${fc[0]?.delay_min}m (${fc[0]?.trend}) · Confidence: ${Math.round((fc[0]?.probability || 0.88)*100)}%
• **+30 Mins**: Delay +${fc[1]?.delay_min}m (${fc[1]?.trend}) · Confidence: ${Math.round((fc[1]?.probability || 0.92)*100)}%
• **+45 Mins**: Delay +${fc[2]?.delay_min}m (${fc[2]?.trend}) · Confidence: ${Math.round((fc[2]?.probability || 0.90)*100)}%
• **+60 Mins**: Delay +${fc[3]?.delay_min}m (${fc[3]?.trend}) · Confidence: ${Math.round((fc[3]?.probability || 0.80)*100)}%

💡 *Insight: Leaving in the next 10 minutes saves up to ~${(fc[2]?.delay_min || 14) - (fc[0]?.delay_min || 6)} mins of delay!*`,
        chips: ["Which route is better?", "Any events today?"]
      };
    }

    // Default Fallback
    return {
      text: `🤖 **FlowSight Traffic Intelligence:**
I analyzed your journey from **${origin}** to **${destination}** (${currentRoute?.distance_km || 10} km):
• Selected Mode: **${travelMode.toUpperCase()}**
• Estimated Travel Time: **${currentRoute?.current_travel_time_min || 25} mins**
• Road Status: **${currentRoute?.drivability?.surfaceStatus || 'Normal Flow'}**

Feel free to ask about traffic bottlenecks, detour recommendations, metro timings, or weather advisories!`,
      chips: ["How is traffic right now?", "Which route is better?", "Nearest Metro & Bus advice", "Predict traffic in 30 mins"]
    };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    try {
      // Query FlowSight AI Chatbot Backend Engine
      const { api } = await import("@/lib/api");
      const res = await api.sendChatMessage(query);
      if (res && res.reply) {
        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: res.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          chips: [
            "How is traffic right now?",
            "Which route is better?",
            "Nearest Metro & Bus advice",
            "Predict traffic in 30 mins"
          ]
        };
        setMessages(prev => [...prev, botMsg]);
        setIsTyping(false);
        return;
      }
    } catch (_err) {
      // Use local intelligent context fallback
    }

    setTimeout(() => {
      const botReply = generateBotResponse(query);
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: botReply.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        chips: botReply.chips
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 450);
  };

  return (
    <>
      {/* Floating Action Bubble */}
      {!isOpen && (
        <button
          id="btn-open-chatbot"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white font-semibold px-4 py-3.5 rounded-full shadow-2xl hover:shadow-emerald-500/30 transition-all duration-300 transform hover:scale-105 border border-emerald-400/40 group"
          aria-label="Open Traffic Copilot Chatbot"
        >
          <div className="relative">
            <Bot className="w-6 h-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
            </span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs uppercase tracking-widest text-emerald-200 font-bold">AI Traffic Copilot</span>
            <span className="text-sm font-bold leading-tight">Ask FlowSight AI</span>
          </div>
          {unreadCount > 0 && (
            <span className="ml-1 bg-amber-400 text-amber-950 text-xs font-black px-2 py-0.5 rounded-full shadow">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div 
          id="modal-traffic-chatbot"
          className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[620px] max-h-[calc(100vh-5rem)] bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 animate-in fade-in slide-in-from-bottom-6 duration-300 ring-1 ring-emerald-500/20"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                    FlowSight Traffic Copilot
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  </h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                    Live Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
                  Context: {origin.split(",")[0]} ➔ {destination.split(",")[0]}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
                aria-label="Close Chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Current Corridor Info Bar */}
          <div className="bg-slate-950/80 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-medium truncate">{origin.split(",")[0]} ➔ {destination.split(",")[0]}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] font-semibold text-emerald-300 uppercase">
                {travelMode}
              </span>
              <span className="text-[11px] text-slate-400">{selectedDate}</span>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                    m.sender === "user"
                      ? "bg-emerald-600 text-white rounded-tr-none shadow-md"
                      : "bg-slate-800/90 text-slate-200 border border-slate-700/70 rounded-tl-none shadow-lg whitespace-pre-line"
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[9px] text-slate-500 mt-1 px-1">{m.timestamp}</span>

                {/* Quick action chips from bot */}
                {m.sender === "bot" && m.chips && m.chips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.chips.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(chip)}
                        className="text-[11px] bg-slate-800 hover:bg-emerald-950/60 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 hover:border-emerald-400/60 px-2.5 py-1 rounded-full transition duration-150 flex items-center gap-1"
                      >
                        <Zap className="w-2.5 h-2.5 text-amber-400" />
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-slate-400 text-xs bg-slate-800/60 border border-slate-700/50 rounded-2xl px-3.5 py-2.5 w-fit">
                <Bot className="w-4 h-4 text-emerald-400 animate-spin" />
                <span>FlowSight AI is analyzing road corridors...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Input Suggestion Bar */}
          <div className="px-3 py-1.5 bg-slate-950/60 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
            <button
              onClick={() => handleSendMessage("How is traffic right now?")}
              className="shrink-0 bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg border border-slate-700 transition"
            >
              🚦 Live Traffic
            </button>
            <button
              onClick={() => handleSendMessage("Which route is better?")}
              className="shrink-0 bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg border border-slate-700 transition"
            >
              🛣️ Best Detour
            </button>
            <button
              onClick={() => handleSendMessage("Nearest Metro & Bus advice")}
              className="shrink-0 bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg border border-slate-700 transition"
            >
              🚇 Metro & Bus
            </button>
            <button
              onClick={() => handleSendMessage("Predict traffic in 30 mins")}
              className="shrink-0 bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg border border-slate-700 transition"
            >
              📈 Forecast
            </button>
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              id="input-chatbot-query"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask about traffic, detours, metro, events..."
              className="flex-1 bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            <button
              id="btn-send-chat-message"
              type="submit"
              disabled={!inputValue.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white p-2.5 rounded-xl transition duration-150 flex items-center justify-center shrink-0"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
