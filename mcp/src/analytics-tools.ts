import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { LikylyClient } from "./client.js";

// What the recommendations actually did on the merchant's site: blocks served, products seen and
// clicked, purchases and revenue attributed to them - overall, per placement, per product - and
// the plan with its usage. The same figures as the LIKYLY console's Performance page and the
// /likyly-impact command. Read-only.
export function createLikylyAnalyticsTools(server: McpServer, client: LikylyClient): void {
  function jsonResult(data: unknown) {
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }

  const window = {
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("First day (YYYY-MM-DD). Default: 30 days ago, clamped to the plan (Free: 30 days, Pro: 90)."),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Last day (YYYY-MM-DD). Default: today."),
  };

  server.tool(
    "get_recommendation_performance",
    "How the account's recommendations performed over a window: blocks served, products seen (impressions), products clicked, CTR, and per placement the same figures with the purchases and revenue attributed to it (a purchase counts when it carries the recommendation_id it came from). Also the day-by-day trend and the attributed revenue, on every plan (a plan without them reports that part as not included). Revenue is the sum of price x quantity of those purchases, in `currency`: the one the site's purchase events send, or null when they send none or several (LIKYLY converts nothing). The answer says which window and plan were actually used. Read-only.",
    window,
    async ({ start, end }) => {
      const query = { start, end };
      const [summary, placements] = await Promise.all([client.analytics("summary", query), client.analytics("placements", query)]);
      let detail: unknown;
      try {
        detail = await client.analytics("detail", query);
      } catch (error) {
        detail = { not_included: String(error instanceof Error ? error.message : error) };
      }
      return jsonResult({ summary, by_placement: placements, detail });
    },
  );

  server.tool(
    "get_top_recommended_items",
    "The products recommendations worked best on over a window: for each one, how many recommendation responses included it, then its impressions, clicks, CTR, purchases and revenue from those recommendations, ordered by clicks then purchases, with its title from the catalog. Revenue is in `currency`: the one the site's purchase events send, or null when they send none or several (LIKYLY converts nothing). Pro plans only: on Free the API answers that this data is not included in the plan. Read-only.",
    { ...window, limit: z.number().int().min(1).max(50).default(10) },
    async ({ start, end, limit }) => jsonResult(await client.analytics("items", { start, end, limit })),
  );

  server.tool(
    "get_plan_and_usage",
    "The account's plan, what it allows (products, catalogs, data sources, syncs and trainings per day, analytics window) and the current usage next to each limit, with the Free and Pro plans side by side. Read-only.",
    {},
    async () => jsonResult(await client.analytics("plan")),
  );
}
