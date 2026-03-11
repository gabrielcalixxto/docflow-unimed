/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        unimed: {
          50: "#eef9f2",
          100: "#d6f1e1",
          200: "#b1e1c6",
          300: "#81cf9f",
          400: "#44b572",
          500: "#00995d",
          600: "#007a49",
          700: "#0b5f3c",
          800: "#0c4a2f",
          900: "#0a3824",
        },
        citrus: "#bfd730",
        ember: "#f2992e",
        ink: "#103229",
        mist: "#f3fbf7",
      },
      boxShadow: {
        card: "0 22px 60px rgba(4, 71, 44, 0.10)",
        glow: "0 20px 80px rgba(0, 153, 93, 0.18)",
      },
    },
  },
  plugins: [],
};
