const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (_env, argv) => {
    const isProduction = argv.mode === 'production';
    return {
    entry: './src/index.tsx',
    devtool: isProduction ? 'source-map' : 'inline-source-map',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'main.js',
        clean: true,
        devtoolModuleFilenameTemplate: info => `file:///${info.absoluteResourcePath.replace(/\\/g, '/')}`,
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html',
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: './guide.md', to: 'guide.md' },
                { from: './guide-assets', to: 'guide-assets' },
            ],
        }),
    ],
    devServer: {
        static: path.resolve(__dirname, 'dist'),
        hot: true,
        open: true,
        port: 3000,
        allowedHosts: "all"
    },
    };
};
