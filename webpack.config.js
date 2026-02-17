const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

/** @type {import('webpack').Configuration} */
const extensionConfig = {
    target: 'node',
    mode: 'none',
    entry: './src/extension.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2'
    },
    externals: {
        vscode: 'commonjs vscode'
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: [/node_modules/, /src\/test/],
                use: [
                    {
                        loader: 'ts-loader'
                    }
                ]
            }
        ]
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: 'resources', to: 'resources' }
            ]
        })
    ],
    devtool: 'nosources-source-map',
    infrastructureLogging: {
        level: 'log'
    }
};

// Note: Webview HTML is embedded in BlockEditorProvider.ts
// so a separate webview build is not needed

module.exports = extensionConfig;
