import type { Connection, ConnectionContext } from 'partyserver'
import { YServer } from 'y-partyserver'
import type { Env } from './env.js'

export class DocRoom extends YServer<Env> {
  static callbackOptions = { debounceWait: 2000, debounceMaxWait: 10000, timeout: 5000 }

  onConnect(conn: Connection, ctx: ConnectionContext): void {
    const role = ctx.request.headers.get('x-mdr-role') ?? 'view'
    conn.setState({ role })
    super.onConnect(conn, ctx)
  }
}
