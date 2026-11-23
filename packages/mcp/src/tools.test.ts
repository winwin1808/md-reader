import { describe, it, expect } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { BridgeCallError } from './bridge-server'
import { registerTools, type BridgeLike } from './tools'

async function setup(impl?: (tool: string, args: unknown) => unknown) {
  const calls: Array<{ tool: string; args: unknown }> = []
  const bridge = {
    call: async (tool: string, args: unknown) => {
      calls.push({ tool, args })
      if (impl) return impl(tool, args)
      return { ok: true }
    },
  } as unknown as BridgeLike
  const server = new McpServer({ name: 't', version: '0' })
  registerTools(server, bridge)
  const client = new Client({ name: 'c', version: '0' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(a), client.connect(b)])
  return { client, calls }
}

describe('registerTools', () => {
  it('lists exactly 10 tools', async () => {
    const { client } = await setup()
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual(
      ['get_doc', 'list_comments', 'list_docs', 'list_links', 'publish_doc', 'reply_comment', 'resolve_comment', 'revoke_link', 'share_doc', 'update_doc'],
    )
  })

  it('publish_doc passes validated args and returns JSON text', async () => {
    const { client, calls } = await setup(() => ({ docId: 'd1' }))
    const r = (await client.callTool({ name: 'publish_doc', arguments: { title: '  Hi  ', markdown: '# x' } })) as any
    expect(calls).toEqual([{ tool: 'publish_doc', args: { title: 'Hi', markdown: '# x' } }])
    expect(JSON.parse(r.content[0].text)).toEqual({ docId: 'd1' })
    expect(r.isError).toBeFalsy()
  })

  it('maps BridgeCallError to isError text', async () => {
    const { client } = await setup(() => {
      throw new BridgeCallError('CONFLICT', 'x')
    })
    const r = (await client.callTool({ name: 'list_docs', arguments: {} })) as any
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toBe('CONFLICT: x')
  })

  it('maps other errors to INTERNAL', async () => {
    const { client } = await setup(() => {
      throw new Error('boom')
    })
    const r = (await client.callTool({ name: 'list_docs', arguments: {} })) as any
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toBe('INTERNAL: boom')
  })

  it('share_doc applies defaults', async () => {
    const { client, calls } = await setup()
    await client.callTool({ name: 'share_doc', arguments: { docId: 'd1' } })
    expect(calls[0]).toEqual({ tool: 'share_doc', args: { docId: 'd1', role: 'view', expiresInDays: 7 } })
  })

  it('rejects tokenPrefix of length 5 without calling the bridge', async () => {
    const { client, calls } = await setup()
    let isErr = false
    try {
      const r = (await client.callTool({ name: 'revoke_link', arguments: { docId: 'd1', tokenPrefix: 'abcde' } })) as any
      isErr = !!r.isError
    } catch {
      isErr = true
    }
    expect(isErr).toBe(true)
    expect(calls).toEqual([])
  })

  describe('comment tools', () => {
    it('list_comments defaults status to open and returns JSON', async () => {
      const { client, calls } = await setup(() => ({ threads: [] }))
      const r = (await client.callTool({ name: 'list_comments', arguments: { docId: 'd1' } })) as any
      expect(calls).toEqual([{ tool: 'list_comments', args: { docId: 'd1', status: 'open' } }])
      expect(JSON.parse(r.content[0].text)).toEqual({ threads: [] })
    })

    it('reply_comment with empty body is INVALID_ARGS and does not call the bridge', async () => {
      const { client, calls } = await setup()
      let text = ''
      try {
        const r = (await client.callTool({ name: 'reply_comment', arguments: { docId: 'd1', threadId: 't1', body: '' } })) as any
        text = r.isError ? r.content[0].text : 'ok'
      } catch (e) {
        text = 'INVALID_ARGS: ' + String(e)
      }
      expect(text).toMatch(/INVALID_ARGS|validation/i)
      expect(calls).toEqual([])
    })

    it('resolve_comment forwards reply', async () => {
      const { client, calls } = await setup()
      await client.callTool({ name: 'resolve_comment', arguments: { docId: 'd1', threadId: 't1', reply: 'fixed' } })
      expect(calls).toEqual([{ tool: 'resolve_comment', args: { docId: 'd1', threadId: 't1', reply: 'fixed' } }])
    })

    it('TIMEOUT on comment tools hints at extension 1.6.0, not on old tools', async () => {
      const { client } = await setup(() => {
        throw new BridgeCallError('TIMEOUT', 'slow')
      })
      const a = (await client.callTool({ name: 'list_comments', arguments: { docId: 'd1' } })) as any
      expect(a.isError).toBe(true)
      expect(a.content[0].text).toContain('1.6.0')
      const b = (await client.callTool({ name: 'get_doc', arguments: { docId: 'd1' } })) as any
      expect(b.content[0].text).not.toContain('1.6.0')
    })
  })
})
