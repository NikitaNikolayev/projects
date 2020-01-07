// const co = require('co');
const fs = require('fs');
const path = require('path');
const superagent = require('superagent');
const logger = require('../logger.js');

class DownloadSasMessageHandler {
  constructor() {
    this.type = 'gloden_pass-send';
    this.swconfig = global.swconfig;
  }

  work(payload, callback) {
    const { filename, sendFlag } = payload;
    const { watchdirs, clientapp } = this.swconfig;
    let outbox;
    if (sendFlag === 'sas') {
      outbox = watchdirs.sas_outbox;
    } else if (sendFlag === 'nems') {
      outbox = watchdirs.nems_outbox;
    } else if (sendFlag === 'npts') {
      outbox = watchdirs.npts_outbox;
    } else if (sendFlag === 'nbhl') {
      outbox = watchdirs.nbhl_outbox;
    }
    (async () => {
      try {
        const openapiUrl = clientapp.openapi_url;
        const blbookMsgRes = await superagent
          .get(`${openapiUrl}/v1/sw/sas/message/file?token=${clientapp.token}&filename=${filename}`)
          .buffer();
        fs.writeFileSync(path.resolve(outbox, filename), blbookMsgRes.body);
        logger.info(filename, '报文已写入', outbox);
        callback('success');
      } catch (e) {
        logger.error(e.message);
        callback('release');
      }
    })();
  }
}

module.exports = DownloadSasMessageHandler;
