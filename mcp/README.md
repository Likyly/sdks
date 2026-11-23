# @likyly/mcp-server

Lets your AI coding assistant (Claude Code, Cursor, VS Code, Codex, Antigravity, Mistral Vibe, Kiro,
Junie, Claude Desktop…) set up
[LIKYLY](https://likyly.com) recommendations on your site for you.

[LIKYLY](https://likyly.com) shows each visitor the products they are most likely to want ("You may
also like", "Recommended for you"), learned from what visitors do on your site. With this server, you
ask your assistant in plain words and it does the work:

- **connect your catalog**: Shopify, a REST API, a CSV, a webhook, or products pushed from your code;
- **create a placement**: where recommendations appear and how ("4 related products on the product
  page, exclude out-of-stock");
- **integrate it into your code** from a recipe written for your stack;
- **check it works**, from LIKYLY's own data: recommendations served, impressions and clicks received.

The quickest way to install it is the wizard, which also installs the SDK and writes your key:

```sh
npx @likyly/wizard
```

## Which key

The API decides what a key can do, not the server:

- **Public key** (`pk_…`): recommendations and events only. Safe anywhere.
- **Developer key** (`lk_…`, recommended for assistants) or secret key (`sk_…`): also the admin tools
  (catalog sources, placements, cache). Keep it on your machine or in server-side config, never in
  browser code.

Without a developer or secret key, the admin tools answer with a clear 401/403; nothing breaks.

## Install

```bash
npm install -g @likyly/mcp-server
```

## Configure

**Recommendations/events only** (e.g. Claude Desktop's `claude_desktop_config.json`, or a
browser-facing use case) - a public key:

```json
{
  "mcpServers": {
    "likyly": {
      "command": "likyly-mcp-server",
      "env": {
        "LIKYLY_API_KEY": "your-restricted-public-key",
        "LIKYLY_BASE_URL": "https://api.likyly.com",
        "LIKYLY_PRODUCT_TYPE": "your-catalog-namespace"
      }
    }
  }
}
```

**The easy way: `npx @likyly/wizard`** (or `npx @likyly/wizard mcp add`). It signs you in on
likyly.com, gets a developer key, stores it in `.likyly/credentials.env` (a folder that ignores
itself in git, readable by you only) and writes each assistant's project config (`.mcp.json`,
`.cursor/mcp.json`, `.vscode/mcp.json`, `.codex/config.toml`, `.agents/mcp_config.json`,
`.vibe/config.toml`, `.kiro/settings/mcp.json`, `.junie/mcp/mcp.json`) **without any key in
them**, plus the LIKYLY skill. The server takes the key from `LIKYLY_API_KEY` or
`LIKYLY_DEVELOPER_KEY` when exported, otherwise from the credentials file: `LIKYLY_ENV_FILE`, or
the nearest `.likyly/credentials.env` from the folder it starts in, upwards.

The server also sends its own instructions to every client when it connects (the setup process:
catalog, placement, integration, verification), so an assistant without the LIKYLY skill
follows the same steps.

**By hand, Claude Code / Codex, with data-source admin tools** - first create a developer key (once,
from a server-side shell - never from a browser):

```bash
curl -X POST https://api.likyly.com/clients/me/developer-keys \
  -H "Authorization: Bearer <your Supabase session JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Claude Code", "scopes": ["sources:read", "sources:write", "placements:read", "placements:write"]}'
# -> {"key": "...", ...} - copy `key`, it is shown once
```

Then point `.mcp.json` (or `claude_desktop_config.json`) at it:

```json
{
  "mcpServers": {
    "likyly": {
      "command": "likyly-mcp-server",
      "env": {
        "LIKYLY_API_KEY": "your-developer-key",
        "LIKYLY_BASE_URL": "https://api.likyly.com"
      }
    }
  }
}
```

`LIKYLY_PRODUCT_TYPE` is optional - set it if you only manage one catalog, so prompts don't need
to repeat it; every recommendation/event tool also accepts `product_type` per-call to override
it (the admin tools target a data source's own `product_type`, set at `create_data_source`).

## Tools

Recommendations/events - work with the public key:

| Tool | Maps to |
|---|---|
| `get_recommendations` | `POST /getRec` - LIKYLY picks the strategy; returns a `recommendation_id` |
| `get_popular_recommendations` | `GET /getRec/popular/{count}` |
| `get_cold_start_recommendations` | `GET /getRec/content/{item_id}/{count}` |
| `get_collaborative_recommendations` | `GET /getRec/collaborative/{user_id}/{count}` |
| `get_hybrid_recommendations` | `GET /getRec/hybrid/{user_id}/{item_id}/{count}` |
| `get_session_recommendations` | `GET /getRec/session` |
| `get_user_session_recommendations` | `GET /getRec/sessionForUser/{user_id}/{count}` |
| `track_event` | `POST /events/{event_type}` (impression, view, click, add_to_cart, remove_from_cart, purchase, ...) |

Admin - data source integrations - need the secret key or a developer key with `sources:read`/
`sources:write` (see [`docs/data-sources.md`](https://github.com/Likyly/likyly-recsys/blob/main/docs/data-sources.md) for the full
architecture, source types and config shapes):

| Tool | Maps to |
|---|---|
| `list_source_types` | `GET /data-sources/types` |
| `create_data_source` | `POST /data-sources` |
| `test_data_source` | `POST /data-sources/{id}/test` |
| `preview_data_source` | `POST /data-sources/{id}/preview` |
| `configure_field_mapping` | `PUT /data-sources/{id}/field-mapping` (or the `/dry-run` variant, with `dry_run: true`) |
| `sync_data_source` | `POST /data-sources/{id}/sync` |
| `get_sync_status` | `GET /data-sources/{id}/syncs` |
| `list_data_sources` | `GET /data-sources` |
| `get_catalog_stats` | `GET /data-sources/{id}/stats` |
| `update_data_source` | `PATCH /data-sources/{id}` - fix an outdated source rather than create another (Free: one source) |
| `delete_data_source` | `DELETE /data-sources/{id}` - items already imported stay |
| `push_items` | `POST /data-sources/{id}/push` (with the source's `X-Push-Secret`) - load a catalog LIKYLY cannot reach (localhost, VPN): the agent reads the products from the project and pushes them |
| `rotate_push_secret` | `POST /data-sources/{id}/push-secret/rotate` |

Admin - placements (the recommended way to wire up recommendations - see
[`docs/placements.md`](https://github.com/Likyly/likyly-recsys/blob/main/docs/placements.md)) - need the secret key or a developer key
with `placements:read`/`placements:write`:

| Tool | Maps to |
|---|---|
| `list_placements` | `GET /placements` |
| `get_placement` | `GET /placements/{slug}` |
| `create_placement` | `POST /placements` |
| `update_placement` | `PATCH /placements/{slug}` |
| `delete_or_disable_placement` | `POST /placements/{slug}/deactivate` (default) or `DELETE /placements/{slug}` |
| `preview_placement` | `POST /placements/{slug}/preview` |
| `get_placement_requirements` | `GET /placements/{slug}/requirements` |
| `purge_recommendation_cache` | `POST /placements/{slug}/cache/purge`, or `POST /placements/cache/purge` for all - empties the anonymous recommendation cache (see docs/placements.md, "Caching") |

Admin - integration recipe & validator (writing and verifying the client-side integration -
see [`docs/getting-started.md`](https://github.com/Likyly/likyly-recsys/blob/main/docs/getting-started.md)) - same `placements:read`/
`placements:write` requirement:

| Tool | Maps to |
|---|---|
| `get_integration_recipe` | Composed from `GET /placements/{slug}/requirements` + `.../tracking-requirements` - not a new endpoint |
| `get_tracking_requirements` | `GET /placements/{slug}/tracking-requirements` |
| `validate_integration` | `GET /placements/{slug}/health`, rendered as a ✓/⚠/✗ checklist with next steps |
| `get_placement_health` | `GET /placements/{slug}/health` (structured data, no rendering) |
| `get_recent_integration_events` | `GET /placements/{slug}/recent-events` |
| `get_model_overview` | `GET /models/overview` - trained versions (which one is live, precision@10) and production performance per engine; read-only, `placements:read` |

The runtime call, `POST /placements/{slug}/recommend`, is **not an MCP tool** - it's a plain
HTTP call the site's own code makes, safe with the public key, exactly like `POST /getRec`.

## In Claude and ChatGPT (hosted, OAuth)

The same server runs at **`https://mcp.likyly.com`** for assistants used in a conversation
(`https://mcp.likyly.com/mcp` answers too):

- **Claude** (claude.ai, desktop, mobile): Plugins → Add → Add custom connector → URL
  `https://mcp.likyly.com`, OAuth client "Register automatically"; then, in a conversation, + → Connectors → LIKYLY. Claude Code: `claude mcp add --transport http likyly https://mcp.likyly.com`.
- **ChatGPT**: Settings → Apps → Developer mode → Create → URL `https://mcp.likyly.com`,
  authentication OAuth.

The assistant sends you to www.likyly.com to sign in (or create your free account), pick the
workspace it may act on, and allow it. No key to copy. To disconnect it, remove the connector, or
revoke it from your LIKYLY account.

Signed in this way, the assistant gets the catalog, placement, integration-check and model tools,
not the recommendation/event tools (runtime traffic, for your site's public key):
`preview_placement` shows recommendations instead.

How it works: LIKYLY's accounts (Supabase Auth) are the OAuth 2.1 server, with dynamic client
registration and PKCE; this service is the resource server
(`/.well-known/oauth-protected-resource`, `WWW-Authenticate` on 401). It checks each access token
(signature by the project's public keys, issuer, expiry, OAuth client) and forwards it to the
LIKYLY API, which checks it again and acts on the chosen workspace. It stores nothing.

A server-side caller can still send a LIKYLY key instead, and gets every tool:

```
POST https://mcp.likyly.com
Authorization: Bearer <public-secret-or-developer-key>
X-Likyly-Product-Type: <catalog-namespace>     # optional default catalog, recommendation/event tools only
```

Only send a secret or developer key from a trusted server, never from browser code.

### Run it

```bash
npm test                  # build + end-to-end tests (fake Supabase and API)
PORT=3200 npm run start:http
```

Env: `PORT` (default 3200), `LIKYLY_BASE_URL` (default `https://api.likyly.com`),
`LIKYLY_MCP_PUBLIC_URL` (default `https://mcp.likyly.com`), `LIKYLY_SUPABASE_URL` (LIKYLY's
Supabase project by default; `off` = keys only), `OPENAI_APPS_CHALLENGE` (ChatGPT app domain
verification, served at `/.well-known/openai-apps-challenge`). Stateless: no sessions, a `GET`
returns 405 (a browser opening the root is sent to the docs).

Deployed on the droplet next to the API (`deploy/`, Docker + Caddy).

## Develop locally

```bash
npm install
npm run build
node dist/index.js   # reads LIKYLY_API_KEY / LIKYLY_BASE_URL / LIKYLY_PRODUCT_TYPE from env
```
