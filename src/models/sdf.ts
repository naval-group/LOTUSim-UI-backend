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
 * Provides a modular system for defining vessel sensors and generating SDF
 * (Simulation Description Format) files.
 *
 * Features:
 * - Defines sensor types: IMU, Sonar, Radar, AIS.
 * - Supports noise modeling for sensors (mean, stddev, bias).
 * - Converts sensor configurations into SDF XML format.
 * - Manages sensors attached to a vessel model.
 *
 */

import {
  Sensor,
  SensorType,
  IMUSensor,
  AISSensor,
  SonarSensor,
  NoiseVector3,
} from "../interfaces/sensor";

export class SDF {
  public name: string = "";
  public stlUrl: string = "";
  public imagePath: string = "";
  public sensors: Sensor[] = [];

  addSensor(sensor: Sensor): void {
    this.sensors.push(sensor);
  }

  // ─── Private XML formatters ───────────────────────────────────────────────

  private noiseAxisXml(axis: "x" | "y" | "z", noise: NoiseVector3): string {
    return [
      `                        <${axis}>`,
      `                            <noise type="gaussian">`,
      `                                <mean>${noise.mean[axis]}</mean>`,
      `                                <stddev>${noise.stddev[axis]}</stddev>`,
      `                                <bias_stddev>${noise.biasStddev[axis]}</bias_stddev>`,
      `                                <bias_mean>${noise.biasMean[axis]}</bias_mean>`,
      `                            </noise>`,
      `                        </${axis}>`,
    ].join("\n");
  }

  private createImuSensorXml(imu: IMUSensor): string {
    const { name, pose, coordSystem, updateRate, linearNoise, angularNoise } = imu;
    const { position: pos, orientation: quat } = pose;

    return [
      `        <link name="imu_link_${name}">`,
      `            <pose>${pos.x} ${pos.y} ${pos.z} ${quat.x} ${quat.y} ${quat.z} ${quat.w}</pose>`,
      `            <sensor name="imu_sensor" type="imu">`,
      `                <always_on>1</always_on>`,
      `                <update_rate>${updateRate}</update_rate>`,
      `                <topic>imu_${name}</topic>`,
      `                <imu>`,
      `                    <linear_acceleration>`,
      this.noiseAxisXml("x", linearNoise),
      this.noiseAxisXml("y", linearNoise),
      this.noiseAxisXml("z", linearNoise),
      `                    </linear_acceleration>`,
      `                    <angular_velocity>`,
      this.noiseAxisXml("x", angularNoise),
      this.noiseAxisXml("y", angularNoise),
      this.noiseAxisXml("z", angularNoise),
      `                    </angular_velocity>`,
      `                    <orientation_reference_frame>`,
      `                        <localization>${coordSystem}</localization>`,
      `                    </orientation_reference_frame>`,
      `                </imu>`,
      `            </sensor>`,
      `        </link>`,
    ].join("\n");
  }

  private createSonarSensorXml(sonar: SonarSensor): string {
    const { name, pose, updateRate, rangeNoise } = sonar;
    const { position: pos, orientation: quat } = pose;

    return [
      `        <link name="sonar_link_${name}">`,
      `            <pose>${pos.x} ${pos.y} ${pos.z} ${quat.x} ${quat.y} ${quat.z} ${quat.w}</pose>`,
      `            <sensor name="sonar_${name}" type="gpu_lidar">`,
      `                <always_on>true</always_on>`,
      `                <update_rate>${updateRate}</update_rate>`,
      `                <ray>`,
      `                    <scan>`,
      `                        <horizontal>`,
      `                            <samples>${sonar.horizontalSamples}</samples>`,
      `                            <resolution>${sonar.horizontalResolution}</resolution>`,
      `                            <min_angle>${sonar.horizontalMinAngle}</min_angle>`,
      `                            <max_angle>${sonar.horizontalMaxAngle}</max_angle>`,
      `                        </horizontal>`,
      `                        <vertical>`,
      `                            <samples>${sonar.verticalSamples}</samples>`,
      `                            <resolution>${sonar.verticalResolution}</resolution>`,
      `                            <min_angle>${sonar.verticalMinAngle}</min_angle>`,
      `                            <max_angle>${sonar.verticalMaxAngle}</max_angle>`,
      `                        </vertical>`,
      `                    </scan>`,
      `                    <range>`,
      `                        <min>${sonar.rangeMin}</min>`,
      `                        <max>${sonar.rangeMax}</max>`,
      `                        <resolution>${sonar.rangeResolution}</resolution>`,
      `                    </range>`,
      `                    <noise>`,
      `                        <type>gaussian</type>`,
      `                        <mean>${rangeNoise.mean}</mean>`,
      `                        <stddev>${rangeNoise.stddev}</stddev>`,
      `                        <bias_stddev>${rangeNoise.biasMean}</bias_stddev>`,
      `                        <bias_mean>${rangeNoise.biasStddev}</bias_mean>`,
      `                    </noise>`,
      `                </ray>`,
      `                <topic>/sonar_${name}</topic>`,
      `            </sensor>`,
      `        </link>`,
    ].join("\n");
  }

  private createAisSensorXml(ais: AISSensor): string {
    const { name, pose, updateRate, noise } = ais;
    const { position: pos, orientation: quat } = pose;

    return [
      `        <link name="ais_link_${name}">`,
      `            <pose>${pos.x} ${pos.y} ${pos.z} ${quat.x} ${quat.y} ${quat.z} ${quat.w}</pose>`,
      `            <sensor name="ais_${name}" type="custom" gz:type="ais">`,
      `                <update_rate>${updateRate}</update_rate>`,
      `                <noise_sigma>${noise.stddev}</noise_sigma>`,
      `                <noise_amplitude>${noise.mean}</noise_amplitude>`,
      `            </sensor>`,
      `        </link>`,
    ].join("\n");
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  createSdfFile(): string {
    const sensorXml = this.sensors
      .map((sensor) => {
        switch (sensor.type) {
          case SensorType.IMU:
            return this.createImuSensorXml(sensor as IMUSensor);
          case SensorType.SONAR:
            return this.createSonarSensorXml(sensor as SonarSensor);
          case SensorType.RADAR:
            // TODO: implement createRadarSensorXml
            return "";
          case SensorType.AIS:
            return this.createAisSensorXml(sensor as AISSensor);
          default:
            console.warn(`Unknown sensor type: ${(sensor as Sensor).type}`);
            return "";
        }
      })
      .filter(Boolean)
      .join("\n");

    return [
      `<?xml version="1.0"?>`,
      `<sdf version="1.10">`,
      `    <model name="${this.name}">`,
      `        <link name="base_link">`,
      `            <visual name="visual">`,
      `                <geometry>`,
      `                    <mesh>`,
      `                        <uri>model://${this.name}/${this.name}.stl</uri>`,
      `                    </mesh>`,
      `                </geometry>`,
      `            </visual>`,
      `            <collision name="body_collision">`,
      `                <geometry>`,
      `                    <mesh>`,
      `                        <uri>model://${this.name}/${this.name}.stl</uri>`,
      `                        <scale>1 1 1</scale>`,
      `                    </mesh>`,
      `                </geometry>`,
      `            </collision>`,
      `        </link>`,
      sensorXml,
      `    </model>`,
      `</sdf>`,
    ].join("\n");
  }
}
