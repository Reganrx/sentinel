const { spawn } = require('node:child_process');
const path = require('node:path');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
if (process.argv[2]) env.SENTINEL_TEST_ENTRY = path.resolve(process.argv[2]);
const child = spawn(require('electron'), [path.join(__dirname, 'electron-navigation.cjs')], { env, stdio: 'inherit' });
const timeout = setTimeout(() => { console.error('Navigation test exceeded 90 seconds.'); child.kill(); process.exitCode = 1; }, 90_000);
child.on('error', error => { clearTimeout(timeout); console.error(error); process.exitCode = 1; });
child.on('exit', code => { clearTimeout(timeout); process.exitCode = code ?? 1; });
