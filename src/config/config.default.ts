import { MidwayConfig } from '@midwayjs/core';

export default {
  // use for cookie sign key, should change to your own and keep security
  keys: '1763719764813_9256',
  koa: {
    port: 7001,
    // 配置body parser支持Base64数据
    body: {
      jsonLimit: '10mb',
      formLimit: '10mb',
      textLimit: '10mb',
    },
  },
  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: '7d',
  },
  // Prisma 配置 - 在这里提供数据库连接信息
  prisma: {
    databaseUrl: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`,
  },
  // 微信小程序配置
  wx: {
    appId: process.env.WX_APP_ID || '',
    appSecret: process.env.WX_APP_SECRET || '',
  },
} as MidwayConfig;