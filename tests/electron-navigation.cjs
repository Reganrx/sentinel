const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-navigation-test-')));
app.disableHardwareAcceleration();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const deadline = (promise, label, ms = 8000) => Promise.race([
  promise,
  new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: renderer stopped responding`)), ms);
    timer.unref();
  }),
]);
app.whenReady().then(async () => {
  // This test must never send commands to the user's backend or providers.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_, cb) => cb({ cancel: true }));
  const win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { contextIsolation: true, backgroundThrottling: false } });
  const entry = process.env.SENTINEL_TEST_ENTRY || path.resolve('dist/index.html');
  const js = code => deadline(win.webContents.executeJavaScript(code), code.slice(0, 70));
  try {
    await win.loadFile(entry);
    await js(`localStorage.setItem('sentinel-startup-sequence', 'false'); sessionStorage.setItem('sentinel-boot-complete', 'true');`);
    await win.loadFile(entry);
    await delay(1000);
    const pages = ['Network Centre', 'Settings', 'Home', 'Audio Control', 'Chat', 'Concierge', 'Design', 'Mission Control', 'Navigation', 'Notifications', 'System', 'Travel', 'Weather', 'Home'];
    for (let cycle = 0; cycle < 2; cycle++) {
      win.setSize(cycle === 0 ? 1440 : 1100, cycle === 0 ? 900 : 700);
      for (const label of pages) {
        console.log(`NAVIGATE ${cycle + 1}: ${label}`);
        const clicked = await js(`(() => {const b = [...document.querySelectorAll('.sidebar-nav button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!b) return false; b.click(); return true})()`);
        if (!clicked) throw new Error(`Missing sidebar button: ${label}`);
        let loaded = false;
        for (let attempt = 0; attempt < 30; attempt++) {
          await delay(100);
          const state = await js(`({loading: !!document.querySelector('.page-loading'), enhanced: !!document.querySelector('.network-centre-tabs'), error: !!document.querySelector('.page-error-boundary'), active: document.querySelector('.sidebar-nav button.active')?.textContent.trim()})`);
          if (state.error) throw new Error(`Page error boundary shown: ${label}`);
          if (!state.loading && state.active === label && (label !== 'Network Centre' || state.enhanced)) { loaded = true; break; }
        }
        if (!loaded) throw new Error(`Page did not finish loading: ${label}`);
        await delay(150);
        await js('document.body.clientHeight');
        if (label === 'Home') {
          const spaced = await js(`(() => {const command = document.querySelector('#sentinel-quick-chat-host .quick-command-shell')?.getBoundingClientRect(); const cards = document.querySelector('.home-actions')?.getBoundingClientRect(); return !!command && !!cards && command.bottom + 5 <= cards.top;})()`);
          if (!spaced) throw new Error('Home command bar overlaps shortcuts');
        }
      }
    }
    console.log('PASS: 28 real Electron page transitions, no renderer stall or error boundary.');
    app.exit(0);
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    app.exit(1);
  }
}).catch(error => { console.error(error); app.exit(1); });
