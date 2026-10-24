import { expect, it } from "vitest";

import { formatMinutes } from "./minutes";

it("formats minutes for people", () => {
  expect(formatMinutes(0)).toBe("0 min");
  expect(formatMinutes(25)).toBe("25 min");
  expect(formatMinutes(90)).toBe("1 h 30 min");
  expect(formatMinutes(1440)).toBe("24 h");
});
