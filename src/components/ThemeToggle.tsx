"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="text-gray-500 w-10 h-10 flex items-center justify-center rounded-full">
        <span className="material-symbols-outlined">light_mode</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-white/5"
      title="Alternar Tema"
    >
      <span className="material-symbols-outlined">
        {theme === "dark" ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
