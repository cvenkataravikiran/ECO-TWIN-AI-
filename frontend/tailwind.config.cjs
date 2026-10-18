// Tailwind CSS configuration – custom design tokens for EcoTwin AI
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./index.html",
  ],
  theme: {
    extend: {
      colors: {
        // Warm ivory background
        "ivory-50": "#fdfbf6",
        "ivory-100": "#faf6e9",
        // Deep forest‑green primary
        "forest-900": "#0b3d20",
        "forest-800": "#11592c",
        // Sage accent (subtle)
        "sage-500": "#9cab6b",
        // Acid‑lime accent (highlight, used sparingly)
        "acid‑lime-600": "#c4e539",
        // Neutral greys for text
        "neutral-900": "#1f2937",
        "neutral-600": "#4b5563",
      },
      fontFamily: {
        // Editorial headline font – Merriweather (serif)
        serif: ["Merriweather", "serif"],
        // Body text – Inter (sans)
        sans: ["Inter", "sans-serif"],
      },
      spacing: {
        // Custom spacing scale for generous whitespace
        "7": "1.75rem",
        "9": "2.25rem",
        "11": "2.75rem",
      },
      borderRadius: {
        // Slightly sharper than Tailwind default for an editorial feel
        lg: "0.5rem",
      },
      // Optional subtle texture utility – a very light grain
      backgroundImage: theme => ({
        "grain": "linear-gradient(135deg, rgba(255,255,255,0.02) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.02) 75%, transparent 75%, transparent)"
      }),
    },
  },
  plugins: [],
};
