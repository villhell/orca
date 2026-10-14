import React, { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { MultiProjectLayout, MultiProjectNode } from './multi-project-layout'
import { MultiProjectPaneView, type MultiProjectPaneCallbacks } from './MultiProjectPaneView'

export type MultiProjectSplitContext = {
  layout: MultiProjectLayout
  shownTabByPaneId: Readonly<Record<string, string | null>>
  tabOwnerPaneIds: Readonly<Record<string, string>>
  canClosePanes: boolean
  callbacks: MultiProjectPaneCallbacks
  onRatioChange: (splitId: string, ratio: number) => void
}

function SplitDivider({
  horizontal,
  containerRef,
  onDrag,
  onCommit
}: {
  horizontal: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
  onDrag: (ratio: number) => void
  onCommit: (ratio: number) => void
}): React.JSX.Element {
  const ratioAt = (event: React.PointerEvent): number | null => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return null
    }
    return horizontal
      ? (event.clientX - rect.left) / rect.width
      : (event.clientY - rect.top) / rect.height
  }
  return (
    <div
      role="separator"
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      className={cn(
        'shrink-0 bg-transparent hover:bg-ring/40',
        horizontal ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize'
      )}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          return
        }
        const ratio = ratioAt(event)
        if (ratio !== null) {
          onDrag(ratio)
        }
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId)
        const ratio = ratioAt(event)
        if (ratio !== null) {
          onCommit(ratio)
        }
      }}
    />
  )
}

export function MultiProjectSplitNode({
  node,
  context
}: {
  node: MultiProjectNode
  context: MultiProjectSplitContext
}): React.JSX.Element | null {
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Why local while dragging: persisting every pointer move would rewrite storage on each frame.
  const [dragRatio, setDragRatio] = useState<number | null>(null)

  if (node.kind === 'pane') {
    const pane = context.layout.panes[node.paneId]
    if (!pane) {
      return null
    }
    return (
      <MultiProjectPaneView
        pane={pane}
        shownTabId={context.shownTabByPaneId[pane.id] ?? null}
        focused={context.layout.focusedPaneId === pane.id}
        canClose={context.canClosePanes}
        tabOwnerPaneIds={context.tabOwnerPaneIds}
        callbacks={context.callbacks}
      />
    )
  }

  const horizontal = node.direction === 'horizontal'
  const ratio = Math.min(0.9, Math.max(0.1, dragRatio ?? node.ratio))
  return (
    <div
      ref={containerRef}
      className={cn('flex min-h-0 min-w-0 flex-1', horizontal ? 'flex-row' : 'flex-col')}
    >
      <div
        className="flex min-h-0 min-w-0 shrink-0 grow-0"
        style={{ flexBasis: `${ratio * 100}%` }}
      >
        <MultiProjectSplitNode node={node.first} context={context} />
      </div>
      <SplitDivider
        horizontal={horizontal}
        containerRef={containerRef}
        onDrag={setDragRatio}
        onCommit={(next) => {
          setDragRatio(null)
          context.onRatioChange(node.id, next)
        }}
      />
      <div className="flex min-h-0 min-w-0 flex-1">
        <MultiProjectSplitNode node={node.second} context={context} />
      </div>
    </div>
  )
}
