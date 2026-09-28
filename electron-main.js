const { app, BrowserWindow } = require('electron');
const path = require('path');

process.env.PORT = '0';
const relay = require('./server.js');
let window;

function openGame() {
  const port = relay.srv.address().port;
  window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0b0f17',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });
  window.loadURL(`http://127.0.0.1:${port}/`);
  window.on('closed', () => { window = null; });
}

app.whenReady().then(() => {
  if (relay.srv.listening) openGame();
  else relay.srv.once('listening', openGame);
  app.on('activate', () => {
    if (!window) openGame();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (relay.srv.listening) relay.srv.close();
});
