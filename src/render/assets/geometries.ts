import * as THREE from "three";
import { GRID, SIZE } from "../../world/terrain/heightmap";

export function createTerrainGeometry() {
  return new THREE.PlaneGeometry(SIZE, SIZE, GRID, GRID);
}

export function createRoadGeometry() {
  return new THREE.BufferGeometry();
}
