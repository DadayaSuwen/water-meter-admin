import { Provide, Inject } from '@midwayjs/core';
import { PrismaService } from '../prisma.service';
import {
  BindingStatus,
  MeterStatus,
  Prisma,
  MeterType,
  ValveStatus,
} from '@prisma/client';

export interface CreateBindingDTO {
  serialNumber: string;
  description?: string;
}

export interface ReviewBindingDTO {
  bindingId: string;
  status: 'APPROVED' | 'REJECTED';
  remark?: string;
}

export interface CreateWaterMeterDTO {
  serialNumber: string;
  location: string;
  lastReading?: number;
  meterType?: MeterType;
  valveStatus?: ValveStatus;
  batteryLevel?: number;
}

// 前端需要的水表列表项格式
export interface MeterListItem {
  id: string;
  meterNo: string;
  address: string;
  ownerName: string;
  type: string;
  status: 'online' | 'offline' | 'error';
  valveStatus: 'open' | 'closed' | 'error';
  battery: number;
  lastReading: number;
  updateTime: string;
}

@Provide()
export class MeterService {
  @Inject()
  prisma: PrismaService;
  /**
   * 申请绑定水表
   */
  async applyBinding(
    userId: string,
    bindingData: CreateBindingDTO
  ): Promise<any> {
    // 通过序列号查找水表
    const meter = await this.prisma.waterMeter.findUnique({
      where: { serialNumber: bindingData.serialNumber },
    });

    if (!meter) {
      throw new Error('水表不存在，请检查序列号是否正确');
    }

    // 检查是否已有待审核的绑定申请
    const existingBinding = await this.prisma.meterBinding.findFirst({
      where: {
        userId,
        meterId: meter.id,
        status: BindingStatus.PENDING,
      },
    });

    if (existingBinding) {
      throw new Error('已有待审核的绑定申请，请勿重复提交');
    }

    // 检查是否已绑定过
    const approvedBinding = await this.prisma.meterBinding.findFirst({
      where: {
        userId,
        meterId: meter.id,
        status: BindingStatus.APPROVED,
      },
    });

    if (approvedBinding) {
      throw new Error('您已绑定过此水表');
    }

    // 创建绑定申请
    return await this.prisma.meterBinding.create({
      data: {
        userId,
        meterId: meter.id,
        description: bindingData.description || '',
        status: BindingStatus.PENDING,
      },
    });
  }

  /**
   * 获取用户的绑定列表
   */
  async getUserBindings(userId: string): Promise<any[]> {
    return await this.prisma.meterBinding.findMany({
      where: { userId },
      include: {
        waterMeter: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 获取用户已绑定的水表列表（用于meter.controller）
   */
  async getUserBoundMeters(userId: string): Promise<any[]> {
    const bindings = await this.prisma.meterBinding.findMany({
      where: {
        userId,
        status: BindingStatus.APPROVED,
      },
      include: {
        waterMeter: true,
      },
    });

    return bindings.map(binding => binding.waterMeter);
  }

  /**
   * 获取待审核的绑定申请（管理员用）
   */
  async getPendingBindings(): Promise<any[]> {
    return await this.prisma.meterBinding.findMany({
      where: { status: BindingStatus.PENDING },
      include: {
        user: true,
        waterMeter: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 审核绑定申请（管理员用）
   */
  async reviewBinding(
    adminId: string,
    reviewData: ReviewBindingDTO
  ): Promise<any> {
    const binding = await this.prisma.meterBinding.findUnique({
      where: { id: reviewData.bindingId },
      include: {
        user: true,
        waterMeter: true,
      },
    });

    if (!binding) {
      throw new Error('绑定申请不存在');
    }

    if (binding.status !== BindingStatus.PENDING) {
      throw new Error('该申请已处理，无法重复审核');
    }

    // 更新绑定状态
    return await this.prisma.meterBinding.update({
      where: { id: reviewData.bindingId },
      data: {
        status: reviewData.status as BindingStatus,
        reviewRemark: reviewData.remark || '',
        reviewedBy: adminId,
      },
    });
  }

  /**
   * 获取所有绑定（管理员用）
   */
  async getAllBindings(status?: BindingStatus): Promise<any[]> {
    const whereCondition: any = {};
    if (status) {
      whereCondition.status = status;
    }

    return await this.prisma.meterBinding.findMany({
      where: whereCondition,
      include: {
        user: true,
        waterMeter: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 创建水表（管理员用）
   */
  async createWaterMeter(meterData: CreateWaterMeterDTO): Promise<any> {
    // 检查序列号是否已存在
    const existingMeter = await this.prisma.waterMeter.findUnique({
      where: { serialNumber: meterData.serialNumber },
    });

    if (existingMeter) {
      throw new Error('水表序列号已存在');
    }

    return await this.prisma.waterMeter.create({
      data: {
        serialNumber: meterData.serialNumber,
        location: meterData.location,
        lastReading: meterData.lastReading || 0,
        status: MeterStatus.NORMAL,
      },
    });
  }

  /**
   * 获取所有水表（管理员用）
   */
  async getAllWaterMeters(): Promise<any[]> {
    return await this.prisma.waterMeter.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 更新水表状态（管理员用）
   */
  async updateMeterStatus(meterId: string, status: MeterStatus): Promise<any> {
    const meter = await this.prisma.waterMeter.findUnique({
      where: { id: meterId },
    });

    if (!meter) {
      throw new Error('水表不存在');
    }

    return await this.prisma.waterMeter.update({
      where: { id: meterId },
      data: { status },
    });
  }

  /**
   * 获取水表详情
   */
  async getMeterDetail(userId: string, meterId: string): Promise<any> {
    // 验证用户是否绑定了该水表
    const binding = await this.prisma.meterBinding.findFirst({
      where: {
        userId,
        meterId,
        status: BindingStatus.APPROVED,
      },
      include: {
        waterMeter: true,
      },
    });

    if (!binding) {
      throw new Error('您未绑定此水表或水表不存在');
    }

    // 获取水表基本信息
    const meter = binding.waterMeter;

    // 获取最近6个月的用水记录
    const usageRecords = await this.prisma.usageRecord.findMany({
      where: { meterId },
      orderBy: { period: 'desc' },
      take: 6,
    });

    // 计算统计数据
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM格式
    const currentUsageRecord = usageRecords.find(
      r => r.period === currentMonth
    );
    // const lastMonthUsageRecord = usageRecords.find(r => r.period === new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7));

    const monthlyUsage = currentUsageRecord
      ? Number(currentUsageRecord.amount)
      : 0;
    const lastMonthReading = meter.lastReading
      ? Number(meter.lastReading) - monthlyUsage
      : 0;
    const currentReading = meter.lastReading ? Number(meter.lastReading) : 0;

    // 计算平均用水量（基于有记录的月份）
    const averageUsage =
      usageRecords.length > 0
        ? usageRecords.reduce((sum, record) => sum + Number(record.amount), 0) /
          usageRecords.length
        : 0;

    // 估算每日平均用水量
    const dailyAvg = monthlyUsage > 0 ? (monthlyUsage / 30).toFixed(1) : '0';

    // 水费估算（假设每立方米3元）
    const waterRate = 3;
    const estimatedCost = monthlyUsage * waterRate;

    return {
      // 水表基本信息
      id: meter.id,
      serialNumber: meter.serialNumber,
      location: meter.location,
      status: meter.status,

      // 用水数据
      lastReading: currentReading,
      lastMonthReading: lastMonthReading,
      monthlyUsage: monthlyUsage,
      dailyAvg: parseFloat(dailyAvg),
      estimatedCost: estimatedCost,

      // 统计信息
      averageUsage: parseFloat(averageUsage.toFixed(1)),

      // 绑定信息
      bindingStatus: binding.status,
      bindingDate: binding.createdAt,

      // 月度记录（用于图表展示）
      monthlyRecords: usageRecords
        .map(record => ({
          period: record.period,
          amount: Number(record.amount),
          cost: Number(record.cost),
        }))
        .reverse(), // 按时间正序排列
    };
  }

  /**
   * 删除绑定关系
   */
  async deleteBinding(userId: string, bindingId: string): Promise<void> {
    const binding = await this.prisma.meterBinding.findFirst({
      where: { id: bindingId, userId },
    });

    if (!binding) {
      throw new Error('绑定关系不存在');
    }

    await this.prisma.meterBinding.delete({
      where: { id: bindingId },
    });
  }

  // ===== 管理员水表管理方法 =====

  /**
   * 将后端 MeterStatus 转换为前端 status 格式
   */
  private mapStatusToFrontend(
    status: MeterStatus
  ): 'online' | 'offline' | 'error' {
    switch (status) {
      case MeterStatus.NORMAL:
        return 'online';
      case MeterStatus.OFFLINE:
        return 'offline';
      case MeterStatus.FAULTY:
        return 'error';
      default:
        return 'online';
    }
  }

  /**
   * 将后端 MeterType 转换为前端 type 格式
   */
  private mapTypeToFrontend(type: MeterType): string {
    switch (type) {
      case MeterType.NB_IOT:
        return 'NB-IoT智能表';
      case MeterType.LORA:
        return 'LoRa远传表';
      case MeterType.ULTRASONIC:
        return '超声波大表';
      case MeterType.MECHANICAL:
        return '机械表';
      default:
        return 'NB-IoT智能表';
    }
  }

  /**
   * 将后端 ValveStatus 转换为前端 valveStatus 格式
   */
  private mapValveStatusToFrontend(
    status: ValveStatus
  ): 'open' | 'closed' | 'error' {
    switch (status) {
      case ValveStatus.OPEN:
        return 'open';
      case ValveStatus.CLOSED:
        return 'closed';
      case ValveStatus.ERROR:
        return 'error';
      default:
        return 'open';
    }
  }

  /**
   * 获取所有水表列表 (前端格式) - 管理员用
   * 返回前端 Dashboard/Meter/List 页面需要的数据格式
   */
  async getMetersForFrontend(): Promise<MeterListItem[]> {
    const meters = await this.prisma.waterMeter.findMany({
      include: {
        meterBindings: {
          where: { status: BindingStatus.APPROVED },
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 转换为前端需要的格式
    return meters.map(meter => {
      // 获取绑定的用户（取第一个绑定的用户作为户主）
      const approvedBinding = meter.meterBindings[0];
      const ownerName = approvedBinding?.user?.username || '未绑定';

      // 格式化最后通讯时间
      const updateTime = meter.lastCommunicationAt
        ? this.formatDateTime(meter.lastCommunicationAt)
        : meter.createdAt
        ? this.formatDateTime(meter.createdAt)
        : '-';

      return {
        id: meter.id,
        meterNo: meter.serialNumber,
        address: meter.location,
        ownerName: ownerName,
        type: this.mapTypeToFrontend(meter.meterType),
        status: this.mapStatusToFrontend(meter.status),
        valveStatus: this.mapValveStatusToFrontend(meter.valveStatus),
        battery: meter.batteryLevel,
        lastReading: Number(meter.lastReading),
        updateTime: updateTime,
      };
    });
  }

  /**
   * 格式化日期时间为字符串
   */
  private formatDateTime(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * 获取所有水表列表
   * @param status 水表自身的物理状态 (NORMAL | FAULTY)
   */
  async getAllMeters(status?: MeterStatus): Promise<any> {
    // 也可以定义具体的 DTO
    // 构造查询条件
    const whereCondition: Prisma.WaterMeterWhereInput = {};

    // 校验传入的 status 是否有效，或者由 Controller 层保证类型
    if (status) {
      whereCondition.status = status;
    }

    const meters = await this.prisma.waterMeter.findMany({
      where: whereCondition,
      include: {
        meterBindings: {
          // 这里可以额外加条件，比如只显示当前有效的绑定？
          // where: { status: 'APPROVED' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                openid: true,
                // 注意：phone 通常涉及隐私，不建议默认返回，除非管理员明确需要
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // (可选) 处理 Decimal 问题，转为 Number，方便前端使用
    return meters.map(meter => ({
      ...meter,
      lastReading: Number(meter.lastReading), // 转换 Decimal 为 Number
    }));
  }
  /**
   * 创建水表（管理员用）
   */
  async createMeter(meterData: any): Promise<any> {
    const {
      serialNumber,
      location,
      initialReading = 0,
      status = MeterStatus.NORMAL,
    } = meterData;

    // 检查序列号是否已存在
    const existingMeter = await this.prisma.waterMeter.findUnique({
      where: { serialNumber },
    });

    if (existingMeter) {
      throw new Error('水表序列号已存在');
    }

    return await this.prisma.waterMeter.create({
      data: {
        serialNumber,
        location,
        lastReading: Number(initialReading),
        status,
      },
    });
  }

  /**
   * 更新水表信息（管理员用）
   */
  async updateMeter(meterId: string, meterData: any): Promise<any> {
    const meter = await this.prisma.waterMeter.findUnique({
      where: { id: meterId },
    });

    if (!meter) {
      throw new Error('水表不存在');
    }

    // 如果更新序列号，检查是否重复
    if (
      meterData.serialNumber &&
      meterData.serialNumber !== meter.serialNumber
    ) {
      const existingMeter = await this.prisma.waterMeter.findUnique({
        where: { serialNumber: meterData.serialNumber },
      });

      if (existingMeter) {
        throw new Error('水表序列号已存在');
      }
    }

    const updateData: any = {};
    if (meterData.serialNumber !== undefined)
      updateData.serialNumber = meterData.serialNumber;
    if (meterData.location !== undefined)
      updateData.location = meterData.location;
    if (meterData.currentReading !== undefined)
      updateData.currentReading = Number(meterData.currentReading);
    if (meterData.status !== undefined) updateData.status = meterData.status;

    return await this.prisma.waterMeter.update({
      where: { id: meterId },
      data: updateData,
    });
  }

  /**
   * 删除水表（管理员用）
   */
  async deleteMeter(meterId: string): Promise<void> {
    const meter = await this.prisma.waterMeter.findUnique({
      where: { id: meterId },
      include: {
        meterBindings: true,
      },
    });

    if (!meter) {
      throw new Error('水表不存在');
    }

    // 检查是否有关联的绑定关系
    if (meter.meterBindings.length > 0) {
      throw new Error('该水表存在绑定关系，无法删除');
    }

    await this.prisma.waterMeter.delete({
      where: { id: meterId },
    });
  }

  /**
   * 管理员获取水表详情（无需绑定验证）
   */
  async getMeterDetailForAdmin(meterId: string): Promise<any> {
    // 直接获取水表信息
    const meter = await this.prisma.waterMeter.findUnique({
      where: { id: meterId },
      include: {
        meterBindings: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                openid: true,
              },
            },
          },
        },
      },
    });

    if (!meter) {
      throw new Error('水表不存在');
    }

    // 获取最近6个月的用水记录
    const usageRecords = await this.prisma.usageRecord.findMany({
      where: {
        meterId,
      },
      orderBy: {
        period: 'desc',
      },
      take: 6,
    });

    // 计算总用水量和平均用水量
    const totalUsage = usageRecords.reduce(
      (sum, record) => sum + Number(record.amount),
      0
    );
    // const averageUsage =
    //   usageRecords.length > 0 ? totalUsage / usageRecords.length : 0;

    // 计算统计数据
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM格式
    const currentUsageRecord = usageRecords.find(
      r => r.period === currentMonth
    );

    const monthlyUsage = currentUsageRecord
      ? Number(currentUsageRecord.amount)
      : 0;
    const lastMonthReading = meter.lastReading
      ? Number(meter.lastReading) - monthlyUsage
      : 0;
    const currentReading = meter.lastReading ? Number(meter.lastReading) : 0;

    // 计算平均用水量（基于有记录的月份）
    const avgUsage =
      usageRecords.length > 0
        ? usageRecords.reduce((sum, record) => sum + Number(record.amount), 0) /
          usageRecords.length
        : 0;

    // 估算每日平均用水量
    const dailyAvg = monthlyUsage > 0 ? (monthlyUsage / 30).toFixed(1) : '0';

    // 水费估算（假设每立方米3元）
    const waterRate = 3;
    const estimatedCost = monthlyUsage * waterRate;

    return {
      // 水表基本信息
      id: meter.id,
      serialNumber: meter.serialNumber,
      location: meter.location,
      status: meter.status,
      createdAt: meter.createdAt,

      // 用水数据
      lastReading: currentReading,
      lastMonthReading: lastMonthReading,
      monthlyUsage: monthlyUsage,
      dailyAvg: parseFloat(dailyAvg),
      estimatedCost: estimatedCost,

      // 统计信息
      totalUsage: Number(totalUsage.toFixed(2)),
      averageUsage: parseFloat(avgUsage.toFixed(1)),

      // 绑定信息（管理员可以看到）
      bindings: meter.meterBindings.map(binding => ({
        id: binding.id,
        user: binding.user,
        status: binding.status,
        createdAt: binding.createdAt,
      })),

      // 月度记录（用于图表展示）
      monthlyRecords: usageRecords
        .map(record => ({
          period: record.period,
          amount: Number(record.amount),
          cost: Number(record.cost),
        }))
        .reverse(), // 按时间正序排列
    };
  }
}
