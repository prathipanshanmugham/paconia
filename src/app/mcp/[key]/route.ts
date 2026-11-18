import { mcpGet, mcpPost } from '@/lib/mcp/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Same endpoint with the key in the URL, for MCP clients that cannot send headers (e.g. a Claude custom connector). */
export const POST = (req: Request, { params }: { params: { key: string } }) => mcpPost(req, params.key);
export const GET = mcpGet;
export const DELETE = mcpGet;
