import { useGameStore } from "../state/gameState";

const GRID_SIZE = 48;
const CELL_SCALE = 12;

export default function CellView() {
  const { selectedCell, cellRuntime, closeCell, toggleCellOverlay } = useGameStore((state) => ({
    selectedCell: state.selectedCell,
    cellRuntime: state.cellRuntime,
    closeCell: state.closeCell,
    toggleCellOverlay: state.toggleCellOverlay
  }));

  if (!selectedCell || !cellRuntime) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#9cc9ff"
        }}
      >
        Select a world tile with gentle terrain to generate a micro cell.
      </div>
    );
  }

  const { overlays } = selectedCell;
  const sizePx = GRID_SIZE * CELL_SCALE;
  const buildablePct = Math.round(selectedCell.buildablePct * 100);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        height: "100%",
        padding: "12px"
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px"
        }}
      >
        <div style={{ color: "#d7e8ff", fontSize: "0.95rem" }}>
          Cell ({selectedCell.q},{selectedCell.r}) • seed {selectedCell.seed} • buildable {buildablePct}%
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Toggle label="Roads" checked={overlays.roads} onToggle={() => toggleCellOverlay("roads")} />
          <Toggle label="Lots" checked={overlays.lots} onToggle={() => toggleCellOverlay("lots")} />
          <Toggle label="POI" checked={overlays.poi} onToggle={() => toggleCellOverlay("poi")} />
          <button
            onClick={closeCell}
            style={{
              borderRadius: "9999px",
              border: "1px solid rgba(132,176,255,0.45)",
              background: "rgba(24,36,64,0.65)",
              padding: "6px 16px",
              color: "#c9dbff",
              fontSize: "0.85rem",
              fontWeight: 500
            }}
          >
            ← Back to World
          </button>
        </div>
      </header>

      <div style={{ flex: 1, overflow: "auto" }}>
        <div
          aria-label="Cell grid"
          style={{
            position: "relative",
            width: sizePx,
            height: sizePx,
            margin: "0 auto",
            borderRadius: "12px",
            border: "1px solid rgba(88,120,200,0.35)",
            background: "rgba(8,12,20,0.92)",
            boxShadow: "0 24px 40px rgba(0,0,0,0.35)",
            imageRendering: "pixelated"
          }}
        >
          {overlays.roads &&
            cellRuntime.roads.map((road) => (
              <svg
                key={road.id}
                width={sizePx}
                height={sizePx}
                style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
              >
                <polyline
                  points={road.path
                    .map(([x, y]) => `${(x + 0.5) * CELL_SCALE},${(y + 0.5) * CELL_SCALE}`)
                    .join(" ")}
                  fill="none"
                  stroke="#f5f7ff"
                  strokeWidth={2}
                  strokeOpacity={0.85}
                />
              </svg>
            ))}

          {overlays.lots &&
            cellRuntime.lots.map((lot) => (
              <div
                key={lot.id}
                title={`${lot.zone}${lot.poi ? ` • ${lot.poi}` : ""}`}
                style={{
                  position: "absolute",
                  left: lot.x * CELL_SCALE,
                  top: lot.y * CELL_SCALE,
                  width: lot.w * CELL_SCALE,
                  height: lot.h * CELL_SCALE,
                  border: "1px solid rgba(120,210,170,0.5)",
                  background: "rgba(78,180,134,0.22)",
                  transition: "background 120ms ease"
                }}
              />
            ))}

          {overlays.poi &&
            cellRuntime.lots
              .filter((lot) => lot.poi)
              .map((lot) => (
                <div
                  key={`${lot.id}-poi`}
                  style={{
                    position: "absolute",
                    left: (lot.x + lot.w / 2) * CELL_SCALE - 4,
                    top: (lot.y + lot.h / 2) * CELL_SCALE - 4,
                    width: 8,
                    height: 8,
                    borderRadius: "9999px",
                    background: "#ffd966",
                    boxShadow: "0 0 8px rgba(255, 217, 102, 0.65)"
                  }}
                  title={lot.poi}
                />
              ))}
        </div>
      </div>

      <footer
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          color: "#9db7ff",
          fontSize: "0.85rem"
        }}
      >
        <InfoBlock label="Lots" value={cellRuntime.lots.length.toString()} />
        <InfoBlock label="Road Segments" value={cellRuntime.roads.length.toString()} />
        <InfoBlock
          label="POI"
          value={cellRuntime.lots.filter((lot) => lot.poi).length.toString()}
        />
        <InfoBlock label="Buildable" value={`${buildablePct}%`} />
      </footer>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onToggle
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "6px", color: "#d7e8ff" }}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {label}
    </label>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "12px 14px",
        borderRadius: "12px",
        background: "rgba(18,26,44,0.75)",
        border: "1px solid rgba(118,152,220,0.2)"
      }}
    >
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#e6f1ff" }}>{value}</span>
    </div>
  );
}
