// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'

import { completed, createTree, fullText, reportAgent, reportLoaded, selectedSet, stepped, detailOpened, freshTree, hasNewReport, lookOpened, pickerOpened, selectionToggled, spawned, tabChosen, tabOf, TABS } from '../hooks/model.ts'
import { drawTree, pressKey } from '../hooks/view.tsx'
import { usageRows } from '../hooks/tabs.tsx'

const spawn = (agentId: string) => ({ agentId, agentType: 'Explore', description: `Auftrag ${agentId}`, background: false, fork: false })

describe('Tabs im Zustand', () => {
  test('ohne Wahl gilt der Baum', () => {
    expect(tabOf(createTree(0))).toBe('tree')
  })

  test('die Reihenfolge der Tabs steht fest', () => {
    expect(TABS).toEqual(['tree', 'reports', 'files', 'log', 'usage', 'help'])
  })

  test('ein gewählter Tab gilt', () => {
    expect(tabOf(tabChosen(createTree(0), 'files'))).toBe('files')
  })

  test('ein unbekannter Tab ändert nichts', () => {
    const s = tabChosen(createTree(0), 'files')
    expect(tabOf(tabChosen(s, 'nirgends'))).toBe('files')
  })

  test('der Wechsel des Tabs schließt Details, Aussehen und Wahl', () => {
    let s = spawned(createTree(0), { ...spawn('a1'), prompt: 'Lies den Code.' }, 1)
    s = tabChosen(detailOpened(s, 'a1'), 'log')
    expect(s.detail).toBeUndefined()
    s = tabChosen(lookOpened(tabChosen(s, 'tree')), 'usage')
    expect(s.lookOpen).toBeUndefined()
    s = tabChosen(pickerOpened(tabChosen(s, 'tree'), 'new'), 'help')
    expect(s.choices?.picker).toBeUndefined()
  })

  test('die Auswahl eines Agenten bleibt über den Wechsel', () => {
    const s = tabChosen(selectionToggled(spawned(createTree(0), spawn('a1'), 1), 'a1'), 'reports')
    expect(s.selected).toBe('a1')
  })

  test('nach einem Neuanfang gilt wieder der Baum', () => {
    expect(tabOf(freshTree(tabChosen(createTree(0), 'log'), 5))).toBe('tree')
  })
})

describe('Neue Antwort am Tab Berichte', () => {
  const finish = (agentId: string) => ({ agentId, answer: 'OK', reason: 'answer', isAborted: false, durationMs: 900 })

  test('ohne fertigen Agenten gibt es nichts Neues', () => {
    expect(hasNewReport(spawned(createTree(0), spawn('a1'), 1))).toBe(false)
  })

  test('ein fertiger Agent ist neu, bis der Tab Berichte besucht wurde', () => {
    let s = completed(spawned(createTree(0), spawn('a1'), 1), finish('a1'), 5)
    expect(hasNewReport(s)).toBe(true)
    s = tabChosen(s, 'reports', 6)
    expect(hasNewReport(s)).toBe(false)
    s = tabChosen(s, 'tree', 7)
    expect(hasNewReport(s)).toBe(false)
  })

  test('ein später fertiger Agent ist wieder neu', () => {
    let s = spawned(spawned(createTree(0), spawn('a1'), 1), spawn('a2'), 2)
    s = tabChosen(tabChosen(completed(s, finish('a1'), 5), 'reports', 6), 'tree', 7)
    expect(hasNewReport(completed(s, finish('a2'), 9))).toBe(true)
  })
})

describe('Tabs zeichnen und drücken', () => {
  const ui = { Box: 'Box', Text: 'Text', Button: 'Button' } as never

  test('pressKey kennt die Tabs und lehnt Unbekanntes ab', () => {
    const pressed: string[] = []
    const actions = { tab: (id: string) => void pressed.push(id) } as never
    expect([pressKey(actions, 'tab:log'), pressKey(actions, 'tab:nirgends')]).toEqual([true, false])
    expect(pressed).toEqual(['log'])
  })

  test('ohne Bedienung sind die Tabs Text und keine Knöpfe', () => {
    const drawn = JSON.stringify(drawTree(ui, createTree(0), 90, 60, { frame: 0, animate: false, now: 5 }))
    expect(drawn).toContain('Berichte')
    expect(drawn).not.toContain('"Button"')
  })
})

describe('Verbrauch', () => {
  test('die Agenten stehen nach Kontext sortiert, der größte zuerst, ohne Messung zuletzt', () => {
    let s = spawned(spawned(spawned(createTree(0), spawn('a1'), 1), spawn('a2'), 2), spawn('a3'), 3)
    s = stepped(s, { agentId: 'a1', model: 'claude-haiku-5-5', contextTokens: 5000 }, 4)
    s = stepped(s, { agentId: 'a2', model: 'claude-haiku-5-5', contextTokens: 90000 }, 5)
    expect(usageRows(s).map(n => n.id)).toEqual(['a2', 'a1', 'a3'])
  })
})

describe('Berichte', () => {
  const finish = (agentId: string) => ({ agentId, answer: 'OK', reason: 'answer', isAborted: false, durationMs: 900 })

  test('der Volltext behält seine Zeilen und maskiert Geheimnisse', () => {
    const text = fullText('Zeile 1\nZeile 2 mit Bearer abcdef123456\n\n- Punkt')
    expect(text.split('\n')).toEqual(['Zeile 1', 'Zeile 2 mit •••', '', '- Punkt'])
  })

  test('der Volltext endet an der Obergrenze', () => {
    expect([...fullText('a'.repeat(30000))].length).toBeLessThanOrEqual(20000)
  })

  test('gezeigt wird der gewählte Agent, sonst der zuletzt fertige, sonst der zuletzt gestartete', () => {
    let s = spawned(spawned(spawned(createTree(0), spawn('a1'), 1), spawn('a2'), 2), spawn('a3'), 3)
    expect(reportAgent(createTree(0))).toBeUndefined()
    expect(reportAgent(s)).toBe('a3')
    s = completed(s, finish('a1'), 5)
    expect(reportAgent(s)).toBe('a1')
    expect(reportAgent(selectedSet(s, 'a2'))).toBe('a2')
  })

  test('ein geladener Bericht ist bereit, ein verweigerter sagt das', () => {
    expect(reportLoaded('a1', { task: 'Auftrag', answer: 'Antwort' })).toEqual({ agentId: 'a1', state: 'ready', task: 'Auftrag', answer: 'Antwort' })
    expect(reportLoaded('a1', { denied: true })).toEqual({ agentId: 'a1', state: 'denied' })
  })
})
