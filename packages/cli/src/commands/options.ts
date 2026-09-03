import { Option } from "commander";

export type JsonFlag = { readonly json?: boolean };

export const jsonOption = (): Option =>
  new Option("--json", "Output machine-readable JSON instead of a human-readable summary");

export const yesOption = (): Option =>
  new Option("--yes", "Confirm the destructive action (required; there is no interactive prompt)");
