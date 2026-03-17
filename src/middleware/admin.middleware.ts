import { Middleware } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';

@Middleware()
export class AdminMiddleware {
  static getName(): string {
    return 'admin';
  }

  async resolve() {
    return async (ctx: Context, next: any) => {
      // 检查用户是否已经通过JWT中间件认证
      if (!ctx.state.user) {
        ctx.status = 401;
        ctx.body = {
          success: false,
          message: 'User not authenticated'
        };
        return;
      }

      // 检查用户角色是否为ADMIN
      if (ctx.state.user.role !== 'ADMIN') {
        ctx.status = 403;
        ctx.body = {
          success: false,
          message: 'Access denied: Admin role required'
        };
        return;
      }

      await next();
    };
  }
}