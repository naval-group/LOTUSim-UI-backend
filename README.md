# LOTUSim UI - Backend

The server behind the [LOTUSim UI frontend](https://github.com/naval-group/LOTUSim-UI-frontend): a REST + WebSocket API (Express + TypeScript) that bridges the UI to a running LOTUSim simulation over ROS 2.

If you don't need the UI, you can call this API directly, or skip it entirely and talk to LOTUSim's ROS 2 topics/services yourself.

---

## Installation

The devShell brings ROS 2 jazzy, Node 22, python3 and LOTUSim's messages, so these three lines are the whole setup:

```shell
nix develop github:naval-group/LOTUSim#ui-backend
npm run setup
npx ts-node src/main.ts
```

`nix develop` in this repo gives the same shell with core ROS messages only - enough to compile and type-check, which is what CI does. `lotusim_msgs` comes from LOTUSim, so the shell that has it is composed there.

`npm run setup` is how dependencies get installed here: `npm ci --ignore-scripts`, then `rm -rf node_modules/rclnodejs/prebuilds`, then `npm rebuild rclnodejs`. It compiles the native addon against the devShell's ROS and runs `generate-ros-messages` as its `postinstall`.

Removing `prebuilds/` is what makes the compile happen. `rclnodejs` ships prebuilt addons and picks one by `/etc/os-release` codename: on Ubuntu noble it takes `jazzy-noble-x64-node-rclnodejs.node`, a binary linked against `/opt/ros/jazzy`, and prefers it over anything built locally. With the directory gone, the addon built here is the only candidate.

> `generate-ros-messages` generates the TypeScript bindings for LOTUSim's ROS 2 messages via `rclnodejs`: needed once, and again any time the underlying message definitions change. It also runs automatically as part of `npm run build`, but not `npm run dev`, so it needs to be run manually the first time (or after message changes) if you're using `ts-node` directly.

The server starts on **`http://localhost:5000`** by default - override with the `PORT` environment variable. It also opens a WebSocket server on the same port, broadcasting vessel state on a 2-second interval.

## Packaging

`nix develop` above is the dev loop. `nix build .` packages the server instead - `npm ci`, the native addon and `tsc` all inside the sandbox, with the addon's `RUNPATH` stamped into the store:

```shell
nix build .
```

**`nix build .` on its own produces a build-and-typecheck artifact, not a runnable server.** `src/interfaces/ros.ts` requires `lotusim_msgs` at module load, and this repo deliberately does not depend on LOTUSim - so the standalone package carries core ROS messages only and exits at startup with *"The message required does not exist: lotusim_msgs"*. That is by design, not a bug.

A runnable server comes from [`naval-group/LOTUSim`](https://github.com/naval-group/LOTUSim), which passes its own messages in:

```shell
nix run github:naval-group/LOTUSim#ui-backend
```

The flake exports `lib.mkBackend` and `lib.mkBackendShell` for that purpose - builders taking `rosMessages` and `assets` as arguments rather than flake inputs, so the dependency points one way (LOTUSim -> UI) and this repo stays independently buildable.

The build closure includes the ROS stack, which is **not in `cache.nixos.org`**. Without `ros.cachix.org` configured, Nix compiles it from source over about an hour with no error and no warning. A flake's `nixConfig` is ignored for users outside `trusted-users`, so the real fix needs root once:

```shell
sudo tee -a /etc/nix/nix.conf <<'EOF'
extra-substituters = https://ros.cachix.org
extra-trusted-public-keys = ros.cachix.org-1:dSyZxI8geDCJrwgvCOHDoAfOm5sV1wCPjBkKL+38Rvo=
EOF
sudo systemctl restart nix-daemon
```

The devShell and the package default to Node 22, matching the frontend. Node 24 also builds and runs - `rclnodejs` 2.x is N-API, so the addon is no longer pinned to a Node major.

---

## API Overview

All endpoints return `{ success: boolean, ... }`. Full request/response typing is in `src/routes/`.

| Group | Endpoints | Purpose |
|---|---|---|
| **Health** | `GET /health` | Liveness check |
| **Models** | `GET /models`, `GET /model/:name`, `POST /model`, `DELETE /model/:name` | List/create/delete models - generates a Gazebo SDF + Xdyn YAML from structured JSON (mesh, sensors, propellers, rudders, damping matrices, etc.) |
| **Scenarios** | `GET /scenarios`, `GET /scenario/:file_name`, `POST /scenario`, `PUT /scenario`, `DELETE /scenario/:name` | Create/edit/save/delete scenarios (name, agents, environment, reference position) |
| **Instances** | `GET /instances`, `GET /instance/:name`, `POST /instance`, `DELETE /instance/:name` | List/inspect/create/delete simulation instances - **see Known Issues, create/delete are currently stubs** |
| **Runtime control** | `GET /instance/:instance/vessels`, `GET /instance/:instance/vessel?name=`, `POST /instance/:instance/vessel`, `POST /instance/:instance/vessels`, `DELETE /instance/:instance/vessels`, `POST /instance/:instance/start-scenario`, `POST /instance/:instance/stop-scenario` | Spawn/move/delete vessels via MAS commands, and launch/stop a saved scenario, against a running instance |
| **Upload** | `POST /upload` | File upload (e.g. STL meshes for new models) |

Model files are also served statically at `/models/...`.

---

## Creating a Scenario / Adding a Vessel

A scenario (`Scenario`) has a name, reference position, environment, and a set of named **agents**. Each agent (`Agent`) has:

```ts
{
  name: string;
  model: string;
  position: { latitude: number; longitude: number; altitude: number };
  heading: number;
  physicsInterface?: { initDomain: ..., /* per-domain config */ };
  renderInterface?: { ... };
  waypointInterface?: { ... };
}
```

---

## Related

- [LOTUSim UI Frontend](https://github.com/naval-group/LOTUSim-UI-frontend) - the React app this backend serves
- [LOTUSim](https://github.com/naval-group/LOTUSim) - the core simulator
- [Full documentation (wiki)](https://github.com/naval-group/LOTUSim/wiki)
