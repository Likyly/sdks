#!/usr/bin/env node
// Hosted MCP service: the same tools as the local stdio server, exposed over MCP's
// Streamable HTTP transport so an LLM client connects by URL (https://mcp.likyly.com)
// instead of running a local process.
//
// Two ways in, both stateless (the service stores nothing and holds no secret):
//  - OAuth (Claude, ChatGPT and any client following the MCP authorization spec): Supabase
//    Auth, LIKYLY's account system, is the OAuth 2.1 server (dynamic client registration,
//    PKCE); the user signs in and picks a workspace on www.likyly.com/oauth/consent. This
//    service is the resource server: it checks the access token (signature by the project's
//    public keys, issuer, expiry, an OAuth client) and forwards it to the LIKYLY API, which
//    checks it again and acts on the chosen workspace. Tools for a chat ("chat" surface).
//  - A LIKYLY key (Authorization: Bearer <key>, or X-Likyly-Api-Key), forwarded as is, for a
//    server-side caller: the API decides what the key can do. All the tools.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { LikylyClient } from "./client.js";
import { createLikylyServer } from "./tools.js";

const port = Number(process.env.PORT ?? 3200);
const baseUrl = process.env.LIKYLY_BASE_URL ?? "https://api.likyly.com";
const publicUrl = (process.env.LIKYLY_MCP_PUBLIC_URL ?? "https://mcp.likyly.com").replace(/\/+$/, "");
// LIKYLY's Supabase project. "off": no OAuth (keys only).
const supabaseUrl = (process.env.LIKYLY_SUPABASE_URL ?? "https://qttfgagusbxrpcliufkf.supabase.co").replace(/\/+$/, "");
const oauthEnabled = supabaseUrl !== "off";
const issuer = `${supabaseUrl}/auth/v1`;
const jwks = oauthEnabled ? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)) : undefined;
// Domain verification token given by OpenAI's app submission (served at
// /.well-known/openai-apps-challenge).
const openaiChallenge = process.env.OPENAI_APPS_CHALLENGE?.trim();
const MAX_BODY_BYTES = 1_000_000;
const MCP_PATHS = new Set(["/", "/mcp"]);

const asset = (name: string): Buffer | undefined => {
  try {
    return readFileSync(new URL(`../assets/${name}`, import.meta.url));
  } catch {
    return undefined;
  }
};
const icon = asset("icon.png");
// Clients that show a connector's logo (Claude) look for the domain's favicon.
const favicon = asset("favicon.ico");

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, X-Likyly-Api-Key, X-Likyly-Product-Type, Mcp-Session-Id, Mcp-Protocol-Version",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, WWW-Authenticate");
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

function jsonRpcError(res: ServerResponse, status: number, code: number, message: string, headers: Record<string, string> = {}) {
  sendJson(res, status, { jsonrpc: "2.0", error: { code, message }, id: null }, headers);
}

/** RFC 9728: where a client finds how to get a token for the MCP endpoint at `path`. */
const resourceFor = (path: string) => (path === "/" ? publicUrl : `${publicUrl}${path}`);
const metadataUrlFor = (path: string) => `${publicUrl}/.well-known/oauth-protected-resource${path === "/" ? "" : path}`;

function protectedResource(path: string) {
  return {
    resource: resourceFor(path),
    authorization_servers: [issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: ["email"],
    resource_name: "LIKYLY",
    resource_documentation: "https://www.likyly.com/docs/mcp",
  };
}

function unauthorized(res: ServerResponse, path: string, message: string, invalidToken = false) {
  const params = [`resource_metadata="${metadataUrlFor(path)}"`];
  if (invalidToken) params.unshift('error="invalid_token"');
  jsonRpcError(res, 401, -32001, message, { "WWW-Authenticate": `Bearer ${params.join(", ")}` });
}

// The authorization server's metadata, also served here for clients that look for it on the
// MCP server's own host (older MCP spec). Fetched from Supabase, kept an hour.
let asMetadata: { at: number; body: unknown } | undefined;
async function authorizationServerMetadata(): Promise<unknown> {
  if (asMetadata && Date.now() - asMetadata.at < 3_600_000) return asMetadata.body;
  const response = await fetch(`${supabaseUrl}/.well-known/oauth-authorization-server/auth/v1`);
  if (!response.ok) throw new Error(`authorization server metadata: HTTP ${response.status}`);
  const body = await response.json();
  asMetadata = { at: Date.now(), body };
  return body;
}

function bearer(req: IncomingMessage): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || undefined;
  const header = req.headers["x-likyly-api-key"];
  return (Array.isArray(header) ? header[0] : header)?.trim() || undefined;
}

const looksLikeJwt = (value: string) => value.startsWith("eyJ") && value.split(".").length === 3;

/** A Supabase access token issued to an OAuth client, valid now. The API checks it again. */
async function verifyOAuthToken(token: string): Promise<boolean> {
  if (!jwks) return false;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer, algorithms: ["ES256", "RS256"], clockTolerance: 30 });
    return payload.role === "authenticated" && typeof payload.client_id === "string" && payload.client_id.length > 0;
  } catch {
    return false;
  }
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (req, res) => {
  setCors(res);
  const path = (req.url ?? "/").split("?")[0].replace(/(.)\/+$/, "$1");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  if (path === "/health") {
    sendJson(res, 200, { status: "ok", service: "likyly-mcp", oauth: oauthEnabled });
    return;
  }
  if (path === "/icon.png" && icon) {
    res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" });
    res.end(icon);
    return;
  }
  if (path === "/favicon.ico" && favicon) {
    res.writeHead(200, { "Content-Type": "image/x-icon", "Cache-Control": "public, max-age=86400" });
    res.end(favicon);
    return;
  }
  if (path === "/.well-known/openai-apps-challenge" && openaiChallenge) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(openaiChallenge);
    return;
  }
  if (oauthEnabled && path.startsWith("/.well-known/oauth-protected-resource")) {
    const resourcePath = path.slice("/.well-known/oauth-protected-resource".length) || "/";
    if (!MCP_PATHS.has(resourcePath)) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    sendJson(res, 200, protectedResource(resourcePath), { "Cache-Control": "public, max-age=3600" });
    return;
  }
  if (oauthEnabled && (path === "/.well-known/oauth-authorization-server" || path.startsWith("/.well-known/oauth-authorization-server/"))) {
    try {
      sendJson(res, 200, await authorizationServerMetadata(), { "Cache-Control": "public, max-age=3600" });
    } catch (err) {
      console.error(String(err));
      sendJson(res, 502, { error: "Authorization server unavailable" });
    }
    return;
  }
  if (!MCP_PATHS.has(path)) {
    sendJson(res, 404, { error: "Not found. The MCP endpoint is the root, https://mcp.likyly.com." });
    return;
  }
  if (req.method === "GET" && path === "/" && req.headers.accept?.includes("text/html")) {
    res.writeHead(302, { Location: "https://www.likyly.com/docs/mcp" }).end();
    return;
  }
  // Stateless mode: no server-initiated streams or sessions to resume.
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    jsonRpcError(res, 405, -32000, "Method not allowed - use POST.");
    return;
  }

  const token = bearer(req);
  if (!token) {
    unauthorized(res, path, oauthEnabled
      ? "Sign in to LIKYLY: connect this server as an OAuth connector, or send a LIKYLY key as 'Authorization: Bearer <key>'."
      : "Missing API key. Send your LIKYLY key as 'Authorization: Bearer <key>'.");
    return;
  }
  const oauth = looksLikeJwt(token);
  if (oauth && !(await verifyOAuthToken(token))) {
    unauthorized(res, path, "Invalid or expired access token - sign in again.", true);
    return;
  }

  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    jsonRpcError(res, 400, -32700, "Invalid or oversized JSON body.");
    return;
  }

  const productHeader = req.headers["x-likyly-product-type"];
  const defaultProductType = (Array.isArray(productHeader) ? productHeader[0] : productHeader)?.trim() || undefined;

  const mcp = createLikylyServer(new LikylyClient({ baseUrl, apiKey: token }), {
    defaultProductType,
    surface: oauth ? "chat" : "full",
  });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    void transport.close();
    void mcp.close();
  });
  try {
    await mcp.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    console.error("MCP request failed:", err);
    if (!res.headersSent) jsonRpcError(res, 500, -32603, "Internal server error.");
  }
});

server.listen(port, () => {
  console.error(`likyly-mcp HTTP service listening on :${port} (POST / or /mcp) -> ${baseUrl}; OAuth ${oauthEnabled ? issuer : "off"}`);
});
