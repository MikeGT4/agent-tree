// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
import { describe, expect, test } from 'claude-code/testing'

import { completed, createTree, fileNoted, fullText, reportAgent, reportLoaded, reportPinned, selectedSet, stepped, detailOpened, freshTree, hasNewReport, lookOpened, pickerOpened, selectionToggled, spawned, tabChosen, tabOf, TABS } from '../hooks/model.ts'
import type { AgentTreeState } from '../types'
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

  test('ein Geheimnis in der Zeile nach seinem Namen bleibt nicht lesbar', () => {
    expect(fullText('password:\nhunter2geheim')).not.toContain('hunter2geheim')
    expect(fullText('Authorization: Bearer\nabc123def456ghi')).not.toContain('abc123def456ghi')
    expect(fullText('export API_KEY=\nwert-123-geheim')).not.toContain('wert-123-geheim')
    expect(fullText('Authorization: Basic\nQWxhZGRpbjpvcGVuIHNlc2FtZQ==')).not.toContain('QWxhZGRpbjpvcGVuIHNlc2FtZQ==')
    expect(fullText('token = "abc\ndef-geheim"')).not.toContain('def-geheim')
  })

  test('nach einer maskierten Zeile bleibt die nächste harmlose Zeile stehen', () => {
    expect(fullText('password: geheim123\nNächste Zeile bleibt')).toBe('•••\nNächste Zeile bleibt')
    expect(fullText('Der Schlüssel:\n\nsteht im Tresor')).toBe('Der Schlüssel:\n\nsteht im Tresor')
  })

  test('ein Tabulator bleibt als Einrückung von vier Leerzeichen', () => {
    expect(fullText('func main() {\n\treturn 1\n}').split('\n')[1]).toBe('    return 1')
  })

  test('ein gekürzter Volltext endet mit Auslassungszeichen, ein ganzer nicht', () => {
    expect(fullText('a'.repeat(30000)).endsWith('…')).toBe(true)
    expect(fullText('kurz').endsWith('…')).toBe(false)
  })

  test('der gezeigte Bericht bleibt stehen, wenn ein anderer Agent endet oder startet', () => {
    let s = spawned(spawned(createTree(0), spawn('a1'), 1), spawn('a2'), 2)
    s = tabChosen(s, 'reports', 3)
    expect(reportAgent(s)).toBe('a2')
    s = completed(s, finish('a1'), 5)
    expect(reportAgent(s)).toBe('a2')
    s = spawned(s, spawn('a3'), 6)
    expect(reportAgent(s)).toBe('a2')
  })

  test('beim erneuten Öffnen zeigt der Tab den zuletzt fertigen Agenten', () => {
    let s = spawned(spawned(createTree(0), spawn('a1'), 1), spawn('a2'), 2)
    s = tabChosen(tabChosen(s, 'reports', 3), 'tree', 4)
    s = completed(s, finish('a1'), 5)
    expect(reportAgent(tabChosen(s, 'reports', 6))).toBe('a1')
  })

  test('ein erneuter Klick auf den offenen Tab lässt den gezeigten Bericht stehen', () => {
    let s = spawned(spawned(createTree(0), spawn('a1'), 1), spawn('a2'), 2)
    s = completed(tabChosen(s, 'reports', 3), finish('a1'), 5)
    expect(reportAgent(tabChosen(s, 'reports', 6))).toBe('a2')
  })

  test('ein Klick auf einen Agenten heftet dessen Bericht an, ein unbekannter ändert nichts', () => {
    const s = spawned(spawned(createTree(0), spawn('a1'), 1), spawn('a2'), 2)
    const pinned = reportPinned(s, 'a1', 3)
    expect(tabOf(pinned)).toBe('reports')
    expect(reportAgent(pinned)).toBe('a1')
    expect(pinned.selected).toBeUndefined()
    expect(reportPinned(pinned, 'fehlt', 4)).toBe(pinned)
  })

  test('ist der angeheftete Agent nicht mehr da, gilt wieder der zuletzt fertige oder gestartete', () => {
    const s = reportPinned(spawned(spawned(createTree(0), spawn('a1'), 1), spawn('a2'), 2), 'a1', 3)
    expect(reportAgent({ ...s, agents: s.agents.filter(n => n.id !== 'a1') })).toBe('a2')
  })
})

describe('Größe der gezeichneten Tabs', () => {
  const ui = { Box: 'Box', Text: 'Text', Button: 'Button' } as never
  const actions = new Proxy({}, { get: () => () => undefined }) as never
  const long = (text: string, length: number) => text.padEnd(length, 'x')
  const many = (count: number) => {
    let s = createTree(0)
    for (let i = 1; i <= count; i++) s = spawned(s, { ...spawn(`a${i}`), description: long(`Auftrag ${i} `, 80) }, i)
    return s
  }
  const size = (s: AgentTreeState, tab: string, reports = {}) =>
    JSON.stringify(drawTree(ui, tabChosen(s, tab, 9), 90, 60, { frame: 0, animate: false, now: 9000, actions, reports })).length
  const finish = (agentId: string) => ({ agentId, answer: 'OK', reason: 'answer', isAborted: false, durationMs: 900 })

  test('ein volles Protokoll bleibt unter der halben Baumgrenze', () => {
    let s = many(100)
    for (let i = 1; i <= 100; i++) s = completed(s, finish(`a${i}`), 200 + i)
    expect(s.log.length).toBe(150)
    expect(size(s, 'log')).toBeLessThan(50000)
  })

  test('der Baum bleibt mit zweihundert Agenten unter der Grenze', () => {
    expect(size(many(200), 'tree')).toBeLessThan(50000)
  })

  test('viele Agenten mit vollen Dateilisten bleiben unter der Grenze, der Rest steht als Zahl da', () => {
    let s = many(60)
    for (let i = 1; i <= 60; i++) {
      for (let f = 1; f <= 50; f++) {
        s = fileNoted(s, `a${i}`, 'read', long(`gelesen-${i}-${f}-`, 60))
        s = fileNoted(s, `a${i}`, 'change', long(`geaendert-${i}-${f}-`, 60))
      }
    }
    const drawn = JSON.stringify(drawTree(ui, tabChosen(s, 'files', 9), 90, 60, { frame: 0, animate: false, now: 9000, actions }))
    expect(drawn.length).toBeLessThan(60000)
    expect(drawn).toContain('Geändert (50)')
    expect(drawn).toMatch(/\+\d+/)
  })

  test('wenige Agenten zeigen alle ihre Dateien', () => {
    let s = many(2)
    for (let f = 1; f <= 30; f++) s = fileNoted(s, 'a1', 'read', `datei-${f}.ts`)
    const drawn = JSON.stringify(drawTree(ui, tabChosen(s, 'files', 9), 90, 60, { frame: 0, animate: false, now: 9000, actions }))
    expect(drawn).toContain('datei-1.ts')
    expect(drawn).toContain('datei-30.ts')
  })

  test('zweihundert Agenten im Verbrauch bleiben unter der Grenze', () => {
    expect(size(many(200), 'usage')).toBeLessThan(60000)
  })

  test('zeigt ein Tab nicht alle Agenten, steht die Zahl der übrigen da', () => {
    const drawn = (tab: string) => JSON.stringify(drawTree(ui, tabChosen(many(200), tab, 9), 90, 60, { frame: 0, animate: false, now: 9000, actions }))
    expect(drawn('usage')).toContain('+160 weitere')
    expect(drawn('reports')).toContain('+160 weitere')
  })

  test('zweihundert Agenten und ein voller Bericht bleiben unter der Grenze', () => {
    const s = many(200)
    const reports = { a200: { agentId: 'a200', state: 'ready', task: 'T'.repeat(20000), answer: 'A'.repeat(20000) } }
    expect(size(s, 'reports', reports)).toBeLessThan(80000)
  })
})
