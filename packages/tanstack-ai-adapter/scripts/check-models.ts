/**
 * Compare the adapter's model table with the live Mynth catalog.
 *
 *   pnpm check:models
 *
 * Checks model IDs, display names, and image-input support. The catalog does
 * not expose native negative prompts or 4k output, so check those against the
 * Mynth docs when adding a model. Exits with an error when anything differs.
 */
import { MYNTH_IMAGE_MODEL_META, MYNTH_IMAGE_MODELS } from "../src/model-meta.ts";

const CATALOG_URL = "https://api.mynth.io/models";

interface CatalogModel {
  id: string;
  display_name: string;
  type: string;
  modes: Record<string, unknown>;
}

const response = await fetch(CATALOG_URL);

if (!response.ok) {
  throw new Error(`GET ${CATALOG_URL} failed with status ${response.status}`);
}

const { data } = (await response.json()) as { data: CatalogModel[] };
const live = new Map(
  data.filter((model) => model.type === "image").map((model) => [model.id, model]),
);
// `auto` is a routing option, not a catalog model.
const known = new Set<string>(MYNTH_IMAGE_MODELS.filter((model) => model !== "auto"));
const problems: string[] = [];

for (const id of live.keys()) {
  if (!known.has(id)) problems.push(`missing from the adapter: ${id}`);
}

for (const [id, meta] of Object.entries(MYNTH_IMAGE_MODEL_META)) {
  if (id === "auto") continue;

  const model = live.get(id);

  if (!model) {
    problems.push(`not in the live catalog: ${id}`);
    continue;
  }

  if (model.display_name !== meta.label) {
    problems.push(`label of ${id}: adapter "${meta.label}", catalog "${model.display_name}"`);
  }

  const liveInputs = "img->img" in model.modes;
  const adapterInputs = (meta.capabilities as ReadonlyArray<string>).includes("inputs");

  if (liveInputs !== adapterInputs) {
    problems.push(`image inputs of ${id}: adapter ${adapterInputs}, catalog ${liveInputs}`);
  }
}

if (problems.length > 0) {
  throw new Error(`The model table differs from ${CATALOG_URL}:\n- ${problems.join("\n- ")}`);
}

console.log(`The model table matches ${CATALOG_URL} (${live.size} image models).`);
