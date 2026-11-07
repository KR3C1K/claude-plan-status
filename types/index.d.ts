export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Snapshot = { limits: Limit[]; model: string; checkedAt: number }

declare module 'claude-code' {
  interface PluginState {
    'plan-usage': { snapshot: Shaped<Snapshot | null>; effort: string | null }
  }
}
