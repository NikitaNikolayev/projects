/* eslint no-console: 0 */
const childProcess = require('child_process');
const electron = require('electron');
const webpack = require('webpack');
const moment = require('moment');
const config = require('./appconf');

function colorError(msg) {
  return `\u001b[1m\u001b[31m${msg}\u001b[39m\u001b[22m`;
}

let compiler;
try {
  compiler = webpack(config('dev'));
} catch (err) {
  if (err instanceof webpack.WebpackOptionsValidationError) {
    console.error(colorError(err.message));
    process.exit(1);
  }
}
let electronStarted = false;

const watching = compiler.watch({}, (err, stats) => {
  if (!err && !stats.hasErrors() && !electronStarted) {
    electronStarted = true;

    childProcess
      .spawn(electron, ['--no-sandbox', 'src/main.js'], { stdio: 'inherit' })
      .on('close', () => {
        watching.close();
      });
  } else if (stats.hasErrors() > 0) {
    const clientStats = stats.toJson();
    console.error(colorError(clientStats.errors[0]));
  } else {
    console.error(`${moment().format('YYYY-MM-DD HH:mm:SS.sss')}: compiled successfully`);
  }
});

