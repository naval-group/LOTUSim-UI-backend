import * as yaml from "yaml";
import { Scalar } from "yaml";
import { GeoPoint } from "../geometry";
import { DomainType } from "./physics-interface/physics-interface-base";
import { parseEnum } from "./common-functions";
import {
  Atmosphere,
  Ocean,
  Visibility,
  Environment,
  WeatherCondition,
  WaveSpectrum,
  defaultEnvironment,
} from "./environment";
import {
  PhysicsInterface,
  DomainConfig,
  InterfaceParams,
} from "./physics-interface/physics-interface-base";
import { RenderInterface } from "./render-interface";
import { WaypointFollowerInterface } from "./waypoint-interface";

export interface Agent {
  name: string;
  model: string;
  position: GeoPoint;
  heading: number;
  physicsInterface?: PhysicsInterface;
  renderInterface?: RenderInterface;
  waypointInterface?: WaypointFollowerInterface;
}

// AHOY check waypointfollowerInterface params. Missing range_tolerance and need to rename acc to accel
// Main scenario structure
export class Scenario {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
  agents: Map<string, Agent>;
  timeOfDay: string;
  date: string;
  referencePosition: GeoPoint;
  environment: Environment;

  constructor(
    name: string,
    timeOfDay: string,
    date: string,
    referencePosition: GeoPoint,
    environment: Environment,
    agents: Map<string, Agent>,
    description?: string,
    version?: string,
    author?: string,
    tags?: string[],
  ) {
    this.name = name;
    this.description = description;
    this.version = version;
    this.author = author;
    this.tags = tags;
    this.timeOfDay = timeOfDay;
    this.date = date;
    this.referencePosition = referencePosition;
    // this.environment = environment;
    this.environment = defaultEnvironment;
    this.agents = agents;
  }

  /**
   * Parse a YAML string into a Scenario object
   */
  static fromYAML(yamlContent: string): Scenario {
    return ScenarioParser.parse(yamlContent);
  }

  /**
   * Parse a YAML file into a Scenario object
   */
  static async fromFile(filePath: string): Promise<Scenario> {
    return ScenarioParser.parseFile(filePath);
  }

  // Get a specific agent by name
  getAgent(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  // Get all agent names
  getAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }

  // Add a new agent
  addAgent(name: string, agent: Agent): void {
    this.agents.set(name, agent);
  }

  // Remove an agent
  removeAgent(name: string): boolean {
    return this.agents.delete(name);
  }

  // camelCase object for REST API responses
  toObject(): any {
    const agentsObj: { [key: string]: any } = {};
    this.agents.forEach((agent, name) => {
      agentsObj[name] = {
        model: agent.model,
        position: {
          latitude: agent.position.latitude,
          longitude: agent.position.longitude,
          altitude: agent.position.altitude,
        },
        heading: agent.heading,
        physicsInterface: agent.physicsInterface
          ? {
              initDomain: agent.physicsInterface.initDomain,
              domains: agent.physicsInterface.domains.map((d) => ({
                domain: d.domainType,
                interfaceType: d.interfaceType,
                interfaceParams: { ...d.interfaceParams },
              })),
            }
          : undefined,
        renderInterface: agent.renderInterface
          ? {
              enabled: agent.renderInterface.enabled,
              rendererType: agent.renderInterface.rendererType,
            }
          : undefined,
        waypointInterface: agent.waypointInterface
          ? {
              enabled: agent.waypointInterface.enabled,
              loop: agent.waypointInterface.loop,
              linearAccelLimit: agent.waypointInterface.linearAccelLimit,
              angularAccelLimit: agent.waypointInterface.angularAccelLimit,
              angularVelLimit: agent.waypointInterface.angularVelLimit,
              mode: agent.waypointInterface.mode,
              ...(agent.waypointInterface.waypoints !== undefined && {
                waypoints: agent.waypointInterface.waypoints,
              }),
              ...(agent.waypointInterface.line !== undefined && {
                line: agent.waypointInterface.line,
              }),
              ...(agent.waypointInterface.circle !== undefined && {
                circle: agent.waypointInterface.circle,
              }),
            }
          : undefined,
      };
    });

    return {
      name: this.name,
      description: this.description,
      version: this.version,
      author: this.author,
      tags: this.tags,
      timeOfDay: this.timeOfDay,
      date: this.date,
      referencePosition: {
        latitude: this.referencePosition.latitude,
        longitude: this.referencePosition.longitude,
        altitude: this.referencePosition.altitude,
      },
      environment: this.environment,
      agents: agentsObj,
    };
  }

  // YAML 1.1 parsers (libyaml, PyYAML) misinterpret "14:00" as sexagesimal and
  // "2024-01-15" as a date — force double-quote style to be safe across tools.
  private static quotedScalar(val: string): Scalar {
    const s = new Scalar(val);
    s.type = "QUOTE_DOUBLE";
    return s;
  }

  // snake_case object for YAML serialization
  private toYAMLObject(): any {
    const agentsObj: { [key: string]: any } = {};
    this.agents.forEach((agent, name) => {
      agentsObj[name] = {
        model: agent.model,
        position: {
          latitude: agent.position.latitude,
          longitude: agent.position.longitude,
          altitude: agent.position.altitude,
        },
        heading: agent.heading,
        physics_interface: agent.physicsInterface
          ? {
              init_domain: agent.physicsInterface.initDomain,
              domains: agent.physicsInterface.domains.map((d) => ({
                domain: d.domainType,
                interface_type: d.interfaceType,
                interface_params: { ...d.interfaceParams },
              })),
            }
          : undefined,
        render_interface: agent.renderInterface
          ? {
              enabled: agent.renderInterface.enabled,
              renderer_type: agent.renderInterface.rendererType,
              publish_render: agent.renderInterface.publishRender,
            }
          : undefined,
        waypoint_interface: agent.waypointInterface
          ? {
              enabled: agent.waypointInterface.enabled,
              loop: agent.waypointInterface.loop,
              linear_acc_limit: agent.waypointInterface.linearAccelLimit,
              angular_acc_limit: agent.waypointInterface.angularAccelLimit,
              angular_vel_limit: agent.waypointInterface.angularVelLimit,
              mode: agent.waypointInterface.mode,
              ...(agent.waypointInterface.waypoints !== undefined && {
                waypoints: agent.waypointInterface.waypoints,
              }),
              ...(agent.waypointInterface.line !== undefined && {
                line: agent.waypointInterface.line,
              }),
              ...(agent.waypointInterface.circle !== undefined && {
                circle: agent.waypointInterface.circle,
              }),
            }
          : undefined,
      };
    });

    return {
      name: this.name,
      description: this.description,
      version: this.version,
      author: this.author,
      tags: this.tags,
      time_of_day: Scenario.quotedScalar(this.timeOfDay),
      date: Scenario.quotedScalar(this.date),
      reference_position: {
        latitude: this.referencePosition.latitude,
        longitude: this.referencePosition.longitude,
        altitude: this.referencePosition.altitude,
      },
      environment: this.environment,
      agents: agentsObj,
    };
  }

  // Convert to YAML string
  toYAML(): string {
    return yaml.stringify(this.toYAMLObject());
  }
}

export class ScenarioParser {
  static parse(yamlContent: string): Scenario {
    const data = yaml.parse(yamlContent);

    // ── Metadata ──
    if (!data.name) throw new Error("Missing required field: name");
    if (!data.version) throw new Error("Missing required field: version");

    // ── Reference Position ──
    if (!data.reference_position) {
      throw new Error("Missing required field: reference_position");
    }
    const refPos = new GeoPoint(
      data.reference_position.latitude,
      data.reference_position.longitude,
      data.reference_position.altitude,
    );

    // ── Environment ──
    // if (!data.environment) throw new Error("Missing: environment");
    // if (!data.environment.atmosphere)
    //   throw new Error("Missing: environment.atmosphere");
    // if (!data.environment.ocean) throw new Error("Missing: environment.ocean");
    // if (!data.environment.visibility)
    //   throw new Error("Missing: environment.visibility");

    // const atm = data.environment.atmosphere;
    // const atmosphere: Atmosphere = {
    //   windSpeed: atm.wind_speed,
    //   windDirection: atm.wind_direction,
    //   temperature: atm.temperature,
    //   pressure: atm.pressure,
    //   humidity: atm.humidity,
    // };

    // const ocn = data.environment.ocean;
    // const ocean: Ocean = {
    //   seaState: ocn.sea_state,
    //   waveHeight: ocn.wave_height,
    //   waveDirection: ocn.wave_direction,
    //   wavePeriod: ocn.wave_period,
    //   waveSpectrum: parseEnum(ocn.wave_spectrum, WaveSpectrum, "WaveSpectrum"),
    //   currentSpeed: ocn.current_speed,
    //   currentDirection: ocn.current_direction,
    //   waterTemperature: ocn.water_temperature,
    //   salinity: ocn.salinity,
    // };

    // const vis = data.environment.visibility;
    // const visibility: Visibility = {
    //   horizontal: vis.horizontal,
    //   vertical: vis.vertical,
    // };

    // const environment: Environment = {
    //   atmosphere: atmosphere,
    //   ocean: ocean,
    //   visibility: visibility,
    //   weather: parseEnum(
    //     data.environment.weather,
    //     WeatherCondition,
    //     "WeatherCondition",
    //   ),
    // };
    const environment: Environment = defaultEnvironment;

    // ── Agents ──
    if (!data.agents || typeof data.agents !== "object") {
      throw new Error("Missing or invalid: agents");
    }

    const agentsMap = new Map<string, Agent>();

    for (const [agentName, agentData] of Object.entries(data.agents)) {
      const raw = agentData as any;
      // Data validation
      if (!raw.model) throw new Error(`Agent ${agentName}: missing 'model'`);
      if (!raw.position || typeof raw.position !== "object") {
        throw new Error(`Agent ${agentName}: missing required field 'position'`);
      }
      if (raw.position.latitude === undefined || typeof raw.position.latitude !== "number") {
        throw new Error(`Agent ${agentName}: position.latitude must be a number`);
      }
      if (raw.position.longitude === undefined || typeof raw.position.longitude !== "number") {
        throw new Error(`Agent ${agentName}: position.longitude must be a number`);
      }
      if (raw.position.altitude === undefined || typeof raw.position.altitude !== "number") {
        throw new Error(`Agent ${agentName}: position.altitude must be a number`);
      }
      if (raw.heading !== undefined && typeof raw.heading !== "number") {
        throw new Error(`Agent ${agentName}: heading must be a number`);
      }

      // Parse physics domains (optional)
      let physicsInterface: PhysicsInterface | undefined;
      if (raw.physics_interface) {
        if (!raw.physics_interface.domains || !Array.isArray(raw.physics_interface.domains)) {
          throw new Error(`Agent ${agentName}: physics_interface.domains must be an array`);
        }

        if (!raw.physics_interface.init_domain) {
          throw new Error(`Agent ${agentName}: physics_interface.init_domain is missing`);
        }

        const domainConfigs: DomainConfig[] = raw.physics_interface.domains.map(
          (d: any, index: number) => {
            if (!d.interface_type) {
              throw new Error(`Agent ${agentName}, domain[${index}]: missing 'interface_type'`);
            }
            if (!d.interface_params) {
              throw new Error(`Agent ${agentName}, domain[${index}]: missing 'interface_params'`);
            }

            const domainType = parseEnum(d.domain, DomainType, "DomainType");
            const rawParams =
              typeof d.interface_params === "string"
                ? JSON.parse(d.interface_params)
                : d.interface_params;

            return new DomainConfig(domainType, d.interface_type, new InterfaceParams(rawParams));
          },
        );

        physicsInterface = new PhysicsInterface(
          parseEnum(raw.physics_interface.init_domain, DomainType, "DomainType"),
          domainConfigs,
        );
      }

      // Parse render interface (optional)
      let renderInterface: RenderInterface | undefined;
      if (raw.render_interface) {
        renderInterface = new RenderInterface(
          raw.render_interface.enabled,
          raw.render_interface.renderer_type,
          raw.render_interface.publish_render,
        );
      }

      // Parse waypoint interface (optional)
      let waypointInterface: WaypointFollowerInterface | undefined;
      if (raw.waypoint_interface) {
        const wi = raw.waypoint_interface;
        waypointInterface = new WaypointFollowerInterface(
          wi.enabled,
          wi.loop,
          wi.linear_acc_limit,
          wi.angular_acc_limit,
          wi.angular_vel_limit,
          wi.mode,
          wi.waypoints,
          wi.line,
          wi.circle,
        );
      }

      // Parse pose
      const position = new GeoPoint(
        raw.position.latitude,
        raw.position.longitude,
        raw.position.altitude,
      );

      const heading: number = raw.heading;

      const agent: Agent = {
        name: agentName,
        model: raw.model,
        position: position,
        heading: heading,
        ...(physicsInterface && { physicsInterface }),
        ...(renderInterface && { renderInterface }),
        ...(waypointInterface && { waypointInterface }),
      };
      agentsMap.set(agentName, agent);
    }

    return new Scenario(
      data.name,
      data.time_of_day,
      data.date,
      refPos,
      environment,
      agentsMap,
      data.description,
      data.version != null ? String(data.version) : undefined,
      data.author,
      data.tags,
    );
  }

  static async parseFile(filePath: string): Promise<Scenario> {
    const fs = await import("fs/promises");
    const content = await fs.readFile(filePath, "utf-8");
    return ScenarioParser.parse(content);
  }
}
