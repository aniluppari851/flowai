// eventCalendar.ts - Curated Database of Hyderabad & Indian Major Events affecting Traffic

export interface CityEvent {
  id: string;
  name: string;
  dateStart: string; // YYYY-MM-DD
  dateEnd: string;   // YYYY-MM-DD
  corridors: string[]; // e.g. ["Hitech City", "Gachibowli", "Tank Bund", "Old City", "Necklace Road", "Secunderabad", "Uppal", "Madhapur"]
  category: "Festival" | "Sports" | "VVIP / Rally" | "Exhibition / Tech" | "Weather / Monsoon";
  severity: "High" | "Severe" | "Moderate";
  delayMultiplier: number; // e.g. 1.8 = 80% extra travel time
  recommendedMode: "Drive" | "Transit" | "Metro";
  description: string;
  advisory: string;
}

export const HYDERABAD_EVENTS: CityEvent[] = [
  {
    id: "ganesh-immersion",
    name: "Ganesh Visarjan (Immersion Day)",
    dateStart: "2026-09-24",
    dateEnd: "2026-09-25",
    corridors: ["Tank Bund", "Necklace Road", "Khairatabad", "Basheerbagh", "Moazzam Jahi Market", "MJ Market", "Charminar", "Abids"],
    category: "Festival",
    severity: "Severe",
    delayMultiplier: 2.8,
    recommendedMode: "Metro",
    description: "Massive religious procession converging on Hussain Sagar lake with over 50,000 idols.",
    advisory: "Tank Bund & Necklace Road closed for private vehicles. Use Hyderabad Metro Red/Blue line strictly."
  },
  {
    id: "ipl-match-uppal",
    name: "IPL 2026 Night Match at Rajiv Gandhi Stadium",
    dateStart: "2026-09-21",
    dateEnd: "2026-09-21",
    corridors: ["Uppal", "Tarnaka", "Habsiguda", "Ramanthapur", "Nagole", "LB Nagar"],
    category: "Sports",
    severity: "High",
    delayMultiplier: 2.2,
    recommendedMode: "Metro",
    description: "45,000+ cricket fans arriving between 5:30 PM and 11:30 PM.",
    advisory: "Severe gridlock on Uppal Main Road & Habsiguda. Take Hyderabad Metro to Stadium Metro Station."
  },
  {
    id: "bioasia-summit",
    name: "BioAsia Global Life Sciences Summit",
    dateStart: "2026-09-28",
    dateEnd: "2026-09-30",
    corridors: ["HICCI", "HITEC City", "Madhapur", "Kondapur", "Gachibowli", "ORR Exit 19"],
    category: "Exhibition / Tech",
    severity: "High",
    delayMultiplier: 1.7,
    recommendedMode: "Drive",
    description: "International biotech delegations and 3,000+ luxury cabs around Novotel HICC.",
    advisory: "Expect rolling diversions near Shilparamam & HICC Road between 8:30 AM and 10:30 AM."
  },
  {
    id: "bonalu-secunderabad",
    name: "Ujjaini Mahankali Bonalu Festival",
    dateStart: "2026-07-20",
    dateEnd: "2026-07-21",
    corridors: ["Secunderabad", "Paradise", "MG Road", "Ranigunj", "Patny", "RP Road"],
    category: "Festival",
    severity: "Severe",
    delayMultiplier: 2.5,
    recommendedMode: "Transit",
    description: "Historic state festival drawing 2 lakh devotees across Secunderabad old corridors.",
    advisory: "MG Road and RP Road strictly pedestrian-only. Diverted traffic toward Minister Road."
  },
  {
    id: "monsoon-waterlogging-alert",
    name: "IMD Yellow Alert: Heavy Monsoon Downpour",
    dateStart: "2026-09-20",
    dateEnd: "2026-09-22",
    corridors: ["Tolichowki", "Shaikpet Flyover", "Cyber Towers", "Biodiversity Junction", "Begumpet", "Ameerpet", "Malakpet Underpass"],
    category: "Weather / Monsoon",
    severity: "High",
    delayMultiplier: 1.9,
    recommendedMode: "Transit",
    description: "High risk of 45-60mm localized rainfall leading to waterlogging in known low-lying culverts.",
    advisory: "Avoid Tolichowki-Mehdipatnam flyover ramp and Cyber Towers underpass. Drive in low gear."
  },
  {
    id: "numaish-exhibition",
    name: "All India Industrial Exhibition (Numaish)",
    dateStart: "2026-01-01",
    dateEnd: "2026-02-15",
    corridors: ["Nampally", "MJ Market", "Goshamahal", "Abids", "Lakdikapul"],
    category: "Exhibition / Tech",
    severity: "High",
    delayMultiplier: 2.1,
    recommendedMode: "Metro",
    description: "Annual 45-day exhibition drawing 40,000 visitors every evening 5 PM - 10 PM.",
    advisory: "Nampally Station Road heavily congested. Park at Gandhi Bhavan Metro Station."
  },
  {
    id: "diwali-shopping-rush",
    name: "Diwali Festive Shopping Corridor Choke",
    dateStart: "2026-11-06",
    dateEnd: "2026-11-09",
    corridors: ["General Bazaar", "Abids", "Sultan Bazaar", "Koti", "Ameerpet", "Kukatpally KPHB"],
    category: "Festival",
    severity: "High",
    delayMultiplier: 2.3,
    recommendedMode: "Transit",
    description: "Festival retail shopping surge across prime commercial markets.",
    advisory: "Use KPHB Colony or Sultan Bazaar Metro instead of private four-wheelers."
  },
  {
    id: "marathon-hyderabad",
    name: "Hyderabad Heritage Marathon",
    dateStart: "2026-08-30",
    dateEnd: "2026-08-30",
    corridors: ["People's Plaza", "Necklace Road", "Gachibowli Stadium", "Cable Bridge", "Durgam Cheruvu"],
    category: "Sports",
    severity: "Severe",
    delayMultiplier: 3.0,
    recommendedMode: "Metro",
    description: "Durgam Cheruvu Cable Bridge and Necklace Road fully barricaded 5 AM to 11 AM.",
    advisory: "Take Inorbit Mall bypass or Jubilee Hills Road No 36 before 11:30 AM."
  },
  {
    id: "weekend-it-rush",
    name: "Friday IT Corridor Peak Exit Surge",
    dateStart: "2026-09-19",
    dateEnd: "2026-09-19",
    corridors: ["Cyber Towers", "Mindspace Junction", "Raheja IT Park", "Gachibowli ORR", "Financial District"],
    category: "Exhibition / Tech",
    severity: "Moderate",
    delayMultiplier: 1.5,
    recommendedMode: "Drive",
    description: "Simultaneous 150,000 employee exit wave across Madhapur, Hitec City, and Financial District.",
    advisory: "Peak bottleneck expected 6:00 PM - 8:45 PM. Prefer Biodiversity Flyover bypass."
  }
];

// Helper to query events for a selected date
export function getEventsForDate(selectedDateStr: string): CityEvent[] {
  if (!selectedDateStr) return [];
  const target = new Date(selectedDateStr).getTime();
  return HYDERABAD_EVENTS.filter((ev) => {
    const s = new Date(ev.dateStart).getTime();
    const e = new Date(ev.dateEnd).getTime();
    return target >= s && target <= e;
  });
}

// Check if a specific route/place is affected by events on that date
export function getEventImpact(selectedDateStr: string, origin: string, destination: string): {
  activeEvents: CityEvent[];
  impactedCorridors: string[];
  maxMultiplier: number;
  advisoryMessage: string | null;
} {
  const events = getEventsForDate(selectedDateStr);
  if (events.length === 0) {
    return { activeEvents: [], impactedCorridors: [], maxMultiplier: 1.0, advisoryMessage: null };
  }

  const textToCheck = `${origin} ${destination}`.toLowerCase();
  const matchedEvents: CityEvent[] = [];
  const impactedCorridors: string[] = [];

  for (const ev of events) {
    const isCorridorMatched = ev.corridors.some(
      (c) => textToCheck.includes(c.toLowerCase()) || c.toLowerCase().includes(origin.toLowerCase()) || c.toLowerCase().includes(destination.toLowerCase())
    );
    if (isCorridorMatched || events.length === 1) {
      matchedEvents.push(ev);
      impactedCorridors.push(...ev.corridors);
    }
  }

  if (matchedEvents.length === 0 && events.length > 0) {
    // If no direct corridor string match, default to first event if citywide
    matchedEvents.push(events[0]);
  }

  const maxMultiplier = matchedEvents.reduce((max, ev) => Math.max(max, ev.delayMultiplier), 1.0);
  const advisoryMessage = matchedEvents.length > 0 
    ? `⚠️ ${matchedEvents[0].name} detected on ${selectedDateStr}. Delays up to +${Math.round((maxMultiplier - 1) * 100)}% on ${matchedEvents[0].corridors.slice(0, 3).join(", ")}. Recommendation: ${matchedEvents[0].advisory}`
    : null;

  return {
    activeEvents: matchedEvents,
    impactedCorridors: Array.from(new Set(impactedCorridors)),
    maxMultiplier,
    advisoryMessage
  };
}
