const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = env => {
  return {
    mode: env.production ? 'production' : 'development',
    entry: './src/index.ts',
    output: {
      filename: 'index.js',
      path: path.resolve(__dirname, 'dist'),
      library: 'rx_socketio_client',
      libraryTarget: 'umd',
      globalObject: 'this',
    },
    devtool: env.production ? false : 'cheap-module-eval-source-map',
    plugins: [new CleanWebpackPlugin()],
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'ts-loader'
            },
          ],
        },
      ],
    },
    resolve: {
      extensions: [ '.tsx', '.ts', '.js' ],
      // TODO
      // alias: {
      //   'rxjs/operators': 'rxjs',
      // },
    },
    optimization: env.production ? {
      minimize: true,
      minimizer: [new TerserPlugin()],
    } : {},
    externals: {
      'socket.io-client': {
        root: 'io',
        commonjs: 'socket.io-client',
        commonjs2: 'socket.io-client',
        amd: 'socket.io-client',
      },
      'rxjs': 'rxjs',
      'rxjs/operators': {
        root: ['rxjs', 'operators'],
        commonjs: 'rxjs/operators',
        commonjs2: 'rxjs/operators',
        amd: 'rxjs/operators',
      },
    },
  };
};
