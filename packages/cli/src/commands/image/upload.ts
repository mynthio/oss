import { Command } from "commander";
import { MAX_UPLOAD_FILES, uploadImages } from "../../api/images.ts";
import type { App } from "../../app.ts";
import { UsageError } from "../../errors.ts";
import { glyph, plural, print, printJson } from "../../output/print.ts";
import { SUPPORTED_IMAGE_EXTENSIONS } from "../../utils/files.ts";
import { jsonOption, type JsonFlag } from "../options.ts";

export const uploadCommand = (app: App): Command =>
  new Command("upload")
    .description("Upload local images to Mynth's temporary input storage")
    .argument("<files...>", `Local image files (${SUPPORTED_IMAGE_EXTENSIONS.join(", ")})`)
    .addOption(jsonOption())
    .action(async (files: ReadonlyArray<string>, options: JsonFlag) => {
      if (files.length > MAX_UPLOAD_FILES) {
        throw new UsageError(`too many files: ${files.length} (max ${MAX_UPLOAD_FILES})`);
      }

      const uploaded = await uploadImages(app.api, files);
      if (options.json) {
        printJson({ images: uploaded });
        return;
      }

      print(`${glyph.ok} Uploaded ${plural(uploaded.length, "image")}`);
      for (const { path, url } of uploaded) {
        print(`  ${path}`);
        print(`    -> ${url}`);
      }
    });
