import { ChangeEvent } from 'react'
import { OverlayKey, useGameStore } from '../state/useGameStore'

const overlayLabels: Record<OverlayKey, string> = {
  rivers: 'Rivers',
  roads: 'Road Networks',
  settlements: 'Settlements',
  heightTint: 'Height Shading',
}

const MapControls = () => {
  const seed = useGameStore((state) => state.seed)
  const setSeed = useGameStore((state) => state.setSeed)
  const elevationScale = useGameStore((state) => state.elevationScale)
  const setElevationScale = useGameStore((state) => state.setElevationScale)
  const seaLevel = useGameStore((state) => state.seaLevel)
  const setSeaLevel = useGameStore((state) => state.setSeaLevel)
  const overlayVisibility = useGameStore((state) => state.overlayVisibility)
  const toggleOverlay = useGameStore((state) => state.toggleOverlay)

  const handleSeedChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSeed(event.target.value.trim())
  }

  const handleRandomSeed = () => {
    const entropySource = typeof window !== 'undefined' && window.crypto ? window.crypto : null
    const entropy = entropySource
      ? entropySource.getRandomValues(new Uint32Array(1))[0]
      : Math.floor(Math.random() * 10_000_000)
    setSeed(entropy.toString(36))
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <h2>World Generation</h2>
        <p className="panel__subtitle">Tune the procedural map parameters</p>
      </header>
      <div className="panel__section">
        <label className="field">
          <span className="field__label">Seed</span>
          <div className="field__row">
            <input
              type="text"
              value={seed}
              onChange={handleSeedChange}
              className="field__input"
              placeholder="Enter world seed"
            />
            <button type="button" className="field__button" onClick={handleRandomSeed}>
              Randomise
            </button>
          </div>
        </label>
      </div>
      <div className="panel__section">
        <label className="field">
          <span className="field__label">Elevation Scale</span>
          <input
            type="range"
            min="8"
            max="48"
            step="1"
            value={elevationScale}
            onChange={(event) => setElevationScale(Number(event.target.value))}
          />
          <span className="field__value">{elevationScale.toFixed(0)}m</span>
        </label>
      </div>
      <div className="panel__section">
        <label className="field">
          <span className="field__label">Sea Level</span>
          <input
            type="range"
            min="0"
            max="0.6"
            step="0.01"
            value={seaLevel}
            onChange={(event) => setSeaLevel(Number(event.target.value))}
          />
          <span className="field__value">{Math.round(seaLevel * 100)}%</span>
        </label>
      </div>
      <div className="panel__section">
        <span className="field__label">Overlays</span>
        <ul className="checkbox-list">
          {(Object.keys(overlayLabels) as OverlayKey[]).map((overlay) => (
            <li key={overlay}>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={overlayVisibility[overlay]}
                  onChange={() => toggleOverlay(overlay)}
                />
                <span>{overlayLabels[overlay]}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default MapControls
