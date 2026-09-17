import { Command } from "commander";
import type { App } from "../../app.ts";
import { analysisCommands } from "./analyze.ts";
import { generateCommand } from "./generate.ts";
import { removeBackgroundCommand } from "./remove-background.ts";
import { uploadCommand } from "./upload.ts";

export const imageCommand = (app: App): Command => {
  const image = new Command("image").description(
    "Generate, upload, analyze, and remove backgrounds from images",
  );

  image.addCommand(generateCommand(app));
  image.addCommand(uploadCommand(app));
  image.addCommand(removeBackgroundCommand(app));
  for (const command of analysisCommands(app)) image.addCommand(command);

  return image;
};
