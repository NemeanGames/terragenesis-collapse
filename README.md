# TerraGenesis‑Collapse

TerraGenesis‑Collapse is a menu‑driven survival simulation inspired by the
planetary management game *TerraGenesis* and the zombie‑infested setting of
Dead Town Remake (DTR).  Each procedurally generated map acts as a zone you
must reclaim by establishing a field camp, managing survivors, constructing
facilities, balancing resources and countering rising hostility.  The final
objective is to restore multiple regions and rebuild civilization.

## Features

* Procedural terrain generation using a modified diamond–square algorithm.
* Idle resource generation and survivor task assignments.
* Modular facilities (shelters, generators, purifiers, workshops) that
  improve key stats and unlock new actions.
* Hostility meter representing the increasing threat of zombie hordes.
* Reactive events and narrative radio messages to enrich the storyline.
* Multi‑zone meta‑progression: reclaimed zones grant permanent bonuses.

## Getting Started

This repository is bootstrapped using the **AGENT_BOOTSTRAP v4.1** orchestrator
prompt.  To reproduce the build locally or in a Codex session, make sure the
environment variables defined in `AGENT_BOOTSTRAP_v4.1.md` are set.  The
orchestrator will run eight parallel packets (Design, Data, Core, UI,
Economy, State, QA, Deploy) to assemble the full project.

The game is built with React and Three.js.  The menu system overlays a
web‑based 3D map, allowing you to assign tasks, build structures and monitor
resources without leaving the world view.

## License

This project is licensed under the MIT License (see `LICENSE` for details).
