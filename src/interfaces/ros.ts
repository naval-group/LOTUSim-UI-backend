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
 * and MAS command actions within Lotusim simulation environment.
 *
 * Features include:
 * - `RosInstance` class: manages a ROS2 node for a specific instance, subscribes to vessel positions,
 *   and sends MAS command goals (create, delete, move).
 * - `ROSInstances` class: manages multiple RosInstance objects, providing centralized control.
 * - Utilities for creating ROS headers and processing vessel pose data.
 *
 * Notes:
 * - Uses rclnodejs for ROS2 communication.
 * - Coordinates conversion (lat/lon ↔ XY) to be removed
 */

import * as rclnodejs from 'rclnodejs';
import { GeoPoint, latLonToXY } from './geometry';
import { quaternionToGpsHeading } from '../utils';
const Header = rclnodejs.require('std_msgs/msg/Header');

//  Msg class for ros msg
const VesselPositionArrayInclude = rclnodejs.require('lotusim_msgs/msg/VesselPositionArray');
type VesselPositionArray = InstanceType<typeof VesselPositionArrayInclude>;

const MASCmdArray = rclnodejs.require('lotusim_msgs/action/MASCmdArray');
type MASCmdArrayGoal = InstanceType<typeof MASCmdArray.Goal>;
type MASCmdArrayResult = InstanceType<typeof MASCmdArray.Result>;
type MASCmdArrayFeedback = InstanceType<typeof MASCmdArray.Feedback>;

const MASCmd = rclnodejs.require('lotusim_msgs/action/MASCmd');
type MASCmdGoal = InstanceType<typeof MASCmd.Goal>;
type MASCmdResult = InstanceType<typeof MASCmd.Result>;
type MASCmdFeedback = InstanceType<typeof MASCmd.Feedback>;

const MASCmdMsg = rclnodejs.require('lotusim_msgs/msg/MASCmd');
const clock = new rclnodejs.Clock();

/**
 * Helper function to create header msg
 * @returns HeaderMsg
 */
export function getHeaderMsg(): rclnodejs.InterfaceType<Headers> {
    const header = new Header();
    header.frame_id = "world";
    const clock = new rclnodejs.Clock(rclnodejs.ClockType.SYSTEM_TIME);
    const now = clock.now();
    header.stamp = now.toMsg();
    return header;
}

/**
 * Represents a ROS2 node client for a specific instance, managing action clients and pose subscriptions.
 */
class RosInstance {

    /**
     * Name of the instance
     */
    #instanceName: string;

    /**
     * ROS node
     */

    #node: rclnodejs.Node;

    /**
     * Maps instance names to their respective vessel position maps.
     */
    #vesselMap: Map<string, GeoPoint>;

    /**
     * Subscription for receiving vessel pose updates.
     */
    #poseSub: rclnodejs.Subscription;

    /**
     * Action client for sending MAS command array goals.
     */
    #masCmdClient: rclnodejs.ActionClient<'lotusim_msgs/action/MASCmd'>;

    /**
     * Action client for sending MAS command array goals.
     */
    #masArrayCmdClient: rclnodejs.ActionClient<'lotusim_msgs/action/MASCmdArray'>;

    /**
     * Constructs a RosInstance object.
     * @param actionClient - The action client for the instance.
     * @param poseSub - The pose subscription for the instance.
     */
    constructor(
        instanceName: string = ""
    ) {
        this.#instanceName = instanceName;
        this.#node = new rclnodejs.Node(instanceName + "UserInterfaceNode", instanceName);
        this.#vesselMap = new Map<string, GeoPoint>();
        this.#masCmdClient = new rclnodejs.ActionClient(this.#node, 'lotusim_msgs/action/MASCmd', "mas_cmd");
        this.#masArrayCmdClient = new rclnodejs.ActionClient(this.#node, 'lotusim_msgs/action/MASCmdArray', "mas_cmd_array");
        this.#poseSub = this.#node.createSubscription('lotusim_msgs/msg/VesselPositionArray', "poses", this.#poseSubCB);
    }

    public static async createInstance(instanceName: string = ""): Promise<RosInstance> {
        const instance = new RosInstance(instanceName);
        await instance.startNode();
        return instance;
    }

    /**
     * Continuously runs the ROS2 node for processing incoming messages and actions.
     */
    public async startNode(): Promise<void> {
        if (rclnodejs.isShutdown()) {
            console.warn("ROS Node already shut down.");
            return;
        }
        console.log('Starting ROS Node...');
        this.#node.spin(); // Non-blocking spin
    }

    /**
     * Stops and destroys the ROS2 node.
     */
    public stopNode(): void {
        console.log('Destroying ROS Node ' + this.#instanceName);
        try {
            this.#node.destroy();
            console.log(this.#instanceName + ' ROS Node shut down successfully.');
        } catch (error) {
            console.error(this.#instanceName + ' Error during ROS Node destruction:', error);
        }
    }

    /**
     * Get the node of this instance
     */
    public get node(): rclnodejs.Node {
        return this.#node;
    }

    /**
     * Get instance name
     */
    public get instanceName(): string {
        return this.#instanceName;
    }

    /**
     * Get position of vessel from the array
     * @param vessel_name 
     * @returns return position or null if vessel does not exist 
     */
    public getVesselPosition(vessel_name: string): GeoPoint | null {
        return this.#vesselMap.get(vessel_name) ?? null;
    }

    /**
     * Get vessel map
     * @param vessel_name 
     * @returns return position or null if vessel does not exist 
     */
    public get vesselMap(): Map<string, GeoPoint> {
        return this.#vesselMap;
    }

    /**
     * Callback for processing received vessel position data.
     * @param msg - The received vessel position data.
     */
    #poseSubCB = (msg: VesselPositionArray | Buffer): void => {
        this.#vesselMap.clear();
        let vesselPositionArray: VesselPositionArray;
        if (Buffer.isBuffer(msg)) {
            try {
                vesselPositionArray = JSON.parse(msg.toString()) as VesselPositionArray;
            } catch (error) {
                console.error("Failed to parse incoming message from buffer.");
                return;
            }
        } else {
            vesselPositionArray = msg;
        }

        for (const vesselPosition of vesselPositionArray.vessels) {
            const vesselName = vesselPosition.vessel_name;
            if (
                vesselPosition.geo_point &&
                typeof vesselPosition.geo_point.latitude === 'number' &&
                typeof vesselPosition.geo_point.longitude === 'number' &&
                typeof vesselPosition.geo_point.altitude === 'number'
            ) {
                const geo_point = vesselPosition.geo_point;
                const newPoint = new GeoPoint(geo_point.latitude, geo_point.longitude, geo_point.altitude);

                if (
                    vesselPosition.pose &&
                    vesselPosition.pose.orientation &&
                    typeof vesselPosition.pose.orientation.x === 'number' &&
                    typeof vesselPosition.pose.orientation.y === 'number' &&
                    typeof vesselPosition.pose.orientation.z === 'number' &&
                    typeof vesselPosition.pose.orientation.w === 'number'
                ) {
                    const orientation = vesselPosition.pose.orientation;
                    newPoint.heading = quaternionToGpsHeading(
                        orientation.x,
                        orientation.y,
                        orientation.z,
                        orientation.w
                    );
                } else {
                    console.warn(`Invalid orientation data for vessel: ${vesselName}`);
                }

                this.#vesselMap.set(vesselName, newPoint);
            } else {
                console.warn(`Invalid geo_point data for vessel: ${vesselName}`);
            }
        }
    }

    /**
    * Sends a cmd to the MAS command action server. The cmd consist of create, delete, move actions.
    * @param masCmd - The goal message to send.
    */
    public async sendMASCmd(masCmd: MASCmdGoal): Promise<boolean> {
        await this.#masCmdClient.waitForServer();
        try {
            const goalHandle = await this.#masCmdClient.sendGoal(
                masCmd,
                (feedback: MASCmdFeedback) => { }
            );

            if (!goalHandle.isAccepted()) {
                console.warn('Goal rejected by the action server.');
                return false;
            }

            const result = await goalHandle.getResult();

            if (goalHandle.isSucceeded()) {
                console.info(`Goal succeeded with result: ${JSON.stringify(result.result)} `);
                return true;
            }
            console.warn('Goal did not succeed.');
            return false;
        } catch (error) {
            console.error(`Error during action execution: ${error}`);
            return false
        }
    }

    /**
     * Sends an array of cmds to the MAS command action server. The cmd consist of create, delete, move actions.
     * @param masCmdArray - The goal message to send.
     */
    public async sendMASCmdArray(masCmdArray: MASCmdArrayGoal): Promise<boolean> {
        await this.#masArrayCmdClient.waitForServer();
        try {
            const goalHandle = await this.#masArrayCmdClient.sendGoal(
                masCmdArray,
                (feedback: MASCmdArrayFeedback) => {  /* handle feedback if needed */ }
            );

            if (!goalHandle.isAccepted()) {
                console.warn('Goal rejected by the action server.');
                return false;
            }

            const result = await goalHandle.getResult();

            if (goalHandle.isSucceeded()) {
                console.info(`Goal succeeded with result: ${JSON.stringify(result.result)} `);
                return true;
            }
            console.warn('Goal did not succeed.');
            return false;
        } catch (error) {
            console.error(`Error during action execution: ${error}`);
            return false
        }
    }

    public async removeAllVessel(): Promise<boolean> {
        let goal = new MASCmdArray.Goal();
        this.#vesselMap.forEach((value: GeoPoint, key: string) => {
            let cmd = new MASCmdMsg();
            cmd.cmd_type = MASCmdMsg.DELETE_CMD;
            cmd.vessel_name = key;
            goal.cmd.push(cmd);
        });
        return await this.sendMASCmdArray(goal) ?? false;
    }
}

/**
 * Manages multiple instances.
 */
export class ROSInstances {

    #InstanceMap: Map<string, RosInstance>;

    /**
     * Initializes the ROS2 node for communication and sets up instance maps.
     */
    constructor() {
        this.#InstanceMap = new Map<string, RosInstance>();
    }

    /**
     * Adds a new instance.
     * @param name - The instance name.
     */
    public async addInstance(name: string): Promise<void> {
        if (this.#InstanceMap.has(name)) {
            console.warn(`Instance ${name} already exists.`);
            return;
        }
        let instance = await RosInstance.createInstance(name);
        this.#InstanceMap.set(name, instance);
    }

    /**
     * Removes an instance identified by the given name.
     *
     * @param {string} name - The name of the instance to remove.
     * @throws {Error} Throws an error if the instance does not exist in the maps.
     * @returns {void} This function does not return any value.
     *
     */
    public removeInstance(name: string): void {
        if (!this.#InstanceMap.has(name)) {
            console.warn(`Instance ${name} does not exist.`);
            return;
        }
        this.#InstanceMap.get(name)?.stopNode();
        this.#InstanceMap.delete(name);
        console.log(`Instance ${name} removed successfully.`);
    }

    /**
     * Retrieves the entire vessel map for all instances.
     * @returns A map containing all instances.
     */
    public getInstancesMap(): Map<string, RosInstance> {
        return this.#InstanceMap;
    }

    /**
     * Retrieves the vessel map for a specified instance.
     * @param instance - The instance name.
     * @returns A map of vessel IDs and their positions, or an empty map if the instance is not found.
     */
    public getInstanceVesselMap(instance: string): Map<string, GeoPoint> | null {
        const map = this.#InstanceMap.get(instance);
        if (!map) {
            console.warn(`Instance ${instance} not found.`);
            return null;
        }
        return map.vesselMap;
    }

    /**
     * Retrieves the position of a specific vessel within an instance.
     * @param instance - The instance name.
     * @param vesselName - The vessel identifier.
     * @returns The vessel's position or `undefined` if not found.
     */
    public getVesselPosition(instance: string, vesselName: string): GeoPoint | null {
        return this.#InstanceMap.get(instance)?.getVesselPosition(vesselName) ?? null;
    }

    /**
     * Clears all vessels from a specified instance.
     * @param instance - The instance name.
     */
    public clearVessels(instance: string): void {
        this.#InstanceMap.get(instance)?.removeAllVessel();
    }

    /**
     * Sends array of masCmd to the instance, the cmd consist of create, delete and move
     * @param instance 
     * @param req Json form of masCmdArray 
     * @returns 
     */
    public async sendMASCmdArray(instance: string, req: any): Promise<boolean> {
        const masCmdArray: MASCmdArrayGoal = new MASCmdArray.Goal();
        const now = clock.now();
        masCmdArray.header = {
            stamp: now.toMsg(),
            frame_id: 'world'
        };

        masCmdArray.cmd = req;
        try {
            let ret = await this.#InstanceMap.get(instance)?.sendMASCmdArray(masCmdArray);
            return ret ?? false;
        } catch (error) {
            console.error("sendMASCmdArray: Failed to parse incoming MAScmdArray req.");
        }
        return false;
    }

    /**
     * Sends masCmd to the instance, the cmd consist of create, delete and move
     * @param instance 
     * @param masCmd Json form of masCmd 
     * @returns 
     */
    public async sendMASCmd(instance: string, req: any): Promise<boolean> {
        const masCmdGoal: MASCmdGoal = new MASCmd.Goal();
        const now = clock.now();
        masCmdGoal.header = {
            stamp: now.toMsg(),
            frame_id: 'world'
        };
        masCmdGoal.cmd = new MASCmdMsg(req);

        // Temporary measure
        const { x, y } = latLonToXY(masCmdGoal.cmd.geo_point.latitude, masCmdGoal.cmd.geo_point.longitude);
        masCmdGoal.cmd.vessel_position.position.x = x;
        masCmdGoal.cmd.vessel_position.position.y = y;
        masCmdGoal.cmd.vessel_position.position.z = masCmdGoal.cmd.geo_point.altitude;

        try {
            let ret = await this.#InstanceMap.get(instance)?.sendMASCmd(masCmdGoal);
            return ret ?? false;
        } catch (error) {
            console.error("sendMASCmd: Failed to parse incoming MAScmd req.");
        }
        return false;
    }
}

export const rosInstances = new ROSInstances();
