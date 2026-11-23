import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

// A human title and the behaviour hints of every tool, as Claude's connector directory and
// ChatGPT's app directory require: read-only tools run without asking, the others show the
// user what they change, destructive ones (deletions, a secret replaced) ask first.
// openWorldHint: the tool reaches outside LIKYLY (the merchant's store or API) or changes what
// the merchant's live site shows.

type Meta = { title: string } & Omit<ToolAnnotations, "title">;

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const READ_EXTERNAL = { ...READ, openWorldHint: true } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
const WRITE_LIVE = { ...WRITE, openWorldHint: true } as const;
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;

export const TOOL_META: Record<string, Meta> = {
  // Recommendations and events (public key)
  get_recommendations: { title: "Get recommendations", ...READ },
  get_popular_recommendations: { title: "Get popular products", ...READ },
  get_cold_start_recommendations: { title: "Get similar products", ...READ },
  get_collaborative_recommendations: { title: "Get recommendations for a user", ...READ },
  get_hybrid_recommendations: { title: "Get hybrid recommendations", ...READ },
  get_session_recommendations: { title: "Get recommendations for a browsing session", ...READ },
  get_user_session_recommendations: { title: "Get recommendations from a user's recent views", ...READ },
  track_event: { title: "Record an event", ...WRITE },

  // Catalog sources
  list_source_types: { title: "List catalog source types", ...READ },
  create_data_source: { title: "Connect a catalog", ...WRITE },
  test_data_source: { title: "Test a catalog connection", ...READ_EXTERNAL },
  preview_data_source: { title: "Preview catalog products", ...READ_EXTERNAL },
  configure_field_mapping: { title: "Map catalog fields", ...WRITE, idempotentHint: true },
  sync_data_source: { title: "Import the catalog", ...WRITE_LIVE },
  get_sync_status: { title: "Check catalog imports", ...READ },
  list_data_sources: { title: "List connected catalogs", ...READ },
  get_catalog_stats: { title: "Catalog statistics", ...READ },
  update_data_source: { title: "Update a catalog connection", ...WRITE, idempotentHint: true },
  delete_data_source: { title: "Delete a catalog connection", ...DESTRUCTIVE },
  push_items: { title: "Send products to LIKYLY", ...WRITE, idempotentHint: true },
  rotate_push_secret: { title: "Replace a catalog's push secret", ...DESTRUCTIVE },

  // Placements
  list_placements: { title: "List placements", ...READ },
  get_placement: { title: "Show a placement", ...READ },
  create_placement: { title: "Create a placement", ...WRITE_LIVE },
  update_placement: { title: "Update a placement", ...WRITE_LIVE, idempotentHint: true },
  delete_or_disable_placement: { title: "Disable or delete a placement", ...DESTRUCTIVE },
  preview_placement: { title: "Preview a placement's recommendations", ...READ },
  get_placement_requirements: { title: "What a placement needs from the page", ...READ },
  purge_recommendation_cache: { title: "Refresh recommendations now", ...WRITE_LIVE, idempotentHint: true },

  // Integration and checks
  get_integration_recipe: { title: "Get the integration code", ...READ },
  get_tracking_requirements: { title: "What to track on the site", ...READ },
  validate_integration: { title: "Check the integration", ...READ },
  get_placement_health: { title: "Placement health", ...READ },
  get_recent_integration_events: { title: "Recent events from the site", ...READ },
  get_model_overview: { title: "Recommendation model and performance", ...READ },
};

/** Applies TOOL_META to every registered tool; a tool without an entry fails at startup. */
export function annotateTools(server: McpServer): void {
  const registered = (server as unknown as { _registeredTools: Record<string, { update(u: object): void }> })._registeredTools;
  for (const [name, tool] of Object.entries(registered)) {
    const meta = TOOL_META[name];
    if (!meta) throw new Error(`Tool ${name} has no title/annotations in tool-meta.ts`);
    const { title, ...hints } = meta;
    tool.update({ title, annotations: { title, ...hints } });
  }
}
