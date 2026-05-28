import { Pose, Vector3 } from "./geometry";

export interface Noise {
  mean: number;
  stddev: number;
  biasMean: number;
  biasStddev: number;
}

export interface NoiseVector3 {
  mean: Vector3;
  stddev: Vector3;
  biasMean: Vector3;
  biasStddev: Vector3;
}

export enum SensorType {
  IMU = "imu",
  SONAR = "sonar",
  RADAR = "radar",
  AIS = "ais",
}

export interface Sensor {
  name: string;
  type: SensorType;
  pose: Pose;
  updateRate: number;
}

export interface IMUSensor extends Sensor {
  /** Reference frame for orientation output. Defaults to ENU (Gazebo convention). */
  coordSystem: "ENU" | "NED" | "NWU";
  linearNoise: NoiseVector3;
  angularNoise: NoiseVector3;
}

export interface SonarSensor extends Sensor {
  /**
   * Horizontal scan parameters. `samples` controls the number of rays per sweep;
   * `resolution` is a multiplier that determines the number of data-point rows,
   * with angular spacing of (maxAngle - minAngle) / (resolution * samples).
   */
  horizontalResolution: number;
  horizontalSamples: number;
  horizontalMinAngle: number;
  horizontalMaxAngle: number;

  /** Vertical scan parameters — same resolution semantics as horizontal. */
  verticalResolution: number;
  verticalSamples: number;
  verticalMinAngle: number;
  verticalMaxAngle: number;

  rangeMin: number;
  rangeMax: number;
  rangeResolution: number;
  rangeNoise: Noise;
}

export interface RadarSensor extends Sensor {
  range: number;
  frequency: number;
}

export interface AISSensor extends Sensor {
  noise: Noise;
}
