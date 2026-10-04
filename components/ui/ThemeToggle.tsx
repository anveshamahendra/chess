"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { Theme, getTheme, setTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(getTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setThemeState(next);
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      className="p-2 text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white"
      aria-label="Toggle theme"
      aria-pressed={theme === "dark"}
    >
      {theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
