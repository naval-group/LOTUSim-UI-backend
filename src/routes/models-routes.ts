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
 * *******************************   MODELS MANAGEMENT MODULE   ************************
 * ************************************************************************************
 *
 * Provides an API for managing 3D models and simulation files for Gazebo and Xdyn.
 *
 * Features:
 * - Lists available models stored in the system directory.
 * - Deletes a model folder and its contents.
 * - Creates a new model with:
 *    - Gazebo SDF file including STL mesh, sensors, and image.
 *    - Xdyn YAML file with hydrodynamic properties, propellers, and control surfaces.
 * - Supports parsing matrices and vectors for Xdyn hydrodynamic configuration.
 *
 * Endpoints:
 * - GET    /models           -> List all available models.
 * - POST   /model            -> Create a new model (SDF + Xdyn YAML).
 * - DELETE /model            -> Delete an existing model by name.
 *
 * Notes:
 * - Uses synchronous and asynchronous file operations.
 * - Ensures folders exist before writing model files.
 * - Validates required fields in request body.
 *
 */


import fs from "fs";
import path from "path";
import { Router, Request, Response } from "express";
import { modelsPath, parseMatrix } from "../utils";
import * as SdfClass from "../models/sdf";
import * as xdynClass from "../models/xdyn-yaml";
import { Vector3 } from '../interfaces/geometry';

const router = Router();

const listModels = (req: Request, res: Response): void => {
    try {
        const entries = fs.readdirSync(modelsPath, { withFileTypes: true });
        const folders = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
        res.json(folders);
    } catch (error: any) {
        res.status(500).json({ error: "Error reading directory", details: error.message || error });
    }
};

const deleteModel = async (req: Request, res: Response): Promise<void> => {
    const modelName = req.query.modelName as string;
    if (!modelName) {
        res.status(400).send("Error: modelName query parameter is required.");
        return;
    }
    try {
        await fs.promises.rm(path.join(modelsPath, modelName), { recursive: true, force: true });
        res.status(200).send(`Model ${modelName} deleted successfully.`);
    } catch (err) {
        res.status(500).send(`Error deleting model ${modelName}: ${err}`);
    }
};

export interface CreateModelRequestBody {
    modelName: string;
    image: string;
    stl: string;
    sensors: SdfClass.Sensor[];

    xdyn: {
        name: string;
        wave: xdynClass.Wave;
        meshDir: string;
        bodyFrameRelativeToMeshFrame: Vector3;
        hydroForcesCalcPoint: Vector3;
        centerOfInertia: Vector3;
        inertiaMatrixAtBuoyancy: number[][];
        addedMass: number[][];
        linearDamping: number[][];
        quadraticDamping: number[][];
        resistanceCurveSpeed: number[];
        resistanceCurveResistance: number[];
        propellers: xdynClass.Propeller[];
        rudders: xdynClass.ControllSurface[];
        propellerWithRudders: xdynClass.PropellerWithRudder[];
    };
}

// JSON req body received
// {
//     modelName: 'testing',
//     sensors: [],
//     xdyn: {
//         name: 'testing',
//             wave: { angle: 0 },
//         meshDir: null,
//             bodyFrameRelativeToMeshFrame: { x: 0, y: 0, z: 0 },
//         hydroForcesCalcPoint: { x: 0, y: 0, z: 0 },
//         centerOfInertia: { x: 0, y: 0, z: 0 },
//         inertiaMatrixAtBuoyancy: '[[1,0,0,0,0,0],[0,1,0,0,0,0],[0,0,1,0,0,0],[0,0,0,1,0,0],[0,0,0,0,1,0],[0,0,0,0,0,1]]',
//             addedMass: '[[1,0,0,0,0,0],[0,1,0,0,0,0],[0,0,1,0,0,0],[0,0,0,1,0,0],[0,0,0,0,1,0],[0,0,0,0,0,1]]',
//                 linearDamping: '[[1,0,0,0,0,0],[0,1,0,0,0,0],[0,0,1,0,0,0],[0,0,0,1,0,0],[0,0,0,0,1,0],[0,0,0,0,0,1]]',
//                     quadraticDamping: '[[1,0,0,0,0,0],[0,1,0,0,0,0],[0,0,1,0,0,0],[0,0,0,1,0,0],[0,0,0,0,1,0],[0,0,0,0,0,1]]',
//                         resistanceCurveSpeed: [],
//                             resistanceCurveResistance: [],
//                                 propellers: [[Object]],
//                                     rudders: [[Object]],
//                                         propellerWithRudders: [[Object]]
//     }
// }

const safeParse2DMatrix = (input: string | number[][]): number[][] => {
    return typeof input === 'string' ? JSON.parse(input) : input;
};

const safeParse1DMatrix = (input: string | number[]): number[] => {
    return typeof input === 'string' ? JSON.parse(input) : input;
};

const createModel = async (req: Request, res: Response): Promise<void> => {
    const {
        modelName,
        stl,
        sensors,
        image,
        xdyn,
    } = req.body as CreateModelRequestBody;

    // if (!modelName || !stl || !image) {
    //     res.status(400).send("Missing required fields in request body.");
    //     return;
    // }

    const folderPath = modelsPath + '/' + modelName;
    try {
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
            console.log('Folder created:', folderPath);
        } else {
            console.log('Folder already exists:', folderPath);
        }
    } catch (err) {
        console.error('Error creating folder:', err);
        res.status(500).send(`Failed to create folder for model "${modelName}"`);
        return;
    }

    try {
        // Create gazebo sdf file
        const sdf = new SdfClass.SDF();
        sdf.name = modelName;
        sdf.stl_url = stl;
        sdf.sensors = sensors;
        sdf.image_path = image;
        const sdf_string = sdf.createSdfFile();

        fs.writeFile(folderPath + '/model.sdf', sdf_string, 'utf8', (err) => {
            if (err) {
                console.error('Error writing model sdf file:', err);
                res.status(500).send(`Failed to create sdf for model "${modelName}"`);
            } else {
                console.log('Sdf file written successfully.');
            }
        });
    } catch (err) {
        console.error('Error creating sdf:', err);
        res.status(500).send(`Failed to create gazebo sdf for model "${modelName}"`);
        return;
    }

    // Create xdyn file
    if (xdyn) {
        try {
            const xdynYaml = new xdynClass.XdynYaml();
            xdynYaml.setName(xdyn.name);
            xdynYaml.setWave(xdyn.wave);
            xdynYaml.setBodyFrameRelativeToMeshFrame({
                x: xdyn.bodyFrameRelativeToMeshFrame.x,
                y: xdyn.bodyFrameRelativeToMeshFrame.y,
                z: xdyn.bodyFrameRelativeToMeshFrame.z
            });
            xdynYaml.setHydroForcesCalcPoint({
                x: xdyn.hydroForcesCalcPoint.x,
                y: xdyn.hydroForcesCalcPoint.y,
                z: xdyn.hydroForcesCalcPoint.z
            });
            xdynYaml.setCenterOfInertia({
                x: xdyn.centerOfInertia.x,
                y: xdyn.centerOfInertia.y,
                z: xdyn.centerOfInertia.z
            });
            xdynYaml.setInertiaMatrixAtBuoyancy(parseMatrix(xdyn.inertiaMatrixAtBuoyancy));
            xdynYaml.setAddedMass(parseMatrix(xdyn.addedMass));
            xdynYaml.setLinearDamping(parseMatrix(xdyn.linearDamping));
            xdynYaml.setQuadraticDamping(parseMatrix(xdyn.quadraticDamping));
            xdynYaml.setResistanceCurveSpeed(xdyn.resistanceCurveSpeed);
            xdynYaml.setResistanceCurveResistance(xdyn.resistanceCurveResistance);
            xdynYaml.setPropellers(xdyn.propellers);
            xdynYaml.setRudders(xdyn.rudders);
            xdynYaml.setPropellerWithRudders(xdyn.propellerWithRudders);

            const yaml_string = xdynYaml.createYaml();
            fs.writeFile(folderPath + '/xdyn.yml', yaml_string, 'utf8', (err) => {
                if (err) {
                    console.error('Error writing model xdyn file:', err);
                } else {
                    console.log('Xdyn file written successfully.');
                }
            });
        } catch (err) {
            console.error('Error creating xdyn yaml:', err);
            res.status(500).send(`Failed to create xdyn yaml for model "${modelName}"`);
            return;
        }
    }
    res.status(200).json({ message: `Model '${modelName}' created successfully.` });
};

router.get("/models", listModels);

router.post("/model", createModel);

router.delete("/model", deleteModel);



export default router;