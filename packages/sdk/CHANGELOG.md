# Changelog

## [0.0.26](https://github.com/mynthio/oss/compare/sdk-v0.0.25...sdk-v0.0.26) (2026-07-05)


### Features

* **sdk:** add Riverflow 2.0 Pro model ([de1c51a](https://github.com/mynthio/oss/commit/de1c51af06a742ad7c8d7016b3be1cea887f7565))

## [0.0.25](https://github.com/mynthio/oss/compare/sdk-v0.0.24...sdk-v0.0.25) (2026-07-01)


### Features

* **sdk:** add Kling IMAGE 3.0 and Kling IMAGE O3 models ([6df44dc](https://github.com/mynthio/oss/commit/6df44dc93852969fd08eed8d6226a732189eb4c4))

## [0.0.24](https://github.com/mynthio/oss/compare/sdk-v0.0.23...sdk-v0.0.24) (2026-06-30)


### Features

* **sdk:** add Gemini Flash Lite and ImagineArt 2.0 models ([d88de4b](https://github.com/mynthio/oss/commit/d88de4baa6fc593bf62e7bf39599ce93924b2854))

## [0.0.23](https://github.com/mynthio/oss/compare/sdk-v0.0.22...sdk-v0.0.23) (2026-06-30)


### Features

* **sdk:** add Z Image and Wan 2.7 models ([e4e40fe](https://github.com/mynthio/oss/commit/e4e40fe569232b439730c8871fe56081ca020945))

## [0.0.22](https://github.com/mynthio/oss/compare/sdk-v0.0.21...sdk-v0.0.22) (2026-06-26)


### ⚠ BREAKING CHANGES

* **sdk:** Image input roles now use source and reference instead of style, background, product, object, and character.

### Features

* **sdk:** add source and reference image roles ([840aa27](https://github.com/mynthio/oss/commit/840aa274655b199b8f22579dcc3ee8ffb0f09bc0))

## [0.0.21](https://github.com/mynthio/oss/compare/sdk-v0.0.20...sdk-v0.0.21) (2026-06-25)


### Features

* **sdk:** add Grok Imagine quality model ([20dea45](https://github.com/mynthio/oss/commit/20dea45a317a93faecbb5b2c0815229320deccc4))

## [0.0.20](https://github.com/mynthio/oss/compare/sdk-v0.0.19...sdk-v0.0.20) (2026-06-24)


### ⚠ BREAKING CHANGES

* **sdk:** image input intent is now as; legacy size variants, auto provider selection, inputFee, and retired capabilities are removed.

### Features

* **sdk:** update image generation API fields ([#51](https://github.com/mynthio/oss/issues/51)) ([c827fea](https://github.com/mynthio/oss/commit/c827fea95f3c44a42165c1997c81d1449ed08abb))

## [0.0.19](https://github.com/mynthio/oss/compare/sdk-v0.0.18...sdk-v0.0.19) (2026-06-20)


### ⚠ BREAKING CHANGES

* **sdk:** Structured image inputs no longer use the role field; use the optional intent field instead.

### Features

* **sdk:** add image input intents ([1926793](https://github.com/mynthio/oss/commit/192679369d3690603b296222f28da10cac64e3cb))

## [0.0.18](https://github.com/mynthio/oss/compare/sdk-v0.0.17...sdk-v0.0.18) (2026-06-15)


### Features

* **sdk:** add model catalog and async rating ([aa37185](https://github.com/mynthio/oss/commit/aa371856313941796844e0b7547b333dc18331cd))

## [0.0.17](https://github.com/mynthio/oss/compare/sdk-v0.0.16...sdk-v0.0.17) (2026-06-09)


### Bug Fixes

* **sdk:** wrap API responses in data envelope ([c3f42c5](https://github.com/mynthio/oss/commit/c3f42c58ff55d342cbe21c6ca92cfb5d5a01ffdb))

## [0.0.16](https://github.com/mynthio/oss/compare/sdk-v0.0.15...sdk-v0.0.16) (2026-05-12)


### Features

* **sdk:** align image APIs with task schema ([f1e494e](https://github.com/mynthio/oss/commit/f1e494e528b8de3821f675bdc432727904d91250))

## [0.0.15](https://github.com/mynthio/oss/compare/sdk-v0.0.14...sdk-v0.0.15) (2026-04-24)


### Features

* **sdk:** add gpt-image-2 model support ([b5cb14e](https://github.com/mynthio/oss/commit/b5cb14ed2aab94fa9ec23875696bd5d255752a38))

## [0.0.14](https://github.com/mynthio/oss/compare/sdk-v0.0.13...sdk-v0.0.14) (2026-04-21)


### Features

* **sdk:** add destination delivery support ([ec2a575](https://github.com/mynthio/oss/commit/ec2a57555549abff9cbff687ce72c4e66d79b088))

## [0.0.13](https://github.com/mynthio/oss/compare/sdk-v0.0.12...sdk-v0.0.13) (2026-04-12)


### Features

* **sdk:** add ImagineArt 1.5 Pro model ([76061aa](https://github.com/mynthio/oss/commit/76061aae7a39579f39cc6618ee30af891395ba3e))

## [0.0.12](https://github.com/mynthio/oss/compare/sdk-v0.0.11...sdk-v0.0.12) (2026-04-09)


### ⚠ BREAKING CHANGES

* **sdk:** image generation now lives under mynth.image.generate(), TaskAsync#toTask() is now wait(), and Task has been renamed to ImageGenerationResult.

### Features

* **sdk:** split image client and add rating API ([4fa4185](https://github.com/mynthio/oss/commit/4fa4185700bad98cd65bba1898df006c69b6c663))

## [0.0.11](https://github.com/mynthio/oss/compare/sdk-v0.0.10...sdk-v0.0.11) (2026-04-02)


### ⚠ BREAKING CHANGES

* **sdk:** async image task type and webhook event names now use the image.generate namespace.

### Features

* **sdk:** rename async image task event identifiers ([64290f3](https://github.com/mynthio/oss/commit/64290f31dc0700cfd9c91a84b1aae77543b0f930))

## [0.0.10](https://github.com/mynthio/oss/compare/sdk-v0.0.9...sdk-v0.0.10) (2026-04-01)


### Features

* **sdk:** add FLUX.2 Pro, Flex, and Max models ([b45abed](https://github.com/mynthio/oss/commit/b45abedf057a2b6820b01c1437e422eabac2d923))

## [0.0.9](https://github.com/mynthio/oss/compare/sdk-v0.0.8...sdk-v0.0.9) (2026-04-01)


### ⚠ BREAKING CHANGES

* **sdk:** `ImageResultCost.fee` removed, replaced by optional `magic_prompt`

### Features

* **sdk:** add negative_prompt capability and update cost metadata ([b1f329b](https://github.com/mynthio/oss/commit/b1f329be7da3489deb5169cfbec0f0ba8e5f8388))


### Bug Fixes

* **sdk:** update package dependencies ([ddd5387](https://github.com/mynthio/oss/commit/ddd5387f618ee6dd1f3c5f2f5689a7b17e92c44e))

## [0.0.8](https://github.com/mynthio/oss/compare/sdk-v0.0.7...sdk-v0.0.8) (2026-03-30)


### Features

* **sdk:** add Pony Diffusion V6 XL model ([09a054b](https://github.com/mynthio/oss/commit/09a054b71a80eb07eac3bfcbeaf3d181d293124d))

## [0.0.7](https://github.com/mynthio/oss/compare/sdk-v0.0.6...sdk-v0.0.7) (2026-03-27)


### Features

* **sdk:** add PAT access and aspect-ratio request types ([9cb4fde](https://github.com/mynthio/oss/commit/9cb4fdebda1c5ae25d7a68683af593c1570eebcb))

## [0.0.6](https://github.com/mynthio/oss/compare/sdk-v0.0.5...sdk-v0.0.6) (2026-03-16)


### Features

* **models:** add Recraft v4 image models ([efb61d6](https://github.com/mynthio/oss/commit/efb61d6e630c696249ce7f30740924dacd2a9a7e))

## [0.0.5](https://github.com/mynthio/oss/compare/sdk-v0.0.4...sdk-v0.0.5) (2026-03-14)


### Bug Fixes

* **sdk:** sync model capabilities and image response types ([1f503b6](https://github.com/mynthio/oss/commit/1f503b699d0083e2a420e55143c780c37aa68f60))

## [0.0.4](https://github.com/mynthio/mynth-sdk/compare/sdk-v0.0.3...sdk-v0.0.4) (2026-03-10)


### Features

* **monorepo:** move sdk into packages workspace ([e7f66d4](https://github.com/mynthio/mynth-sdk/commit/e7f66d4173e843789556e780e55d4b40e14a9239))

## [0.0.3](https://github.com/mynthio/mynth-sdk/compare/sdk-v0.0.2...sdk-v0.0.3) (2026-03-06)


### Features

* add Seedream 5.0 Lite and Nano Banana 2 models, add 0.5k and 3k size scales ([b5f9cc6](https://github.com/mynthio/mynth-sdk/commit/b5f9cc6013974d071754f13b8845a7551f241fb1))

## [0.0.2](https://github.com/mynthio/mynth-sdk/compare/sdk-v0.0.2...sdk-v0.0.2) (2026-02-25)


### Build System

* switch from changesets to release-please ([a50711b](https://github.com/mynthio/mynth-sdk/commit/a50711b40c9bc033cea37cfee0d109e45d4a0780))

## [0.0.2](https://github.com/mynthio/mynth-sdk/compare/sdk-v0.0.2...sdk-v0.0.2) (2026-02-25)


### Build System

* switch from changesets to release-please ([92f772e](https://github.com/mynthio/mynth-sdk/commit/92f772e079ca470d9da4c558c91545df735ac5c3))

## [0.0.2](https://github.com/mynthio/mynth-sdk/compare/sdk-v0.0.2...sdk-v0.0.2) (2026-02-25)


### Build System

* switch from changesets to release-please ([7e9144e](https://github.com/mynthio/mynth-sdk/commit/7e9144e2b981289f15c980a90e905d8427f810e3))

## [0.0.2](https://github.com/mynthio/mynth-sdk/compare/sdk-v0.0.2...sdk-v0.0.2) (2026-02-25)


### Build System

* switch from changesets to release-please ([041cb29](https://github.com/mynthio/mynth-sdk/commit/041cb293a1114e16eb7274d0af4e17f2c808958e))

## [0.0.2](https://github.com/mynthio/mynth-sdk/compare/sdk-v0.0.2...sdk-v0.0.2) (2026-02-25)


### Build System

* switch from changesets to release-please ([2bf216f](https://github.com/mynthio/mynth-sdk/commit/2bf216fe439db8bd689759f2c7a98e132755d2b4))

## [0.0.2](https://github.com/mynthio/mynth-sdk/compare/sdk-v0.0.2...sdk-v0.0.2) (2026-02-25)


### Build System

* switch from changesets to release-please ([f618987](https://github.com/mynthio/mynth-sdk/commit/f61898727b3979183cc7677ede074e6bbe4f8be3))

## [0.0.2](https://github.com/mynthio/mynth-sdk/compare/sdk-v0.0.1...sdk-v0.0.2) (2026-02-25)


### Build System

* switch from changesets to release-please ([ddf45cd](https://github.com/mynthio/mynth-sdk/commit/ddf45cd6648a1487790cfc0144cd0deebd3be3bc))
