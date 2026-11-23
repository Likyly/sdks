import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { LikylyClient } from "./client.js";

// The integration validator: real facts from LIKYLY's own data (recent recommend calls,
// impressions, clicks, product views, add-to-carts, purchases), not a guess from reading the
// site's source. "Vérifie que mon intégration Likyly est correcte" should be answerable by
// calling validate_integration, not by Claude Code re-reading its own previous edits.
export function createLikylyValidatorTools(server: McpServer, client: LikylyClient): void {
  function textResult(text: string) {
    return { content: [{ type: "text" as const, text }] };
  }
  function jsonResult(data: unknown) {
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }

  const slug = z.string().min(1).max(128).describe("The placement's slug.");
  const windowHours = z.number().int().min(1).max(24 * 30).default(24).describe("How far back to look, in hours. Default 24.");

  server.tool(
    "get_tracking_requirements",
    "Lists the events a placement needs instrumented, and why: recommendation_impression and recommendation_click are specific to the placement; product_view, add_to_cart and purchase are catalog-wide funnel events every placement benefits from. Read-only.",
    { slug },
    async ({ slug }) => jsonResult(await client.getTrackingRequirements(slug)),
  );

  server.tool(
    "get_placement_health",
    "Structured counts of what actually arrived for a placement in the last window_hours (default 24, up to 720): recommend calls, impressions, clicks, product views, add-to-carts, purchases, each marked ok/warning/missing, from LIKYLY's own data. The raw numbers, without explanations. Read-only.",
    { slug, window_hours: windowHours },
    async ({ slug, window_hours }) => jsonResult(await client.getPlacementHealth(slug, window_hours)),
  );

  server.tool(
    "get_recent_integration_events",
    "The individual recent recommend calls and tracked events of a placement within window_hours (`limit`, default 20, up to 100), with the item, session and strategy involved in each. For debugging what aggregate counts alone don't explain, e.g. recommendations always requested for the wrong item_id. Read-only.",
    { slug, window_hours: windowHours, limit: z.number().int().min(1).max(100).default(20) },
    async ({ slug, window_hours, limit }) => jsonResult(await client.getRecentIntegrationEvents(slug, window_hours, limit)),
  );

  server.tool(
    "get_model_overview",
    "Read-only report on one catalog's recommendation model. `versions`: every trained version of the collaborative (ALS) model, newest first, with trained_at, triggered_by (manual or auto), precision_at_k (k = precision_k, measured on a held-out 20% of interactions), and the users/items/interactions it learned from; `is_active` marks the one serving production, the others are history or candidates rejected for scoring lower. `performance`: per engine that actually served this catalog in the last `days` (hybrid, content, collaborative, session, popular - the strategy after any fallback), recommendations served and the impressions, clicks, add-to-carts and purchases attributed to them, with ctr. Only collaborative and hybrid use the trained model; content uses item similarity, session the visitor's recent views, popular the catalog's popularity - none of those three is versioned. `product_type` is the catalog's name, as set on its placements and data sources.",
    {
      product_type: z.string().min(1).max(64).describe("The catalog, e.g. a placement's product_type."),
      days: z.number().int().min(1).max(90).default(7).describe("How many days of production traffic to count. Default 7."),
    },
    async ({ product_type, days }) => jsonResult(await client.getModelOverview(product_type, days)),
  );

  server.tool(
    "validate_integration",
    "Checks whether a placement's integration actually works, from LIKYLY's own data (recommend calls, impressions, clicks, product views, add-to-carts and purchases received in the last window_hours), not from reading the site's source. Returns a readable checklist (✓ ok, ⚠ received but worth a look, ✗ missing) with, for each check not ok, what the site's code is missing. An event only shows up after a real visit or click on the site. Read-only.",
    { slug, window_hours: windowHours },
    async ({ slug, window_hours }) => textResult(await renderValidation(client, slug, window_hours)),
  );
}

const CHECK_LABELS: Record<string, { ok: string; bad: string; nextStep: string }> = {
  recommendations_requested: {
    ok: "recommendations requested",
    bad: "recommendations not requested yet",
    nextStep: "Call POST /placements/{slug}/recommend (likyly.recommend(...) in the SDK) from the page - nothing else here can be true until this is.",
  },
  current_item_supplied: {
    ok: "current item supplied",
    bad: "current item not supplied",
    nextStep: "Pass context.itemId (the product/article being viewed) to likyly.recommend / useRecommendations - this placement requires it.",
  },
  anonymous_session_supplied: {
    ok: "anonymous session supplied",
    bad: "anonymous session not supplied",
    nextStep: "Pass context.sessionId (or anonymousId - see LikylySession) for anonymous visitors - this placement requires one.",
  },
  impressions_received: {
    ok: "impressions received",
    bad: "impressions not received",
    nextStep: "Fire recommendationImpression for each rendered item (automatic with <LikylyRecommendations>; call trackImpression yourself with useRecommendations).",
  },
  recommendation_clicks_received: {
    ok: "recommendation clicks received",
    bad: "recommendation clicks not received",
    nextStep: "Fire recommendationClick when a recommended item is clicked (automatic with <LikylyRecommendations>; call trackClick yourself with useRecommendations). Can legitimately be zero on low traffic.",
  },
  product_views_received: {
    ok: "product views received",
    bad: "product views not received",
    nextStep: "Call likyly.events.productView on your product/article page - this is a catalog-wide event, not specific to this placement.",
  },
  add_to_cart_received: {
    ok: "add_to_cart received",
    bad: "add_to_cart not received",
    nextStep: "Call likyly.events.addToCart where the visitor adds an item to their cart - optional but improves ranking quality over time.",
  },
  public_key_rotated: {
    ok: "public key still working",
    bad: "no recommendation call since a public key was regenerated or revoked",
    nextStep: "The site probably still sends the old key and gets 401 on every call: put a working public key in the site's configuration (LIKYLY console > Keys), then load a page with the block.",
  },
  purchases_received: {
    ok: "purchases received",
    bad: "purchases not received",
    nextStep: "Call likyly.events.purchase (with an eventId, so a retry never double-counts a sale) once checkout completes - the strongest training signal, and what attribution ultimately measures.",
  },
};

const SYMBOL: Record<string, string> = { ok: "✓", warning: "⚠", missing: "✗" };

async function renderValidation(client: LikylyClient, slug: string, windowHours: number): Promise<string> {
  const health = (await client.getPlacementHealth(slug, windowHours)) as {
    overall: string;
    checks: { name: string; status: "ok" | "warning" | "missing"; count: number; message?: string }[];
  };

  const lines = [`Placement: ${slug}`, ""];
  const nextSteps: string[] = [];
  for (const check of health.checks) {
    // A check this version doesn't know yet: show LIKYLY's own message rather than a guess.
    const labels = CHECK_LABELS[check.name] ?? { ok: check.name, bad: `${check.name}: ${check.message ?? check.status}`, nextStep: "" };
    const symbol = SYMBOL[check.status] ?? "?";
    lines.push(`${symbol} ${check.status === "ok" ? labels.ok : labels.bad}`);
    if (check.status !== "ok" && labels.nextStep) nextSteps.push(`- ${labels.bad}: ${labels.nextStep}`);
  }

  if (nextSteps.length > 0) lines.push("", "Next steps:", ...nextSteps);
  if (health.checks.some((check) => check.status === "missing")) {
    lines.push("", "Not working yet: fix the ✗ items above.");
  } else if (health.checks.some((check) => check.status === "warning")) {
    lines.push("", "Working, with points worth a look (⚠).");
  } else {
    lines.push("", "Everything this validator checks is flowing - the integration looks correct.");
  }
  return lines.join("\n");
}
