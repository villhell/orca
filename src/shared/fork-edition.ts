/**
 * Identity of this fork's packaged build, which installs beside upstream Orca.
 * Why every value differs from upstream: a shared value lets one install overwrite,
 * kill or update the other. Keep in sync with config/fork-edition.cjs and
 * config/nsis/orca-installer-hooks.nsh.
 */
export const FORK_EDITION = {
  appName: 'Orca Grid',
  appUserModelId: 'com.villhell.orcagrid',
  // Why no space: this folder holds the relocated terminal daemon runtime.
  localAppDataRootName: 'OrcaGrid',
  // Why: upstream's feed would replace this fork with an upstream release.
  autoUpdateDisabled: true
} as const
