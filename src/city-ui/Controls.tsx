import { createDefaultCityParams } from "../city-core/types";
import { useCityStore } from "../state/useCityStore";

const DEFAULT_PHYSARUM = createDefaultCityParams().physarum!;

export function PhysarumControls() {
  const { params, setParams, rebatch } = useCityStore();
  const p = params.physarum ?? DEFAULT_PHYSARUM;

  const mergePhysarum = (patch: Partial<typeof p>) => {
    setParams({ physarum: { ...p, ...patch } });
    rebatch();
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={params.usePhysarum}
          onChange={(event) => {
            setParams({ usePhysarum: event.target.checked });
            rebatch();
          }}
        />
        <span>Use Physarum road growth</span>
      </label>
      {params.usePhysarum && (
        <div style={{ display: "grid", gap: 6 }}>
          <NumberControl
            label="Agents"
            min={500}
            max={30000}
            step={500}
            value={p.agents}
            onChange={(value) => mergePhysarum({ agents: value })}
          />
          <NumberControl
            label="Steps"
            min={500}
            max={30000}
            step={500}
            value={p.steps}
            onChange={(value) => mergePhysarum({ steps: value })}
          />
          <NumberControl
            label="Deposit"
            min={0.1}
            max={5}
            step={0.1}
            value={p.deposit}
            onChange={(value) => mergePhysarum({ deposit: value })}
          />
          <NumberControl
            label="Diffusion"
            min={0.05}
            max={0.5}
            step={0.01}
            value={p.diffusion}
            onChange={(value) => mergePhysarum({ diffusion: value })}
          />
          <NumberControl
            label="Decay"
            min={0.001}
            max={0.05}
            step={0.001}
            value={p.decay}
            onChange={(value) => mergePhysarum({ decay: value })}
          />
          <NumberControl
            label="Step (m)"
            min={0.3}
            max={2}
            step={0.1}
            value={p.step}
            onChange={(value) => mergePhysarum({ step: value })}
          />
          <NumberControl
            label="Turn (rad)"
            min={0.1}
            max={1.5}
            step={0.05}
            value={p.turn}
            onChange={(value) => mergePhysarum({ turn: value })}
          />
          <NumberControl
            label="Sensor angle"
            min={0.2}
            max={1.6}
            step={0.05}
            value={p.sensorAngle}
            onChange={(value) => mergePhysarum({ sensorAngle: value })}
          />
          <NumberControl
            label="Sensor dist"
            min={0.5}
            max={4}
            step={0.1}
            value={p.sensorDist}
            onChange={(value) => mergePhysarum({ sensorDist: value })}
          />
          <NumberControl
            label="Grid res (px/m)"
            min={1}
            max={3}
            step={1}
            value={p.gridRes}
            onChange={(value) => mergePhysarum({ gridRes: value })}
          />
        </div>
      )}
    </div>
  );
}

function NumberControl({
  label,
  value,
  onChange,
  min,
  max,
  step
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "140px 1fr 80px", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: "0.8rem" }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(parseFloat(event.target.value))}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(parseFloat(event.target.value))}
        style={{ width: "100%" }}
      />
    </label>
  );
}
