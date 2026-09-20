"""
FlowSight AI — Hyderabad Network Landmark Directory
Maps all 120 topological network nodes (N001–N120) to authentic Hyderabad metropolitan
localities, junctions, transit corridors, and arterial crossroads.
"""

from typing import Dict, List, Any

# Primary Hyderabad regional anchor points across the 12x10 network grid
HYDERABAD_LOCALITIES = [
    # Row 0 (South / Rajendranagar / Outer Ring Road South-West)
    {"name": "Rajendranagar ORR Interchange", "area": "South West", "desc": "Outer Ring Road western link near Agri University"},
    {"name": "Rajendranagar Central", "area": "South West", "desc": "National Highway 44 connector & commercial strip"},
    {"name": "Budvel Station Cross", "area": "South West", "desc": "Railway terminal corridor & warehousing hub"},
    {"name": "Aramghar Junction", "area": "South", "desc": "National Highway junction & airport transit corridor"},
    {"name": "Shivarampally Cross", "area": "South", "desc": "Chandrayangutta expressway feeder"},
    {"name": "Mailardevpally Hub", "area": "South", "desc": "Industrial hub & south ring transit corridor"},
    {"name": "Chandrayangutta X Roads", "area": "Old City South", "desc": "Major flyover & inner ring road intersection"},
    {"name": "Falaknuma Palace Cross", "area": "Old City South", "desc": "MMTS terminal & historic palace transit link"},
    {"name": "Barkas Royal Road", "area": "Old City South", "desc": "Arterial link toward airport & south suburbs"},
    {"name": "Pahadi Shareef Cross", "area": "South East", "desc": "Airport bypass & Srisailam highway feeder"},
    {"name": "Mamidipally Tech Park", "area": "South East", "desc": "SEZ aerospace zone connector"},
    {"name": "Shamshabad Airport Gateway", "area": "South East", "desc": "Southern ORR arterial expressway interchange"},

    # Row 1 (Lower Central / Mehdipatnam / Old City North)
    {"name": "Langar Houz Military Cross", "area": "South West", "desc": "Golconda fort access & defense corridor"},
    {"name": "Tolichowki Flyover Junction", "area": "West", "desc": "Major IT corridor connector toward Hitec City"},
    {"name": "Mehdipatnam Bus Terminal", "area": "Central West", "desc": "Busiest public transit interchange & PVNR Expressway ramp"},
    {"name": "Masab Tank Circle", "area": "Central", "desc": "Banjara Hills link & NMDC corporate junction"},
    {"name": "Lakdikapul Metro Station", "area": "Central", "desc": "Assembly & Secretariat civic corridor"},
    {"name": "Abids Commercial Center", "area": "Central", "desc": "Heritage banking & retail commercial boulevard"},
    {"name": "Koti Women's College X Roads", "area": "Central", "desc": "Historic market district & medical hub"},
    {"name": "Chaderghat Causeway", "area": "East Central", "desc": "Musi River bridge link toward Malakpet"},
    {"name": "Malakpet Super Bazar Metro", "area": "East Central", "desc": "Vijayawada Highway NH65 arterial gateway"},
    {"name": "Dilsukhnagar Main Bus Station", "area": "East", "desc": "High-density retail strip & metro transit corridor"},
    {"name": "Kothapet Fruit Market Link", "area": "East", "desc": "NH65 intersection & wholesale logistics zone"},
    {"name": "LB Nagar Ring Road Junction", "area": "East", "desc": "Southern-Eastern ORR gateway & intercity hub"},

    # Row 2 (Banjara Hills / Central Core / Musi North)
    {"name": "Shaikpet Flyover Cross", "area": "West", "desc": "Durgam Cheruvu feeder & Old Mumbai Highway link"},
    {"name": "Banjara Hills Road No 12", "area": "Central West", "desc": "MLA Colony arterial & premier healthcare corridor"},
    {"name": "Banjara Hills Road No 1 / City Center", "area": "Central West", "desc": "Taj Krishna junction & high-capacity arterial"},
    {"name": "Panjagutta Central Circle", "area": "Central", "desc": "Major flyover crossroads connecting Ameerpet & Banjara Hills"},
    {"name": "Somajiguda Raj Bhavan Road", "area": "Central", "desc": "Governor residence & corporate commercial boulevard"},
    {"name": "Khairatabad RTA Junction", "area": "Central", "desc": "Hussain Sagar lake entrance & Metro Station"},
    {"name": "Tank Bund South Link", "area": "Central", "desc": "Historic promenade connecting Hyderabad & Secunderabad"},
    {"name": "Himayatnagar Street No 1", "area": "Central", "desc": "High-density retail & residential arterial"},
    {"name": "Narayanguda YMCA Cross", "area": "Central", "desc": "Educational corridor & RTC cross road feeder"},
    {"name": "Barkatpura Chaman", "area": "East Central", "desc": "Bus depot access & residential crossroads"},
    {"name": "Amberpet Ali Cafe X Roads", "area": "East Central", "desc": "Warangal highway inner link & commercial junction"},
    {"name": "Ramanthapur Poly-Technic", "area": "East", "desc": "Uppal corridor arterial link"},

    # Row 3 (Madhapur / Jubilee Hills / Ameerpet Core)
    {"name": "Inorbit Mall Durgam Cheruvu", "area": "Hitec Corridor", "desc": "Cable bridge landing & retail IT campus hub"},
    {"name": "Madhapur Police Station Cross", "area": "Hitec Corridor", "desc": "Ayyappa Society feeder & IT commercial boulevard"},
    {"name": "Jubilee Hills Road No 36 Checkpost", "area": "West", "desc": "Premier commercial corridor & Metro Station"},
    {"name": "Jubilee Hills Road No 45 Flyover", "area": "West", "desc": "Durgam Cheruvu expressway elevated feeder"},
    {"name": "Krishna Nagar Cross", "area": "Central West", "desc": "Media district & Yousufguda arterial"},
    {"name": "Ameerpet Metro Interchange", "area": "Central", "desc": "Hyderabad metro red-blue line interchange & coaching hub"},
    {"name": "Begumpet Airport Flyover", "area": "Central North", "desc": "Chief Minister camp office & heritage airport link"},
    {"name": "Prakash Nagar Metro Cross", "area": "Central North", "desc": "Shoppers Stop boulevard & Secunderabad feeder"},
    {"name": "Ranigunj Industrial Cross", "area": "North Central", "desc": "MG Road commercial link & freight hub"},
    {"name": "Musheerabad Jain Temple", "area": "Central", "desc": "Gandhi Hospital medical corridor junction"},
    {"name": "RTC Cross Roads (TSRTC)", "area": "Central", "desc": "Cinema corridor & multi-lane city interchange"},
    {"name": "Vidyanagar Railway Bridge", "area": "East Central", "desc": "Osmania University southern gateway"},

    # Row 4 (Gachibowli / Hitec Core / Begumpet North)
    {"name": "Gachibowli Financial District Hub", "area": "Cyberabad", "desc": "Wipro Circle & multinational corporate headquarters"},
    {"name": "Gachibowli Stadium Cross", "area": "Cyberabad", "desc": "Sports complex & Old Mumbai Highway terminus"},
    {"name": "Bio-Diversity Park Junction", "area": "Cyberabad", "desc": "Multi-level flyover link connecting Hitec & Gachibowli"},
    {"name": "Mindspace IT Park Gateway", "area": "Hitec City", "desc": "Raheja IT park circular connector & metro station"},
    {"name": "Cyber Towers Main Junction", "area": "Hitec City", "desc": "Epicenter of Hyderabad IT corridor & Shilparamam cross"},
    {"name": "Hitec City Metro Station", "area": "Hitec City", "desc": "Cyber Gateway boulevard & high-capacity elevated transit"},
    {"name": "Kavuri Hills Incline", "area": "West", "desc": "Madhapur residential link & arterial bypass"},
    {"name": "Yousufguda Checkpost", "area": "Central West", "desc": "Police battalion & metro corridor"},
    {"name": "SR Nagar Community Cross", "area": "Central", "desc": "Commercial residential corridor & metro station"},
    {"name": "Balkampet Yellamma Temple Cross", "area": "Central", "desc": "Cultural commercial arterial link"},
    {"name": "Sanathnagar Industrial Estate", "area": "North Central", "desc": "Manufacturing logistics corridor & MMTS hub"},
    {"name": "Fateh Nagar Flyover Bridge", "area": "North Central", "desc": "Secunderabad railway line bypass link"},

    # Row 5 (Kondapur / KPHB / Secunderabad West)
    {"name": "Kondapur RTA Junction", "area": "North West", "desc": "Hafeezpet MMTS link & botanical garden connector"},
    {"name": "Botanical Garden Road", "area": "North West", "desc": "Gachibowli-Kondapur high-capacity connector"},
    {"name": "Kothaguda X Roads", "area": "North West", "desc": "Multi-directional flyover connecting Hitec & Kondapur"},
    {"name": "Allwyn Cross Roads", "area": "North West", "desc": "Miyapur arterial & industrial feeder"},
    {"name": "KPHB Colony Phase 1 Metro", "area": "North West", "desc": "Largest residential colony in Asia & retail boulevard"},
    {"name": "JNTU Hyderabad Gateway", "area": "North West", "desc": "National Highway 65 premier university cross"},
    {"name": "Moosapet Y Junction", "area": "North West", "desc": "Bharat Nagar flyover link & wholesale market"},
    {"name": "Erragadda Metro Station", "area": "North Central", "desc": "ESI Hospital health zone & commercial corridor"},
    {"name": "Balanagar Industrial Cross", "area": "North", "desc": "Aerospace manufacturing hub & IDPL arterial"},
    {"name": "Bowenpally Checkpost", "area": "North", "desc": "Nagpur NH44 gateway & northern military cross"},
    {"name": "Tadbund Hanuman Temple Cross", "area": "North", "desc": "Secunderabad northern link & transit bypass"},
    {"name": "Paradise Circle Secunderabad", "area": "Secunderabad", "desc": "Historic crossroads connecting Cantonment & Twin Cities"},

    # Row 6 (Miyapur / Kukatpally / Secunderabad Core)
    {"name": "Miyapur Metro Depot", "area": "North West", "desc": "Red Line terminal depot & intercity bus terminus"},
    {"name": "Hafeezpet Flyover Cross", "area": "North West", "desc": "MMTS railway interchange & residential feeder"},
    {"name": "Kukatpally Housing Board Main", "area": "North West", "desc": "Forum Sujana Mall link & shopping corridor"},
    {"name": "Vivekananda Nagar Cross", "area": "North West", "desc": "KPHB internal arterial link"},
    {"name": "IDL Lake Road", "area": "North West", "desc": "Bypass connector toward Sanathnagar"},
    {"name": "Ferozguda Cross", "area": "North", "desc": "Balanagar eastern arterial & defense laboratories"},
    {"name": "Chintal X Roads", "area": "North", "desc": "HMT township & industrial manufacturing belt"},
    {"name": "Suchitra Circle NH44", "area": "North", "desc": "Major highway intersection toward Medchal & Nagpur"},
    {"name": "Karkhana Main Road", "area": "Secunderabad", "desc": "Cantonment residential & shopping strip"},
    {"name": "JBS (Jubilee Bus Station)", "area": "Secunderabad", "desc": "Northern intercity bus terminal & Green Line metro terminus"},
    {"name": "Secunderabad Railway Station", "area": "Secunderabad", "desc": "Major South Central Railway zonal terminus & transit epicenter"},
    {"name": "Sangeet Cinema Cross", "area": "Secunderabad", "desc": "Clock tower feeder & military hospital boulevard"},

    # Row 7 (North Western Suburbs / Alwal / Malkajgiri)
    {"name": "Bachupally X Roads", "area": "Outer North West", "desc": "Engineering college hub & pharmaceutical SEZ"},
    {"name": "Nizampet Village Cross", "area": "North West", "desc": "High-density IT employee residential corridor"},
    {"name": "Pragathi Nagar Lake Road", "area": "North West", "desc": "JNTU bypass link & township arterial"},
    {"name": "Gajularamaram Cross", "area": "North", "desc": "Industrial SEZ & healthcare township link"},
    {"name": "Jeedimetla Industrial Hub", "area": "North", "desc": "Chemical & manufacturing industrial estate"},
    {"name": "Quthbullapur Municipal Cross", "area": "North", "desc": "North civic center & busy market junction"},
    {"name": "Alwal IG Statue Cross", "area": "North Secunderabad", "desc": "Cantonment northern arterial boulevard"},
    {"name": "Lothkunta Military Cross", "area": "North Secunderabad", "desc": "Trimulgherry military link & market street"},
    {"name": "Trimulgherry X Roads", "area": "Secunderabad", "desc": "Historic cantonment five-way crossroads"},
    {"name": "Malkajgiri Anandbagh Cross", "area": "East Secunderabad", "desc": "High-density residential hub & railway junction"},
    {"name": "Mettuguda Metro Junction", "area": "Secunderabad", "desc": "Rail Nilayam zonal headquarters & metro feeder"},
    {"name": "Tarnaka Metro Crossroads", "area": "East", "desc": "Osmania University northern gateway & research institutes"},

    # Row 8 (Outer North / ECIL / Osmania)
    {"name": "Gandimaisamma ORR Junction", "area": "Far North West", "desc": "Northern ORR expressway interchange"},
    {"name": "Dundigal Aviation Gateway", "area": "Far North West", "desc": "Air Force Academy corridor & aerospace belt"},
    {"name": "Suraram Colony Cross", "area": "North", "desc": "Malla Reddy health city connector"},
    {"name": "Kompally Highway Strip", "area": "North", "desc": "NH44 lifestyle shopping & convention corridor"},
    {"name": "Bolarum Railway Station Road", "area": "North Secunderabad", "desc": "Rashtrapati Nilayam presidential retreat link"},
    {"name": "Yapral Lake Road", "area": "North Secunderabad", "desc": "Defense officers colony & golf course connector"},
    {"name": "Sainikpuri Cross Roads", "area": "North East", "desc": "Premier residential colony & food hub boulevard"},
    {"name": "Neredmet Cross", "area": "North East", "desc": "Rachakonda police commissionerate corridor"},
    {"name": "AOC Center Gate", "area": "Secunderabad", "desc": "Army Ordnance Corps green canopy cantonment drive"},
    {"name": "Lalapet Flyover Link", "area": "East", "desc": "Railway workshop & Moula Ali industrial connector"},
    {"name": "Osmania University Arts College", "area": "East", "desc": "Historic heritage campus & research boulevard"},
    {"name": "Habsiguda Metro Crossroads", "area": "East", "desc": "NGRI scientific institutes & Warangal highway link"},

    # Row 9 (Far North East / ECIL / Uppal Industrial)
    {"name": "Medchal ORR Gateway", "area": "Far North", "desc": "Northern logistics warehouse zone & NH44 interchange"},
    {"name": "Kandlakoya Oxygen Park", "area": "Far North", "desc": "IT gateway & recreational green corridor"},
    {"name": "Dammaiguda X Roads", "area": "North East", "desc": "Nagaram suburban arterial link"},
    {"name": "Keesara Temple Highway", "area": "Far North East", "desc": "Outer ring road eastern feeder"},
    {"name": "Kapra Municipal Lake Circle", "area": "North East", "desc": "AS Rao Nagar extension & residential hub"},
    {"name": "AS Rao Nagar Main Boulevard", "area": "North East", "desc": "Eastern commercial high street & retail center"},
    {"name": "ECIL Cross Roads", "area": "North East", "desc": "Electronics giant headquarters & major transit depot"},
    {"name": "Moula Ali Kaman Gate", "area": "East", "desc": "Historic hill shrine & industrial warehousing hub"},
    {"name": "Nacharam Industrial Area", "area": "East", "desc": "Footwear & chemical industrial manufacturing belt"},
    {"name": "Mallapur Cross Roads", "area": "East", "desc": "IDA Mallapur logistics & manufacturing zone"},
    {"name": "Uppal Metro Terminal", "area": "East", "desc": "Rajiv Gandhi International Cricket Stadium & Warangal highway terminus"},
    {"name": "Uppal Ring Road Junction", "area": "East", "desc": "Outer ring road eastern expressway connector"}
]


def build_node_directory(nodes_dict: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Enriches the 120 topology nodes with localized landmarks and geographic descriptions."""
    sorted_node_ids = sorted(list(nodes_dict.keys()), key=lambda nid: int(nid.replace("N", "")))
    directory = []

    for i, nid in enumerate(sorted_node_ids):
        node = nodes_dict[nid]
        info = HYDERABAD_LOCALITIES[i % len(HYDERABAD_LOCALITIES)]
        directory.append({
            "node_id": nid,
            "name": info["name"],
            "area": info["area"],
            "description": info["desc"],
            "display_label": f"{info['name']} ({nid})",
            "lat": node["lat"],
            "lon": node["lon"],
            "x": node["x"],
            "y": node["y"]
        })

    return directory
