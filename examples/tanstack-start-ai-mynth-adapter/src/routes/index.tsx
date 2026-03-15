import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import { useLocalStorage } from "#/lib/use-local-storage.hook";
import { MYNTH_IMAGE_MODELS, type MynthImageModel } from "@mynthio/tanstack-ai-adapter";
import type { ImageGenerationResult } from "@tanstack/ai";
import { fetchServerSentEvents, useGenerateImage } from "@tanstack/ai-react";
import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle, Sparkles } from "lucide-react";
import { useState, type SubmitEvent } from "react";

export const Route = createFileRoute("/")({ component: App });

const DEFAULT_MODEL: MynthImageModel = "auto";

const DEFAULT_PROMPT = "Mint leaf laying on the ground";

function App() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);

  // Typed model
  const [model, setModel] = useState<MynthImageModel>(DEFAULT_MODEL);

  // Generated Images
  const [images, setImages] = useLocalStorage<Array<string>>("images", []);

  // https://tanstack.com/ai/latest/docs/guides/image-generation#full-stack-usage
  const { error, generate, result, isLoading, reset, status } = useGenerateImage({
    connection: fetchServerSentEvents("/api/generate/image"),

    onResult: (result: ImageGenerationResult) => {
      if (!result.images || result.images.length < 1) return;

      setImages((state) => [...images, ...state]);
    },
  });

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isLoading) {
      return;
    }

    await generate({
      prompt: trimmedPrompt,
      numberOfImages: 1,
      modelOptions: {
        model,
      },
    });
  }

  return (
    <main className="container mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <Card>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt">
                Prompt
              </label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the image you want to generate"
                className="min-h-32 resize-y bg-background/70"
              />
            </div>

            <div className="grid gap-2 sm:max-w-sm">
              <span className="text-sm font-medium text-foreground">Model</span>
              <Select value={model} onValueChange={(value) => setModel(value as MynthImageModel)}>
                <SelectTrigger className="w-full bg-background/70">
                  <SelectValue placeholder="Choose a model" />
                </SelectTrigger>
                <SelectContent>
                  {MYNTH_IMAGE_MODELS.map((availableModel) => (
                    <SelectItem key={availableModel} value={availableModel}>
                      {availableModel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button className="min-w-36" type="submit" disabled={isLoading || !prompt.trim()}>
                {isLoading ? (
                  <>
                    <LoaderCircle className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles />
                    Generate image
                  </>
                )}
              </Button>
            </div>

            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                {error.message}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {images.length > 0 &&
          images.map((image) => (
            <Card key={image} className="overflow-hidden border-border/70 bg-card/90">
              <div className="aspect-square overflow-hidden bg-muted/60">
                <img src={image} className="h-full w-full object-cover" loading="lazy" />
              </div>
            </Card>
          ))}
      </section>
    </main>
  );
}
