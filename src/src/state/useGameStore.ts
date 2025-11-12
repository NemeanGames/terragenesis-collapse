import { create } from 'zustand'

export type OverlayKey = 'rivers' | 'roads' | 'settlements' | 'heightTint'

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
  setSeed: (seed: string) => void
  setElevationScale: (scale: number) => void
  setSeaLevel: (level: number) => void
  toggleOverlay: (key: OverlayKey) => void
  setOverlay: (key: OverlayKey, value: boolean) => void
  setSettlements: (settlements: Settlement[]) => void
  selectSettlement: (id: string | null) => void
  adjustResource: (key: keyof Resources, delta: number) => void
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
}))
