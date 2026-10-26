import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { pathToFileURL } from 'node:url'
import { startBridgeServer } from './bridge-server'
import { loadOrCreatePairKey } from './pairing'
import { registerTools } from './tools'

export const VERSION = '0.1.0'

export async function main(
  deps: {
    stdin?: NodeJS.ReadableStream
    stdout?: NodeJS.WritableStream
    stderr?: NodeJS.WritableStream
    pairPath?: string
    ports?: readonly number[]
  } = {},
): Promise<{ close(): Promise<void> }> {
  const stderr = deps.stderr ?? process.stderr
  const pairKey = await loadOrCreatePairKey(deps.pairPath)
  const bridge = await startBridgeServer({ pairKey, client: 'MCP', ports: deps.ports })
  const server = new McpServer({ name: 'md-reader', version: VERSION })
  registerTools(server, bridge)
  server.server.oninitialized = () => {
    const n = server.server.getClientVersion()?.name
    if (n) bridge.setClient(n.slice(0, 100))
  }
  await server.connect(
    new StdioServerTransport(
      (deps.stdin ?? process.stdin) as import('node:stream').Readable,
      (deps.stdout ?? process.stdout) as import('node:stream').Writable,
    ),
  )
  stderr.write(`md-reader-mcp ${VERSION} listening on 127.0.0.1:${bridge.port}\n`)
  return {
    async close() {
      await server.close()
      await bridge.close()
    },
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (h) => {
      let done = false
      const stop = () => {
        if (done) return
        done = true
        h.close().finally(() => process.exit(0))
      }
      process.on('SIGINT', stop)
      process.on('SIGTERM', stop)
      process.stdin.on('end', stop)
    },
    (e: unknown) => {
      process.stderr.write(`md-reader-mcp: ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(1)
    },
  )
}
