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
  answerTokens?: number
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

export type AgentTreeLogSource ='session' | 'main' | 'agent' | 'advisor'

export type AgentTreeLogEntry = {
  at: number
  source: AgentTreeLogSource
  text: string
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
}

export type AgentTreeOrphanEnd = {
  status: AgentTreeStatus
  at: number
  answerTokens: number
}

export type AgentTreeChoices = {
  newAgents?: string
  agents: Record<string, string>
  picker?: string
}

export type AgentTreeState = {
  startedAt: number
  choices?: AgentTreeChoices
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
    'agent-tree': { tree: Shaped<AgentTreeState>; frame: number }
  }
}
