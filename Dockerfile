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
WORKDIR /app

RUN apk add --no-cache openssl procps tzdata
ENV TZ="Asia/Shanghai"
RUN npm install -g pm2

RUN addgroup -g 1001 -S nodejs && \
    adduser -S midway -u 1001

# --- 重点修改 1：同时准备 logs 和 uploads 目录并授权 ---
RUN mkdir -p /app/logs /app/uploads && \
    chown -R midway:nodejs /app/logs /app/uploads

COPY --from=builder --chown=midway:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=midway:nodejs /app/dist ./dist
COPY --from=builder --chown=midway:nodejs /app/package.json ./
COPY --from=builder --chown=midway:nodejs /app/prisma ./prisma
COPY --from=builder --chown=midway:nodejs /app/bootstrap.js ./

# --- 重点修改 2：把启动逻辑写成一个命令组合 ---
# 在启动 PM2 之前，先执行数据库同步。使用 sh -c 来串联命令。
# 注意：USER midway 依然保留，确保是以非 root 身份执行同步
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

USER midway
EXPOSE 7001
ENV NODE_ENV=production

# --- 重点修改 3：自动化 Prisma 同步 ---
# 只有当数据库就绪时，这行才会成功执行（配合 compose 的 healthcheck）
CMD ["sh", "-c", "npx prisma generate && npx prisma db push && pm2-runtime start /app/ecosystem.config.json"]