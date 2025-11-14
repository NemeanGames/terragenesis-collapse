import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../../state/gameState";
import type { RegionCategory, RegionPoi, RegionPoiStatus } from "../../state/types";
import { generateCityData } from "./cityScene";
import { generateCityPlan } from "./cityGen";
import CellView from "../../components/CellView";
import { generateCell } from "./cellGenerator";

const CITY_COLORS: Record<RegionCategory, { ground: string; accent: string }> = {
  urbanCore: { ground: "#1b1e27", accent: "#9fb6ff" },
  urbanDistrict: { ground: "#20232d", accent: "#a5e1ff" },
  rural: { ground: "#24271f", accent: "#c3f4b5" },
  wilderness: { ground: "#1f241f", accent: "#a7f0d8" }
};

const STATUS_CYCLE: RegionPoiStatus[] = ["idle", "assigned", "completed"];

export default function UrbanOperationsView() {
  const { selectedRegion, updateRegionPoiStatus } = useGameStore((state) => ({
    selectedRegion: state.selectedRegion,
    updateRegionPoiStatus: state.updateRegionPoiStatus
  }));

  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const rafRef = useRef(0);
  const resizeRef = useRef<ResizeObserver | null>(null);

  const region = selectedRegion;

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 600;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1117);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 800);
    camera.position.set(60, 80, 120);
    cameraRef.current = camera;

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(80, 120, 40);
    directional.castShadow = true;
    const hemisphere = new THREE.HemisphereLight(0x334455, 0x080a0c, 0.35);
    scene.add(ambient);
    scene.add(directional);
    scene.add(hemisphere);

    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    let yaw = -0.6;
    let pitch = 0.55;
    let dist = 160;
    let isDown = false;
    let lastX = 0;
    let lastY = 0;

    const canvas = renderer.domElement;
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
      pitch = Math.max(0.1, Math.min(Math.PI * 0.49, pitch));
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onWheel = (e: WheelEvent) => {
      dist = Math.max(16, Math.min(260, dist + e.deltaY * 0.1));
    };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointermove", onMove);
    canvas.addEventListener("wheel", onWheel, { passive: true });

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    observer.observe(container);
    resizeRef.current = observer;

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
      if (resizeRef.current) resizeRef.current.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("wheel", onWheel);
      if (group) {
        group.traverse(disposeObject);
        scene.remove(group);
      }
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  const density = useMemo(() => {
    if (!region) return 0.5;
    switch (region.category) {
      case "urbanCore":
        return 1.0;
      case "urbanDistrict":
        return 0.75;
      case "rural":
        return 0.45;
      case "wilderness":
      default:
        return 0.28;
    }
  }, [region]);

  const densityBand = useMemo<0 | 1 | 2>(() => {
    if (!region) return 1;
    switch (region.category) {
      case "urbanCore":
        return 2;
      case "urbanDistrict":
        return 1;
      case "rural":
      case "wilderness":
      default:
        return 0;
    }
  }, [region]);

  const cityData = useMemo(() => {
    if (!region) return null;
    return generateCityData(region.seed, { density });
  }, [region, density]);

  const cityPlan = useMemo(() => {
    if (!region) return null;
    return generateCityPlan(region.seed);
  }, [region]);

  const cellData = useMemo(() => {
    if (!region) return null;
    return generateCell(region.seed, { densityBand, biomeId: region.category });
  }, [region, densityBand]);

  useEffect(() => {
    if (!cityData || !sceneRef.current || !groupRef.current) return;
    const group = groupRef.current;
    while (group.children.length) {
      const child = group.children.pop();
      if (child) disposeObject(child);
    }

    const palette = CITY_COLORS[region?.category ?? "urbanCore"];

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(cityData.bounds * 2.4, cityData.bounds * 2.4),
      new THREE.MeshStandardMaterial({ color: palette.ground, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);

    if (cityData.roads.length) {
      const roadMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x383c46, roughness: 0.95, metalness: 0.05 }),
        cityData.roads.length
      );
      roadMesh.receiveShadow = true;
      const temp = new THREE.Object3D();
      cityData.roads.forEach((r, i) => {
        temp.position.set(r.pos[0], r.pos[1], r.pos[2]);
        temp.scale.set(r.scale[0], r.scale[1], r.scale[2]);
        temp.rotation.set(0, 0, 0);
        temp.updateMatrix();
        roadMesh.setMatrixAt(i, temp.matrix);
      });
      roadMesh.instanceMatrix.needsUpdate = true;
      group.add(roadMesh);
    }

    if (cityData.buildings.length) {
      const buildingMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.75, metalness: 0.12 }),
        cityData.buildings.length
      );
      buildingMesh.castShadow = true;
      buildingMesh.receiveShadow = true;
      const temp = new THREE.Object3D();
      cityData.buildings.forEach((b, i) => {
        temp.position.set(b.pos[0], b.scale[1] / 2, b.pos[2]);
        temp.scale.set(b.scale[0], b.scale[1], b.scale[2]);
        temp.rotation.set(0, b.rot, 0);
        temp.updateMatrix();
        buildingMesh.setMatrixAt(i, temp.matrix);
      });
      buildingMesh.instanceMatrix.needsUpdate = true;
      group.add(buildingMesh);
    }

    for (const water of cityData.waters) {
      const lake = new THREE.Mesh(
        new THREE.CircleGeometry(water.radius, 48),
        new THREE.MeshStandardMaterial({
          color: 0x2f5f9b,
          roughness: 0.4,
          metalness: 0.05,
          transparent: true,
          opacity: 0.88
        })
      );
      lake.rotation.x = -Math.PI / 2;
      lake.position.set(water.pos[0], 0.02, water.pos[2]);
      lake.receiveShadow = true;
      group.add(lake);
    }
  }, [cityData, region]);

  if (!region || !cityData) {
    return (
      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#cfd8ff" }}>
        <div>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 8 }}>No region selected</h2>
          <p style={{ opacity: 0.75 }}>Double-click a hex on the world map to open an operations cell.</p>
        </div>
      </div>
    );
  }

  const districtSummary = useMemo(() => summarizeDistricts(cityPlan?.grid), [cityPlan]);

  const handleAdvancePoi = (poi: RegionPoi) => {
    const idx = STATUS_CYCLE.indexOf(poi.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    updateRegionPoiStatus(poi.id, next);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 320px",
        height: "100%",
        background: "transparent"
      }}
    >
      <div ref={mountRef} style={{ position: "relative", background: "rgba(8,10,14,0.65)" }}>
        {cellData && <CellView cell={cellData} />}
      </div>
      <aside
        style={{
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          background: "rgba(13,18,27,0.85)",
          borderLeft: "1px solid rgba(88,140,240,0.2)"
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#dbe4ff" }}>{region.label}</h2>
          <div style={{ fontSize: "0.85rem", opacity: 0.75 }}>Seed #{region.seed}</div>
          <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: "0.85rem" }}>
            <span>Elevation: {(region.metrics.elevation * 100).toFixed(1)}%</span>
            <span>Slope: {(region.metrics.slope * 100).toFixed(1)}%</span>
            <span>Settlement distance: {region.metrics.distanceToSettlement.toFixed(1)}m</span>
            <span>Moisture: {(region.metrics.moisture * 100).toFixed(0)}%</span>
            <span>Coastal: {region.metrics.coastal ? "Yes" : "No"}</span>
          </div>
        </div>

        <section>
          <h3 style={{ margin: "0 0 6px", fontSize: "1rem", color: "#f6fbff" }}>Points of Interest</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {region.pois.map((poi) => (
              <div
                key={poi.id}
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid rgba(120,150,220,0.25)",
                  background: "rgba(18,24,34,0.85)",
                  display: "grid",
                  gap: 4
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "#e3eaff" }}>{poi.name}</strong>
                  <span style={{ fontSize: "0.75rem", opacity: 0.65 }}>{poi.type}</span>
                </div>
                <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>Difficulty: {(poi.difficulty * 100).toFixed(0)}%</div>
                <button
                  onClick={() => handleAdvancePoi(poi)}
                  style={{
                    justifySelf: "start",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(120,180,255,0.35)",
                    background: statusColor(poi.status),
                    color: "#e9f1ff",
                    fontSize: "0.75rem",
                    cursor: "pointer"
                  }}
                >
                  Status: {poi.status}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 style={{ margin: "0 0 6px", fontSize: "1rem", color: "#f6fbff" }}>District Mix</h3>
          <div style={{ display: "grid", gap: 4, fontSize: "0.8rem" }}>
            {districtSummary.map(({ district, count }) => (
              <div key={district} style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{district}</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function disposeObject(obj: THREE.Object3D) {
  if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
    obj.geometry.dispose();
    if (Array.isArray(obj.material)) {
      obj.material.forEach((m) => m.dispose());
    } else if (obj.material) {
      obj.material.dispose();
    }
  }
}

function summarizeDistricts(
  grid?: ReturnType<typeof generateCityPlan>["grid"]
): { district: string; count: number }[] {
  const counts = new Map<string, number>();
  if (grid) {
    for (const row of grid) {
      for (const cell of row) {
        if (cell.district && cell.district !== "CENTER") {
          counts.set(cell.district, (counts.get(cell.district) ?? 0) + 1);
        }
      }
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([district, count]) => ({ district, count }));
}

function statusColor(status: RegionPoiStatus) {
  switch (status) {
    case "completed":
      return "rgba(72,160,120,0.65)";
    case "assigned":
      return "rgba(180,140,40,0.55)";
    case "idle":
    default:
      return "rgba(60,100,180,0.35)";
  }
}
