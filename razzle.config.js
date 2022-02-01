/* eslint-disable */
const { findIndex, has, remove } = require("ramda");

module.exports = {
  options: {
    // https://razzlejs.org/docs/customization
    verbose: false,
  },
  plugins: [
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
            production: [
              ">0.2%",
              "not dead",
              "not ie <= 11",
              "not op_mini all",
              "not safari < 12",
              "not kaios <= 2.5",
              "not edge < 79",
              "not chrome < 70",
              "not and_uc < 13",
              "not samsung < 10",
            ],
            development: [
              "last 1 chrome version",
              "last 1 firefox version",
              "last 1 safari version",
            ],
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
