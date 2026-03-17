import { Controller, Get, Inject, Query } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { JwtMiddleware } from '../middleware/jwt.middleware';
import { AdminMiddleware } from '../middleware/admin.middleware';
import { PrismaService } from '../service/prisma.service';
import { JwtStrategy } from '../service/auth/jwt.strategy';
import { MeterStatus, TicketStatus } from '@prisma/client';

interface DashboardStats {
  networkPressure: number;
  dailySupply: number;
  alertCount: number;
  lossRate: number;
  totalMeters: number;
  onlineMeters: number;
  offlineMeters: number;
  errorMeters: number;
}

interface ConsumptionData {
  date: string;
  value: number;
}

interface TypeData {
  type: string;
  value: number;
}

interface PressureData {
  area: string;
  pressure: number;
}

@Controller('/api/dashboard')
export class DashboardController {
  @Inject()
  ctx: Context;

  @Inject()
  prisma: PrismaService;

  @Inject()
  jwtStrategy: JwtStrategy;

  /**
   * 获取 Dashboard 核心统计数据
   */
  @Get('/stats', { middleware: [JwtMiddleware, AdminMiddleware] })
  async getDashboardStats() {
    try {
      // 获取水表统计
      const allMeters = await this.prisma.waterMeter.findMany();
      const totalMeters = allMeters.length;
      const onlineMeters = allMeters.filter(
        m => m.status === MeterStatus.NORMAL
      ).length;
      const offlineMeters = allMeters.filter(
        m => m.status === MeterStatus.OFFLINE
      ).length;
      const errorMeters = allMeters.filter(
        m => m.status === MeterStatus.FAULTY
      ).length;

      // 获取待处理工单数量作为告警数
      const pendingTickets = await this.prisma.repairTicket.count({
        where: {
          status: {
            in: [TicketStatus.PENDING, TicketStatus.PROCESSING],
          },
        },
      });

      // 模拟数据（实际项目中应该从数据库或IoT设备获取）
      const networkPressure = 0.36; // MPa
      const dailySupply = 8642; // m³
      const lossRate = 12.4; // %

      const stats: DashboardStats = {
        networkPressure,
        dailySupply,
        alertCount: pendingTickets || 3, // 至少有告警
        lossRate,
        totalMeters,
        onlineMeters,
        offlineMeters,
        errorMeters,
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取统计数据失败',
      };
    }
  }

  /**
   * 获取月度用水趋势数据
   */
  @Get('/consumption-trend', { middleware: [JwtMiddleware, AdminMiddleware] })
  async getConsumptionTrend(@Query('months') months: number = 6) {
    try {
      // 获取最近 N 个月的用水记录
      const usageRecords = await this.prisma.usageRecord.findMany({
        orderBy: { period: 'desc' },
        take: months,
      });

      // 按月份汇总
      const monthlyData: ConsumptionData[] = [];
      for (let i = months - 1; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const period = date.toISOString().slice(0, 7);

        const monthRecord = usageRecords.find(r => r.period === period);
        const totalAmount = monthRecord
          ? Number(monthRecord.amount)
          : Math.floor(Math.random() * 2000 + 3000); // 模拟数据

        monthlyData.push({
          date: period,
          value: totalAmount,
        });
      }

      return {
        success: true,
        data: monthlyData,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取用水趋势失败',
      };
    }
  }

  /**
   * 获取用水性质占比数据
   */
  @Get('/water-type-distribution', {
    middleware: [JwtMiddleware, AdminMiddleware],
  })
  async getWaterTypeDistribution() {
    try {
      // 模拟数据 - 实际项目中应该从数据库统计
      const typeData: TypeData[] = [
        { type: '居民生活', value: 45 },
        { type: '工业用水', value: 30 },
        { type: '商业服务', value: 15 },
        { type: '市政绿化', value: 10 },
      ];

      return {
        success: true,
        data: typeData,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取用水分布失败',
      };
    }
  }

  /**
   * 获取各区域水压数据
   */
  @Get('/area-pressure', { middleware: [JwtMiddleware, AdminMiddleware] })
  async getAreaPressure() {
    try {
      // 模拟数据 - 实际项目中应该从数据库或IoT设备获取
      const pressureData: PressureData[] = [
        { area: '城北区', pressure: 0.35 },
        { area: '城南区', pressure: 0.32 },
        { area: '开发区', pressure: 0.41 },
        { area: '老城区', pressure: 0.28 },
        { area: '高新区', pressure: 0.38 },
        { area: '生态城', pressure: 0.36 },
      ];

      return {
        success: true,
        data: pressureData,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取水压数据失败',
      };
    }
  }

  /**
   * 获取水库蓄水状态
   */
  @Get('/reservoir-status', { middleware: [JwtMiddleware, AdminMiddleware] })
  async getReservoirStatus() {
    try {
      // 模拟数据
      return {
        success: true,
        data: {
          percent: 0.72,
          capacity: 1000000, // 立方米
          current: 720000,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取水库状态失败',
      };
    }
  }
}
