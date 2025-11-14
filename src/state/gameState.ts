import { nanoid } from "nanoid";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { FACILITIES, type FacilityId, facilityById } from "../features/facilities/data";
import { PROJECT_LIBRARY } from "../features/facilities/projects";
import { INITIAL_SURVIVORS } from "../features/survivors/data";
import type {
  EnvironmentState,
  EnvironmentTargets,
  GameEvent,
  GameSnapshot,
  MapView,
  Project,
  RegionDetail,
  RegionPoiStatus,
  ResourceKey,
  ResourceMap,
  Survivor,
  SurvivorRole
} from "./types";
import type { TickComputation } from "../simulation/tick";
import type { PhysarumParams, PhysarumPlan } from "../roads/types";
import { createDefaultPhysarumConfig } from "../config/physarum";
import type { PhysarumWorldContext } from "../world/terrain/physarumPlanner";
import { planWorldPhysarum } from "../world/terrain/physarumPlanner";

const STORAGE_KEY = "tg-collapse-save";

const initialResources: ResourceMap = {
  credits: 420,
  biofuel: 80,
  research: 40,
  oxygenReserve: 120,
  supplies: 110
};

const initialEnvironment: EnvironmentState = {
  pressure: 0.32,
  temperature: 0.28,
  oxygen: 0.54,
  water: 0.44
};

const environmentTargets: EnvironmentTargets = {
  pressure: 0.68,
  temperature: 0.65,
  oxygen: 0.78,
  water: 0.72
};

const baseFacilities = FACILITIES.map((f) => ({ id: f.id, count: f.id === "hab" ? 1 : 0 }));

const defaultPhysarum = createDefaultPhysarumConfig();

export interface GameStoreState {
  resources: ResourceMap;
  environment: EnvironmentState;
  environmentTargets: EnvironmentTargets;
  survivors: Survivor[];
  facilities: { id: FacilityId; count: number }[];
  activeProjects: Project[];
  hostility: number;
  morale: number;
  events: GameEvent[];
  tickLengthMinutes: number;
  isPaused: boolean;
  lastTickAt: number | null;
  lastSavedAt: number | null;
  isSaving: boolean;
  worldSeed: number;
  elevScale: number;
  showRivers: boolean;
  showSprites: boolean;
  showRoads: boolean;
  enablePhysarumWorld: boolean;
  enablePhysarumCells: boolean;
  showPhysarumConductance: boolean;
  showPhysarumSkeleton: boolean;
  showPhysarumRoads: boolean;
  physarumParams: PhysarumParams;
  physarumWorldPlan: PhysarumPlan | null;
  mapView: MapView;
  selectedRegion: RegionDetail | null;
  zombieSurvivors: number;
  zombieFood: number;
  zombieWater: number;
  zombieHostility: number;
  applyTick: (result: TickComputation) => void;
  queueEvent: (event: GameEvent) => void;
  assignSurvivor: (id: string, role: SurvivorRole) => void;
  startProject: (projectId: string) => void;
  buildFacility: (facilityId: FacilityId) => void;
  initializeFromStorage: () => void;
  saveToStorage: () => void;
  setLastTickAt: (timestamp: number | null) => void;
  togglePause: () => void;
  snapshot: () => GameSnapshot;
  setWorldSeed: (seed: number) => void;
  setElevScale: (scale: number) => void;
  toggleLayer: (layer: "rivers" | "sprites" | "roads") => void;
  togglePhysarumFeature: (feature: "world" | "cells") => void;
  togglePhysarumOverlay: (overlay: "conductance" | "skeleton" | "roads") => void;
  setPhysarumParam: <K extends keyof PhysarumParams>(key: K, value: PhysarumParams[K]) => void;
  runPhysarumWorld: (context: PhysarumWorldContext) => void;
  clearPhysarumWorld: () => void;
  regenerateSeed: () => void;
  gainZombieResource: (resource: "survivors" | "food" | "water", amount: number) => void;
  spendZombieResource: (resource: "survivors" | "food" | "water", amount: number) => void;
  setZombieHostility: (value: number) => void;
  toggleZombieWorld: () => void;
  setMapView: (view: MapView) => void;
  openRegion: (detail: RegionDetail) => void;
  closeRegion: () => void;
  updateRegionPoiStatus: (poiId: string, status: RegionPoiStatus) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cloneResources(resources: ResourceMap): ResourceMap {
  return { ...resources };
}

function cloneEnvironment(env: EnvironmentState): EnvironmentState {
  return { ...env };
}

function serialize(state: GameStoreState) {
  const data = {
    resources: state.resources,
    environment: state.environment,
    survivors: state.survivors,
    facilities: state.facilities,
    activeProjects: state.activeProjects,
    hostility: state.hostility,
    morale: state.morale,
    events: state.events.slice(-16),
    worldSeed: state.worldSeed,
    elevScale: state.elevScale,
    showRivers: state.showRivers,
    showSprites: state.showSprites,
    showRoads: state.showRoads,
    enablePhysarumWorld: state.enablePhysarumWorld,
    enablePhysarumCells: state.enablePhysarumCells,
    showPhysarumConductance: state.showPhysarumConductance,
    showPhysarumSkeleton: state.showPhysarumSkeleton,
    showPhysarumRoads: state.showPhysarumRoads,
    physarumParams: state.physarumParams,
    mapView: state.mapView,
    selectedRegion: state.selectedRegion,
    zombieSurvivors: state.zombieSurvivors,
    zombieFood: state.zombieFood,
    zombieWater: state.zombieWater,
    zombieHostility: state.zombieHostility
  };
  return JSON.stringify(data);
}

function deserialize(raw: string): Partial<GameStoreState> | null {
  try {
    const data = JSON.parse(raw);
    return data;
  } catch (error) {
    console.warn("Failed to parse save file", error);
    return null;
  }
}

export const useGameStore = create<GameStoreState>()(
  devtools((set, get) => ({
    resources: cloneResources(initialResources),
    environment: cloneEnvironment(initialEnvironment),
    environmentTargets,
    survivors: INITIAL_SURVIVORS.map((s) => ({ ...s })),
    facilities: baseFacilities.map((f) => ({ ...f })),
    activeProjects: [],
    hostility: 18,
    morale: 68,
    events: [],
    tickLengthMinutes: 30,
    isPaused: false,
    lastTickAt: null,
    lastSavedAt: null,
    isSaving: false,
    worldSeed: 42,
    elevScale: 28,
    showRivers: true,
    showSprites: true,
    showRoads: true,
    enablePhysarumWorld: defaultPhysarum.enablePhysarumWorld,
    enablePhysarumCells: defaultPhysarum.enablePhysarumCells,
    showPhysarumConductance: false,
    showPhysarumSkeleton: false,
    showPhysarumRoads: false,
    physarumParams: { ...defaultPhysarum.params },
    physarumWorldPlan: null,
    mapView: "terra" as MapView,
    selectedRegion: null,
    zombieSurvivors: 24,
    zombieFood: 120,
    zombieWater: 90,
    zombieHostility: 32,
    applyTick: (result) => {
      set((state) => {
        const resources = cloneResources(state.resources);
        (Object.keys(result.resourceDelta) as ResourceKey[]).forEach((key) => {
          const next = resources[key] + (result.resourceDelta[key] ?? 0);
          resources[key] = Math.max(0, Number.isFinite(next) ? next : resources[key]);
        });

        const environment = cloneEnvironment(state.environment);
        (Object.keys(result.environmentDelta) as (keyof EnvironmentState)[]).forEach((key) => {
          const next = environment[key] + (result.environmentDelta[key] ?? 0);
          environment[key] = clamp(next, 0, 1.25);
        });

        const updatedProjects: Project[] = state.activeProjects
          .map((project) => {
            const progress = result.projects.find((p) => p.id === project.id);
            if (!progress) return project;
            if (progress.completed) {
              return null;
            }
            return { ...project, remainingHours: progress.remainingHours };
          })
          .filter(Boolean) as Project[];

        return {
          ...state,
          resources,
          environment,
          activeProjects: updatedProjects,
          hostility: clamp(state.hostility + result.hostilityDelta, 0, 100),
          morale: clamp(state.morale + result.moraleDelta, 0, 100)
        };
      });
    },
    queueEvent: (event) =>
      set((state) => {
        const events = [...state.events, event];
        while (events.length > 24) events.shift();
        return { events };
      }),
    assignSurvivor: (id, role) =>
      set((state) => ({
        survivors: state.survivors.map((survivor) =>
          survivor.id === id ? { ...survivor, role } : survivor
        )
      })),
    startProject: (projectId) =>
      set((state) => {
        const template = PROJECT_LIBRARY.find((p) => p.id === projectId);
        if (!template) return state;
        if (state.activeProjects.some((p) => p.name === template.name)) {
          return state;
        }
        const instance: Project = {
          id: `${projectId}-${nanoid(6)}`,
          name: template.name,
          remainingHours: template.remainingHours,
          totalHours: template.totalHours,
          reward: template.reward
        };
        const event: GameEvent = {
          id: `project-start-${Date.now()}`,
          title: `${template.name} Launched`,
          body: `${template.name} is underway. Completion ETA ${template.totalHours}h.`,
          severity: "info",
          timestamp: Date.now()
        };
        const events = [...state.events, event].slice(-24);
        return {
          ...state,
          activeProjects: [...state.activeProjects, instance],
          events
        };
      }),
    buildFacility: (facilityId) =>
      set((state) => {
        const def = facilityById(facilityId);
        if (!def) return state;
        const canAfford = (Object.keys(def.cost) as ResourceKey[]).every((key) => {
          const need = def.cost[key] ?? 0;
          return state.resources[key] >= need;
        });
        if (!canAfford) {
          return state;
        }
        const resources = cloneResources(state.resources);
        (Object.keys(def.cost) as ResourceKey[]).forEach((key) => {
          resources[key] -= def.cost[key] ?? 0;
        });
        const facilities = state.facilities.map((f) =>
          f.id === facilityId ? { ...f, count: f.count + 1 } : f
        );
        const event: GameEvent = {
          id: `facility-${facilityId}-${Date.now()}`,
          title: `${def.name} constructed`,
          body: `${def.name} adds new capabilities to the camp.`,
          severity: "info",
          timestamp: Date.now()
        };
        const events = [...state.events, event].slice(-24);
        return { ...state, resources, facilities, events };
      }),
    initializeFromStorage: () => {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = deserialize(raw);
      if (!data) return;
      set((state) => ({
        ...state,
        ...data,
        events: data.events ?? state.events
      }));
    },
    saveToStorage: () => {
      const state = get();
      set({ isSaving: true });
      const payload = serialize(state);
      localStorage.setItem(STORAGE_KEY, payload);
      set({ isSaving: false, lastSavedAt: Date.now() });
    },
    setLastTickAt: (timestamp) => set({ lastTickAt: timestamp }),
    togglePause: () =>
      set((state) => {
        const nextPaused = !state.isPaused;
        return {
          isPaused: nextPaused,
          lastTickAt: nextPaused ? null : Date.now()
        };
      }),
    snapshot: () => {
      const state = get();
      return {
        resources: { ...state.resources },
        environment: { ...state.environment },
        survivors: state.survivors.map((s) => ({ ...s })),
        facilities: state.facilities.map((f) => ({ ...f })),
        hostility: state.hostility,
        morale: state.morale,
        activeProjects: state.activeProjects.map((p) => ({ ...p })),
        tickLengthMinutes: state.tickLengthMinutes
      } satisfies GameSnapshot;
    },
    setWorldSeed: (seed) => set({ worldSeed: seed }),
    setElevScale: (scale) => set({ elevScale: scale }),
    toggleLayer: (layer) =>
      set((state) => {
        if (layer === "rivers") return { showRivers: !state.showRivers };
        if (layer === "sprites") return { showSprites: !state.showSprites };
        return { showRoads: !state.showRoads };
      }),
    togglePhysarumFeature: (feature) =>
      set((state) => {
        if (feature === "world") {
          const next = !state.enablePhysarumWorld;
          if (!next) {
            return { enablePhysarumWorld: next, physarumWorldPlan: null };
          }
          return { enablePhysarumWorld: next };
        }
        return { enablePhysarumCells: !state.enablePhysarumCells };
      }),
    togglePhysarumOverlay: (overlay) =>
      set((state) => {
        if (overlay === "conductance") {
          return { showPhysarumConductance: !state.showPhysarumConductance };
        }
        if (overlay === "skeleton") {
          return { showPhysarumSkeleton: !state.showPhysarumSkeleton };
        }
        return { showPhysarumRoads: !state.showPhysarumRoads };
      }),
    setPhysarumParam: (key, value) =>
      set((state) => ({
        physarumParams: { ...state.physarumParams, [key]: value }
      })),
    runPhysarumWorld: (context) =>
      set((state) => {
        const plan = planWorldPhysarum(context, state.physarumParams);
        return { physarumWorldPlan: plan };
      }),
    clearPhysarumWorld: () => set({ physarumWorldPlan: null }),
    regenerateSeed: () => set((state) => ({ worldSeed: state.worldSeed + 1 })),
    gainZombieResource: (resource, amount) =>
      set((state) => {
        const map = {
          survivors: "zombieSurvivors",
          food: "zombieFood",
          water: "zombieWater"
        } as const;
        const key = map[resource];
        const next = Math.max(0, state[key] + Math.max(0, amount));
        return { [key]: next } as Pick<GameStoreState, typeof key>;
      }),
    spendZombieResource: (resource, amount) =>
      set((state) => {
        const map = {
          survivors: "zombieSurvivors",
          food: "zombieFood",
          water: "zombieWater"
        } as const;
        const key = map[resource];
        const next = Math.max(0, state[key] - Math.max(0, amount));
        return { [key]: next } as Pick<GameStoreState, typeof key>;
      }),
    setZombieHostility: (value) => set({ zombieHostility: clamp(value, 0, 100) }),
    toggleZombieWorld: () =>
      set((state) => {
        const next = state.mapView === "zombie" ? "terra" : "zombie";
        return {
          mapView: next,
          selectedRegion: next === "zombie" ? null : state.selectedRegion
        };
      }),
    setMapView: (view) =>
      set((state) => {
        if (view === state.mapView) return state;
        if (view === "zombie") {
          return { mapView: "zombie" as MapView, selectedRegion: null };
        }
        if (view === "terra") {
          return { mapView: "terra" as MapView };
        }
        return { mapView: view };
      }),
    openRegion: (detail) =>
      set(() => ({
        selectedRegion: detail,
        mapView: "urban" as MapView
      })),
    closeRegion: () =>
      set((state) => ({
        mapView: state.mapView === "urban" ? ("terra" as MapView) : state.mapView,
        selectedRegion: null
      })),
    updateRegionPoiStatus: (poiId, status) =>
      set((state) => {
        if (!state.selectedRegion) return state;
        const pois = state.selectedRegion.pois.map((poi) =>
          poi.id === poiId ? { ...poi, status } : poi
        );
        return {
          selectedRegion: { ...state.selectedRegion, pois }
        };
      })
  }))
);
