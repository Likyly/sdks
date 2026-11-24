// End-to-end test of the hosted service (dist/http.js): a fake Supabase (JWKS + authorization
// server metadata) and a fake LIKYLY API on local ports, real ES256 tokens. Run: npm test.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const MCP_PORT = 3291;
let supabase, api, mcp, issuer, privateKey, otherKey;
const apiCalls = [];

function listen(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function token(claims = {}, key = privateKey, opts = {}) {
  return new SignJWT({ role: "authenticated", client_id: "client-123", aal: "aal1", ...claims })
    .setProtectedHeader({ alg: "ES256", kid: "k1" })
    .setIssuer(opts.issuer ?? issuer)
    .setSubject("user-1")
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "1h")
    .sign(key);
}

function rpc(method, params = {}, headers = {}, path = "/mcp") {
  return fetch(`http://127.0.0.1:${MCP_PORT}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

before(async () => {
  const pair = await generateKeyPair("ES256");
  privateKey = pair.privateKey;
  otherKey = (await generateKeyPair("ES256")).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "ES256", use: "sig" };
  supabase = await listen((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/auth/v1/.well-known/jwks.json") return res.end(JSON.stringify({ keys: [jwk] }));
    if (req.url === "/.well-known/oauth-authorization-server/auth/v1")
      return res.end(JSON.stringify({ issuer, registration_endpoint: `${issuer}/oauth/clients/register` }));
    res.statusCode = 404;
    res.end("{}");
  });
  issuer = `http://127.0.0.1:${supabase.address().port}/auth/v1`;
  api = await listen((req, res) => {
    apiCalls.push({ url: req.url, key: req.headers["x-api-key"] });
    res.setHeader("Content-Type", "application/json");
    if (req.url.startsWith("/placements/rotated/health"))
      return res.end(JSON.stringify({
        overall: "missing",
        checks: [
          { name: "recommendations_requested", status: "ok", count: 12 },
          { name: "public_key_rotated", status: "missing", count: 0, message: "a public key was revoked" },
          { name: "brand_new_check", status: "missing", count: 0, message: "explained by the API" },
        ],
      }));
    res.end("[]");
  });
  mcp = spawn(process.execPath, ["dist/http.js"], {
    env: {
      ...process.env,
      PORT: String(MCP_PORT),
      LIKYLY_BASE_URL: `http://127.0.0.1:${api.address().port}`,
      LIKYLY_SUPABASE_URL: `http://127.0.0.1:${supabase.address().port}`,
      LIKYLY_MCP_PUBLIC_URL: "https://mcp.example.test",
      OPENAI_APPS_CHALLENGE: "challenge-token",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  await new Promise((resolve, reject) => {
    mcp.stderr.on("data", (chunk) => String(chunk).includes("listening") && resolve());
    mcp.on("exit", (code) => reject(new Error(`server exited ${code}`)));
  });
});

after(() => {
  mcp?.kill();
  supabase?.close();
  api?.close();
});

test("protected resource metadata points at Supabase", async () => {
  const res = await fetch(`http://127.0.0.1:${MCP_PORT}/.well-known/oauth-protected-resource/mcp`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.resource, "https://mcp.example.test/mcp");
  assert.deepEqual(body.authorization_servers, [issuer]);
  const root = await (await fetch(`http://127.0.0.1:${MCP_PORT}/.well-known/oauth-protected-resource`)).json();
  assert.equal(root.resource, "https://mcp.example.test");
});

test("authorization server metadata is relayed", async () => {
  const body = await (await fetch(`http://127.0.0.1:${MCP_PORT}/.well-known/oauth-authorization-server`)).json();
  assert.equal(body.issuer, issuer);
});

test("no token: 401 with the resource metadata", async () => {
  const res = await rpc("tools/list");
  assert.equal(res.status, 401);
  assert.match(res.headers.get("www-authenticate"), /resource_metadata="https:\/\/mcp\.example\.test\/\.well-known\/oauth-protected-resource\/mcp"/);
  // The root is the documented address: its own metadata, without /mcp.
  const root = await rpc("tools/list", {}, {}, "/");
  assert.equal(root.status, 401);
  assert.match(root.headers.get("www-authenticate"), /resource_metadata="https:\/\/mcp\.example\.test\/\.well-known\/oauth-protected-resource"$/);
});

test("forged, expired, foreign or client-less tokens are refused", async () => {
  for (const bad of [
    await token({}, otherKey),
    await token({}, privateKey, { exp: Math.floor(Date.now() / 1000) - 600 }),
    await token({}, privateKey, { issuer: "https://elsewhere.test/auth/v1" }),
    await token({ client_id: undefined }),
  ]) {
    const res = await rpc("tools/list", {}, { Authorization: `Bearer ${bad}` });
    assert.equal(res.status, 401);
    assert.match(res.headers.get("www-authenticate"), /error="invalid_token"/);
  }
});

test("OAuth token: chat tools with titles and annotations, token forwarded to the API", async () => {
  const jwt = await token();
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } }, { Authorization: `Bearer ${jwt}` });
  assert.equal(init.status, 200);
  const { result } = await init.json();
  assert.equal(result.serverInfo.title, "LIKYLY");
  assert.match(result.instructions, /in a conversation/);

  const list = await (await rpc("tools/list", {}, { Authorization: `Bearer ${jwt}` })).json();
  const names = list.result.tools.map((t) => t.name);
  assert.ok(names.includes("create_placement") && names.includes("search_catalog_items") && names.includes("get_recommendation_performance") && names.includes("get_top_recommended_items"));
  assert.ok(!names.includes("track_event") && !names.includes("get_recommendations"));
  for (const tool of list.result.tools) {
    assert.ok(tool.title, `${tool.name} has a title`);
    for (const [param, schema] of Object.entries(tool.inputSchema.properties ?? {}))
      assert.ok(!schema.$ref, `${tool.name}.${param} has its own type, not a $ref`);
    assert.equal(typeof tool.annotations?.readOnlyHint, "boolean", `${tool.name} has readOnlyHint`);
    assert.equal(typeof tool.annotations?.destructiveHint, "boolean", `${tool.name} has destructiveHint`);
  }
  for (const name of ["delete_data_source", "update_data_source", "configure_field_mapping", "sync_data_source", "update_placement"])
    assert.equal(list.result.tools.find((t) => t.name === name).annotations.destructiveHint, true, `${name} is destructive`);
  assert.equal(list.result.tools.find((t) => t.name === "configure_field_mapping").annotations.openWorldHint, true);
  assert.ok(!names.includes("push_items") && !names.includes("rotate_push_secret"), "no push secret in a chat");
  assert.deepEqual(list.result.tools.find((t) => t.name === "create_data_source").inputSchema.properties.type.enum, ["csv_url", "json_url", "rest_api"]);
  for (const name of ["create_data_source", "update_data_source"])
    assert.ok(!("credentials" in list.result.tools.find((t) => t.name === name).inputSchema.properties), `${name} takes no credentials in a chat`);

  const call = await (await rpc("tools/call", { name: "list_placements", arguments: {} }, { Authorization: `Bearer ${jwt}` }, "/")).json();
  assert.ok(!call.result.isError, JSON.stringify(call));
  assert.equal(apiCalls.at(-1).key, jwt);

  const search = await (await rpc("tools/call", { name: "search_catalog_items", arguments: { product_type: "books", search: "solitude" } }, { Authorization: `Bearer ${jwt}` })).json();
  assert.ok(!search.result.isError, JSON.stringify(search));
  assert.match(apiCalls.at(-1).url, /^\/items\?.*data_product_type=books.*search=solitude/);
});

test("LIKYLY key: every tool, forwarded as is", async () => {
  const list = await (await rpc("tools/list", {}, { Authorization: "Bearer lk_test_key" })).json();
  const names = list.result.tools.map((t) => t.name);
  assert.ok(names.includes("track_event") && names.includes("create_placement"));
  assert.ok("credentials" in list.result.tools.find((t) => t.name === "create_data_source").inputSchema.properties);
  await rpc("tools/call", { name: "list_placements", arguments: {} }, { Authorization: "Bearer lk_test_key" });
  assert.equal(apiCalls.at(-1).key, "lk_test_key");
});

test("validate_integration: a revoked key or an unknown check is never reported as working", async () => {
  const call = await (await rpc("tools/call", { name: "validate_integration", arguments: { slug: "rotated" } }, { Authorization: "Bearer lk_test_key" })).json();
  const text = call.result.content[0].text;
  assert.match(text, /✗ no recommendation call since a public key was regenerated or revoked/);
  assert.match(text, /✗ brand_new_check: explained by the API/);
  assert.match(text, /Not working yet/);
  assert.doesNotMatch(text, /looks correct/);
});

test("icon and OpenAI domain challenge", async () => {
  const icon = await fetch(`http://127.0.0.1:${MCP_PORT}/icon.png`);
  assert.equal(icon.headers.get("content-type"), "image/png");
  const favicon = await fetch(`http://127.0.0.1:${MCP_PORT}/favicon.ico`);
  assert.equal(favicon.status, 200);
  assert.equal(favicon.headers.get("content-type"), "image/x-icon");
  assert.equal(await (await fetch(`http://127.0.0.1:${MCP_PORT}/.well-known/openai-apps-challenge`)).text(), "challenge-token");
});
