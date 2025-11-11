import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../state/gameState";

const GRID = 256;
const SIZE = 256;
const ELEV_BANDS = { WATER: 0.34, LOW: 0.56, HIGH: 0.82 } as const;
const BAND_COLORS = {
  water: new THREE.Color(0x1852aa),
  lowland: new THREE.Color(0x307854),
  upland: new THREE.Color(0x75623e),
  mountain: new THREE.Color(0x9b938b)
} as const;

const SEEDS = 160;
const MIN_DIST = 24;
const KNN = 6;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const makeRng = (s: number) => () => ((s = Math.imul(1664525, s) + 1013904223) >>> 0) / 4294967296;

function sampleHeight(h: Float32Array[], x: number, y: number) {
  const ix = clamp(Math.floor(x), 0, GRID - 1);
  const iy = clamp(Math.floor(y), 0, GRID - 1);
  const fx = x - ix;
  const fy = y - iy;
  const a = h[iy][ix];
  const b = h[iy][ix + 1];
  const c = h[iy + 1][ix];
  const d = h[iy + 1][ix + 1];
  const top = lerp(a, b, fx);
  const bot = lerp(c, d, fx);
  return lerp(top, bot, fy);
}

function elevBand(z: number) {
  if (z <= ELEV_BANDS.WATER) return "water";
  if (z <= ELEV_BANDS.LOW) return "lowland";
  if (z <= ELEV_BANDS.HIGH) return "upland";
  return "mountain";
}

function diamondSquare(n = 8, rough = 0.58, rng: () => number = Math.random) {
  const size = (1 << n) + 1;
  const h = Array.from({ length: size }, () => new Float32Array(size));
  h[0][0] = rng();
  h[0][size - 1] = rng();
  h[size - 1][0] = rng();
  h[size - 1][size - 1] = rng();
  let step = size - 1;
  let scale = rough;
  while (step > 1) {
    const half = step >> 1;
    for (let y = half; y < size; y += step) {
      for (let x = half; x < size; x += step) {
        const avg =
          (h[y - half][x - half] + h[y - half][x + half] + h[y + half][x - half] + h[y + half][x + half]) *
          0.25;
        h[y][x] = avg + (rng() * 2 - 1) * scale;
      }
    }
    for (let y = 0; y < size; y += half) {
      const shift = (y / half) & 1 ? 0 : half;
      for (let x = shift; x < size; x += step) {
        let acc = 0;
        let c = 0;
        if (y - half >= 0) {
          acc += h[y - half][x];
          c++;
        }
        if (y + half < size) {
          acc += h[y + half][x];
          c++;
        }
        if (x - half >= 0) {
          acc += h[y][x - half];
          c++;
        }
        if (x + half < size) {
          acc += h[y][x + half];
          c++;
        }
        h[y][x] = acc / c + (rng() * 2 - 1) * scale * 0.7;
      }
    }
    step = half;
    scale *= rough;
  }
  let mn = Infinity;
  let mx = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      mn = Math.min(mn, h[y][x]);
      mx = Math.max(mx, h[y][x]);
    }
  }
  const inv = 1 / (mx - mn);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      h[y][x] = (h[y][x] - mn) * inv;
    }
  }
  return h;
}

function buildRivers(
  h: Float32Array[],
  { count = 120, minLen = 40, rng = Math.random as () => number } = {}
) {
  const rivers: number[][][] = [];
  const inBounds = (x: number, y: number) => x > 0 && y > 0 && x < GRID && y < GRID;
  const pickHigh = () => {
    for (let t = 0; t < 4000; t++) {
      const x = 1 + (rng() * (GRID - 2)) | 0;
      const y = 1 + (rng() * (GRID - 2)) | 0;
      if (h[y][x] > ELEV_BANDS.HIGH) return { x, y };
    }
    return { x: (rng() * GRID) | 0, y: (rng() * GRID) | 0 };
  };
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ] as const;
  for (let i = 0; i < count; i++) {
    let { x, y } = pickHigh();
    const path: number[][] = [];
    let guard = 0;
    let stuck = 0;
    while (inBounds(x, y) && h[y][x] > ELEV_BANDS.WATER && guard < 3000) {
      path.push([x, y]);
      let bestDx = 0;
      let bestDy = 0;
      let best = 0;
      const curr = h[y][x];
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const down = curr - h[ny][nx];
        if (down > best) {
          best = down;
          bestDx = dx;
          bestDy = dy;
        }
      }
      if (best <= 1e-4) {
        const r = dirs[(rng() * dirs.length) | 0];
        x += r[0];
        y += r[1];
        stuck++;
        if (stuck > 12) break;
      } else {
        x += bestDx;
        y += bestDy;
        stuck = 0;
      }
      guard++;
    }
    if (path.length >= minLen) rivers.push(path);
  }
  return rivers;
}

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

function sampleSeeds(count: number, minD: number, rng: () => number) {
  const pts: { x: number; y: number }[] = [];
  let tries = 0;
  const limit = count * 2000;
  while (pts.length < count && tries < limit) {
    tries++;
    const x = 1 + rng() * (GRID - 2);
    const y = 1 + rng() * (GRID - 2);
    let ok = true;
    for (const p of pts) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < minD * minD) {
        ok = false;
        break;
      }
    }
    if (ok) pts.push({ x, y });
  }
  return pts;
}

function buildKnnEdges(pts: { x: number; y: number }[], k: number) {
  const edges = new Map<string, [number, number]>();
  for (let i = 0; i < pts.length; i++) {
    const d = pts
      .map((p, j) => (j === i ? null : { j, dist: (p.x - pts[i].x) ** 2 + (p.y - pts[i].y) ** 2 }))
      .filter(Boolean) as { j: number; dist: number }[];
    d.sort((a, b) => a.dist - b.dist);
    for (const { j } of d.slice(0, k)) {
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      edges.set(`${a}-${b}`, [a, b]);
    }
  }
  return Array.from(edges.values());
}

function mstKruskal(
  pts: { x: number; y: number }[],
  edges: [number, number][],
  weightFn: (e: [number, number]) => number
) {
  const parent = pts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const unite = (a: number, b: number) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent[a] = b;
  };
  const sorted = [...edges].sort((e1, e2) => weightFn(e1) - weightFn(e2));
  const take: [number, number][] = [];
  for (const e of sorted) {
    const [a, b] = e;
    if (find(a) !== find(b)) {
      take.push(e);
      unite(a, b);
    }
  }
  return take;
}

function buildRoadStrip(points: { x: number; y: number; z: number }[], width = 0.9) {
  const n = points.length;
  if (n < 2) return new THREE.Mesh();
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const pPrev = points[Math.max(0, i - 1)];
    const pNext = points[Math.min(n - 1, i + 1)];
    const tx = pNext.x - pPrev.x;
    const tz = pNext.z - pPrev.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len;
    const nz = tx / len;
    positions.push(p.x + nx * width * 0.5, p.y, p.z + nz * width * 0.5);
    positions.push(p.x - nx * width * 0.5, p.y, p.z - nz * width * 0.5);
    if (i < n - 1) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = i * 2 + 2;
      const d = i * 2 + 3;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: 0xd2c099,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide
    })
  );
}

function buildRoadsGroup(
  seeds: { x: number; y: number }[],
  edges: [number, number][],
  height: Float32Array[],
  scaleY: number,
  w = 0.9,
  color = 0xd2c099
) {
  const g = new THREE.Group();
  for (const [a, b] of edges) {
    const ax = seeds[a].x;
    const ay = seeds[a].y;
    const bx = seeds[b].x;
    const by = seeds[b].y;
    const steps = 16;
    const pts: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const wx = x - SIZE / 2;
      const wy = sampleHeight(height, x, y) * scaleY + 0.02;
      const wz = y - SIZE / 2;
      pts.push({ x: wx, y: wy, z: wz });
    }
    const strip = buildRoadStrip(pts, w);
    ((strip.material as THREE.Material) as THREE.MeshStandardMaterial).color = new THREE.Color(color);
    g.add(strip);
  }
  return g;
}

function buildTerrainMesh(height: Float32Array[], scaleY: number) {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, GRID, GRID);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array((GRID + 1) * (GRID + 1) * 3);
  let ci = 0;
  for (let vy = 0; vy <= GRID; vy++) {
    for (let vx = 0; vx <= GRID; vx++) {
      const idx = vy * (GRID + 1) + vx;
      const z = height[vy][vx];
      pos.setZ(idx, z * scaleY);
      const col = BAND_COLORS[elevBand(z) as keyof typeof BAND_COLORS];
      colors[ci++] = col.r;
      colors[ci++] = col.g;
      colors[ci++] = col.b;
    }
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
    side: THREE.FrontSide
  });
  return new THREE.Mesh(geo, mat);
}

function buildRiversGroup(rivers: number[][][], height: Float32Array[], scaleY: number) {
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0x4aa0ff, transparent: true, opacity: 0.9 });
  for (const path of rivers.slice(0, 200)) {
    const positions = new Float32Array(path.length * 3);
    for (let p = 0; p < path.length; p++) {
      const [x, y] = path[p];
      const wx = x - SIZE / 2;
      const wy = sampleHeight(height, x, y) * scaleY + 0.05;
      const wz = y - SIZE / 2;
      positions[p * 3 + 0] = wx;
      positions[p * 3 + 1] = wy;
      positions[p * 3 + 2] = wz;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const line = new THREE.Line(geo, mat);
    group.add(line);
  }
  return group;
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

  const { worldSeed, elevScale, showRivers, showSprites, showRoads } = useGameStore((state) => ({
    worldSeed: state.worldSeed,
    elevScale: state.elevScale,
    showRivers: state.showRivers,
    showSprites: state.showSprites,
    showRoads: state.showRoads
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

  useEffect(() => {
    runSanityTests(height, rivers, sprites, roadsMain, seeds, roadsSide);
  }, [height, rivers, sprites, roadsMain, roadsSide, seeds]);

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
    if ("outputEncoding" in renderer) {
      (renderer as THREE.WebGLRenderer & { outputEncoding?: THREE.TextureEncoding }).outputEncoding =
        THREE.sRGBEncoding;
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
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointermove", onMove);
    canvas.addEventListener("wheel", onWheel, { passive: true });

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
      const gMain = buildRoadsGroup(seeds, roadsMain, height, elevScale, 0.9, 0xd2c099);
      const gSide = buildRoadsGroup(seeds, roadsSide, height, elevScale, 0.6, 0x9aa7b8);
      worldGroup.add(gMain);
      worldGroup.add(gSide);
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
      roadsMain: roadsMain.length,
      roadsSide: roadsSide.length
    });
  }, [height, elevScale, showRivers, showSprites, showRoads, rivers, sprites, worldSeed, roadsMain, roadsSide, seeds]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
