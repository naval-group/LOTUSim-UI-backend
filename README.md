# LOTUSim UI - Backend

The server behind the [LOTUSim UI frontend](https://github.com/naval-group/LOTUSim-UI-frontend): a REST + WebSocket API (Express + TypeScript) that bridges the UI to a running LOTUSim simulation over ROS 2.

If you don't need the UI, you can call this API directly, or skip it entirely and talk to LOTUSim's ROS 2 topics/services yourself.

---

## Installation

```shell
source /opt/ros/humble/setup.bash
source ${LOTUSIM_WS}/install/setup.bash

npm install
npx generate-ros-messages
npx ts-node src/main.ts
```

> `generate-ros-messages` generates the TypeScript bindings for LOTUSim's ROS 2 messages via `rclnodejs`: needed once, and again any time the underlying message definitions change. It also runs automatically as part of `npm run build`, but not `npm run dev`, so it needs to be run manually the first time (or after message changes) if you're using `ts-node` directly.

The server starts on **`http://localhost:5000`** by default - override with the `PORT` environment variable. It also opens a WebSocket server on the same port, broadcasting vessel state on a 2-second interval.

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
