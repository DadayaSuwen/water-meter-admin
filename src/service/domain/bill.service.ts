import { Provide, Inject } from '@midwayjs/core';
import { PrismaService } from '../prisma.service';
import { BindingStatus } from '@prisma/client';

export interface BillDetail {
  id: string;
  meterId: string;
  meterSerialNumber?: string;
  period: string;
  amount: number;        // 用水量 (m³)
  unitPrice: number;     // 单价 (元/m³)
  cost: number;          // 费用 (元)
  status: 'UNPAID' | 'PAID' | 'OVERDUE'; // 缴费状态
  dueDate: string;       // 缴费截止日期
  paidDate?: string;     // 实际缴费日期
  location?: string;     // 水表位置
}

export interface BillSummary {
  totalAmount: number;   // 总用水量
  totalCost: number;     // 总费用
  paidCost: number;      // 已缴费金额
  unpaidCost: number;    // 未缴费金额
  overdueCost: number;   // 逾期费用
  billCount: number;     // 账单总数
  paidCount: number;     // 已缴费账单数
  unpaidCount: number;   // 未缴费账单数
  overdueCount: number;  // 逾期账单数
}

export interface MonthlyBills {
  month: string;
  bills: BillDetail[];
  totalAmount: number;
  totalCost: number;
}

export interface AdminBillDetail extends BillDetail {
  userName?: string;
  userPhone?: string;
  userAddress?: string;
}

@Provide()
export class BillService {
  @Inject()
  prisma: PrismaService;

  /**
   * 获取用户账单列表
   */
  async getUserBills(
    userId: string,
    options: {
      status?: 'UNPAID' | 'PAID' | 'OVERDUE';
      year?: string;
      month?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ bills: BillDetail[]; total: number }> {
    const { status, year, month, limit = 20, offset = 0 } = options;

    // 获取用户已绑定的水表
    const bindings = await this.prisma.meterBinding.findMany({
      where: {
        userId,
        status: BindingStatus.APPROVED
      },
      include: {
        waterMeter: {
          select: {
            serialNumber: true,
            location: true
          }
        }
      }
    });

    if (bindings.length === 0) {
      return { bills: [], total: 0 };
    }

    const meterIds = bindings.map(b => b.meterId);

    // 构建查询条件
    const whereCondition: any = {
      meterId: { in: meterIds }
    };

    if (year && month) {
      whereCondition.period = `${year}-${month.padStart(2, '0')}`;
    } else if (year) {
      whereCondition.period = {
        startsWith: year
      };
    }

    // 获取用水记录并转换为账单格式
    const [records, total] = await Promise.all([
      this.prisma.usageRecord.findMany({
        where: whereCondition,
        orderBy: { period: 'desc' },
        take: limit,
        skip: offset,
        include: {
          waterMeter: {
            select: {
              serialNumber: true,
              location: true
            }
          }
        }
      }),
      this.prisma.usageRecord.count({ where: whereCondition })
    ]);

    // 转换为账单格式
    const bills: BillDetail[] = records.map(record => {
      const binding = bindings.find(b => b.meterId === record.meterId);

      // 安全地计算单价，避免除零错误
      const amount = Number(record.amount) || 0;
      const unitPrice = amount > 0
        ? Number((Number(record.cost) / amount).toFixed(2))
        : 0;

      return {
        id: `${record.meterId}-${record.period}`,
        meterId: record.meterId,
        meterSerialNumber: record.waterMeter?.serialNumber || binding?.waterMeter?.serialNumber,
        period: record.period,
        amount: Number(record.amount) || 0,
        unitPrice,
        cost: Number(record.cost) || 0,
        status: this.getBillStatus(record.period),
        dueDate: this.getDueDate(record.period),
        location: record.waterMeter?.location || binding?.waterMeter?.location
      };
    });

    // 如果指定了状态，进行过滤
    const filteredBills = status ? bills.filter(bill => bill.status === status) : bills;

    return {
      bills: filteredBills,
      total: status ? filteredBills.length : total
    };
  }

  /**
   * 获取用户账单统计信息
   */
  async getUserBillSummary(userId: string): Promise<BillSummary> {
    const bills = await this.getUserBills(userId, { limit: 1000 });

    const summary = bills.bills.reduce(
      (acc, bill) => {
        acc.totalAmount += bill.amount;
        acc.totalCost += bill.cost;
        acc.billCount++;

        switch (bill.status) {
          case 'PAID':
            acc.paidCost += bill.cost;
            acc.paidCount++;
            break;
          case 'UNPAID':
            acc.unpaidCost += bill.cost;
            acc.unpaidCount++;
            break;
          case 'OVERDUE':
            acc.overdueCost += bill.cost;
            acc.overdueCount++;
            acc.unpaidCost += bill.cost;
            acc.unpaidCount++;
            break;
        }
        return acc;
      },
      {
        totalAmount: 0,
        totalCost: 0,
        paidCost: 0,
        unpaidCost: 0,
        overdueCost: 0,
        billCount: 0,
        paidCount: 0,
        unpaidCount: 0,
        overdueCount: 0
      }
    );

    return {
      totalAmount: Number(summary.totalAmount.toFixed(2)),
      totalCost: Number(summary.totalCost.toFixed(2)),
      paidCost: Number(summary.paidCost.toFixed(2)),
      unpaidCost: Number(summary.unpaidCost.toFixed(2)),
      overdueCost: Number(summary.overdueCost.toFixed(2)),
      billCount: summary.billCount,
      paidCount: summary.paidCount,
      unpaidCount: summary.unpaidCount,
      overdueCount: summary.overdueCount
    };
  }

  /**
   * 获取用户月度账单
   */
  async getUserMonthlyBills(userId: string, year?: string, limit: number = 12): Promise<MonthlyBills[]> {
    const bills = await this.getUserBills(userId, {
      year,
      limit: 1000
    });

    // 按月份分组
    const monthlyMap = new Map<string, BillDetail[]>();

    bills.bills.forEach(bill => {
      const monthKey = bill.period.substring(0, 7); // YYYY-MM
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, []);
      }
      monthlyMap.get(monthKey)!.push(bill);
    });

    // 转换为月度账单格式
    const monthlyBills: MonthlyBills[] = Array.from(monthlyMap.entries())
      .map(([month, monthBills]) => {
        const totalAmount = monthBills.reduce((sum, bill) => sum + bill.amount, 0);
        const totalCost = monthBills.reduce((sum, bill) => sum + bill.cost, 0);

        return {
          month,
          bills: monthBills,
          totalAmount: Number(totalAmount.toFixed(2)),
          totalCost: Number(totalCost.toFixed(2))
        };
      })
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, limit);

    return monthlyBills;
  }

  /**
   * 获取账单详情
   */
  async getBillDetail(userId: string, billId: string): Promise<BillDetail | null> {
    if (!billId) {
      return null;
    }

    // 解析billId: meterId-period
    const [meterId, period] = billId.includes('-') ? billId.split('-', 2) : [billId, ''];

    if (!meterId || !period) {
      return null;
    }

    // 验证用户是否有权限访问该水表
    const binding = await this.prisma.meterBinding.findFirst({
      where: {
        userId,
        meterId,
        status: BindingStatus.APPROVED
      }
    });

    if (!binding) {
      return null;
    }

    const record = await this.prisma.usageRecord.findUnique({
      where: {
        meterId_period: {
          meterId,
          period
        }
      },
      include: {
        waterMeter: {
          select: {
            serialNumber: true,
            location: true
          }
        }
      }
    });

    if (!record) {
      return null;
    }

    // 安全地计算单价，避免除零错误
    const amount = Number(record.amount) || 0;
    const unitPrice = amount > 0
      ? Number((Number(record.cost) / amount).toFixed(2))
      : 0;

    return {
      id: billId,
      meterId,
      meterSerialNumber: record.waterMeter?.serialNumber,
      period: record.period,
      amount: Number(record.amount) || 0,
      unitPrice,
      cost: Number(record.cost) || 0,
      status: this.getBillStatus(record.period),
      dueDate: this.getDueDate(record.period),
      location: record.waterMeter?.location
    };
  }

  /**
   * 根据期间确定账单状态
   */
  private getBillStatus(period: string): 'UNPAID' | 'PAID' | 'OVERDUE' {
    if (!period) return 'UNPAID';

    try {
      const dueDate = new Date(this.getDueDate(period));
      const now = new Date();

      if (now > dueDate) {
        return 'OVERDUE';
      }

      // TODO: 这里可以检查实际的缴费记录，目前先返回未缴费
      // 可以添加缴费记录表来跟踪实际缴费状态
      return 'UNPAID';
    } catch (error) {
      console.error('Error determining bill status:', error);
      return 'UNPAID';
    }
  }

  /**
   * 计算缴费截止日期（次月20日）
   */
  private getDueDate(period: string): string {
    if (!period || period.length < 7) {
      // 如果period格式不正确，返回默认值
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 20);
      return nextMonth.toISOString().split('T')[0];
    }

    try {
      // period 格式: YYYY-MM
      const year = parseInt(period.substring(0, 4));
      const month = parseInt(period.substring(5, 7));

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        throw new Error('Invalid period format');
      }

      // 次月20日
      const dueYear = month === 12 ? year + 1 : year;
      const dueMonth = month === 12 ? 1 : month + 1;

      return `${dueYear}-${dueMonth.toString().padStart(2, '0')}-20`;
    } catch (error) {
      console.error('Error calculating due date:', error);
      // 出错时返回默认的次月20日
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 20);
      return nextMonth.toISOString().split('T')[0];
    }
  }

  // ====================== 管理员专用方法 ======================

  /**
   * 管理员获取所有用户账单列表
   */
  async getAllUserBills(
    options: {
      status?: 'UNPAID' | 'PAID' | 'OVERDUE';
      year?: string;
      month?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ bills: AdminBillDetail[]; total: number }> {
    const { status, year, month, limit = 50, offset = 0 } = options;

    // 构建查询条件
    const whereCondition: any = {};

    if (year && month) {
      whereCondition.period = `${year}-${month.padStart(2, '0')}`;
    } else if (year) {
      whereCondition.period = {
        startsWith: year
      };
    }

    // 获取所有用水记录
    const [records, total] = await Promise.all([
      this.prisma.usageRecord.findMany({
        where: whereCondition,
        orderBy: { period: 'desc' },
        take: limit,
        skip: offset,
        include: {
          waterMeter: {
            select: {
              serialNumber: true,
              location: true
            }
          }
        }
      }),
      this.prisma.usageRecord.count({ where: whereCondition })
    ]);

    console.log(`[Admin API] 查询条件:`, whereCondition);
    console.log(`[Admin API] 找到 ${records.length} 条用水记录，总计 ${total} 条`);

    // 批量获取所有水表的用户绑定信息
    const meterIds = [...new Set(records.map(r => r.meterId))];
    console.log(`[Admin API] 涉及的水表ID:`, meterIds);

    const bindings = await this.prisma.meterBinding.findMany({
      where: {
        meterId: { in: meterIds },
        status: BindingStatus.APPROVED
      },
      include: {
        user: {
          select: {
            username: true,
            phone: true
          }
        }
      }
    });

    console.log(`[Admin API] 找到 ${bindings.length} 个水表绑定关系`);

    // 创建水表ID到用户信息的映射
    const meterUserMap = new Map();
    bindings.forEach(binding => {
      meterUserMap.set(binding.meterId, {
        userName: binding.user?.username,
        userPhone: binding.user?.phone
      });
    });

    // 转换为账单格式并包含用户信息
    const bills: AdminBillDetail[] = [];

    for (const record of records) {
      const userInfo = meterUserMap.get(record.meterId);

      // 安全地计算单价，避免除零错误
      const amount = Number(record.amount) || 0;
      const unitPrice = amount > 0
        ? Number((Number(record.cost) / amount).toFixed(2))
        : 0;

      const bill: AdminBillDetail = {
        id: `${record.meterId}-${record.period}`,
        meterId: record.meterId,
        meterSerialNumber: record.waterMeter?.serialNumber,
        period: record.period,
        amount: Number(record.amount) || 0,
        unitPrice,
        cost: Number(record.cost) || 0,
        status: this.getBillStatus(record.period),
        dueDate: this.getDueDate(record.period),
        location: record.waterMeter?.location,
        userName: userInfo?.userName,
        userPhone: userInfo?.userPhone,
        userAddress: record.waterMeter?.location
      };

      bills.push(bill);
    }

    // 如果指定了状态，进行过滤
    const filteredBills = status ? bills.filter(bill => bill.status === status) : bills;

    console.log(`[Admin API] 过滤后的账单数量: ${filteredBills.length}`);

    return {
      bills: filteredBills,
      total: status ? filteredBills.length : total
    };
  }

  /**
   * 管理员获取所有用户账单统计信息
   */
  async getAllUserBillSummary(): Promise<BillSummary> {
    const bills = await this.getAllUserBills({ limit: 10000 });

    const summary = bills.bills.reduce(
      (acc, bill) => {
        acc.totalAmount += bill.amount;
        acc.totalCost += bill.cost;
        acc.billCount++;

        switch (bill.status) {
          case 'PAID':
            acc.paidCost += bill.cost;
            acc.paidCount++;
            break;
          case 'UNPAID':
            acc.unpaidCost += bill.cost;
            acc.unpaidCount++;
            break;
          case 'OVERDUE':
            acc.overdueCost += bill.cost;
            acc.overdueCount++;
            acc.unpaidCost += bill.cost;
            acc.unpaidCount++;
            break;
        }
        return acc;
      },
      {
        totalAmount: 0,
        totalCost: 0,
        paidCost: 0,
        unpaidCost: 0,
        overdueCost: 0,
        billCount: 0,
        paidCount: 0,
        unpaidCount: 0,
        overdueCount: 0
      }
    );

    return {
      totalAmount: Number(summary.totalAmount.toFixed(2)),
      totalCost: Number(summary.totalCost.toFixed(2)),
      paidCost: Number(summary.paidCost.toFixed(2)),
      unpaidCost: Number(summary.unpaidCost.toFixed(2)),
      overdueCost: Number(summary.overdueCost.toFixed(2)),
      billCount: summary.billCount,
      paidCount: summary.paidCount,
      unpaidCount: summary.unpaidCount,
      overdueCount: summary.overdueCount
    };
  }

  /**
   * 管理员获取所有用户月度账单
   */
  async getAllUserMonthlyBills(year?: string, limit: number = 12): Promise<MonthlyBills[]> {
    const bills = await this.getAllUserBills({
      year,
      limit: 10000
    });

    // 按月份分组
    const monthlyMap = new Map<string, AdminBillDetail[]>();

    bills.bills.forEach(bill => {
      const monthKey = bill.period.substring(0, 7); // YYYY-MM
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, []);
      }
      monthlyMap.get(monthKey)!.push(bill);
    });

    // 转换为月度账单格式
    const monthlyBills: MonthlyBills[] = Array.from(monthlyMap.entries())
      .map(([month, monthBills]) => {
        const totalAmount = monthBills.reduce((sum, bill) => sum + bill.amount, 0);
        const totalCost = monthBills.reduce((sum, bill) => sum + bill.cost, 0);

        return {
          month,
          bills: monthBills,
          totalAmount: Number(totalAmount.toFixed(2)),
          totalCost: Number(totalCost.toFixed(2))
        };
      })
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, limit);

    return monthlyBills;
  }

  /**
   * 管理员获取账单详情（任意用户）
   */
  async getBillDetailForAdmin(billId: string): Promise<AdminBillDetail | null> {
    if (!billId) {
      return null;
    }

    // 解析billId: meterId-period
    const [meterId, period] = billId.includes('-') ? billId.split('-', 2) : [billId, ''];

    if (!meterId || !period) {
      return null;
    }

    const record = await this.prisma.usageRecord.findUnique({
      where: {
        meterId_period: {
          meterId,
          period
        }
      },
      include: {
        waterMeter: {
          select: {
            serialNumber: true,
            location: true
          }
        }
      }
    });

    if (!record) {
      return null;
    }

    // 查找该水表的绑定用户
    const binding = await this.prisma.meterBinding.findFirst({
      where: {
        meterId,
        status: BindingStatus.APPROVED
      },
      include: {
        user: {
          select: {
            username: true,
            phone: true
          }
        }
      }
    });

    // 安全地计算单价，避免除零错误
    const amount = Number(record.amount) || 0;
    const unitPrice = amount > 0
      ? Number((Number(record.cost) / amount).toFixed(2))
      : 0;

    return {
      id: billId,
      meterId,
      meterSerialNumber: record.waterMeter?.serialNumber,
      period: record.period,
      amount: Number(record.amount) || 0,
      unitPrice,
      cost: Number(record.cost) || 0,
      status: this.getBillStatus(record.period),
      dueDate: this.getDueDate(record.period),
      location: record.waterMeter?.location,
      userName: binding?.user?.username,
      userPhone: binding?.user?.phone,
      userAddress: record.waterMeter?.location
    };
  }
}