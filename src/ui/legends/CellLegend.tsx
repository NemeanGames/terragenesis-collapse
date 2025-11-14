import { LOT_COLORS } from '../../cell';
import type { LotKind } from '../../cell';

const ORDER: LotKind[] = ['residential', 'commercial', 'industrial', 'park', 'civic'];

export default function CellLegend() {
  return (
    <div style={{ padding: '0 16px 12px', display: 'grid', gap: 6 }}>
      <h4 style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5f5' }}>Legend</h4>
      {ORDER.map((kind) => (
        <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 4,
              background: LOT_COLORS[kind],
              display: 'inline-block',
              border: '1px solid rgba(15,23,42,0.65)'
            }}
          />
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{kind}</span>
        </div>
      ))}
    </div>
  );
}
