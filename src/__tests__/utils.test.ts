import { errorMessage, quaternionToEulerZYX } from "../utils";

describe("errorMessage", () => {
  it("returns the message from an Error instance", () => {
    expect(errorMessage(new Error("something went wrong"))).toBe("something went wrong");
  });

  it("returns fallback for non-Error values", () => {
    expect(errorMessage("a string")).toBe("Internal server error");
    expect(errorMessage(42)).toBe("Internal server error");
    expect(errorMessage(null)).toBe("Internal server error");
    expect(errorMessage(undefined)).toBe("Internal server error");
    expect(errorMessage({ message: "looks like an error but isnt" })).toBe("Internal server error");
  });

  it("returns empty string for Error with empty message", () => {
    expect(errorMessage(new Error(""))).toBe("");
  });
});

describe("quaternionToEulerZYX", () => {
  const SIN45 = Math.sqrt(2) / 2;

  it("returns [0, 0, 0] for identity quaternion", () => {
    const [yaw, pitch, roll] = quaternionToEulerZYX({ x: 0, y: 0, z: 0, w: 1 });
    expect(yaw).toBeCloseTo(0);
    expect(pitch).toBeCloseTo(0);
    expect(roll).toBeCloseTo(0);
  });

  it("returns 90° yaw for 90° rotation around Z axis", () => {
    const [yaw, pitch, roll] = quaternionToEulerZYX({ x: 0, y: 0, z: SIN45, w: SIN45 });
    expect(yaw).toBeCloseTo(Math.PI / 2);
    expect(pitch).toBeCloseTo(0);
    expect(roll).toBeCloseTo(0);
  });

  it("returns 90° roll for 90° rotation around X axis", () => {
    const [yaw, pitch, roll] = quaternionToEulerZYX({ x: SIN45, y: 0, z: 0, w: SIN45 });
    expect(yaw).toBeCloseTo(0);
    expect(pitch).toBeCloseTo(0);
    expect(roll).toBeCloseTo(Math.PI / 2);
  });

  it("returns 45° pitch for 45° rotation around Y axis", () => {
    // Use 45° (not 90°) to avoid gimbal lock at ±90° pitch
    const sin225 = Math.sin(Math.PI / 8);
    const cos225 = Math.cos(Math.PI / 8);
    const [yaw, pitch, roll] = quaternionToEulerZYX({ x: 0, y: sin225, z: 0, w: cos225 });
    expect(yaw).toBeCloseTo(0);
    expect(pitch).toBeCloseTo(Math.PI / 4);
    expect(roll).toBeCloseTo(0);
  });
});
