export type BlockId = number;
export type LotKind = 'none' | 'residential' | 'commercial' | 'industrial' | 'park' | 'civic';

export interface LotBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RoadNode {
  id: number;
  position: [number, number];
  tags?: string[];
}

export interface RoadEdge {
  id?: number;
  from: number;
  to: number;
  tags?: string[];
}

export interface RoadGraph {
  nodes: RoadNode[];
  edges: RoadEdge[];
}

export interface CellZoning {
  blockId: Int32Array;
  lotId: Int32Array;
  lotKind: LotKind[];
  lotBBox: LotBBox[];
}

export interface Cell {
  bounds: number;
  seed: number;
  biomeId: string;
  densityBand: 0 | 1 | 2;
  buildable: Uint8Array;
  roadMask: Uint8Array;
  roadGraph: RoadGraph;
  waterMask?: Uint8Array;
  zoning?: CellZoning;
}

export interface BlockStats {
  area: number;
  edgeTouch: boolean;
  waterAdj: number;
}

export interface LotGeometry {
  id: number;
  blockId: BlockId;
  frontage: number;
  depth: number;
  area: number;
  centroid: { x: number; y: number };
  bbox: LotBBox;
  frontagePoints: Array<[number, number]>;
  roadDirections: Array<[number, number]>;
  edgeTouch: boolean;
  waterAdj: number;
}
