import chalk from "chalk";

/**
 * The mint sprig glyph from the web app (`apps/app` nav pixel glyph), drawn with
 * half-block characters so one terminal cell carries two vertically stacked
 * pixels — which is what makes the pixels come out square.
 *
 * Digits are palette indices, `.` is transparent: unpainted cells keep the
 * terminal's own background, so the glyph sits on light and dark themes alike.
 */
const MINT = [
  "...........",
  ".....4.....",
  "....343....",
  ".....2.....",
  ".344.2.443.",
  "..4432344..",
  ".....2.....",
  ".233.2.332.",
  "..3322233..",
  ".....1.....",
  "...........",
] as const;

/**
 * Mint (oklch hue 168) at four steps, same ramp as the web palette but with the
 * lightness range pulled in: the web's top shades are near-white and vanish on a
 * light terminal. These keep ≥2:1 contrast against both black and white.
 */
const PALETTE: Record<string, string> = {
  "1": "#318267",
  "2": "#00a27a",
  "3": "#33bb92",
  "4": "#6bd1ad",
};

const paint = (top: string, bottom: string): string => {
  const filled = (pixel: string) => pixel !== ".";
  if (!filled(top) && !filled(bottom)) return " ";

  // Without color a half-block would drop the lower pixel, so fall back to shape only.
  if (chalk.level === 0) return filled(top) && filled(bottom) ? "█" : filled(top) ? "▀" : "▄";

  if (!filled(bottom)) return chalk.hex(PALETTE[top]!)("▀");
  if (!filled(top)) return chalk.hex(PALETTE[bottom]!)("▄");
  if (top === bottom) return chalk.hex(PALETTE[top]!)("█");
  return chalk.hex(PALETTE[top]!).bgHex(PALETTE[bottom]!)("▀");
};

/** The glyph, at most 11 cells wide, one line per two grid rows. */
export const logo = (): string => {
  const lines: string[] = [];
  for (let row = 0; row < MINT.length; row += 2) {
    const top = MINT[row]!;
    const bottom = MINT[row + 1] ?? "";
    let line = "";
    for (let column = 0; column < top.length; column += 1) {
      line += paint(top[column]!, bottom[column] ?? ".");
    }
    lines.push(line.trimEnd());
  }
  return lines.filter((line) => line.length > 0).join("\n");
};
