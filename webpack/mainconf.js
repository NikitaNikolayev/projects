const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  target: 'electron-main',
  mode: 'production',
  devtool: 'source-map',
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, '..', 'src'),
    filename: 'main.prod.js',
  },
  plugins: [
    new webpack.DefinePlugin({ 'global.GENTLY': false })
  ],
  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true,
        sourceMap: true,
        cache: true,
      }),
    ],
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};
