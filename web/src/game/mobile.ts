export type PlayOrientation = "portrait" | "landscape";

export function isMobileDevice(
  agent = navigator.userAgent,
  touchPoints = navigator.maxTouchPoints,
  coarse = matchMedia("(pointer: coarse)").matches,
) {
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(agent) ||
    (touchPoints > 0 && coarse) ||
    (touchPoints > 1 && /Macintosh/i.test(agent))
  );
}

export function currentOrientation(): PlayOrientation {
  return innerHeight >= innerWidth ? "portrait" : "landscape";
}

// 方向鎖定是選用功能；不支援的瀏覽器使用手動轉向提示。
export async function requestOrientation(orientation: PlayOrientation) {
  const screenOrientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: string) => Promise<void>;
  };
  if (!screenOrientation?.lock) return;
  try {
    if (
      !document.fullscreenElement &&
      document.documentElement.requestFullscreen
    )
      await document.documentElement.requestFullscreen();
    await screenOrientation.lock(orientation);
  } catch {
    // 全螢幕或方向鎖定遭拒時，仍可透過提示手動轉向。
  }
}
