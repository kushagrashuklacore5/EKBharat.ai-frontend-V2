// Browser-side integrity monitors. Emit event strings the backend IntegrityMonitor
// understands. State-like signals (multi-monitor, devtools) are re-emitted periodically
// so the backend's "recently seen" window stays active while the condition holds.

export interface IntegrityHandle {
  stop: () => void;
  enterFullscreen: () => Promise<void>;
}

export function startIntegrity(onEvent: (e: string, detail?: string) => void): IntegrityHandle {
  const timers: number[] = [];

  // --- Multi-monitor (Window Management API: screen.isExtended) ---
  const checkMonitors = () => {
    try {
      // @ts-expect-error - isExtended is not in older lib.dom typings
      if (window.screen && window.screen.isExtended) onEvent("multi_monitor");
    } catch {
      /* not supported */
    }
  };

  // --- Devtools (docked panel inflates the outer/inner size gap) ---
  const checkDevtools = () => {
    const wGap = window.outerWidth - window.innerWidth;
    const hGap = window.outerHeight - window.innerHeight;
    if (wGap > 200 || hGap > 200) onEvent("devtools_open", `gap ${wGap}x${hGap}`);
  };

  timers.push(window.setInterval(checkMonitors, 2000));
  timers.push(window.setInterval(checkDevtools, 2000));
  checkMonitors();

  // --- VM / remote-desktop heuristic (WebGL renderer string), checked once ---
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = (dbg && gl?.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) as string | undefined;
    if (renderer && /vmware|virtualbox|llvmpipe|parallels|basic render|microsoft basic/i.test(renderer)) {
      onEvent("remote_desktop", renderer);
    }
  } catch {
    /* ignore */
  }

  // --- Clipboard ---
  const onClip = () => onEvent("clipboard");
  document.addEventListener("copy", onClip);
  document.addEventListener("cut", onClip);
  document.addEventListener("paste", onClip);

  // --- Fullscreen / kiosk ---
  const onFs = () => { if (!document.fullscreenElement) onEvent("fullscreen_exit"); };
  document.addEventListener("fullscreenchange", onFs);

  const enterFullscreen = async () => {
    try { await document.documentElement.requestFullscreen(); } catch { /* user may decline */ }
  };

  return {
    stop: () => {
      timers.forEach(clearInterval);
      document.removeEventListener("copy", onClip);
      document.removeEventListener("cut", onClip);
      document.removeEventListener("paste", onClip);
      document.removeEventListener("fullscreenchange", onFs);
    },
    enterFullscreen,
  };
}
