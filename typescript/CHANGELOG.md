# Changelog

## [1.3.0](https://github.com/Likyly/sdks/compare/typescript-v1.2.0...typescript-v1.3.0) (2026-11-28)


### Features

* placement context exclude_item_ids in every SDK - a product never twice on one page ([26daea9](https://github.com/Likyly/sdks/commit/26daea9001bbad8847f8fad29e4690b0e942e7e3))


### Documentation

* **typescript:** name the console's Clear cache button in English ([a49c42f](https://github.com/Likyly/sdks/commit/a49c42ffa497c0780cbdd307caf610a2412ed9eb))

## [1.2.0](https://github.com/Likyly/sdks/compare/typescript-v1.1.4...typescript-v1.2.0) (2026-11-20)


### Features

* **typescript:** the anonymous visitor id lives 13 months from its creation, then a new one replaces it - LikylySession.expiresAt(), ANONYMOUS_ID_LIFETIME_DAYS ([144c081](https://github.com/Likyly/sdks/commit/144c0812cec7029d30cfc350ef7d2f9e8f8c1210))


### Documentation

* every SDK README says LIKYLY keeps visitor data 13 months, and an anonymous id should live 13 months at most ([a71669d](https://github.com/Likyly/sdks/commit/a71669d34758d5b0326ed254ce548821891a5382))

## [1.1.4](https://github.com/Likyly/sdks/compare/typescript-v1.1.3...typescript-v1.1.4) (2026-11-17)


### Bug Fixes

* **typescript:** a block with no current product follows the visit - back on the home page after a product, it asks LIKYLY again ([b2e9f92](https://github.com/Likyly/sdks/commit/b2e9f924c11d8c0acd4c913b17ffcd380bbc5d6c))

## [1.1.3](https://github.com/Likyly/sdks/compare/typescript-v1.1.2...typescript-v1.1.3) (2026-11-10)


### Documentation

* a picture of what LIKYLY shows on every SDK README (product page with two recommendation blocks), hosted in the repo and linked by absolute URL so PyPI, npm, crates.io and NuGet display it ([66253b0](https://github.com/Likyly/sdks/commit/66253b0362ec663b59b47b6c27fe045882762789))

## [1.1.2](https://github.com/Likyly/sdks/compare/typescript-v1.1.1...typescript-v1.1.2) (2026-11-08)


### Bug Fixes

* **typescript,mcp:** identify the client to the API (X-Likyly-Client in browsers, User-Agent for the MCP server) ([99a5bc1](https://github.com/Likyly/sdks/commit/99a5bc1606c271a32a347cc7f9b5beb6e3bc9740))
