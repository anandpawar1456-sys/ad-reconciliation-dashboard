import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { TOOLS, SERVER_INSTRUCTIONS } from "@/lib/mcp/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// A minimal, stateless MCP server (Streamable HTTP, JSON responses) so Claude
// can read the dashboard's data as a custom connector. The connector URL is
// /api/mcp/<MCP_SECRET>; anyone without the secret just gets a 404. Every
// tool is read-only and returns no customer identities (see lib/mcp/tools.ts).
const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_TEXT = 90_000;

type RpcMessage = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

function secretMatches(given: string): boolean {
  const expected = process.env.MCP_SECRET;
  if (!expected || expected.length < 16) return false; // disabled until a strong secret is set
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function ok(id: RpcMessage["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function fail(id: RpcMessage["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function handle(msg: RpcMessage): Promise<unknown | null> {
  const { id, method, params } = msg;
  const isNotification = id === undefined;

  switch (method) {
    case "initialize": {
      const asked = typeof params?.protocolVersion === "string" ? params.protocolVersion : "";
      return ok(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "ad-reconciliation-dashboard", version: "1.0.0" },
        instructions: SERVER_INSTRUCTIONS,
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        })),
      });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return fail(id, -32602, `Unknown tool: ${String(params?.name)}`);
      try {
        const result = await tool.handler((params?.arguments as Record<string, unknown>) ?? {});
        let text = JSON.stringify(result);
        if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT) + '..."TRUNCATED: narrow the date range or lower limit"';
        return ok(id, { content: [{ type: "text", text }], isError: false });
      } catch (err) {
        return ok(id, { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true });
      }
    }
    default:
      if (isNotification || method?.startsWith("notifications/")) return null;
      return fail(id, -32601, `Method not found: ${String(method)}`);
  }
}

export async function POST(req: NextRequest, { params }: { params: { secret: string } }) {
  if (!secretMatches(params.secret)) return new NextResponse(null, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(fail(null, -32700, "Parse error"), { status: 400 });
  }

  if (Array.isArray(body)) {
    const results = (await Promise.all(body.map((m) => handle(m as RpcMessage)))).filter((r) => r !== null);
    return results.length > 0 ? NextResponse.json(results) : new NextResponse(null, { status: 202 });
  }

  const result = await handle(body as RpcMessage);
  return result === null ? new NextResponse(null, { status: 202 }) : NextResponse.json(result);
}

// No server-initiated stream and no session to close.
export async function GET(_req: NextRequest, { params }: { params: { secret: string } }) {
  if (!secretMatches(params.secret)) return new NextResponse(null, { status: 404 });
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE(_req: NextRequest, { params }: { params: { secret: string } }) {
  if (!secretMatches(params.secret)) return new NextResponse(null, { status: 404 });
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
