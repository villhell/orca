import { ArrowLeft, Bell, LayoutGrid, Rows3 } from 'lucide-react'

import { useAppStore } from '@/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useActivityUnreadCount } from './useActivityUnreadCount'
import { translate } from '@/i18n/i18n'
import {
  setActivityLayoutMode,
  useActivityLayoutMode,
  type ActivityLayoutMode
} from './activity-layout-mode'

function ActivityLayoutModeButton({
  mode,
  activeMode,
  label
}: {
  mode: ActivityLayoutMode
  activeMode: ActivityLayoutMode
  label: string
}): React.JSX.Element {
  const Icon = mode === 'grid' ? LayoutGrid : Rows3
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={mode === activeMode ? 'secondary' : 'ghost'}
          size="icon-xs"
          onClick={() => setActivityLayoutMode(mode)}
          aria-label={label}
          aria-pressed={mode === activeMode}
        >
          <Icon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function ActivityTitlebarControls(): React.JSX.Element {
  const unreadCount = useActivityUnreadCount()
  const closeActivityPage = useAppStore((s) => s.closeActivityPage)
  const layoutMode = useActivityLayoutMode()

  return (
    <div className="flex h-full min-w-0 flex-1 items-center gap-3 border-l border-border px-3">
      <div
        className="flex min-w-0 items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Why: Activity hides the worktree sidebar (full-page surface), so the
            sidebar's nav row isn't available as the back path. This Back button
            is the dedicated exit, mirroring Settings' onBack pattern. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={closeActivityPage}
              aria-label={translate(
                'auto.components.activity.ActivityTitlebarControls.dc708f3eff',
                'Close agents'
              )}
            >
              <ArrowLeft className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {translate(
              'auto.components.activity.ActivityTitlebarControls.dc708f3eff',
              'Close agents'
            )}
          </TooltipContent>
        </Tooltip>
        <Bell className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-medium">
          {translate('auto.components.activity.ActivityTitlebarControls.d6a8de3934', 'agents')}
        </span>
        <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">
          {unreadCount}{' '}
          {translate('auto.components.activity.ActivityTitlebarControls.f915168c8e', 'unread')}
        </Badge>
      </div>
      <div
        className="ml-auto flex shrink-0 items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <ActivityLayoutModeButton
          mode="list"
          activeMode={layoutMode}
          label={translate(
            'auto.components.activity.ActivityTitlebarControls.listLayout',
            'Show one agent at a time'
          )}
        />
        <ActivityLayoutModeButton
          mode="grid"
          activeMode={layoutMode}
          label={translate(
            'auto.components.activity.ActivityTitlebarControls.gridLayout',
            'Show agents side by side'
          )}
        />
      </div>
    </div>
  )
}
