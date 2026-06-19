const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 420,
    minHeight: 700,
    title: 'Español 150',
    icon: path.join(__dirname, 'app/icon.svg'),
    frame: false, // Remove default OS frame for a custom native look
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('app/index.html');

  // Remove the default menu
  Menu.setApplicationMenu(null);
}

// IPC Handler for Window Controls
ipcMain.on('window-control', (event, action) => {
  switch (action) {
    case 'close':
      mainWindow.close();
      break;
    case 'minimize':
      mainWindow.minimize();
      break;
    case 'maximize':
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      break;
  }
});

// IPC Handler for Window States (Spotify-style Mini Mode)
ipcMain.on('set-window-state', (event, state) => {
  if (state === 'mini') {
    mainWindow.setSize(420, 700);
    mainWindow.setAlwaysOnTop(true, 'screen-saver'); // Stays above other windows
  } else {
    mainWindow.setSize(1000, 800);
    mainWindow.setAlwaysOnTop(false);
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
