import { restList } from '@/lib/mcp/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (req: Request) => restList(req);
