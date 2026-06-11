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

const isTty = (): boolean =>
  typeof process !== "undefined" && process.stderr && process.stderr.isTTY === true;

const shuffled = <T>(items: ReadonlyArray<T>): ReadonlyArray<T> => {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
};

export const withSpinner = async <A>(
  promise: Promise<A>,
  options: { readonly messages?: ReadonlyArray<string> } = {},
): Promise<A> => {
  if (!isTty()) return promise;

  const messages = shuffled(options.messages ?? DEFAULT_MESSAGES);
  let messageIndex = 0;
  const spinner = ora({ text: messages[0] ?? "Working", stream: process.stderr }).start();
  const interval = setInterval(() => {
    messageIndex++;
    spinner.text = messages[messageIndex % messages.length] ?? "Working";
  }, 2800);

  try {
    return await promise;
  } finally {
    clearInterval(interval);
    spinner.stop();
  }
};
