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
 * *******************************   SCENARIOS MODULE   ********************************
 * ************************************************************************************
 * 
 * NOTE: This module is under active development.
 * 
 * Provides an API for managing simulation scenarios.
 *
 * Features:
 * - Lists all available scenarios.
 * - Creates a new scenario (placeholder implementation).
 * - Deletes an existing scenario by name (placeholder implementation).
 *
 * Endpoints:
 * - GET    /scenarios           -> List all scenarios.
 * - POST   /scenario            -> Create a new scenario.
 * - DELETE /scenario/:name      -> Delete a scenario by name.
 *
 */

import { Router } from 'express';

const router = Router();

router.get('/scenarios', (req, res) => {
    res.status(200).json(["test"]);
});

router.post('/scenario', (req, res) => {
    res.status(200).send();
});

router.delete('/scenario/:name', (req, res) => {
    const { name } = req.params;
    res.status(200).send();
});

export default router;
