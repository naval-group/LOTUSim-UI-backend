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
 * *******************************   GAZEBO ROS API ROUTER   ***************************
 * ************************************************************************************
 *
 * Provides an Express router for managing Lotusim simulation instances and vessels
 * through ROS interfaces.
 *
 * Features:
 * - Retrieve all GZ instance names or a specific instance's parameters.
 * - Create or delete GZ instances.
 * - Get vessel positions for a specific instance.
 * - Send MAS (Multi-Agent System) commands to spawn or control single or multiple vessels.
 * - Delete all vessels from a specific instance.
 * - Supports basic error handling with appropriate HTTP status codes.
 *
 * Routes:
 * - GET    /instances                       : List all Gazebo instance names.
 * - GET    /instance/:name                  : Get parameters for a specific instance.
 * - POST   /instance                        : Create a new Gazebo instance.
 * - DELETE /instance/:name                  : Delete an existing Gazebo instance.
 * - GET    /instance/:instance/vessels      : Get all vessels in a specific instance.
 * - POST   /instance/:instance/vessels      : Send MAS commands to multiple vessels.
 * - POST   /instance/:instance/vessel       : Send MAS command to a single vessel.
 * - DELETE /instance/:instance/vessels      : Delete all vessels in a specific instance.
 * - GET    /instance/:instance/vessel?name= : Get position of a specific vessel.
 *
 * Notes:
 * - Currently uses a hardcoded test instance for demonstration.
 * - MAS commands are sent using the `rosInstances` interface.
 * - Vessel positions are represented using `GeoPoint` and `VesselPosition`.
 * - Designed to work with JSON payloads for POST requests.
 * 
 */

import { Router } from 'express';
import { rosInstances } from "../interfaces/ros";
import { Instance, Process } from '../processes/Instances';
import { GeoPoint, VesselPosition } from '../interfaces/geometry';

const router = Router();

// TODO: temp measures for testing
// Hardcode instance for frontend
const process1 = new Process("lotusim", 1234);
const instance1 = new Instance("lotusim", [process1]);

const instances: Instance[] = [instance1];

/**
 * Get all GZ instance info
 */
router.get('/instances', (req, res) => {
    const instanceNames = instances.map((instance) => instance.name);
    res.status(200).json(instanceNames);
});


/**
 * Get specific GZ instance param
 */
router.get('/instance/:name', (req, res) => {
    // TODO: Fill in instance params
    const { name } = req.params;
    res.status(200).json({ domain: 0 });
});

/**
 * Create GZ instance
 */
router.post('/instance', (req, res) => {
    const { name } = req.body;
    if (!name) {
        res.status(400).json({ error: 'Name is required to create an instance' });
        return;
    }
    // TODO: Fill in instance creation
    res.status(200).json({ message: `Instance '${name}' created successfully` });
});

/**
 * Delete GZ instance
 */
router.delete('/instance/:name', (req, res) => {
    const { name } = req.params;
    // TODO: Fill in instance deletion
    res.status(200).json({ message: `Instance '${name}' closed successfully` });
});

/**
 * API to get all vessels
 */
router.get('/instance/:instance/vessels', (req, res) => {
    const result: VesselPosition[] = [];
    const { instance } = req.params;
    if (!instance) {
        res.status(400).json({ error: "Instance name is required in the URL parameter." });
        return;
    }
    const mapping = rosInstances.getInstanceVesselMap(instance);
    if (mapping) {
        mapping.forEach((position, vessel_name) => {
            result.push({
                vessel_name,
                geo_point: new GeoPoint(
                    position.latitude,
                    position.longitude,
                    0,
                    position.heading
                )
            });
        });
        res.status(200).json(result);
    }
    res.status(400).json({ error: "Instance name not found." });
});

/**
 * API to send MAS cmds
 */
router.post('/instance/:instance/vessel', async (req, res) => {
    try {
        const { instance } = req.params;
        if (!instance) {
            res.status(400).json({ error: "Instance name is required in the URL parameter." });
            return;
        }
        const cmd_json: JSON = req.body;
        const ret = await rosInstances.sendMASCmd(instance, cmd_json);
        if (ret) {
            res.status(200).json({ message: "mas cmd accecpted" });
        } else {
            console.error("Error processing mas req:", cmd_json);
            res.status(400).json({ error: "Failed to process req" });
        }
    } catch (error) {
        console.error("Error processing mas req:", error);
        res.status(400).json({ error: "Failed to process models" });
    }
});

/**
 *  Create an array of vessels
 */
router.post('/instance/:instance/vessels', async (req, res) => {
    try {
        const { instance } = req.params;
        if (!instance) {
            res.status(400).json({ error: "Instance name is required in the URL parameter." });
            return;
        }
        const cmd_json: JSON = req.body;
        const ret = await rosInstances.sendMASCmdArray(instance, cmd_json);
        if (ret) {
            res.status(200).json({ message: "mas cmd accecpted" });
        } else {
            console.error("Error processing mas req:", cmd_json);
            res.status(400).json({ error: "Failed to process req" });
        }
    } catch (error) {
        console.error("Error processing mas req:", error);
        res.status(400).json({ error: "Failed to process models" });
    }
});

/**
 * API to delete all vessels
 */
router.delete('/instance/:instance/vessels', (req, res) => {
    try {
        const { instance } = req.params;
        if (!instance) {
            res.status(400).json({ error: "Instance name is required in the URL parameter." });
            return;
        }
        rosInstances.clearVessels(instance);
        res.status(200).json({ message: "All vesseled cleared" });
    } catch (error) {
        console.error("Error processing req:", error);
        res.status(400).json({ error: "Failed to process models" });
    } res.status(200).json();
});

/**
 * Get vessel position info in given instance
 */
router.get('/instance/:instance/vessel', (req, res) => {
    const { instance } = req.params;
    const { name } = req.query as { name?: string };

    if (!instance || !name) {
        res.status(400).json({ error: "Instance name and model name are required." });
        return;
    }

    const position = rosInstances.getVesselPosition(instance, name);

    if (!position) {
        res.status(404).json({ error: `Model '${name}' not found in instance '${instance}'.` });
        return;
    }

    res.status(200).json({
        vessel_name: name,
        position: {
            lat: position.latitude,
            long: position.longitude,
            heading: position.heading
        }
    });
});

/**
 * Post MASCmd to spawn single vessel
 */
router.post('/instance/:instance/vessel', async (req, res) => {
    try {
        const { instance } = req.params;
        if (!instance) {
            res.status(400).json({ error: "Instance name is required in the URL parameter." });
            return;
        }
        const cmd_json: JSON = req.body;
        const ret = await rosInstances.sendMASCmd(instance, cmd_json);
        if (ret) {
            res.status(200).json({ message: "mas cmd accecpted" });
        } else {
            console.error("Error processing req:", cmd_json);
            res.status(400).json({ error: "Failed to process req" });
        }
    } catch (error) {
        console.error("Error processing req:", error);
        res.status(400).json({ error: "Failed to process models" });
    }
});

export default router;