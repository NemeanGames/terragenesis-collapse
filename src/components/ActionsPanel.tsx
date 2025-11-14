import { FACILITIES } from "../features/facilities/data";
import { PROJECT_LIBRARY } from "../features/facilities/projects";
import { useGameStore } from "../state/gameState";
import type { ResourceKey } from "../state/types";

function formatCost(cost: Partial<Record<ResourceKey, number>>) {
  return (Object.entries(cost) as [ResourceKey, number][])
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}

export default function ActionsPanel() {
  const {
    resources,
    facilities,
    activeProjects,
    buildFacility,
    startProject,
    showRivers,
    showSprites,
    showRoads,
    toggleLayer,
    worldSeed,
    setWorldSeed,
    regenerateSeed,
    elevScale,
    setElevScale,
    enablePhysarumWorld,
    enablePhysarumCells,
    togglePhysarumFeature,
    showPhysarumConductance,
    showPhysarumSkeleton,
    showPhysarumRoads,
    togglePhysarumOverlay,
    physarumParams,
    setPhysarumParam,
    physarumWorldPlan
  } = useGameStore((state) => ({
    resources: state.resources,
    facilities: state.facilities,
    activeProjects: state.activeProjects,
    buildFacility: state.buildFacility,
    startProject: state.startProject,
    showRivers: state.showRivers,
    showSprites: state.showSprites,
    showRoads: state.showRoads,
    toggleLayer: state.toggleLayer,
    worldSeed: state.worldSeed,
    setWorldSeed: state.setWorldSeed,
    regenerateSeed: state.regenerateSeed,
    elevScale: state.elevScale,
    setElevScale: state.setElevScale,
    enablePhysarumWorld: state.enablePhysarumWorld,
    enablePhysarumCells: state.enablePhysarumCells,
    togglePhysarumFeature: state.togglePhysarumFeature,
    showPhysarumConductance: state.showPhysarumConductance,
    showPhysarumSkeleton: state.showPhysarumSkeleton,
    showPhysarumRoads: state.showPhysarumRoads,
    togglePhysarumOverlay: state.togglePhysarumOverlay,
    physarumParams: state.physarumParams,
    setPhysarumParam: state.setPhysarumParam,
    physarumWorldPlan: state.physarumWorldPlan
  }));

  const facilityCount = new Map(facilities.map((f) => [f.id, f.count]));

  return (
    <div
      style={{
        background: "rgba(14,20,30,0.82)",
        borderRadius: 16,
        padding: "16px 18px",
        border: "1px solid rgba(59,130,246,0.18)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        boxShadow: "0 10px 28px rgba(0,0,0,0.35)"
      }}
    >
      <section>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Build Facilities</h3>
        <p style={{ marginTop: 4, opacity: 0.65, fontSize: "0.85rem" }}>
          Spend resources to expand camp infrastructure.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FACILITIES.map((facility) => {
            const owned = facilityCount.get(facility.id) ?? 0;
            const affordable = (Object.entries(facility.cost) as [ResourceKey, number][]).every(
              ([key, value]) => (resources[key] ?? 0) >= value
            );
            return (
              <button
                key={facility.id}
                onClick={() => buildFacility(facility.id)}
                disabled={!affordable}
                style={{
                  textAlign: "left",
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: affordable ? "rgba(37, 99, 235, 0.18)" : "rgba(15, 23, 42, 0.6)",
                  color: "inherit",
                  padding: "10px 12px",
                  opacity: affordable ? 1 : 0.5
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                  <span>{facility.name}</span>
                  <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>x{owned}</span>
                </div>
                <p style={{ margin: "4px 0", fontSize: "0.85rem", opacity: 0.7 }}>{facility.description}</p>
                <small style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                  Cost: {formatCost(facility.cost)}
                </small>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Launch Projects</h3>
        <p style={{ marginTop: 4, opacity: 0.65, fontSize: "0.85rem" }}>
          Strategic initiatives that deliver large boosts after completion.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PROJECT_LIBRARY.map((project) => {
            const active = activeProjects.some((p) => p.name === project.name);
            return (
              <button
                key={project.id}
                onClick={() => startProject(project.id)}
                disabled={active}
                style={{
                  textAlign: "left",
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: active ? "rgba(107,114,128,0.18)" : "rgba(34,197,94,0.18)",
                  color: "inherit",
                  padding: "10px 12px",
                  opacity: active ? 0.6 : 1
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                  <span>{project.name}</span>
                  <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>{project.totalHours}h</span>
                </div>
                <p style={{ margin: "4px 0", fontSize: "0.85rem", opacity: 0.7 }}>
                  Reward packages resources, morale and environmental boosts.
                </p>
              </button>
            );
          })}
        </div>
        {activeProjects.length > 0 && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(15,23,42,0.65)",
              border: "1px solid rgba(148,163,184,0.18)",
              fontSize: "0.85rem"
            }}
          >
            <h4 style={{ marginTop: 0, marginBottom: 8 }}>Active Projects</h4>
            {activeProjects.map((project) => (
              <div key={project.id} style={{ marginBottom: 6 }}>
                <strong>{project.name}</strong>
                <div style={{ fontVariantNumeric: "tabular-nums", opacity: 0.7 }}>
                  {project.remainingHours.toFixed(1)}h remaining
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>World Controls</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem" }}>
            Seed
            <input
              type="number"
              value={worldSeed}
              onChange={(event) => setWorldSeed(Number(event.target.value) || 0)}
              style={{
                background: "rgba(15,23,42,0.6)",
                border: "1px solid rgba(59,130,246,0.25)",
                borderRadius: 8,
                padding: "6px 8px",
                color: "inherit"
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem" }}>
            Elevation scale
            <input
              type="range"
              min={10}
              max={60}
              value={elevScale}
              onChange={(event) => setElevScale(Number(event.target.value))}
            />
          </label>
          <button
            onClick={regenerateSeed}
            style={{
              borderRadius: 9999,
              border: "1px solid rgba(148,163,184,0.18)",
              background: "rgba(59,130,246,0.2)",
              padding: "6px 12px",
              color: "inherit"
            }}
          >
            Regenerate terrain
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem" }}>
            <label>
              <input
                type="checkbox"
                checked={showRivers}
                onChange={() => toggleLayer("rivers")}
                style={{ marginRight: 6 }}
              />
              Rivers
            </label>
            <label>
              <input
                type="checkbox"
                checked={showSprites}
                onChange={() => toggleLayer("sprites")}
                style={{ marginRight: 6 }}
              />
              Landmarks
            </label>
            <label>
              <input
                type="checkbox"
                checked={showRoads}
                onChange={() => toggleLayer("roads")}
                style={{ marginRight: 6 }}
              />
              Roads
            </label>
          </div>
        </div>
      </section>

      <section>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Physarum Planner</h3>
        <p style={{ marginTop: 4, opacity: 0.65, fontSize: "0.85rem" }}>
          Organic trail carving for world roads and cell overlays. All outputs are feature-flagged and
          safe to disable.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
            <input
              type="checkbox"
              checked={enablePhysarumWorld}
              onChange={() => togglePhysarumFeature("world")}
            />
            Enable world Physarum planner
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
            <input
              type="checkbox"
              checked={enablePhysarumCells}
              onChange={() => togglePhysarumFeature("cells")}
            />
            Enable cell Physarum overlays
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
              <input
                type="checkbox"
                checked={showPhysarumConductance}
                onChange={() => togglePhysarumOverlay("conductance")}
              />
              Conductance heatmap
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
              <input
                type="checkbox"
                checked={showPhysarumSkeleton}
                onChange={() => togglePhysarumOverlay("skeleton")}
              />
              Skeleton overlay
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
              <input
                type="checkbox"
                checked={showPhysarumRoads}
                onChange={() => togglePhysarumOverlay("roads")}
              />
              Physarum roads
            </label>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.8rem" }}>
            Iterations ({physarumParams.iterations})
            <input
              type="range"
              min={120}
              max={1200}
              step={20}
              value={physarumParams.iterations}
              onChange={(event) => setPhysarumParam("iterations", Number(event.target.value))}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.8rem" }}>
            Diffusion ({physarumParams.diffusionRate.toFixed(2)})
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={physarumParams.diffusionRate}
              onChange={(event) => setPhysarumParam("diffusionRate", Number(event.target.value))}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.8rem" }}>
            Evaporation ({physarumParams.evaporationRate.toFixed(3)})
            <input
              type="range"
              min={0}
              max={0.2}
              step={0.005}
              value={physarumParams.evaporationRate}
              onChange={(event) => setPhysarumParam("evaporationRate", Number(event.target.value))}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.8rem" }}>
            Threshold ({physarumParams.threshold.toFixed(2)})
            <input
              type="range"
              min={0.1}
              max={1.5}
              step={0.05}
              value={physarumParams.threshold}
              onChange={(event) => setPhysarumParam("threshold", Number(event.target.value))}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.8rem" }}>
            Max detour factor ({physarumParams.maxDetourFactor.toFixed(2)})
            <input
              type="range"
              min={1}
              max={4}
              step={0.1}
              value={physarumParams.maxDetourFactor}
              onChange={(event) => setPhysarumParam("maxDetourFactor", Number(event.target.value))}
            />
          </label>
          <div
            style={{
              fontSize: "0.8rem",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(59,130,246,0.16)",
              background: "rgba(15,23,42,0.55)",
              display: "flex",
              justifyContent: "space-between"
            }}
          >
            <span>Status:</span>
            {physarumWorldPlan ? (
              <span>
                {physarumWorldPlan.iterations} it · {physarumWorldPlan.converged ? "converged" : "active"}
              </span>
            ) : (
              <span>inactive</span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
