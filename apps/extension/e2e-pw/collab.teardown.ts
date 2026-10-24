import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export default function teardown() {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'api', '.wrangler-e2e')
  fs.rmSync(dir, { recursive: true, force: true })
}
