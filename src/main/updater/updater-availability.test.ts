import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as ForkEditionModule from '../../shared/fork-edition'

vi.mock('electron', () => ({ app: { isPackaged: true } }))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('../../shared/fork-edition')
})

describe('isAutoUpdateUnavailable', () => {
  it('ships the fork with auto-update switched off', async () => {
    const { FORK_EDITION } = await vi.importActual<typeof ForkEditionModule>(
      '../../shared/fork-edition'
    )
    expect(FORK_EDITION.autoUpdateDisabled).toBe(true)
  })

  it('keeps a packaged fork build away from the release feed', async () => {
    vi.doMock('../../shared/fork-edition', () => ({ FORK_EDITION: { autoUpdateDisabled: true } }))
    const { isAutoUpdateUnavailable } = await import('./updater-availability')
    expect(isAutoUpdateUnavailable()).toBe(true)
  })

  it('leaves a packaged build updatable when the fork switch is off', async () => {
    vi.doMock('../../shared/fork-edition', () => ({ FORK_EDITION: { autoUpdateDisabled: false } }))
    const { isAutoUpdateUnavailable } = await import('./updater-availability')
    expect(isAutoUpdateUnavailable()).toBe(false)
  })
})
