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

import { Pose, Vector3 } from '../interfaces/geometry'
import { quaternionToEulerZYX, radToDeg } from '../utils';

// Xdyn stuff

export interface Wave {
  angle: number;
}

type Rotation = 'clockwise' | 'counterclockwise';

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
export interface ControllSurface {
  name: string;
  pose: Pose;
  referenceArea: number;
  angleOfAttack: number[];
  liftCoefficient: number[];
  dragCoefficient: number[];
  takeWavesOrbitalVelocityIntoAccount: boolean;
};

export interface PropellerWithRudder {
  name: string;

  // Propeller properties
  propellerPose: Pose;
  wakeCoefficient: number;                    // w
  relativeRotativeEfficiency: number;         // etaR
  thrustDeductionFactor: number;              // t
  rotation: Rotation;
  numberOfBlades: number;
  bladeAreaRatio: number;                     // AE/A0
  diameter: number;

  // Rudder properties
  rudderArea: number;
  rudderHeight: number;
  effectiveAspectRatioFactor: number;
  liftTuningCoefficient: number;
  dragTuningCoefficient: number;
  rudderPose: Pose;                   // in body frame
}


export class XdynYaml {
  private name: string = "";
  private wave: Wave;
  private bodyFrameRelativeToMeshFrame: Vector3;
  private hydroForcesCalcPoint: Vector3;
  private centerOfInertia: Vector3;
  private inertiaMatrixAtBuoyancy: number[][] = [];
  private addedMass: number[][] = [];
  private linearDamping: number[][] = [];
  private quadraticDamping: number[][] = [];
  private resistanceCurveSpeed: number[] = [];
  private resistanceCurveResistance: number[] = [];
  private propellers: Propeller[] = [];
  private controllSurfaces: ControllSurface[] = [];
  private propellerWithRudders: PropellerWithRudder[] = [];

  constructor() {
    this.bodyFrameRelativeToMeshFrame = { x: 0, y: 0, z: 0 };
    this.hydroForcesCalcPoint = { x: 0, y: 0, z: 0 };
    this.centerOfInertia = { x: 0, y: 0, z: 0 };
    this.wave = { angle: 0 };
  }

  // Getters and Setters

  public getName(): string {
    return this.name;
  }

  public setName(name: string): void {
    this.name = name;
  }

  public getWave(): Wave {
    return this.wave;
  }

  public setWave(wave: Wave): void {
    this.wave = wave;
  }

  public getBodyFrameRelativeToMeshFrame(): Vector3 {
    return this.bodyFrameRelativeToMeshFrame;
  }

  public setBodyFrameRelativeToMeshFrame(vec: Vector3): void {
    this.bodyFrameRelativeToMeshFrame = vec;
  }

  public getHydroForcesCalcPoint(): Vector3 {
    return this.hydroForcesCalcPoint;
  }

  public setHydroForcesCalcPoint(vec: Vector3): void {
    this.hydroForcesCalcPoint = vec;
  }

  public getCenterOfInertia(): Vector3 {
    return this.centerOfInertia;
  }

  public setCenterOfInertia(vec: Vector3): void {
    this.centerOfInertia = vec;
  }

  public getInertiaMatrixAtBuoyanc(): number[][] {
    return this.inertiaMatrixAtBuoyancy;
  }

  public setInertiaMatrixAtBuoyancy(matrix: number[][]): void {
    this.inertiaMatrixAtBuoyancy = matrix;
  }

  public getAddedMass(): number[][] {
    return this.addedMass;
  }

  public setAddedMass(matrix: number[][]): void {
    this.addedMass = matrix;
  }

  public getLinearDamping(): number[][] {
    return this.linearDamping;
  }

  public setLinearDamping(matrix: number[][]): void {
    this.linearDamping = matrix;
  }

  public getQuadraticDamping(): number[][] {
    return this.quadraticDamping;
  }

  public setQuadraticDamping(matrix: number[][]): void {
    this.quadraticDamping = matrix;
  }

  public getResistanceCurveSpeed(): number[] {
    return this.resistanceCurveSpeed;
  }

  public setResistanceCurveSpeed(speeds: number[]): void {
    this.resistanceCurveSpeed = speeds;
  }

  public getResistanceCurveResistance(): number[] {
    return this.resistanceCurveResistance;
  }

  public setResistanceCurveResistance(resistances: number[]): void {
    this.resistanceCurveResistance = resistances;
  }

  public getPropellers(): Propeller[] {
    return this.propellers;
  }

  public setPropellers(propellers: Propeller[]): void {
    this.propellers = propellers;
  }

  public getControllSurfaces(): ControllSurface[] {
    return this.controllSurfaces;
  }

  public setRudders(controllSurfaces: ControllSurface[]): void {
    this.controllSurfaces = controllSurfaces;
  }

  public getPropellerWithRudders(): PropellerWithRudder[] {
    return this.propellerWithRudders;
  }

  public setPropellerWithRudders(pwr: PropellerWithRudder[]): void {
    this.propellerWithRudders = pwr;
  }

  private vector3ToYamlVec(vec: Vector3, unit: string = 'm', tabs: number = 0): string {
    const indent = '  '.repeat(tabs); // 2 spaces per tab level
    return `
${indent} x: { value: ${vec.x}, unit: ${unit} }
${indent} y: { value: ${vec.y}, unit: ${unit} }
${indent} z: { value: ${vec.z}, unit: ${unit} } `;
  }


  private matrixToYaml(
    name: string,
    matrix: number[][],
    frame: string = 'body',
    indent: number = 0
  ): string {
    if (matrix.length !== 6 || matrix.some(row => row.length !== 6)) {
      throw new Error(`${name} must be a 6x6 matrix`);
    }
    const indentStr = '  '.repeat(indent);
    const subIndent = '  '.repeat(indent + 1);

    let rows = matrix
      .map((row, i) => `${subIndent}row ${i + 1}: [${row.join(', ')}]`)
      .join('\n');

    return `${indentStr}${name}:
${subIndent} frame: ${frame}
${rows} `;
  }

  private resistanceCurveToYaml(): string {
    const speeds = this.resistanceCurveSpeed;
    const resistances = this.resistanceCurveResistance;

    if (speeds.length === 0 || resistances.length === 0) {
      return '';
    }

    const speedsStr = speeds.map((v) => v.toFixed(3)).join(',\n                ');
    const resStr = resistances.map((v) => v.toExponential(3)).join(',\n                ');
    return `
  - model: resistance curve
speed:
{
  unit: m / s,
    values:
  [
    ${speedsStr}
  ],
          }
resistance:
{
  unit: N,
    values:
  [
    ${resStr}
  ],
          } `;
  }

  private formatPropeller(propeller: Propeller, name: string, frame: string = 'mesh(TestShip)'): string {
    const pos = propeller.pose.position;
    const orientation = quaternionToEulerZYX(propeller.pose.orientation);

    return `
  - name: ${name}
model: wageningen B - series
        position of propeller frame:
frame: ${frame}
x: { value: ${pos.x.toFixed(3)}, unit: m }
y: { value: ${pos.y.toFixed(3)}, unit: m }
z: { value: ${pos.z.toFixed(3)}, unit: m }
phi: { value: ${(orientation[2]).toFixed(3)}, unit: rad }
theta: { value: ${(orientation[1]).toFixed(3)}, unit: rad }
psi: { value: ${(orientation[0]).toFixed(3)}, unit: rad }
        wake coefficient w: 0.9
        relative rotative efficiency eta: ${propeller.relativeRotativeEfficiency}
        thrust deduction factor t: ${propeller.thrustDeductionFactor}
rotation: ${propeller.rotation}
        number of blades: ${propeller.numberOfBlades}
        blade area ratio AE / A0: ${propeller.bladeAreaRatio}
diameter: { value: ${propeller.diameter}, unit: m } `;
  }

  private formatControllSurface(controlSurface: ControllSurface, name: string = 'centreboard'): string {
    const pos = controlSurface.pose.position;
    const orientation = quaternionToEulerZYX(controlSurface.pose.orientation);

    return `
  - model: hydrodynamic polar
name: ${name}
        position of calculation frame:
frame: body
x: { value: ${pos.x.toFixed(3)}, unit: m }
y: { value: ${pos.y.toFixed(3)}, unit: m }
z: { value: ${pos.z.toFixed(3)}, unit: m }
phi: { value: ${(orientation[2]).toFixed(3)}, unit: rad }
theta: { value: ${(orientation[1]).toFixed(3)}, unit: rad }
psi: { value: ${(orientation[0]).toFixed(3)}, unit: rad }
        reference area: { value: ${controlSurface.referenceArea}, unit: m ^ 2 }
        angle of attack: { unit: deg, values: [0, 7, 9, 12, 28, 60, 90, 120, 150, 180] }
        lift coefficient: [0.00000, 0.94828, 1.13793, 1.25000, 1.42681, 1.38319, 1.26724, 0.93103, 0.38793, -0.11207]
        drag coefficient: [0.03448, 0.01724, 0.01466, 0.01466, 0.02586, 0.11302, 0.38250, 0.96888, 1.31578, 1.34483]
        take waves orbital velocity into account: false`;
  }

  private formatPropellerWithRudder(pwr: PropellerWithRudder, name: string): string {
    const propPos = pwr.propellerPose;
    const propPosition = propPos.position;
    const propOrientation = propPos.orientation;

    const rudderPos = pwr.rudderPose;
    const rudderPosition = rudderPos.position;
    const rudderOrientation = rudderPos.orientation;

    return `
  - name: ${name}
model: propeller + rudder
        position of propeller frame:
frame: ${this.name}
x: { value: ${propPosition.x.toFixed(3)}, unit: m }
y: { value: ${propPosition.y.toFixed(3)}, unit: m }
z: { value: ${propPosition.z.toFixed(3)}, unit: m }
phi: { value: 0, unit: rad }
theta: { value: 2.95, unit: deg }
psi: { value: 0, unit: deg }
        wake coefficient w: ${pwr.wakeCoefficient}
        relative rotative efficiency etaR: ${pwr.relativeRotativeEfficiency}
        thrust deduction factor t: ${pwr.thrustDeductionFactor}
rotation: ${pwr.rotation === 'clockwise' ? 'clockwise' : 'anti-clockwise'}
        number of blades: ${pwr.numberOfBlades}
        blade area ratio AE / A0: ${pwr.bladeAreaRatio}
diameter: { value: ${pwr.diameter}, unit: m }
        rudder area: { value: ${pwr.rudderArea}, unit: m ^ 2 }
        rudder height: { value: ${pwr.rudderHeight}, unit: m }
        effective aspect ratio factor: ${pwr.effectiveAspectRatioFactor}
        lift tuning coefficient: ${pwr.liftTuningCoefficient}
        drag tuning coefficient: ${pwr.dragTuningCoefficient}
        position of rudder in body frame:
x: { value: ${rudderPosition.x.toFixed(3)}, unit: m }
y: { value: ${rudderPosition.y.toFixed(3)}, unit: m }
z: { value: ${rudderPosition.z.toFixed(3)}, unit: m }
phi: { value: 0, unit: rad }
theta: { value: 2.95, unit: deg }
psi: { value: 0, unit: deg }
`;
  }

  createYaml(): string {
    const environmentYaml = `
rotations convention: [psi, theta', phi'']

environmental constants:
  g: { value: 9.81, unit: m / s ^ 2 }
  rho: { value: 1025, unit: kg / m ^ 3 }
  nu: { value: 1.18e-6, unit: m ^ 2 / s }

environment models:
  - model: no wind
  - model: waves
    discretization:
  ndir: 24
      nfreq: 64
      omega min: { value: 0.1, unit: rad / s }
      omega max: { value: 12, unit: rad / s }
      energy fraction: 1
      equal energy bins: false
    spectra:
  - model: airy
        depth: { value: 100000, unit: m }
        seed of the random data generator: 2
        stretching:
  delta: 1
          h: { unit: m, value: 0 }
        directional spreading:
  type: cos2s
          s: 2
          waves propagating to: { value: ${this.wave.angle}, unit: deg }
  spectral density:
  type: jonswap
          Hs: { value: 1.5, unit: m }
          Tp: { value: 3, unit: s }
          gamma: 1.2
    `;

    const bodyFramePosYaml =
      `    position of body frame relative to mesh:
  frame: mesh
      x: { value: ${this.bodyFrameRelativeToMeshFrame.x}, unit: m }
  y: { value: ${this.bodyFrameRelativeToMeshFrame.y}, unit: m }
  z: { value: ${this.bodyFrameRelativeToMeshFrame.z}, unit: m }
  phi: { value: 0, unit: rad }
      theta: { value: 0, unit: rad }
      psi: { value: 0, unit: rad }`;

    const hydroForcesPosYaml = `      hydrodynamic forces calculation point in body frame: ${this.vector3ToYamlVec(this.hydroForcesCalcPoint, 'm', 4)}`;

    const centerOfInertiaYaml = `      centre of inertia:
  frame: ${this.name}${this.vector3ToYamlVec(this.centerOfInertia, 'm', 4)}`;

    const inertiaMatrixYaml = this.matrixToYaml('rigid body inertia matrix at the center of buoyancy projected in the body frame', this.inertiaMatrixAtBuoyancy, 'body', 3);

    const addedMassYaml = this.matrixToYaml('added mass matrix at the center of buoyancy projected in the body frame', this.addedMass, 'body', 3);

    const linearDampingYaml = this.matrixToYaml('damping matrix at the center of gravity projected in the body frame', this.linearDamping, this.name, 4);

    const quadraticDampingYaml = this.matrixToYaml('damping matrix at the center of gravity projected in the body frame', this.quadraticDamping, this.name, 4);

    const resistanceCurveYaml = this.resistanceCurveToYaml();

    const propellersYaml = this.propellers
      .map((prop, idx) => this.formatPropeller(prop, idx === 0 ? 'PSPropRudd' : 'SBPropRudd'))
      .join('\n');

    const contollSurfacesYaml = this.controllSurfaces
      .map((rud, idx) => this.formatControllSurface(rud, idx === 0 ? 'PSPropRudd' : 'SBPropRudd'))
      .join('\n');

    const propellerRuddersYaml = this.propellerWithRudders
      .map((pwr, idx) => this.formatPropellerWithRudder(pwr, idx === 0 ? 'PSPropRudd' : 'SBPropRudd'))
      .join('\n');

    return `
${environmentYaml}
bodies: # All bodies have NED as parent frame
  - name: ${this.name}
    mesh: ${this.name} / ${this.name}.stl

${bodyFramePosYaml}

    initial position of body frame relative to NED:
  frame: NED
      x: { value: 0, unit: m }
      y: { value: 0, unit: m }
      z: { value: 0, unit: m }
      phi: { value: 0, unit: deg }
      theta: { value: 0, unit: deg }
      psi: { value: 0, unit: deg }

    initial velocity of body frame relative to NED:
  frame: body
      u: { value: 0, unit: m / s }
      v: { value: 0, unit: m / s }
      w: { value: 0, unit: m / s }
      p: { value: 0, unit: rad / s }
      q: { value: 0, unit: rad / s }
      r: { value: 0, unit: rad / s }

    dynamics:
  ${hydroForcesPosYaml}

${centerOfInertiaYaml}

${inertiaMatrixYaml}

${addedMassYaml}

    external forces:
  - model: gravity

  - model: non - linear hydrostatic(fast)

  - model: non - linear Froude - Krylov

  - model: linear damping
${linearDampingYaml}

  - model: quadratic damping
${quadraticDampingYaml}

${resistanceCurveYaml}

${propellersYaml}

${contollSurfacesYaml}

${propellerRuddersYaml}

    `;
  }
}

