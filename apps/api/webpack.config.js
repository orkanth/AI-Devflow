const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');
const webpack = require('webpack');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/api'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
    }),
    new webpack.IgnorePlugin({
      checkResource(resource) {
        const lazyImports = [
          '@nestjs/microservices',
          '@nestjs/websockets',
          '@google-cloud/spanner',
          '@sap/hana-client',
          'better-sqlite3',
          'hdb-pool',
          'ioredis',
          'mongodb',
          'mssql',
          'mysql',
          'mysql2',
          'oracledb',
          'pg-native',
          'pg-query-stream',
          'react-native-sqlite-storage',
          'redis',
          'sqlite3',
          'sql.js',
          'typeorm-aurora-data-api-pg',
        ];
        if (!lazyImports.includes(resource)) {
          return false;
        }
        try {
          require.resolve(resource);
        } catch (_err) {
          return true;
        }
        return false;
      },
    }),
  ],
};