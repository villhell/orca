import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import type { MultiProjectLayout } from './multi-project-layout'
import { multiProjectViewActions } from './multi-project-view-store'

type AppSelection = {
  activeWorktreeId: string | null
  activeTabId: string | null
  activeTabType: string | null
}

export type MultiProjectSelectionFollow =
  | { kind: 'none' }
  | { kind: 'retarget'; paneId: string; worktreeId: string; tabId: string | null }
  | { kind: 'focus'; paneId: string }

/**
 * How the view follows a selection made outside it (sidebar click, shortcut, agent row).
 * Why only on change: focusing a pane activates its own project first, so reacting to a
 * standing mismatch would bounce the pane back to the previously active project.
 */
export function decideMultiProjectSelectionFollow({
  previous,
  current,
  layout,
  shownTabByPaneId,
  tabOwnerPaneIds
}: {
  previous: Pick<AppSelection, 'activeWorktreeId' | 'activeTabId'>
  current: AppSelection
  layout: MultiProjectLayout
  shownTabByPaneId: Readonly<Record<string, string | null>>
  tabOwnerPaneIds: Readonly<Record<string, string>>
}): MultiProjectSelectionFollow {
  const focused = layout.panes[layout.focusedPaneId]
  const { activeWorktreeId, activeTabId } = current
  if (!focused || !activeWorktreeId) {
    return { kind: 'none' }
  }
  const terminalTabId = current.activeTabType === 'terminal' ? activeTabId : null
  if (activeWorktreeId !== previous.activeWorktreeId) {
    // Why: a sidebar click retargets the focused pane instead of swapping the whole view.
    return focused.worktreeId === activeWorktreeId
      ? { kind: 'none' }
      : { kind: 'retarget', paneId: focused.id, worktreeId: activeWorktreeId, tabId: terminalTabId }
  }
  if (
    activeTabId === previous.activeTabId ||
    !terminalTabId ||
    focused.worktreeId !== activeWorktreeId ||
    shownTabByPaneId[focused.id] === terminalTabId
  ) {
    return { kind: 'none' }
  }
  const ownerPaneId = tabOwnerPaneIds[terminalTabId]
  return ownerPaneId
    ? { kind: 'focus', paneId: ownerPaneId }
    : { kind: 'retarget', paneId: focused.id, worktreeId: activeWorktreeId, tabId: terminalTabId }
}

export function useMultiProjectSelectionSync(
  layout: MultiProjectLayout,
  shownTabByPaneId: Readonly<Record<string, string | null>>,
  tabOwnerPaneIds: Readonly<Record<string, string>>
): void {
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const activeTabType = useAppStore((s) => s.activeTabType)
  const previousRef = useRef({ activeWorktreeId, activeTabId })

  useEffect(() => {
    const previous = previousRef.current
    previousRef.current = { activeWorktreeId, activeTabId }
    const follow = decideMultiProjectSelectionFollow({
      previous,
      current: { activeWorktreeId, activeTabId, activeTabType },
      layout,
      shownTabByPaneId,
      tabOwnerPaneIds
    })
    if (follow.kind === 'retarget') {
      multiProjectViewActions.setPaneTarget(follow.paneId, {
        worktreeId: follow.worktreeId,
        tabId: follow.tabId
      })
    } else if (follow.kind === 'focus') {
      multiProjectViewActions.focusPane(follow.paneId)
    }
  }, [activeTabId, activeTabType, activeWorktreeId, layout, shownTabByPaneId, tabOwnerPaneIds])
}
