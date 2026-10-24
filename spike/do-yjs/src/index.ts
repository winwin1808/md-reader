import { YServer } from 'y-partyserver';
import { routePartykitRequest } from 'partyserver';

export class DocRoom extends YServer {
  onConnect(conn: any, ctx: any) {
    console.log('x-mdr-role=' + String(ctx?.request?.headers.get('x-mdr-role') ?? null));
    return super.onConnect(conn, ctx);
  }
}

export default {
  fetch: (req: Request, env: any) =>
    routePartykitRequest(req, env) ?? new Response('404', { status: 404 }),
};
