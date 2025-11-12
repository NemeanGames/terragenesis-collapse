import type { RegionCategory, RegionGate, RegionPoi } from "../../state/types";
import { hashAxial } from "../hex";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POI_CATALOG: Record<RegionCategory, { type: string; names: string[] }[]> = {
  urbanCore: [
    { type: "infrastructure", names: ["Transit Hub", "Water Plant", "Grid Control"] },
    { type: "research", names: ["Bio Lab", "Signal Array", "Weather Node"] },
    { type: "supply", names: ["Depot", "Warehouse", "Clinic"] }
  ],
  urbanDistrict: [
    { type: "residential", names: ["Apartment Block", "Shelter", "Dormitory"] },
    { type: "commerce", names: ["Bazaar", "Market", "Logistics Row"] },
    { type: "utility", names: ["Relay", "Water Tower", "Substation"] }
  ],
  rural: [
    { type: "agriculture", names: ["Farmstead", "Hydroplot", "Orchard"] },
    { type: "outpost", names: ["Watch Post", "Relay Shack", "Supply Shed"] }
  ],
  wilderness: [
    { type: "ruins", names: ["Collapsed Dome", "Sunken Labs", "Crater Site"] },
    { type: "natural", names: ["Hot Spring", "Crystal Cavern", "Ancient Grove"] }
  ]
};

export function generateRegionPois(seed: number, category: RegionCategory, axialHash = 0) {
  const rng = mulberry32(seed ^ axialHash ^ 0x9e3779b1);
  const catalog = POI_CATALOG[category];
  const baseCount = category === "urbanCore" ? 6 : category === "urbanDistrict" ? 4 : category === "rural" ? 3 : 2;
  const extra = rng() < 0.45 ? 1 : 0;
  const total = baseCount + extra;
  const pois: RegionPoi[] = [];
  for (let i = 0; i < total; i++) {
    const bucket = catalog[i % catalog.length];
    const name = bucket.names[Math.floor(rng() * bucket.names.length)] ?? `${bucket.type} ${i + 1}`;
    const difficultyBase = category === "urbanCore" ? 0.75 : category === "urbanDistrict" ? 0.55 : category === "rural" ? 0.4 : 0.35;
    const difficulty = Math.min(1, Math.max(0.2, difficultyBase + (rng() - 0.5) * 0.25));
    pois.push({
      id: `poi-${hashAxial({ q: i + 1, r: Math.floor(rng() * 360) })}`,
      name,
      type: bucket.type,
      difficulty: Number(difficulty.toFixed(2)),
      status: "idle"
    });
  }
  return pois;
}

export function deriveRegionGates(
  category: RegionCategory,
  worldX: number,
  worldZ: number,
  mapSize: number
): RegionGate[] {
  const nx = Math.min(0.9, Math.max(0.1, (worldX + mapSize / 2) / mapSize));
  const nz = Math.min(0.9, Math.max(0.1, (worldZ + mapSize / 2) / mapSize));
  const base = category === "urbanCore" ? 26 : category === "urbanDistrict" ? 20 : category === "rural" ? 14 : 10;
  return [
    { edge: "N", t: nx, width: base },
    { edge: "S", t: 1 - nx, width: Math.max(10, base * 0.9) },
    { edge: "E", t: nz, width: Math.max(10, base * 0.8) },
    { edge: "W", t: 1 - nz, width: Math.max(8, base * 0.75) }
  ];
}
