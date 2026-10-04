import type { MynthSDKTypes } from "./types.ts";

/**
 * An image produced by a Mynth task: generated, upscaled, or with its
 * background removed.
 *
 * @template FormatT - Formats the task can deliver
 */
export type MynthOutputImage<
  FormatT extends MynthSDKTypes.ImageFormat = MynthSDKTypes.ImageFormat,
> = {
  /** Image ID */
  id: string;
  /**
   * Your destination's public URL for the image, or the Mynth CDN URL when the
   * request named no destination. `null` when the destination upload failed or
   * the destination has no public URL.
   *
   * The SDK never swaps in another URL for you: write `url ?? mynthUrl` where
   * any URL will do.
   */
  url: string | null;
  /** Mynth CDN URL. Always set, and served for 7 days. */
  mynthUrl: string;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** `{width}x{height}`, e.g. `"1024x768"` */
  size: string;
  /** File format the image was delivered in */
  format: FormatT;
  /** MIME type matching `format`, e.g. `"image/webp"` */
  mimeType: MynthSDKTypes.ImageMimeType<FormatT>;
  /** Delivery to your destination. `undefined` when the request named none. */
  destination: MynthSDKTypes.ImageResultDestination | undefined;
};

/** The image fields every image-producing task reports (API wire format). */
type OutputImageData<FormatT extends MynthSDKTypes.ImageFormat> = {
  id: string;
  url: string | null;
  mynth_url: string;
  size: string;
  format: FormatT;
  destination?: MynthSDKTypes.ImageResultDestination;
};

const IMAGE_MIME_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
} as const satisfies {
  [FormatT in MynthSDKTypes.ImageFormat]: MynthSDKTypes.ImageMimeType<FormatT>;
};

const SIZE_PATTERN = /^(\d+)x(\d+)$/;

function parseSize(size: string): { width: number; height: number } {
  const match = SIZE_PATTERN.exec(size);

  if (!match) {
    throw new Error(`Unexpected image size "${size}", expected {width}x{height}`);
  }

  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * Map an image from the API wire format.
 *
 * @throws {Error} If `size` is not `{width}x{height}`
 */
export function toOutputImage<FormatT extends MynthSDKTypes.ImageFormat>(
  image: OutputImageData<FormatT>,
): MynthOutputImage<FormatT> {
  const { width, height } = parseSize(image.size);

  return {
    id: image.id,
    url: image.url,
    mynthUrl: image.mynth_url,
    width,
    height,
    size: image.size,
    format: image.format,
    mimeType: IMAGE_MIME_TYPES[image.format],
    destination: image.destination,
  };
}
