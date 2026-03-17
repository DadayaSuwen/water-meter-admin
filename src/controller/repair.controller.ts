import { Controller, Post, Get, Put, Body, Query, Inject, Param } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { JwtMiddleware } from '../middleware/jwt.middleware';
import { AdminMiddleware } from '../middleware/admin.middleware';
import { RepairService } from '../service/domain/repair.service';
import { JwtStrategy } from '../service/auth/jwt.strategy';
import { CreateTicketDTO, UpdateTicketDTO } from '../dto/repair.dto';
import { Validate } from '@midwayjs/validate';
import { TicketStatus } from '@prisma/client';

@Controller('/api/repair')
export class RepairController {
  @Inject()
  ctx: Context;

  @Inject()
  repairService: RepairService;

  @Inject()
  jwtStrategy: JwtStrategy;

  /**
   * 提交报修工单
   */
  @Post('/ticket', { middleware: [JwtMiddleware] })
  @Validate()
  async submitTicket(@Body() ticketData: CreateTicketDTO) {
    try {
      const user = await this.jwtStrategy.extractUser(this.ctx);

      if (!user) {
        return {
          success: false,
          message: '用户未登录'
        };
      }

      const ticket = await this.repairService.submitTicket(user.userId, ticketData);

      return {
        success: true,
        message: '报修工单提交成功',
        data: {
          id: ticket.id,
          meterId: ticket.meterId,
          description: ticket.description,
          images: ticket.images,
          status: ticket.status,
          createdAt: ticket.createdAt
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '提交报修工单失败'
      };
    }
  }

  /**
   * 获取用户的报修记录
   */
  @Get('/tickets', { middleware: [JwtMiddleware] })
  async getUserTickets(
    @Query('status') status?: string,
    @Query('meterId') meterId?: string
  ) {
    try {
      const user = await this.jwtStrategy.extractUser(this.ctx);

      if (!user) {
        return {
          success: false,
          message: '用户未登录'
        };
      }

      const ticketStatus = status as TicketStatus;
      const tickets = await this.repairService.getUserTickets(user.userId, ticketStatus, meterId);

      return {
        success: true,
        data: tickets.map(ticket => ({
          id: ticket.id,
          meter: ticket.meter ? {
            id: ticket.meter.id,
            serialNumber: ticket.meter.serialNumber,
            location: ticket.meter.location
          } : null,
          description: ticket.description,
          images: ticket.images,
          status: ticket.status,
          remark: ticket.remark,
          createdAt: ticket.createdAt
        }))
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取报修记录失败'
      };
    }
  }

  /**
   * 获取所有报修工单（管理员用）
   */
  @Get('/tickets/all', { middleware: [JwtMiddleware, AdminMiddleware] })
  async getAllTickets(@Query('status') status?: string) {
    try {
      const ticketStatus = status as TicketStatus;
      const tickets = await this.repairService.getAllTickets(ticketStatus);

      return {
        success: true,
        data: tickets.map(ticket => ({
          id: ticket.id,
          user: ticket.user ? {
            id: ticket.user.id,
            username: ticket.user.username,
            openid: ticket.user.openid
          } : null,
          meter: ticket.meter ? {
            id: ticket.meter.id,
            serialNumber: ticket.meter.serialNumber,
            location: ticket.meter.location
          } : null,
          description: ticket.description,
          images: ticket.images,
          status: ticket.status,
          remark: ticket.remark,
          handledBy: ticket.handledBy,
          createdAt: ticket.createdAt
        }))
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取报修工单失败'
      };
    }
  }

  /**
   * 获取待处理的报修工单（管理员用）
   */
  @Get('/tickets/pending', { middleware: [JwtMiddleware, AdminMiddleware] })
  async getPendingTickets() {
    try {
      const tickets = await this.repairService.getPendingTickets();

      return {
        success: true,
        data: tickets.map(ticket => ({
          id: ticket.id,
          user: ticket.user ? {
            id: ticket.user.id,
            username: ticket.user.username,
            openid: ticket.user.openid
          } : null,
          meter: ticket.meter ? {
            id: ticket.meter.id,
            serialNumber: ticket.meter.serialNumber,
            location: ticket.meter.location
          } : null,
          description: ticket.description,
          images: ticket.images,
          status: ticket.status,
          createdAt: ticket.createdAt
        }))
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取待处理工单失败'
      };
    }
  }

  /**
   * 更新工单状态（管理员用）
   */
  @Put('/ticket/:ticketId', { middleware: [JwtMiddleware, AdminMiddleware] })
  @Validate()
  async updateTicketStatus(
    @Param('ticketId') ticketId: string,
    @Body() updateData: UpdateTicketDTO
  ) {
    try {
      const adminUser = await this.jwtStrategy.extractUser(this.ctx);

      if (!adminUser) {
        return {
          success: false,
          message: '用户未登录'
        };
      }

      if (!ticketId) {
        return {
          success: false,
          message: '工单ID不能为空'
        };
      }

      const ticket = await this.repairService.updateTicketStatus(
        adminUser.userId,
        ticketId,
        updateData
      );

      return {
        success: true,
        message: `工单状态更新为${updateData.status}`,
        data: {
          id: ticket.id,
          status: ticket.status,
          remark: ticket.remark,
          handledBy: ticket.handledBy
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '更新工单状态失败'
      };
    }
  }

  /**
   * 获取报修统计信息（管理员用）
   */
  @Get('/statistics', { middleware: [JwtMiddleware, AdminMiddleware] })
  async getTicketStatistics() {
    try {
      const statistics = await this.repairService.getTicketStatistics();

      return {
        success: true,
        data: statistics
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取报修统计失败'
      };
    }
  }
}