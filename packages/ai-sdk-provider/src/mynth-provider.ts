import {
  type ImageModelV4,
  NoSuchModelError,
  type ProviderV4,
  type Experimental_VideoModelV4 as VideoModelV4,
} from "@ai-sdk/provider";
import { loadApiKey, withoutTrailingSlash } from "@ai-sdk/provider-utils";
import { MynthImage, MynthVideo } from "@mynthio/sdk";

import { MynthImageModel, type MynthImageModelId } from "./mynth-image-model.ts";
import { MynthVideoModel, type MynthVideoModelId } from "./mynth-video-model.ts";
import { DEFAULT_BASE_URL } from "./shared.ts";

export type MynthProviderSettings = {
  /**
   * Mynth API key (`mak_...`). Defaults to the `MYNTH_API_KEY` environment
   * variable, read when a model first generates.
   */
  apiKey?: string;
  /** API base URL. Defaults to `https://api.mynth.io`. */
  baseURL?: string;
};

export interface MynthProvider extends ProviderV4 {
  /** Shorthand for {@link MynthProvider.image}. */
  (modelId: MynthImageModelId): ImageModelV4;
  /** An image model for `generateImage()`. */
  image(modelId: MynthImageModelId): ImageModelV4;
  /** An image model for `generateImage()`. */
  imageModel(modelId: MynthImageModelId): ImageModelV4;
  /** A video model for `experimental_generateVideo()`. */
  video(modelId: MynthVideoModelId): VideoModelV4;
  /** A video model for `experimental_generateVideo()`. */
  videoModel(modelId: MynthVideoModelId): VideoModelV4;
  /** Mynth has no language models. Always throws `NoSuchModelError`. */
  languageModel(modelId: string): never;
  /** Mynth has no embedding models. Always throws `NoSuchModelError`. */
  embeddingModel(modelId: string): never;
}

/** Creates a Mynth provider for the AI SDK. */
export function createMynth(settings: MynthProviderSettings = {}): MynthProvider {
  const baseURL = withoutTrailingSlash(settings.baseURL);
  const reportedBaseURL = baseURL ?? DEFAULT_BASE_URL;

  const clientOptions = () => ({
    apiKey: loadApiKey({
      apiKey: settings.apiKey,
      environmentVariableName: "MYNTH_API_KEY",
      description: "Mynth",
    }),
    baseUrl: baseURL,
  });

  let imageClient: MynthImage | undefined;
  let videoClient: MynthVideo | undefined;

  const createImageModel = (modelId: MynthImageModelId): ImageModelV4 =>
    new MynthImageModel(modelId, {
      provider: "mynth.image",
      baseURL: reportedBaseURL,
      client: () => (imageClient ??= new MynthImage(clientOptions())),
    });

  const createVideoModel = (modelId: MynthVideoModelId): VideoModelV4 =>
    new MynthVideoModel(modelId, {
      provider: "mynth.video",
      baseURL: reportedBaseURL,
      client: () => (videoClient ??= new MynthVideo(clientOptions())),
    });

  const provider = function (modelId: MynthImageModelId): ImageModelV4 {
    if (new.target) {
      throw new Error("The Mynth provider cannot be called with the new keyword.");
    }
    return createImageModel(modelId);
  } as MynthProvider;

  Object.assign(provider, {
    specificationVersion: "v4",
    image: createImageModel,
    imageModel: createImageModel,
    video: createVideoModel,
    videoModel: createVideoModel,
    languageModel: (modelId: string): never => {
      throw new NoSuchModelError({ modelId, modelType: "languageModel" });
    },
    embeddingModel: (modelId: string): never => {
      throw new NoSuchModelError({ modelId, modelType: "embeddingModel" });
    },
  });

  return provider;
}

/** The default Mynth provider, reading the API key from `MYNTH_API_KEY`. */
export const mynth: MynthProvider = createMynth();
