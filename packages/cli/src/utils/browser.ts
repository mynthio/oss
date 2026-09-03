import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * Whether this looks like a person at a graphical desktop. Deliberately
 * conservative: the login URL is always printed, so a false negative costs a
 * copy-paste, while a false positive fires a browser at an agent, a CI runner,
 * or someone's SSH session.
 */
export const canOpenBrowser = (): boolean => {
  const env = process.env;

  if (env["CI"] !== undefined) return false;
  if (env["SSH_CONNECTION"] !== undefined || env["SSH_TTY"] !== undefined) return false;
  // Piped or redirected stdio means nobody is watching a terminal.
  if (process.stdout.isTTY !== true) return false;

  if (process.platform === "linux") {
    if (env["DISPLAY"] === undefined && env["WAYLAND_DISPLAY"] === undefined) return false;
    if (existsSync("/.dockerenv")) return false;
  }

  return true;
};

const opener = (
  url: string,
): { readonly command: string; readonly args: ReadonlyArray<string> } => {
  switch (process.platform) {
    case "darwin":
      return { command: "open", args: [url] };
    case "win32":
      // The empty string is `start`'s window-title argument; without it a
      // quoted URL would be taken as the title.
      return { command: "cmd", args: ["/c", "start", "", url] };
    default:
      return { command: "xdg-open", args: [url] };
  }
};

/**
 * Opens `url` in the default browser. Resolves false if it could not be
 * launched, so the caller falls back to printing the URL.
 *
 * The URL arrives in an HTTP response, so it is parsed and scheme-checked
 * before reaching a process, and passed as an argument rather than interpolated
 * into a shell command.
 */
export const openInBrowser = async (url: string): Promise<boolean> => {
  try {
    const { protocol } = new URL(url);
    if (protocol !== "https:" && protocol !== "http:") return false;
  } catch {
    return false;
  }

  const { command, args } = opener(url);

  return new Promise((resolve) => {
    try {
      const child = spawn(command, [...args], { detached: true, stdio: "ignore" });
      child.on("error", () => resolve(false));
      child.unref();
      // Nothing reports success, so treat "did not fail immediately" as opened.
      setTimeout(() => resolve(true), 150).unref();
    } catch {
      resolve(false);
    }
  });
};
