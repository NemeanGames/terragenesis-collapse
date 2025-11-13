import murmur from "murmurhash-js";
import { create } from "zustand";
import { createDefaultCityParams } from "../city-core/types";
import type { CityData, CityParams, WorldConstraints } from "../city-core/types";

type CityWorkerMessage = {
  reqId: number;
  cityData: CityData;
};

type GeneratePayload = {
  type: "generate";
  reqId: number;
  cacheKey: string;
  seed: number;
  params: CityParams;
  constraints: WorldConstraints;
};

const cityWorker = new Worker(new URL("../workers/city.worker.ts", import.meta.url));

type CityStoreState = {
  seed: number;
  params: CityParams;
  constraints: WorldConstraints;
  cityData: CityData | null;
  isBusy: boolean;
  reqId: number;
  inFlight: number | null;
  setSeed: (seed: number) => void;
  setParams: (partial: Partial<CityParams>) => void;
  setConstraints: (constraints: WorldConstraints) => void;
  setCityData: (data: CityData) => void;
  rebatch: () => void;
};

let rebatchTimeout: ReturnType<typeof setTimeout> | null = null;

export const useCityStore = create<CityStoreState>((set, get) => ({
  seed: 1,
  params: createDefaultCityParams(),
  constraints: {},
  cityData: null,
  isBusy: false,
  reqId: 0,
  inFlight: null,
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
    if (rebatchTimeout) {
      clearTimeout(rebatchTimeout);
    }

    const nextId = get().reqId + 1;
    set({ isBusy: true, reqId: nextId });

    rebatchTimeout = setTimeout(() => {
      const { seed, params, constraints } = get();
      const cacheKey = `${seed}:${murmur(JSON.stringify(params))}:${murmur(
        JSON.stringify(constraints || {})
      )}`;

      const payload: GeneratePayload = {
        type: "generate",
        reqId: nextId,
        cacheKey,
        seed,
        params,
        constraints
      };

      set({ inFlight: nextId });
      cityWorker.postMessage(payload);
      rebatchTimeout = null;
    }, 250);
  }
}));

cityWorker.onmessage = (event: MessageEvent<CityWorkerMessage>) => {
  const { reqId, cityData } = event.data;
  useCityStore.setState((state) => {
    if (state.inFlight !== reqId) {
      return state;
    }

    return {
      cityData,
      isBusy: false,
      inFlight: null
    };
  });
};
