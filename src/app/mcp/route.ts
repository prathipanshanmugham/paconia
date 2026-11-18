import { bearer, mcpGet, mcpPost } from '@/lib/mcp/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** MCP endpoint for AI agents. Authorization: Bearer pac_… */
export const POST = (req: Request) => mcpPost(req, bearer(req));
export const GET = mcpGet;
export const DELETE = mcpGet;
