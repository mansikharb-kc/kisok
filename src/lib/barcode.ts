// Minimal, dependency-free Code 128 (subset B) encoder. Returns the bar/space
// module-width sequence for a string so it can be drawn as SVG <rect> bars.
// Used by the sticker print/preview rendering (no external lib needed).

// Standard Code 128 pattern table: 108 entries (0..103 data, 103 StartA,
// 104 StartB, 105 StartC, 106 Stop). Each pattern is 6 module widths
// (bar,space,bar,space,bar,space); the Stop pattern is 7.
const PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const START_B = 104;
const STOP = 106;

/**
 * Encode an ASCII string (printable 32..126) into Code 128-B module widths.
 * Returns { widths, total } where widths alternates bar,space,bar,... starting
 * with a bar. Non-encodable characters are skipped.
 */
export function code128(value: string): { widths: number[]; total: number } {
  const chars = [...value].filter((c) => {
    const code = c.charCodeAt(0);
    return code >= 32 && code <= 126;
  });

  const codes: number[] = [START_B];
  let checksum = START_B;
  chars.forEach((c, i) => {
    const v = c.charCodeAt(0) - 32; // Code B value
    codes.push(v);
    checksum += v * (i + 1);
  });
  codes.push(checksum % 103);
  codes.push(STOP);

  const widths: number[] = [];
  for (const code of codes) {
    const pat = PATTERNS[code] ?? PATTERNS[STOP];
    for (const ch of pat) widths.push(parseInt(ch, 10));
  }

  const total = widths.reduce((a, b) => a + b, 0);
  return { widths, total };
}
