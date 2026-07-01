import type { Config } from "tailwindcss";

// Palco design system — distinto de eco.
// Editorial + inteligencia: papel cálido, tinta profunda, señal violeta.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14141b",
        paper: "#faf8f5",
        signal: "#5a3cff",
        "signal-soft": "#ece9ff",
        crisis: "#e5484d",
        up: "#12a150",
        muted: "#6b6b74",
        line: "#e7e3dc",
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
