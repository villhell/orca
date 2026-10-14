import { vi } from 'vitest'
import type * as ForkEditionModule from '../../src/shared/fork-edition'

// Why: unit suites cover the upstream updater flow; the fork's switch-off has its own test.
vi.mock('../../src/shared/fork-edition', async (importOriginal) => {
  const actual = await importOriginal<typeof ForkEditionModule>()
  return { FORK_EDITION: { ...actual.FORK_EDITION, autoUpdateDisabled: false } }
})
