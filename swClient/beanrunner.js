const path = require('path');
const Reconnect = require('net-socket-reconnect');
const FiveBeansWorker = require('fivebeans').worker;
const logger = require('./logger');

class FiveBeansRunner {
  constructor(id, config) {
    this.id = id;
    this.config = config;
    this.worker = null;
  }

  go() {
    const reconnServer = Reconnect({
      host: this.config.host,
      port: 11300,
      reconnectInterval: 5000,
      reconnectOnCreate: true,
      reconnectOnEnd: true,
      reconnectOnError: true,
      reconnectOnTimeout: true,
      reconnectTimes: 7000, // 5s*7000
    });

    reconnServer.on('connect', () => {
      logger.debug('queue client connect');
      this.worker = this.createWorker();
      this.worker.on('error', (err) => {
        this.handleClientClose.bind(this, err.message);
        reconnServer.startReconnect();
      });
    });

    reconnServer.on('close', this.handleClientClose.bind(this, 'close'));
    reconnServer.on('end', this.handleClientClose.bind(this, 'end'));
    reconnServer.on('timeout', this.handleClientClose.bind(this, 'timeout'));

    process.on('SIGINT', this.handleStop.bind(this));
    process.on('SIGQUIT', this.handleStop.bind(this));
    process.on('SIGHUP', this.handleStop.bind(this));

    process.on('SIGUSR2', () => {
      this.worker.on('stopped', () => {
        this.worker = this.createWorker();
      });
      this.worker.logInfo('received SIGUSR2; stopping & reloading configuration');
      this.worker.stop();
    });
  }

  createWorker() {
    const config = {
      host: this.config.host,
      handlers: {},
      ignoreDefault: true,
    };
    const dirprefix = __dirname;
    for (let i = 0, len = this.config.handlers.length; i < len; i += 1) {
      const tHanlders = require(path.resolve(dirprefix, this.config.handlers[i]));
      if (Array.isArray(tHanlders)) {
        tHanlders.forEach((th) => {
          config.handlers[th.type] = th;
        });
      } else if (tHanlders.type) {
        config.handlers[tHanlders.type] = tHanlders;
      }
    }
    const worker = new FiveBeansWorker(config);

    /*
    let { logLevel } = config;
    if (logLevel === 'info') {
      worker.on('info', console.log);
      logLevel = 'warning';
    }

    if (logLevel === 'warning') {
      worker.on('warning', console.warn);
      logLevel = 'error';
    }

    if (logLevel === 'error') worker.on('error', console.error);
    */

    worker.start(this.config.watch);
    return worker;
  }

  handleClientClose(closeEvent) {
    if (this.worker) {
      this.worker = null;
      delete this.worker;
    }
    logger.error(closeEvent, 'queue client connection closed');
  }

  handleStop() {
    if (this.worker) {
      this.worker.on('stopped', () => {
        process.exit(0);
      });
      this.worker.stop();
    } else {
      process.exit(0);
    }
    logger.debug('queue client connection stopped');
  }
}

module.exports = FiveBeansRunner;
