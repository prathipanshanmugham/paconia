import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { db } from '../db';
import { isStaff, type Role, type Session } from '../auth';
import { TOOLS, ToolError, callTool, toolsFor, type Ctx } from './tools';

/* ---------- keys ---------- */

export const hashKey = (k: string) => createHash('sha256').update(k).digest('hex');
export function newKey() { const k = 'pac_' + randomBytes(24).toString('hex'); return { key: k, prefix: k.slice(0, 12), hash: hashKey(k) }; }

/** Resolves a key to the team member it acts as. Revoked keys, inactive users and customer accounts are refused. */
export async function keyContext(raw: string | null | undefined): Promise<Ctx | null> {
  if (!raw || !/^pac_[0-9a-f]{48}$/.test(raw)) return null;
  const k = await db.apiKey.findUnique({ where: { hash: hashKey(raw) }, include: { user: true } });
  if (!k || k.revokedAt || !k.user.active || !isStaff(k.user.role as Role)) return null;
  await db.apiKey.update({ where: { id: k.id }, data: { lastUsedAt: new Date(), uses: { increment: 1 } } });
  const s: Session = { userId: k.user.id, role: k.user.role as Role, name: `${k.user.name} (AI: ${k.name})`, email: k.user.email };
  return { s, write: k.access === 'WRITE', keyName: k.name };
}
export const bearer = (req: Request) => req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || null;

/* ---------- MCP over HTTP (JSON-RPC 2.0, stateless Streamable HTTP) ---------- */

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const INSTRUCTIONS = `Paconia is a short-run print and packaging studio in Perundurai, Tamil Nadu (labels, stickers, boxes, pouches, cards, laser-cut pieces).
You act as one Paconia team member; their role decides what you can see and do, and every change is logged.
Start with business_overview. Use list_products for product slugs, sizes, material codes and finishes, then price_product before quoting.
Money is Indian rupees; prices are before GST unless a field says with_gst. Dates are YYYY-MM-DD, India time.
Quotes expire on their own after their validity; renew_quote re-prices them at today's rates. Ask the person before cancelling orders or recording payments.`;

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const ok = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result });
const err = (id: Rpc['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

function toolList(c: Ctx) {
  return toolsFor(c).map((t) => {
    const schema = zodToJsonSchema(t.input, { target: 'jsonSchema7', $refStrategy: 'none' }) as Record<string, unknown>;
    delete schema.$schema;
    if (schema.type !== 'object') { schema.type = 'object'; }
    return { name: t.name, title: t.title, description: t.description, inputSchema: schema, annotations: { readOnlyHint: !t.write, destructiveHint: t.name === 'update_order', openWorldHint: false } };
  });
}

async function handleOne(m: Rpc, c: Ctx) {
  const isNote = m.id === undefined;
  switch (m.method) {
    case 'initialize': {
      const want = String(m.params?.protocolVersion || '');
      return ok(m.id, { protocolVersion: VERSIONS.includes(want) ? want : VERSIONS[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'paconia', title: 'Paconia', version: '1.0.0' }, instructions: INSTRUCTIONS });
    }
    case 'notifications/initialized': case 'notifications/cancelled': return null;
    case 'ping': return ok(m.id, {});
    case 'tools/list': return ok(m.id, { tools: toolList(c) });
    case 'tools/call': {
      const name = String(m.params?.name || '');
      try {
        const out = await callTool(name, m.params?.arguments, c);
        const structured = out && typeof out === 'object' && !Array.isArray(out) ? out : { items: out };
        return ok(m.id, { content: [{ type: 'text', text: JSON.stringify(out, null, 1) }], structuredContent: structured, isError: false });
      } catch (e) {
        if (e instanceof ToolError) return ok(m.id, { content: [{ type: 'text', text: e.message }], isError: true });
        console.error('[mcp]', name, e);
        return ok(m.id, { content: [{ type: 'text', text: 'Something went wrong on the server while running this tool.' }], isError: true });
      }
    }
    case 'resources/list': return ok(m.id, { resources: [] });
    case 'prompts/list': return ok(m.id, { prompts: [] });
    default: return isNote ? null : err(m.id, -32601, `Method not found: ${m.method}`);
  }
}

export async function mcpPost(req: Request, rawKey: string | null) {
  const c = await keyContext(rawKey);
  if (!c) return NextResponse.json(err(null, -32001, 'Missing or invalid Paconia API key. Create one in Desk → Setup → AI & API access.'), { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="paconia"' } });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json(err(null, -32700, 'Parse error'), { status: 400 }); }
  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]) as Rpc[];
  if (!msgs.length) return NextResponse.json(err(null, -32600, 'Empty batch'), { status: 400 });
  const out = [];
  for (const m of msgs) {
    if (!m || typeof m !== 'object' || typeof m.method !== 'string') { out.push(err(m?.id, -32600, 'Invalid request')); continue; }
    const r = await handleOne(m, c);
    if (r) out.push(r);
  }
  if (!out.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(batch ? out : out[0], { headers: { 'Cache-Control': 'no-store' } });
}

export const mcpGet = () => NextResponse.json({ error: 'This is the Paconia MCP endpoint. Send JSON-RPC requests with POST.' }, { status: 405, headers: { Allow: 'POST' } });

/* ---------- REST: the same tools as plain HTTP ---------- */

export async function restList(req: Request) {
  const c = await keyContext(bearer(req));
  if (!c) return NextResponse.json({ error: 'Missing or invalid API key' }, { status: 401 });
  return NextResponse.json({ acting_as: c.s.name, access: c.write ? 'read and write' : 'read only', tools: toolList(c).map((t) => ({ name: t.name, description: t.description, input: t.inputSchema })) });
}
export async function restCall(req: Request, name: string) {
  const c = await keyContext(bearer(req));
  if (!c) return NextResponse.json({ error: 'Missing or invalid API key' }, { status: 401 });
  if (!TOOLS.some((t) => t.name === name)) return NextResponse.json({ error: `Unknown tool ${name}` }, { status: 404 });
  if (req.method !== 'POST' && TOOLS.find((t) => t.name === name)?.write) return NextResponse.json({ error: `${name} changes data; call it with POST` }, { status: 405, headers: { Allow: 'POST' } });
  let args: unknown = {};
  if (req.method === 'POST') { try { args = await req.json(); } catch { return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 }); } }
  else args = Object.fromEntries([...new URL(req.url).searchParams].map(([k, v]) => [k, /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v === 'true' ? true : v === 'false' ? false : v]));
  try { return NextResponse.json({ ok: true, result: await callTool(name, args, c) }); }
  catch (e) { if (e instanceof ToolError) return NextResponse.json({ ok: false, error: e.message }, { status: 400 }); console.error('[api]', name, e); return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 }); }
}
