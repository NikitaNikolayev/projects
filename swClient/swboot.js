const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const BeanRunner = require('./beanrunner');
const boxWatch = require('./boxWatcher');
const logger = require('./logger');

const fname = path.resolve(process.cwd(), 'swconfig.yml');
const swconfig = yaml.load(fs.readFileSync(fname, 'utf8'));
global.swconfig = swconfig;

const runner = new BeanRunner('sw-task', {
  host: swconfig.host,
  watch: swconfig.watchtube,
  handlers: swconfig.handlers,
});
runner.go();
boxWatch(swconfig);
process.on('uncaughtException', (err) => {
  logger.error(err, '未捕获异常，重启代理');
  runner.handleStop().then(() => {
    runner.go();
  }).catch(() => {
    runner.go();
  });
});
process.on('message', (parm) => {
  if (parm.msg === 'KILL') {
    logger.info(parm.msg, 'client closed');
    runner.handleStop();
  } else if (parm.msg === 'swappConfig') {
    global.swappConfig = parm.data;
  }
});
