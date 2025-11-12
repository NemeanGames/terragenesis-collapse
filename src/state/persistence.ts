import { deserialiseHostility, serialiseHostility, HostilityState } from "./hostility";

export interface GlobalBuff {
  id: string;
  description: string;
  modifiers: Record<string, number>;
}

export interface ZoneProgress {
  zoneId: string;
  reclaimed: boolean;
  reclaimedAt?: number;
  buffsEarned: GlobalBuff[];
}

export interface MetaProgressionState {
  zones: Record<string, ZoneProgress>;
  globalBuffs: GlobalBuff[];
  lastHostility?: string;
}

const STORAGE_KEY = "terragenesis-collapse-meta";

// Fallback in-memory storage for non-browser environments (tests, SSR).
const memoryStorage = new Map<string, string>();

function getStorage(): Storage | undefined {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch (error) {
    console.warn("LocalStorage unavailable", error);
  }
  return undefined;
}

function readStorage(key: string): string | null {
  const storage = getStorage();
  if (storage) {
    return storage.getItem(key);
  }
  return memoryStorage.get(key) ?? null;
}

function writeStorage(key: string, value: string): void {
  const storage = getStorage();
  if (storage) {
    storage.setItem(key, value);
  } else {
    memoryStorage.set(key, value);
  }
}

export function createEmptyMeta(): MetaProgressionState {
  return {
    zones: {},
    globalBuffs: [],
  };
}

export function loadMetaProgression(): MetaProgressionState {
  const payload = readStorage(STORAGE_KEY);
  if (!payload) {
    return createEmptyMeta();
  }

  try {
    const parsed = JSON.parse(payload) as MetaProgressionState;
    return {
      ...createEmptyMeta(),
      ...parsed,
      zones: parsed.zones ?? {},
      globalBuffs: parsed.globalBuffs ?? [],
      lastHostility: parsed.lastHostility,
    };
  } catch (error) {
    console.warn("Failed to parse meta progression", error);
    return createEmptyMeta();
  }
}

export function saveMetaProgression(state: MetaProgressionState): void {
  writeStorage(STORAGE_KEY, JSON.stringify(state));
}

export function applyZoneReclaimed(
  state: MetaProgressionState,
  zoneId: string,
  buffs: GlobalBuff[],
): MetaProgressionState {
  const updatedZones = {
    ...state.zones,
    [zoneId]: {
      zoneId,
      reclaimed: true,
      reclaimedAt: Date.now(),
      buffsEarned: buffs,
    },
  };

  const buffMap = new Map(
    state.globalBuffs.map((buff) => [buff.id, { ...buff, modifiers: { ...buff.modifiers } }]),
  );
  buffs.forEach((buff) => {
    if (buffMap.has(buff.id)) {
      const existing = buffMap.get(buff.id)!;
      existing.modifiers = {
        ...existing.modifiers,
        ...buff.modifiers,
      };
      existing.description = buff.description || existing.description;
    } else {
      buffMap.set(buff.id, { ...buff, modifiers: { ...buff.modifiers } });
    }
  });

  const nextState: MetaProgressionState = {
    ...state,
    zones: updatedZones,
    globalBuffs: Array.from(buffMap.values()),
  };
  saveMetaProgression(nextState);
  return nextState;
}

export function recordHostilitySnapshot(state: MetaProgressionState, hostility: HostilityState): MetaProgressionState {
  const next = {
    ...state,
    lastHostility: serialiseHostility(hostility),
  };
  saveMetaProgression(next);
  return next;
}

export function restoreHostilityFromMeta(state: MetaProgressionState): HostilityState {
  return deserialiseHostility(state.lastHostility ?? null);
}

export interface ZoneSelectEntry {
  zoneId: string;
  name: string;
  difficulty: "CALM" | "TENSE" | "OVERWHELMING";
  reclaimed: boolean;
  buffsPreview: GlobalBuff[];
}

export interface ZoneSelectModel {
  entries: ZoneSelectEntry[];
  totalBuffs: GlobalBuff[];
}

/**
 * Prepares data for the zone-select screen.  Zones can be sourced from static
 * definitions or generated at runtime; this helper merges the persistent meta
 * progression information with the runtime roster.
 */
export function buildZoneSelectModel(
  roster: { id: string; name: string; difficulty: ZoneSelectEntry["difficulty"]; buffs: GlobalBuff[] }[],
  meta: MetaProgressionState,
): ZoneSelectModel {
  const entries: ZoneSelectEntry[] = roster.map((zone) => {
    const progress = meta.zones[zone.id];
    return {
      zoneId: zone.id,
      name: zone.name,
      difficulty: zone.difficulty,
      reclaimed: progress?.reclaimed ?? false,
      buffsPreview: progress?.buffsEarned ?? zone.buffs,
    };
  });

  return {
    entries,
    totalBuffs: meta.globalBuffs,
  };
}
