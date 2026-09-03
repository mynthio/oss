# Changelog

## [0.0.20](https://github.com/mynthio/oss/compare/cli-v0.0.19...cli-v0.0.20) (2026-09-03)


### ⚠ BREAKING CHANGES

* **cli:** stored credentials are now an API key in $XDG_CONFIG_HOME/mynth/credentials.json rather than OAuth tokens in the system keychain. Existing sessions are not migrated; run `mynth auth login` again.

### Features

* **cli:** add api-key commands, browser login, and clearer device prompt ([d68774f](https://github.com/mynthio/oss/commit/d68774ff63a42592cfcb3fee99ae98cddf9bbdd2))
* **cli:** add fuzzy model search and catalog filters ([a35a037](https://github.com/mynthio/oss/commit/a35a0371619df0df35023244771e15a40cf7f705))
* **cli:** show mint glyph on TTY help ([b4885ab](https://github.com/mynthio/oss/commit/b4885ab0fef999cab85c5d29bd2b87bb55d13af4))
* **cli:** store a minted API key instead of OAuth tokens ([2388521](https://github.com/mynthio/oss/commit/2388521720ff8c9e16c258fe59d1e794fb3669c4))


### Bug Fixes

* **cli:** stop caching a key's name and scopes on disk ([168e432](https://github.com/mynthio/oss/commit/168e4323935e35ed7c281ba716e51ba78e190238))
* **cli:** wait 30 minutes and retry transient poll failures ([23ec85e](https://github.com/mynthio/oss/commit/23ec85e216b7492c3e6bbd580680717b55f03c9b))

## [0.0.19](https://github.com/mynthio/oss/compare/cli-v0.0.18...cli-v0.0.19) (2026-08-02)


### Features

* **cli:** add image alt/review and single-image rate ([78e1ce4](https://github.com/mynthio/oss/commit/78e1ce44d2c599c8dab4b75e9df698c597af6394))

## [0.0.18](https://github.com/mynthio/oss/compare/cli-v0.0.17...cli-v0.0.18) (2026-07-08)


### Features

* **cli:** add destination and webhook management commands ([3787e71](https://github.com/mynthio/oss/commit/3787e712eccfbf281adab3b93a72a2499338fb58))

## [0.0.17](https://github.com/mynthio/oss/compare/cli-v0.0.16...cli-v0.0.17) (2026-07-05)


### Features

* **cli:** add account balance and cost estimates ([75e0242](https://github.com/mynthio/oss/commit/75e02428ee787cbdfce3ee3831be0e2d5923dae5))

## [0.0.16](https://github.com/mynthio/oss/compare/cli-v0.0.15...cli-v0.0.16) (2026-07-05)


### Features

* **cli:** add distinct error exit codes ([b7607c5](https://github.com/mynthio/oss/commit/b7607c51d3d77f32b2d439db219f893c95757d29))

## [0.0.15](https://github.com/mynthio/oss/compare/cli-v0.0.14...cli-v0.0.15) (2026-07-05)


### Features

* **cli:** add task wait and list commands ([3736e3c](https://github.com/mynthio/oss/commit/3736e3c215352ac694533af62b8ede6898d77db3))

## [0.0.14](https://github.com/mynthio/oss/compare/cli-v0.0.13...cli-v0.0.14) (2026-06-30)


### Features

* **cli:** add documentation commands ([e43bda8](https://github.com/mynthio/oss/commit/e43bda801fc4b9b102783ea5bd3d7944a7de745f))

## [0.0.13](https://github.com/mynthio/oss/compare/cli-v0.0.12...cli-v0.0.13) (2026-06-26)


### Bug Fixes

* **cli:** align image input roles with api ([3628d17](https://github.com/mynthio/oss/commit/3628d17b43b640f3bf98b8297d96d40103c472aa))

## [0.0.12](https://github.com/mynthio/oss/compare/cli-v0.0.11...cli-v0.0.12) (2026-06-24)


### ⚠ BREAKING CHANGES

* **cli:** input intent prefixes are now sent using the API's as field.

### Features

* **cli:** align image generation with current API ([db1f000](https://github.com/mynthio/oss/commit/db1f00068b7f0ed4705550f33968604a360f36e4))

## [0.0.11](https://github.com/mynthio/oss/compare/cli-v0.0.10...cli-v0.0.11) (2026-06-20)


### Features

* **cli:** support image input intents ([836c138](https://github.com/mynthio/oss/commit/836c1384a0f7dda6706eba2bac64782c28b7899c))

## [0.0.10](https://github.com/mynthio/oss/compare/cli-v0.0.9...cli-v0.0.10) (2026-06-16)


### Bug Fixes

* **cli:** accept null task errors ([b675c42](https://github.com/mynthio/oss/commit/b675c4213aceaac325a72b43d53b898685d829dc))

## [0.0.9](https://github.com/mynthio/oss/compare/cli-v0.0.8...cli-v0.0.9) (2026-06-16)


### Features

* **cli:** add model catalog command ([fcf36e3](https://github.com/mynthio/oss/commit/fcf36e3f027f1e3fa99a552b2ba8c757102a1f78))

## [0.0.8](https://github.com/mynthio/oss/compare/cli-v0.0.7...cli-v0.0.8) (2026-06-11)


### Features

* **cli:** replace Effect CLI runtime ([eeaa5af](https://github.com/mynthio/oss/commit/eeaa5affb2ec0008a152a159ad7fe4d40b5d01cc))

## [0.0.7](https://github.com/mynthio/oss/compare/cli-v0.0.6...cli-v0.0.7) (2026-06-09)


### Bug Fixes

* **cli:** align image and task services with API data envelope ([b779ec3](https://github.com/mynthio/oss/commit/b779ec35ef0e5f1d14ff7adc2e7fbfbaca172cd0))

## [0.0.6](https://github.com/mynthio/oss/compare/cli-v0.0.5...cli-v0.0.6) (2026-05-13)


### Bug Fixes

* **cli:** align image commands with current API ([6a34d78](https://github.com/mynthio/oss/commit/6a34d7825f9b74f64b8685fdf92a3dac4b744baa))

## [0.0.5](https://github.com/mynthio/oss/compare/cli-v0.0.4...cli-v0.0.5) (2026-04-22)


### Bug Fixes

* **cli:** require prompt option for image generation ([9eed68b](https://github.com/mynthio/oss/commit/9eed68bc4bef54e0436684dc6cc7e1bcd2014924))

## [0.0.4](https://github.com/mynthio/oss/compare/cli-v0.0.3...cli-v0.0.4) (2026-04-22)


### Features

* **cli:** add Mynth CLI ([b7254aa](https://github.com/mynthio/oss/commit/b7254aabb30b776a6b0ecad28d249cfa65bed3ef))
