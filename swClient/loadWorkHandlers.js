const fs = require('fs');
const path = require('path');

function loadHandlers(currDir) {
  const handlers = [];
  fs.readdirSync(currDir).forEach((file) => {
    const extIndex = file.lastIndexOf('.');
    if (file !== 'index.js' && extIndex > 0) {
      const fpath = path.resolve(currDir, file);
      const stat = fs.statSync(fpath);
      if (stat.isFile()) {
        const HandlerCls = require(fpath);
        const handler = new HandlerCls();
        handlers.push(handler);
      }
    }
  });
  return handlers;
}

module.exports = loadHandlers;
