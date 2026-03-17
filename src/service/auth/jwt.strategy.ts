import { Provide, Inject } from '@midwayjs/core';
import { JwtService } from '@midwayjs/jwt';
import { Context } from '@midwayjs/koa';
import { PrismaService } from '../prisma.service';

// 1. 放宽接口限制，完美兼容 Admin 登录和微信登录
export interface JwtPayload {
  userId: string;
  openid?: string; // 管理员可能没有 openid
  role: string;
  username?: string;
}

@Provide()
export class JwtStrategy {
  @Inject()
  jwtService: JwtService;

  @Inject()
  prisma: PrismaService;

  /**
   * 生成JWT Token (高健壮性版本)
   */
  async generateToken(user: {
    id?: string | number; // 兼容 Prisma 的 Int 或 String
    userId?: string | number; // 兼容 controller 传过来的 userId
    openid?: string;
    role: string;
    username?: string;
  }): Promise<string> {
    // 2. 核心修复：无论是 id 还是 userId 都能接住，并强制转换为 String
    const targetId = user.id || user.userId;

    if (!targetId) {
      throw new Error('生成 Token 失败：必须提供用户 ID');
    }

    const payload: JwtPayload = {
      userId: String(targetId),
      role: user.role,
    };

    // 按需加入可选字段，避免把 undefined 签名进 Token
    if (user.openid) payload.openid = user.openid;
    if (user.username) payload.username = user.username;

    return this.jwtService.sign(payload);
  }

  /**
   * 验证并解析JWT Token
   */
  async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = this.jwtService.decode(token) as JwtPayload;

      if (!payload || !payload.userId) {
        return null;
      }

      // ⚠️ 如果你的数据库 id 是 Int 类型，这里需要写成 Number(payload.userId)
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId as any },
      });

      if (!user) {
        return null;
      }

      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * 从请求中提取用户信息
   */
  extractUser(ctx: Context): JwtPayload | null {
    // 1. 优先尝试：从状态机中取 (正常情况 JwtMiddleware 会把它放在这里)
    if (ctx.state && ctx.state.user) {
      // 兼容某些中间件把数据多套一层的情况 (比如 ctx.state.user.user)
      const stateUser = ctx.state.user.userId
        ? ctx.state.user
        : ctx.state.user.user || ctx.state.user;
      return stateUser as JwtPayload;
    }

    // 2. 终极兜底：如果中间件掉链子了，我们直接从请求头里暴力手抓 Token 解析！
    try {
      // 兼容大小写
      const authHeader = ctx.get('Authorization') || ctx.get('authorization');

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '').trim();

        // 使用 jwtService 强制解析
        const payload = this.jwtService.decode(token) as JwtPayload;

        if (payload) {
          console.log(
            '[extractUser 兜底触发] 手动从 Header 解析 Token 成功:',
            payload
          );
          return payload;
        }
      }
    } catch (error) {
      console.error('[extractUser] 解析 Header Token 失败:', error);
    }

    console.warn('[extractUser] 无法提取用户信息，返回 null');
    return null;
  }

  /**
   * 微信小程序登录处理
   */
  async wxLogin(
    openid: string,
    username?: string,
    avatar?: string
  ): Promise<{ token: string; user: any }> {
    let user = await this.prisma.user.findUnique({
      where: { openid },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          openid,
          username,
          avatar,
        },
      });
    } else {
      const updateData: any = {};
      if (username) updateData.username = username;
      if (avatar) updateData.avatar = avatar;

      if (Object.keys(updateData).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }

    const token = await this.generateToken({
      id: user.id, // 这里传 id，上面的 targetId 逻辑也能完美接住
      openid: user.openid,
      role: user.role,
      username: user.username,
    });

    return { token, user };
  }
}
