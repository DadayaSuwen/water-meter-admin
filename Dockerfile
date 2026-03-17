# ==========================================
# 阶段 1: 构建阶段 (Builder)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# 安装构建所需的系统依赖 (如果 npm install 需要编译原生模块)
# 如果不需要编译 node-gyp 相关模块，这一行可以省略
# RUN apk add --no-cache python3 make g++

# 1. 优先拷贝依赖定义，利用 Docker 缓存
COPY package*.json tsconfig.json ./

# 2. 安装所有依赖 (包括 devDependencies，用于 build)
RUN npm ci

# 3. 拷贝 Prisma Schema 并生成 Client
# Prisma Client 生成在 node_modules 中，所以需要在 build 之前
COPY prisma ./prisma/
RUN npx prisma generate

# 4. 拷贝源代码 (遵循 .dockerignore)
COPY . .

# 5. 执行构建 (Midway 编译 TS -> JS，生成 dist 目录)
RUN npm run build

# 6. 精简依赖：只保留生产环境依赖
# 这一步非常关键，它会删除 typescript 等开发依赖，减小体积
RUN npm prune --production

# ==========================================
# 阶段 2: 运行阶段 (Runner)
# ==========================================
FROM node:20-alpine AS runner

# 设置工作目录
WORKDIR /app

# 1. 安装运行时必需的系统库
# Prisma 在 Alpine 下需要 openssl
# procps 是为了让 PM2 能获取进程信息 (可选，但推荐)
RUN apk add --no-cache openssl procps tzdata su-exec

COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["entrypoint.sh"]

# 2. 设置时区 (可选，建议设置为上海时间，方便看日志)
ENV TZ="Asia/Shanghai"

# 3. 全局安装 pm2
RUN npm install -g pm2

# 4. 创建非 root 用户 (处于安全考虑)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S midway -u 1001

# 5. 准备日志目录并设置权限
RUN mkdir -p /app/logs && \
    chown -R midway:nodejs /app/logs

# 6. 拷贝构建产物 (使用 --chown 避免在层中重复复制文件)
# 只拷贝 dist, node_modules, bootstrap.js, package.json
COPY --from=builder --chown=midway:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=midway:nodejs /app/dist ./dist
COPY --from=builder --chown=midway:nodejs /app/package.json ./
COPY --from=builder --chown=midway:nodejs /app/prisma ./prisma
# 如果你的入口文件是 bootstrap.js，需要拷贝它
COPY --from=builder --chown=midway:nodejs /app/bootstrap.js ./

# 7. 生成 ecosystem.config.json
# 建议：最好将此文件直接写在项目中，然后 COPY 进来，这样更容易维护
# 这里保留你的写法，但简化了路径引用
RUN echo '{\
  "apps": [{\
    "name": "water-meter-api",\
    "script": "./bootstrap.js",\
    "instances": 1,\
    "exec_mode": "fork",\
    "watch": false,\
    "max_memory_restart": "1G",\
    "env": {\
      "NODE_ENV": "production",\
      "PORT": 7001\
    },\
    "log_file": "/app/logs/combined.log",\
    "out_file": "/app/logs/out.log",\
    "error_file": "/app/logs/error.log",\
    "merge_logs": true,\
    "log_date_format": "YYYY-MM-DD HH:mm:ss Z"\
  }]\
}' > /app/ecosystem.config.json && chown midway:nodejs /app/ecosystem.config.json

# 8. 切换用户
USER midway

# 暴露端口
EXPOSE 7001

# 环境变量
ENV NODE_ENV=production

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:7001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 启动命令
CMD ["pm2-runtime", "start", "/app/ecosystem.config.json"]