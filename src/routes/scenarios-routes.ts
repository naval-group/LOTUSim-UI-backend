/*
 * Copyright (c) 2025 Naval Group
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 */

/**
 * ************************************************************************************
 * *******************************   SCENARIOS Routes  ********************************
 * ************************************************************************************
 *
 * Provides an API for managing simulation scenarios.
 *
 * Features:
 * - Lists all available scenarios.
 * - Creates a new scenario.
 * - Deletes an existing scenario by name.
 *
 * Endpoints:
 * - GET    /scenarios           -> List all scenarios.
 * - GET    /scenario/:file_name -> Get a specific scenario.
 * - POST   /scenario            -> Create a new scenario.
 * - PUT    /scenario/:file_name -> Update an existing scenario.
 * - DELETE /scenario/:name      -> Delete a scenario by name.
 *
 */

import path from "path";
import fs from "fs";
import yaml from "yaml";
import { Router, Request, Response } from "express";
import { ScenarioParser, Scenario } from "../interfaces/lotusim/scenario";
import { scenariosPath, errorMessage } from "../utils";

// ─── Request / Response Types ────────────────────────────────

interface CreateScenarioRequest {
  name: string;
  description?: string;
  version: string;
  author?: string;
  tags?: string[];
  timeOfDay: string;
  date: string;
  referencePosition: {
    latitude: number;
    longitude: number;
    altitude: number;
    heading?: number;
  };
  environment: {
    atmosphere: {
      windSpeed: number;
      windDirection: number;
      temperature: number;
      pressure: number;
      humidity: number;
    };
    ocean: {
      seaState: number;
      waveHeight: number;
      waveDirection: number;
      wavePeriod: number;
      waveSpectrum: string;
      currentSpeed: number;
      currentDirection: number;
      waterTemperature: number;
      salinity: number;
    };
    visibility: {
      horizontal: number;
      vertical: number;
    };
    weather: string;
  };
  agents: {
    [agentName: string]: {
      model: string;
      position: {
        latitude: number;
        longitude: number;
        altitude: number;
      };
      heading: number;
      physicsInterface?: {
        initDomain: string;
        domains: Array<{
          domain: string;
          interfaceType: string;
          interfaceParams: any;
        }>;
      };
      renderInterface?: {
        enabled: boolean;
        rendererType: string;
        publishRender: boolean;
      };
      waypointInterface?: {
        enabled: boolean;
        loop: boolean;
        linearAccelLimit: number;
        angularAccelLimit: number;
        angularVelLimit: number;
        mode: string;
        waypoints?: { lat: number; lng: number }[];
        line?: { direction: number; length: number };
        circle?: { radius: number };
      };
    };
  };
}

interface ScenarioResponse {
  success: boolean;
  message: string;
  scenario_id?: string;
  file_path?: string;
  data?: any;
}

// ─── Validation ──────────────────────────────────────────────

const validateScenarioRequest = (
  body: CreateScenarioRequest,
): { valid: boolean; error?: string } => {
  if (!body.name) {
    return { valid: false, error: "Missing required field: name" };
  }
  if (!body.version) {
    return { valid: false, error: "Missing required field: version" };
  }
  if (!body.timeOfDay) {
    return { valid: false, error: "Missing required field: timeOfDay" };
  }
  if (!body.date) {
    return { valid: false, error: "Missing required field: date" };
  }

  // Validate reference position
  if (!body.referencePosition) {
    return {
      valid: false,
      error: "Missing required field: referencePosition",
    };
  }
  if (typeof body.referencePosition.latitude !== "number") {
    return {
      valid: false,
      error: "referencePosition.latitude must be a number",
    };
  }
  if (typeof body.referencePosition.longitude !== "number") {
    return {
      valid: false,
      error: "referencePosition.longitude must be a number",
    };
  }
  if (typeof body.referencePosition.altitude !== "number") {
    return {
      valid: false,
      error: "referencePosition.altitude must be a number",
    };
  }

  // Validate agents
  if (!body.agents || typeof body.agents !== "object") {
    return { valid: false, error: "Missing or invalid field: agents" };
  }

  for (const [agentName, agentData] of Object.entries(body.agents)) {
    if (!agentData.model) {
      return {
        valid: false,
        error: `Agent '${agentName}': missing required field 'model'`,
      };
    }

    // Validate position
    if (!agentData.position || typeof agentData.position !== "object") {
      return {
        valid: false,
        error: `Agent '${agentName}': missing required field 'position'`,
      };
    }
    if (typeof agentData.position.latitude !== "number") {
      return {
        valid: false,
        error: `Agent '${agentName}': position.latitude must be a number`,
      };
    }
    if (typeof agentData.position.longitude !== "number") {
      return {
        valid: false,
        error: `Agent '${agentName}': position.longitude must be a number`,
      };
    }
    if (typeof agentData.position.altitude !== "number") {
      return {
        valid: false,
        error: `Agent '${agentName}': position.altitude must be a number`,
      };
    }

    // Validate physicsInterface if provided
    if (agentData.physicsInterface) {
      if (!agentData.physicsInterface.initDomain) {
        return {
          valid: false,
          error: `Agent '${agentName}': physicsInterface.initDomain is missing`,
        };
      }

      if (
        !Array.isArray(agentData.physicsInterface.domains) ||
        agentData.physicsInterface.domains.length === 0
      ) {
        return {
          valid: false,
          error: `Agent '${agentName}': physicsInterface.domains must be a non-empty array`,
        };
      }
    }

    // Validate renderInterface if provided
    if (agentData.renderInterface) {
      if (typeof agentData.renderInterface.enabled !== "boolean") {
        return {
          valid: false,
          error: `Agent '${agentName}': renderInterface.enabled must be a boolean`,
        };
      }
    }

    // Validate waypointInterface if provided
    if (agentData.waypointInterface) {
      const wp = agentData.waypointInterface;

      if (typeof wp.enabled !== "boolean") {
        return {
          valid: false,
          error: `Agent '${agentName}': waypointInterface.enabled must be a boolean`,
        };
      }

      if (typeof wp.loop !== "boolean") {
        return {
          valid: false,
          error: `Agent '${agentName}': waypointInterface.loop must be a boolean`,
        };
      }

      const validModes = ["waypoints", "line", "circle"];
      if (!validModes.includes(wp.mode)) {
        return {
          valid: false,
          error: `Agent '${agentName}': waypointInterface.mode must be one of: ${validModes.join(", ")}`,
        };
      }

      if (wp.mode === "waypoints") {
        if (!Array.isArray(wp.waypoints) || wp.waypoints.length === 0) {
          return {
            valid: false,
            error: `Agent '${agentName}': waypointInterface.waypoints must be a non-empty array when mode is 'waypoints'`,
          };
        }
        if (typeof wp.linearAccelLimit !== "number") {
          return {
            valid: false,
            error: `Agent '${agentName}': waypointInterface.linearAccelLimit must be a number`,
          };
        }
        if (typeof wp.angularAccelLimit !== "number") {
          return {
            valid: false,
            error: `Agent '${agentName}': waypointInterface.angularAccelLimit must be a number`,
          };
        }
        if (typeof wp.angularVelLimit !== "number") {
          return {
            valid: false,
            error: `Agent '${agentName}': waypointInterface.angularVelLimit must be a number`,
          };
        }
      } else if (wp.mode === "line") {
        if (
          !wp.line ||
          typeof wp.line.direction !== "number" ||
          typeof wp.line.length !== "number"
        ) {
          return {
            valid: false,
            error: `Agent '${agentName}': waypointInterface.line must have numeric direction and length when mode is 'line'`,
          };
        }
      } else if (wp.mode === "circle") {
        if (!wp.circle || typeof wp.circle.radius !== "number") {
          return {
            valid: false,
            error: `Agent '${agentName}': waypointInterface.circle must have a numeric radius when mode is 'circle'`,
          };
        }
      }
    }
  }

  return { valid: true };
};

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Creates a Scenario from a CreateScenarioRequest by converting
 * the request body to YAML and parsing it through ScenarioParser.
 * This ensures all enum parsing, validation, and class construction
 * happens in one place.
 */
const createScenarioFromRequest = (body: CreateScenarioRequest): Scenario => {
  const scenario_agents: Record<string, any> = {};
  for (const [agentName, agent] of Object.entries(body.agents)) {
    scenario_agents[agentName] = {
      model: agent.model,
      position: agent.position,
      heading: agent.heading,
      ...(agent.physicsInterface && {
        physics_interface: {
          init_domain: agent.physicsInterface.initDomain,
          domains: agent.physicsInterface.domains.map((d) => ({
            domain: d.domain,
            interface_type: d.interfaceType,
            interface_params: d.interfaceParams,
          })),
        },
      }),
      ...(agent.renderInterface && {
        render_interface: {
          enabled: agent.renderInterface.enabled,
          renderer_type: agent.renderInterface.rendererType,
          publish_render: agent.renderInterface.publishRender,
        },
      }),
      ...(agent.waypointInterface && {
        waypoint_interface: {
          enabled: agent.waypointInterface.enabled,
          loop: agent.waypointInterface.loop,
          linear_acceleration_limit: agent.waypointInterface.linearAccelLimit,
          angular_acceleration_limit: agent.waypointInterface.angularAccelLimit,
          angular_velocity_limit: agent.waypointInterface.angularVelLimit,
          mode: agent.waypointInterface.mode,
          ...(agent.waypointInterface.waypoints !== undefined && {
            waypoints: agent.waypointInterface.waypoints,
          }),
          ...(agent.waypointInterface.line !== undefined && { line: agent.waypointInterface.line }),
          ...(agent.waypointInterface.circle !== undefined && {
            circle: agent.waypointInterface.circle,
          }),
        },
      }),
    };
  }
  const yamlData = {
    name: body.name,
    description: body.description,
    version: body.version,
    author: body.author,
    tags: body.tags,
    time_of_day: body.timeOfDay,
    date: body.date,
    reference_position: body.referencePosition,
    agents: scenario_agents,
  };
  return ScenarioParser.parse(yaml.stringify(yamlData));
};

/**
 * Helper function to create/update scenario file
 */
const createScenarioFile = async (
  filePath: string,
  body: CreateScenarioRequest,
): Promise<{ scenario: Scenario; yamlContent: string }> => {
  const scenario = createScenarioFromRequest(body);
  const yamlContent = scenario.toYAML();
  // Ensure scenarios directory exists
  await fs.promises.mkdir(scenariosPath, { recursive: true });

  // Write YAML file
  await fs.promises.writeFile(filePath, yamlContent, "utf-8");

  return { scenario, yamlContent };
};

/**
 * Helper function to delete scenario file
 */
const deleteScenarioFile = async (fileName: string): Promise<void> => {
  const filePath = path.join(scenariosPath, fileName);

  try {
    await fs.promises.access(filePath);
  } catch {
    throw new Error(`Scenario '${fileName}' not found`);
  }

  await fs.promises.rm(filePath, { recursive: true, force: true });
};

// ─── Routes ──────────────────────────────────────────────────

const router = Router();

/**
 * GET /scenarios
 * Lists all scenario YAML files in the scenarios directory
 */
router.get("/scenarios", async (req: Request, res: Response): Promise<void> => {
  try {
    const entries = await fs.promises.readdir(scenariosPath, { withFileTypes: true });

    const yamlFiles = entries
      .filter(
        (entry) => entry.isFile() && (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")),
      )
      .map((entry) => entry.name);

    res.json({
      success: true,
      count: yamlFiles.length,
      scenarios: yamlFiles,
    });
  } catch (err: unknown) {
    console.error("Error listing scenarios:", err);
    res.status(500).json({
      success: false,
      message: "Error reading scenarios directory",
    });
  }
});

/**
 * GET /scenario/:file_name
 * Gets the contents and info of a specific scenario file
 */
router.get("/scenario/:file_name", async (req: Request, res: Response): Promise<void> => {
  try {
    const { file_name } = req.params;

    if (!file_name) {
      res.status(400).json({
        success: false,
        message: "Scenario file name is required",
      });
      return;
    }

    const fileName =
      file_name.endsWith(".yaml") || file_name.endsWith(".yml") ? file_name : `${file_name}.yaml`;

    const filePath = path.join(scenariosPath, fileName);

    try {
      await fs.promises.access(filePath);
    } catch {
      res.status(404).json({
        success: false,
        message: `Scenario '${fileName}' not found`,
      });
      return;
    }

    const scenario = await Scenario.fromFile(filePath);
    res.status(200).json({
      success: true,
      file_name: fileName,
      file_path: filePath,
      data: scenario.toObject(),
    });
  } catch (error) {
    console.error("Error reading scenario:", error);
    res.status(500).json({
      success: false,
      message: errorMessage(error),
    });
  }
});

/**
 * POST /scenario
 * Creates a new scenario YAML file
 */
router.post(
  "/scenario",
  async (
    req: Request<{}, ScenarioResponse, CreateScenarioRequest>,
    res: Response<ScenarioResponse>,
  ): Promise<void> => {
    try {
      const validation = validateScenarioRequest(req.body);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          message: validation.error!,
        });
        return;
      }

      const fileName = `${req.body.name}.yaml`;
      const filePath = path.join(scenariosPath, fileName);
      const { scenario } = await createScenarioFile(filePath, req.body);

      res.status(201).json({
        success: true,
        message: "Scenario created successfully",
        scenario_id: fileName,
        file_path: filePath,
        data: scenario.toObject(),
      });
    } catch (error) {
      console.error("Error creating scenario:", error);
      res.status(500).json({
        success: false,
        message: errorMessage(error),
      });
    }
  },
);

/**
 * PUT /scenario/:file_name
 * Updates an existing scenario file
 */
router.put(
  "/scenario/:file_name",
  async (
    req: Request<{ file_name: string }, ScenarioResponse, CreateScenarioRequest>,
    res: Response<ScenarioResponse>,
  ): Promise<void> => {
    try {
      const { file_name } = req.params;
      if (!file_name) {
        res.status(400).json({
          success: false,
          message: "Scenario file name is required",
        });
        return;
      }
      const fileName =
        file_name.endsWith(".yaml") || file_name.endsWith(".yml") ? file_name : `${file_name}.yaml`;
      const validation = validateScenarioRequest(req.body);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          message: validation.error!,
        });
        return;
      }

      const filePath = path.join(scenariosPath, fileName);

      const { scenario } = await createScenarioFile(filePath, req.body);

      res.status(200).json({
        success: true,
        message: "Scenario updated successfully",
        scenario_id: fileName.replace(/\.(yaml|yml)$/, ""),
        file_path: filePath,
        data: scenario.toObject(),
      });
    } catch (error) {
      console.error("Error updating scenario:", error);
      res.status(500).json({
        success: false,
        message: errorMessage(error),
      });
    }
  },
);

/**
 * DELETE /scenario/:name
 * Deletes a scenario file by name
 */
router.delete("/scenario/:name", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;

    if (!name) {
      res.status(400).json({
        success: false,
        message: "Scenario name is required",
      });
      return;
    }

    const fileName = name.endsWith(".yaml") || name.endsWith(".yml") ? name : `${name}.yaml`;

    await deleteScenarioFile(fileName);

    res.status(200).json({
      success: true,
      message: `Scenario '${fileName}' deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting scenario:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: errorMessage(error),
    });
  }
});

export default router;
