import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../state/gameState";
import {
  GRID,
  SIZE,
  ELEV_BANDS,
  makeRng,
  diamondSquare,
  sampleHeight,
  buildTerrainMesh,
  clamp
} from "../world/terrain/heightmap";
import { buildRivers, buildRiversGroup } from "../world/terrain/rivers";
import { sampleSeeds } from "../world/terrain/seeds";
import { buildKnnEdges, mstKruskal, buildRoadsGroup } from "../world/terrain/roads";
import { analyzeRegion } from "../world/terrain/regions";
import { worldToAxial, hashAxial } from "../world/hex";
import { generateRegionPois, deriveRegionGates } from "../world/regions/poi";
import type { RegionDetail, RegionCategory } from "../state/types";
import type { PhysarumPlan } from "../roads/types";

const SEEDS = 160;
const MIN_DIST = 24;
const KNN = 6;
const URBAN_HEX_SIZE = 18;

function makeEmojiTexture(emoji: string, size = 128) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.floor(size * 0.78)}px system-ui, Apple Color Emoji, Segoe UI Emoji`;
  ctx.fillText(emoji, size / 2, size / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function buildSpritesGroup(
  sprites: { x: number; y: number; emoji: string }[],
  height: Float32Array[],
  scaleY: number
) {
  const group = new THREE.Group();
  for (const p of sprites) {
    const map = makeEmojiTexture(p.emoji, 256);
    const mat = new THREE.SpriteMaterial({ map, depthWrite: false, transparent: true });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(2.4, 2.4, 2.4);
    spr.position.set(p.x - SIZE / 2, sampleHeight(height, p.x, p.y) * scaleY + 1.2, p.y - SIZE / 2);
    group.add(spr);
  }
  return group;
}

function buildConductanceOverlay(plan: PhysarumPlan, height: Float32Array[], scaleY: number) {
  const width = plan.field.width;
  const heightCells = plan.field.height;
  if (width < 2 || heightCells < 2) return null;
  let maxValue = 0;
  for (const value of plan.field.data) {
    if (value > maxValue) maxValue = value;
  }
  if (maxValue <= 0) return null;
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, width - 1, heightCells - 1);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(width * heightCells * 3);
  const color = new THREE.Color();
  let colorIndex = 0;
  const stepX = SIZE / (width - 1);
  const stepY = SIZE / (heightCells - 1);
  for (let y = 0; y < heightCells; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const wx = x * stepX - SIZE / 2;
      const wz = y * stepY - SIZE / 2;
      const wy = sampleHeight(height, x, y) * scaleY + 0.15;
      positions.setXYZ(idx, wx, wy, wz);
      const value = plan.field.data[idx] / maxValue;
      color.setHSL(0.55 - value * 0.4, 0.85, 0.45 + value * 0.3);
      colors[colorIndex++] = color.r;
      colors[colorIndex++] = color.g;
      colors[colorIndex++] = color.b;
    }
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.4,
    depthWrite: false
  });
  return new THREE.Mesh(geometry, material);
}

function buildPhysarumLines(
  plan: PhysarumPlan,
  height: Float32Array[],
  scaleY: number,
  color: number,
  opacity: number
) {
  const positions: number[] = [];
  for (const edge of plan.graph.edges) {
    if (edge.points.length < 2) continue;
    for (let i = 1; i < edge.points.length; i++) {
      const a = edge.points[i - 1];
      const b = edge.points[i];
      const ax = a.x - SIZE / 2;
      const ay = sampleHeight(height, a.x, a.y) * scaleY + 0.2;
      const az = a.y - SIZE / 2;
      const bx = b.x - SIZE / 2;
      const by = sampleHeight(height, b.x, b.y) * scaleY + 0.2;
      const bz = b.y - SIZE / 2;
      positions.push(ax, ay, az, bx, by, bz);
    }
  }
  if (!positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false
  });
  return new THREE.LineSegments(geometry, material);
}

function buildPhysarumRoadGroup(plan: PhysarumPlan, height: Float32Array[], scaleY: number) {
  return buildPhysarumLines(plan, height, scaleY, 0xf6cf7b, 0.8);
}

const billboardEmotes = ["🧟", "🧫", "⚡", "👻", "🏕️", "🚧", "💧", "💡", "🛡️", "🧰", "📦", "🏚️"];

function seedBillboards(height: Float32Array[], rng: () => number) {
  const count = 60;
  const pts: { x: number; y: number; emoji: string }[] = [];
  for (let i = 0; i < count; i++) {
    const x = 8 + rng() * (GRID - 16);
    const y = 8 + rng() * (GRID - 16);
    const z = sampleHeight(height, x, y);
    if (z <= ELEV_BANDS.WATER) {
      i--;
      continue;
    }
    pts.push({ x, y, emoji: billboardEmotes[(rng() * billboardEmotes.length) | 0] });
  }
  return pts;
}

function runSanityTests(
  height: Float32Array[],
  rivers: number[][][],
  sprites: { x: number; y: number; emoji: string }[],
  roadsMain: [number, number][],
  seeds: { x: number; y: number }[],
  roadsSide: [number, number][]
) {
  console.assert(height.length === GRID + 1 && height[0].length === GRID + 1, "height 257×257");
  let mn = 1;
  let mx = 0;
  for (let y = 0; y <= GRID; y++) {
    for (let x = 0; x <= GRID; x++) {
      const v = height[y][x];
      mn = Math.min(mn, v);
      mx = Math.max(mx, v);
    }
  }
  console.assert(mn >= -1e-6 && mx <= 1 + 1e-6, "height in [0,1]");
  console.assert(Number.isFinite(sampleHeight(height, 10.3, 17.7)), "sampleHeight finite");
  console.assert(Array.isArray(rivers) && rivers.length >= 1, "rivers generated");
  console.assert(Array.isArray(sprites) && sprites.length >= 1, "sprites generated");
  console.assert(Array.isArray(seeds) && seeds.length >= 40, "seeds generated");
  console.assert(Array.isArray(roadsMain) && roadsMain.length >= 1, "roads generated");
  console.assert(Array.isArray(roadsSide), "roadsSide array exists");
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((m) => m.dispose());
  } else {
    material.dispose();
  }
}

function disposeObject(obj: THREE.Object3D) {
  if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
    obj.geometry.dispose();
    if (obj.material) disposeMaterial(obj.material);
  } else if (obj instanceof THREE.Sprite) {
    disposeMaterial(obj.material);
  }
}

export default function World3DMap() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const worldGroupRef = useRef<THREE.Group | null>(null);
  const rafRef = useRef(0);
  const roRef = useRef<ResizeObserver | null>(null);
  const selectionRef = useRef<{
    height: Float32Array[];
    seeds: { x: number; y: number }[];
    worldSeed: number;
    openRegion: (detail: RegionDetail) => void;
  } | null>(null);

  const {
    worldSeed,
    elevScale,
    showRivers,
    showSprites,
    showRoads,
    enablePhysarumWorld,
    physarumWorldPlan,
    showPhysarumConductance,
    showPhysarumSkeleton,
    showPhysarumRoads,
    physarumParams,
    runPhysarumWorld,
    clearPhysarumWorld,
    openRegion
  } = useGameStore((state) => ({
    worldSeed: state.worldSeed,
    elevScale: state.elevScale,
    showRivers: state.showRivers,
    showSprites: state.showSprites,
    showRoads: state.showRoads,
    enablePhysarumWorld: state.enablePhysarumWorld,
    physarumWorldPlan: state.physarumWorldPlan,
    showPhysarumConductance: state.showPhysarumConductance,
    showPhysarumSkeleton: state.showPhysarumSkeleton,
    showPhysarumRoads: state.showPhysarumRoads,
    physarumParams: state.physarumParams,
    runPhysarumWorld: state.runPhysarumWorld,
    clearPhysarumWorld: state.clearPhysarumWorld,
    openRegion: state.openRegion
  }));

  const rng = useMemo(() => makeRng(worldSeed >>> 0), [worldSeed]);
  const height = useMemo(() => diamondSquare(8, 0.58, rng), [rng]);
  const rivers = useMemo(() => buildRivers(height, { count: 140, minLen: 40, rng }), [height, rng]);
  const sprites = useMemo(() => seedBillboards(height, rng), [height, rng]);
  const seeds = useMemo(() => sampleSeeds(SEEDS, MIN_DIST, rng), [rng]);
  const knnEdges = useMemo(() => buildKnnEdges(seeds, KNN), [seeds]);
  const roadsMain = useMemo(() => {
    const wfn = ([a, b]: [number, number]) => {
      const dx = seeds[a].x - seeds[b].x;
      const dy = seeds[a].y - seeds[b].y;
      const dist = Math.hypot(dx, dy);
      const za = sampleHeight(height, seeds[a].x, seeds[a].y);
      const zb = sampleHeight(height, seeds[b].x, seeds[b].y);
      const slope = zb - za;
      return dist * (1 + slope * slope * 4);
    };
    return mstKruskal(seeds, knnEdges, wfn);
  }, [seeds, knnEdges, height]);
  const roadsSide = useMemo(() => {
    const set = new Set(roadsMain.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
    const extras = knnEdges.filter(([a, b]) => {
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      if (set.has(key)) return false;
      const dx = seeds[a].x - seeds[b].x;
      const dy = seeds[a].y - seeds[b].y;
      return dx * dx + dy * dy < 140 * 140;
    });
    return extras.slice(0, Math.floor(roadsMain.length * 0.6));
  }, [knnEdges, roadsMain, seeds]);

  const physarumRoadEdges = useMemo(() => {
    if (!enablePhysarumWorld || !physarumWorldPlan) return null;
    const toSeedIndex = (point: { x: number; y: number }) => {
      let bestIndex = 0;
      let bestDist = Infinity;
      for (let i = 0; i < seeds.length; i++) {
        const dx = seeds[i].x - point.x;
        const dy = seeds[i].y - point.y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }
      return bestIndex;
    };
    const edges: [number, number][] = [];
    const seen = new Set<string>();
    for (const edge of physarumWorldPlan.graph.edges) {
      const start = edge.points[0];
      const end = edge.points[edge.points.length - 1];
      const a = toSeedIndex(start);
      const b = toSeedIndex(end);
      if (a === b) continue;
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([a, b]);
    }
    return edges.length ? edges : null;
  }, [enablePhysarumWorld, physarumWorldPlan, seeds]);

  const roadsMainDisplay = useMemo(() => {
    if (!physarumRoadEdges) return roadsMain;
    const base = new Set(physarumRoadEdges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
    const combined = [...physarumRoadEdges];
    for (const edge of roadsMain) {
      const key = `${Math.min(edge[0], edge[1])}-${Math.max(edge[0], edge[1])}`;
      if (!base.has(key)) combined.push(edge);
    }
    return combined;
  }, [physarumRoadEdges, roadsMain]);

  useEffect(() => {
    if (!enablePhysarumWorld) {
      clearPhysarumWorld();
      return;
    }
    runPhysarumWorld({ height, seeds });
  }, [
    enablePhysarumWorld,
    height,
    seeds,
    physarumParams,
    runPhysarumWorld,
    clearPhysarumWorld
  ]);

  useEffect(() => {
    selectionRef.current = {
      height,
      seeds,
      worldSeed,
      openRegion
    };
  }, [height, seeds, worldSeed, openRegion]);

  useEffect(() => {
    runSanityTests(height, rivers, sprites, roadsMainDisplay, seeds, roadsSide);
  }, [height, rivers, sprites, roadsMainDisplay, roadsSide, seeds]);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const initW = container.clientWidth || 1024;
    const initH = container.clientHeight || 640;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(initW, initH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if ("outputColorSpace" in renderer) {
      (renderer as THREE.WebGLRenderer & { outputColorSpace?: THREE.ColorSpace }).outputColorSpace =
        THREE.SRGBColorSpace;
    }
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0c10);
    scene.fog = new THREE.Fog(0x0b0c10, 80, 280);

    const camera = new THREE.PerspectiveCamera(55, initW / initH, 0.1, 1000);
    camera.position.set(80, 90, 120);

    const amb = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(80, 120, 40);
    scene.add(dir);

    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    worldGroupRef.current = worldGroup;

    const canvas = renderer.domElement;
    let isDown = false;
    let lastX = 0;
    let lastY = 0;
    let yaw = -0.6;
    let pitch = 0.55;
    let dist = 160;
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();

    const onDown = (e: PointerEvent) => {
      isDown = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => {
      isDown = false;
    };
    const onMove = (e: PointerEvent) => {
      if (!isDown) return;
      yaw -= (e.clientX - lastX) * 0.0025;
      pitch -= (e.clientY - lastY) * 0.0025;
      pitch = clamp(pitch, 0.05, Math.PI * 0.49);
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onWheel = (e: WheelEvent) => {
      dist = clamp(dist + e.deltaY * 0.1, 12, 260);
    };
    const onDoubleClick = (e: MouseEvent) => {
      if (!cameraRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(plane, hit)) return;
      const context = selectionRef.current;
      if (!context) return;
      const analysis = analyzeRegion({
        height: context.height,
        seeds: context.seeds,
        worldX: hit.x,
        worldZ: hit.z
      });
      if (!analysis) return;
      const axial = worldToAxial(hit.x, hit.z, URBAN_HEX_SIZE);
      const axialHash = hashAxial(axial);
      const seed = (axialHash ^ (context.worldSeed >>> 0)) >>> 0;
      const pois = generateRegionPois(seed, analysis.category, axialHash);
      const gates = deriveRegionGates(analysis.category, hit.x, hit.z, SIZE);
      const detail: RegionDetail = {
        axial,
        category: analysis.category,
        seed,
        worldPosition: [hit.x, hit.z],
        label: `${formatRegionCategory(analysis.category)} (${axial.q},${axial.r})`,
        metrics: analysis.metrics,
        gates,
        pois
      };
      context.openRegion(detail);
    };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointermove", onMove);
    canvas.addEventListener("wheel", onWheel, { passive: true });
    canvas.addEventListener("dblclick", onDoubleClick);

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(container);
    roRef.current = ro;

    const animate = () => {
      const target = new THREE.Vector3(0, 12, 0);
      const cx = Math.cos(yaw) * dist;
      const cz = Math.sin(yaw) * dist;
      const sy = Math.sin(pitch) * dist;
      const cy = Math.cos(pitch) * dist;
      camera.position.set(target.x + (cx * cy) / dist, target.y + sy, target.z + (cz * cy) / dist);
      camera.lookAt(target);
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (roRef.current) roRef.current.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("dblclick", onDoubleClick);
      if (worldGroup) {
        scene.remove(worldGroup);
        worldGroup.traverse(disposeObject);
      }
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const worldGroup = worldGroupRef.current;
    if (!scene || !worldGroup) return;

    while (worldGroup.children.length) {
      const child = worldGroup.children.pop()!;
      disposeObject(child);
    }

    const terrain = buildTerrainMesh(height, elevScale);
    worldGroup.add(terrain);

    if (showRivers) worldGroup.add(buildRiversGroup(rivers, height, elevScale));

    if (showRoads) {
      const gMain = buildRoadsGroup(seeds, roadsMainDisplay, height, elevScale, 0.9, 0xd2c099);
      const gSide = buildRoadsGroup(seeds, roadsSide, height, elevScale, 0.6, 0x9aa7b8);
      worldGroup.add(gMain);
      worldGroup.add(gSide);
    }

    if (enablePhysarumWorld && physarumWorldPlan) {
      if (showPhysarumConductance) {
        const mesh = buildConductanceOverlay(physarumWorldPlan, height, elevScale);
        if (mesh) worldGroup.add(mesh);
      }
      if (showPhysarumSkeleton) {
        const lines = buildPhysarumLines(physarumWorldPlan, height, elevScale, 0x8ce0ff, 0.5);
        if (lines) worldGroup.add(lines);
      }
      if (showPhysarumRoads) {
        const roadsGroup = buildPhysarumRoadGroup(physarumWorldPlan, height, elevScale);
        if (roadsGroup) worldGroup.add(roadsGroup);
      }
    }

    if (showSprites) worldGroup.add(buildSpritesGroup(sprites, height, elevScale));

    // eslint-disable-next-line no-console
    console.info("[World3D] rebuilt", {
      worldSeed,
      elevScale,
      showRivers,
      showSprites,
      showRoads,
      children: worldGroup.children.length,
      roadsMain: roadsMainDisplay.length,
      roadsSide: roadsSide.length
    });
  }, [
    height,
    elevScale,
    showRivers,
    showSprites,
    showRoads,
    rivers,
    sprites,
    worldSeed,
    roadsMainDisplay,
    roadsSide,
    seeds,
    enablePhysarumWorld,
    physarumWorldPlan,
    showPhysarumConductance,
    showPhysarumSkeleton,
    showPhysarumRoads
  ]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}

function formatRegionCategory(category: RegionCategory) {
  switch (category) {
    case "urbanCore":
      return "Urban Core";
    case "urbanDistrict":
      return "Urban District";
    case "rural":
      return "Rural Frontier";
    case "wilderness":
    default:
      return "Wilderness";
  }
}
