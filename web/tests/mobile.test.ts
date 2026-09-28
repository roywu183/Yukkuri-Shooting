import { expect, it } from "vitest";
import { isMobileDevice } from "../src/game/mobile";

it("辨識手機、Android 平板與使用桌面識別字串的 iPad", () => {
  expect(isMobileDevice("Mozilla iPhone", 5, true)).toBe(true);
  expect(isMobileDevice("Mozilla Android", 5, true)).toBe(true);
  expect(isMobileDevice("Mozilla Macintosh", 5, false)).toBe(true);
  expect(isMobileDevice("Mozilla Windows", 0, false)).toBe(false);
  expect(isMobileDevice("Mozilla Windows", 10, false)).toBe(false);
});
