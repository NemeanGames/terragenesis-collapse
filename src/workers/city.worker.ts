import { generate } from "../city-core/generate";
import type { CityParams, WorldConstraints } from "../city-core/types";

type GenerateMessage = {
  type: "generate";
  reqId: number;
  seed: number;
  params: CityParams;
  constraints: WorldConstraints;
};

type WorkerMessage = GenerateMessage;

let currentReq = 0;

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (message.type !== "generate") return;
  const requestId = ++currentReq;
  const cityData = generate(message.seed, message.params, message.constraints);
  if (requestId === currentReq) {
    postMessage({ reqId: message.reqId, cityData });
  }
};
