import request from "supertest";
import express from "express";
import fs from "fs";
import path from "path";
import os from "os";

const TEST_DIR = path.join(os.tmpdir(), "lotusim-test-scenarios");

jest.mock("../../utils", () => ({
  scenariosPath: require("path").join(require("os").tmpdir(), "lotusim-test-scenarios"),
  errorMessage: (err: unknown) => (err instanceof Error ? err.message : "Internal server error"),
}));

jest.mock("../../interfaces/lotusim/scenario", () => ({
  ScenarioParser: {
    parse: jest.fn().mockReturnValue({
      toYAML: jest.fn().mockReturnValue("name: mock-scenario\nversion: '1.0'"),
      toObject: jest.fn().mockReturnValue({
        name: "mock-scenario",
        description: "A mock scenario",
        version: "1.0",
        author: "NGFE",
        tags: ["demo"],
      }),
    }),
  },
  Scenario: class {
    static fromFile = jest.fn().mockResolvedValue({
      toObject: jest.fn().mockReturnValue({
        name: "mock-scenario",
        description: "A mock scenario",
        version: "1.0",
        author: "NGFE",
        tags: ["demo"],
      }),
    });
  },
}));

import scenariosRouter from "../../routes/scenarios-routes";

const app = express();
app.use(express.json());
app.use("/", scenariosRouter);

const validBody = {
  name: "test-scenario",
  version: "1.0",
  timeOfDay: "12:00",
  date: "2024-01-01",
  referencePosition: { latitude: 10.0, longitude: 20.0, altitude: 0.0 },
  agents: {
    vessel1: {
      model: "ship1",
      position: { latitude: 10.001, longitude: 20.001, altitude: 0.0 },
      heading: 90,
    },
  },
};

const fullBody = {
  ...validBody,
  description: "A demonstration scenario.",
  author: "NGFE",
  tags: ["demo", "multi-domain"],
  agents: {
    lrauv1: {
      model: "lrauv",
      position: { latitude: 48.8566, longitude: 2.3522, altitude: -30.0 },
      heading: 30,
      physicsInterface: {
        initDomain: "underwater",
        domains: [
          {
            domain: "underwater",
            interfaceType: "XDynWebsocket",
            interfaceParams: { uri: "ws://127.0.0.1:12346", thrusters: [{ name: "propeller" }] },
          },
        ],
      },
      renderInterface: {
        enabled: true,
        rendererType: "lrauv",
      },
    },
  },
};

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

// ─── GET /scenarios ───────────────────────────────────────────

describe("GET /scenarios", () => {
  it("returns empty list when no scenarios exist", async () => {
    const res = await request(app).get("/scenarios");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.scenarios).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it("returns only yaml/yml files, not other files", async () => {
    await fs.promises.writeFile(path.join(TEST_DIR, "scenario1.yaml"), "");
    await fs.promises.writeFile(path.join(TEST_DIR, "scenario2.yml"), "");
    await fs.promises.writeFile(path.join(TEST_DIR, "readme.txt"), "");

    const res = await request(app).get("/scenarios");
    expect(res.status).toBe(200);
    expect(res.body.scenarios).toEqual(expect.arrayContaining(["scenario1.yaml", "scenario2.yml"]));
    expect(res.body.scenarios).not.toContain("readme.txt");
    expect(res.body.count).toBe(2);
  });
});

// ─── GET /scenario/:file_name ─────────────────────────────────

describe("GET /scenario/:file_name", () => {
  it("returns 404 for a nonexistent scenario", async () => {
    const res = await request(app).get("/scenario/ghost.yaml");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("accepts file name without extension and appends .yaml", async () => {
    await fs.promises.writeFile(path.join(TEST_DIR, "myScenario.yaml"), "name: test");

    const res = await request(app).get("/scenario/myScenario");
    expect(res.status).toBe(200);
    expect(res.body.file_name).toBe("myScenario.yaml");
  });

  it("returns scenario data for an existing file", async () => {
    await fs.promises.writeFile(path.join(TEST_DIR, "existing.yaml"), "name: existing");

    const res = await request(app).get("/scenario/existing.yaml");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});

// ─── POST /scenario ───────────────────────────────────────────

describe("POST /scenario", () => {
  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/scenario")
      .send({ ...validBody, name: undefined });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 when referencePosition.latitude is not a number", async () => {
    const res = await request(app)
      .post("/scenario")
      .send({
        ...validBody,
        referencePosition: { latitude: "not-a-number", longitude: 20.0, altitude: 0.0 },
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 when an agent is missing its model", async () => {
    const res = await request(app)
      .post("/scenario")
      .send({
        ...validBody,
        agents: {
          vessel1: {
            position: { latitude: 10.0, longitude: 20.0, altitude: 0.0 },
            heading: 0,
          },
        },
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("vessel1");
  });

  it("returns 400 when an agent position is missing", async () => {
    const res = await request(app)
      .post("/scenario")
      .send({
        ...validBody,
        agents: { vessel1: { model: "ship1", heading: 0 } },
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("creates a scenario yaml file on valid request", async () => {
    const res = await request(app).post("/scenario").send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.scenario_id).toBeDefined();

    const files = await fs.promises.readdir(TEST_DIR);
    expect(files.some((f) => f.endsWith(".yaml"))).toBe(true);
  });

  it("returns scenario data in the response", async () => {
    const res = await request(app).post("/scenario").send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
  });

  it("accepts optional metadata fields (description, author, tags)", async () => {
    const res = await request(app).post("/scenario").send(fullBody);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("accepts an agent with renderInterface", async () => {
    const res = await request(app).post("/scenario").send(fullBody);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("accepts an agent with physicsInterface", async () => {
    const res = await request(app).post("/scenario").send(fullBody);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

// ─── PUT /scenario/:file_name ─────────────────────────────────

describe("PUT /scenario/:file_name", () => {
  it("returns 400 when validation fails", async () => {
    const res = await request(app)
      .put("/scenario/test.yaml")
      .send({ ...validBody, name: undefined });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("creates or overwrites a scenario file", async () => {
    const res = await request(app).put("/scenario/overwritten.yaml").send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(fs.existsSync(path.join(TEST_DIR, "overwritten.yaml"))).toBe(true);
  });

  it("appends .yaml when extension is omitted", async () => {
    const res = await request(app).put("/scenario/noext").send(validBody);
    expect(res.status).toBe(200);
    expect(fs.existsSync(path.join(TEST_DIR, "noext.yaml"))).toBe(true);
  });

  it("accepts optional metadata fields on update", async () => {
    const res = await request(app).put("/scenario/full.yaml").send(fullBody);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── DELETE /scenario/:name ───────────────────────────────────

describe("DELETE /scenario/:name", () => {
  it("returns 404 for a nonexistent scenario", async () => {
    const res = await request(app).delete("/scenario/ghost");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("deletes an existing scenario file", async () => {
    const filePath = path.join(TEST_DIR, "toDelete.yaml");
    await fs.promises.writeFile(filePath, "name: toDelete");

    const res = await request(app).delete("/scenario/toDelete");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("includes the file name in the success message", async () => {
    await fs.promises.writeFile(path.join(TEST_DIR, "named.yaml"), "name: named");
    const res = await request(app).delete("/scenario/named");
    expect(res.body.message).toContain("named.yaml");
  });
});
