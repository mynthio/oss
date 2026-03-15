import type { GeneratedImage } from "@tanstack/ai";

export function getGeneratedImageSource(image: GeneratedImage): string | null {
  if (image.url) {
    return image.url;
  }

  if (image.b64Json) {
    return `data:image/png;base64,${image.b64Json}`;
  }

  return null;
}
