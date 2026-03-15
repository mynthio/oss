import { MYNTH_IMAGE_MODELS, mynthImage, type MynthImageModel } from "@mynthio/tanstack-ai-adapter";
import { generateImage, toServerSentEventsResponse } from "@tanstack/ai";
import { createFileRoute } from "@tanstack/react-router";

const DEFAULT_MODEL: MynthImageModel = "auto";

export const Route = createFileRoute("/api/generate/image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();
        const data = body?.data;
        const prompt = typeof data?.prompt === "string" ? data.prompt.trim() : "";
        const requestedModel = data?.modelOptions?.model;
        const model = isMynthImageModel(requestedModel) ? requestedModel : DEFAULT_MODEL;

        if (!prompt) {
          return Response.json({ error: "Prompt is required." }, { status: 400 });
        }

        const stream = generateImage({
          adapter: mynthImage(model),
          prompt,
          numberOfImages: 1,
          stream: true,
        });

        return toServerSentEventsResponse(stream);
      },
    },
  },
});

function isMynthImageModel(model: unknown): model is MynthImageModel {
  return typeof model === "string" && MYNTH_IMAGE_MODELS.includes(model as MynthImageModel);
}
