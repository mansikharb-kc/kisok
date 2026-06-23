// RMS internationalization — multi-language UI + kiosk, RTL, per-center timezone,
// multi-currency (only meaningful once price is shown; price currently hidden). Phase: P1.9
//
// TODO: implement
//  - locale resolution (per branch/screen)
//  - t(key) translation lookup + resource files
//  - RTL handling, locale-aware date/number formatting

export const SUPPORTED_LOCALES = ["en"] as const; // TODO: add more
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export {};
