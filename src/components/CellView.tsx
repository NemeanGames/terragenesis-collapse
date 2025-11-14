import { useEffect, useMemo, useRef, useState } from 'react';
import { applyZoning, extractLots, makeBlocks, LOT_COLORS } from '../cell';
import type { Cell, CellZoning, LotKind } from '../cell';
import CellLegend from '../ui/legends/CellLegend';

const OVERLAYS = ['base', 'blocks', 'lots', 'zoning'] as const;
type Overlay = (typeof OVERLAYS)[number];

const BLOCK_COLORS = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272'];

function colorForBlock(id: number) {
  if (id < 0) return '#1f2333';
  return BLOCK_COLORS[id % BLOCK_COLORS.length];
}

const LOT_PALETTE: Record<LotKind, string> = {
  none: 'transparent',
  residential: LOT_COLORS.residential,
  commercial: LOT_COLORS.commercial,
  industrial: LOT_COLORS.industrial,
  park: LOT_COLORS.park,
  civic: LOT_COLORS.civic
};

function drawCell(
  canvas: HTMLCanvasElement,
  cell: Cell,
  zoning: CellZoning,
  overlay: Overlay
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { bounds } = cell;
  canvas.width = bounds;
  canvas.height = bounds;
  const blockId = zoning.blockId;
  const lotId = zoning.lotId;
  const lotKind = zoning.lotKind;

  const image = ctx.createImageData(bounds, bounds);
  for (let y = 0; y < bounds; y++) {
    for (let x = 0; x < bounds; x++) {
      const index = (y * bounds + x) * 4;
      let color: string;
      if (overlay === 'base') {
        const buildable = cell.buildable[y * bounds + x];
        const road = cell.roadMask[y * bounds + x];
        const water = cell.waterMask?.[y * bounds + x] ?? 0;
        if (road) color = '#f1f5f9';
        else if (water) color = '#1e3a8a';
        else color = buildable ? '#1f3b4d' : '#0f172a';
      } else if (overlay === 'blocks') {
        color = colorForBlock(blockId[y * bounds + x]);
      } else if (overlay === 'lots' || overlay === 'zoning') {
        const lot = lotId[y * bounds + x];
        if (lot < 0) {
          color = '#111827';
        } else {
          const kind = overlay === 'lots' ? 'residential' : lotKind[lot];
          color = LOT_PALETTE[kind as LotKind] ?? '#94a3b8';
        }
      } else {
        color = '#0f172a';
      }
      const [r, g, b] = hexToRgb(color);
      image.data[index] = r;
      image.data[index + 1] = g;
      image.data[index + 2] = b;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  if (overlay === 'blocks') {
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 0.5;
    drawOutlines(ctx, blockId, bounds);
  }

  if (overlay === 'lots' || overlay === 'zoning') {
    ctx.strokeStyle = 'rgba(15,23,42,0.8)';
    ctx.lineWidth = 0.6;
    drawOutlines(ctx, lotId, bounds);
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  if (clean.length === 3) {
    return [((bigint >> 8) & 0xf) * 17, ((bigint >> 4) & 0xf) * 17, (bigint & 0xf) * 17];
  }
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function drawOutlines(ctx: CanvasRenderingContext2D, idMap: Int32Array, bounds: number) {
  const visited = new Uint8Array(idMap.length);
  const idx = (x: number, y: number) => y * bounds + x;
  const directions: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  ctx.beginPath();
  for (let y = 0; y < bounds; y++) {
    for (let x = 0; x < bounds; x++) {
      const current = idMap[idx(x, y)];
      if (current < 0 || visited[idx(x, y)]) continue;
      visited[idx(x, y)] = 1;
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= bounds || ny >= bounds) continue;
        if (idMap[idx(nx, ny)] !== current) {
          ctx.moveTo(x + 0.1, y + 0.1);
          ctx.lineTo(nx + 0.1, ny + 0.1);
        }
      }
    }
  }
  ctx.stroke();
}

function computeZoning(cell: Cell): CellZoning {
  const blocks = makeBlocks(cell);
  const lots = extractLots({
    bounds: cell.bounds,
    blockId: blocks.blockId,
    buildable: cell.buildable,
    roadMask: cell.roadMask,
    waterMask: cell.waterMask
  });
  const lotKind = applyZoning({
    densityBand: cell.densityBand,
    biomeId: cell.biomeId,
    roadGraph: cell.roadGraph,
    blockStats: blocks.blockStats,
    lots: lots.lots
  });
  return {
    blockId: blocks.blockId,
    lotId: lots.lotId,
    lotKind,
    lotBBox: lots.lotBBox
  };
}

function metricsFromZoning(zoning: CellZoning) {
  const blockIds = new Set<number>();
  const lotCounts: Record<LotKind, number> = {
    none: 0,
    residential: 0,
    commercial: 0,
    industrial: 0,
    park: 0,
    civic: 0
  };
  for (const id of zoning.blockId) {
    if (id >= 0) blockIds.add(id);
  }
  zoning.lotKind.forEach((kind) => {
    lotCounts[kind] = (lotCounts[kind] ?? 0) + 1;
  });
  const totalLots = zoning.lotKind.length || 1;
  const proportions = Object.entries(lotCounts).map(([kind, count]) => ({
    kind: kind as LotKind,
    pct: (count / totalLots) * 100
  }));
  return {
    blockCount: blockIds.size,
    lotCount: zoning.lotKind.length,
    proportions
  };
}

export default function CellView({ cell }: { cell: Cell }) {
  const [overlay, setOverlay] = useState<Overlay>('zoning');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const zoning = useMemo<CellZoning>(() => computeZoning(cell), [cell]);
  const metrics = useMemo(() => metricsFromZoning(zoning), [zoning]);

  useEffect(() => {
    if (!canvasRef.current) return;
    drawCell(canvasRef.current, cell, zoning, overlay);
  }, [cell, zoning, overlay]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        width: 260,
        background: 'rgba(10,15,25,0.92)',
        borderRadius: 12,
        border: '1px solid rgba(96,165,250,0.35)',
        boxShadow: '0 18px 32px rgba(0,0,0,0.45)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        zIndex: 5
      }}
    >
      <header style={{ padding: '12px 16px 0 16px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#e2e8f0' }}>Operations Cell</h3>
        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'rgba(148,163,184,0.85)' }}>
          Blocks, lots and zoning heuristics tuned by density band.
        </p>
      </header>
      <div style={{ padding: '0 16px', display: 'flex', gap: 6 }}>
        {OVERLAYS.map((option) => (
          <button
            key={option}
            onClick={() => setOverlay(option)}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid rgba(71,85,105,0.6)',
              background: overlay === option ? 'rgba(59,130,246,0.25)' : 'rgba(15,23,42,0.7)',
              color: '#e2e8f0',
              fontSize: '0.75rem'
            }}
          >
            {option.toUpperCase()}
          </button>
        ))}
      </div>
      <div style={{ padding: '0 16px' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: 200, borderRadius: 8, imageRendering: 'pixelated' }}
        />
      </div>
      <CellLegend />
      <section style={{ padding: '0 16px 16px', display: 'grid', gap: 6, fontSize: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5f5' }}>
          <span>Blocks</span>
          <strong>{metrics.blockCount}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5f5' }}>
          <span>Lots</span>
          <strong>{metrics.lotCount}</strong>
        </div>
        {metrics.proportions
          .filter((item) => item.kind !== 'none')
          .map((item) => (
            <div
              key={item.kind}
              style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}
            >
              <span>{item.kind}</span>
              <span>{item.pct.toFixed(1)}%</span>
            </div>
          ))}
      </section>
    </div>
  );
}
