import React, { useLayoutEffect, useState } from 'react'
import { Columns2, Plus, Rows2, TerminalSquare, X } from 'lucide-react'
import { useAppStore } from '@/store'
import { getRepoMapFromState, getWorktreeMapFromState } from '@/store/selectors'
import { resolveWorktreeDisplayName } from '@/lib/worktree-default-display-name'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { resolveTerminalTabTitle } from '../../../../shared/tab-title-resolution'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { EventRepoBadge } from '../activity/activity-thread-controls'
import type { MultiProjectPane, MultiProjectSplitDirection } from './multi-project-layout'

const NO_TABS: TerminalTab[] = []

export type MultiProjectPaneCallbacks = {
  onActivatePane: (paneId: string, tabId?: string | null) => void
  onSelectTab: (paneId: string, tabId: string) => void
  onNewTerminal: (paneId: string) => void
  onCloseTab: (tabId: string) => void
  onSplit: (paneId: string, direction: MultiProjectSplitDirection) => void
  onClosePane: (paneId: string) => void
  onTargetChange: (paneId: string, target: HTMLElement | null) => void
}

function HeaderIconButton({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" onClick={onClick} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function PaneTabStrip({
  pane,
  tabs,
  shownTabId,
  tabOwnerPaneIds,
  callbacks
}: {
  pane: MultiProjectPane
  tabs: TerminalTab[]
  shownTabId: string | null
  tabOwnerPaneIds: Readonly<Record<string, string>>
  callbacks: MultiProjectPaneCallbacks
}): React.JSX.Element {
  const generatedTitlesEnabled = useAppStore((s) => s.settings?.tabAutoGenerateTitle === true)
  const fallbackTitle = translate('auto.components.multiProject.terminalTab', 'Terminal')
  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
      {tabs.map((tab) => {
        const ownerPaneId = tabOwnerPaneIds[tab.id]
        const isShownHere = tab.id === shownTabId
        const isShownElsewhere = ownerPaneId !== undefined && ownerPaneId !== pane.id
        return (
          <div
            key={tab.id}
            className={cn(
              'group flex max-w-[12rem] shrink-0 items-center rounded-sm text-xs',
              isShownHere ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60'
            )}
          >
            <button
              type="button"
              className={cn('min-w-0 truncate px-2 py-0.5 text-left', isShownElsewhere && 'italic')}
              onClick={() =>
                isShownElsewhere
                  ? callbacks.onActivatePane(ownerPaneId)
                  : callbacks.onSelectTab(pane.id, tab.id)
              }
            >
              {resolveTerminalTabTitle(tab, generatedTitlesEnabled, fallbackTitle)}
            </button>
            <button
              type="button"
              className="mr-1 hidden rounded-sm p-0.5 hover:bg-accent group-hover:block"
              onClick={() => callbacks.onCloseTab(tab.id)}
              aria-label={translate('auto.components.multiProject.closeTab', 'Close tab')}
            >
              <X className="size-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function MultiProjectPaneView({
  pane,
  shownTabId,
  focused,
  canClose,
  tabOwnerPaneIds,
  callbacks
}: {
  pane: MultiProjectPane
  shownTabId: string | null
  focused: boolean
  canClose: boolean
  tabOwnerPaneIds: Readonly<Record<string, string>>
  callbacks: MultiProjectPaneCallbacks
}): React.JSX.Element {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const { onTargetChange } = callbacks
  const paneId = pane.id
  useLayoutEffect(() => {
    onTargetChange(paneId, target)
    return () => onTargetChange(paneId, null)
  }, [onTargetChange, paneId, target])

  const worktree = useAppStore((s) =>
    pane.worktreeId ? getWorktreeMapFromState(s).get(pane.worktreeId) : undefined
  )
  const repo = useAppStore((s) =>
    worktree ? (getRepoMapFromState(s).get(worktree.repoId) ?? null) : null
  )
  const tabs = useAppStore((s) =>
    pane.worktreeId ? (s.tabsByWorktree[pane.worktreeId] ?? NO_TABS) : NO_TABS
  )
  const activate = (): void => callbacks.onActivatePane(paneId)

  let emptyMessage: string | null = null
  if (!pane.worktreeId) {
    emptyMessage = translate(
      'auto.components.multiProject.noProject',
      'Select a project in the sidebar to show it here.'
    )
  } else if (!worktree) {
    emptyMessage = translate(
      'auto.components.multiProject.missingProject',
      'This project is not available.'
    )
  } else if (!shownTabId) {
    emptyMessage = translate(
      'auto.components.multiProject.noTerminal',
      'No terminal is open for this project here.'
    )
  }

  return (
    <section
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border',
        focused ? 'border-ring ring-1 ring-ring' : 'border-border'
      )}
      onPointerDownCapture={activate}
      onFocusCapture={activate}
      data-multi-project-pane-id={paneId}
    >
      <header className="flex min-w-0 shrink-0 items-center gap-1.5 border-b border-border px-1.5 py-1">
        <EventRepoBadge repo={repo} />
        <span className="max-w-[10rem] shrink-0 truncate text-xs font-medium">
          {worktree
            ? resolveWorktreeDisplayName(worktree)
            : translate('auto.components.multiProject.noProjectLabel', 'No project')}
        </span>
        <PaneTabStrip
          pane={pane}
          tabs={tabs}
          shownTabId={shownTabId}
          tabOwnerPaneIds={tabOwnerPaneIds}
          callbacks={callbacks}
        />
        {worktree ? (
          <HeaderIconButton
            label={translate('auto.components.multiProject.newTerminal', 'New terminal')}
            onClick={() => callbacks.onNewTerminal(paneId)}
          >
            <Plus className="size-3.5" />
          </HeaderIconButton>
        ) : null}
        <HeaderIconButton
          label={translate('auto.components.multiProject.splitRight', 'Split right')}
          onClick={() => callbacks.onSplit(paneId, 'horizontal')}
        >
          <Columns2 className="size-3.5" />
        </HeaderIconButton>
        <HeaderIconButton
          label={translate('auto.components.multiProject.splitDown', 'Split down')}
          onClick={() => callbacks.onSplit(paneId, 'vertical')}
        >
          <Rows2 className="size-3.5" />
        </HeaderIconButton>
        {canClose ? (
          <HeaderIconButton
            label={translate('auto.components.multiProject.closePane', 'Close pane')}
            onClick={() => callbacks.onClosePane(paneId)}
          >
            <X className="size-3.5" />
          </HeaderIconButton>
        ) : null}
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-editor-surface">
        {/* Why: the project's existing TerminalPane is moved here, so its PTY keeps one owner. */}
        <div ref={setTarget} className="absolute inset-0 min-h-0 min-w-0" />
        {emptyMessage ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-editor-surface p-4 text-center text-sm text-muted-foreground">
            <TerminalSquare className="size-7" />
            <span>{emptyMessage}</span>
            {worktree && !shownTabId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => callbacks.onNewTerminal(paneId)}
              >
                {translate('auto.components.multiProject.openTerminal', 'Open terminal')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
