import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { FORK_EDITION } from '../../shared/fork-edition'

/** Whether this build must never contact a release feed. */
export function isAutoUpdateUnavailable(): boolean {
  // Why the fork flag: the feeds point at upstream releases, which would replace this fork.
  return !app.isPackaged || is.dev || FORK_EDITION.autoUpdateDisabled
}
