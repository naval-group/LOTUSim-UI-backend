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
 * *******************************   FILE UPLOAD MODULE   *****************************
 * ************************************************************************************
 *
 * Provides an API endpoint for uploading files associated with 3D models.
 *
 * Features:
 * - Accepts multiple file uploads using multer middleware.
 * - Stores files in a model-specific directory under the configured models path.
 * - Renames files according to type:
 *   - STL files are renamed to `<modelName>.stl`.
 *   - Image files (jpg, jpeg, png, webp) are renamed to `preview`.
 *   - Other files retain their field name with extension.
 * - Returns a JSON response with the new file paths.
 *
 * Endpoint:
 * - POST /upload
 *   - Body parameters:
 *     - modelName: string (required) – Name of the model associated with the files.
 *     - files: multipart/form-data – Files to be uploaded.
 *
 */

import { Router, Request, Response } from 'express';
import upload from '../interfaces/upload';
import { Express } from 'express';
import path from 'path';
import fs from 'fs';
import { modelsPath } from '../utils';

const router = Router();

// Upload files
router.post('/upload', upload.any(), (req: Request, res: Response): void => {
    const modelName = req.body.modelName;
    const files = req.files as Express.Multer.File[];

    if (!modelName || !files || files.length === 0) {
        res.status(400).json({ message: 'Missing modelName or files' });
        return;
    }

    const modelDir = path.join(modelsPath, modelName);
    if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
    }

    const movedPaths: Record<string, string> = {};

    files.forEach((file) => {
        let newFileName: string;
        const ext = path.extname(file.originalname).toLowerCase();

        if (file.fieldname === 'stlFile') {
            newFileName = `${modelName}.stl`;
        } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            newFileName = `preview`;
        } else {
            newFileName = `${file.fieldname}${path.extname(file.originalname)}`;
        }

        const newPath = path.join(modelDir, newFileName);
        fs.renameSync(file.path, newPath);
        movedPaths[file.fieldname] = newPath;
    });


    res.status(200).json({
        message: 'Files uploaded and moved successfully',
        modelName,
        files: movedPaths,
    });
});

export default router;
