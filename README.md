# Mynth OSS

[![coverage](https://codecov.io/gh/mynthio/oss/badge.svg)](https://app.codecov.io/gh/mynthio/oss)

Open-source packages by [Mynth](https://mynth.io).

## Packages

| Package                                                          | Description                                                                     | npm                                                                                                                             | Coverage                                                                                                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@mynthio/sdk`](./packages/sdk)                                 | Official SDK for Mynth image and video generation, analysis, and webhooks       | [![npm](https://img.shields.io/npm/v/@mynthio/sdk)](https://www.npmjs.com/package/@mynthio/sdk)                                 | [![coverage](https://codecov.io/gh/mynthio/oss/badge.svg?flag=sdk)](https://app.codecov.io/gh/mynthio/oss?flags%5B0%5D=sdk)                                 |
| [`@mynthio/cli`](./packages/cli)                                 | Official CLI for generating, analyzing, and delivering images from the terminal | [![npm](https://img.shields.io/npm/v/@mynthio/cli)](https://www.npmjs.com/package/@mynthio/cli)                                 | [![coverage](https://codecov.io/gh/mynthio/oss/badge.svg?flag=cli)](https://app.codecov.io/gh/mynthio/oss?flags%5B0%5D=cli)                                 |
| [`@mynthio/tanstack-ai-adapter`](./packages/tanstack-ai-adapter) | Mynth image generation adapter for TanStack AI                                  | [![npm](https://img.shields.io/npm/v/@mynthio/tanstack-ai-adapter)](https://www.npmjs.com/package/@mynthio/tanstack-ai-adapter) | [![coverage](https://codecov.io/gh/mynthio/oss/badge.svg?flag=tanstack-ai-adapter)](https://app.codecov.io/gh/mynthio/oss?flags%5B0%5D=tanstack-ai-adapter) |

Install the CLI with `npm install -g @mynthio/cli`, or run it once with `npx @mynthio/cli --help`.

## Examples

| Example                                                                         | Description                                                          |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [`tanstack-start-ai-mynth-adapter`](./examples/tanstack-start-ai-mynth-adapter) | Streaming image generation with TanStack Start and the Mynth adapter |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
