import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PalettePicker } from './ThemePicker'

function setup(mode: 'light' | 'dark' | 'system' = 'light', contrast: 'standard' | 'high' = 'standard') {
  const onModeChange = vi.fn()
  const onContrastChange = vi.fn()
  render(<PalettePicker mode={mode} contrast={contrast} onModeChange={onModeChange} onContrastChange={onContrastChange} />)
  return { onModeChange, onContrastChange }
}

describe('PalettePicker', () => {
  afterEach(cleanup)

  test('three radios with names in a radiogroup', () => {
    setup()
    expect(screen.getByRole('radiogroup', { name: 'Bảng màu' })).toBeTruthy()
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label') ?? r.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Giấy'), expect.stringContaining('Than chì'), expect.stringContaining('Theo hệ thống')]),
    )
    expect(screen.getByRole('radio', { name: /Giấy/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: /Giấy/ }).getAttribute('tabindex')).toBe('0')
    expect(screen.getByRole('radio', { name: /Than chì/ }).getAttribute('tabindex')).toBe('-1')
  })

  test('arrow right from Giấy selects Than chì', () => {
    const { onModeChange } = setup()
    fireEvent.keyDown(screen.getByRole('radio', { name: /Giấy/ }), { key: 'ArrowRight' })
    expect(onModeChange).toHaveBeenCalledWith('dark')
  })

  test('click and Enter/Space select', () => {
    const { onModeChange } = setup()
    fireEvent.click(screen.getByRole('radio', { name: /Theo hệ thống/ }))
    expect(onModeChange).toHaveBeenCalledWith('system')
    fireEvent.keyDown(screen.getByRole('radio', { name: /Than chì/ }), { key: 'Enter' })
    expect(onModeChange).toHaveBeenCalledWith('dark')
    fireEvent.keyDown(screen.getByRole('radio', { name: /Than chì/ }), { key: ' ' })
    expect(onModeChange).toHaveBeenCalledTimes(3)
  })

  test('contrast switch toggles', () => {
    const { onContrastChange } = setup('light', 'standard')
    const sw = screen.getByRole('switch', { name: 'Tăng tương phản' })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(sw)
    expect(onContrastChange).toHaveBeenCalledWith('high')
  })

  test('contrast switch off when high', () => {
    const { onContrastChange } = setup('light', 'high')
    const sw = screen.getByRole('switch', { name: 'Tăng tương phản' })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(sw)
    expect(onContrastChange).toHaveBeenCalledWith('standard')
  })

  test('no retired colour-theme references remain in ui src', () => {
    const re = new RegExp(['color' + 'Theme', 'Color' + 'Theme', 'data-color' + '-theme'].join('|'))
    const hits: string[] = []
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('ThemePicker.test.tsx') && re.test(fs.readFileSync(p, 'utf8'))) hits.push(p)
      }
    }
    walk(path.resolve(__dirname, '..'))
    expect(hits).toEqual([])
  })
})
