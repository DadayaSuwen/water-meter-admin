import { Controller, Post, Get, Put, Body, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { JwtStrategy } from '../service/auth/jwt.strategy';
import { WxService } from '../service/wx.service';
import {
  WxLoginDTO,
  AdminLoginDTO,
  UpdateAvatarDTO,
  UpdateProfileDTO,
} from '../dto/auth.dto';
import { Validate } from '@midwayjs/validate';
import { PrismaService } from '../service/prisma.service';
import { JwtMiddleware } from '../middleware/jwt.middleware';
import * as bcrypt from 'bcryptjs';

@Controller('/api/auth')
export class AuthController {
  @Inject()
  ctx: Context;

  @Inject()
  jwtStrategy: JwtStrategy;

  @Inject()
  wxService: WxService;

  @Inject()
  prisma: PrismaService;

  /**
   * 管理员登录 (Web后台)
   */
  @Post('/admin/login')
  @Validate()
  async adminLogin(@Body() loginData: AdminLoginDTO) {
    try {
      // 根据用户名查找管理员用户
      const user = await this.prisma.user.findFirst({
        where: {
          username: loginData.username,
          role: 'ADMIN',
        },
      });

      if (!user) {
        return {
          success: false,
          message: '用户名或密码错误',
        };
      }

      // 如果用户没有设置密码，提示需要先设置密码
      if (!user.password) {
        return {
          success: false,
          message: '该账号未设置密码，请联系系统管理员',
        };
      }

      // 验证密码
      const passwordValid = await bcrypt.compare(
        loginData.password,
        user.password
      );
      if (!passwordValid) {
        return {
          success: false,
          message: '用户名或密码错误',
        };
      }

      // 生成 JWT token
      const token = await this.jwtStrategy.generateToken({
        id: user.id,
        openid: user.openid,
        role: user.role,
        username: user.username,
      });

      // 通过 Set-Cookie 设置 token（持久化到浏览器）
      this.ctx.cookies.set('token', token, {
        httpOnly: false,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
        path: '/',
      });

      return {
        success: true,
        data: {
          token, // 返回 token 供前端备用存储
          user: {
            id: user.id,
            openid: user.openid,
            username: user.username,
            phone: user.phone,
            avatar: user.avatar,
            role: user.role,
          },
        },
      };
    } catch (error) {
      console.error('管理员登录失败:', error);
      return {
        success: false,
        message: error.message || '登录失败',
      };
    }
  }

  /**
   * 获取管理员当前用户信息 (专门供 Web 端使用)
   */
  @Get('/admin/profile', { middleware: [JwtMiddleware] })
  async getAdminProfile() {
    try {
      // 1. 获取 JWT 解析后的 payload
      const payload = this.jwtStrategy.extractUser(this.ctx);

      console.log('[Web端权限] 解析到的 Token payload:', payload);

      // 2. 如果没有解析出内容，或者没有 userId，说明 Token 无效
      if (!payload || !payload.userId) {
        return {
          success: false,
          message: '未登录或 Token 无效，请重新登录',
        };
      }

      // 3. 去数据库查询对应的管理员信息
      // 注意：这里根据你数据库 id 的实际类型，如果 id 是 Int，需要包一层 Number(payload.userId)
      const adminInfo = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          username: true,
          phone: true,
          avatar: true,
          role: true,
          createdAt: true,
          // openid 对于 Web 后台通常不需要，可以不 select
        },
      });

      if (!adminInfo) {
        return {
          success: false,
          message: '未找到该管理员账户',
        };
      }

      // 4. 返回成功数据
      return {
        success: true,
        data: adminInfo,
      };
    } catch (error: any) {
      console.error('[Web端权限] 获取管理员信息失败:', error);
      return {
        success: false,
        message: error.message || '获取管理员信息失败',
      };
    }
  }

  /**
   * 微信小程序登录
   */
  @Post('/login')
  @Validate()
  async login(@Body() loginData: WxLoginDTO) {
    try {
      // 检查微信配置是否完整
      const configStatus = this.wxService.getConfigStatus();
      if (!configStatus.isComplete) {
        // 如果微信配置不完整，使用开发模式
        console.warn('微信配置不完整，使用开发模式:', configStatus);
        const openid = `dev_openid_${loginData.code}_${Date.now()}`;

        const result = await this.jwtStrategy.wxLogin(
          openid,
          loginData.username,
          loginData.avatar
        );

        return {
          success: true,
          data: {
            token: result.token,
            user: {
              id: result.user.id,
              openid: result.user.openid,
              username: result.user.username,
              phone: result.user.phone,
              avatar: result.user.avatar,
              role: result.user.role,
            },
            isDevelopmentMode: true,
          },
        };
      }

      // 调用微信API获取session信息
      const wxSession = await this.wxService.code2Session(loginData.code);

      const result = await this.jwtStrategy.wxLogin(
        wxSession.openid,
        loginData.username,
        loginData.avatar
      );

      return {
        success: true,
        data: {
          token: result.token,
          user: {
            id: result.user.id,
            openid: result.user.openid,
            username: result.user.username,
            phone: result.user.phone,
            avatar: result.user.avatar,
            role: result.user.role,
          },
        },
      };
    } catch (error) {
      console.error('登录失败:', error);
      return {
        success: false,
        message: error.message || '登录失败',
      };
    }
  }

  /**
   * 获取微信配置状态
   */
  @Get('/wx-config')
  async getWxConfig() {
    try {
      const configStatus = this.wxService.getConfigStatus();
      return {
        success: true,
        data: {
          ...configStatus,
          message: configStatus.isComplete
            ? '微信配置完整，可以使用真实微信登录'
            : '微信配置不完整，当前使用开发模式',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取微信配置失败',
      };
    }
  }

  /**
   * 获取当前用户信息
   */
  @Get('/profile', { middleware: [JwtMiddleware] })
  async getProfile() {
    try {
      const user = this.jwtStrategy.extractUser(this.ctx);

      // 👇 1. 打印看看解析出来的 user 到底长什么样，方便排查
      console.log('[获取用户信息] 解析到的 Token payload:', user);

      if (!user) {
        return {
          success: false,
          message: '未登录',
        };
      }

      const userInfo = await this.prisma.user.findUnique({
        where: { id: user.userId },
        select: {
          id: true,
          openid: true,
          username: true,
          phone: true,
          avatar: true,
          role: true,
          createdAt: true,
        },
      });

      return {
        success: true,
        data: userInfo,
      };
    } catch (error) {
      console.error('[获取用户信息] 报错:', error);
      return {
        success: false,
        message: error.message || '获取用户信息失败',
      };
    }
  }

  /**
   * 更新头像
   */
  @Put('/avatar', { middleware: [JwtMiddleware] })
  @Validate()
  async updateAvatar(@Body() avatarData: UpdateAvatarDTO) {
    try {
      const user = this.jwtStrategy.extractUser(this.ctx);
      if (!user) {
        return {
          success: false,
          message: '未登录',
        };
      }

      await this.prisma.user.update({
        where: { id: user.userId },
        data: {
          avatar: avatarData.avatar,
        },
      });

      return {
        success: true,
        message: '头像更新成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '头像更新失败',
      };
    }
  }

  /**
   * 更新用户信息
   */
  @Put('/profile', { middleware: [JwtMiddleware] })
  @Validate()
  async updateProfile(@Body() profileData: UpdateProfileDTO) {
    try {
      const user = this.jwtStrategy.extractUser(this.ctx);
      if (!user) {
        return {
          success: false,
          message: '未登录',
        };
      }

      const updateData: any = {};
      if (profileData.username !== undefined)
        updateData.username = profileData.username;
      if (profileData.phone !== undefined) updateData.phone = profileData.phone;

      if (Object.keys(updateData).length === 0) {
        return {
          success: false,
          message: '没有需要更新的字段',
        };
      }

      await this.prisma.user.update({
        where: { id: user.userId },
        data: updateData,
      });

      return {
        success: true,
        message: '用户信息更新成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '用户信息更新失败',
      };
    }
  }

  /**
   * 验证token有效性
   */
  @Get('/verify')
  async verifyToken() {
    try {
      const user = this.jwtStrategy.extractUser(this.ctx);
      if (!user) {
        return {
          success: false,
          message: 'Token无效',
        };
      }

      return {
        success: true,
        data: {
          userId: user.userId,
          role: user.role,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Token验证失败',
      };
    }
  }
}
