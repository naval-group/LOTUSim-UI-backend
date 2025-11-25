# LOTUSim UI backend

## Installation

```shell
source /opt/ros/humble/setup.bash 
npm install ${LOTUSIM_WS}/install/setup.bash
npx generate-ros-messages
npx ts-node src/main.ts
```

## Dev Notes

1. API for post create models

```json
[
    {
        model_name: "name"
        vessel_name: "example_vessel",
        vessel_position: {
            position: { latitude: 10, longitude: 10, elevation: 10 },
        },
        heading: 120,
        lotusim_params: "
           {
            "sensor": {
                "publish_ais": false
            },
            "render_interface": {
                "publish_render": true,
                "renderer_type_name": "frigate"
            },
            "physics_engine_interface": {
                "surface": {
                    "ConnectionType": "XDynWebSocket",
                    "uri": "ws://127.0.0.1:12345",
                    "thrusters": {
                        "thursters1": "PSPropRudd",
                        "thursters2": "SBPropRudd"
                    }
                },
                "init_state": "Surface"
            }
        };

        "
    }
]
```
