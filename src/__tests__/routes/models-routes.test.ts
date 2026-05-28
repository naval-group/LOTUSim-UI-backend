import request from "supertest";
import express from "express";
import fs from "fs";
import path from "path";
import os from "os";

const TEST_DIR = path.join(os.tmpdir(), "lotusim-test-models");

jest.mock("../../utils", () => ({
  modelsPath: require("path").join(require("os").tmpdir(), "lotusim-test-models"),
  errorMessage: (err: unknown) => (err instanceof Error ? err.message : "Internal server error"),
}));

jest.mock("../../models/sdf", () => ({
  SDF: jest.fn().mockImplementation(() => ({
    createSdfFile: () => "<sdf>mock</sdf>",
    name: "",
    stlUrl: "",
    imagePath: "",
    sensors: [],
  })),
}));

jest.mock("../../models/xdyn-yaml", () => ({
  XdynYaml: jest.fn().mockImplementation(() => ({
    createYaml: () => "name: mock",
    name: "",
    wave: null,
    bodyFrameRelativeToMeshFrame: null,
    hydroForcesCalcPoint: null,
    centerOfInertia: null,
    inertiaMatrixAtBuoyancy: [],
    addedMass: [],
    linearDamping: [],
    quadraticDamping: [],
    resistanceCurveSpeed: [],
    resistanceCurveResistance: [],
    propellers: [],
    controlSurfaces: [],
    propellerWithRudders: [],
  })),
}));

import modelsRouter from "../../routes/models-routes";

const app = express();
app.use(express.json());
app.use("/", modelsRouter);

beforeAll(async () => {
  await fs.promises.mkdir(TEST_DIR, { recursive: true });
});

beforeEach(async () => {
  const entries = await fs.promises.readdir(TEST_DIR);
  for (const entry of entries) {
    await fs.promises.rm(path.join(TEST_DIR, entry), { recursive: true, force: true });
  }
});

afterAll(async () => {
  await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
});

// ─── GET /models ─────────────────────────────────────────────

describe("GET /models", () => {
  it("returns an empty list when no models exist", async () => {
    const res = await request(app).get("/models");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.models).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it("returns only directories, not files", async () => {
    await fs.promises.mkdir(path.join(TEST_DIR, "ship1"));
    await fs.promises.mkdir(path.join(TEST_DIR, "ship2"));
    await fs.promises.writeFile(path.join(TEST_DIR, "readme.txt"), "");

    const res = await request(app).get("/models");
    expect(res.status).toBe(200);
    expect(res.body.models).toEqual(expect.arrayContaining(["ship1", "ship2"]));
    expect(res.body.models).not.toContain("readme.txt");
    expect(res.body.count).toBe(2);
  });
});

// ─── GET /model/:name ─────────────────────────────────────────

describe("GET /model/:name", () => {
  it("returns 404 for a nonexistent model", async () => {
    const res = await request(app).get("/model/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  it("returns the file list for an existing model", async () => {
    const modelPath = path.join(TEST_DIR, "myShip");
    await fs.promises.mkdir(modelPath);
    await fs.promises.writeFile(path.join(modelPath, "model.sdf"), "<sdf/>");
    await fs.promises.writeFile(path.join(modelPath, "xdyn.yml"), "name: myShip");

    const res = await request(app).get("/model/myShip");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.model).toBe("myShip");
    expect(res.body.files).toEqual(expect.arrayContaining(["model.sdf", "xdyn.yml"]));
  });
});

// ─── POST /model ──────────────────────────────────────────────

describe("POST /model", () => {
  const validBody = {
    modelName: "testShip",
    stl: "testShip.stl",
    image: "testShip.png",
    sensors: [],
  };

  it("returns 400 when modelName is missing", async () => {
    const res = await request(app)
      .post("/model")
      .send({ stl: "foo.stl", image: "foo.png", sensors: [] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 when stl is missing", async () => {
    const res = await request(app)
      .post("/model")
      .send({ modelName: "ship", image: "foo.png", sensors: [] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 when image is missing", async () => {
    const res = await request(app)
      .post("/model")
      .send({ modelName: "ship", stl: "foo.stl", sensors: [] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("creates model directory and SDF file", async () => {
    const res = await request(app).post("/model").send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(fs.existsSync(path.join(TEST_DIR, "testShip", "model.sdf"))).toBe(true);
  });

  it("creates xdyn.yml when xdyn data is provided", async () => {
    const res = await request(app)
      .post("/model")
      .send({
        ...validBody,
        modelName: "testShipXdyn",
        xdyn: {
          name: "testShipXdyn",
          wave: {},
          meshDir: "",
          bodyFrameRelativeToMeshFrame: { x: 0, y: 0, z: 0 },
          hydroForcesCalcPoint: { x: 0, y: 0, z: 0 },
          centerOfInertia: { x: 0, y: 0, z: 0 },
          inertiaMatrixAtBuoyancy: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
          addedMass: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
          linearDamping: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
          quadraticDamping: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
          resistanceCurveSpeed: [0, 1],
          resistanceCurveResistance: [0, 100],
          propellers: [],
          rudders: [],
          propellerWithRudders: [],
        },
      });
    expect(res.status).toBe(201);
    expect(fs.existsSync(path.join(TEST_DIR, "testShipXdyn", "xdyn.yml"))).toBe(true);
  });

  it("does not create xdyn.yml when xdyn is omitted", async () => {
    await request(app).post("/model").send(validBody);
    expect(fs.existsSync(path.join(TEST_DIR, "testShip", "xdyn.yml"))).toBe(false);
  });
});

// ─── DELETE /model/:name ──────────────────────────────────────

describe("DELETE /model/:name", () => {
  it("returns 404 for a nonexistent model", async () => {
    const res = await request(app).delete("/model/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("deletes the model directory", async () => {
    const modelPath = path.join(TEST_DIR, "toDelete");
    await fs.promises.mkdir(modelPath);
    await fs.promises.writeFile(path.join(modelPath, "model.sdf"), "");

    const res = await request(app).delete("/model/toDelete");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(fs.existsSync(modelPath)).toBe(false);
  });
});
