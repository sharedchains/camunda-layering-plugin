const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const ZipPlugin = require('zip-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './client/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'client.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react']
          }
        }
      }, {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      { test: /\.(png|svg|jpe?g|gif|woff2?|ttf|eot)$/, use: ['file-loader'] }
    ]
  },
  resolve: {
    alias: {
      react: 'camunda-modeler-plugin-helpers/react'
    },
    fallback: {
      'util': false,
      'assert': false
    }
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: 'style/style.css',
          to: 'assets/styles'
        },
        {
          from: path.resolve(__dirname, './index.prod.js'),
          to: path.resolve(__dirname, './dist/index.js')
        }
      ],
    }),
    new ZipPlugin({
      filename: 'camunda-layering-plugin-' + process.env.npm_package_version + '.zip',
      pathPrefix: 'camunda-layering-plugin/',
      pathMapper: function(assetPath) {
        if (assetPath.startsWith('client') || assetPath.startsWith('style')) {
          return path.join(path.dirname(assetPath), 'client', path.basename(assetPath));
        }
        return assetPath;
      }
    })
  ],
  devtool: 'cheap-module-source-map'
};