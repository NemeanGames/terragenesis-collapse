import { useMemo } from "react";
import { useGameStore } from "../../state/gameState";
import {
  diamondSquare,
  makeRng,
  sampleHeight,
  GRID,
  ELEV_BANDS
} from "../../world/terrain/heightmap";
import { buildRivers } from "../../world/terrain/rivers";
import { sampleSeeds } from "../../world/terrain/seeds";
import { buildKnnEdges } from "../../world/terrain/roads";

const format = new Intl.NumberFormat();

export default function ZombieWorldGame() {
  const {
    worldSeed,
    zombieSurvivors,
    zombieFood,
    zombieWater,
    zombieHostility,
    gainZombieResource,
    spendZombieResource,
    setZombieHostility
  } = useGameStore((state) => ({
    worldSeed: state.worldSeed,
    zombieSurvivors: state.zombieSurvivors,
    zombieFood: state.zombieFood,
    zombieWater: state.zombieWater,
    zombieHostility: state.zombieHostility,
    gainZombieResource: state.gainZombieResource,
    spendZombieResource: state.spendZombieResource,
    setZombieHostility: state.setZombieHostility
  }));

  const rng = useMemo(() => makeRng((worldSeed ^ 0x5f3759df) >>> 0), [worldSeed]);
  const height = useMemo(() => diamondSquare(6, 0.64, rng), [rng]);
  const rivers = useMemo(() => buildRivers(height, { count: 48, minLen: 18, rng }), [height, rng]);
  const seeds = useMemo(() => sampleSeeds(48, 10, rng), [rng]);
  const roadEdges = useMemo(() => buildKnnEdges(seeds, 4), [seeds]);
  const viableShelters = useMemo(
    () =>
      seeds.filter((seed) => {
        const z = sampleHeight(height, seed.x, seed.y);
        return z > ELEV_BANDS.WATER + 0.12;
      }).length,
    [height, seeds]
  );

  const highGround = useMemo(() => {
    let total = 0;
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (height[y][x] > ELEV_BANDS.HIGH) total++;
      }
    }
    return Math.round((total / (GRID * GRID)) * 100);
  }, [height]);

  const onForage = (resource: "food" | "water") => {
    gainZombieResource(resource, 6 + Math.floor(Math.random() * 4));
    setZombieHostility(zombieHostility + (resource === "food" ? 1 : 0.5));
  };

  const onRecruit = () => {
    if (zombieFood < 8 || zombieWater < 6) return;
    spendZombieResource("food", 8);
    spendZombieResource("water", 6);
    gainZombieResource("survivors", 3);
    setZombieHostility(zombieHostility + 2);
  };

  const actionButtonStyle = {
    borderRadius: "12px",
    border: "1px solid rgba(120,150,220,0.3)",
    background: "rgba(24,34,52,0.85)",
    color: "#9cc9ff",
    padding: "8px 14px",
    fontSize: "0.85rem",
    cursor: "pointer"
  } as const;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr",
        gap: "16px",
        height: "100%"
      }}
    >
      <section
        style={{
          padding: "16px",
          borderRadius: "16px",
          background: "rgba(18,25,42,0.78)",
          border: "1px solid rgba(97,140,255,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}
      >
        <header>
          <h2 style={{ margin: 0 }}>Zombie Outpost</h2>
          <p style={{ margin: "4px 0 0", opacity: 0.75 }}>
            Survey the rogue sector and keep the enclave supplied.
          </p>
        </header>
        <div style={{ display: "grid", gap: "12px" }}>
          <Metric label="Survivors" value={format.format(zombieSurvivors)} />
          <Metric label="Food" value={`${format.format(zombieFood)} units`} />
          <Metric label="Water" value={`${format.format(zombieWater)} liters`} />
          <Metric label="Hostility" value={`${Math.round(zombieHostility)} / 100`} />
          <Metric label="Viable Shelters" value={viableShelters.toString()} />
          <Metric label="Rivers Charted" value={rivers.length.toString()} />
          <Metric label="Road Links" value={roadEdges.length.toString()} />
          <Metric label="High Ground" value={`${highGround}% of sector`} />
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button style={actionButtonStyle} onClick={() => onForage("food")}>
            Forage Food
          </button>
          <button style={actionButtonStyle} onClick={() => onForage("water")}>
            Collect Water
          </button>
          <button
            style={{
              ...actionButtonStyle,
              opacity: zombieFood < 8 || zombieWater < 6 ? 0.6 : 1,
              cursor: zombieFood < 8 || zombieWater < 6 ? "not-allowed" : "pointer"
            }}
            onClick={onRecruit}
            disabled={zombieFood < 8 || zombieWater < 6}
          >
            Recruit Nomads
          </button>
          <button
            style={actionButtonStyle}
            onClick={() => setZombieHostility(Math.max(0, zombieHostility - 4))}
          >
            Calm Horde
          </button>
        </div>
        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>Horde Pressure</span>
          <input
            type="range"
            min={0}
            max={100}
            value={zombieHostility}
            onChange={(event) => setZombieHostility(Number(event.target.value))}
          />
        </label>
      </section>
      <section
        style={{
          padding: "16px",
          borderRadius: "16px",
          background: "rgba(8,10,16,0.72)",
          border: "1px solid rgba(60,90,150,0.35)",
          overflowY: "auto"
        }}
      >
        <h3 style={{ marginTop: 0 }}>Reconnaissance Notes</h3>
        <ul style={{ lineHeight: 1.5, opacity: 0.85 }}>
          <li>Sector seed: {worldSeed}</li>
          <li>{rivers.length} river basins connect into adjacent floodplains.</li>
          <li>{roadEdges.length} road spines link safe seeds for caravan routes.</li>
          <li>{viableShelters} plateaus suitable for temporary shelters.</li>
          <li>{highGround}% of sampled terrain sits above upland thresholds.</li>
        </ul>
        <p style={{ opacity: 0.7 }}>
          Shared terrain helpers power this slice, so adjustments to the 3D world propagate here
          automatically.
        </p>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: "0.95rem",
        padding: "8px 12px",
        borderRadius: "12px",
        background: "rgba(9,12,20,0.7)",
        border: "1px solid rgba(70,110,180,0.25)"
      }}
    >
      <span style={{ opacity: 0.75 }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
