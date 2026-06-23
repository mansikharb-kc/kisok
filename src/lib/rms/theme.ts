// RMS theme tokens — own purple/colorful kiosk identity.
// IMS greyscale/no-emoji rules do NOT apply to RMS. Finalize values from Figma.
// Phase: P1.0

export const rmsTheme = {
  primary: "#7c3aed",
  primaryDark: "#5b21b6",
  gradientFrom: "#7c3aed",
  gradientTo: "#4c1d95",
  bg: "#f6f5fa",
  surface: "#ffffff",
  text: "#1e1b2e",
  muted: "#6b7280",
} as const;

export type RmsTheme = typeof rmsTheme;
