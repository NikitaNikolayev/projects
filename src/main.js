const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { fork } = require('child_process');
const syncSingleWindowJob = require('./timerSyncJob/syncSWData');
const { autoUpdater } = require('electron-updater');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let swappMayLogin = false;
const devMode = true;

const DEFAULT_SWAPP_CONF = { cookie: '', cardpw: '' };
const DEFAULT_WELOAPP_CONF = { account: { name: '', username: '' }, accesstoken: '' };
const DEFAULT_SYNCJOB_CONF = { status: false, interval: 24, bizType: [] };

const DEFAULT_USERCONF = {
  swapp: DEFAULT_SWAPP_CONF,
  weloapp: DEFAULT_WELOAPP_CONF,
  welo_endpoint: 'https://openapi.welogix.cn',
  swapp_endpoint: 'https://swapp.singlewindow.cn',
  syncjob_config: DEFAULT_SYNCJOB_CONF,
};

global.g_sharedUserConf = DEFAULT_USERCONF;

autoUpdater.checkForUpdatesAndNotify();

function createWindow() {
  const mainWindowOpt = {
    width: 1024,
    height: 768,
    // transparent: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      preload: path.resolve(__dirname, 'rendererIpc', 'swapppreload.js'),
    },
  };
  const userConfPath = path.resolve(process.cwd(), 'weloswapp.json');
  try {
    const savedConf = JSON.parse(fs.readFileSync(userConfPath));
    Object.assign(global.g_sharedUserConf, savedConf);
  } catch (err) {
    global.g_sharedUserConf = DEFAULT_USERCONF;
  }
  // if (process.env.NODE_ENV !== 'production') {
  //   // global.g_sharedUserConf.welo_endpoint = 'http://openapi.welogix.cn';
  //   global.g_sharedUserConf.welo_endpoint = 'http://192.168.3.7:3031';
  // }
  mainWindow = new BrowserWindow(mainWindowOpt);
  global.mainWindow = mainWindow;
  // mainWindow.maximize();
  // Open the DevTools.
  // mainWindow.webContents.openDevTools(); // 浏览器调试
  mainWindow.on('close', () => {
    fs.writeFileSync(userConfPath, JSON.stringify(global.g_sharedUserConf));
  });
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const mainWebPage = mainWindow.webContents;
  const swappCookie = global.g_sharedUserConf.swapp.cookie;
  if (!swappCookie && !devMode) {
    mainWindow.loadURL(
      'https://app.singlewindow.cn/cas/login?service=https%3A%2F%2Fswapp.singlewindow.cn%2Fdeskserver%2Fj_spring_cas_security_check&_swCardF=1',
    );
    // mainWebPage.on('did-start-navigation', () => {});
    mainWebPage.on('did-navigate', async () => {
      if (swappMayLogin) {
        const pageCookies = await mainWebPage.session.cookies.get({
          domain: 'swapp.singlewindow.cn',
        });
        const jsessionCookie = pageCookies.find(pgck => pgck.name === 'JSESSIONID');
        if (jsessionCookie) {
          global.g_sharedUserConf.swapp.cookie = pageCookies
            .map(pgck => `${pgck.name}=${pgck.value}`)
            .join(';');
          mainWebPage.loadURL(
            url.format({
              protocol: 'file',
              pathname: path.resolve(__dirname, 'view', 'weloswapp.html'),
              slashes: true,
            }),
          );
          swappMayLogin = false;
        }
      }
    });
  } else {
    mainWebPage.loadURL(
      url.format({
        protocol: 'file',
        pathname: path.resolve(__dirname, 'view', 'weloswapp.html'),
        slashes: true,
      }),
    );
  }
  syncSingleWindowJob();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.on('swapp-channel', (ev, arg) => {
  if (arg.action === 'did-swlogin-click') {
    if (arg.payload.cardpw) {
      swappMayLogin = true;
      global.g_sharedUserConf.swapp.cardpw = arg.payload.cardpw;
    }
  } else if (arg.action === 'logout') {
    if (arg.whichapp === 'swapp') {
      global.g_sharedUserConf.swapp = DEFAULT_SWAPP_CONF;
    } else if (arg.whichapp === 'weloapp') {
      global.g_sharedUserConf.weloapp = DEFAULT_WELOAPP_CONF;
    }
  } else if (arg.action === 'renew-userconf') {
    if (arg.payload.swapp) {
      Object.assign(global.g_sharedUserConf.swapp, arg.payload.swapp);
    }
    if (arg.payload.weloapp) {
      Object.assign(global.g_sharedUserConf.weloapp, arg.payload.weloapp);
    }
    if (arg.payload.weloApiUrl) {
      global.g_sharedUserConf.welo_endpoint = arg.payload.weloApiUrl;
    }
    if (arg.payload.syncjobConfig) {
      Object.assign(global.g_sharedUserConf.syncjob_config, arg.payload.syncjobConfig.config);
      if (arg.payload.syncjobConfig.immediateStart) {
        syncSingleWindowJob();
      }
    }
  } else if (arg.action === 'refresh-swcookie') {
    const navWindowOpt = {
      show: true,
      modal: true,
      parent: mainWindow,
      webPreferences: {
        nodeIntegration: true,
        preload: path.resolve(__dirname, 'rendererIpc', 'swapppreload.js'),
      },
    };
    const swNavLoginWin = new BrowserWindow(navWindowOpt);
    swNavLoginWin.loadURL(
      'https://app.singlewindow.cn/cas/login?service=https%3A%2F%2Fswapp.singlewindow.cn%2Fdeskserver%2Fj_spring_cas_security_check&_swCardF=1',
    );
    swNavLoginWin.webContents.on('did-navigate', async () => {
      if (swappMayLogin) {
        const pageCookies = await swNavLoginWin.webContents.session.cookies.get({
          domain: 'swapp.singlewindow.cn',
        });
        const jsessionCookie = pageCookies.find(pgck => pgck.name === 'JSESSIONID');
        if (jsessionCookie) {
          const cookie = pageCookies.map(pgck => `${pgck.name}=${pgck.value}`).join(';');
          swappMayLogin = false;
          global.g_sharedUserConf.swapp.cookie = cookie;
          const passedEvent = ev;
          passedEvent.returnValue = cookie;
          swNavLoginWin.close();
          if (this.childPs) {
            this.childPs.send({ msg: 'swappConfig', data: global.g_sharedUserConf });
          }
          mainWindow.webContents.loadURL(
            url.format({
              protocol: 'file',
              pathname: path.resolve(__dirname, 'view', 'weloswapp.html'),
              slashes: true,
            }),
          );
          if (arg.syncJob) {
            syncSingleWindowJob();
          }
        }
      }
    });
  } else if (arg.action === 'fileProcs-start') {
    this.childPs = fork(path.resolve(__dirname, '..', 'swClient/swboot.js'), { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });

    this.childPs.stderr.on('data', () => {
      // console.log('stderr', data.toString());
    });
    this.childPs.stdout.pipe(process.stdout);
    this.childPs.stderr.pipe(process.stderr);
    this.childPs.on('exit', (code) => {
      ev.sender.send('swproxy-exit', code);
    });
    this.childPs.on('message', (m) => {
      if (m.type === 'log') {
        ev.sender.send('swproxy-msg', m.data);
      } else if (m.type === 'redirect') {
        global.mainWindow.webContents.send('sync-job', {
          action: 'cookie-expire',
          payload: { },
        });
        // console.log('PARENT got message:', m);
      }
    });
    this.childPs.send({ msg: 'swappConfig', data: global.g_sharedUserConf });
    ev.sender.send('swproxy-start');
  } else if (arg.action === 'fileProcs-stop') {
    this.childPs.send({ msg: 'KILL' });
  } else if (arg.action === 'sync-job-delay') {
    setTimeout(() => {
      if (global.g_sharedUserConf.syncjob_config.status) {
        global.mainWindow.webContents.send('sync-job', {
          action: 'cookie-expire',
          payload: { },
        });
      }
    }, 1000 * 60 * 5);
  }
});


ipcMain.on('app_version', (event) => {
  event.sender.send('app_version', { version: app.getVersion() });
});

ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});

// app.on('ready', () => {
//   alert('note')
// });

autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update_available');
});
autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update_downloaded');
});