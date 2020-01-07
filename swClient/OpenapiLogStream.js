const superagent = require('superagent');

const FAIL_RESETNT_INTEVAL_MS = 1000 * 60;
const STARTUP_INTERVAL_MS = 1000 * 10;
const HEARTBEAT_INTERVAL_MS = 1000 * 60 * 30;
const LOG_BUFFER_LIMIT = 20;

class OpenapiLogStream {
  constructor() {
    this.recordsBuffer = []; // 日志缓冲
    this.lastSendTimestamp = Date.now();
    this.timeoutId = setTimeout(() => {
      this.sendHeartbeatLog();
    }, STARTUP_INTERVAL_MS);
  }

  sendHeartbeatLog() {
    this.logger.debug({ type: 'heartBeat' }, '💓 beating...');
  }

  sendBufferedLogs() {
    const { clientapp } = global.swconfig;
    const openapiUrl = clientapp.openapi_url;
    superagent.post(`${openapiUrl}/v1/sw/client/log?token=${clientapp.token}`)
      .type('application/json')
      .send(this.recordsBuffer)
      .end((err) => {
        if (err) {
          if ((Date.now() - this.lastSendTimestamp) > FAIL_RESETNT_INTEVAL_MS) {
            this.lastSendTimestamp = Date.now();
            this.logger.error(err.message);
          }
        } else {
          this.recordsBuffer = [];
        }
        clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => {
          this.sendHeartbeatLog();
        }, HEARTBEAT_INTERVAL_MS); // 设置定时任务
      });
  }

  write(rec) {
    const log = {
      log_hostname: rec.hostname,
      log_pid: rec.pid,
      log_content: rec.msg,
      log_level: rec.level,
      created_date: rec.time,
    };
    if (rec.type === 'heartBeat') {
      log.log_content = 'heartBeat';
    }
    const { recordsBuffer } = this;
    recordsBuffer.push(log);
    process.send({ type: 'log', data: log }); // 发送日志到父进程
    if (rec.type === 'heartBeat') {
      this.sendBufferedLogs();
    } else if (recordsBuffer.length >= LOG_BUFFER_LIMIT) {
      this.sendBufferedLogs();
    }
  }

  setLogger(logger) {
    this.logger = logger;
  }
}

module.exports = OpenapiLogStream;
