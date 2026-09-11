import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import {
  createDoc,
  getSource,
  importText,
  exportText,
  appendHistory,
  listHistory,
  sourceClientIds,
} from '../index.js'

describe('converge and history', () => {
  describe('appendHistory validation', () => {
    it('throws TypeError when actor is empty or whitespace', () => {
      const doc = createDoc()
      expect(() =>
        appendHistory(doc, {
          actor: '',
          label: 'test',
          clientIds: [doc.clientID],
        }),
      ).toThrow(new TypeError('history entry requires an actor'))

      expect(() =>
        appendHistory(doc, {
          actor: '   ',
          label: 'test',
          clientIds: [doc.clientID],
        }),
      ).toThrow(new TypeError('history entry requires an actor'))
    })
  })

  describe('Ca 1: Hoi tu van ban', () => {
    it('converges text edits from two replicas', () => {
      const initialText = 'Hello World'
      const docA = createDoc()
      importText(docA, initialText, { originHash: 'test-hash' })

      const docB = createDoc()
      Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))
      expect(exportText(docB)).toBe(initialText)

      // docA chèn text ở đầu/giữa
      getSource(docA).insert(0, 'Start: ')
      // docB chèn text ở cuối độc lập
      getSource(docB).insert(initialText.length, ' End.')

      // Đồng bộ 2 chiều
      Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))
      Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB))

      expect(exportText(docA)).toBe(exportText(docB))
      expect(exportText(docA)).toBe('Start: Hello World End.')
    })
  })

  describe('Ca 2: Hoi tu lich su', () => {
    it('converges history entries without loss and preserves ids', () => {
      const docA = createDoc()
      const docB = createDoc()
      Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))

      const entryA = appendHistory(docA, {
        actor: 'user-a',
        label: 'edit by a',
        clientIds: [docA.clientID],
      })

      const entryB = appendHistory(docB, {
        actor: 'user-b',
        label: 'edit by b',
        clientIds: [docB.clientID],
      })

      // Đồng bộ 2 chiều
      Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))
      Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB))

      const historyA = listHistory(docA)
      const historyB = listHistory(docB)

      expect(historyA.length).toBe(2)
      expect(historyB.length).toBe(2)
      expect(historyA).toEqual(historyB)

      const ids = historyA.map((e) => e.id)
      expect(ids).toContain(entryA.id)
      expect(ids).toContain(entryB.id)
      expect(entryA.id).not.toBe(entryB.id)
    })
  })

  describe('Ca 3: Hoi tu sourceClientIds', () => {
    it('tracks active clientIds and drops deleted structs', () => {
      const initialText = 'Hello World'
      const docA = createDoc()
      importText(docA, initialText, { originHash: 'test-hash' })

      const docB = createDoc()
      Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))

      // docA chèn text ở đầu
      getSource(docA).insert(0, 'Start: ')
      // docB chèn text ở cuối
      getSource(docB).insert(initialText.length, ' End.')

      // Đồng bộ 2 chiều
      Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))
      Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB))

      const expectedIds = [docA.clientID, docB.clientID].sort((a, b) => a - b)
      expect(sourceClientIds(docA)).toEqual(expectedIds)
      expect(sourceClientIds(docB)).toEqual(expectedIds)

      // Xoá toàn bộ text của docA ('Start: Hello World')
      const docATextLength = 'Start: '.length + initialText.length
      getSource(docA).delete(0, docATextLength)

      // Đồng bộ sang docB
      Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))

      expect(exportText(docA)).toBe(' End.')
      expect(exportText(docB)).toBe(' End.')
      expect(sourceClientIds(docA)).toEqual([docB.clientID])
      expect(sourceClientIds(docB)).toEqual([docB.clientID])
    })
  })
})
