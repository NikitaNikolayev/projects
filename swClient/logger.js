const bunyan = require('@scoop/bunyan');
const path = require('path');
const OpenApiLogStream = require('./OpenapiLogStream');

const ApiLogStream = new OpenApiLogStream();
const logger = bunyan.createLogger({
  name: 'SwClient',
  streams: [
    {
      level: 'trace',
      stream: process.stdout,
    },
    {
      level: 'trace',
      type: 'raw',
      stream: ApiLogStream,
    },
    {
      level: 'trace',
      path: path.resolve(process.cwd(), 'singleWindow.log'),
    },
  ],
});

ApiLogStream.setLogger(logger);

module.exports = logger;
