import { MynthImage } from "@mynthio/sdk";
import type { FileHandle, FileUploadInput } from "@tanstack/ai/adapters";
import { BaseFilesAdapter, normalizeFileUploadInput } from "@tanstack/ai/adapters";

import type { MynthFilesConfig } from "./types.ts";

/**
 * Mynth Files adapter for TanStack AI: uploads an image to Mynth's temporary
 * input storage once, so later generations reference it by URL instead of
 * re-sending the bytes.
 *
 * The handle is the uploaded image URL. Pass it to `fileSourceFromHandle()`
 * and use the source in an image prompt part of `mynthImage()`. Upload-only:
 * Mynth has no API to look up or delete an upload, so `getFile()` and
 * `deleteFile()` are unavailable. Mynth accepts JPEG, PNG and WebP images.
 */
export class MynthFilesAdapter extends BaseFilesAdapter<"mynth"> {
  readonly name = "mynth" as const;

  private readonly client: MynthImage;

  constructor(config: MynthFilesConfig = {}) {
    super();

    this.client = new MynthImage({ apiKey: config.apiKey, baseUrl: config.baseUrl });
  }

  override async upload(input: FileUploadInput): Promise<FileHandle<"mynth">> {
    const { blob, mimeType, filename } = normalizeFileUploadInput(input);
    const { urls } = await this.client.upload(blob);
    const url = urls[0];

    if (url === undefined) {
      throw new Error("Mynth upload returned no URL for the uploaded image.");
    }

    return {
      id: url,
      provider: this.name,
      uri: url,
      ...(mimeType !== undefined ? { mimeType } : {}),
      ...(filename !== undefined ? { filename } : {}),
    };
  }
}

/**
 * Creates a Mynth Files adapter for `uploadFile()`.
 *
 * @param config - Optional configuration. If apiKey is omitted, the Mynth SDK
 * falls back to MYNTH_API_KEY.
 *
 * @example
 * ```typescript
 * import { fileSourceFromHandle, generateImage, uploadFile } from '@tanstack/ai'
 * import { mynthFiles, mynthImage } from '@mynthio/tanstack-ai-adapter'
 *
 * const handle = await uploadFile({ adapter: mynthFiles(), input: productPhoto })
 *
 * const result = await generateImage({
 *   adapter: mynthImage('black-forest-labs/flux.2-pro'),
 *   prompt: [
 *     { type: 'text', content: 'Place this product on a marble counter' },
 *     { type: 'image', source: fileSourceFromHandle(handle) },
 *   ],
 * })
 * ```
 */
export function mynthFiles(config?: MynthFilesConfig): MynthFilesAdapter {
  return new MynthFilesAdapter(config);
}
