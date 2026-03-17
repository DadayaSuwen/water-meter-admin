import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
const prisma = new PrismaClient({});

async function main() {
  // 💡 连接 pgClient
  console.log('PostgreSQL 驱动已连接，开始生成种子数据...');

  // 清理现有数据（可选，根据需要）
  console.log('清理现有数据...');
  await prisma.repairTicket.deleteMany();
  await prisma.usageRecord.deleteMany();
  await prisma.meterBinding.deleteMany();
  await prisma.waterMeter.deleteMany();
  await prisma.user.deleteMany();

  // 创建管理员用户 (密码: admin123)
  console.log('创建管理员用户...');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      openid: 'admin_openid_001',
      username: '系统管理员',
      phone: '13800138000',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  // 创建居民用户
  console.log('创建居民用户...');
  const resident1 = await prisma.user.create({
    data: {
      openid: 'resident_openid_001',
      username: '张三',
      phone: '13800138001',
      role: 'RESIDENT',
    },
  });

  const resident2 = await prisma.user.create({
    data: {
      openid: 'resident_openid_002',
      username: '李四',
      phone: '13800138002',
      role: 'RESIDENT',
    },
  });

  const resident3 = await prisma.user.create({
    data: {
      openid: 'resident_openid_003',
      username: '王五',
      phone: '13800138003',
      role: 'RESIDENT',
    },
  });

  // 创建水表
  console.log('创建水表...');
  const waterMeters = await Promise.all([
    prisma.waterMeter.create({
      data: {
        serialNumber: 'WM001',
        location: 'A栋1单元101室',
        lastReading: 1250.5,
        status: 'NORMAL',
      },
    }),
    prisma.waterMeter.create({
      data: {
        serialNumber: 'WM002',
        location: 'A栋1单元102室',
        lastReading: 980.25,
        status: 'NORMAL',
      },
    }),
    prisma.waterMeter.create({
      data: {
        serialNumber: 'WM003',
        location: 'A栋2单元201室',
        lastReading: 1567.8,
        status: 'NORMAL',
      },
    }),
    prisma.waterMeter.create({
      data: {
        serialNumber: 'WM004',
        location: 'B栋1单元301室',
        lastReading: 2100.0,
        status: 'FAULTY',
      },
    }),
    prisma.waterMeter.create({
      data: {
        serialNumber: 'WM005',
        location: 'B栋2单元401室',
        lastReading: 750.3,
        status: 'NORMAL',
      },
    }),
  ]);

  // 创建水表绑定关系（部分已审批，部分待审核）
  console.log('创建水表绑定关系...');
  await Promise.all([
    // 已审批的绑定
    prisma.meterBinding.create({
      data: {
        userId: resident1.id,
        meterId: waterMeters[0].id, // WM001
        status: 'APPROVED',
        description: '业主申请绑定',
        reviewedBy: admin.id,
        reviewRemark: '审核通过',
      },
    }),
    prisma.meterBinding.create({
      data: {
        userId: resident2.id,
        meterId: waterMeters[1].id, // WM002
        status: 'APPROVED',
        description: '业主申请绑定',
        reviewedBy: admin.id,
        reviewRemark: '审核通过',
      },
    }),
    // 待审核的绑定
    prisma.meterBinding.create({
      data: {
        userId: resident3.id,
        meterId: waterMeters[2].id, // WM003
        status: 'PENDING',
        description: '新业主申请绑定水表',
      },
    }),
  ]);

  // 创建用水记录
  console.log('创建用水记录...');
  const months = ['2024-08', '2024-09', '2024-10', '2024-11'];

  for (const meter of waterMeters.slice(0, 3)) {
    // 只为前3个正常水表创建用水记录
    for (let i = 0; i < months.length; i++) {
      const usageAmount = Math.floor(Math.random() * 50) + 10; // 10-60吨
      const unitPrice = 3.5; // 每吨3.5元
      const cost = usageAmount * unitPrice;

      await prisma.usageRecord.create({
        data: {
          meterId: meter.id,
          period: months[i],
          amount: usageAmount,
          cost: cost,
        },
      });
    }
  }

  // 创建报修工单
  console.log('创建报修工单...');
  await Promise.all([
    // 待处理的工单
    prisma.repairTicket.create({
      data: {
        userId: resident1.id,
        meterId: waterMeters[0].id,
        description: '水表显示异常，数字模糊不清',
        status: 'PENDING',
        images: [
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...',
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...',
        ],
      },
    }),
    // 处理中的工单
    prisma.repairTicket.create({
      data: {
        userId: resident2.id,
        meterId: waterMeters[1].id,
        description: '水表漏水，需要紧急处理',
        status: 'PROCESSING',
        remark: '已联系维修人员，预计今天下午上门',
        handledBy: admin.id,
        images: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...'],
      },
    }),
    // 已完成的工单
    prisma.repairTicket.create({
      data: {
        userId: resident1.id,
        meterId: waterMeters[2].id,
        description: '水表更换电池',
        status: 'COMPLETED',
        remark: '已更换新电池，水表正常工作',
        handledBy: admin.id,
      },
    }),
  ]);

  console.log('种子数据生成完成！');
  console.log('\n=== 生成的数据概览 ===');
  console.log(`管理员用户: 1个 (账号: 系统管理员, 密码: admin123)`);
  console.log(`居民用户: 3个`);
  console.log(`水表: 5个 (4个正常, 1个故障)`);
  console.log(`绑定关系: 3个 (2个已审批, 1个待审核)`);
  console.log(`用水记录: ${waterMeters.length * 4}条`);
  console.log(`报修工单: 3个 (1个待处理, 1个处理中, 1个已完成)`);
  console.log('\n=== 登录信息 ===');
  console.log('Web后台管理员登录: 用户名: 系统管理员, 密码: admin123');
  console.log(
    '居民用户OpenID: resident_openid_001, resident_openid_002, resident_openid_003'
  );
}

main()
  .catch(async e => {
    console.error('种子数据生成失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    // 🚨 关键：使用 prisma.$disconnect() 优雅地关闭连接池
    // 适配器现在依赖 Prisma Client 管理生命周期
    await prisma.$disconnect();
  });
