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
 * ***************************   GEOMETRY UTILITY MODULE   ****************************
 * ************************************************************************************
 *
 * Provides types, classes, and utility functions for handling geometry and spatial data.
 *
 * Includes:
 * - Conversion from latitude/longitude to local XY coordinates in meters.
 * - 3D vector and quaternion types.
 * - Pose interface representing position and orientation in 3D space.
 * - GeoPoint class for managing geographic points with latitude, longitude, altitude, and heading.
 *
 * Temporary note: Some functions (e.g., latLonToXY) are transitional measures as the
 * system is in-between geographic coordinates and local XY coordinates.
 *
 */

// TODO: Center to be removed, used in function below
export const latLongCenter: [number, number] = [1.2421, 103.7198] as const;

/**
 * Temporary measure as the system is in between latLong and xy coordinate system for now
 * Convert lat/lon to local X/Y in meters relative to latLongCenter
 */
export function latLonToXY(lat: number, lon: number): { x: number; y: number } {
    const [lat0, lon0] = latLongCenter;

    const R = 6378137; // WGS84 Earth radius in meters

    // Convert degrees to radians
    const degToRad = (deg: number) => deg * Math.PI / 180;

    const dLat = degToRad(lat - lat0);
    const dLon = degToRad(lon - lon0);

    // Approximate conversions
    const y = dLat * R;
    const x = dLon * R * Math.cos(degToRad(lat0));
    return { x, y };
}

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
}

export interface Pose {
    position: Vector3;
    orientation: Quaternion;
}

export interface VesselPosition {
    vessel_name: string;
    geo_point?: GeoPoint;
    pose?: Pose;
}

export class GeoPoint {

    #latitude: number;
    #longitude: number;
    #altitude: number;
    #heading: number;

    /**
     * Constructs a new GeoPoint object.
     * @param latitude 
     * @param longitude 
     * @param heading - Heading angle (rotation) of the vessel in radians.
     */
    constructor(latitude: number, longitude: number, altitude: number, heading: number = 0) {
        this.#latitude = latitude;
        this.#longitude = longitude;
        this.#altitude = altitude;
        this.#heading = heading;
    }

    public get latitude(): number {
        return this.#latitude;
    }

    public set latitude(value: number) {
        this.#latitude = value;
    }

    public get longitude(): number {
        return this.#longitude;
    }

    public set longitude(value: number) {
        this.#longitude = value;
    }

    public get altitude(): number {
        return this.#altitude;
    }

    public set altitude(value: number) {
        this.#altitude = value;
    }

    public get heading(): number {
        return this.#heading;
    }

    public set heading(value: number) {
        this.#heading = value;
    }
}
