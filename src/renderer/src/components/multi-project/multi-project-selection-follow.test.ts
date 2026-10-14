import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: vi.fn() }))

const { decideMultiProjectSelectionFollow } = await import('./use-multi-project-selection-sync')
const { createMultiProjectLayout, splitMultiProjectPane } = await import('./multi-project-layout')

// Left pane shows hq, right pane (focused) shows vtuber.
const layout = splitMultiProjectPane(
  createMultiProjectLayout({ id: 'left', worktreeId: 'hq', tabId: 'hq-1' }),
  'left',
  'horizontal',
  { id: 'right', worktreeId: 'vtuber', tabId: 'vt-1' },
  'split'
)
const shownTabByPaneId = { left: 'hq-1', right: 'vt-1' }
const tabOwnerPaneIds = { 'hq-1': 'left', 'vt-1': 'right' }

function follow(
  previous: { activeWorktreeId: string | null; activeTabId: string | null },
  current: { activeWorktreeId: string | null; activeTabId: string | null }
) {
  return decideMultiProjectSelectionFollow({
    previous,
    current: { ...current, activeTabType: 'terminal' },
    layout,
    shownTabByPaneId,
    tabOwnerPaneIds
  })
}

describe('decideMultiProjectSelectionFollow', () => {
  it('retargets the focused pane when another project is picked in the sidebar', () => {
    expect(
      follow(
        { activeWorktreeId: 'vtuber', activeTabId: 'vt-1' },
        { activeWorktreeId: 'blog', activeTabId: 'blog-1' }
      )
    ).toEqual({ kind: 'retarget', paneId: 'right', worktreeId: 'blog', tabId: 'blog-1' })
  })

  it('does not bounce back while a pane focus is still activating its project', () => {
    expect(
      follow(
        { activeWorktreeId: 'hq', activeTabId: 'hq-1' },
        { activeWorktreeId: 'hq', activeTabId: 'hq-1' }
      )
    ).toEqual({ kind: 'none' })
    expect(
      follow(
        { activeWorktreeId: 'hq', activeTabId: 'hq-1' },
        { activeWorktreeId: 'vtuber', activeTabId: 'vt-1' }
      )
    ).toEqual({ kind: 'none' })
  })

  it('moves a newly chosen tab of the focused project into the focused pane', () => {
    expect(
      follow(
        { activeWorktreeId: 'vtuber', activeTabId: 'vt-1' },
        { activeWorktreeId: 'vtuber', activeTabId: 'vt-2' }
      )
    ).toEqual({ kind: 'retarget', paneId: 'right', worktreeId: 'vtuber', tabId: 'vt-2' })
  })

  it('focuses the pane that already shows the chosen tab instead of duplicating it', () => {
    const decision = decideMultiProjectSelectionFollow({
      previous: { activeWorktreeId: 'vtuber', activeTabId: 'vt-1' },
      current: { activeWorktreeId: 'vtuber', activeTabId: 'vt-9', activeTabType: 'terminal' },
      layout,
      shownTabByPaneId,
      tabOwnerPaneIds: { ...tabOwnerPaneIds, 'vt-9': 'left' }
    })
    expect(decision).toEqual({ kind: 'focus', paneId: 'left' })
  })
})
