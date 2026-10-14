import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'
import {
  setActivityTerminalPortals,
  type ActivityTerminalPortalTarget
} from '../activity/activity-terminal-portal'
import { requestBackgroundTerminalWorktreeMount } from '../terminal/background-terminal-worktree-mount'
import { closeTerminalTab } from '../terminal/terminal-tab-actions'
import { createNewTerminalTab } from '../terminal/terminal-tab-create'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { listMultiProjectPaneIds, resolveMultiProjectPaneTabs } from './multi-project-layout'
import {
  getMultiProjectViewState,
  multiProjectViewActions,
  useMultiProjectViewState
} from './multi-project-view-store'
import { useMultiProjectSelectionSync } from './use-multi-project-selection-sync'
import { MultiProjectSplitNode, type MultiProjectSplitContext } from './MultiProjectSplitNode'
import type { MultiProjectPaneCallbacks } from './MultiProjectPaneView'

const NO_TABS: TerminalTab[] = []

/** Makes a pane's project and tab the app's active selection, so the sidebar follows the view. */
function activatePaneSelection(paneId: string, tabId: string | null): void {
  multiProjectViewActions.focusPane(paneId)
  const pane = getMultiProjectViewState().layout.panes[paneId]
  if (!pane?.worktreeId) {
    return
  }
  const store = useAppStore.getState()
  if (store.activeWorktreeId !== pane.worktreeId) {
    void activateWorktreeFromSidebar(pane.worktreeId)
  }
  if (tabId && useAppStore.getState().activeTabId !== tabId) {
    useAppStore.getState().setActiveTab(tabId)
    useAppStore.getState().setActiveTabType('terminal', pane.worktreeId)
  }
}

function useTerminalTabIdsByWorktree(worktreeIds: string[]): Record<string, string[]> {
  const tabsByWorktree = useAppStore((s) => s.tabsByWorktree)
  return useMemo(() => {
    const ids: Record<string, string[]> = {}
    for (const worktreeId of worktreeIds) {
      ids[worktreeId] = (tabsByWorktree[worktreeId] ?? NO_TABS).map((tab) => tab.id)
    }
    return ids
  }, [tabsByWorktree, worktreeIds])
}

export function MultiProjectWorkspace(): React.JSX.Element {
  const { layout } = useMultiProjectViewState()
  const [targetByPaneId, setTargetByPaneId] = useState<Record<string, HTMLElement>>({})
  const paneIds = useMemo(() => listMultiProjectPaneIds(layout.root), [layout.root])
  const worktreeIdsKey = paneIds
    .map((paneId) => layout.panes[paneId]?.worktreeId ?? '')
    .join('\u0000')
  const worktreeIds = useMemo(
    () => [...new Set(worktreeIdsKey.split('\u0000').filter(Boolean))],
    [worktreeIdsKey]
  )
  const tabIdsByWorktree = useTerminalTabIdsByWorktree(worktreeIds)
  const shownTabByPaneId = useMemo(
    () => resolveMultiProjectPaneTabs(layout, tabIdsByWorktree),
    [layout, tabIdsByWorktree]
  )
  const tabOwnerPaneIds = useMemo(() => {
    const owners: Record<string, string> = {}
    for (const [paneId, tabId] of Object.entries(shownTabByPaneId)) {
      if (tabId) {
        owners[tabId] = paneId
      }
    }
    return owners
  }, [shownTabByPaneId])

  useMultiProjectSelectionSync(layout, shownTabByPaneId, tabOwnerPaneIds)

  // Why: seed the first pane from the project the user was looking at when the view opened.
  useEffect(() => {
    const focused = layout.panes[layout.focusedPaneId]
    const { activeWorktreeId, activeTabId, activeTabType } = useAppStore.getState()
    if (focused && !focused.worktreeId && activeWorktreeId) {
      multiProjectViewActions.setPaneTarget(focused.id, {
        worktreeId: activeWorktreeId,
        tabId: activeTabType === 'terminal' ? activeTabId : null
      })
    }
  }, [layout])

  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const backgroundMountKey = paneIds
    .map((paneId) => `${layout.panes[paneId]?.worktreeId ?? ''}|${shownTabByPaneId[paneId] ?? ''}`)
    .join('\u0000')
  useEffect(() => {
    // Why: a project never opened this session has no mounted terminals to move into its pane.
    for (const entry of backgroundMountKey.split('\u0000')) {
      const [worktreeId, tabId] = entry.split('|')
      if (worktreeId && tabId && worktreeId !== activeWorktreeId) {
        requestBackgroundTerminalWorktreeMount({ worktreeId, tabIds: [tabId] })
      }
    }
  }, [activeWorktreeId, backgroundMountKey])

  const descriptors = useMemo(() => {
    const next: ActivityTerminalPortalTarget[] = []
    for (const paneId of paneIds) {
      const pane = layout.panes[paneId]
      const tabId = shownTabByPaneId[paneId]
      const target = targetByPaneId[paneId]
      if (!pane?.worktreeId || !tabId || !target) {
        continue
      }
      next.push({
        slotId: `multi-project:${paneId}`,
        requestToken: `multi-project:${paneId}:${tabId}`,
        target,
        worktreeId: pane.worktreeId,
        tabId,
        // Why null: a pane shows the whole terminal tab, including its own splits.
        paneKey: null,
        // Why one active pane: `active` arms Orca's terminal shortcuts, which need a single owner.
        active: paneId === layout.focusedPaneId
      })
    }
    return next
  }, [layout, paneIds, shownTabByPaneId, targetByPaneId])

  // oxlint-disable-next-line react-doctor/no-derived-state-effect -- Why: publishes portal targets to Terminal's external store before paint.
  useLayoutEffect(() => {
    setActivityTerminalPortals(descriptors)
  }, [descriptors])
  useLayoutEffect(() => () => setActivityTerminalPortals([]), [])

  const onTargetChange = useCallback((paneId: string, target: HTMLElement | null): void => {
    setTargetByPaneId((previous) => {
      if (target ? previous[paneId] === target : !(paneId in previous)) {
        return previous
      }
      const next = { ...previous }
      if (target) {
        next[paneId] = target
      } else {
        delete next[paneId]
      }
      return next
    })
  }, [])

  const callbacks = useMemo<MultiProjectPaneCallbacks>(() => {
    const openTerminalInPane = (paneId: string): void => {
      const worktreeId = getMultiProjectViewState().layout.panes[paneId]?.worktreeId
      if (!worktreeId) {
        return
      }
      const tabIdsBefore = new Set(
        (useAppStore.getState().tabsByWorktree[worktreeId] ?? NO_TABS).map((tab) => tab.id)
      )
      createNewTerminalTab(worktreeId)
      const created = (useAppStore.getState().tabsByWorktree[worktreeId] ?? NO_TABS).find(
        (tab) => !tabIdsBefore.has(tab.id)
      )
      // Why: remote runtimes create the tab asynchronously; the pane falls back to it once it lands.
      multiProjectViewActions.setPaneTarget(paneId, { worktreeId, tabId: created?.id ?? null })
      activatePaneSelection(paneId, created?.id ?? null)
    }
    return {
      onActivatePane: (paneId, tabId) =>
        activatePaneSelection(paneId, tabId === undefined ? shownTabByPaneId[paneId] : tabId),
      onSelectTab: (paneId, tabId) => {
        const pane = getMultiProjectViewState().layout.panes[paneId]
        multiProjectViewActions.setPaneTarget(paneId, {
          worktreeId: pane?.worktreeId ?? null,
          tabId
        })
        activatePaneSelection(paneId, tabId)
      },
      onNewTerminal: openTerminalInPane,
      onCloseTab: (tabId) => closeTerminalTab(tabId),
      onSplit: (paneId, direction) => {
        const worktreeId = getMultiProjectViewState().layout.panes[paneId]?.worktreeId
        const newPaneId = multiProjectViewActions.splitPane(paneId, direction)
        if (!newPaneId) {
          return
        }
        const freeTabId = worktreeId
          ? (tabIdsByWorktree[worktreeId] ?? []).find((tabId) => !tabOwnerPaneIds[tabId])
          : undefined
        // Why: a split should land on a usable terminal, so open one when every tab is already shown.
        if (worktreeId && !freeTabId) {
          openTerminalInPane(newPaneId)
          return
        }
        activatePaneSelection(newPaneId, freeTabId ?? null)
      },
      onClosePane: (paneId) => multiProjectViewActions.closePane(paneId),
      onTargetChange
    }
  }, [onTargetChange, shownTabByPaneId, tabIdsByWorktree, tabOwnerPaneIds])

  const context: MultiProjectSplitContext = {
    layout,
    shownTabByPaneId,
    tabOwnerPaneIds,
    canClosePanes: paneIds.length > 1,
    callbacks,
    onRatioChange: multiProjectViewActions.setSplitRatio
  }

  return (
    <div className="absolute inset-0 z-[5] flex min-h-0 min-w-0 bg-background p-1.5">
      <MultiProjectSplitNode node={layout.root} context={context} />
    </div>
  )
}
