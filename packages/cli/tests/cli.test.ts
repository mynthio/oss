import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const runCli = (...args: ReadonlyArray<string>) =>
  spawnSync("bun", ["run", "./src/bin.ts", ...args], {
    cwd: packageRoot,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });

describe("mynth cli", () => {
  it("boots", () => {
    expect(true).toBe(true);
  });

  it("requires image generate prompt as an option", () => {
    const help = runCli("image", "generate", "--help");

    expect(help.status).toBe(0);
    expect(help.stdout).toContain("(-p, --prompt text)");
    expect(help.stdout).not.toContain("<prompt>");

    const missingPrompt = runCli("image", "generate");

    expect(missingPrompt.status).toBe(1);
    expect(`${missingPrompt.stdout}${missingPrompt.stderr}`).toContain(
      "Expected to find option: '--prompt'",
    );
  });
});
