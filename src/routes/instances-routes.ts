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
 * *******************************   GAZEBO ROS API ROUTER   **************************
 * ************************************************************************************
 *
 * Express router for managing Lotusim simulation instances.
 *
 * Routes:
 * - GET    /instances                        : List all instance names.
 * - GET    /instance/:name                   : Get parameters for a specific instance.
 * - POST   /instance                         : Create a new instance.
 * - DELETE /instance/:name                   : Delete an instance.
 */

import { Router, Request, Response } from "express";
import { rosInstances } from "../interfaces/ros";

const router = Router();

// ─── Instances ───────────────────────────────────────────────

router.get("/instances", (req: Request, res: Response): void => {
  res.status(200).json({ success: true, instances: rosInstances.getInstanceNames() });
});

router.get("/instance/:name", (req: Request, res: Response): void => {
  // TODO: return real instance params based on req
  res.status(200).json({ success: true, domain: 0 });
});

router.post("/instance", (req: Request, res: Response): void => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ success: false, message: "Name is required to create an instance." });
    return;
  }
  // TODO: implement instance creation
  res.status(200).json({ success: true, message: `Instance '${name}' created successfully.` });
});

router.delete("/instance/:name", (req: Request, res: Response): void => {
  const { name } = req.params;
  // TODO: implement instance deletion
  res.status(200).json({ success: true, message: `Instance '${name}' closed successfully.` });
});

export default router;
