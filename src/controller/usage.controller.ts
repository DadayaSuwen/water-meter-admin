import { Controller, Get, Query, Param, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { JwtMiddleware } from '../middleware/jwt.middleware';
import { UsageService } from '../service/domain/usage.service';
import { JwtStrategy } from '../service/auth/jwt.strategy';

@Controller('/api/usage')
export class UsageController {
  @Inject()
  ctx: Context;

  @Inject()
  usageService: UsageService;

  @Inject()
  jwtStrategy: JwtStrategy;

  /**
   * 获取用户用水统计信息
   */
  @Get('/statistics', { middleware: [JwtMiddleware] })
  async getUserStatistics() {
    try {
      const user = await this.jwtStrategy.extractUser(this.ctx);

      if (!user) {
        return {
          success: false,
          message: '用户未登录',
        };
      }

      const statistics = await this.usageService.getUserUsageStatistics(
        user.userId
      );

      return {
        success: true,
        data: statistics,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取用水统计失败',
      };
    }
  }

  /**
   * 获取用户月度用水记录
   */
  @Get('/monthly', { middleware: [JwtMiddleware] })
  async getMonthlyUsage(@Query('limit') limit: string = '12') {
    try {
      const user = await this.jwtStrategy.extractUser(this.ctx);

      if (!user) {
        return {
          success: false,
          message: '用户未登录',
        };
      }

      const limitNum = parseInt(limit) || 12;
      const monthlyUsage = await this.usageService.getUserMonthlyUsage(
        user.userId,
        limitNum
      );

      return {
        success: true,
        data: monthlyUsage,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取月度用水记录失败',
      };
    }
  }

  /**
   * 获取水表用水历史记录
   */
  @Get('/meter/:meterId', { middleware: [JwtMiddleware] })
  async getMeterUsageHistory(
    @Param() params: { meterId: string },
    @Query('limit') limit: string = '24'
  ) {
    try {
      const user = await this.jwtStrategy.extractUser(this.ctx);

      if (!user) {
        return {
          success: false,
          message: '用户未登录',
        };
      }

      if (!params.meterId) {
        return {
          success: false,
          message: '水表ID不能为空',
        };
      }

      const limitNum = parseInt(limit) || 24;
      const history = await this.usageService.getMeterUsageHistory(
        params.meterId,
        limitNum
      );

      return {
        success: true,
        data: history,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取水表用水历史失败',
      };
    }
  }

  /**
   * 计算水表平均用水量
   */
  @Get('/average/:meterId', { middleware: [JwtMiddleware] })
  async calculateAverageUsage(
    @Param() params: { meterId: string },
    @Query('months') months: string = '12'
  ) {
    const meterId = params.meterId;
    try {
      const user = await this.jwtStrategy.extractUser(this.ctx);

      if (!user) {
        return {
          success: false,
          message: '用户未登录',
        };
      }

      if (!meterId) {
        return {
          success: false,
          message: '水表ID不能为空',
        };
      }

      const monthsNum = parseInt(months) || 12;
      const averageUsage = await this.usageService.calculateAverageUsage(
        meterId,
        monthsNum
      );

      return {
        success: true,
        data: {
          meterId,
          months: monthsNum,
          averageUsage,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '计算平均用水量失败',
      };
    }
  }
}
