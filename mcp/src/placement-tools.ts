import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { LikylyClient } from "./client.js";

// Placement tools: the recommended way to wire LIKYLY recommendations into a site. A
// Placement is a named, persistent config ("what to recommend, where, with what fallback and
// filters") - create one, preview it, then the site calls it by slug from
// POST /placements/{slug}/recommend (not an MCP tool - that's a runtime HTTP call the site's
// own code makes, safe with the public key). These tools need the secret key or a developer
// key with placements:read/placements:write - a caller using the wrong key gets a clear
// 401/403 back through the tool result, same as the data-source admin tools.
//
// No LLM call happens in LIKYLY for any of this: turning a developer's natural-language
// request ("4 related products on a PDP, session-based for anonymous visitors...") into the
// parameters below is exactly what the coding agent calling these tools already does -
// that's the point of exposing deterministic primitives instead of another prompt layer.
export function createLikylyPlacementTools(server: McpServer, client: LikylyClient): void {
  function textResult(data: unknown) {
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }

  const slug = z.string().min(1).max(128).describe("The placement's slug, e.g. 'pdp-related'.");
  const strategy = z.enum(["auto", "content", "session", "collaborative", "hybrid", "popular", "also_bought"]);
  const contextType = z.enum([
    "product_page", "listing_page", "category_page", "homepage", "cart", "account", "content_page", "custom",
  ]);
  const signalName = z.enum([
    "current_item_id", "category_id", "collection_id", "user_id", "anonymous_id",
    "session_id", "cart_item_ids", "locale", "custom_context",
  ]);
  const signals = z.object({
    required: z.array(signalName).default([]).describe("Context keys this placement can't run without - missing one is a clear error, never a silent guess."),
    optional: z.array(signalName).default([]).describe("Context keys this placement uses when present, but doesn't need."),
  }).describe("Every context key is optional to send unless listed in `required`.");
  const attributeRule = z.object({ attribute: z.string(), values: z.array(z.unknown()).min(1) });
  const filters = z.object({
    category_in: z.array(z.string()).optional(),
    category_not_in: z.array(z.string()).optional(),
    in_stock_only: z.boolean().optional().describe("Only filters items that actually have a stock/in_stock property - never excludes one for lacking it."),
    include_attributes: z.array(attributeRule).optional(),
    exclude_attributes: z.array(attributeRule).optional(),
  });
  const businessRules = z.object({
    exclude_current_item: z.boolean().optional().describe("Default true - never recommend the item the visitor is already looking at back to itself."),
    unknown_current_item: z.enum(["empty", "popular"]).optional().describe("Default 'empty' - on a product page whose product is not in the catalog (not synced, beyond the plan's product limit), return nothing (strategy_used 'none') instead of unrelated popular items; 'popular' shows those."),
    exclude_cart_items: z.boolean().optional().describe("Never recommend an item already in the cart - use for a cart cross-sell placement."),
    exclude_purchased_items: z.boolean().optional().describe("Default true - never recommend to a signed-in visitor (user_id) an item they already bought; false for products bought again and again (consumables, refills)."),
  });
  const context = z.record(z.unknown()).describe(
    "Sample context to run the placement against - any of current_item_id, category_id, collection_id, user_id, anonymous_id, session_id, cart_item_ids, locale, custom_context.",
  );

  server.tool(
    "list_placements",
    "Lists every placement configured for this account, with its slug, name and catalog (product_type). Read-only.",
    {},
    async () => textResult(await client.listPlacements()),
  );

  server.tool(
    "get_placement",
    "One placement's full configuration by slug.",
    { slug },
    async ({ slug }) => textResult(await client.getPlacement(slug)),
  );

  server.tool(
    "create_placement",
    "Creates a named recommendation configuration: what to recommend, where (context_type), for whom (audience), with which strategy, fallback, filters and business rules; pages request recommendations from it by slug. Strategies run LIKYLY's existing engines (content, session, collaborative, hybrid, popular, and also_bought: \"customers who bought this also bought\", for a product page, with fallback_strategy 'content'); it trains no new model. 'auto' (the default) picks per request from the signals present: hybrid when both a user and an item are known, content from an item alone, session from recent views, collaborative for a known user with a trained model, popular otherwise. `signals.required` lists the context keys the placement can't run without (e.g. current_item_id on a product page); every other key stays optional. `fallback_strategy` is tried when `strategy` returns nothing; 'popular' is always the final safety net. Enabled by default: it serves recommendations as soon as a page requests its slug. A placement beyond the plan's limit is refused with a 403 'plan limit reached'.",
    {
      slug,
      name: z.string().min(1).max(200),
      context_type: contextType.default("custom"),
      product_type: z.string().optional().describe("Catalog namespace to recommend from - omit it when this account has a single catalog."),
      limit: z.number().int().min(1).max(100).default(10),
      audience: z.enum(["all", "anonymous", "identified"]).default("all"),
      strategy: strategy.default("auto"),
      signals: signals.default({ required: [], optional: [] }),
      fallback_strategy: strategy.optional().describe("Tried if `strategy` returns no results. 'popular' is always the final safety net regardless."),
      filters: filters.default({}),
      business_rules: businessRules.default({}),
      enabled: z.boolean().default(true),
    },
    async (input) => textResult(await client.createPlacement(input)),
  );

  server.tool(
    "purge_recommendation_cache",
    "Empties the cache of anonymous recommendations, for one placement (`slug`) or for every placement (no slug). LIKYLY keeps an anonymous visitor's answer for a product for an hour and empties the cache on its own when the catalog or the placement changes; a purge only matters after a change LIKYLY cannot see (stock managed outside LIKYLY, newly deployed product pages) or to get fresh results right away. The live site's next requests are recomputed; no configuration or data is deleted.",
    { slug: slug.optional() },
    async ({ slug }) => textResult(await client.purgeRecommendationCache(slug)),
  );

  server.tool(
    "update_placement",
    "Partially updates an existing placement: only the fields sent change. Sending `signals`, `filters` or `business_rules` replaces that whole sub-object (no deep merge). `enabled: false` disables it (requests for its slug return 404) and `enabled: true` re-enables it. `product_type` moves it to another catalog of the account (an unknown catalog returns a 422 naming the catalogs it has). Changes apply to the live site.",
    {
      slug,
      name: z.string().optional(),
      context_type: contextType.optional(),
      product_type: z.string().optional().describe("Another catalog of this account to recommend from."),
      limit: z.number().int().min(1).max(100).optional(),
      audience: z.enum(["all", "anonymous", "identified"]).optional(),
      strategy: strategy.optional(),
      signals: signals.optional(),
      fallback_strategy: strategy.optional(),
      filters: filters.optional(),
      business_rules: businessRules.optional(),
      enabled: z.boolean().optional(),
    },
    async ({ slug, ...input }) => textResult(await client.updatePlacement(slug, input)),
  );

  server.tool(
    "delete_or_disable_placement",
    "Disables or deletes a placement. mode:'disable' (the default) is reversible: requests for its slug (POST /placements/{slug}/recommend) return 404 at once, the configuration is kept and can be re-enabled. mode:'delete' removes the configuration permanently and cannot be undone; it suits only a configuration that should not exist at all.",
    { slug, mode: z.enum(["disable", "delete"]).default("disable") },
    async ({ slug, mode }) => textResult(mode === "delete" ? await client.deletePlacement(slug) : await client.deactivatePlacement(slug)),
  );

  server.tool(
    "get_placement_requirements",
    "Returns what a page must send to a placement, without running it: the required and optional context signals (current_item_id, user_id, session_id, ...), its strategy, fallback_strategy and context_type. Read-only.",
    { slug },
    async ({ slug }) => textResult(await client.getPlacementRequirements(slug)),
  );

  server.tool(
    "preview_placement",
    "Runs a placement's full orchestration (strategy selection, fallback, filters) against a sample context and returns strategy_used, the items, whether a fallback was used, the strategies attempted, the context signals actually present, and warnings/errors (a missing required signal appears in `errors`, not as a thrown error). Writes nothing and mints no recommendation_id, so nothing is attributed. Meaningful results need real item ids from the catalog. Suits checking a placement before it goes on a site, or debugging one that misbehaves.",
    { slug, context: context.default({}), limit: z.number().int().min(1).max(100).optional() },
    async ({ slug, context, limit }) => textResult(await client.previewPlacement(slug, context, limit)),
  );
}
