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
 * *******************************   SDF & SENSOR MODULE   ****************************
 * ************************************************************************************
 *
 * Provides a modular system for defining vessel sensors and generating SDF (Simulation Description Format) files.
 *
 * Features:
 * - Defines sensor types: IMU, Sonar, Radar, AIS.
 * - Supports noise modeling for sensors (mean, stddev, bias).
 * - Converts sensor configurations into SDF XML format.
 * - Manages sensors attached to a vessel model.
 *
 */

import { Pose, Vector3 } from '../interfaces/geometry';

export interface Noise {
    mean: number;
    stddev: number;
    bias_stddev: number;
    bias_mean: number;
}

export interface NoiseVector3 {
    mean: Vector3;
    stddev: Vector3;
    bias_mean: Vector3;
    bias_stddev: Vector3;
}

export enum SensorType {
    IMU = 'imu',
    SONAR = 'sonar',
    RADAR = 'radar',
    AIS = 'ais'
}

export interface Sensor {
    name: string;
    type: SensorType;
    pose: Pose;
    update_rate: number;
}

export interface IMUSensor extends Sensor {
    coord_system: string; // ENU(default), NED, NWU

    linear_noise: NoiseVector3;
    angular_noise: NoiseVector3;
}

export interface SonarSensor extends Sensor {
    // Sample is the number of simulated lidar rays to generate per complete laser sweep cycle.
    // Resolution: this number is multiplied by samples to determine the number of rows of data points.
    // The angle between each row of datapoints is (max_angle-min_angle) / (resolution*samples)

    horizontal_resolution: number;
    horizontal_samples: number;
    horizontal_min_angle: number;
    horizontal_max_angle: number;

    vertical_resolution: number;
    vertical_samples: number;
    vertical_min_angle: number;
    vertical_max_angle: number;

    range_min: number;
    range_max: number;
    range_resolution: number;
    range_noise: Noise;
}

export interface RadarSensor extends Sensor {
    range: number;
    frequency: number;
}

export interface AISSensor extends Sensor {
    noise: Noise;
}

export class SDF {
    private _name: string = '';
    private _stl_url: string = '';
    private _image_path: string = '';
    private _sensors: Sensor[] = [];

    constructor() {
    }

    get name(): string {
        return this._name;
    }

    get stl_url(): string {
        return this._stl_url;
    }

    get image_path(): string {
        return this._image_path;
    }

    get sensors(): Sensor[] {
        return this._sensors;
    }

    set name(value: string) {
        this._name = value;
    }

    set stl_url(value: string) {
        this._stl_url = value;
    }

    set image_path(value: string) {
        this._image_path = value;
    }

    set sensors(value: Sensor[]) {
        this._sensors = value;
    }

    addSensor(sensor: Sensor): void {
        this._sensors.push(sensor);
    }

    private createImuSensorXml(imu: IMUSensor): string {
        const name = imu.name;
        const pos = imu.pose.position;
        const quat = imu.pose.orientation;
        const frame = imu.coord_system;
        const update_rate = imu.update_rate;
        const {
            linear_noise,
            angular_noise
        } = imu;

        // TODO
        return `
        <link name="imu_link_${name}">
            <pose>${pos.x} ${pos.y} ${pos.z} ${quat.x} ${quat.y} ${quat.z} ${quat.w}</pose>
            <sensor name="imu_sensor" type="imu">
                <always_on>1</always_on>
                <update_rate>${update_rate}</update_rate>
                <topic>imu_${name}</topic>
                <imu>
                    <linear_acceleration>
                        <x>
                            <noise type="gaussian">
                                <mean>${linear_noise.mean.x}</mean>
                                <stddev>${linear_noise.stddev.x}</stddev>
                                <bias_stddev>${linear_noise.bias_stddev.x}</bias_stddev>
                                <bias_mean>${linear_noise.bias_mean.x}</bias_mean>
                            </noise>
                        </x>
                        <y>
                            <noise type="gaussian">
                                <mean>${linear_noise.mean.y}</mean>
                                <stddev>${linear_noise.stddev.y}</stddev>
                                <bias_stddev>${linear_noise.bias_stddev.y}</bias_stddev>
                                <bias_mean>${linear_noise.bias_mean.y}</bias_mean>
                            </noise>
                        </y>
                        <z>
                            <noise type="gaussian">
                                <mean>${linear_noise.mean.z}</mean>
                                <stddev>${linear_noise.stddev.z}</stddev>
                                <bias_stddev>${linear_noise.bias_stddev.z}</bias_stddev>
                                <bias_mean>${linear_noise.bias_mean.z}</bias_mean>
                            </noise>
                        </z>
                    </linear_acceleration>
                    <angular_velocity>
                        <x>
                            <noise type="gaussian">
                                <mean>${angular_noise.mean.x}</mean>
                                <stddev>${angular_noise.stddev.x}</stddev>
                                <bias_stddev>${angular_noise.bias_stddev.x}</bias_stddev>
                                <bias_mean>${angular_noise.bias_mean.x}</bias_mean>
                            </noise>
                        </x>
                        <y>
                            <noise type="gaussian">
                                <mean>${angular_noise.mean.y}</mean>
                                <stddev>${angular_noise.stddev.y}</stddev>
                                <bias_stddev>${angular_noise.bias_stddev.y}</bias_stddev>
                                <bias_mean>${angular_noise.bias_mean.y}</bias_mean>
                            </noise>
                        </y>
                        <z>
                            <noise type="gaussian">
                                <mean>${angular_noise.mean.z}</mean>
                                <stddev>${angular_noise.stddev.z}</stddev>
                                <bias_stddev>${angular_noise.bias_stddev.z}</bias_stddev>
                                <bias_mean>${angular_noise.bias_mean.z}</bias_mean>
                            </noise>
                        </z>
                    </angular_velocity>
                    <orientation_reference_frame>
                        <localization>${frame}</localization>
                    </orientation_reference_frame>
                </imu>
            </sensor>
        </link>
    `;
    }

    private createSonar(sonar: SonarSensor): string {
        const name = sonar.name;
        const update_rate = sonar.update_rate;
        const pos = sonar.pose.position;
        const quat = sonar.pose.orientation;

        const {
            horizontal_resolution,
            horizontal_samples,
            horizontal_min_angle,
            horizontal_max_angle,
            vertical_resolution,
            vertical_samples,
            vertical_min_angle,
            vertical_max_angle,
            range_min,
            range_max,
            range_resolution,
            range_noise
        } = sonar;

        // TODO
        return `
        <link name="sonar_link_${name}">
            <pose>${pos.x} ${pos.y} ${pos.z} ${quat.x} ${quat.y} ${quat.z} ${quat.w}</pose>
            <sensor name="sonar_${name}" type="gpu_lidar">
                <always_on>true</always_on>
                <update_rate>${update_rate}</update_rate>
                <ray>
                    <scan>
                        <horizontal>
                            <samples>${horizontal_samples}</samples>
                            <resolution>${horizontal_resolution}</resolution>
                            <min_angle>${horizontal_min_angle}</min_angle>
                            <max_angle>${horizontal_max_angle}</max_angle>
                        </horizontal>
                        <vertical>
                            <samples>${vertical_samples}</samples>
                            <resolution>${vertical_resolution}</resolution>
                            <min_angle>${vertical_min_angle}</min_angle>
                            <max_angle>${vertical_max_angle}</max_angle>
                        </vertical>
                    </scan>
                    <range>
                        <min>${range_min}</min>
                        <max>${range_max}</max>
                        <resolution>${range_resolution}</resolution>
                    </range>
                    <noise>
                        <type>gaussian</type>
                        <mean>${range_noise.mean}</mean>
                        <stddev>${range_noise.stddev}</stddev>
                        <bias_stddev>${range_noise.bias_stddev}</bias_stddev>
                        <bias_mean>${range_noise.bias_mean}</bias_mean>
                    </noise>
                </ray>
                <topic>/sonar_${name}</topic>
            </sensor>
        </link>
`;
    }

    private createAisSensorXml(ais: Sensor): string {
        const name = ais.name;
        const pos = ais.pose.position;
        const quat = ais.pose.orientation;
        const update_rate = ais.update_rate || 1;
        const noise = (ais as any).noise as Noise || {
            mean: 0.0,
            stddev: 0.0,
            bias_mean: 0,
            bias_stddev: 0
        };

        return `
        <link name="ais_link_${name}">
            <pose>${pos.x} ${pos.y} ${pos.z} ${quat.x} ${quat.y} ${quat.z} ${quat.w}</pose>
            <sensor name="ais_${name}" type="custom" gz:type="ais">
                <update_rate>${update_rate}</update_rate>
                <noise_sigma>${noise.stddev}</noise_sigma>
                <noise_amplitude>${noise.mean}</noise_amplitude>
            </sensor>
        </link>
    `;
    }

    createSdfFile(): string {
        const xmlContentHeader = `
<?xml version="1.0"?>
<sdf version="1.10">
    <model name='${this._name}'>
        <link name="base_link">
            <visual name="visual">
            <geometry>
                <mesh>
                <uri>model://${this._name}/${this._name}.stl</uri>
                </mesh>
            </geometry>
            </visual>
            <collision name="body_collision">
            <geometry>
                <mesh>
                <uri>model://${this._name}/${this._name}.stl</uri>
                <scale>1 1 1</scale>
                </mesh>
            </geometry>
            </collision>
        </link>`;


        let sensorXml = '';

        for (const sensor of this._sensors) {
            switch (sensor.type) {
                case SensorType.IMU:
                    sensorXml += this.createImuSensorXml(sensor as IMUSensor);
                    break;
                case SensorType.SONAR:
                    sensorXml += this.createSonar(sensor as SonarSensor);
                    break;
                case SensorType.RADAR:
                    // sensorXml += this.createRadarSensorXml(sensor as RadarSensor);
                    break;
                case SensorType.AIS:
                    sensorXml += this.createAisSensorXml(sensor);
                    break;
                default:
                    console.warn(`Unknown sensor type: ${sensor.type}`);
            }
        }

        const xmlContentFooter = `
    </model>
</sdf>`;

        return `${xmlContentHeader}
        ${sensorXml}
        ${xmlContentFooter}`;
    }

}
