// Packaging identity of this fork, which installs beside upstream Orca.
// Keep in sync with src/shared/fork-edition.ts and config/nsis/orca-installer-hooks.nsh.
module.exports = {
  appId: 'com.villhell.orcagrid',
  productName: 'Orca Grid',
  executableName: 'OrcaGrid',
  // Why: the packaged package.json name becomes the userData folder (%APPDATA%\orca-grid).
  packageName: 'orca-grid',
  installerArtifactName: 'orca-grid-windows-setup.${ext}'
}
