# 智慧水表小程序后端

基于Midway.js v3 + TypeScript + PostgreSQL + TypeORM的智慧水表小程序后端服务。

## 技术栈

- **框架**: Midway.js v3
- **语言**: TypeScript
- **数据库**: PostgreSQL
- **ORM**: TypeORM
- **认证**: 无状态JWT
- **验证**: Class-validator

## 项目结构

```
src/
├── config/                 # 配置文件
│   └── config.default.ts   # 默认配置
├── controller/             # 控制器层
│   ├── auth.controller.ts  # 认证相关
│   ├── meter.controller.ts # 水表管理
│   ├── usage.controller.ts # 用水记录
│   └── repair.controller.ts # 报修管理
├── dto/                    # 数据传输对象
│   ├── auth.dto.ts         # 认证相关DTO
│   ├── meter.dto.ts        # 水表相关DTO
│   └── repair.dto.ts       # 报修相关DTO
├── entity/                 # 数据库实体
│   ├── user.entity.ts      # 用户实体
│   ├── water-meter.entity.ts # 水表实体
│   ├── meter-binding.entity.ts # 绑定关系实体
│   ├── usage-record.entity.ts # 用水记录实体
│   └── repair-ticket.entity.ts # 报修工单实体
├── guard/                  # 路由守卫
│   ├── auth.guard.ts       # 认证守卫
│   └── admin.guard.ts      # 管理员守卫
├── service/                # 服务层
│   ├── auth/               # 认证服务
│   │   └── jwt.strategy.ts # JWT策略
│   └── domain/             # 业务服务
│       ├── meter.service.ts # 水表服务
│       ├── usage.service.ts # 用水服务
│       └── repair.service.ts # 报修服务
├── middleware/             # 中间件
├── filter/                 # 过滤器
└── configuration.ts        # 应用配置
```

## 数据库设计

### 核心实体

1. **User (用户表)**
   - id: 主键 (UUID)
   - openid: 微信小程序openid (唯一索引)
   - username: 用户名
   - avatar: 头像 (Base64字符串，PostgreSQL text类型)
   - role: 角色 (RESIDENT/ADMIN)
   - created_at: 创建时间

2. **WaterMeter (水表设备表)**
   - id: 主键 (UUID)
   - serial_number: 水表序列号 (唯一)
   - location: 安装位置
   - status: 状态 (NORMAL/FAULTY)
   - last_reading: 最新读数 (Decimal类型)

3. **MeterBinding (绑定关系表)**
   - id: 主键 (UUID)
   - user_id: 用户ID
   - meter_id: 水表ID
   - status: 状态 (PENDING/APPROVED/REJECTED)
   - description: 申请说明
   - reviewed_by: 审核人ID
   - review_remark: 审核备注
   - created_at: 申请时间

4. **UsageRecord (用水记录表)**
   - id: 主键 (UUID)
   - meter_id: 水表ID
   - period: 计费周期 (如2024-01)
   - amount: 用水量 (Decimal)
   - cost: 费用 (Decimal)
   - created_at: 记录创建时间

5. **RepairTicket (报修工单表)**
   - id: 主键 (UUID)
   - user_id: 用户ID
   - meter_id: 水表ID
   - description: 问题描述 (Text)
   - images: 图片列表 (PostgreSQL jsonb类型)
   - status: 状态 (PENDING/PROCESSING/COMPLETED)
   - remark: 处理备注
   - handled_by: 处理人ID
   - created_at: 提交时间

## 安装和运行

### 环境要求

- Node.js >= 12.0.0
- PostgreSQL >= 10

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env` 并配置相关参数：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_DATABASE=water_meter

# JWT配置
JWT_SECRET=your-secret-key-change-in-production

# 环境配置
NODE_ENV=local
```

### 启动服务

开发环境：
```bash
npm run dev
```

生产环境：
```bash
npm run build
npm start
```

## API接口

### 认证相关

- `POST /api/auth/login` - 微信小程序登录
- `GET /api/auth/profile` - 获取用户信息
- `PUT /api/auth/avatar` - 更新头像
- `PUT /api/auth/profile` - 更新用户信息

### 水表管理

- `POST /api/meter/binding` - 申请绑定水表
- `GET /api/meter/bindings` - 获取用户的绑定列表
- `GET /api/meter/bound` - 获取用户已绑定的水表
- `GET /api/meter/bindings/pending` - 获取待审核的绑定列表 (管理员)
- `PUT /api/meter/binding/review` - 审核绑定申请 (管理员)

### 用水记录

- `GET /api/usage/statistics` - 获取用户用水统计
- `GET /api/usage/monthly` - 获取用户月度用水记录
- `GET /api/usage/meter/:meterId` - 获取水表用水历史记录
- `GET /api/usage/average/:meterId` - 计算水表平均用水量

### 报修管理

- `POST /api/repair/ticket` - 提交报修工单
- `GET /api/repair/tickets` - 获取用户的报修记录
- `GET /api/repair/tickets/all` - 获取所有报修工单 (管理员)
- `GET /api/repair/tickets/pending` - 获取待处理的报修工单 (管理员)
- `PUT /api/repair/ticket/:ticketId` - 更新工单状态 (管理员)
- `GET /api/repair/statistics` - 获取报修统计信息 (管理员)

## 核心特性

### 认证机制

- 使用无状态JWT认证
- 支持微信小程序code2Session登录
- 角色权限控制 (居民/管理员)

### 数据库特性

- 利用PostgreSQL的text类型存储Base64头像
- 使用jsonb类型存储图片数组，提供更好的查询性能
- 支持事务处理确保数据一致性

### 业务逻辑

- 水表绑定申请和审核流程
- 用水记录统计和平均值计算
- 报修工单管理系统
- 完整的权限控制和数据验证

## 部署说明

1. 确保PostgreSQL数据库已创建
2. 配置环境变量
3. 运行数据库迁移 (如果需要)
4. 启动服务

## 许可证

MIT