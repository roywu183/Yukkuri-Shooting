import { expect, it } from "vitest";
import { isMobileDevice } from "../src/game/mobile";

it("辨識手機、Android 平板與使用桌面識別字串的 iPad", () => {
  expect(isMobileDevice("Mozilla iPhone", 5, true)).toBe(true);
  expect(isMobileDevice("Mozilla Android", 5, true)).toBe(true);
  expect(isMobileDevice("Mozilla Macintosh", 5, false)).toBe(true);
  expect(isMobileDevice("Mozilla Windows", 0, false)).toBe(false);
  expect(isMobileDevice("Mozilla Windows", 10, false)).toBe(false);
});

it("桌面識別字串只有一個觸控點時，仍辨識為觸控裝置", () => {
  expect(isMobileDevice("Mozilla Windows Chrome", 1, true)).toBe(true);
  expect(isMobileDevice("Mozilla Linux Chrome", 1, true)).toBe(true);
  expect(isMobileDevice("Mozilla Windows Chrome", 0, true)).toBe(false);
});

it("獨立手機版固定提供方向選擇，不依賴瀏覽器裝置識別", () => {
  expect(isMobileDevice("Mozilla Windows Chrome", 0, false, true)).toBe(true);
  expect(isMobileDevice("Mozilla Windows Chrome", 0, false, false)).toBe(false);
});
