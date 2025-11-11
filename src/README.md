# TerraGenesis Collapse - Prototype Client

This package contains the interactive prototype for **TerraGenesis Collapse**, built with React, TypeScript, Vite, Three.js, and Zustand. It focuses on visualising procedurally generated planetary terrain alongside placeholder gameplay panels that will evolve into full strategy systems.

## Getting started

```bash
npm install
npm run dev
```

The dev server boots on [http://localhost:5173](http://localhost:5173). Hot module reloading keeps both the Three.js map and the React control panels in sync as you iterate.

## Features

- ⚙️ **Procedural world generation** &mdash; The `World3DMap` component uses a diamond-square heightmap seeded by player input, then layers on rivers, roads, and settlement markers.
- 🛰️ **Three.js terrain renderer** &mdash; Vertex-coloured meshes, water planes, orbit controls, and interactive sprites create an explorable 3D view.
- 🎛️ **Interactive controls** &mdash; Sliders and toggles adjust elevation scale, sea level, overlays, and seeds in real time.
- 🗂️ **Gameplay scaffolding** &mdash; Zustand provides a central store for overlays, resources, and settlement metadata so future UI panels can tap into shared state.

## Project structure

```
src/
├── App.tsx                # Layout shell with side panels and map canvas
├── components/
│   ├── InfoPanels.tsx     # Placeholder resource + operations panels
│   ├── MapControls.tsx    # Seed/elevation/overlay controls
│   └── World3DMap.tsx     # Three.js renderer and feature generation
├── state/
│   └── useGameStore.ts    # Zustand store for toggles and world data
├── App.css                # Layout + component styling
├── index.css              # Global resets/theme
└── main.tsx               # App bootstrap
```

## Next steps

- Replace placeholder info cards with live simulation data (resources, missions, alerts).
- Persist world state to storage or backend services.
- Enrich terrain with biome classification, weather effects, and animated overlays.

Contributions are welcome as the concept evolves!
