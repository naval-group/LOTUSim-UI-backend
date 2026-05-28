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
 * *******************************   ROS INTERFACE MODULE   ***************************
 * ************************************************************************************
 *
 * Provides classes and functions for managing ROS2 node instances, vessel positions,
 * and MAS command actions within the Lotusim simulation environment.
 *
 * Features:
 * - `RosInstance`: manages a ROS2 node for a specific instance, subscribes to vessel
 *   positions, and sends MAS command goals (create, delete, move).
 * - `ROSInstances`: manages multiple RosInstance objects, providing centralized control.
 * - Utilities for creating ROS headers and processing vessel pose data.
 *
 * Notes:
 * - Uses rclnodejs for ROS2 communication.
 * - lat/lon ↔ XY coordinate conversion is a temporary measure pending removal.
 */

import * as rclnodejs from "rclnodejs";
import { GeoPoint, VesselPosition, Pose } from "./geometry";
import { quaternionToGpsHeading } from "../utils";

// ─── ROS Message Types ───────────────────────────────────────

const HeaderMsg = rclnodejs.require("std_msgs/msg/Header");
const VesselPositionArrayMsg = rclnodejs.require("lotusim_msgs/msg/VesselPositionArray");
const MASCmdArrayAction = rclnodejs.require("lotusim_msgs/action/MASCmdArray");
const MASCmdAction = rclnodejs.require("lotusim_msgs/action/MASCmd");
const MASCmdMsg = rclnodejs.require("lotusim_msgs/msg/MASCmd");
const GeoPointMsg = rclnodejs.require("geographic_msgs/msg/GeoPoint");
const SrvString = rclnodejs.require("lotusim_msgs/srv/String");
const Trigger = rclnodejs.require("std_srvs/srv/Trigger");

type VesselPositionArray = InstanceType<typeof VesselPositionArrayMsg>;
type MASCmdArrayGoal = InstanceType<typeof MASCmdArrayAction.Goal>;
type MASCmdArrayFeedback = InstanceType<typeof MASCmdArrayAction.Feedback>;
type MASCmdGoal = InstanceType<typeof MASCmdAction.Goal>;
type MASCmdFeedback = InstanceType<typeof MASCmdAction.Feedback>;

/** REST request body for a single MAS command — camelCase, not the ROS message shape. */
export interface MASCmdRequest {
  cmdType: 0 | 1 | 2; // CREATE_CMD | DELETE_CMD | MOVE_CMD
  sdfString?: string;
  modelName?: string;
  vesselName?: string;
  entity?: number;
  vesselPosition?: Pose;
  geoPoint?: GeoPoint;
  heading?: number;
}

/** REST request body for a batch of MAS commands. */
export interface MASCmdArrayRequest {
  cmd: MASCmdRequest[];
}

// ─── Shared Clock ────────────────────────────────────────────

const systemClock = new rclnodejs.Clock(rclnodejs.ClockType.SYSTEM_TIME);

// ─── Helpers ─────────────────────────────────────────────────

export function getHeaderMsg(): any {
  const header = new HeaderMsg();
  header.frame_id = "world";
  header.stamp = systemClock.now().toMsg();
  return header;
}

// ─── RosInstance ─────────────────────────────────────────────

/**
 * Manages a ROS2 action client and vessel-position subscription for one simulation instance.
 */
class RosInstance {
  readonly #instanceName: string;
  readonly #node: rclnodejs.Node;
  readonly #vesselPositionMap: Map<string, VesselPosition> = new Map();
  readonly #poseSub: rclnodejs.Subscription;
  readonly #masCmdClient: rclnodejs.ActionClient<"lotusim_msgs/action/MASCmd">;
  readonly #masArrayCmdClient: rclnodejs.ActionClient<"lotusim_msgs/action/MASCmdArray">;
  readonly #scenarioLaunchClient: rclnodejs.Client<"lotusim_msgs/srv/String">;
  readonly #scenarioStopClient: rclnodejs.Client<"std_srvs/srv/Trigger">;

  constructor(node: rclnodejs.Node, instanceName: string = "") {
    this.#instanceName = instanceName;
    this.#node = node;

    this.#masCmdClient = new rclnodejs.ActionClient(
      node,
      "lotusim_msgs/action/MASCmd",
      `${instanceName}/mas_cmd`,
    );
    this.#masArrayCmdClient = new rclnodejs.ActionClient(
      node,
      "lotusim_msgs/action/MASCmdArray",
      `${instanceName}/mas_cmd_array`,
    );
    this.#poseSub = node.createSubscription(
      "lotusim_msgs/msg/VesselPositionArray",
      `${instanceName}/poses`,
      this.#poseSubCB.bind(this),
    );
    this.#scenarioLaunchClient = node.createClient(
      "lotusim_msgs/srv/String",
      `${instanceName}/launch_scenario`,
    );
    this.#scenarioStopClient = node.createClient(
      "std_srvs/srv/Trigger",
      `${instanceName}/stop_scenario`,
    );
  }

  get node(): rclnodejs.Node {
    return this.#node;
  }

  get instanceName(): string {
    return this.#instanceName;
  }

  get vesselPositionMap(): Map<string, VesselPosition> {
    return this.#vesselPositionMap;
  }

  getVesselPosition(vesselName: string): VesselPosition | null {
    return this.#vesselPositionMap.get(vesselName) ?? null;
  }

  destroy(): void {
    this.#node.destroySubscription(this.#poseSub);
    this.#masCmdClient.destroy();
    this.#masArrayCmdClient.destroy();
  }

  // ─── Private ───────────────────────────────────────────────

  #poseSubCB(msg: VesselPositionArray | Buffer): void {
    let vesselPositionArray: VesselPositionArray;

    if (Buffer.isBuffer(msg)) {
      try {
        vesselPositionArray = JSON.parse(msg.toString()) as VesselPositionArray;
      } catch {
        console.error("Failed to parse incoming vessel position message.");
        return;
      }
    } else {
      vesselPositionArray = msg;
    }

    this.#vesselPositionMap.clear();

    for (const vesselPosition of vesselPositionArray.vessels) {
      const { vessel_name: vesselName, geo_point: geoPoint, pose } = vesselPosition;

      if (
        !geoPoint ||
        typeof geoPoint.latitude !== "number" ||
        typeof geoPoint.longitude !== "number" ||
        typeof geoPoint.altitude !== "number"
      ) {
        console.warn(`Invalid geoPoint data for vessel: ${vesselName}`);
        continue;
      }

      const point = new GeoPoint(geoPoint.latitude, geoPoint.longitude, geoPoint.altitude);

      const o = pose?.orientation;
      let heading: number | undefined;
      if (
        o &&
        typeof o.x === "number" &&
        typeof o.y === "number" &&
        typeof o.z === "number" &&
        typeof o.w === "number"
      ) {
        heading = quaternionToGpsHeading(o.x, o.y, o.z, o.w);
      } else {
        console.warn(`Invalid orientation data for vessel: ${vesselName}`);
      }

      const position: VesselPosition = {
        vesselName,
        geoPoint: point,
        pose: pose,
        heading: heading,
      };

      this.#vesselPositionMap.set(vesselName, position);
    }
  }

  async #sendGoal<TFeedback>(client: rclnodejs.ActionClient<any>, goal: unknown): Promise<boolean> {
    await client.waitForServer();
    try {
      const goalHandle = await client.sendGoal(goal);
      if (!goalHandle.isAccepted()) {
        console.warn("Goal rejected by the action server.");
        return false;
      }
      const result = await goalHandle.getResult();
      if (goalHandle.isSucceeded()) {
        console.info(`Goal succeeded: ${JSON.stringify(result.result)}`);
        return true;
      }
      console.warn("Goal did not succeed.");
      return false;
    } catch (err) {
      console.error(`Error during action execution: ${err}`);
      return false;
    }
  }

  /**
   * Sends a single MAS command (create, delete, or move) to the action server.
   */
  async sendMASCmd(masCmd: MASCmdGoal): Promise<boolean> {
    return this.#sendGoal(this.#masCmdClient, masCmd);
  }

  /**
   * Sends an array of MAS commands to the action server.
   */
  async sendMASCmdArray(masCmdArray: MASCmdArrayGoal): Promise<boolean> {
    return this.#sendGoal(this.#masArrayCmdClient, masCmdArray);
  }

  /**
   * Sends a DELETE command for every vessel currently tracked by this instance.
   */
  async removeAllVessels(): Promise<boolean> {
    return this.stopScenario();
  }

  async launchScenario(scenario_name: string): Promise<{ success: boolean; message: string }> {
    const request = new SrvString.Request();
    request.data = scenario_name;

    return new Promise((resolve) => {
      this.#scenarioLaunchClient.sendRequest(request, (response: any) => {
        if (response.success) {
          console.log(`[${this.#instanceName}] Scenario launched: ${response.message}`);
        } else {
          console.error(`[${this.#instanceName}] Launch failed: ${response.message}`);
        }
        resolve({ success: response.success, message: response.message ?? "" });
      });
    });
  }

  async stopScenario(): Promise<boolean> {
    const request = new Trigger.Request();

    return new Promise((resolve) => {
      this.#scenarioStopClient.sendRequest(request, (response: any) => {
        if (response.success) {
          console.log(`[${this.#instanceName}] Scenario stopped: ${response.message}`);
        } else {
          console.error(`[${this.#instanceName}] Stop failed: ${response.message}`);
        }
        resolve(response.success);
      });
    });
  }
}

// ─── ROSInstances ────────────────────────────────────────────

/**
 * Centralized manager for multiple RosInstance objects.
 */
export class ROSInstances {
  readonly #instanceMap: Map<string, RosInstance> = new Map();
  readonly #node: rclnodejs.Node;

  constructor() {
    if (rclnodejs.isShutdown()) {
      rclnodejs.init();
    }
    this.#node = new rclnodejs.Node("UserInterfaceNode");
    this.startNode();
  }

  /** Starts spinning the ROS2 node. */
  async startNode(): Promise<void> {
    console.log("Starting ROS node...");
    if (rclnodejs.isShutdown()) {
      await rclnodejs.init();
    }
    this.#node.spin();
    this.#startInstanceSync();
  }

  #startInstanceSync(): void {
    const sync = async () => {
      const active = await this.getActiveSimulation();
      for (const name of active) {
        if (!this.#instanceMap.has(name)) {
          console.log(`Auto-adding new instance: ${name}`);
          await this.addInstance(name);
        }
      }
    };
    setInterval(sync, 5000);
  }

  /** Destroys the ROS2 node and all managed instances. */
  stopNode(): void {
    console.log("Stopping ROS node...");
    try {
      this.#instanceMap.forEach((instance) => instance.destroy());
      this.#instanceMap.clear();
      this.#node.destroy();
      console.log("ROS node stopped successfully.");
    } catch (err) {
      console.error("Error during ROS node shutdown:", err);
    }
  }

  async getNamespaces(): Promise<Set<string>> {
    const topics = this.#node.getTopicNamesAndTypes();
    const namespaces = new Set<string>();
    for (const { name } of topics) {
      const parts = name.split("/").filter(Boolean);
      if (parts.length > 1) namespaces.add(parts[0]);
    }
    return namespaces;
  }

  async getActiveSimulation(): Promise<Set<string>> {
    const topics = this.#node.getNodeNamesAndNamespaces();
    const namespaces = new Set<string>();
    for (const { name, namespace } of topics) {
      if (name.includes("mas_node")) {
        namespaces.add(namespace.replace(/\//g, ""));
      }
    }
    return namespaces;
  }

  /** Adds a new instance. No-ops if an instance with that name already exists. */
  async addInstance(name: string): Promise<void> {
    if (this.#instanceMap.has(name)) {
      console.warn(`Instance '${name}' already exists.`);
      return;
    }
    this.#instanceMap.set(name, new RosInstance(this.#node, name));
  }

  /** Removes an instance and cleans up its ROS resources. No-ops if not found. */
  removeInstance(name: string): void {
    const instance = this.#instanceMap.get(name);
    if (!instance) {
      console.warn(`Instance '${name}' does not exist.`);
      return;
    }
    instance.destroy();
    this.#instanceMap.delete(name);
    console.log(`Instance '${name}' removed.`);
  }

  getInstancesMap(): Map<string, RosInstance> {
    return this.#instanceMap;
  }

  getInstanceNames(): string[] {
    return Array.from(this.#instanceMap.keys());
  }

  getInstancevesselPositionMap(instance: string): Map<string, VesselPosition> | null {
    const ros = this.#instanceMap.get(instance);
    if (!ros) {
      console.warn(`Instance '${instance}' not found.`);
      return null;
    }
    return ros.vesselPositionMap;
  }

  getVesselPosition(instance: string, vesselName: string): VesselPosition | null {
    return this.#instanceMap.get(instance)?.getVesselPosition(vesselName) ?? null;
  }

  /** Sends a DELETE command for all vessels in the given instance. */
  clearVessels(instance: string): void {
    this.#instanceMap.get(instance)?.removeAllVessels();
  }

  /**
   * Sends an array of MAS commands to the given instance.
   */
  async sendMASCmdArray(instance: string, cmds: MASCmdRequest[]): Promise<boolean> {
    const goal: MASCmdArrayGoal = new MASCmdArrayAction.Goal();
    goal.header = { stamp: systemClock.now().toMsg(), frame_id: "world" };
    goal.cmd = [];

    for (const cmd of cmds) {
      const rosCmd = new MASCmdMsg();
      rosCmd.cmd_type = cmd.cmdType;
      if (cmd.sdfString !== undefined) rosCmd.sdf_string = cmd.sdfString;
      if (cmd.modelName !== undefined) rosCmd.model_name = cmd.modelName;
      if (cmd.vesselName !== undefined) rosCmd.vessel_name = cmd.vesselName;
      if (cmd.geoPoint) {
        if (!rosCmd.geo_point) rosCmd.geo_point = new GeoPointMsg();
        rosCmd.geo_point.latitude = cmd.geoPoint.latitude;
        rosCmd.geo_point.longitude = cmd.geoPoint.longitude;
        rosCmd.geo_point.altitude = cmd.geoPoint.altitude;
      }
      if (cmd.heading !== undefined) rosCmd.heading = cmd.heading;
      goal.cmd.push(rosCmd);
    }

    try {
      return (await this.#instanceMap.get(instance)?.sendMASCmdArray(goal)) ?? false;
    } catch (err) {
      console.error("sendMASCmdArray failed:", err);
      return false;
    }
  }

  /**
   * Sends a single MAS command to the given instance.
   * Note: lat/lon → XY conversion is a temporary measure.
   */
  async sendMASCmd(instance: string, cmd: MASCmdRequest): Promise<boolean> {
    const goal: MASCmdGoal = new MASCmdAction.Goal();
    goal.header = { stamp: systemClock.now().toMsg(), frame_id: "world" };
    goal.cmd.cmd_type = cmd.cmdType;
    if (cmd.sdfString !== undefined) goal.cmd.sdf_string = cmd.sdfString;
    if (cmd.modelName !== undefined) goal.cmd.model_name = cmd.modelName;
    if (cmd.vesselName !== undefined) goal.cmd.vessel_name = cmd.vesselName;
    if (cmd.geoPoint) {
      if (!goal.cmd.geo_point) goal.cmd.geo_point = new GeoPointMsg();
      goal.cmd.geo_point.longitude = cmd.geoPoint.longitude;
      goal.cmd.geo_point.latitude = cmd.geoPoint.latitude;
      goal.cmd.geo_point.altitude = cmd.geoPoint.altitude;
    }
    if (cmd.heading !== undefined) goal.cmd.heading = cmd.heading;
    try {
      return (await this.#instanceMap.get(instance)?.sendMASCmd(goal)) ?? false;
    } catch (err) {
      console.error("sendMASCmd failed:", err);
      return false;
    }
  }

  async launchScenario(
    instance: string,
    scenario_name: string,
  ): Promise<{ success: boolean; message: string }> {
    return (
      this.#instanceMap.get(instance)?.launchScenario(scenario_name) ?? {
        success: false,
        message: `Instance '${instance}' not found.`,
      }
    );
  }

  async stopScenario(instance: string): Promise<boolean> {
    return this.#instanceMap.get(instance)?.stopScenario() ?? false;
  }
}

export const rosInstances = new ROSInstances();
