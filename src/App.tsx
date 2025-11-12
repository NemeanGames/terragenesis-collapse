import { useEffect } from "react";
import World3DMap from "./components/World3DMap";
import { useGameStore } from "./state/gameState";
import { useSimulation } from "./simulation/useSimulation";
import StatsPanel from "./components/StatsPanel";
import ActionsPanel from "./components/ActionsPanel";
import SurvivorsPanel from "./components/SurvivorsPanel";
import EventLogPanel from "./components/EventLogPanel";

function App() {
  const init = useGameStore((s) => s.initializeFromStorage);
  useEffect(() => {
    init();
  }, [init]);

  useSimulation();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "340px 1fr 320px",
        gridTemplateRows: "auto 1fr",
        height: "100%",
        gap: "12px",
        padding: "12px",
        background: "transparent"
      }}
    >
      <header
        style={{
          gridColumn: "1 / span 3",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 18px",
          borderRadius: "16px",
          background: "linear-gradient(135deg, rgba(46,63,90,0.65), rgba(15,27,46,0.85))",
          border: "1px solid rgba(97,140,255,0.2)",
          boxShadow: "0 24px 40px rgba(0,0,0,0.35)"
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 600 }}>TerraGenesis Collapse</h1>
          <p style={{ margin: 0, opacity: 0.72, fontSize: "0.95rem" }}>
            Reclaim the zone, balance the habitat, and keep the horde at bay.
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <SaveIndicator />
        </div>
      </header>

      <aside style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <StatsPanel />
        <ActionsPanel />
      </aside>

      <section
        style={{
          position: "relative",
          borderRadius: "16px",
          overflow: "hidden",
          border: "1px solid rgba(80,115,200,0.25)",
          background: "rgba(8,10,15,0.7)",
          minHeight: 600
        }}
      >
        <World3DMap />
      </section>

      <aside style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <SurvivorsPanel />
        <EventLogPanel />
      </aside>
    </div>
  );
}

function SaveIndicator() {
  const { lastSavedAt, isSaving, saveToStorage } = useGameStore((state) => ({
    lastSavedAt: state.lastSavedAt,
    isSaving: state.isSaving,
    saveToStorage: state.saveToStorage
  }));

  useEffect(() => {
    const onBeforeUnload = () => saveToStorage();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveToStorage]);

  const label = isSaving
    ? "Saving..."
    : lastSavedAt
    ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
    : "Unsaved";

  return (
    <button
      onClick={saveToStorage}
      style={{
        borderRadius: "9999px",
        border: "1px solid rgba(88,166,255,0.4)",
        background: "rgba(17,25,40,0.8)",
        padding: "6px 16px",
        color: "#9cc9ff",
        fontSize: "0.85rem"
      }}
    >
      {label}
    </button>
  );
}

export default App;
