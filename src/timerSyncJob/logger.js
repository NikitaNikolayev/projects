const bunyan = require('@scoop/bunyan');
const path = require('path');

const logger = bunyan.createLogger({
  name: 'SyncJob',
  streams: [
    {
      level: 'trace',
      path: path.resolve(process.cwd(), 'syncJob.log'),
    },
  ],
});

module.exports = logger;
