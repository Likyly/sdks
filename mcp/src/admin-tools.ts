import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { LikylyClient } from "./client.js";

// Admin tools: configuring and running data-source integrations (Shopify, a REST API, a
// CSV, a webhook, ...) - real, tenant-scoped configuration changes, not documentation. They
// need the secret key or a developer key carrying the matching scope (sources:read /
// sources:write - see /clients/me/developer-keys in the recsys API), never the restricted
// public key: whatever LIKYLY_API_KEY this server was started with is forwarded as-is, and
// the API itself is what enforces the scope - a caller using the wrong key gets a clear
// 401/403 back through the tool result, exactly like every other tool here.
//
// A typical flow: list_source_types -> create_data_source -> test_data_source ->
// preview_data_source -> configure_field_mapping -> sync_data_source -> get_sync_status /
// get_catalog_stats. That order lives in the server instructions (instructions.ts): a tool's
// description says what the tool itself does, never which tool to call next (directory rules).
export function createLikylyAdminTools(server: McpServer, client: LikylyClient): void {
  function textResult(data: unknown) {
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }

  const dataSourceId = z.number().int().describe("The data source's id.");

  server.tool(
    "list_source_types",
    "Lists every catalog source type LIKYLY can connect to (csv_upload, csv_url, json_url, rest_api, shopify, magento, woocommerce, webhook). Each entry says whether it needs credentials, whether it supports incremental sync, and which `config`/`credentials` it expects. Read-only.",
    {},
    async () => textResult(await client.listSourceTypes()),
  );

  server.tool(
    "create_data_source",
    "Registers a new catalog source for this account and saves its configuration; it fetches and imports nothing yet. `type` is a source type id (e.g. 'shopify', 'rest_api', 'csv_url'). `product_type` is the catalog namespace it writes into: an existing one, or a new name to start a new catalog. `config` holds non-secret settings (e.g. {base_url, items_path} for rest_api, {shop_domain} for shopify). `credentials` holds secrets, encrypted at rest and never returned: for shopify {access_token: 'shpat_...'} of a legacy custom app, or {client_id, client_secret} of a Dev Dashboard app installed on the store with read_products (the only kind new stores can create; LIKYLY renews its 24 h tokens); for magento {store_url} and an Integration's {consumer_key, consumer_secret, access_token, access_token_secret}. Shopify and Magento credentials are not meant to be collected in a conversation: `npx @likyly/wizard shopify` / `npx @likyly/wizard magento` sends them to LIKYLY directly. Without `sync_mode` the type's default applies. A push-mode type (woocommerce, webhook) returns a one-time `push_secret` for the upstream system's webhook; it cannot be retrieved again. A source beyond the plan's limit (the Free plan allows one) is refused with a 403 'plan limit reached'.",
    {
      name: z.string().min(1).max(200),
      type: z.string().describe("The source type's id (csv_upload, csv_url, json_url, rest_api, shopify, magento, woocommerce, webhook)."),
      product_type: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/).describe("The catalog namespace this source writes into."),
      config: z.record(z.unknown()).optional(),
      credentials: z.record(z.unknown()).optional().describe("Secrets - access tokens, API keys. Encrypted at rest."),
      field_mapping: z.record(z.unknown()).optional().describe("Optional; the mapping can also be set later."),
      sync_mode: z.enum(["full", "incremental"]).optional(),
    },
    async (input) => textResult(await client.createDataSource(input)),
  );

  server.tool(
    "update_data_source",
    "Changes an existing data source: its name, `config` (merged shallowly: only the keys sent change, e.g. a new base_url), `credentials` (fully replaced), `sync_mode`, or `product_type` (the catalog it writes into from the next sync on; the next full sync sends every item there). Pointing `product_type` at an existing catalog, such as the one a plan-limit error names, keeps the account within its plan. Suits a source that points at an old URL or catalog, and is the way to change what is connected on the Free plan, which allows a single source. The new settings are saved, not tested.",
    {
      data_source_id: dataSourceId,
      name: z.string().min(1).max(200).optional(),
      product_type: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/).optional(),
      config: z.record(z.unknown()).optional(),
      credentials: z.record(z.unknown()).optional(),
      sync_mode: z.enum(["full", "incremental"]).optional(),
    },
    async ({ data_source_id, ...input }) => textResult(await client.updateDataSource(data_source_id, input)),
  );

  server.tool(
    "delete_data_source",
    "Permanently deletes a data source's configuration and sync history; catalog items it already wrote stay in place. Frees the slot on plans limited to one source. Irreversible.",
    { data_source_id: dataSourceId },
    async ({ data_source_id }) => textResult(await client.deleteDataSource(data_source_id)),
  );

  server.tool(
    "push_items",
    "Sends catalog items to a push-mode source (type 'webhook'), up to 1000 per call, and removes the items whose ids are in `deleted_ids`. Loads a catalog LIKYLY cannot fetch itself: a site on localhost or behind a VPN, or products that exist only in a codebase (an API route, a JSON file, a database seed), mapped to item objects. Needs the source's `push_secret` (returned once when the source was created, or when it was last rotated). Writes to the catalog.",
    {
      data_source_id: dataSourceId,
      push_secret: z.string().min(1),
      items: z.array(z.record(z.unknown())).max(1000),
      deleted_ids: z.array(z.string()).max(1000).optional(),
    },
    async ({ data_source_id, push_secret, items, deleted_ids }) => textResult(await client.pushItems(data_source_id, push_secret, items, deleted_ids)),
  );

  server.tool(
    "rotate_push_secret",
    "Issues and returns a new push secret for a push-mode source. The old secret stops working, so a system still pushing with it is rejected until it gets the new one. For a lost or leaked secret.",
    { data_source_id: dataSourceId },
    async ({ data_source_id }) => textResult(await client.rotatePushSecret(data_source_id)),
  );

  server.tool(
    "test_data_source",
    "Checks that a source's credentials and config actually reach it; never writes catalog data. Always returns ok:true/false with a message (a bad connection is a result, not an error) stating why a connection failed.",
    { data_source_id: dataSourceId },
    async ({ data_source_id }) => textResult(await client.testDataSource(data_source_id)),
  );

  server.tool(
    "preview_data_source",
    "Fetches a small sample from the source (`limit`, default 10, up to 50) without writing to the catalog, and returns the detected_fields plus a best-effort suggested_mapping to build a field mapping from.",
    { data_source_id: dataSourceId, limit: z.number().int().min(1).max(50).default(10) },
    async ({ data_source_id, limit }) => textResult(await client.previewDataSource(data_source_id, limit)),
  );

  server.tool(
    "configure_field_mapping",
    "Sets how this source's raw records map to a LIKYLY item. `mapping.external_id` and `mapping.title` are required; `description`, `category`, `price`, `image`, `url`, `stock`, `updated_at` are optional; `attributes` is itself {name: path} for anything else to keep as free-form properties. Each value is a field name or a dotted/bracket path into a nested record (e.g. 'variants[0].price', 'images[0].src'). dry_run:true applies the mapping to a fresh sample and returns the result WITHOUT saving it; dry_run:false (the default) saves it, and the source's later syncs use it.",
    {
      data_source_id: dataSourceId,
      mapping: z.record(z.unknown()).describe("e.g. {external_id: 'id', title: 'name', price: 'variants[0].price', image: 'images[0].src', category: 'product_type', stock: 'variants[0].inventory_quantity'}"),
      dry_run: z.boolean().default(false).describe("true: preview the effect without saving. false: save it."),
    },
    async ({ data_source_id, mapping, dry_run }) =>
      textResult(dry_run ? await client.dryRunFieldMapping(data_source_id, mapping) : await client.saveFieldMapping(data_source_id, mapping)),
  );

  server.tool(
    "sync_data_source",
    "Starts a sync of a source now, as a background job: it returns almost immediately with the run's status, not its outcome. `mode` defaults to incremental (falls back to full automatically when the source doesn't support incremental); mode:'full' suits a first sync or a re-baseline. Writes items into the catalog the live recommendations use. Does not apply to push-mode sources (woocommerce, webhook), which update whenever the upstream system pushes. A 429 means the plan's sync limit is reached.",
    { data_source_id: dataSourceId, mode: z.enum(["full", "incremental"]).default("incremental") },
    async ({ data_source_id, mode }) => textResult(await client.syncDataSource(data_source_id, mode)),
  );

  server.tool(
    "get_sync_status",
    "Returns a source's most recent sync runs (`limit`, default 5, up to 100): status (running/success/partial/failed), items fetched/upserted/deleted/failed, and any error. A run stays 'running' until its background job ends. Also shows a push-mode source's activity. Read-only.",
    { data_source_id: dataSourceId, limit: z.number().int().min(1).max(100).default(5) },
    async ({ data_source_id, limit }) => textResult(await client.listSyncs(data_source_id, limit)),
  );

  server.tool(
    "list_data_sources",
    "Lists every data source configured for this account, with its id, name, type, status and last sync time. Read-only.",
    {},
    async () => textResult(await client.listDataSources()),
  );

  server.tool(
    "get_catalog_stats",
    "Item count and last-write time of a source's target catalog, plus its latest sync run: items synced and rejected, and when the next sync is due. Read-only.",
    { data_source_id: dataSourceId },
    async ({ data_source_id }) => textResult(await client.getCatalogStats(data_source_id)),
  );

  server.tool(
    "search_catalog_items",
    "Finds products in one of the account's catalogs by a word of their title or description (case-insensitive), or lists the first ones without `search`. Returns each product's item_id (the merchant's own id, the one placements take as current_item_id), title, price and category. Read-only.",
    {
      product_type: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/).describe("The catalog's name (e.g. 'books')."),
      search: z.string().max(200).optional().describe("A word or phrase from the product's title or description."),
      limit: z.number().int().min(1).max(50).default(10),
    },
    async ({ product_type, search, limit }) => {
      const items = (await client.searchCatalogItems(product_type, search, limit)) as Array<Record<string, unknown>>;
      return textResult(
        (Array.isArray(items) ? items : []).map((item) => {
          const properties = (item.properties ?? {}) as Record<string, unknown>;
          return { item_id: item.item_id, title: item.title, price: item.price ?? null, category: properties.category ?? item.genre_1 ?? null };
        }),
      );
    },
  );
}
