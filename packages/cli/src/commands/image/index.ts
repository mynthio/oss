import { Command } from "commander";
import type { App } from "../../app.ts";
import { analysisCommands } from "./analyze.ts";
import { generateCommand } from "./generate.ts";
import { uploadCommand } from "./upload.ts";

export const imageCommand = (app: App): Command => {
  const image = new Command("image").description("Generate, upload, and analyze images");

  image.addCommand(generateCommand(app));
  image.addCommand(uploadCommand(app));
  for (const command of analysisCommands(app)) image.addCommand(command);

  return image;
};
