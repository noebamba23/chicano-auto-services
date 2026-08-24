import { describe, expect, it } from "vitest";
import { formatChicanoVehicleId } from "./vehicle-id";

describe("formatChicanoVehicleId", () => {
  it("pads small sequence numbers to 6 digits", () => {
    expect(formatChicanoVehicleId(1)).toBe("CHC-VH-000001");
  });

  it("does not truncate sequence numbers longer than the pad width", () => {
    expect(formatChicanoVehicleId(1234567)).toBe("CHC-VH-1234567");
  });
});
