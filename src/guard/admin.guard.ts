import { Guard } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';

@Guard()
export class AdminGuard {
  async canActivate(context: any, supplierClz: any, methodName: string): Promise<boolean> {
    const ctx: Context = context.ctx || context.nativeContext;

    // 检查用户是否已经通过AuthGuard认证
    if (!ctx.state.user) {
      ctx.status = 401;
      ctx.body = {
        success: false,
        message: 'User not authenticated'
      };
      return false;
    }

    // 检查用户角色是否为ADMIN
    if (ctx.state.user.role !== 'ADMIN') {
      ctx.status = 403;
      ctx.body = {
        success: false,
        message: 'Access denied: Admin role required'
      };
      return false;
    }

    return true;
  }
}