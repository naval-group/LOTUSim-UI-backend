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
 * Provides middleware for handling file uploads using Multer.
 * - Files are stored in the `modelsPath` directory.
 * - Automatically creates the directory if it does not exist.
 * - File names are generated using the field name and current timestamp to avoid collisions.
 *
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { modelsPath } from '../utils';

// Upload function
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(modelsPath)) {
            fs.mkdirSync(modelsPath, { recursive: true });
        }
        cb(null, modelsPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

export default upload;
