import React, { useCallback, useLayoutEffect, useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent } from '@/lib/agent-status'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { EventRepoBadge, ThreadAgentStateIndicator } from './activity-thread-controls'
import { activityGridColumnCount } from './activity-grid-threads'
import {
  useActivityTerminalLoadingLabel,
  useActivityTerminalPortalStatus
} from './activity-terminal-portal-status'
import type { AgentPaneThread } from './activity-thread-types'

function ActivityGridCell({
  thread,
  focused,
  onFocusCell,
  onTargetChange
}: {
  thread: AgentPaneThread
  focused: boolean
  onFocusCell: (paneKey: string) => void
  onTargetChange: (paneKey: string, target: HTMLElement | null) => void
}): React.JSX.Element {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const { paneKey } = thread
  useLayoutEffect(() => {
    onTargetChange(paneKey, target)
    return () => onTargetChange(paneKey, null)
  }, [onTargetChange, paneKey, target])
  const status = useActivityTerminalPortalStatus(target, paneKey)
  const showLoadingLabel = useActivityTerminalLoadingLabel(status !== 'ready')
  const focusCell = useCallback(() => onFocusCell(paneKey), [onFocusCell, paneKey])

  return (
    <section
      className={cn(
        'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border',
        focused ? 'border-ring ring-1 ring-ring' : 'border-border'
      )}
      onPointerDownCapture={focusCell}
      onFocusCapture={focusCell}
      data-activity-grid-pane-key={paneKey}
    >
      <header className="flex min-w-0 shrink-0 items-center gap-1.5 border-b border-border px-2 py-1">
        <ThreadAgentStateIndicator thread={thread} />
        <span className="inline-flex shrink-0">
          <AgentIcon agent={agentTypeToIconAgent(thread.agentType)} size={14} />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{thread.paneTitle}</span>
        <EventRepoBadge repo={thread.repo} />
        <span className="max-w-[10rem] shrink truncate text-xs text-muted-foreground">
          {thread.worktree.displayName}
        </span>
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-editor-surface">
        {/* Why: the workspace TerminalPane is moved here, not re-created, so the PTY keeps one owner. */}
        <div ref={setTarget} className="absolute inset-0 min-h-0 min-w-0" />
        {status === 'ready' ? null : (
          <div className="pointer-events-none absolute inset-0 z-10 bg-editor-surface" aria-hidden>
            {status === 'unavailable' || showLoadingLabel ? (
              <div className="ml-3 mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-background/85 px-2 py-1 text-xs text-muted-foreground shadow-xs">
                <span className="h-3 w-1.5 rounded-sm bg-muted-foreground/70" />
                <span>
                  {status === 'unavailable'
                    ? translate(
                        'auto.components.activity.ActivityPrototypePage.8de7c5beaa',
                        'Terminal unavailable'
                      )
                    : translate(
                        'auto.components.activity.ActivityPrototypePage.1b633f5c1e',
                        'Connecting terminal...'
                      )}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}

export function ActivityGridView({
  cells,
  overflowCount,
  focusedPaneKey,
  onFocusCell,
  onTargetChange
}: {
  cells: AgentPaneThread[]
  overflowCount: number
  focusedPaneKey: string | null
  onFocusCell: (paneKey: string) => void
  onTargetChange: (paneKey: string, target: HTMLElement | null) => void
}): React.JSX.Element {
  if (cells.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <LayoutGrid className="size-7" />
        {translate(
          'auto.components.activity.ActivityGridView.emptyGrid',
          'No live agent terminals to show in the grid.'
        )}
      </div>
    )
  }
  const columnCount = activityGridColumnCount(cells.length)
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 px-3 pt-2">
      <div
        className="grid min-h-0 flex-1 gap-2"
        style={{
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          gridAutoRows: 'minmax(0, 1fr)'
        }}
      >
        {cells.map((thread) => (
          <ActivityGridCell
            key={thread.paneKey}
            thread={thread}
            focused={thread.paneKey === focusedPaneKey}
            onFocusCell={onFocusCell}
            onTargetChange={onTargetChange}
          />
        ))}
      </div>
      {overflowCount > 0 ? (
        <p className="shrink-0 text-xs text-muted-foreground">
          {translate(
            'auto.components.activity.ActivityGridView.overflowCount',
            '{{value0}} more agents are not shown. Narrow the list filters to choose which appear.',
            { value0: overflowCount }
          )}
        </p>
      ) : null}
    </div>
  )
}
