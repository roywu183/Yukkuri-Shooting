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

  it("手機方向區的標題、按鈕與說明完整切換三語", () => {
    const sources = ["手機遊戲方向", "直向遊戲", "橫向遊戲", "拖曳畫面瞄準，按鈕射擊；進入勤務時請轉至所選方向。"];
    const simplified = ["手机游戏方向", "直向游戏", "横向游戏", "拖曳画面瞄准，按钮射击；进入勤务时请转至所选方向。"];
    const japanese = ["スマートフォンの画面方向", "縦向きでプレイ", "横向きでプレイ", "画面をドラッグして照準を合わせ、ボタンで発射します。任務を始めるときは選んだ向きに端末を回してください。"];
    sources.forEach((source, index) => {
      expect(translateText(source, "zh-Hant")).toBe(source);
      expect(translateText(source, "zh-Hans")).toBe(simplified[index]);
      expect(translateText(source, "ja")).toBe(japanese[index]);
    });
  });
});
