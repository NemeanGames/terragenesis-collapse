import type { Axial } from "../state/types";

export function worldToAxial(x: number, z: number, size: number): Axial {
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * z) / size;
  const r = ((2 / 3) * z) / size;
  return hexRound(q, r);
}

export function axialToWorld(axial: Axial, size: number) {
  const x = size * (Math.sqrt(3) * axial.q + (Math.sqrt(3) / 2) * axial.r);
  const z = size * (1.5 * axial.r);
  return { x, z };
}

function hexRound(q: number, r: number): Axial {
  let x = q;
  let z = r;
  let y = -x - z;

  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { q: rx, r: rz };
}

export function hashAxial(axial: Axial) {
  return ((axial.q * 73856093) ^ (axial.r * 19349663)) >>> 0;
}

export function axialDistance(a: Axial, b: Axial) {
  const dx = a.q - b.q;
  const dz = a.r - b.r;
  const dy = -dx - dz;
  return Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
}
