/*
 * Copyright (c) 2025 Naval Group
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 */
import { Quaternion } from "./interfaces/geometry";

export const modelsPath = process.env.LOTUSIM_MODELS_PATH || "~/lotusim_ws/src/lotusim/assets/models/";
if (!process.env.LOTUSIM_MODELS_PATH) {
    console.warn(`Environment variable 'LOTUSIM_MODELS_PATH' is not set, using default path. ${modelsPath}`);
} else {
    console.log(`Models loaded from ${modelsPath}`);
}

export function quaternionToGpsHeading(qx: number, qy: number, qz: number, qw: number): number {
    // Extract ENU yaw from quaternion as GZ uses ENU convention
    const siny_cosp = 2 * (qw * qz + qx * qy);
    const cosy_cosp = 1 - 2 * (qy * qy + qz * qz);
    const yawRad = Math.atan2(siny_cosp, cosy_cosp);

    // Convert rad to deg and rotate ENU to NED
    let headingDeg = 90 - (yawRad * 180 / Math.PI);

    // Normalize heading to [0, 360)
    headingDeg = (headingDeg + 360) % 360;

    return headingDeg;
}

export function radToDeg(rad: number): number { return rad * 180 / Math.PI };

/**
 * Converts quaternion to Euler angles [yaw (ψ), pitch (θ'), roll (φ'')]
 * in radians.
 * [ψ, θ', φ'']
 * psi, theta', phi
 */
export function quaternionToEulerZYX(q: Quaternion): [number, number, number] {
    const { x, y, z, w } = q;

    const siny_cosp = 2 * (w * z + x * y);
    const cosy_cosp = 1 - 2 * (y * y + z * z);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    const sinp = 2 * (w * y - z * x);
    let pitch: number;
    if (Math.abs(sinp) >= 1) {
        pitch = Math.sign(sinp) * Math.PI / 2;
    } else {
        pitch = Math.asin(sinp);
    }

    const sinr_cosp = 2 * (w * x + y * z);
    const cosr_cosp = 1 - 2 * (x * x + y * y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    return [yaw, pitch, roll];
}

/**
 * Parse string of matrix to array of number
 * @param matrix 
 * @returns 
 */
export const parseMatrix = (matrix: string | number[][]): number[][] => {
    if (typeof matrix === "string") {
        try {
            const parsed = JSON.parse(matrix);
            if (Array.isArray(parsed) && parsed.every(row => Array.isArray(row))) {
                return parsed;
            } else {
                throw new Error("Parsed matrix is not a 2D array");
            }
        } catch (e) {
            console.error("Failed to parse matrix:", e);
            throw new Error("Invalid matrix format");
        }
    }

    return matrix;
};