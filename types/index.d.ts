// © 2026 Mike Pollow, Digitalroots. MIT-Lizenz.
export type AgentTreeStatus = 'running' | 'done' | 'failed' | 'stopped'

export type AgentTreePhase = 'idle' | 'planning' | 'delegating' | 'reviewing'

export type AgentTreeNode = {
  id: string
  parentId?: string
  type: string
  description: string
  model?: string
  effort?: string
  background: boolean
  fork: boolean
  workflowRunId?: string
  status: AgentTreeStatus
  startedAt: number
  endedAt?: number
  contextTokens?: number
  toolCount: number
  lastTool?: string
  tools?: string[]
  task?: string
  answer?: string
  answerTokens?: number
}

export type AgentTreeStyle = 'line' | 'pixel' | 'braille' | 'hud' | 'ascii'

export type AgentTreeColors = 'original' | 'light' | 'retro' | 'mono'

export type AgentTreeLight = 'standard' | 'white' | 'gold' | 'cyan' | 'magenta'

export type AgentTreeLook = { style: AgentTreeStyle; colors: AgentTreeColors; light: AgentTreeLight }

export type AgentTreeCorrectionState = 'sent' | 'read' | 'failed'

export type AgentTreeCorrection = {
  at: number
  text: string
  via?: 'append' | 'send'
  state: AgentTreeCorrectionState
  readAt?: number
  count: number
  held?: boolean
}

export type AgentTreeAdvisorCall = {
  id: string
  at: number
  durationMs?: number
  agentId?: string
}

export type AgentTreeAdvisor = {
  model?: string
  total: number
  fromMain: number
  fromAgents: number
  calls: AgentTreeAdvisorCall[]
}

export type AgentTreeLogSource = 'session' | 'main' | 'agent' | 'advisor'

export type AgentTreeLogEntry = {
  at: number
  source: AgentTreeLogSource
  kind?: string
  data?: Record<string, string | number>
  text?: string
}

export type AgentTreeMain = {
  active: boolean
  resumed?: boolean
  turn: number
  turnStartedAt?: number
  roundStartedAt?: number
  model?: string
  effort?: string
  contextTokens?: number
  window?: number
  percent?: number
  returned: number
  returnedTokens: number
  costUsd?: number
}

export type AgentTreeOrphanEnd = {
  status: AgentTreeStatus
  at: number
  answerTokens: number
  answer?: string
  durationMs?: number
}

export type AgentTreeChoices = {
  newAgents?: string
  newEffort?: string
  agents: Record<string, string>
  efforts?: Record<string, string>
  picker?: string
}

export type AgentTreeDetail = {
  agentId: string
  state: 'loading' | 'ready' | 'denied'
}

export type AgentTreeState = {
  startedAt: number
  choices?: AgentTreeChoices
  detail?: AgentTreeDetail
  stopping?: string[]
  stopSent?: string[]
  corrections?: Record<string, AgentTreeCorrection>
  lookOpen?: boolean
  orphans?: Record<string, AgentTreeOrphanEnd>
  main: AgentTreeMain
  agents: AgentTreeNode[]
  advisor: AgentTreeAdvisor
  log: AgentTreeLogEntry[]
}

export type AgentTreeCounts = {
  running: number
  done: number
  failed: number
  stopped: number
}

export type AgentTreeGroup =
  | { kind: 'agent'; node: AgentTreeNode }
  | {
      kind: 'workflow'
      runId: string
      size: number
      running: number
      done: number
      failed: number
      stopped: number
      startedAt: number
      lastDescription: string
    }

declare module 'claude-code' {
  interface PluginState {
    'agent-tree': { tree: Shaped<AgentTreeState>; frame: number; look: Shaped<AgentTreeLook>; unread: Record<string, string[]> }
  }
}
