export type Theme = "light" | "dark";

const STORAGE_KEY = "chess-theme";

// Reads the persisted theme, falling back to the system preference.
// Must stay in sync with the inline script in app/layout.tsx that applies
// the class before first paint.
export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}
