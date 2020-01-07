const { ipcRenderer, remote } = require('electron');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

module.exports = {
  requireUserConf: () => {
    const userConfData = remote.getGlobal('g_sharedUserConf');
    return userConfData;
  },
  saveUserConf: (swapp, weloapp, weloApiUrl, syncjobConfig) => {
    ipcRenderer.send('swapp-channel', {
      action: 'renew-userconf',
      payload: { swapp, weloapp, weloApiUrl, syncjobConfig },
    });
  },
  refreshSwappCookie: () => {
    const newcookie = ipcRenderer.sendSync('swapp-channel', { action: 'refresh-swcookie' });
    return newcookie;
  },
  logoutIpc: (whichapp) => {
    ipcRenderer.send('swapp-channel', {
      action: 'logout',
      payload: { whichapp },
    });
  },
  startSwFileProcedure: () => {
    ipcRenderer.send('swapp-channel', {
      action: 'fileProcs-start',
      payload: { },
    });
  },
  stopSwFileProcedure: () => {
    ipcRenderer.send('swapp-channel', {
      action: 'fileProcs-stop',
      payload: { },
    });
  },
  loadSwProxyYml: () => {
    const filePath = path.resolve(process.cwd(), 'swconfig.yml');
    const isExist = fs.existsSync(filePath);
    let configData;
    if (isExist) {
      configData = yaml.load(fs.readFileSync(filePath, 'utf8'));
    } else { // 创建默认配置文件
      configData = {
        host: 'openapi.welogix.co',
        handlers: ['./declHandlers', './sasblHandlers', './swReconcileHandlers'],
        watchtube: ['swclient-queue'],
        watchdirs: {
          inbox: 'C:\\ImpPath\\DecCus001\\InBox',
          outbox: 'C:\\ImpPath\\DecCus001\\OutBox',
          sentbox: 'C:\\ImpPath\\DecCus001\\SentBox',
          failbox: 'C:\\ImpPath\\DecCus001\\FailBox',
          edoc_inbox: 'C:\\ImpPath\\DecCus001\\EdocInBox',
          edoc_outbox: 'C:\\ImpPath\\DecCus001\\EdocOutBox',
          edoc_sentbox: 'C:\\ImpPath\\DecCus001\\EdocSentBox',
          edoc_failbox: 'C:\\ImpPath\\DecCus001\\EdocFailBox',
          sas_inbox: 'C:\\ImpPath\\Sas\\InBox',
          sas_outbox: 'C:\\ImpPath\\Sas\\OutBox',
          sas_sentbox: 'C:\\ImpPath\\Sas\\SentBox',
          sas_failbox: 'C:\\ImpPath\\Sas\\FailBox',
          nems_inbox: 'C:\\ImpPath\\Nems\\InBox',
          nems_outbox: 'C:\\ImpPath\\Nems\\OutBox',
          nems_sentbox: 'C:\\ImpPath\\Nems\\SentBox',
          nems_failbox: 'C:\\ImpPath\\Nems\\FailBox',
          npts_inbox: 'C:\\ImpPath\\Npts\\InBox',
          npts_outbox: 'C:\\ImpPath\\Npts\\OutBox',
          npts_sentbox: 'C:\\ImpPath\\Npts\\SentBox',
          npts_failbox: 'C:\\ImpPath\\Npts\\FailBox',
          nbhl_inbox: 'C:\\ImpPath\\Nbhl\\InBox',
          nbhl_outbox: 'C:\\ImpPath\\Nbhl\\OutBox',
          nbhl_sentbox: 'C:\\ImpPath\\Nbhl\\SentBox',
          nbhl_failbox: 'C:\\ImpPath\\Nbhl\\FailBox',
        },
        clientapp: {
          openapi_url: 'https://openapi.welogix.cn',
        },
      };
      fs.writeFileSync(filePath, yaml.dump(configData));
    }
    return configData;
  },
  beginSwProxyListen: (swproxyclientCallback) => {
    ipcRenderer.on('swproxy-exit', (event, arg) => {
      swproxyclientCallback({
        log_level: 30,
        created_date: new Date(),
        log_content: `子进程退出，退出码 ${arg}`,
      }, false);
    });
    ipcRenderer.on('swproxy-msg', (event, arg) => {
      swproxyclientCallback(arg, true);
    });
    ipcRenderer.on('swproxy-start', () => {
      swproxyclientCallback(null, true);
    });
  },
  beginSyncJobListen: (swCookieCallback, nonAccessCallback) => {
    ipcRenderer.on('sync-job', (ev, arg) => {
      if (arg.action === 'cookie-expire') {
        swCookieCallback(
          () => {
            ipcRenderer.sendSync('swapp-channel', { action: 'refresh-swcookie', syncJob: true });
          },
          () => {
            ipcRenderer.send('swapp-channel', {
              action: 'sync-job-delay',
              payload: { },
            });
          }
        );
      } else if (arg.action === 'req-error') {
        nonAccessCallback();
      }
    });
  },
  saveSwProxyConfig: (newConfig) => {
    const filePath = path.resolve(process.cwd(), 'swconfig.yml');
    fs.writeFileSync(filePath, yaml.dump(newConfig));
  },
};
