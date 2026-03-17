import { Provide, Inject } from '@midwayjs/core';
import { PrismaService } from '../prisma.service';
import { TicketStatus, BindingStatus } from '@prisma/client';

export interface CreateTicketDTO {
  meterId: string;
  description: string;
  images?: string[];
}

export interface UpdateTicketDTO {
  status: TicketStatus;
  remark?: string;
}

@Provide()
export class RepairService {
  @Inject()
  prisma: PrismaService;

  /**
   * 提交报修工单
   */
  async submitTicket(userId: string, ticketData: CreateTicketDTO): Promise<any> {
    // 验证水表存在
    const meter = await this.prisma.waterMeter.findUnique({
      where: { id: ticketData.meterId }
    });

    if (!meter) {
      throw new Error('水表不存在');
    }

    // 验证用户是否绑定了该水表
    const binding = await this.prisma.meterBinding.findFirst({
      where: {
        userId,
        meterId: ticketData.meterId,
        status: BindingStatus.APPROVED
      }
    });

    if (!binding) {
      throw new Error('您未绑定此水表，无法提交报修');
    }

    // 检查是否有未处理的相同水表报修
    const existingTicket = await this.prisma.repairTicket.findFirst({
      where: {
        userId,
        meterId: ticketData.meterId,
        status: {
          in: [TicketStatus.PENDING, TicketStatus.PROCESSING]
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existingTicket) {
      throw new Error('该水表已有未处理的报修工单，请勿重复提交');
    }

    // 创建报修工单
    return await this.prisma.repairTicket.create({
      data: {
        userId,
        meterId: ticketData.meterId,
        description: ticketData.description,
        images: ticketData.images || [],
        status: TicketStatus.PENDING,
      }
    });
  }

  /**
   * 获取用户的报修记录
   */
  async getUserTickets(userId: string, status?: TicketStatus, meterId?: string): Promise<any[]> {
    const whereCondition: any = { userId };
    if (status) {
      whereCondition.status = status;
    }
    if (meterId) {
      whereCondition.meterId = meterId;
    }

    return await this.prisma.repairTicket.findMany({
      where: whereCondition,
      include: {
        waterMeter: true,
        user: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * 获取所有报修工单（管理员用）
   */
  async getAllTickets(status?: TicketStatus): Promise<any[]> {
    const whereCondition: any = {};
    if (status) {
      whereCondition.status = status;
    }

    return await this.prisma.repairTicket.findMany({
      where: whereCondition,
      include: {
        waterMeter: true,
        user: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * 获取待处理的报修工单
   */
  async getPendingTickets(): Promise<any[]> {
    return await this.prisma.repairTicket.findMany({
      where: { status: TicketStatus.PENDING },
      include: {
        waterMeter: true,
        user: true
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * 更新工单状态（管理员用）
   */
  async updateTicketStatus(
    adminId: string,
    ticketId: string,
    updateData: UpdateTicketDTO
  ): Promise<any> {
    const ticket = await this.prisma.repairTicket.findUnique({
      where: { id: ticketId },
      include: {
        waterMeter: true
      }
    });

    if (!ticket) {
      throw new Error('报修工单不存在');
    }

    // 验证状态转换是否合法
    if (ticket.status === TicketStatus.COMPLETED) {
      throw new Error('已完成的工单无法再次更新');
    }

    if (ticket.status === TicketStatus.PENDING && updateData.status === 'COMPLETED') {
      throw new Error('工单必须先处理才能完成');
    }

    // 更新工单
    return await this.prisma.repairTicket.update({
      where: { id: ticketId },
      data: {
        status: updateData.status as TicketStatus,
        remark: updateData.remark || '',
        handledBy: adminId
      }
    });
  }

  /**
   * 获取工单详情
   */
  async getTicketDetail(ticketId: string): Promise<any> {
    const ticket = await this.prisma.repairTicket.findUnique({
      where: { id: ticketId },
      include: {
        waterMeter: true,
        user: true
      }
    });

    if (!ticket) {
      throw new Error('报修工单不存在');
    }

    return ticket;
  }

  /**
   * 获取统计信息（管理员用）
   */
  async getTicketStatistics(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
  }> {
    const [total, pending, processing, completed] = await Promise.all([
      this.prisma.repairTicket.count(),
      this.prisma.repairTicket.count({
        where: { status: TicketStatus.PENDING }
      }),
      this.prisma.repairTicket.count({
        where: { status: TicketStatus.PROCESSING }
      }),
      this.prisma.repairTicket.count({
        where: { status: TicketStatus.COMPLETED }
      })
    ]);

    return {
      total,
      pending,
      processing,
      completed
    };
  }
}