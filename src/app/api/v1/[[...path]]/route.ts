import '@/server/routes';
import { handle } from '@/server/router';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const h = (req: Request) => handle(req);
export { h as GET, h as POST, h as PATCH, h as DELETE };
