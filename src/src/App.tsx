import './App.css'
import MapControls from './components/MapControls'
import InfoPanels from './components/InfoPanels'
import World3DMap from './components/World3DMap'

function App() {
  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar app-shell__sidebar--left">
        <div className="brand">
          <h1>TerraGenesis Collapse</h1>
          <p>Reseeding fractured biomes after the fall.</p>
        </div>
        <MapControls />
      </aside>
      <main className="app-shell__main">
        <World3DMap />
      </main>
      <aside className="app-shell__sidebar app-shell__sidebar--right">
        <InfoPanels />
      </aside>
    </div>
  )
}

export default App
