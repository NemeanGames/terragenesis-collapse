import { create } from "zustand";
import { createDefaultCityParams } from "../city-core/types";
import type { CityData, CityParams, WorldConstraints } from "../city-core/types";

type CityStoreState = {
  seed: number;
  params: CityParams;
  constraints: WorldConstraints;
  cityData: CityData | null;
  isBusy: boolean;
  reqId: number;
  setSeed: (seed: number) => void;
  setParams: (partial: Partial<CityParams>) => void;
  setConstraints: (constraints: WorldConstraints) => void;
  setCityData: (data: CityData) => void;
  rebatch: () => void;
};

export const useCityStore = create<CityStoreState>((set, get) => ({
  seed: 1,
  params: createDefaultCityParams(),
  constraints: {},
  cityData: null,
  isBusy: false,
  reqId: 0,
  setSeed: (seed) => set({ seed }),
  setParams: (partial) =>
    set((state) => {
      const next: CityParams = {
        ...state.params,
        ...partial
      };
      if (partial.physarum) {
        const fallback = state.params.physarum ?? createDefaultCityParams().physarum!;
        next.physarum = { ...fallback, ...partial.physarum };
      }
      return { params: next };
    }),
  setConstraints: (constraints) => set({ constraints }),
  setCityData: (data) => set({ cityData: data, isBusy: false }),
  rebatch: () => {
    const nextId = get().reqId + 1;
    set({ isBusy: true, reqId: nextId });
  }
}));
