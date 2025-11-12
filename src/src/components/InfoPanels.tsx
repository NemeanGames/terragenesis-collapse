import { useMemo } from 'react'
import { useGameStore } from '../state/useGameStore'

const InfoPanels = () => {
  const resources = useGameStore((state) => state.resources)
  const settlements = useGameStore((state) => state.settlements)
  const selectedSettlementId = useGameStore((state) => state.selectedSettlementId)
  const selectSettlement = useGameStore((state) => state.selectSettlement)

  const selectedSettlement = useMemo(
    () => settlements.find((settlement) => settlement.id === selectedSettlementId) ?? null,
    [settlements, selectedSettlementId]
  )

  return (
    <div className="info-stack">
      <section className="panel">
        <header className="panel__header">
          <h2>Colony Stores</h2>
          <p className="panel__subtitle">Snapshot of current strategic reserves</p>
        </header>
        <ul className="stat-list">
          <li>
            <span>Energy</span>
            <span>{resources.energy.toLocaleString()} kWh</span>
          </li>
          <li>
            <span>Biomass</span>
            <span>{resources.biomass.toLocaleString()} kg</span>
          </li>
          <li>
            <span>Water</span>
            <span>{resources.water.toLocaleString()} L</span>
          </li>
        </ul>
      </section>

      <section className="panel">
        <header className="panel__header">
          <h2>Settlements</h2>
          <p className="panel__subtitle">Tap a marker or choose a colony to inspect</p>
        </header>
        <ul className="settlement-list">
          {settlements.map((settlement) => {
            const isSelected = settlement.id === selectedSettlementId
            return (
              <li key={settlement.id} className={isSelected ? 'is-selected' : ''}>
                <button type="button" onClick={() => selectSettlement(settlement.id)}>
                  <span className="settlement-list__name">{settlement.name}</span>
                  <span className="settlement-list__coords">
                    {settlement.position.x.toFixed(1)}, {settlement.position.y.toFixed(1)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {selectedSettlement ? (
          <div className="panel__section">
            <h3>{selectedSettlement.name}</h3>
            <p className="panel__note">
              Elevation: {(selectedSettlement.position.elevation * 1000).toFixed(0)} m · Strategic outlook pending
            </p>
          </div>
        ) : (
          <p className="panel__note">Select a settlement to view mission objectives.</p>
        )}
      </section>

      <section className="panel">
        <header className="panel__header">
          <h2>Operations Queue</h2>
          <p className="panel__subtitle">Mission planning hooks for future gameplay systems</p>
        </header>
        <div className="placeholder">No active deployments. Link this panel to task orchestration soon.</div>
      </section>
    </div>
  )
}

export default InfoPanels
