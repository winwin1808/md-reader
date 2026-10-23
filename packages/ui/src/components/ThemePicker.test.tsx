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

  test('switch has a track whose state follows aria-checked', () => {
    setup('light', 'standard')
    const off = screen.getByRole('switch').querySelector('.palette-switch-track')
    expect(off?.getAttribute('data-on')).toBe('false')
    cleanup()
    setup('light', 'high')
    expect(screen.getByRole('switch').querySelector('.palette-switch-track')?.getAttribute('data-on')).toBe('true')
  })

  test('selected card has check svg; others do not', () => {
    setup('dark')
    expect(screen.getByRole('radio', { name: /Than chì/ }).querySelector('svg.palette-check, .palette-check')).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Giấy/ }).querySelector('.palette-check')).toBeNull()
  })

  test('Space press selects exactly once', () => {
    const { onModeChange } = setup()
    const r = screen.getByRole('radio', { name: /Than chì/ })
    fireEvent.keyDown(r, { key: ' ' })
    fireEvent.keyUp(r, { key: ' ' })
    fireEvent.click(r)
    expect(onModeChange).toHaveBeenCalledTimes(1)
  })

  test('css/source checks', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../theme/toolbar.css'), 'utf8')
    const m = css.match(/\.tb-seg-btn\[aria-checked='true'\]\s*\{([^}]*)\}/)!
    expect(m[1]).toMatch(/background:\s*var\(--paper\)/)
    expect(m[1]).toMatch(/color:\s*var\(--ink\)/)
    for (const f of ['SettingsModal.tsx', 'ExportModal.tsx'])
      expect(fs.readFileSync(path.resolve(__dirname, f), 'utf8')).not.toContain('data-theme')
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
