# Changelog

## [0.12.0](https://github.com/Likyly/sdks/compare/mcp-v0.11.0...mcp-v0.12.0) (2026-11-17)


### Features

* **mcp:** placements take strategy also_bought - customers who bought this also bought, for a product page ([bbc273b](https://github.com/Likyly/sdks/commit/bbc273b156ae7ca067ffb9d31e569871d9802409))

## [0.11.0](https://github.com/Likyly/sdks/compare/mcp-v0.10.0...mcp-v0.11.0) (2026-11-16)


### Features

* **mcp:** placements take business_rules.unknown_current_item - a product page whose product is not in the catalog shows nothing by default ([bbd166d](https://github.com/Likyly/sdks/commit/bbd166db213e428688dc7b4c9eeac93fc6f690d3))

## [0.10.0](https://github.com/Likyly/sdks/compare/mcp-v0.9.0...mcp-v0.10.0) (2026-11-16)


### Features

* **mcp:** Magento - the wizard creates the read-only Integration and enables the module; the assistant flushes the cache with .likyly/bin-magento and never runs likyly:integration itself ([89e984a](https://github.com/Likyly/sdks/commit/89e984ac72203ce7e031cd0882ee2b6408bb7630))

## [0.9.0](https://github.com/Likyly/sdks/compare/mcp-v0.8.0...mcp-v0.9.0) (2026-11-16)


### Features

* **mcp:** Magento sources - the magento type, and its credentials never collected in the conversation (npx @likyly/wizard magento) ([cff3cc2](https://github.com/Likyly/sdks/commit/cff3cc20e10a53c554e3e35a6836034e96e2ed7b))

## [0.8.0](https://github.com/Likyly/sdks/compare/mcp-v0.7.0...mcp-v0.8.0) (2026-11-16)


### Features

* **mcp:** offer the site's preview (yes/no) and launch it through npx @likyly/wizard preview, never shopify theme dev directly ([9f1195b](https://github.com/Likyly/sdks/commit/9f1195b0e15bf0140dcce390db04f4fc69125a8c))

## [0.7.0](https://github.com/Likyly/sdks/compare/mcp-v0.6.0...mcp-v0.7.0) (2026-11-14)


### Features

* **mcp:** reuse an existing catalog or placement before suggesting Pro ([099c528](https://github.com/Likyly/sdks/commit/099c528a98b325b438952ff62631649e0a1fc9da))

## [0.6.0](https://github.com/Likyly/sdks/compare/mcp-v0.5.0...mcp-v0.6.0) (2026-11-13)


### Features

* **mcp:** Shopify credentials go through npx @likyly/wizard shopify, never the conversation ([01bfd2c](https://github.com/Likyly/sdks/commit/01bfd2cd75401182fb970dbc1d355921d9c9edc3))

## [0.5.0](https://github.com/Likyly/sdks/compare/mcp-v0.4.3...mcp-v0.5.0) (2026-11-13)


### Features

* **mcp:** instructions sent to every client, key found for every assistant, Shopify client credentials ([a705efa](https://github.com/Likyly/sdks/commit/a705efaaa5eeae1baa65474bb5e3073eb2c8a56c))

## [0.4.3](https://github.com/Likyly/sdks/compare/mcp-v0.4.2...mcp-v0.4.3) (2026-11-08)


### Bug Fixes

* **typescript,mcp:** identify the client to the API (X-Likyly-Client in browsers, User-Agent for the MCP server) ([99a5bc1](https://github.com/Likyly/sdks/commit/99a5bc1606c271a32a347cc7f9b5beb6e3bc9740))
