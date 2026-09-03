import ora from "ora";

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
  "Tracing final strokes",
];

const ROTATE_INTERVAL_MS = 2_800;

const shuffled = <T>(items: ReadonlyArray<T>): T[] => {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
};

/**
 * Wraps a long-running promise in a spinner on stderr. A no-op when stderr is
 * not a TTY, so piped and `--json` output stays clean.
 */
export const withSpinner = async <A>(
  promise: Promise<A>,
  options: { readonly messages?: ReadonlyArray<string> } = {},
): Promise<A> => {
  if (process.stderr.isTTY !== true) return promise;

  const messages = shuffled(options.messages ?? DEFAULT_MESSAGES);
  let index = 0;
  const spinner = ora({ text: messages[0] ?? "Working", stream: process.stderr }).start();
  const rotate = setInterval(() => {
    index++;
    spinner.text = messages[index % messages.length] ?? "Working";
  }, ROTATE_INTERVAL_MS);

  try {
    return await promise;
  } finally {
    clearInterval(rotate);
    spinner.stop();
  }
};
