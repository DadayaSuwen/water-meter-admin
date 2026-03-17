import { Provide, Inject } from '@midwayjs/core';
import { PrismaService } from '../prisma.service';
import { BindingStatus } from '@prisma/client';

export interface UsageStatistics {
  averageUsage: number; // 平均用水量（吨）
  totalUsage: number;   // 总用水量（吨）
  totalCost: number;    // 总费用（元）
  recordCount: number;  // 记录数量
}

export interface MonthlyUsage {
  period: string;       // 月份
  amount: number;       // 用水量
  cost: number;         // 费用
}

@Provide()
export class UsageService {
  @Inject()
  prisma: PrismaService;

  /**
   * 计算某水表的平均用水量
   */
  async calculateAverageUsage(meterId: string, months: number = 12): Promise<number> {
    // 获取指定月数内的用水记录
    const records = await this.prisma.usageRecord.findMany({
      where: { meterId },
      orderBy: { period: 'desc' },
      take: months
    });

    if (records.length === 0) {
      return 0;
    }

    // 计算平均用水量
    const totalUsage = records.reduce((sum, record) => sum + Number(record.amount), 0);
    return Number((totalUsage / records.length).toFixed(2));
  }

  /**
   * 获取用户用水统计信息
   */
  async getUserUsageStatistics(userId: string): Promise<UsageStatistics> {
    // 获取用户已绑定的水表ID列表
    const bindings = await this.prisma.meterBinding.findMany({
      where: {
        userId,
        status: BindingStatus.APPROVED
      }
    });

    if (bindings.length === 0) {
      return {
        averageUsage: 0,
        totalUsage: 0,
        totalCost: 0,
        recordCount: 0
      };
    }

    const meterIds = bindings.map(binding => binding.meterId);

    // 获取所有相关用水记录
    const records = await this.prisma.usageRecord.findMany({
      where: {
        meterId: {
          in: meterIds
        }
      }
    });

    if (records.length === 0) {
      return {
        averageUsage: 0,
        totalUsage: 0,
        totalCost: 0,
        recordCount: 0
      };
    }

    // 计算统计数据
    const totalUsage = records.reduce((sum, record) => sum + Number(record.amount), 0);
    const totalCost = records.reduce((sum, record) => sum + Number(record.cost), 0);
    const averageUsage = Number((totalUsage / records.length).toFixed(2));

    return {
      averageUsage,
      totalUsage: Number(totalUsage.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      recordCount: records.length
    };
  }

  /**
   * 获取用户月度用水记录
   */
  async getUserMonthlyUsage(userId: string, limit: number = 12): Promise<MonthlyUsage[]> {
    // 获取用户已绑定的水表ID列表
    const bindings = await this.prisma.meterBinding.findMany({
      where: {
        userId,
        status: BindingStatus.APPROVED
      }
    });

    if (bindings.length === 0) {
      return [];
    }

    const meterIds = bindings.map(binding => binding.meterId);

    // 获取所有用水记录
    const records = await this.prisma.usageRecord.findMany({
      where: {
        meterId: {
          in: meterIds
        }
      },
      orderBy: { period: 'desc' },
      take: limit * 10 // 获取更多数据用于分组
    });

    // 按月份分组汇总
    const monthlyData = new Map<string, { amount: number; cost: number }>();

    records.forEach(record => {
      const period = record.period;
      if (monthlyData.has(period)) {
        const existing = monthlyData.get(period)!;
        existing.amount += Number(record.amount);
        existing.cost += Number(record.cost);
      } else {
        monthlyData.set(period, {
          amount: Number(record.amount),
          cost: Number(record.cost)
        });
      }
    });

    // 转换为数组并排序
    return Array.from(monthlyData.entries())
      .map(([period, data]) => ({
        period,
        amount: Number(data.amount.toFixed(2)),
        cost: Number(data.cost.toFixed(2))
      }))
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, limit);
  }

  /**
   * 获取水表用水历史记录
   */
  async getMeterUsageHistory(meterId: string, limit: number = 24): Promise<MonthlyUsage[]> {
    const records = await this.prisma.usageRecord.findMany({
      where: { meterId },
      orderBy: { period: 'desc' },
      take: limit
    });

    return records.map(record => ({
      period: record.period,
      amount: Number(record.amount),
      cost: Number(record.cost)
    }));
  }

  /**
   * 添加用水记录
   */
  async addUsageRecord(usageData: {
    meterId: string;
    period: string;
    amount: number;
    cost: number;
  }): Promise<any> {
    // 检查是否已存在相同月份的记录
    const existingRecord = await this.prisma.usageRecord.findUnique({
      where: {
        meterId_period: {
          meterId: usageData.meterId,
          period: usageData.period
        }
      }
    });

    if (existingRecord) {
      throw new Error('该月份用水记录已存在');
    }

    return await this.prisma.usageRecord.create({
      data: {
        ...usageData,
        amount: usageData.amount,
        cost: usageData.cost
      }
    });
  }

  /**
   * 批量添加用水记录
   */
  async batchAddUsageRecords(records: Array<{
    meterId: string;
    period: string;
    amount: number;
    cost: number;
  }>): Promise<{ count: number }> {
    return await this.prisma.usageRecord.createMany({
      data: records.map(data => ({
        ...data,
        amount: data.amount,
        cost: data.cost
      }))
    });
  }
}