import { restCall } from '@/lib/mcp/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (req: Request, { params }: { params: { name: string } }) => restCall(req, params.name);
export const POST = (req: Request, { params }: { params: { name: string } }) => restCall(req, params.name);
