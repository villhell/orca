import type { AgentPaneThread } from './activity-thread-types'

export const ACTIVITY_GRID_MAX_CELLS = 9

export type ActivityGridThreadRef = Pick<
  AgentPaneThread,
  'paneKey' | 'migrationUnsupportedPtyId'
> & {
  worktree: Pick<AgentPaneThread['worktree'], 'id' | 'displayName'>
  repo: Pick<NonNullable<AgentPaneThread['repo']>, 'displayName'> | null
  tab: Pick<AgentPaneThread['tab'], 'id'>
}

export type ActivityGridSelection<T extends ActivityGridThreadRef = AgentPaneThread> = {
  cells: T[]
  overflowCount: number
}

function activityGridSortKey(thread: ActivityGridThreadRef): string {
  return [thread.repo?.displayName ?? '', thread.worktree.displayName, thread.paneKey]
    .join('\u0000')
    .toLowerCase()
}

/**
 * Picks the agent panes the grid can portal at once.
 * Why one cell per tab: a portal moves the whole TerminalPane of a tab, so two
 * panes of the same tab cannot be shown in separate cells.
 */
export function selectActivityGridThreads<T extends ActivityGridThreadRef>({
  threads,
  tabsByWorktree,
  hasWorkspace,
  maxCells = ACTIVITY_GRID_MAX_CELLS
}: {
  threads: readonly T[]
  tabsByWorktree: Readonly<Record<string, readonly { id: string }[] | undefined>>
  hasWorkspace: (thread: T) => boolean
  maxCells?: number
}): ActivityGridSelection<T> {
  const seenTabIds = new Set<string>()
  const eligible: T[] = []
  for (const thread of threads) {
    if (seenTabIds.has(thread.tab.id) || thread.migrationUnsupportedPtyId !== undefined) {
      continue
    }
    const hasLiveTab = (tabsByWorktree[thread.worktree.id] ?? []).some(
      (tab) => tab.id === thread.tab.id
    )
    if (!hasLiveTab || !hasWorkspace(thread)) {
      continue
    }
    seenTabIds.add(thread.tab.id)
    eligible.push(thread)
  }
  // Why stable order (not recency): recency reshuffles cells on every agent turn and moves terminals under the cursor.
  eligible.sort((left, right) =>
    activityGridSortKey(left).localeCompare(activityGridSortKey(right))
  )
  const limit = Math.max(0, maxCells)
  return {
    cells: eligible.slice(0, limit),
    overflowCount: Math.max(0, eligible.length - limit)
  }
}

export function activityGridColumnCount(cellCount: number): number {
  if (cellCount <= 1) {
    return 1
  }
  return cellCount <= 4 ? 2 : 3
}
