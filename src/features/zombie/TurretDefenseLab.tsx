import { MutableRefObject, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stats } from "@react-three/drei";
import * as THREE from "three";

// -----------------------------------------------------------------------------
// Types & helpers
// -----------------------------------------------------------------------------

type Vec3 = { x: number; y: number; z: number };

type TurretMode = "gatling" | "splash" | "tesla" | "laser";

type TurretTypeId = "gatling" | "splash" | "tesla" | "laser";

type TurretSpec = {
  mode: TurretMode;
  range: number;
  fireRate?: number;
  damage?: number;
  damagePerSecond?: number;
  splashRadius?: number;
  chains?: number;
  color: string;
};

type Turret = {
  id: string;
  typeId: TurretTypeId;
  pos: Vec3;
  cooldown: number;
  lastShotTime: number;
  lastTargets: Vec3[];
};

type Zombie = {
  id: string;
  pos: Vec3;
  hp: number;
  speed: number;
};

type SimContext = {
  coreHp: number;
  spawnAccumulator: number;
  time: number;
};

const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

const isVec3Like = (v: unknown): v is Vec3 =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as Vec3).x === "number" &&
  typeof (v as Vec3).y === "number" &&
  typeof (v as Vec3).z === "number";

const distSq = (a: Vec3 | null | undefined, b: Vec3 | null | undefined) => {
  if (!isVec3Like(a) || !isVec3Like(b)) return Number.POSITIVE_INFINITY;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
};

const randomId = () => Math.random().toString(36).slice(2, 10);

// -----------------------------------------------------------------------------
// Turret + zombie definitions
// -----------------------------------------------------------------------------

const TURRET_TYPES: Record<TurretTypeId, TurretSpec> = {
  gatling: {
    mode: "gatling",
    range: 10,
    fireRate: 8,
    damage: 4,
    color: "#f97316"
  },
  splash: {
    mode: "splash",
    range: 8,
    fireRate: 1.5,
    damage: 18,
    splashRadius: 3,
    color: "#a855f7"
  },
  tesla: {
    mode: "tesla",
    range: 7,
    fireRate: 2.5,
    damage: 6,
    chains: 3,
    color: "#22d3ee"
  },
  laser: {
    mode: "laser",
    range: 12,
    damagePerSecond: 10,
    color: "#f87171"
  }
};

const CORE_POS = v3(0, 0.5, 0);
const CORE_RADIUS = 1.1;

// -----------------------------------------------------------------------------
// Normalisers
// -----------------------------------------------------------------------------

function normaliseZombie(zin: Partial<Zombie> | null | undefined): Zombie {
  const z = zin && typeof zin === "object" ? zin : {};
  const pos = isVec3Like(z.pos) ? { ...z.pos } : v3(0, 0.6, 0);
  return {
    id: typeof z.id === "string" ? z.id : randomId(),
    pos,
    hp: typeof z.hp === "number" ? z.hp : 40,
    speed: typeof z.speed === "number" ? z.speed : 2
  };
}

function normaliseTurret(tin: Partial<Turret> | null | undefined): Turret {
  const t = tin && typeof tin === "object" ? tin : {};
  const pos = isVec3Like(t.pos) ? { ...t.pos } : v3(0, 0.5, 0);
  const typeId: TurretTypeId =
    typeof t.typeId === "string" && t.typeId in TURRET_TYPES
      ? (t.typeId as TurretTypeId)
      : "gatling";
  return {
    id: typeof t.id === "string" ? t.id : randomId(),
    typeId,
    pos,
    cooldown: typeof t.cooldown === "number" ? t.cooldown : 0,
    lastShotTime: typeof t.lastShotTime === "number" ? t.lastShotTime : 0,
    lastTargets: Array.isArray(t.lastTargets)
      ? t.lastTargets.filter(isVec3Like)
      : []
  };
}

function spawnZombie(): Zombie {
  const radius = 16;
  const angle = Math.random() * Math.PI * 2;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  return {
    id: randomId(),
    pos: v3(x, 0.6, z),
    hp: 40 + Math.random() * 20,
    speed: 2 + Math.random() * 0.5
  };
}

// -----------------------------------------------------------------------------
// Simulation
// -----------------------------------------------------------------------------

function simulateStep(
  zombiesIn: Zombie[],
  turretsIn: Turret[],
  delta: number,
  ctxIn: SimContext
): { zombies: Zombie[]; turrets: Turret[]; ctx: SimContext } {
  const zombies = (Array.isArray(zombiesIn) ? zombiesIn : []).map(normaliseZombie);
  const turrets = (Array.isArray(turretsIn) ? turretsIn : []).map(normaliseTurret);

  const ctx: SimContext = {
    coreHp:
      ctxIn && typeof ctxIn.coreHp === "number" && Number.isFinite(ctxIn.coreHp)
        ? ctxIn.coreHp
        : 100,
    spawnAccumulator: ctxIn?.spawnAccumulator ?? 0,
    time: ctxIn?.time ?? 0
  };

  ctx.time += delta;

  // 1) Move zombies toward core & handle core damage
  const coreHpLossPerHit = 12;
  let coreHp = ctx.coreHp;

  for (const z of zombies) {
    if (!isVec3Like(z.pos)) continue;

    const dx = CORE_POS.x - z.pos.x;
    const dz = CORE_POS.z - z.pos.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    const vx = dx / d;
    const vz = dz / d;
    z.pos.x += vx * z.speed * delta;
    z.pos.z += vz * z.speed * delta;

    const d2 = distSq(z.pos, CORE_POS);
    if (d2 <= CORE_RADIUS * CORE_RADIUS) {
      z.hp = 0;
      coreHp = Math.max(0, coreHp - coreHpLossPerHit);
    }
  }

  ctx.coreHp = coreHp;

  const alive = zombies.filter((z) => z.hp > 0 && isVec3Like(z.pos));

  // 2) Turret targeting & fire
  for (const turret of turrets) {
    const spec = TURRET_TYPES[turret.typeId];
    if (!spec || !isVec3Like(turret.pos)) continue;

    turret.cooldown = Math.max(0, turret.cooldown - delta);
    const rangeSq = spec.range * spec.range;

    const inRange = alive.filter(
      (z) => isVec3Like(z.pos) && distSq(z.pos, turret.pos) <= rangeSq && z.hp > 0
    );
    if (!inRange.length) continue;

    if (spec.mode === "laser" && spec.damagePerSecond) {
      let nearest = inRange[0];
      let best = distSq(nearest.pos, turret.pos);
      for (let i = 1; i < inRange.length; i++) {
        const d2 = distSq(inRange[i].pos, turret.pos);
        if (d2 < best) {
          best = d2;
          nearest = inRange[i];
        }
      }
      nearest.hp -= spec.damagePerSecond * delta;
      turret.lastShotTime = ctx.time;
      turret.lastTargets = [v3(nearest.pos.x, nearest.pos.y, nearest.pos.z)];
      continue;
    }

    if (turret.cooldown > 0) continue;

    let nearest = inRange[0];
    let best = distSq(nearest.pos, turret.pos);
    for (let i = 1; i < inRange.length; i++) {
      const d2 = distSq(inRange[i].pos, turret.pos);
      if (d2 < best) {
        best = d2;
        nearest = inRange[i];
      }
    }

    const hitPositions: Vec3[] = [];

    if (spec.mode === "gatling" && spec.damage) {
      nearest.hp -= spec.damage;
      hitPositions.push(v3(nearest.pos.x, nearest.pos.y, nearest.pos.z));
    } else if (spec.mode === "splash" && spec.damage) {
      const rSq = (spec.splashRadius ?? 2.5) ** 2;
      for (const z of alive) {
        if (!isVec3Like(z.pos)) continue;
        if (distSq(z.pos, nearest.pos) <= rSq) {
          z.hp -= spec.damage;
          hitPositions.push(v3(z.pos.x, z.pos.y, z.pos.z));
        }
      }
    } else if (spec.mode === "tesla" && spec.damage) {
      const chains = spec.chains ?? 3;
      const sorted = [...inRange].sort(
        (a, b) => distSq(a.pos, turret.pos) - distSq(b.pos, turret.pos)
      );
      for (let i = 0; i < Math.min(chains, sorted.length); i++) {
        const z = sorted[i];
        z.hp -= spec.damage;
        hitPositions.push(v3(z.pos.x, z.pos.y, z.pos.z));
      }
    }

    if (spec.mode !== "laser" && spec.fireRate) {
      turret.cooldown += 1 / spec.fireRate;
    }
    turret.lastShotTime = ctx.time;
    turret.lastTargets = hitPositions;
  }

  const survivors = alive.filter((z) => z.hp > 0 && isVec3Like(z.pos));

  // 3) Spawn zombies
  ctx.spawnAccumulator += delta;
  const spawnInterval = 2.2;
  while (ctx.spawnAccumulator >= spawnInterval) {
    ctx.spawnAccumulator -= spawnInterval;
    survivors.push(normaliseZombie(spawnZombie()));
  }

  return { zombies: survivors, turrets, ctx };
}

// -----------------------------------------------------------------------------
// Scene components
// -----------------------------------------------------------------------------

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="#111827" />
    </mesh>
  );
}

function Core({ hp }: { hp: number }) {
  const color = hp > 60 ? "#4ade80" : hp > 30 ? "#fbbf24" : "#f97373";
  return (
    <group position={[CORE_POS.x, CORE_POS.y, CORE_POS.z]}>
      <mesh receiveShadow castShadow>
        <cylinderGeometry args={[0.8, 0.8, 1.2, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

function ZombieMesh({ zombie }: { zombie: Zombie }) {
  const p = isVec3Like(zombie?.pos) ? zombie.pos : v3(0, 0.6, 0);
  return (
    <mesh position={[p.x, p.y, p.z]} castShadow>
      <boxGeometry args={[0.6, 1.2, 0.6]} />
      <meshStandardMaterial color="#22c55e" />
    </mesh>
  );
}

function TurretMesh({ turret }: { turret: Turret }) {
  const safeTurret = normaliseTurret(turret);
  const spec = TURRET_TYPES[safeTurret.typeId] || TURRET_TYPES.gatling;
  const groupRef = useRef<THREE.Group | null>(null);

  const hasTargets = Array.isArray(safeTurret.lastTargets) && safeTurret.lastTargets.length > 0;
  const showBeam = hasTargets && safeTurret.lastShotTime > 0;

  useFrame(() => {
    if (!groupRef.current || !hasTargets) return;
    const basePos = isVec3Like(safeTurret.pos) ? safeTurret.pos : CORE_POS;
    const tposRaw = safeTurret.lastTargets[0];
    const tpos = isVec3Like(tposRaw) ? tposRaw : basePos;

    const dx = tpos.x - basePos.x;
    const dz = tpos.z - basePos.z;
    const angle = Math.atan2(dx, dz);
    groupRef.current.rotation.y = angle;
  });

  const color = spec.color;
  const basePos = isVec3Like(safeTurret.pos) ? safeTurret.pos : v3(0, 0.5, 0);

  return (
    <group ref={groupRef} position={[basePos.x, basePos.y, basePos.z]}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.5, 12]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[0.2, 0.2, 0.9]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {showBeam &&
        safeTurret.lastTargets.map((tposRaw, idx) => {
          const tp = isVec3Like(tposRaw) ? tposRaw : basePos;
          return (
            <Line
              key={idx}
              points={[
                new THREE.Vector3(0, 0.7, 0),
                new THREE.Vector3(tp.x - basePos.x, tp.y - basePos.y, tp.z - basePos.z)
              ]}
              color={color}
              lineWidth={2}
            />
          );
        })}
    </group>
  );
}

// -----------------------------------------------------------------------------
// Scene wrapper driving the simulation loop
// -----------------------------------------------------------------------------

function TurretDefenseScene({
  turretsView,
  zombiesView,
  coreHpView,
  runningRef,
  zombiesRef,
  turretsRef,
  ctxRef,
  syncAccumulatorRef,
  setZombiesView,
  setTurretsView,
  setCoreHpView
}: {
  turretsView: Turret[];
  zombiesView: Zombie[];
  coreHpView: number;
  runningRef: MutableRefObject<boolean>;
  zombiesRef: MutableRefObject<Zombie[]>;
  turretsRef: MutableRefObject<Turret[]>;
  ctxRef: MutableRefObject<SimContext>;
  syncAccumulatorRef: MutableRefObject<number>;
  setZombiesView: (z: Zombie[]) => void;
  setTurretsView: (t: Turret[]) => void;
  setCoreHpView: (hp: number) => void;
}) {
  useFrame((_, delta) => {
    if (!runningRef.current) return;

    const step = simulateStep(zombiesRef.current, turretsRef.current, delta, ctxRef.current);

    zombiesRef.current = step.zombies;
    turretsRef.current = step.turrets;
    ctxRef.current = step.ctx;

    if (ctxRef.current.coreHp <= 0) {
      ctxRef.current.coreHp = 0;
      runningRef.current = false;
    }

    syncAccumulatorRef.current += delta;
    if (syncAccumulatorRef.current >= 0.05) {
      syncAccumulatorRef.current = 0;
      setZombiesView([...zombiesRef.current]);
      setTurretsView([...turretsRef.current]);
      setCoreHpView(ctxRef.current.coreHp);
    }
  });

  return (
    <>
      <color attach="background" args={["#020617"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 10, 4]} intensity={1.3} castShadow />

      <Ground />
      <Core hp={coreHpView} />

      {turretsView.map((t) => (
        <TurretMesh key={t.id} turret={t} />
      ))}

      {zombiesView.map((z) => (
        <ZombieMesh key={z.id} zombie={z} />
      ))}

      <Html position={[0, 3.2, 0]} center>
        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(15,23,42,0.85)",
            border: "1px solid rgba(148,163,184,0.8)",
            fontSize: 12,
            whiteSpace: "nowrap"
          }}
        >
          Core HP: {Math.round(coreHpView)} {coreHpView <= 0 ? "(breached)" : ""}
        </div>
      </Html>

      <OrbitControls enablePan enableZoom enableRotate />
      <Stats />
    </>
  );
}

// -----------------------------------------------------------------------------
// Gearbase helpers
// -----------------------------------------------------------------------------

const makeInitialTurrets = (types?: TurretTypeId[]): Turret[] => {
  const h = 0.5;
  const r = 6;
  const positions = [v3(0, h, r), v3(0, h, -r), v3(r, h, 0), v3(-r, h, 0)];
  const fallbackTypes: TurretTypeId[] = ["gatling", "splash", "tesla", "laser"];
  const typeList = types && types.length === positions.length ? types : fallbackTypes;
  return positions.map((pos, idx) =>
    normaliseTurret({
      id: randomId(),
      typeId: typeList[idx],
      pos,
      cooldown: 0,
      lastShotTime: 0,
      lastTargets: []
    })
  );
};

function GearbasePanel({ loadout, onChange }: { loadout: TurretTypeId[]; onChange: (types: TurretTypeId[]) => void }) {
  const slots = ["North", "South", "East", "West"] as const;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "8px"
      }}
    >
      {slots.map((slot, idx) => (
        <label
          key={slot}
          style={{
            display: "grid",
            gap: 6,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(110,150,200,0.25)",
            background: "rgba(14,18,28,0.7)"
          }}
        >
          <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>{slot} Gearbase</span>
          <select
            value={loadout[idx]}
            onChange={(event) => {
              const next = [...loadout];
              next[idx] = event.target.value as TurretTypeId;
              onChange(next);
            }}
            style={{
              borderRadius: 8,
              border: "1px solid rgba(120,160,220,0.35)",
              background: "rgba(12,18,28,0.9)",
              color: "#cfe0ff",
              padding: "6px 8px"
            }}
          >
            {Object.entries(TURRET_TYPES).map(([id, spec]) => (
              <option key={id} value={id}>
                {id.toUpperCase()} — {spec.mode}
              </option>
            ))}
          </select>
          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
            Range {TURRET_TYPES[loadout[idx]].range} / Damage
            {" "}
            {TURRET_TYPES[loadout[idx]].damage ?? TURRET_TYPES[loadout[idx]].damagePerSecond ?? "?"}
          </span>
        </label>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main wrapper
// -----------------------------------------------------------------------------

export function TurretDefenseLab() {
  const [zombiesView, setZombiesView] = useState<Zombie[]>([]);
  const [turretsView, setTurretsView] = useState<Turret[]>(() => makeInitialTurrets());
  const [coreHpView, setCoreHpView] = useState(100);
  const [gearbase, setGearbase] = useState<TurretTypeId[]>([
    "gatling",
    "splash",
    "tesla",
    "laser"
  ]);

  const zombiesRef = useRef<Zombie[]>([]);
  const turretsRef = useRef<Turret[]>(makeInitialTurrets());
  const ctxRef = useRef<SimContext>({ coreHp: 100, spawnAccumulator: 0, time: 0 });
  const runningRef = useRef(true);
  const syncAccumulatorRef = useRef(0);

  useEffect(() => {
    setTurretsView([...turretsRef.current]);
  }, []);

  useEffect(() => {
    const typed: TurretTypeId[] = gearbase.slice(0, 4).map((id) => (id in TURRET_TYPES ? id : "gatling")) as TurretTypeId[];
    const nextTurrets = makeInitialTurrets(typed);
    turretsRef.current = nextTurrets;
    zombiesRef.current = [];
    ctxRef.current = { coreHp: 100, spawnAccumulator: 0, time: 0 };
    runningRef.current = true;
    setZombiesView([]);
    setTurretsView([...nextTurrets]);
    setCoreHpView(ctxRef.current.coreHp);
  }, [gearbase]);

  const resetScenario = () => {
    zombiesRef.current = [];
    turretsRef.current = makeInitialTurrets(gearbase);
    ctxRef.current = { coreHp: 100, spawnAccumulator: 0, time: 0 };
    runningRef.current = true;
    setZombiesView([]);
    setTurretsView([...turretsRef.current]);
    setCoreHpView(100);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "300px 1fr",
        gap: 12,
        alignItems: "start"
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 10,
          padding: 12,
          borderRadius: 14,
          border: "1px solid rgba(80,110,170,0.35)",
          background: "rgba(12,18,28,0.85)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Gearbase</h3>
          <button
            type="button"
            onClick={resetScenario}
            style={{
              marginLeft: "auto",
              padding: "6px 10px",
              borderRadius: 10,
              background: "rgba(30,41,59,0.75)",
              border: "1px solid rgba(80,120,200,0.4)",
              color: "#c7d7ff",
              cursor: "pointer"
            }}
          >
            Reset Simulation
          </button>
        </div>
        <p style={{ margin: 0, opacity: 0.72, fontSize: "0.9rem" }}>
          Tune turret loadouts per quadrant. Adjusting the gearbase resets the wave model so you
          can iterate quickly without stale state.
        </p>
        <GearbasePanel loadout={gearbase} onChange={setGearbase} />
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(80,120,200,0.25)",
            background: "rgba(10,16,28,0.7)",
            display: "grid",
            gap: 6,
            fontSize: "0.9rem"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ opacity: 0.7 }}>Core HP</span>
            <strong>{Math.round(coreHpView)}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ opacity: 0.7 }}>Active turrets</span>
            <strong>{turretsView.length}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ opacity: 0.7 }}>Zombies on field</span>
            <strong>{zombiesView.length}</strong>
          </div>
        </div>
      </div>
      <div
        style={{
          position: "relative",
          borderRadius: 14,
          border: "1px solid rgba(70,100,160,0.35)",
          background: "rgba(4,6,12,0.85)",
          overflow: "hidden"
        }}
      >
        <Canvas shadows camera={{ position: [0, 12, 16], fov: 50 }} gl={{ antialias: true }}>
          <TurretDefenseScene
            turretsView={turretsView}
            zombiesView={zombiesView}
            coreHpView={coreHpView}
            runningRef={runningRef}
            zombiesRef={zombiesRef}
            turretsRef={turretsRef}
            ctxRef={ctxRef}
            syncAccumulatorRef={syncAccumulatorRef}
            setZombiesView={setZombiesView}
            setTurretsView={setTurretsView}
            setCoreHpView={setCoreHpView}
          />
        </Canvas>
      </div>
    </div>
  );
}

export default TurretDefenseLab;
