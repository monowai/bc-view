/* eslint-disable */
const { findIndex, has, remove } = require("ramda");

module.exports = {
  plugins: [
    {
      name: "typescript", // Required since Razzle >4.0.5. During yarn build, it causes "Can't resolve
      // '../node_modules/babel-preset-razzle/node_modules/@babel/runtime/regenerator'"
    },
    {
      name: "scss",
      options: {
        dev: {
          sourceMap: true,
          ident: "postcss",
        },
        prod: {
          sourceMap: false,
          ident: "postcss",
        },
        plugins: [
          require("postcss-flexbugs-fixes"),
          require("autoprefixer")({
            // overrideBrowserslist: ['>1%', 'last 4 versions', 'Firefox ESR', 'not ie < 9'],
            flexbox: "no-2009",
          }),
        ],
      },
    },
  ],
  modifyWebpackConfig({
    env: {
      target, // the target 'node' or 'web'
    },
    webpackConfig: config, // the created webpack config
  }) {
    const { module } = config;
    const { rules } = module;
    const fileLoaderIdx = findIndex((item) => {
      return has("exclude", item) && item.exclude.length > 10;
    }, rules);
    const fileLoader = rules[fileLoaderIdx];
    fileLoader.exclude = [...fileLoader.exclude, /\.woff$/, /\.woff2$/];
    const woffRule = {
      include: [/\.woff$/, /\.woff2$/],
      loader: require.resolve("file-loader"),
      options: {
        name: "static/media/[name].[ext]",
        emitFile: target === "web",
      },
    };

    return {
      ...config,
      module: {
        ...module,
        rules: [...remove(fileLoaderIdx, 1, rules), fileLoader, woffRule],
      },
    };
  },
};
