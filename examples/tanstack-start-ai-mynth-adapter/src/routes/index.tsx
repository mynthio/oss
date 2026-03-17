import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Separator } from "#/components/ui/separator";
import { Textarea } from "#/components/ui/textarea";
import { MYNTH_IMAGE_MODELS, type MynthImageModel } from "@mynthio/tanstack-ai-adapter";
import type { ImageGenerationResult } from "@tanstack/ai";
import { fetchServerSentEvents, useGenerateImage } from "@tanstack/ai-react";
import { createFileRoute } from "@tanstack/react-router";
import { useLocalStorage } from "@uidotdev/usehooks";
import { ImageIcon, LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { useState, type SubmitEvent } from "react";

export const Route = createFileRoute("/")({ component: App });

const DEFAULT_MODEL: MynthImageModel = "auto";

const DEFAULT_PROMPT = "Mint leaf laying on the ground";

function App() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [model, setModel] = useState<MynthImageModel>(DEFAULT_MODEL);
  const [images, setImages] = useLocalStorage<Array<string>>("images", []);

  const { error, generate, isLoading } = useGenerateImage({
    connection: fetchServerSentEvents("/api/generate/image"),

    onResult: (result: ImageGenerationResult) => {
      if (!result.images || result.images.length < 1) return;

      setImages((state) => [...result.images.map((i) => i.url!), ...state]);
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
    <div className="flex h-screen w-full flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="flex w-full shrink-0 flex-col border-b border-border lg:h-screen lg:w-80 lg:border-r lg:border-b-0 xl:w-96">
        <div className="flex flex-col gap-1 px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold tracking-tight text-foreground">Mynth AI Adapter</h1>
            <Badge variant="outline">Demo</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Image generation with{" "}
            <a
              href="https://github.com/mynthio/tanstack-ai-adapter"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
            >
              @mynthio/tanstack-ai-adapter
            </a>{" "}
            &amp; TanStack AI
          </p>
        </div>

        <Separator />

        <form className="flex flex-1 flex-col gap-4 overflow-y-auto p-5" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="prompt">
              Prompt
            </label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the image you want to generate..."
              className="min-h-28 resize-y bg-background/50 text-sm lg:min-h-40"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="model">
              Model
            </label>
            <Select value={model} onValueChange={(value) => setModel(value as MynthImageModel)}>
              <SelectTrigger id="model" className="w-full bg-background/50">
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

          <Button type="submit" className="w-full" disabled={isLoading || !prompt.trim()}>
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

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive">
              {error.message}
            </p>
          ) : null}
        </form>
      </aside>

      {/* Main content — image gallery */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Gallery{images.length > 0 && ` (${images.length})`}
            </span>
          </div>
          {images.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => setImages([])}
            >
              <Trash2 className="size-3" />
              Clear
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {images.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="rounded-xl border border-dashed border-border p-4">
                <ImageIcon className="size-8 text-muted-foreground/30" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-muted-foreground/60">No images yet</p>
                <p className="text-xs text-muted-foreground/40">
                  Write a prompt and hit generate to get started.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {images.map((image) => (
                <div
                  key={image}
                  className="group overflow-hidden rounded-xl ring-1 ring-foreground/10"
                >
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={image}
                      alt="Generated image"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
