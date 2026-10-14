import { describe, expect, it } from 'vitest'
import {
  closeMultiProjectPane,
  createMultiProjectLayout,
  listMultiProjectPaneIds,
  parseMultiProjectLayout,
  resolveMultiProjectPaneTabs,
  setMultiProjectPaneTarget,
  setMultiProjectSplitRatio,
  splitMultiProjectPane,
  type MultiProjectLayout
} from './multi-project-layout'

const pane = (id: string, worktreeId: string | null = null, tabId: string | null = null) => ({
  id,
  worktreeId,
  tabId
})

function threePanes(): MultiProjectLayout {
  // a | (b / c)
  let layout = createMultiProjectLayout(pane('a', 'hq', 'hq-1'))
  layout = splitMultiProjectPane(layout, 'a', 'horizontal', pane('b', 'vtuber', 'vt-1'), 's1')
  return splitMultiProjectPane(layout, 'b', 'vertical', pane('c', 'hq'), 's2')
}

describe('multi-project layout', () => {
  it('splits a pane in either direction and focuses the new pane', () => {
    const layout = threePanes()
    expect(listMultiProjectPaneIds(layout.root)).toEqual(['a', 'b', 'c'])
    expect(layout.focusedPaneId).toBe('c')
    expect(layout.root).toMatchObject({
      kind: 'split',
      direction: 'horizontal',
      second: { kind: 'split', direction: 'vertical' }
    })
  })

  it('collapses the split when a pane closes and moves focus to its neighbour', () => {
    const closed = closeMultiProjectPane(threePanes(), 'c')
    expect(listMultiProjectPaneIds(closed.root)).toEqual(['a', 'b'])
    expect(closed.focusedPaneId).toBe('b')
    expect(closed.panes.c).toBeUndefined()
  })

  it('never closes the last pane', () => {
    const single = createMultiProjectLayout(pane('a'))
    expect(closeMultiProjectPane(single, 'a')).toBe(single)
  })

  it('retargets a pane to another project and keeps the ratio within bounds', () => {
    const retargeted = setMultiProjectPaneTarget(threePanes(), 'a', {
      worktreeId: 'vtuber',
      tabId: 'vt-2'
    })
    expect(retargeted.panes.a).toEqual(pane('a', 'vtuber', 'vt-2'))
    const resized = setMultiProjectSplitRatio(retargeted, 's1', 2)
    expect(resized.root).toMatchObject({ ratio: 0.9 })
  })

  it('shows each terminal tab in at most one pane, letting a pane keep its chosen tab', () => {
    const shown = resolveMultiProjectPaneTabs(threePanes(), {
      hq: ['hq-1', 'hq-2'],
      vtuber: ['vt-1']
    })
    // c has no tab of its own, so it takes the first hq tab that a is not already showing.
    expect(shown).toEqual({ a: 'hq-1', b: 'vt-1', c: 'hq-2' })
  })

  it('leaves a pane empty when every tab of its project is already shown', () => {
    const shown = resolveMultiProjectPaneTabs(threePanes(), { hq: ['hq-1'], vtuber: ['vt-1'] })
    expect(shown.c).toBeNull()
  })

  it('falls back to an open tab when the chosen tab was closed', () => {
    const shown = resolveMultiProjectPaneTabs(threePanes(), { hq: ['hq-9'], vtuber: [] })
    expect(shown).toEqual({ a: 'hq-9', b: null, c: null })
  })

  it('round-trips through storage and rejects damaged layouts', () => {
    const layout = threePanes()
    expect(parseMultiProjectLayout(JSON.parse(JSON.stringify(layout)))).toEqual(layout)
    expect(parseMultiProjectLayout({ root: { kind: 'pane', paneId: 'x' }, panes: {} })).toBeNull()
    expect(parseMultiProjectLayout('nope')).toBeNull()
  })
})
