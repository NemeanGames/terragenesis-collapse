import * as THREE from "three";

export function createTerrainMaterial(overrides: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
    side: THREE.FrontSide,
    ...overrides
  });
}

export function createRoadMaterial(
  color: number,
  overrides: Partial<THREE.MeshStandardMaterialParameters> = {}
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
    ...overrides
  });
}

export function createRiverMaterial(overrides: Partial<THREE.LineBasicMaterialParameters> = {}) {
  return new THREE.LineBasicMaterial({
    color: 0x4aa0ff,
    transparent: true,
    opacity: 0.9,
    ...overrides
  });
}
