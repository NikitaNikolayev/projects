exports.CHOKIDAR_WATCHOPT = {
  ignoreInitial: false,
  followSymlinks: false,
  awaitWriteFinish: {
    stabilityThreshold: 4000,
    pollInterval: 500,
  },
  depth: 2,
  usePolling: true,
  interval: 1000,
};
