import { create } from 'zustand'

export type OverlayKey = 'rivers' | 'roads' | 'settlements' | 'heightTint'
export type MapMode = 'terrain' | 'hex'

export interface AxialCoordinate {
  q: number
  r: number
}

export interface HexBaseState extends AxialCoordinate {
  elevation: number
  placedAt: number
}

export interface HexPoiState extends AxialCoordinate {
  id: string
  type: string
  cooldown: number
}

export interface Settlement {
  id: string
  name: string
  position: { x: number; y: number; elevation: number }
}

interface Resources {
  energy: number
  biomass: number
  water: number
}

interface GameState {
  seed: string
  elevationScale: number
  seaLevel: number
  overlayVisibility: Record<OverlayKey, boolean>
  resources: Resources
  settlements: Settlement[]
  selectedSettlementId: string | null
  mapMode: MapMode
  hexState: {
    base: HexBaseState | null
    pois: Record<string, HexPoiState>
  }
  setSeed: (seed: string) => void
  setElevationScale: (scale: number) => void
  setSeaLevel: (level: number) => void
  toggleOverlay: (key: OverlayKey) => void
  setOverlay: (key: OverlayKey, value: boolean) => void
  setSettlements: (settlements: Settlement[]) => void
  selectSettlement: (id: string | null) => void
  adjustResource: (key: keyof Resources, delta: number) => void
  setMapMode: (mode: MapMode) => void
  setHexBase: (base: HexBaseState | null) => void
  setHexPois: (pois: HexPoiState[]) => void
  setHexPoiCooldown: (id: string, cooldown: number) => void
  tickHexPoiCooldowns: (delta: number) => void
}

export const useGameStore = create<GameState>((set) => ({
  seed: 'collapse-1',
  elevationScale: 24,
  seaLevel: 0.32,
  overlayVisibility: {
    rivers: true,
    roads: true,
    settlements: true,
    heightTint: true,
  },
  resources: {
    energy: 240,
    biomass: 120,
    water: 310,
  },
  settlements: [],
  selectedSettlementId: null,
  mapMode: 'terrain',
  hexState: {
    base: null,
    pois: {},
  },
  setSeed: (seed) => set({ seed }),
  setElevationScale: (scale) => set({ elevationScale: scale }),
  setSeaLevel: (level) => set({ seaLevel: level }),
  toggleOverlay: (key) =>
    set((state) => ({
      overlayVisibility: {
        ...state.overlayVisibility,
        [key]: !state.overlayVisibility[key],
      },
    })),
  setOverlay: (key, value) =>
    set((state) => ({
      overlayVisibility: {
        ...state.overlayVisibility,
        [key]: value,
      },
    })),
  setSettlements: (settlements) => set({ settlements }),
  selectSettlement: (id) => set({ selectedSettlementId: id }),
  adjustResource: (key, delta) =>
    set((state) => ({
      resources: {
        ...state.resources,
        [key]: state.resources[key] + delta,
      },
    })),
  setMapMode: (mode) => set({ mapMode: mode }),
  setHexBase: (base) =>
    set((state) => ({
      hexState: {
        ...state.hexState,
        base: base ? { ...base } : null,
      },
    })),
  setHexPois: (pois) =>
    set((state) => {
      const next: Record<string, HexPoiState> = {}
      pois.forEach((poi) => {
        next[poi.id] = { ...poi }
      })
      return {
        hexState: {
          ...state.hexState,
          pois: next,
        },
      }
    }),
  setHexPoiCooldown: (id, cooldown) =>
    set((state) => {
      const poi = state.hexState.pois[id]
      if (!poi) return state
      return {
        hexState: {
          ...state.hexState,
          pois: {
            ...state.hexState.pois,
            [id]: { ...poi, cooldown },
          },
        },
      }
    }),
  tickHexPoiCooldowns: (delta) =>
    set((state) => {
      if (delta <= 0) return state
      let mutated = false
      const updated: Record<string, HexPoiState> = {}
      Object.entries(state.hexState.pois).forEach(([id, poi]) => {
        const nextCooldown = Math.max(0, poi.cooldown - delta)
        if (nextCooldown !== poi.cooldown) {
          mutated = true
        }
        updated[id] = { ...poi, cooldown: nextCooldown }
      })
      if (!mutated) return state
      return {
        hexState: {
          ...state.hexState,
          pois: updated,
        },
      }
    }),
}))
