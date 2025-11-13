import { generate } from "../city-core/generate";
import type { CityData, CityParams, WorldConstraints } from "../city-core/types";

type GenerateMessage = {
  type: "generate";
  reqId: number;
  cacheKey: string;
  seed: number;
  params: CityParams;
  constraints: WorldConstraints;
};

type WorkerMessage = GenerateMessage;

const cache = new Map<string, CityData>();

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (message.type !== "generate") return;
  const { cacheKey, seed, params, constraints, reqId } = message;

  if (cache.has(cacheKey)) {
    const cityData = cache.get(cacheKey)!;
    postMessage({ reqId, cityData });
    return;
  }

  const cityData = generate(seed, params, constraints);
  cache.set(cacheKey, cityData);
  postMessage({ reqId, cityData });
};
