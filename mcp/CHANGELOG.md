# Changelog

## [0.14.0](https://github.com/Likyly/sdks/compare/mcp-v0.13.0...mcp-v0.14.0) (2026-11-28)


### Features

* **mcp:** business_rules.pinned_item_ids - products the merchant puts forward lead a placement ([efb6f34](https://github.com/Likyly/sdks/commit/efb6f34ea4e21d82ca555ca8115614e4a5906cd3))
* **mcp:** performance tool says the trend and revenue come with every plan (Free: 30 days) ([9774a95](https://github.com/Likyly/sdks/commit/9774a958fe77e234cc0974986b1d829075313142))
* **mcp:** placement rules one_per_group, group_by, closest_color and color_attribute - one item per model, each in its colour closest to the current product's ([e77e29f](https://github.com/Likyly/sdks/commit/e77e29f90b69302528204b7d5f957bdab2d5559e))
* **mcp:** placement strategy "personalized" - recommended for you: the visitor's own history, never products similar to the page's ([27c749a](https://github.com/Likyly/sdks/commit/27c749a01f49558fc38e21896de1001e987a4f31))
* **mcp:** recommendation performance, top recommended products and plan usage for assistants (get_recommendation_performance, get_top_recommended_items, get_plan_and_usage) ([7803513](https://github.com/Likyly/sdks/commit/78035136f523eef62d65d8e384212fa1028c7b97))
* **mcp:** search_catalog_items finds a product's id from its name - an assistant previewing a placement for a named product no longer guesses the id ([5e487de](https://github.com/Likyly/sdks/commit/5e487dee30ac02ee0f1674080ec94e90018a974d))
* placement context exclude_item_ids in every SDK - a product never twice on one page ([26daea9](https://github.com/Likyly/sdks/commit/26daea9001bbad8847f8fad29e4690b0e942e7e3))


### Bug Fixes

* **mcp:** input parameter descriptions name no other tool and give no instruction (directory review rules) ([59b3b2b](https://github.com/Likyly/sdks/commit/59b3b2bd1ab3cb826caa6029d76de72be5438581))
* **mcp:** serve the LIKYLY favicon at /favicon.ico - Claude showed the domain's default icon next to the connector ([ee03b78](https://github.com/Likyly/sdks/commit/ee03b7815c87e99ec50ff7390a6078422b206201))
* **mcp:** tool descriptions describe the tool only - the order of the steps moves to the server instructions (directory review rules) ([407d6df](https://github.com/Likyly/sdks/commit/407d6df607c88e40a274654bfb2143473faada7b))


### Documentation

* **mcp:** ChatGPT test with the demo account passes - test cases updated with the tools actually called ([c15c193](https://github.com/Likyly/sdks/commit/c15c19342329dc5a7183d9351570f1d49f6c0ae5))
* **mcp:** demo account ready for the directory reviews (books catalog, two placements) - test cases name what it returns ([52587f8](https://github.com/Likyly/sdks/commit/52587f812b2b58feff611107fc6d6ecd18f3cc38))
* **mcp:** demo video for the ChatGPT review is online ([6393e86](https://github.com/Likyly/sdks/commit/6393e864d8a2aee9ddcd040f7290e1dce32a6c8b))
* **mcp:** directory submission dossier - Claude listing to paste, ChatGPT plugin package (manifest, test cases, icons) and its build script ([b0cdaf9](https://github.com/Likyly/sdks/commit/b0cdaf973422fb8c327aae461ea03189dd3d6ca4))
* **mcp:** the hosted address is https://mcp.likyly.com - /mcp still answers ([59fb33d](https://github.com/Likyly/sdks/commit/59fb33dab60e401117a67b45e94c252a292f5f2b))
* **mcp:** the path in Claude today (Plugins → Add → Add custom connector) ([066b0a8](https://github.com/Likyly/sdks/commit/066b0a8ec42d56a2ec287e57937d12831159c08e))

## [0.13.0](https://github.com/Likyly/sdks/compare/mcp-v0.12.0...mcp-v0.13.0) (2026-11-23)


### Features

* **mcp:** Claude and ChatGPT connect to mcp.likyly.com with OAuth - LIKYLY accounts (Supabase Auth) are the authorization server, the service checks and forwards the access token; every tool has a title and behaviour annotations ([18d873c](https://github.com/Likyly/sdks/commit/18d873c4fa5215f08a9758b9da74f60eb73a4f58))

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
