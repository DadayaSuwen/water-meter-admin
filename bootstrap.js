const path = require('path');

// 首先加载.env文件
require('dotenv').config({
  path: path.join(__dirname, '.env'),
});

// 调试输出
console.log('=== 环境变量加载情况 ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('WX_APP_ID:', process.env.WX_APP_ID ? '已配置' : '未配置');
console.log('WX_APP_SECRET:', process.env.WX_APP_SECRET ? '已配置' : '未配置');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '已配置' : '未配置');
console.log('==========================');

const { Bootstrap } = require('@midwayjs/bootstrap');
Bootstrap.run();
