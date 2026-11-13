import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startBridgeServer } from './bridge-server'
import { loadOrCreateIdentity, unpairIdentity } from './pairing'
import { registerTools } from './tools'

export const VERSION = '1.3.3'

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
  const identity = await loadOrCreateIdentity(deps.pairPath)
  const bridge = await startBridgeServer({ identity, client: 'MCP', ports: deps.ports })
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
  stderr.write(`le-sach-mcp ${VERSION} listening on 127.0.0.1:${bridge.port}\n`)
  return {
    async close() {
      await server.close()
      await bridge.close()
    },
  }
}

export async function runCli(
  argv: readonly string[],
  deps: { stderr?: NodeJS.WritableStream; pairPath?: string } = {},
): Promise<'serve' | 'done'> {
  if (argv[0] !== 'unpair') return 'serve'
  const stderr = deps.stderr ?? process.stderr
  const r = await unpairIdentity(deps.pairPath)
  stderr.write(
    r === 'unpaired'
      ? 'le-sach-mcp: đã bỏ ghép cặp — khởi động lại ứng dụng AI rồi bấm Kết nối trong MD Reader (Cài đặt → Kết nối AI)\n'
      : 'le-sach-mcp: chưa ghép cặp với MD Reader nào\n',
  )
  return 'done'
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

function serveMain(): void {
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
    process.stderr.write(`le-sach-mcp: ${e instanceof Error ? e.message : String(e)}\n`)
    process.exit(1)
  })
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  runCli(process.argv.slice(2)).then(
    (r) => {
      if (r === 'serve') serveMain()
    },
    (e: unknown) => {
      process.stderr.write(`le-sach-mcp: ${e instanceof Error ? e.message : String(e)}\n`)
      process.exitCode = 1
    },
  )
}
