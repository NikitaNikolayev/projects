const developmentEnvironments = ['development', 'test'];

/*
const productionPlugins = [
  require('babel-plugin-dev-expression'),

  // babel-preset-react-optimize
  require('@babel/plugin-transform-react-constant-elements'),
  require('@babel/plugin-transform-react-inline-elements'),
  require('babel-plugin-transform-react-remove-prop-types')
];
*/

module.exports = (api) => {
  // see docs about api at https://babeljs.io/docs/en/config-files#apicache

  const development = api.env(developmentEnvironments);

  return {
    presets: [
      [
        require('@babel/preset-env'),
        {
          targets: { electron: require('electron/package.json').version },
          useBuiltIns: 'usage',
          corejs: 3,
        },
      ],
      // require('@babel/preset-flow'),
      [require('@babel/preset-react'), { development }],
    ],
    plugins: [
      [require('@babel/plugin-proposal-class-properties'), { loose: true }],
    ],
  };
};
