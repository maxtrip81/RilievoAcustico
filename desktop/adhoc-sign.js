// macOS: senza un certificato Apple Developer l'app viene firmata "ad hoc",
// altrimenti sui Mac con Apple Silicon non si avvia.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin' || process.env.CSC_LINK) return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
};
