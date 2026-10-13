import { describe, expect, it } from 'vitest'
import {
  activityGridColumnCount,
  selectActivityGridThreads,
  type ActivityGridThreadRef
} from './activity-grid-threads'

const thread = (
  repo: string,
  worktree: string,
  tabId: string,
  leafId = 'leaf-1',
  migrationUnsupportedPtyId?: string
): ActivityGridThreadRef => ({
  paneKey: `${tabId}:${leafId}`,
  repo: { displayName: repo },
  worktree: { id: `wt-${worktree}`, displayName: worktree },
  tab: { id: tabId },
  migrationUnsupportedPtyId
})

const liveTabs = (...pairs: [worktree: string, tabId: string][]) => {
  const tabsByWorktree: Record<string, { id: string }[]> = {}
  for (const [worktree, tabId] of pairs) {
    ;(tabsByWorktree[`wt-${worktree}`] ??= []).push({ id: tabId })
  }
  return tabsByWorktree
}

const everyWorkspace = (): boolean => true

describe('selectActivityGridThreads', () => {
  it('orders cells by repo and workspace so agent turns do not reshuffle the grid', () => {
    const selection = selectActivityGridThreads({
      threads: [thread('web', 'main', 'tab-3'), thread('api', 'fix', 'tab-1')],
      tabsByWorktree: liveTabs(['main', 'tab-3'], ['fix', 'tab-1']),
      hasWorkspace: everyWorkspace
    })
    expect(selection.cells.map((cell) => cell.paneKey)).toEqual(['tab-1:leaf-1', 'tab-3:leaf-1'])
  })

  it('keeps one cell per tab because a portal moves the whole terminal tab', () => {
    const selection = selectActivityGridThreads({
      threads: [thread('api', 'fix', 'tab-1', 'leaf-1'), thread('api', 'fix', 'tab-1', 'leaf-2')],
      tabsByWorktree: liveTabs(['fix', 'tab-1']),
      hasWorkspace: everyWorkspace
    })
    expect(selection.cells.map((cell) => cell.paneKey)).toEqual(['tab-1:leaf-1'])
  })

  it('skips closed tabs, unknown workspaces and panes that cannot be portaled', () => {
    const selection = selectActivityGridThreads({
      threads: [
        thread('api', 'closed', 'tab-closed'),
        thread('api', 'gone', 'tab-gone'),
        thread('api', 'legacy', 'tab-legacy', 'leaf-1', 'pty-1'),
        thread('api', 'live', 'tab-live')
      ],
      tabsByWorktree: liveTabs(
        ['gone', 'tab-gone'],
        ['legacy', 'tab-legacy'],
        ['live', 'tab-live']
      ),
      hasWorkspace: (candidate) => candidate.worktree.id !== 'wt-gone'
    })
    expect(selection.cells.map((cell) => cell.paneKey)).toEqual(['tab-live:leaf-1'])
  })

  it('reports how many eligible agents did not fit', () => {
    const threads = ['a', 'b', 'c'].map((name) => thread('repo', name, `tab-${name}`))
    const selection = selectActivityGridThreads({
      threads,
      tabsByWorktree: liveTabs(['a', 'tab-a'], ['b', 'tab-b'], ['c', 'tab-c']),
      hasWorkspace: everyWorkspace,
      maxCells: 2
    })
    expect(selection.cells).toHaveLength(2)
    expect(selection.overflowCount).toBe(1)
  })
})

describe('activityGridColumnCount', () => {
  it('uses one column for one cell, two up to four cells, then three', () => {
    expect([1, 2, 4, 5, 9].map(activityGridColumnCount)).toEqual([1, 2, 2, 3, 3])
  })
})
