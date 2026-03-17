import { Guard } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { JwtService } from '@midwayjs/jwt';

@Guard()
export class AuthGuard {
  async canActivate(context: any, supplierClz: any, methodName: string): Promise<boolean> {
    const ctx: Context = context.ctx || context.nativeContext;
    const token = ctx.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      ctx.status = 401;
      ctx.body = {
        success: false,
        message: 'Token not provided'
      };
      return false;
    }

    try {
      const jwtService = await ctx.requestContext.getAsync(JwtService);
      const decoded = jwtService.decode(token);

      if (!decoded) {
        ctx.status = 401;
        ctx.body = {
          success: false,
          message: 'Invalid token'
        };
        return false;
      }

      // 将用户信息存储到ctx.state中，供后续使用
      ctx.state.user = decoded;
      return true;
    } catch (error) {
      ctx.status = 401;
      ctx.body = {
        success: false,
        message: 'Invalid token'
      };
      return false;
    }
  }
}