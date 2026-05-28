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
 * *******************************   XDYN YAML MODULE   ********************************
 * ************************************************************************************
 *
 * Provides a modular system for defining vessel hydrodynamics, propellers, and control surfaces,
 * and for generating YAML configuration files compatible with Xdyn simulations.
 *
 * Features:
 * - Defines vessel hydrodynamic properties: inertia, added mass, linear & quadratic damping.
 * - Models resistance curves as speed vs resistance arrays.
 * - Supports propellers, rudders, and combined propeller-rudder setups with full geometric and
 *   hydrodynamic properties.
 * - Generates structured YAML output for Xdyn simulations.
 *
 */

import { Pose, Vector3 } from "../interfaces/geometry";
import { quaternionToEulerZYX } from "../utils";

// Xdyn stuff

export interface Wave {
  angle: number;
}

type Rotation = "clockwise" | "counterclockwise";

export interface Propeller {
  name: string;
  nameError: boolean;
  pose: Pose;
  wakeCoefficient: number;
  relativeRotativeEfficiency: number;
  thrustDeductionFactor: number;
  rotation: Rotation;
  numberOfBlades: number;
  bladeAreaRatio: number;
  diameter: number;
}

export interface ControlSurface {
  name: string;
  pose: Pose;
  referenceArea: number;
  angleOfAttack: number[];
  liftCoefficient: number[];
  dragCoefficient: number[];
  takeWavesOrbitalVelocityIntoAccount: boolean;
}

export interface PropellerWithRudder {
  name: string;

  // Propeller properties
  propellerPose: Pose;
  wakeCoefficient: number; // w
  relativeRotativeEfficiency: number; // etaR
  thrustDeductionFactor: number; // t
  rotation: Rotation;
  numberOfBlades: number;
  bladeAreaRatio: number; // AE/A0
  diameter: number;

  // Rudder properties
  rudderArea: number;
  rudderHeight: number;
  effectiveAspectRatioFactor: number;
  liftTuningCoefficient: number;
  dragTuningCoefficient: number;
  rudderPose: Pose; // in body frame
}

export class XdynYaml {
  public name: string = "";
  public wave: Wave = { angle: 0 };
  public bodyFrameRelativeToMeshFrame: Vector3 = { x: 0, y: 0, z: 0 };
  public hydroForcesCalcPoint: Vector3 = { x: 0, y: 0, z: 0 };
  public centerOfInertia: Vector3 = { x: 0, y: 0, z: 0 };
  public resistanceCurveSpeed: number[] = [];
  public resistanceCurveResistance: number[] = [];
  public propellers: Propeller[] = [];
  public controlSurfaces: ControlSurface[] = [];
  public propellerWithRudders: PropellerWithRudder[] = [];

  private _inertiaMatrixAtBuoyancy: number[][] = [];
  private _addedMass: number[][] = [];
  private _linearDamping: number[][] = [];
  private _quadraticDamping: number[][] = [];

  private static validate6x6(name: string, matrix: number[][]): void {
    if (matrix.length !== 6 || matrix.some((row) => row.length !== 6)) {
      throw new Error(`${name} must be a 6x6 matrix`);
    }
  }

  get inertiaMatrixAtBuoyancy(): number[][] {
    return this._inertiaMatrixAtBuoyancy;
  }
  set inertiaMatrixAtBuoyancy(matrix: number[][]) {
    XdynYaml.validate6x6("inertiaMatrixAtBuoyancy", matrix);
    this._inertiaMatrixAtBuoyancy = matrix;
  }

  get addedMass(): number[][] {
    return this._addedMass;
  }
  set addedMass(matrix: number[][]) {
    XdynYaml.validate6x6("addedMass", matrix);
    this._addedMass = matrix;
  }

  get linearDamping(): number[][] {
    return this._linearDamping;
  }
  set linearDamping(matrix: number[][]) {
    XdynYaml.validate6x6("linearDamping", matrix);
    this._linearDamping = matrix;
  }

  get quadraticDamping(): number[][] {
    return this._quadraticDamping;
  }
  set quadraticDamping(matrix: number[][]) {
    XdynYaml.validate6x6("quadraticDamping", matrix);
    this._quadraticDamping = matrix;
  }

  // ─── Private formatting helpers ───────────────────────────────────────────

  private vector3ToYamlVec(vec: Vector3, unit = "m", indent = 0): string {
    const pad = "  ".repeat(indent);
    return [
      `${pad}x: { value: ${vec.x}, unit: ${unit} }`,
      `${pad}y: { value: ${vec.y}, unit: ${unit} }`,
      `${pad}z: { value: ${vec.z}, unit: ${unit} }`,
    ].join("\n");
  }

  private matrixToYaml(name: string, matrix: number[][], frame: string, indent: number): string {
    const pad = "  ".repeat(indent);
    const innerPad = "  ".repeat(indent + 1);
    const rows = matrix.map((row, i) => `${innerPad}row ${i + 1}: [${row.join(", ")}]`).join("\n");

    return [`${pad}${name}:`, `${innerPad}frame: ${frame}`, rows].join("\n");
  }

  private resistanceCurveToYaml(): string {
    if (this.resistanceCurveSpeed.length === 0 || this.resistanceCurveResistance.length === 0) {
      return "";
    }

    const speedValues = this.resistanceCurveSpeed
      .map((v) => `              ${v.toFixed(3)}`)
      .join(",\n");
    const resistanceValues = this.resistanceCurveResistance
      .map((v) => `              ${v.toExponential(3)}`)
      .join(",\n");

    return [
      "  - model: resistance curve",
      "    speed:",
      "      unit: m/s",
      "      values:",
      "        [",
      speedValues,
      "        ]",
      "    resistance:",
      "      unit: N",
      "      values:",
      "        [",
      resistanceValues,
      "        ]",
    ].join("\n");
  }

  private formatPropeller(propeller: Propeller, frame: string): string {
    const pos = propeller.pose.position;
    const orientation = quaternionToEulerZYX(propeller.pose.orientation);

    return [
      `  - name: ${propeller.name}`,
      `    model: wageningen B-series`,
      `    position of propeller frame:`,
      `      frame: ${frame}`,
      `      x: { value: ${pos.x.toFixed(3)}, unit: m }`,
      `      y: { value: ${pos.y.toFixed(3)}, unit: m }`,
      `      z: { value: ${pos.z.toFixed(3)}, unit: m }`,
      `      phi:   { value: ${orientation[2].toFixed(3)}, unit: rad }`,
      `      theta: { value: ${orientation[1].toFixed(3)}, unit: rad }`,
      `      psi:   { value: ${orientation[0].toFixed(3)}, unit: rad }`,
      `    wake coefficient w: ${propeller.wakeCoefficient}`,
      `    relative rotative efficiency eta: ${propeller.relativeRotativeEfficiency}`,
      `    thrust deduction factor t: ${propeller.thrustDeductionFactor}`,
      `    rotation: ${propeller.rotation}`,
      `    number of blades: ${propeller.numberOfBlades}`,
      `    blade area ratio AE/A0: ${propeller.bladeAreaRatio}`,
      `    diameter: { value: ${propeller.diameter}, unit: m }`,
    ].join("\n");
  }

  private formatControlSurface(controlSurface: ControlSurface): string {
    const pos = controlSurface.pose.position;
    const orientation = quaternionToEulerZYX(controlSurface.pose.orientation);

    const aoaValues = controlSurface.angleOfAttack.join(", ");
    const liftValues = controlSurface.liftCoefficient.map((v) => v.toFixed(5)).join(", ");
    const dragValues = controlSurface.dragCoefficient.map((v) => v.toFixed(5)).join(", ");

    return [
      `  - model: hydrodynamic polar`,
      `    name: ${controlSurface.name}`,
      `    position of calculation frame:`,
      `      frame: body`,
      `      x: { value: ${pos.x.toFixed(3)}, unit: m }`,
      `      y: { value: ${pos.y.toFixed(3)}, unit: m }`,
      `      z: { value: ${pos.z.toFixed(3)}, unit: m }`,
      `      phi:   { value: ${orientation[2].toFixed(3)}, unit: rad }`,
      `      theta: { value: ${orientation[1].toFixed(3)}, unit: rad }`,
      `      psi:   { value: ${orientation[0].toFixed(3)}, unit: rad }`,
      `    reference area: { value: ${controlSurface.referenceArea}, unit: m^2 }`,
      `    angle of attack: { unit: deg, values: [${aoaValues}] }`,
      `    lift coefficient: [${liftValues}]`,
      `    drag coefficient: [${dragValues}]`,
      `    take waves orbital velocity into account: ${controlSurface.takeWavesOrbitalVelocityIntoAccount}`,
    ].join("\n");
  }

  private formatPropellerWithRudder(pwr: PropellerWithRudder): string {
    const propPos = pwr.propellerPose.position;
    const rudderPos = pwr.rudderPose.position;

    return [
      `  - name: ${pwr.name}`,
      `    model: propeller + rudder`,
      `    position of propeller frame:`,
      `      frame: ${this.name}`,
      `      x: { value: ${propPos.x.toFixed(3)}, unit: m }`,
      `      y: { value: ${propPos.y.toFixed(3)}, unit: m }`,
      `      z: { value: ${propPos.z.toFixed(3)}, unit: m }`,
      `      phi:   { value: 0, unit: rad }`,
      `      theta: { value: 2.95, unit: deg }`,
      `      psi:   { value: 0, unit: deg }`,
      `    wake coefficient w: ${pwr.wakeCoefficient}`,
      `    relative rotative efficiency etaR: ${pwr.relativeRotativeEfficiency}`,
      `    thrust deduction factor t: ${pwr.thrustDeductionFactor}`,
      `    rotation: ${pwr.rotation === "clockwise" ? "clockwise" : "anti-clockwise"}`,
      `    number of blades: ${pwr.numberOfBlades}`,
      `    blade area ratio AE/A0: ${pwr.bladeAreaRatio}`,
      `    diameter: { value: ${pwr.diameter}, unit: m }`,
      `    rudder area: { value: ${pwr.rudderArea}, unit: m^2 }`,
      `    rudder height: { value: ${pwr.rudderHeight}, unit: m }`,
      `    effective aspect ratio factor: ${pwr.effectiveAspectRatioFactor}`,
      `    lift tuning coefficient: ${pwr.liftTuningCoefficient}`,
      `    drag tuning coefficient: ${pwr.dragTuningCoefficient}`,
      `    position of rudder in body frame:`,
      `      x: { value: ${rudderPos.x.toFixed(3)}, unit: m }`,
      `      y: { value: ${rudderPos.y.toFixed(3)}, unit: m }`,
      `      z: { value: ${rudderPos.z.toFixed(3)}, unit: m }`,
      `      phi:   { value: 0, unit: rad }`,
      `      theta: { value: 2.95, unit: deg }`,
      `      psi:   { value: 0, unit: deg }`,
    ].join("\n");
  }

  createYaml(): string {
    const bfm = this.bodyFrameRelativeToMeshFrame;

    const sections: string[] = [];

    // ── Environment ──────────────────────────────────────────────────────────
    sections.push(
      [
        `rotations convention: [psi, theta', phi'']`,
        ``,
        `environmental constants:`,
        `  g:   { value: 9.81,     unit: m/s^2 }`,
        `  rho: { value: 1025,     unit: kg/m^3 }`,
        `  nu:  { value: 1.18e-6,  unit: m^2/s }`,
        ``,
        `environment models:`,
        `  - model: no wind`,
        `  - model: waves`,
        `    discretization:`,
        `      ndir: 24`,
        `      nfreq: 64`,
        `      omega min: { value: 0.1, unit: rad/s }`,
        `      omega max: { value: 12,  unit: rad/s }`,
        `      energy fraction: 1`,
        `      equal energy bins: false`,
        `    spectra:`,
        `      - model: airy`,
        `        depth: { value: 100000, unit: m }`,
        `        seed of the random data generator: 2`,
        `        stretching:`,
        `          delta: 1`,
        `          h: { unit: m, value: 0 }`,
        `        directional spreading:`,
        `          type: cos2s`,
        `          s: 2`,
        `          waves propagating to: { value: ${this.wave.angle}, unit: deg }`,
        `        spectral density:`,
        `          type: jonswap`,
        `          Hs:    { value: 1.5, unit: m }`,
        `          Tp:    { value: 3,   unit: s }`,
        `          gamma: 1.2`,
      ].join("\n"),
    );

    sections.push(
      [
        `bodies: # All bodies have NED as parent frame`,
        `  - name: ${this.name}`,
        `    mesh: ${this.name}/${this.name}.stl`,
        ``,
        `    position of body frame relative to mesh:`,
        `      frame: mesh`,
        `      x:   { value: ${bfm.x}, unit: m }`,
        `      y:   { value: ${bfm.y}, unit: m }`,
        `      z:   { value: ${bfm.z}, unit: m }`,
        `      phi:   { value: 0, unit: rad }`,
        `      theta: { value: 0, unit: rad }`,
        `      psi:   { value: 0, unit: rad }`,
        ``,
        `    initial position of body frame relative to NED:`,
        `      frame: NED`,
        `      x:   { value: 0, unit: m }`,
        `      y:   { value: 0, unit: m }`,
        `      z:   { value: 0, unit: m }`,
        `      phi:   { value: 0, unit: deg }`,
        `      theta: { value: 0, unit: deg }`,
        `      psi:   { value: 0, unit: deg }`,
        ``,
        `    initial velocity of body frame relative to NED:`,
        `      frame: body`,
        `      u: { value: 0, unit: m/s }`,
        `      v: { value: 0, unit: m/s }`,
        `      w: { value: 0, unit: m/s }`,
        `      p: { value: 0, unit: rad/s }`,
        `      q: { value: 0, unit: rad/s }`,
        `      r: { value: 0, unit: rad/s }`,
      ].join("\n"),
    );

    // ── Dynamics ─────────────────────────────────────────────────────────────
    const hfcp = this.hydroForcesCalcPoint;
    const coi = this.centerOfInertia;

    sections.push(
      [
        `    dynamics:`,
        `      hydrodynamic forces calculation point in body frame:`,
        `        frame: body`,
        this.vector3ToYamlVec(hfcp, "m", 4),
        ``,
        `      centre of inertia:`,
        `        frame: ${this.name}`,
        this.vector3ToYamlVec(coi, "m", 4),
        ``,
        this.matrixToYaml(
          "rigid body inertia matrix at the center of buoyancy projected in the body frame",
          this._inertiaMatrixAtBuoyancy,
          "body",
          3,
        ),
        ``,
        this.matrixToYaml(
          "added mass matrix at the center of buoyancy projected in the body frame",
          this._addedMass,
          "body",
          3,
        ),
      ].join("\n"),
    );

    // ── External forces ───────────────────────────────────────────────────────
    const externalForces: string[] = [
      `    external forces:`,
      `      - model: gravity`,
      `      - model: non-linear hydrostatic (fast)`,
      `      - model: non-linear Froude-Krylov`,
      `      - model: linear damping`,
      this.matrixToYaml(
        "damping matrix at the center of gravity projected in the body frame",
        this._linearDamping,
        this.name,
        4,
      ),
      `      - model: quadratic damping`,
      this.matrixToYaml(
        "damping matrix at the center of gravity projected in the body frame",
        this._quadraticDamping,
        this.name,
        4,
      ),
    ];

    const resistanceYaml = this.resistanceCurveToYaml();
    if (resistanceYaml) externalForces.push(resistanceYaml);

    this.propellers.forEach((p) =>
      externalForces.push(this.formatPropeller(p, `mesh(${this.name})`)),
    );
    this.controlSurfaces.forEach((cs) => externalForces.push(this.formatControlSurface(cs)));
    this.propellerWithRudders.forEach((pwr) =>
      externalForces.push(this.formatPropellerWithRudder(pwr)),
    );

    sections.push(externalForces.join("\n"));

    return sections.join("\n\n");
  }
}
