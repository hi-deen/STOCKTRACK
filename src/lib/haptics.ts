// Web equivalent of haptics: a short vibration where supported (Android
// browsers/PWA). Silently does nothing elsewhere.
function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    // Ignore.
  }
}

export function hapticTap() {
  vibrate(10);
}

export function hapticSuccess() {
  vibrate([10, 40, 10]);
}

export function hapticError() {
  vibrate([30, 40, 30]);
}
