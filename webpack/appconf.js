const path = require('path');
const merge = require('webpack-merge');
const baseConf = require('./baseconf');

module.exports = env => merge(baseConf(env), {
  entry: {
    client: './src/view/vindex.jsx',
  },
  output: {
    filename: 'prod.js',
    path: path.resolve(__dirname, '..', 'release', 'dist'),
    // libraryTarget: 'commonjs2',
  },
});
