import { Middleware, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { JwtService } from '@midwayjs/jwt';

@Middleware()
export class JwtMiddleware {
  @Inject()
  jwtService: JwtService;

  static getName(): string {
    return 'jwt';
  }

  async resolve() {
    return async (ctx: Context, next: any) => {
      // 优先从 Authorization 头获取，其次从 cookie 获取
      let token = ctx.headers.authorization;

      // 如果没有 Authorization 头，尝试从 cookie 获取
      if (!token) {
        token = ctx.cookies.get('token');
      }

      if (!token) {
        ctx.status = 401;
        ctx.body = {
          success: false,
          message: '用户未登录或Token无效',
        };
        return;
      }

      // 处理 Bearer token 格式
      if (token.startsWith('Bearer ')) {
        token = token.substring(7);
      }

      if (!token) {
        ctx.status = 401;
        ctx.body = {
          success: false,
          message: 'Token not provided',
        };
        return;
      }

      try {
        // 解码和验证token
        const decoded = this.jwtService.decode(token);

        if (!decoded) {
          ctx.status = 401;
          ctx.body = {
            success: false,
            message: 'Token无效或已过期',
          };
          return;
        }

        console.log('JWT中间件验证成功，用户信息:', decoded);

        // 将解码后的用户信息存储到ctx.state中，供后续使用
        ctx.state.user = decoded;
        await next();
      } catch (error) {
        console.error('JWT验证失败:', error);
        ctx.status = 401;
        ctx.body = {
          success: false,
          message: 'Token验证失败',
        };
        return;
      }
    };
  }
}
