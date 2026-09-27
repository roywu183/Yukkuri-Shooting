import { describe, expect, it } from "vitest";
import { translateText } from "../src/ui/locale";

describe("language selection", () => {
  it("keeps the original Traditional Chinese text", () => {
    expect(translateText("前往任務板", "zh-Hant")).toBe("前往任務板");
  });

  it("converts interface and content into Simplified Chinese", () => {
    expect(translateText("前往任務板", "zh-Hans")).toBe("前往任务板");
    expect(translateText("綠色圓形徽章", "zh-Hans")).toBe("绿色圆形徽章");
  });

  it("translates interface and mission content into Japanese", () => {
    expect(translateText("前往任務板", "ja")).toBe("任務一覧へ");
    expect(translateText("第一份勤務從社區的公園開始。", "ja"))
      .toBe("最初の任務は地域の公園から始まる。");
  });
});
