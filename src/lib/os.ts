"use client";

export type PlatformInfo = {
  isMac: boolean;
  isWindows: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isMobile: boolean;
  shortcutKey: string;
  shortcutLabel: string;
};

export function getPlatformInfo(): PlatformInfo {
  if (typeof window === "undefined" || !navigator) {
    return {
      isMac: false,
      isWindows: true,
      isAndroid: false,
      isIOS: false,
      isMobile: false,
      shortcutKey: "Ctrl",
      shortcutLabel: "Ctrl+K",
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  const platform = ((navigator as any).userAgentData?.platform || navigator.platform || "").toLowerCase();

  const isMac = platform.includes("mac") || ua.includes("macintosh");
  const isIOS = /iphone|ipad|ipod/.test(ua) || (isMac && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(ua);
  const isWindows = platform.includes("win") || ua.includes("windows");
  const isMobile = isIOS || isAndroid || /mobile|tablet/.test(ua);

  const isApple = isMac || isIOS;

  return {
    isMac,
    isWindows,
    isAndroid,
    isIOS,
    isMobile,
    shortcutKey: isApple ? "⌘" : "Ctrl",
    shortcutLabel: isApple ? "⌘K" : "Ctrl+K",
  };
}
