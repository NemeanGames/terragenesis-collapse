# Physarum Road Planner Integration

This note captures how the Physarum-inspired planner plugs into the existing terrain and road stack.

## Usage scopes

- **Macro world view** – the planner operates on a raster cost field derived from the world heightmap. Major hubs (settlement seeds, POIs) are fed in as attractors. The resulting conductance field proposes inter-region corridors that blend with the MST scaffold.
- **Cell view (optional)** – small grids seeded with parcel entrances or POIs reuse the same solver to generate alley / footpath overlays once the terrain smoothing step has finished.

## Inputs

- `CostField` built from the shared terrain primitives: sampled height, slope magnitude, water mask, buildability mask, and any existing paved corridors.
- `sources[]` describing attractor coordinates in grid space. In macro mode we pass region hubs, gates, and curated POIs; in cell mode we pass doorways and road anchors.
- `PhysarumParams` containing iteration counts, diffusion / evaporation rates, deposition amount, sensor geometry, and gating thresholds for extracting a network.

## Outputs

1. **Conductance field** (`PhysarumField`) expressing how strongly each cell is traversed by the virtual agents.
2. **Skeleton mask** distilled from the conductance using adaptive thresholding plus thinning.
3. **Road graph** (`RoadGraph`) extracted from the skeleton. Nodes capture junctions / endpoints; edges store polylines, length, curvature metrics, and aggregate terrain cost. Curvature and detour filters keep the network readable.

## Integration points

- **Terrain smoothing stack** – the planner consumes slope and water rasters already produced for smoothing. Its conductance can optionally feed back into the roadbed carving weights.
- **Roadbed / terrace tools** – once the skeleton graph is extracted, its polylines are converted to world-space strips and passed to the existing `buildRoadsGroup` helpers for visualization and carving.
- **Micro cell generator** – cell mode reuses the same graph extraction but clips polylines to parcel grids so that alley overlays merge into the more rectilinear zoning layout near the city core.

## Constraints

- Roads must remain navigable. We enforce a minimum branch length, drop extreme curvature segments, and clamp detours versus the straight-line distance between attractors.
- Physarum augments the existing planners rather than replacing them. Organic curves blend into grids near settlements and respect the slope / water penalties baked into the cost field.
- Everything is feature-flagged in config and mirrored in the dev tools so the solver can be disabled or tuned at runtime.
