// const co = require('co');
const fs = require('fs');
const path = require('path');
const superagent = require('superagent');
const logger = require('../logger.js');

class DownloadDecMessageHandler {
  constructor() {
    this.type = 'decmessage-send';
    this.swconfig = global.swconfig;
  }

  work(payload, callback) {
    const { filename } = payload;
    const { watchdirs, clientapp } = this.swconfig;
    (async () => {
      try {
        const openapiUrl = clientapp.openapi_url;
        const decMsgRes = await superagent
          .get(`${openapiUrl}/v1/sw/dec/message/file?token=${clientapp.token}&filename=${filename}`)
          .buffer();
        // logger.info(decMsgRes && decMsgRes.body);
        // zip => res.body  xml => res.text body: {}
        fs.writeFileSync(
          path.resolve(watchdirs.outbox, filename),
          decMsgRes.text || decMsgRes.body,
        );
        logger.info(filename, '报文已写入', watchdirs.outbox);
        // logger.info(`${filename} write to ${watchdirs.outbox}`);
        callback('success');
      } catch (e) {
        logger.error(e.message);
        callback('release');
      }
    })();
    /*
    co(function* handler() {
      const { watchdirs, clientapp } = this.swconfig;
      const openapiUrl = clientapp.openapi_url;
      const decMsgRes = yield superagent
        .get(`${openapiUrl}/v1/sw/dec/message/file?token=${clientapp.token}&filename=${filename}`)
        .buffer();
      console.log(decMsgRes);
      fs.writeFileSync(path.resolve(watchdirs.outbox, filename), decMsgRes.text);
      console.log(`${filename} write to ${watchdirs.outbox}`);
      callback('success');
    }).catch((e) => {
      console.log(e);
      callback('release');
    });
    */
  }
}

module.exports = DownloadDecMessageHandler;
