import type { Config } from "tailwindcss";

// Palco design system.
// Marca ámbar sobre neutrales fríos. Fuente única de verdad de color.
// Los valores replican los tokens de globals.css (:root) para las utilidades de Tailwind.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16181d",
        paper: "#ffffff",
        surface: "#f6f7f9",
        signal: "#b45309",
        "signal-bright": "#e8820c",
        "signal-soft": "#fbebd6",
        "signal-line": "#f0c99a",
        "signal-ring": "#f5d9b0",
        crisis: "#e11d48",
        "crisis-soft": "#fce7ef",
        up: "#059669",
        "up-soft": "#d1fae5",
        muted: "#565d6b",
        line: "#e5e7eb",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        display: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,20,27,0.04), 0 8px 24px rgba(20,20,27,0.05)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
