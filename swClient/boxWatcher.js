const fs = require('fs');
const path = require('path');
const superagent = require('superagent');
const chokidar = require('chokidar');
const { CHOKIDAR_WATCHOPT } = require('./constant');
const logger = require('./logger.js');

function watchDir(dir, callback) {
  if (!dir) {
    return;
  }
  let wpath = dir;
  if (dir[0] === '.') {
    wpath = path.resolve(__dirname, dir);
  }
  logger.debug('begin watch', wpath);
  const watcher = chokidar.watch(dir, CHOKIDAR_WATCHOPT);
  watcher.on('add', (newfilepath) => {
    // logger.info(dir, 'watcher add', newfilepath);
    // logger.info('watcher add', newfilepath);
    const filenames = newfilepath.split(path.sep);
    const filename = filenames[filenames.length - 1];
    logger.info(filename, '回执读取自', dir);
    fs.readFile(newfilepath, (error, filedata) => {
      if (!error) {
        callback(newfilepath, filename, filedata, dir);
      } else {
        logger.error(error.message);
      }
    });
  });
}
function watchOutBoxDir(dirs, callback) {
  for (let i = 0; i < dirs.length; i += 1) {
    const dir = dirs[i];
    let wpath = dir;
    if (dir[0] === '.') {
      wpath = path.resolve(__dirname, dir);
    }
    logger.debug('begin watch outbox', wpath);
    const watcher = chokidar.watch(dir, CHOKIDAR_WATCHOPT);
    watcher.on('add', (newfilepath) => {
      logger.info(dir, 'watcher add', newfilepath);
      callback(newfilepath, 'add');
    });
    watcher.on('unlink', (newfilepath) => {
      logger.info(dir, 'watcher unlink', newfilepath);
      callback(newfilepath, 'unlink');
    });
  }
}
function postSwReturnFile(url, boxbackupdir, newfilepath, filename, filedata) {
  const agent = superagent.post(url)
    .type('xml');
  if (filedata.indexOf('encoding="GB2312"') > 0) {
    agent.set('xml-encoding', 'GB2312');
  }
  agent.send(filedata)
    .end((error) => {
      if (!error) {
        if (boxbackupdir) {
          if (!fs.existsSync(boxbackupdir)) {
            fs.mkdirSync(boxbackupdir);
          }
          const mvfilepath = path.resolve(boxbackupdir, filename);
          fs.renameSync(newfilepath, mvfilepath);
        }
      } else {
        logger.error(error.message);
      }
    });
}

module.exports = (swconfig, edocWatch) => {
  const { watchdirs, clientapp } = swconfig;
  const openapiUrl = clientapp.openapi_url;
  const JG2InboxCallBack = (newfilepath, filename, filedata, dir) => {
    const url = `${openapiUrl}/v1/sw/jg2/inbox/return/${filename}?token=${clientapp.token}`;
    postSwReturnFile(url, `${dir}_backup`, newfilepath, filename, filedata);
  };
  const JG2FailboxCallBack = (newfilepath, filename, filedata, dir) => {
    const url = `${openapiUrl}/v1/sw/jg2/failbox/return/${filename}?token=${clientapp.token}`;
    postSwReturnFile(url, `${dir}_backup`, newfilepath, filename, filedata);
  };
  const JG2OutboxCallBack = (newfilepath, type) => {
    const filenames = newfilepath.split(path.sep);
    const filename = filenames[filenames.length - 1];
    const changeStatus = type === 'add' ? 'swclient_written' : 'swapp_read';
    const agent = superagent.post(`${openapiUrl}/v1/sw/jg2/outbox/returnmsg`);
    agent.send({ token: clientapp.token, filename, changeStatus }).end();
  };
  watchDir(watchdirs.inbox, (newfilepath, filename, filedata, dir) => {
    const url = `${openapiUrl}/v1/sw/dec/inbox/return/${filename}?token=${clientapp.token}`;
    postSwReturnFile(url, `${dir}_backup`, newfilepath, filename, filedata);
  });
  watchDir(watchdirs.failbox, (newfilepath, filename, filedata, dir) => {
    const url = `${openapiUrl}/v1/sw/dec/failbox/return/${filename}?token=${clientapp.token}`;
    postSwReturnFile(url, `${dir}_backup`, newfilepath, filename, filedata);
  });
  watchDir(watchdirs.sas_inbox, JG2InboxCallBack);
  watchDir(watchdirs.sas_failbox, JG2FailboxCallBack);
  watchDir(watchdirs.nems_inbox, JG2InboxCallBack);
  watchDir(watchdirs.nems_failbox, JG2FailboxCallBack);
  watchDir(watchdirs.npts_inbox, JG2InboxCallBack);
  watchDir(watchdirs.npts_failbox, JG2FailboxCallBack);
  watchDir(watchdirs.nbhl_inbox, JG2InboxCallBack);
  watchDir(watchdirs.nbhl_failbox, JG2FailboxCallBack);
  const outBoxList = [
    watchdirs.sas_outbox, watchdirs.nems_outbox, watchdirs.npts_outbox, watchdirs.nbhl_outbox,
  ];
  watchOutBoxDir(outBoxList, JG2OutboxCallBack);
  // watchOutBoxDir(outBoxList, 'unlink', clientapp);
  if (edocWatch) {
    watchDir(watchdirs.edoc_inbox, (/* newfilepath, filedata */) => {
    //  superagent.post(`${}/v1/sw/edoc/inbox/return`)
    });
    watchDir(watchdirs.edoc_failbox, (/* newfilepath, filedata */) => {
    // superagent.post(`${}/v1/sw/edoc/failbox/return`)
    });
  }
};
