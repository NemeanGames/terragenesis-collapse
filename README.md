# TerraGenesis‑Collapse

TerraGenesis‑Collapse is a menu‑driven survival simulation inspired by the
planetary management game *TerraGenesis* and the zombie‑infested setting of
Dead Town Remake (DTR). Each procedurally generated map acts as a zone you
must reclaim by establishing a field camp, managing survivors, constructing
facilities, balancing resources and countering rising hostility. The final
objective is to restore multiple regions and rebuild civilization.

## Features

- Procedural terrain generation using a modified diamond–square algorithm.
- Idle resource generation and survivor task assignments.
- Modular facilities (shelters, generators, purifiers, workshops) that improve
  key stats and unlock new actions.
- Hostility meter representing the increasing threat of zombie hordes.
- Reactive events and narrative radio messages to enrich the storyline.
- Multi‑zone meta‑progression: reclaimed zones grant permanent bonuses.

## Getting Started

This repository now contains a full Vite + React + TypeScript project. To run
it locally:

```bash
npm install
npm run dev
```

The development server defaults to [http://localhost:5173](http://localhost:5173).

### Testing

Vitest is configured for unit tests.

```bash
npm run test -- --run
```

### Production Build

```bash
npm run build
npm run preview
```

## Gameplay Overview

- **Simulation loop** – Every tick (default 30 in‑game minutes) the camp
  generates resources based on facilities and survivor assignments while
  hostility rises. Survivors can scavenge, defend, research or terraform.
- **Facilities** – Build structures to unlock new outputs (credits, research,
  oxygen reserves) or suppress hostility. Costs and upkeep draw from shared
  resources.
- **Projects** – Launch longer running initiatives for big payoffs. Progress is
  shown on the right sidebar alongside survivor morale.
- **Events** – Random radio transmissions grant bonuses or apply pressure (e.g.
  oxygen leaks, horde scouts). Completed projects and construction also surface
  log entries.
- **3D Map** – The Three.js world provides a terrain backdrop with toggles for
  rivers, roads and landmarks. Adjust the procedural seed or elevation scale in
  the Actions panel.

## Deployment to GitHub Pages

A GitHub Actions workflow (`.github/workflows/deploy.yml`) is provided. Once the
repository is pushed to GitHub:

1. Ensure the default branch is named `main` (or update the workflow trigger).
2. Enable GitHub Pages with the source set to **GitHub Actions** under
   *Settings → Pages*.
3. Push to `main`; the workflow will build the Vite app and publish the `dist`
   directory using `actions/deploy-pages`.

After the workflow completes the site will be available at:

```
https://<your-github-username>.github.io/terragenesis-collapse/
```

Replace `<your-github-username>` with the owner of the repository to obtain the
playable web link.

### Verifying that GitHub Pages is live

Run the helper script after deployment to confirm the site is reachable. Pass
your published URL explicitly or expose it through the `GITHUB_PAGES_URL`
environment variable:

```bash
# using an explicit flag
npm run check:pages -- --url https://<your-github-username>.github.io/terragenesis-collapse/

# or relying on an environment variable
GITHUB_PAGES_URL=https://<your-github-username>.github.io/terragenesis-collapse/ npm run check:pages
```

The script will report a success status code when the site responds, or an
error after the configured retry attempts if it is still propagating.

## License

This project is licensed under the MIT License (see `LICENSE` for details).
