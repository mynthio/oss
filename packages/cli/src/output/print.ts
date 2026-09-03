import chalk from "chalk";

export const print = (message = ""): void => {
  process.stdout.write(`${message}\n`);
};

export const printErr = (message = ""): void => {
  process.stderr.write(`${message}\n`);
};

export const printJson = (value: unknown): void => {
  print(JSON.stringify(value, null, 2));
};

export const glyph = {
  ok: chalk.green("✓"),
  fail: chalk.red("✗"),
  pending: chalk.yellow("…"),
} as const;

export const glyphForStatus = (status: string): string =>
  status === "completed" ? glyph.ok : status === "failed" ? glyph.fail : glyph.pending;

export const plural = (count: number, singular: string, suffix = "s"): string =>
  `${count} ${singular}${count === 1 ? "" : suffix}`;

export const indent = (text: string, spaces = 2): string => {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => `${pad}${line}`)
    .join("\n");
};
