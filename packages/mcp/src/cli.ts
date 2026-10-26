import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startBridgeServer } from './bridge-server'
import { loadOrCreatePairKey } from './pairing'
import { registerTools } from './tools'

export const VERSION = '1.3.0'

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

export function isDirectRun(moduleUrl: string, argv1: string | undefined): boolean {
  if (!argv1) return false
  const self = fileURLToPath(moduleUrl)
  try {
    return realpathSync(argv1) === realpathSync(self)
  } catch {
    return argv1 === self
  }
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  const running = main()
  let done = false
  const stop = () => {
    if (done) return
    done = true
    running.then(
      (h) => h.close().finally(() => process.exit(0)),
      () => undefined,
    )
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  process.stdin.on('end', stop)
  running.catch((e: unknown) => {
    process.stderr.write(`md-reader-mcp: ${e instanceof Error ? e.message : String(e)}\n`)
    process.exit(1)
  })
}
