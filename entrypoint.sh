#!/bin/sh
# 确保日志和上传目录属于 midway 用户
chown -R midway:nodejs /app/logs /app/uploads /app/.pm2

# 使用 gosu 或 su-exec 切换到 midway 用户并执行 CMD 命令
# 在 Alpine 中建议安装 su-exec
exec su-exec midway "$@"