import { UsageError } from "../errors.ts";

/** Commander reducer for repeatable options: `-e a -e b` -> `["a", "b"]`. */
export const collect = (value: string, previous: ReadonlyArray<string> = []): string[] => [
  ...previous,
  value,
];

export const parseInteger =
  (label: string) =>
  (value: string): number => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || String(parsed) !== value) {
      throw new UsageError(`invalid ${label}: "${value}" (expected an integer)`);
    }
    return parsed;
  };

export const parsePositiveInteger =
  (label: string) =>
  (value: string): number => {
    const parsed = parseInteger(label)(value);
    if (parsed <= 0) {
      throw new UsageError(`invalid ${label}: "${value}" (expected a positive integer)`);
    }
    return parsed;
  };

export const parseJsonObject = (raw: string, origin: string): Record<string, unknown> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new UsageError(`invalid JSON in ${origin}: ${(cause as Error).message}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new UsageError(`${origin} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
};

export const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);
