const path = require('path');

module.exports = {
  entry: './src/index.js', // Asegúrate de que este archivo exista
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },
  mode: 'production', // o 'development' según sea el caso
};
