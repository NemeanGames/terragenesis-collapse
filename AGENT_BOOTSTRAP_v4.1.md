# AGENT_BOOTSTRAP v4.1

This bootstrap file defines the orchestration prompt and packet breakdown for
codifying a cross‑functional project. When run through the Codex orchestration
system, the agent will spin up eight parallel packets (Design, Data,
Core, UI, Economy, State, QA, Deploy) that work together to generate a fully
functional project. After all packets have completed and passed their gates
successfully, the aggregator merges their outputs and deploys the resulting
site to GitHub Pages by default (falling back to Vercel when GitHub Pages is
not available).

## Orchestrator Start (v4.1)

Below is the orchestrator prompt used to initialise the extended mode. This
prompt instructs each packet to focus on its own domain while passing
structured responses back to the aggregator. The aggregated result is the
complete project described by the user.

```
You are the orchestrator for a multi‑agent Codex session. Eight packets will run
in parallel: design, data, core, UI, economy, state, QA, and deploy. Each
packet must return a JSON object with a `module` and `content` field. The
content should be the code, documentation, test cases or deployment steps for
that packet. When all packets have returned and passed linting/CI gates,
aggregate their outputs in module order and deploy. Use extended mode.

Packets:
 1. **Design** – outline the high‑level architecture, key features, and UI/UX
    flow of the application. Provide wireframe descriptions and any diagrams
    needed to clarify interactions.
 2. **Data** – define the data models, schemas and state structures required
    for the simulation, including the zone state JSON and persistent storage.
 3. **Core** – implement the core simulation loop for resource generation,
    survivor assignment, facility effects and hostility management.
 4. **UI** – build a menu‑driven interface in React that sits on top of the
    existing Three.js map. Provide components for zone overview, tasks,
    construction and event logs.
 5. **Economy** – specify resource costs, upgrade curves, and balancing rules.
    Include formulas or tables where appropriate.
 6. **State** – handle persistent state, offline progress (idle ticks), and
    time skipping. Define how state is saved and loaded (e.g. localStorage or
    backend API).
 7. **QA** – write tests and validation scripts to ensure each module works
    correctly. Use Jest or your preferred testing framework.
 8. **Deploy** – describe how to build and deploy the project. Provide
    commands for building the React app and deploying to GitHub Pages or
    Vercel.

Use this prompt verbatim when starting the orchestrator.
```

## Environment Variables

To run extended mode properly, the following environment variables should be
set in the Codex session or CI pipeline:

| Variable            | Purpose                                          |
|---------------------|---------------------------------------------------|
| `ORCHESTRATOR_MODE` | Should be set to `extended` to enable 8 packets. |
| `PUBLIC_URL`        | Base URL for deploying the site (GitHub Pages).  |
| `VERCEL_TOKEN`      | API token for Vercel deployment (optional).      |

Include any additional secrets or keys required by your project as
encrypted repository secrets rather than hard‑coding them in source files.
