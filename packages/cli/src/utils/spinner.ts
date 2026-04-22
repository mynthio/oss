import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";

// A flowing gradient wave — reads like paint being laid down on a canvas, not a
// generic spinner. 18 half-blocks of green shifting through a shimmering band,
// with one bright "crest" that travels left→right over time.

const FRAME_INTERVAL = Duration.millis(60);
const MESSAGE_INTERVAL_MS = 2800;
const WAVE_WIDTH = 20;

// 256-color palette: dark forest → mid sage → mint → lime → bright highlight.
// Tuned to Mynth-ish greens with a subtle glow at the crest.
const PALETTE = [22, 28, 34, 70, 76, 112, 120, 156, 194, 230] as const;
const ACCENT_CHARS = ["✦", "✧", "✶", "·", "•"] as const;

const C_ACCENT = "\x1b[38;5;230m"; // near-white for bright accents
const C_TEXT = "\x1b[38;5;156m";
const C_DIM = "\x1b[38;5;108m";
const C_RESET = "\x1b[0m";
const C_BOLD = "\x1b[1m";

const CLEAR_LINE = "\r\x1b[K";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";

const DEFAULT_MESSAGES: ReadonlyArray<string> = [
  "Priming the canvas",
  "Summoning pixels",
  "Mixing digital pigments",
  "Whispering to the model",
  "Dreaming up details",
  "Sketching silhouettes",
  "Arranging composition",
  "Weaving light and shadow",
  "Polishing reflections",
  "Sculpting atmosphere",
  "Teaching photons to behave",
  "Taming entropy",
  "Folding noise into form",
  "Breathing life into latents",
  "Tracing final strokes",
];

const isTty = (): boolean =>
  typeof process !== "undefined" && process.stderr && process.stderr.isTTY === true;

const write = (s: string) =>
  Effect.sync(() => {
    if (isTty()) process.stderr.write(s);
  });

// Two overlapping sine waves give organic flow without feeling mechanical.
// `frame` advances ~16fps, so multiplying by small constants keeps it calm.
const waveIntensity = (x: number, frame: number): number => {
  const a = Math.sin(x * 0.55 + frame * 0.18);
  const b = Math.sin(x * 0.23 - frame * 0.11);
  return (a + b * 0.6) / 1.6; // roughly [-1, 1]
};

const renderWave = (frame: number): string => {
  // Bright crest sweeps across the bar and loops.
  const crestPos = frame % (WAVE_WIDTH + 6);
  let out = "";
  for (let x = 0; x < WAVE_WIDTH; x++) {
    const intensity = waveIntensity(x, frame); // -1..1
    const n = (intensity + 1) / 2; // 0..1
    let idx = Math.min(PALETTE.length - 1, Math.floor(n * PALETTE.length));

    // Boost palette near the travelling crest for a glowing highlight.
    const crestDist = Math.abs(x - crestPos);
    if (crestDist <= 1) idx = PALETTE.length - 1;
    else if (crestDist === 2) idx = Math.max(idx, PALETTE.length - 2);

    const color = PALETTE[idx]!;

    // At the crest, occasionally sparkle instead of a solid block.
    if (crestDist === 0 && frame % 3 === 0) {
      const ch = ACCENT_CHARS[frame % ACCENT_CHARS.length]!;
      out += `\x1b[38;5;${color}m${ch}`;
    } else {
      out += `\x1b[38;5;${color}m█`;
    }
  }
  return out + C_RESET;
};

const shuffled = <T>(items: ReadonlyArray<T>): ReadonlyArray<T> => {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
};

const pickMessage = (idx: number, messages: ReadonlyArray<string>) =>
  messages[idx % messages.length] ?? "Working";

const formatLine = (frame: number, message: string, elapsedSec: number): string => {
  const wave = renderWave(frame);
  const msg = `${C_BOLD}${C_TEXT}${message}…${C_RESET}`;
  const elapsed = `${C_DIM}${elapsedSec.toFixed(1)}s${C_RESET}`;
  const prefix = `${C_ACCENT}▍${C_RESET}`;
  return `${prefix} ${wave}  ${msg}  ${elapsed}`;
};

/**
 * Runs `effect` while streaming an animated gradient wave on stderr with
 * rotating status messages. Cleans up on success, failure, or interruption.
 * No-op when stderr isn't a TTY.
 */
export const withSpinner = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  options: { readonly messages?: ReadonlyArray<string> } = {},
): Effect.Effect<A, E, R> => {
  if (!isTty()) return effect;

  const messages = shuffled(options.messages ?? DEFAULT_MESSAGES);

  const loop = Effect.gen(function* () {
    const startedAt = Date.now();
    let frame = 0;
    let msgIdx = 0;
    let lastMsgChange = Date.now();

    yield* write(HIDE_CURSOR);

    while (true) {
      const now = Date.now();
      if (now - lastMsgChange > MESSAGE_INTERVAL_MS) {
        msgIdx++;
        lastMsgChange = now;
      }
      const elapsed = (now - startedAt) / 1000;
      const line = formatLine(frame, pickMessage(msgIdx, messages), elapsed);
      yield* write(`${CLEAR_LINE}${line}`);
      frame++;
      yield* Effect.sleep(FRAME_INTERVAL);
    }
  });

  return Effect.gen(function* () {
    const fiber = yield* Effect.fork(loop);
    return yield* effect.pipe(
      Effect.ensuring(
        Effect.gen(function* () {
          yield* Fiber.interrupt(fiber);
          yield* write(`${CLEAR_LINE}${SHOW_CURSOR}`);
        }),
      ),
    );
  });
};
