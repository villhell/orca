import { useSyncExternalStore } from 'react'
import { createBrowserUuid } from '@/lib/browser-uuid'
import {
  closeMultiProjectPane,
  createMultiProjectLayout,
  focusMultiProjectPane,
  parseMultiProjectLayout,
  setMultiProjectPaneTarget,
  setMultiProjectSplitRatio,
  splitMultiProjectPane,
  type MultiProjectLayout,
  type MultiProjectSplitDirection
} from './multi-project-layout'

export type MultiProjectViewState = {
  enabled: boolean
  layout: MultiProjectLayout
}

const STORAGE_KEY = 'orca.multiProjectView'

function newId(): string {
  return createBrowserUuid()
}

function emptyState(): MultiProjectViewState {
  return {
    enabled: false,
    layout: createMultiProjectLayout({ id: newId(), worktreeId: null, tabId: null })
  }
}

function readStoredState(): MultiProjectViewState {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) {
      return emptyState()
    }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return emptyState()
    }
    const enabled = 'enabled' in parsed && parsed.enabled === true
    const layout = 'layout' in parsed ? parseMultiProjectLayout(parsed.layout) : null
    return layout ? { enabled, layout } : { ...emptyState(), enabled }
  } catch {
    return emptyState()
  }
}

let currentState: MultiProjectViewState | null = null
const subscribers = new Set<() => void>()

export function getMultiProjectViewState(): MultiProjectViewState {
  currentState ??= readStoredState()
  return currentState
}

function commit(next: MultiProjectViewState): void {
  if (next === getMultiProjectViewState()) {
    return
  }
  currentState = next
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Why: storage can be unavailable; the in-memory layout still applies for this session.
  }
  for (const subscriber of subscribers) {
    subscriber()
  }
}

function updateLayout(update: (layout: MultiProjectLayout) => MultiProjectLayout): void {
  const state = getMultiProjectViewState()
  const layout = update(state.layout)
  if (layout !== state.layout) {
    commit({ ...state, layout })
  }
}

export const multiProjectViewActions = {
  setEnabled(enabled: boolean): void {
    const state = getMultiProjectViewState()
    if (state.enabled !== enabled) {
      commit({ ...state, enabled })
    }
  },
  focusPane(paneId: string): void {
    updateLayout((layout) => focusMultiProjectPane(layout, paneId))
  },
  setPaneTarget(paneId: string, target: { worktreeId: string | null; tabId: string | null }): void {
    updateLayout((layout) => setMultiProjectPaneTarget(layout, paneId, target))
  },
  /** Splits a pane; the new pane opens on the same project and takes focus. */
  splitPane(paneId: string, direction: MultiProjectSplitDirection): string | null {
    const source = getMultiProjectViewState().layout.panes[paneId]
    if (!source) {
      return null
    }
    const newPane = { id: newId(), worktreeId: source.worktreeId, tabId: null }
    updateLayout((layout) => splitMultiProjectPane(layout, paneId, direction, newPane, newId()))
    return newPane.id
  },
  closePane(paneId: string): void {
    updateLayout((layout) => closeMultiProjectPane(layout, paneId))
  },
  setSplitRatio(splitId: string, ratio: number): void {
    updateLayout((layout) => setMultiProjectSplitRatio(layout, splitId, ratio))
  }
}

function subscribe(onStoreChange: () => void): () => void {
  subscribers.add(onStoreChange)
  return () => {
    subscribers.delete(onStoreChange)
  }
}

// Why module state: the titlebar toggle, the terminal portal bindings and the view are separate trees.
export function useMultiProjectViewState(): MultiProjectViewState {
  return useSyncExternalStore(subscribe, getMultiProjectViewState, getMultiProjectViewState)
}

export function useMultiProjectViewEnabled(): boolean {
  return useMultiProjectViewState().enabled
}
