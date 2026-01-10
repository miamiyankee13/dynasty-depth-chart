const KEY = "dynasty-depthchart.v1";

export function loadAppState() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAppState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearAppState() {
  localStorage.removeItem(KEY);
}