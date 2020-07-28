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
            library: 'avcore',
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
            'axios': {
                root: 'axios',
                commonjs: 'axios',
                commonjs2: 'axios',
                amd: 'axios',
            },
        },
    };
};
