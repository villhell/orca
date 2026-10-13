import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ActivityTerminalPortalTarget } from './activity-terminal-portal'
import { hasActivityThreadWorkspace } from './activity-thread-actions'
import { selectActivityGridThreads, type ActivityGridSelection } from './activity-grid-threads'
import type { AgentPaneThread } from './activity-thread-types'
import type { AgentPaneThreadsStoreData } from './use-agent-pane-threads'

export type ActivityGridPortals = ActivityGridSelection & {
  descriptors: ActivityTerminalPortalTarget[]
  targets: HTMLElement[]
  focusedPaneKey: string | null
  focusCell: (paneKey: string) => void
  setCellTarget: (paneKey: string, target: HTMLElement | null) => void
}

const GRID_SLOT_PREFIX = 'grid'

export function useActivityGridPortals({
  enabled,
  threads,
  storeData
}: {
  enabled: boolean
  threads: AgentPaneThread[]
  storeData: AgentPaneThreadsStoreData
}): ActivityGridPortals {
  const [targetByPaneKey, setTargetByPaneKey] = useState<Record<string, HTMLElement>>({})
  const [requestedFocusPaneKey, setRequestedFocusPaneKey] = useState<string | null>(null)
  const acknowledgedTurnRef = useRef<string | null>(null)

  const selection = useMemo(
    () =>
      enabled
        ? selectActivityGridThreads({
            threads,
            tabsByWorktree: storeData.tabsByWorktree,
            hasWorkspace: (thread) => hasActivityThreadWorkspace(thread, storeData)
          })
        : { cells: [], overflowCount: 0 },
    [enabled, storeData, threads]
  )

  // Why: a closed or filtered-out cell must hand focus to a visible one so keyboard shortcuts keep an owner.
  const focusedPaneKey =
    selection.cells.find((thread) => thread.paneKey === requestedFocusPaneKey)?.paneKey ??
    selection.cells[0]?.paneKey ??
    null

  const setCellTarget = useCallback((paneKey: string, target: HTMLElement | null): void => {
    setTargetByPaneKey((previous) => {
      if (target ? previous[paneKey] === target : !(paneKey in previous)) {
        return previous
      }
      const next = { ...previous }
      if (target) {
        next[paneKey] = target
      } else {
        delete next[paneKey]
      }
      return next
    })
  }, [])

  const descriptors = useMemo(() => {
    const next: ActivityTerminalPortalTarget[] = []
    for (const thread of selection.cells) {
      const target = targetByPaneKey[thread.paneKey]
      if (!target) {
        continue
      }
      next.push({
        slotId: `${GRID_SLOT_PREFIX}:${thread.paneKey}`,
        requestToken: `${GRID_SLOT_PREFIX}:${thread.paneKey}`,
        target,
        worktreeId: thread.worktree.id,
        tabId: thread.tab.id,
        paneKey: thread.paneKey,
        // Why one active cell: `active` arms Orca's terminal shortcuts, which must have a single owner.
        active: thread.paneKey === focusedPaneKey
      })
    }
    return next
  }, [focusedPaneKey, selection.cells, targetByPaneKey])

  const targets = useMemo(() => Object.values(targetByPaneKey), [targetByPaneKey])

  const focusedThread = selection.cells.find((thread) => thread.paneKey === focusedPaneKey)
  const { acknowledgeAgents } = storeData
  useEffect(() => {
    if (!focusedThread?.unread) {
      return
    }
    // Why once per turn: mirrors the list view's auto mark-read without re-acknowledging in a loop.
    const turnKey = `${focusedThread.paneKey}:${focusedThread.latestTimestamp}`
    if (acknowledgedTurnRef.current === turnKey) {
      return
    }
    acknowledgedTurnRef.current = turnKey
    acknowledgeAgents([focusedThread.paneKey])
  }, [acknowledgeAgents, focusedThread])

  return {
    ...selection,
    descriptors,
    targets,
    focusedPaneKey,
    focusCell: setRequestedFocusPaneKey,
    setCellTarget
  }
}
