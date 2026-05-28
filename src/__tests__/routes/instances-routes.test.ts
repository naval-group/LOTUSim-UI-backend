import request from "supertest";
import express from "express";

const mockGetInstanceNames = jest.fn();

jest.mock("../../interfaces/ros", () => ({
  rosInstances: {
    getInstanceNames: mockGetInstanceNames,
  },
}));

import instancesRouter from "../../routes/instances-routes";

const app = express();
app.use(express.json());
app.use("/", instancesRouter);

// ─── GET /instances ───────────────────────────────────────────

describe("GET /instances", () => {
  it("returns an empty list when no instances exist", async () => {
    mockGetInstanceNames.mockReturnValue([]);
    const res = await request(app).get("/instances");
    expect(res.status).toBe(200);
    expect(res.body.instances).toEqual([]);
  });

  it("returns instance names from rosInstances", async () => {
    mockGetInstanceNames.mockReturnValue(["sim1", "sim2"]);
    const res = await request(app).get("/instances");
    expect(res.status).toBe(200);
    expect(res.body.instances).toEqual(["sim1", "sim2"]);
  });
});

// ─── POST /instance ───────────────────────────────────────────

describe("POST /instance", () => {
  it("returns 400 when name is missing", async () => {
    const res = await request(app).post("/instance").send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBeDefined();
  });

  it("returns 200 with success message when name is provided", async () => {
    const res = await request(app).post("/instance").send({ name: "sim1" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("sim1");
  });
});

// ─── DELETE /instance/:name ───────────────────────────────────

describe("DELETE /instance/:name", () => {
  it("returns 200 with success message", async () => {
    const res = await request(app).delete("/instance/sim1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("sim1");
  });
});
