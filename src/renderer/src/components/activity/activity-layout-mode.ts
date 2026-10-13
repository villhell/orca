import { useSyncExternalStore } from 'react'

export type ActivityLayoutMode = 'list' | 'grid'

const ACTIVITY_LAYOUT_MODE_STORAGE_KEY = 'orca.activity.layoutMode'

function readStoredActivityLayoutMode(): ActivityLayoutMode {
  try {
    return globalThis.localStorage?.getItem(ACTIVITY_LAYOUT_MODE_STORAGE_KEY) === 'grid'
      ? 'grid'
      : 'list'
  } catch {
    return 'list'
  }
}

let currentMode: ActivityLayoutMode | null = null
const subscribers = new Set<() => void>()

function getActivityLayoutMode(): ActivityLayoutMode {
  currentMode ??= readStoredActivityLayoutMode()
  return currentMode
}

export function setActivityLayoutMode(mode: ActivityLayoutMode): void {
  if (getActivityLayoutMode() === mode) {
    return
  }
  currentMode = mode
  try {
    globalThis.localStorage?.setItem(ACTIVITY_LAYOUT_MODE_STORAGE_KEY, mode)
  } catch {
    // Why: storage can be unavailable; the in-memory mode still applies for this session.
  }
  for (const subscriber of subscribers) {
    subscriber()
  }
}

function subscribeActivityLayoutMode(onStoreChange: () => void): () => void {
  subscribers.add(onStoreChange)
  return () => {
    subscribers.delete(onStoreChange)
  }
}

// Why module state: the titlebar toggle and the Activity page are separate React trees.
export function useActivityLayoutMode(): ActivityLayoutMode {
  return useSyncExternalStore(
    subscribeActivityLayoutMode,
    getActivityLayoutMode,
    getActivityLayoutMode
  )
}
