import {
  Controller,
  Post,
  Get,
  Put,
  Del,
  Body,
  Inject,
  Query,
} from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { JwtMiddleware } from '../middleware/jwt.middleware';
import { AdminMiddleware } from '../middleware/admin.middleware';
import { MeterService } from '../service/domain/meter.service';
import { PrismaService } from '../service/prisma.service';
import { JwtStrategy } from '../service/auth/jwt.strategy';
import { CreateBindingDTO, ReviewBindingDTO } from '../dto/meter.dto';
import { Validate } from '@midwayjs/validate';
import { MeterStatus } from '@prisma/client';

@Controller('/api/meter')
export class MeterController {
  @Inject()
  ctx: Context;

  @Inject()
  meterService: MeterService;

  @Inject()
  prisma: PrismaService;

  @Inject()
  jwtStrategy: JwtStrategy;

  /**
   * 申请绑定水表
   */
  @Post('/binding', { middleware: [JwtMiddleware] })
  @Validate()
  async applyBinding(@Body() bindingData: CreateBindingDTO) {
    try {
      const user = await this.jwtStrategy.extractUser(this.ctx);

      if (!user) {
        return {
          success: false,
          message: '用户未登录',
        };
      }

      const binding = await this.meterService.applyBinding(
        user.userId,
        bindingData
      );

      // 获取水表信息以返回serialNumber，使用bindingData中的serialNumber作为后备
      let meter = null;
      if (binding.meterId) {
        meter = await this.prisma.waterMeter.findUnique({
          where: { id: binding.meterId },
        });
      } else {
        // 如果binding.meterId为空，直接通过serialNumber查找
        meter = await this.prisma.waterMeter.findUnique({
          where: { serialNumber: bindingData.serialNumber },
        });
      }

      return {
        success: true,
        message: '绑定申请提交成功',
        data: {
          id: binding.id,
          serialNumber: meter?.serialNumber || bindingData.serialNumber,
          meterId: binding.meterId,
          status: binding.status,
          description: binding.description,
          createdAt: binding.createdAt,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '绑定申请失败',
      };
    }
  }

  /**
   * 获取用户的绑定列表
   */
  @Get('/bindings', { middleware: [JwtMiddleware] })
  async getUserBindings() {
    try {
      const user = await this.jwtStrategy.extractUser(this.ctx);

      if (!user) {
        return {
          success: false,
          message: '用户未登录',
        };
      }

      const bindings = await this.meterService.getUserBindings(user.userId);

      return {
        success: true,
        data: bindings.map(binding => ({
          id: binding.id,
          meterId: binding.meterId,
          meter: binding.meter
            ? {
                id: binding.meter.id,
                serialNumber: binding.meter.serialNumber,
                location: binding.meter.location,
                status: binding.meter.status,
                lastReading: binding.meter.lastReading,
              }
            : null,
          status: binding.status,
          description: binding.description,
          reviewRemark: binding.reviewRemark,
          createdAt: binding.createdAt,
        })),
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取绑定列表失败',
      };
    }
  }

  /**
   * 获取用户已绑定的水表
   */
  @Get('/bound', { middleware: [JwtMiddleware] })
  async getUserBoundMeters() {
    try {
      const user = await this.jwtStrategy.extractUser(this.ctx);

      if (!user) {
        return {
          success: false,
          message: '用户未登录',
        };
      }

      const meters = await this.meterService.getUserBoundMeters(user.userId);

      return {
        success: true,
        data: meters.map(meter => ({
          id: meter.id,
          serialNumber: meter.serialNumber,
          location: meter.location,
          status: meter.status,
          lastReading: meter.lastReading,
        })),
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取绑定水表失败',
      };
    }
  }

  /**
   * 获取待审核的绑定列表（管理员用）
   */
  @Get('/bindings/pending', { middleware: [JwtMiddleware, AdminMiddleware] })
  async getPendingBindings() {
    try {
      const bindings = await this.meterService.getPendingBindings();

      return {
        success: true,
        data: bindings.map(binding => ({
          id: binding.id,
          user: {
            id: binding.user.id,
            openid: binding.user.openid,
            username: binding.user.username,
          },
          // 修改下面这一块，使用 waterMeter
          meter: {
            id: binding.waterMeter.id, // 改为 binding.waterMeter
            serialNumber: binding.waterMeter.serialNumber, // 改为 binding.waterMeter
            location: binding.waterMeter.location, // 改为 binding.waterMeter
            status: binding.waterMeter.status, // 改为 binding.waterMeter
          },
          description: binding.description,
          createdAt: binding.createdAt,
        })),
      };
    } catch (error) {
      // ...
    }
  }

  /**
   * 审核绑定申请（管理员用）
   */
  @Put('/binding/review', { middleware: [JwtMiddleware, AdminMiddleware] })
  @Validate()
  async reviewBinding(@Body() reviewData: ReviewBindingDTO) {
    try {
      const adminUser = await this.jwtStrategy.extractUser(this.ctx);

      if (!adminUser) {
        return {
          success: false,
          message: '用户未登录',
        };
      }

      const binding = await this.meterService.reviewBinding(
        adminUser.userId,
        reviewData
      );

      return {
        success: true,
        message: `绑定申请${
          reviewData.status === 'APPROVED' ? '通过' : '拒绝'
        }`,
        data: {
          id: binding.id,
          status: binding.status,
          reviewRemark: binding.reviewRemark,
          reviewedBy: binding.reviewedBy,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '审核失败',
      };
    }
  }

  /**
   * 获取所有水表列表（管理员用）
   */
  @Get('/all', { middleware: [JwtMiddleware, AdminMiddleware] })
  async getAllMeters(@Query('status') status?: MeterStatus) {
    try {
      const meters = await this.meterService.getAllMeters(status);

      return {
        success: true,
        data: meters,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取水表列表失败',
      };
    }
  }

  /**
   * 获取水表详情
   */
  @Get('/:meterId', { middleware: [JwtMiddleware] })
  async getMeterDetail() {
    try {
      const user = await this.jwtStrategy.extractUser(this.ctx);
      const meterId = this.ctx.params.meterId;

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

      let meterDetail;

      // 管理员可以查看任意水表详情
      if (user.role === 'ADMIN') {
        meterDetail = await this.meterService.getMeterDetailForAdmin(meterId);
      } else {
        // 普通用户只能查看已绑定的水表
        meterDetail = await this.meterService.getMeterDetail(
          user.userId,
          meterId
        );
      }

      return {
        success: true,
        data: meterDetail,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取水表详情失败',
      };
    }
  }

  /**
   * 创建水表（管理员用）
   */
  @Post('/create', { middleware: [JwtMiddleware, AdminMiddleware] })
  @Validate()
  async createMeter(@Body() meterData: any) {
    try {
      const meter = await this.meterService.createMeter(meterData);

      return {
        success: true,
        message: '水表创建成功',
        data: meter,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '创建水表失败',
      };
    }
  }

  /**
   * 更新水表信息（管理员用）
   */
  @Put('/:meterId/update', { middleware: [JwtMiddleware, AdminMiddleware] })
  @Validate()
  async updateMeter(@Body() meterData: any) {
    try {
      const meterId = this.ctx.params.meterId;
      console.log('更新水表 - meterId:', meterId);
      console.log('更新水表 - ctx.params:', this.ctx.params);

      if (!meterId) {
        return {
          success: false,
          message: '水表ID不能为空',
        };
      }

      const meter = await this.meterService.updateMeter(meterId, meterData);

      return {
        success: true,
        message: '水表更新成功',
        data: meter,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '更新水表失败',
      };
    }
  }

  /**
   * 删除水表（管理员用）
   */
  @Del('/:meterId', { middleware: [JwtMiddleware, AdminMiddleware] })
  async deleteMeter() {
    try {
      console.log('删除水表请求 - 完整ctx:', this.ctx);
      console.log('删除水表请求 - URL:', this.ctx.url);
      console.log('删除水表请求 - method:', this.ctx.method);
      console.log('删除水表请求 - params:', this.ctx.params);

      const meterId = this.ctx.params.meterId;
      console.log('删除水表 - meterId:', meterId);

      if (!meterId) {
        console.log('删除水表错误 - meterId为空');
        return {
          success: false,
          message: '水表ID不能为空',
        };
      }

      await this.meterService.deleteMeter(meterId);

      return {
        success: true,
        message: '水表删除成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '删除水表失败',
      };
    }
  }

  /**
   * 获取水表列表 (前端格式) - 管理员 Dashboard 用
   * 返回前端页面需要的完整数据格式
   */
  @Get('/list', { middleware: [JwtMiddleware, AdminMiddleware] })
  async getMeterListForFrontend() {
    try {
      const meters = await this.meterService.getMetersForFrontend();

      return {
        success: true,
        data: meters,
        total: meters.length,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取水表列表失败',
      };
    }
  }

  /**
   * 模拟：实时抄表
   * 请求路径: POST /api/meter/:meterId/read
   */
  @Post('/:meterId/read', { middleware: [JwtMiddleware, AdminMiddleware] })
  async readMeterRealtime() {
    try {
      const meterId = this.ctx.params.meterId;

      if (!meterId) {
        return {
          success: false,
          message: '水表ID不能为空',
        };
      }

      // 1. 查询当前水表
      const meter = await this.prisma.waterMeter.findUnique({
        where: { id: meterId },
      });

      if (!meter) {
        return {
          success: false,
          message: '找不到该水表设备',
        };
      }

      // 2. 模拟物联网 NB-IoT 通信延迟 (1 ~ 2.5秒随机延时)
      const delay = Math.floor(Math.random() * 1500) + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // 3. 模拟读数增长（在原有读数基础上增加 0.1 ~ 2.5 吨）
      const currentReading = Number(meter.lastReading || 0);
      const increment = Number((Math.random() * 2.4 + 0.1).toFixed(2));
      const newReading = Number((currentReading + increment).toFixed(2));

      // 4. 将新读数更新到数据库
      await this.prisma.waterMeter.update({
        where: { id: meterId },
        data: {
          lastReading: newReading,
        },
      });

      return {
        success: true,
        message: '实时抄表成功',
        data: {
          id: meterId,
          reading: newReading, // 最新读数
          increment: increment, // 本次增加量
          readAt: new Date(), // 抄表时间
        },
      };
    } catch (error) {
      console.error('实时抄表失败:', error);
      return {
        success: false,
        message: error.message || '设备响应超时，抄表失败',
      };
    }
  }

  /**
   * 模拟：远程控制水阀 (开阀/关阀)
   * 请求路径: POST /api/meter/:meterId/valve
   */
  @Post('/:meterId/valve', { middleware: [JwtMiddleware, AdminMiddleware] })
  async controlValve(@Body() data: { action: 'open' | 'close' }) {
    try {
      const meterId = this.ctx.params.meterId;
      const { action } = data; // 前端传过来的操作指令

      if (!meterId) {
        return {
          success: false,
          message: '水表ID不能为空',
        };
      }

      // 1. 查询水表
      const meter = await this.prisma.waterMeter.findUnique({
        where: { id: meterId },
      });

      if (!meter) {
        return {
          success: false,
          message: '找不到该水表设备',
        };
      }

      // 2. 模拟物联网设备指令下发延迟 (1.5秒左右)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 3. (可选) 更新数据库状态
      // 如果你的 Prisma schema 中有关于阀门状态或设备状态的字段（比如 status），可以在这里修改
      // 假设 status 字段包含 'NORMAL' (正常开阀) 和 'MAINTENANCE' (维护关阀)
      /*
      await this.prisma.waterMeter.update({
        where: { id: meterId },
        data: {
          status: action === 'open' ? 'NORMAL' : 'MAINTENANCE',
        },
      });
      */

      const actionText = action === 'open' ? '开启' : '关闭';

      return {
        success: true,
        message: `水表阀门已成功远程${actionText}`,
        data: {
          id: meterId,
          action: action,
          executedAt: new Date(),
        },
      };
    } catch (error) {
      console.error('远程控阀失败:', error);
      return {
        success: false,
        message: error.message || '指令下发失败，请重试',
      };
    }
  }
}
