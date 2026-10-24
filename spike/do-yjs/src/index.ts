import { YServer } from 'y-partyserver';
import { routePartykitRequest } from 'partyserver';

export class DocRoom extends YServer {
  inbound = 0;
  onMessage(conn: any, msg: any) {
    this.inbound++;
    return (super.onMessage as any)(conn, msg);
  }
  async onRequest(req: Request) {
    if (new URL(req.url).pathname.endsWith('/stats')) return Response.json({ inbound: this.inbound });
    return new Response('404', { status: 404 });
  }
  onConnect(conn: any, ctx: any) {
    console.log('x-mdr-role=' + String(ctx?.request?.headers.get('x-mdr-role') ?? null));
    return super.onConnect(conn, ctx);
  }
}

export default {
  fetch: (req: Request, env: any) =>
    routePartykitRequest(req, env) ?? new Response('404', { status: 404 }),
};
