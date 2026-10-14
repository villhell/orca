/** Split layout of the multi-project view: every pane shows one terminal tab of any project. */

export type MultiProjectSplitDirection = 'horizontal' | 'vertical'

export type MultiProjectPane = {
  id: string
  worktreeId: string | null
  tabId: string | null
}

export type MultiProjectNode =
  | { kind: 'pane'; paneId: string }
  | {
      kind: 'split'
      id: string
      direction: MultiProjectSplitDirection
      ratio: number
      first: MultiProjectNode
      second: MultiProjectNode
    }

export type MultiProjectLayout = {
  root: MultiProjectNode
  panes: Record<string, MultiProjectPane>
  focusedPaneId: string
}

const MIN_SPLIT_RATIO = 0.1
const MAX_SPLIT_RATIO = 0.9

export function createMultiProjectLayout(pane: MultiProjectPane): MultiProjectLayout {
  return {
    root: { kind: 'pane', paneId: pane.id },
    panes: { [pane.id]: pane },
    focusedPaneId: pane.id
  }
}

export function listMultiProjectPaneIds(node: MultiProjectNode): string[] {
  return node.kind === 'pane'
    ? [node.paneId]
    : [...listMultiProjectPaneIds(node.first), ...listMultiProjectPaneIds(node.second)]
}

function replaceNode(
  node: MultiProjectNode,
  match: (candidate: MultiProjectNode) => boolean,
  replace: (candidate: MultiProjectNode) => MultiProjectNode | null
): MultiProjectNode | null {
  if (match(node)) {
    return replace(node)
  }
  if (node.kind === 'pane') {
    return node
  }
  const first = replaceNode(node.first, match, replace)
  const second = replaceNode(node.second, match, replace)
  // Why: a split that lost a child collapses so its surviving child takes the whole space.
  if (!first) {
    return second
  }
  if (!second) {
    return first
  }
  return first === node.first && second === node.second ? node : { ...node, first, second }
}

export function splitMultiProjectPane(
  layout: MultiProjectLayout,
  paneId: string,
  direction: MultiProjectSplitDirection,
  newPane: MultiProjectPane,
  splitId: string
): MultiProjectLayout {
  if (!layout.panes[paneId] || layout.panes[newPane.id]) {
    return layout
  }
  const root = replaceNode(
    layout.root,
    (node) => node.kind === 'pane' && node.paneId === paneId,
    (node) => ({
      kind: 'split',
      id: splitId,
      direction,
      ratio: 0.5,
      first: node,
      second: { kind: 'pane', paneId: newPane.id }
    })
  )
  return root
    ? { root, panes: { ...layout.panes, [newPane.id]: newPane }, focusedPaneId: newPane.id }
    : layout
}

export function closeMultiProjectPane(
  layout: MultiProjectLayout,
  paneId: string
): MultiProjectLayout {
  const paneIds = listMultiProjectPaneIds(layout.root)
  // Why: the view always keeps one pane so there is somewhere to show the selected project.
  if (paneIds.length <= 1 || !layout.panes[paneId]) {
    return layout
  }
  const root = replaceNode(
    layout.root,
    (node) => node.kind === 'pane' && node.paneId === paneId,
    () => null
  )
  if (!root) {
    return layout
  }
  const panes = { ...layout.panes }
  delete panes[paneId]
  const closedIndex = paneIds.indexOf(paneId)
  const remaining = listMultiProjectPaneIds(root)
  const focusedPaneId =
    layout.focusedPaneId === paneId
      ? (remaining[Math.max(0, closedIndex - 1)] ?? remaining[0])
      : layout.focusedPaneId
  return { root, panes, focusedPaneId }
}

export function focusMultiProjectPane(
  layout: MultiProjectLayout,
  paneId: string
): MultiProjectLayout {
  return layout.panes[paneId] && layout.focusedPaneId !== paneId
    ? { ...layout, focusedPaneId: paneId }
    : layout
}

export function setMultiProjectPaneTarget(
  layout: MultiProjectLayout,
  paneId: string,
  target: { worktreeId: string | null; tabId: string | null }
): MultiProjectLayout {
  const pane = layout.panes[paneId]
  if (!pane || (pane.worktreeId === target.worktreeId && pane.tabId === target.tabId)) {
    return layout
  }
  return { ...layout, panes: { ...layout.panes, [paneId]: { ...pane, ...target } } }
}

export function setMultiProjectSplitRatio(
  layout: MultiProjectLayout,
  splitId: string,
  ratio: number
): MultiProjectLayout {
  const clamped = Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio))
  const root = replaceNode(
    layout.root,
    (node) => node.kind === 'split' && node.id === splitId,
    (node) => (node.kind === 'split' && node.ratio !== clamped ? { ...node, ratio: clamped } : node)
  )
  return root && root !== layout.root ? { ...layout, root } : layout
}

/**
 * The tab a pane shows: its own tab while that tab is open and not shown by an
 * earlier pane, otherwise the first open tab no other pane shows.
 * Why unique: a terminal portals into one place, so two panes cannot show the same tab.
 */
export function resolveMultiProjectPaneTabs(
  layout: MultiProjectLayout,
  terminalTabIdsByWorktree: Readonly<Record<string, readonly string[] | undefined>>
): Record<string, string | null> {
  const shown = new Set<string>()
  const resolved: Record<string, string | null> = {}
  const paneIds = listMultiProjectPaneIds(layout.root)
  // Why two passes: a pane keeps its chosen tab before any fallback can claim it.
  for (const paneId of paneIds) {
    const pane = layout.panes[paneId]
    const tabIds = pane?.worktreeId ? (terminalTabIdsByWorktree[pane.worktreeId] ?? []) : []
    if (pane?.tabId && tabIds.includes(pane.tabId) && !shown.has(pane.tabId)) {
      shown.add(pane.tabId)
      resolved[paneId] = pane.tabId
    }
  }
  for (const paneId of paneIds) {
    if (resolved[paneId] !== undefined) {
      continue
    }
    const pane = layout.panes[paneId]
    const tabIds = pane?.worktreeId ? (terminalTabIdsByWorktree[pane.worktreeId] ?? []) : []
    const fallback = tabIds.find((tabId) => !shown.has(tabId)) ?? null
    if (fallback) {
      shown.add(fallback)
    }
    resolved[paneId] = fallback
  }
  return resolved
}

function parseNode(value: unknown, depth: number): MultiProjectNode | null {
  if (!value || typeof value !== 'object' || depth > 32) {
    return null
  }
  const record = value as Record<string, unknown>
  if (record.kind === 'pane') {
    return typeof record.paneId === 'string' ? { kind: 'pane', paneId: record.paneId } : null
  }
  if (
    record.kind !== 'split' ||
    typeof record.id !== 'string' ||
    (record.direction !== 'horizontal' && record.direction !== 'vertical') ||
    typeof record.ratio !== 'number' ||
    !Number.isFinite(record.ratio)
  ) {
    return null
  }
  const first = parseNode(record.first, depth + 1)
  const second = parseNode(record.second, depth + 1)
  if (!first || !second) {
    return null
  }
  const ratio = Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, record.ratio))
  return { kind: 'split', id: record.id, direction: record.direction, ratio, first, second }
}

function parsePane(id: string, value: unknown): MultiProjectPane | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const worktreeId = typeof record.worktreeId === 'string' ? record.worktreeId : null
  const tabId = typeof record.tabId === 'string' ? record.tabId : null
  return { id, worktreeId, tabId }
}

/** Restores a persisted layout, or null when it is unreadable. */
export function parseMultiProjectLayout(value: unknown): MultiProjectLayout | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const root = parseNode(record.root, 0)
  const rawPanes = record.panes
  if (!root || !rawPanes || typeof rawPanes !== 'object') {
    return null
  }
  const paneIds = listMultiProjectPaneIds(root)
  if (new Set(paneIds).size !== paneIds.length) {
    return null
  }
  const panes: Record<string, MultiProjectPane> = {}
  for (const paneId of paneIds) {
    const pane = parsePane(paneId, (rawPanes as Record<string, unknown>)[paneId])
    if (!pane) {
      return null
    }
    panes[paneId] = pane
  }
  const focusedPaneId =
    typeof record.focusedPaneId === 'string' && panes[record.focusedPaneId]
      ? record.focusedPaneId
      : paneIds[0]
  return { root, panes, focusedPaneId }
}
