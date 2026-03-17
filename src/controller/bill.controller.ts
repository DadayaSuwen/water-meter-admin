import { Controller, Get, Query, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { JwtMiddleware } from '../middleware/jwt.middleware';
import { AdminMiddleware } from '../middleware/admin.middleware';
import { BillService } from '../service/domain/bill.service';
import { JwtStrategy } from '../service/auth/jwt.strategy';

@Controller('/api/bill')
export class BillController {
  @Inject()
  ctx: Context;

  @Inject()
  billService: BillService;

  @Inject()
  jwtStrategy: JwtStrategy;

  /**
   * 获取用户账单列表
   */
  @Get('/list', { middleware: [JwtMiddleware] })
  async getUserBills(
    @Query('status') status: 'UNPAID' | 'PAID' | 'OVERDUE',
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string
  ) {
    try {
      const user = await this.jwtStrategy.extractUser(this.ctx);

      if (!user) {
        return {
          success: false,
          message: '用户未登录',
        };
      }

      const options = {
        status: status || undefined,
        year: year || undefined,
        month: month || undefined,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      };

      const result = await this.billService.getUserBills(user.userId, options);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('获取账单列表失败:', error);
      return {
        success: false,
        message: error.message || '获取账单列表失败',
      };
    }
  }

  /**
   * 获取用户账单统计信息
   */
  @Get('/summary', { middleware: [JwtMiddleware] })
  async getUserBillSummary() {
    try {
      const user = await this.jwtStrategy.extractUser(this.ctx);

      if (!user) {
        return {
          success: false,
          message: '用户未登录',
        };
      }

      const summary = await this.billService.getUserBillSummary(user.userId);

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      console.error('获取账单统计失败:', error);
      return {
        success: false,
        message: error.message || '获取账单统计失败',
      };
    }
  }

  /**
   * 获取用户月度账单
   */
  @Get('/monthly', { middleware: [JwtMiddleware] })
  async getUserMonthlyBills(
    @Query('year') year: string,
    @Query('limit') limit: string
  ) {
    try {
      const user = await this.jwtStrategy.extractUser(this.ctx);

      if (!user) {
        return {
          success: false,
          message: '用户未登录',
        };
      }

      const limitNum = limit ? parseInt(limit) : 12;
      const monthlyBills = await this.billService.getUserMonthlyBills(
        user.userId,
        year,
        limitNum
      );

      return {
        success: true,
        data: monthlyBills,
      };
    } catch (error) {
      console.error('获取月度账单失败:', error);
      return {
        success: false,
        message: error.message || '获取月度账单失败',
      };
    }
  }

  /**
   * 获取账单详情
   */
  @Get('/detail/:billId', { middleware: [JwtMiddleware] })
  async getBillDetail() {
    try {
      const user = await this.jwtStrategy.extractUser(this.ctx);
      const billId = this.ctx.params.billId;

      if (!user) {
        return {
          success: false,
          message: '用户未登录',
        };
      }

      if (!billId) {
        return {
          success: false,
          message: '账单ID不能为空',
        };
      }

      const billDetail = await this.billService.getBillDetail(user.userId, billId);

      if (!billDetail) {
        return {
          success: false,
          message: '账单不存在或无权限访问',
        };
      }

      return {
        success: true,
        data: billDetail,
      };
    } catch (error) {
      console.error('获取账单详情失败:', error);
      return {
        success: false,
        message: error.message || '获取账单详情失败',
      };
    }
  }

  /**
   * 获取未缴费账单
   */
  @Get('/unpaid', { middleware: [JwtMiddleware] })
  async getUnpaidBills(@Query('limit') limit: string) {
    try {
      const user = await this.jwtStrategy.extractUser(this.ctx);

      if (!user) {
        return {
          success: false,
          message: '用户未登录',
        };
      }

      const options = {
        status: 'UNPAID' as const,
        limit: limit ? parseInt(limit) : 10,
      };

      const result = await this.billService.getUserBills(user.userId, options);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('获取未缴费账单失败:', error);
      return {
        success: false,
        message: error.message || '获取未缴费账单失败',
      };
    }
  }

  /**
   * 获取逾期账单
   */
  @Get('/overdue', { middleware: [JwtMiddleware] })
  async getOverdueBills(@Query('limit') limit: string) {
    try {
      const user = await this.jwtStrategy.extractUser(this.ctx);

      if (!user) {
        return {
          success: false,
          message: '用户未登录',
        };
      }

      const options = {
        status: 'OVERDUE' as const,
        limit: limit ? parseInt(limit) : 10,
      };

      const result = await this.billService.getUserBills(user.userId, options);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('获取逾期账单失败:', error);
      return {
        success: false,
        message: error.message || '获取逾期账单失败',
      };
    }
  }

  // ====================== 管理员专用接口 ======================

  /**
   * 管理员获取所有用户账单列表
   */
  @Get('/admin/list', { middleware: [JwtMiddleware, AdminMiddleware] })
  async getAllUserBills(
    @Query('status') status: 'UNPAID' | 'PAID' | 'OVERDUE',
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string
  ) {
    try {
      const options = {
        status: status || undefined,
        year: year || undefined,
        month: month || undefined,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      };

      const result = await this.billService.getAllUserBills(options);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('管理员获取所有账单列表失败:', error);
      return {
        success: false,
        message: error.message || '获取所有账单列表失败',
      };
    }
  }

  /**
   * 管理员获取所有用户账单统计信息
   */
  @Get('/admin/summary', { middleware: [JwtMiddleware, AdminMiddleware] })
  async getAllUserBillSummary() {
    try {
      const summary = await this.billService.getAllUserBillSummary();

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      console.error('管理员获取账单统计失败:', error);
      return {
        success: false,
        message: error.message || '获取所有账单统计失败',
      };
    }
  }

  /**
   * 管理员获取所有用户月度账单
   */
  @Get('/admin/monthly', { middleware: [JwtMiddleware, AdminMiddleware] })
  async getAllUserMonthlyBills(
    @Query('year') year: string,
    @Query('limit') limit: string
  ) {
    try {
      const limitNum = limit ? parseInt(limit) : 12;
      const monthlyBills = await this.billService.getAllUserMonthlyBills(year, limitNum);

      return {
        success: true,
        data: monthlyBills,
      };
    } catch (error) {
      console.error('管理员获取月度账单失败:', error);
      return {
        success: false,
        message: error.message || '获取所有月度账单失败',
      };
    }
  }

  /**
   * 管理员获取账单详情（任意用户）
   */
  @Get('/admin/detail/:billId', { middleware: [JwtMiddleware, AdminMiddleware] })
  async getBillDetailForAdmin() {
    try {
      const billId = this.ctx.params.billId;

      if (!billId) {
        return {
          success: false,
          message: '账单ID不能为空',
        };
      }

      const billDetail = await this.billService.getBillDetailForAdmin(billId);

      if (!billDetail) {
        return {
          success: false,
          message: '账单不存在',
        };
      }

      return {
        success: true,
        data: billDetail,
      };
    } catch (error) {
      console.error('管理员获取账单详情失败:', error);
      return {
        success: false,
        message: error.message || '获取账单详情失败',
      };
    }
  }

  /**
   * 管理员获取未缴费账单（所有用户）
   */
  @Get('/admin/unpaid', { middleware: [JwtMiddleware, AdminMiddleware] })
  async getAllUnpaidBills(@Query('limit') limit: string) {
    try {
      const options = {
        status: 'UNPAID' as const,
        limit: limit ? parseInt(limit) : 50,
      };

      const result = await this.billService.getAllUserBills(options);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('管理员获取所有未缴费账单失败:', error);
      return {
        success: false,
        message: error.message || '获取所有未缴费账单失败',
      };
    }
  }

  /**
   * 管理员获取逾期账单（所有用户）
   */
  @Get('/admin/overdue', { middleware: [JwtMiddleware, AdminMiddleware] })
  async getAllOverdueBills(@Query('limit') limit: string) {
    try {
      const options = {
        status: 'OVERDUE' as const,
        limit: limit ? parseInt(limit) : 50,
      };

      const result = await this.billService.getAllUserBills(options);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('管理员获取所有逾期账单失败:', error);
      return {
        success: false,
        message: error.message || '获取所有逾期账单失败',
      };
    }
  }
}