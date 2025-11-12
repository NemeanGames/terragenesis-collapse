import { useEffect } from "react";
import { useGameStore } from "../state/gameState";
import { advanceTick } from "./tick";

const TICK_MS = 1500;

export function useSimulation() {
  const { tickLengthMinutes, isPaused, lastTickAt, setLastTickAt, applyTick, queueEvent, snapshot } =
    useGameStore((state) => ({
      tickLengthMinutes: state.tickLengthMinutes,
      isPaused: state.isPaused,
      lastTickAt: state.lastTickAt,
      setLastTickAt: state.setLastTickAt,
      applyTick: state.applyTick,
      queueEvent: state.queueEvent,
      snapshot: state.snapshot
    }));

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = lastTickAt ? (now - lastTickAt) / 1000 : TICK_MS / 1000;
      const stateSnapshot = snapshot();
      const tickResult = advanceTick(stateSnapshot, tickLengthMinutes, elapsed);
      applyTick(tickResult);
      if (tickResult.events.length > 0) {
        tickResult.events.forEach(queueEvent);
      }
      setLastTickAt(now);
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [applyTick, isPaused, lastTickAt, queueEvent, setLastTickAt, snapshot, tickLengthMinutes]);
}
