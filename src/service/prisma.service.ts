import { Provide, Scope, ScopeEnum, Init, Destroy } from '@midwayjs/core';
import { PrismaClient } from '@prisma/client';

@Provide()
@Scope(ScopeEnum.Singleton)
export class PrismaService {
  private client: PrismaClient;

  constructor() {
    this.client = new PrismaClient();
    console.log('[Prisma] PrismaService initialized with adapter.');
  }

  get user() {
    return this.client.user;
  }

  get waterMeter() {
    return this.client.waterMeter;
  }

  get meterBinding() {
    return this.client.meterBinding;
  }

  get usageRecord() {
    return this.client.usageRecord;
  }

  get repairTicket() {
    return this.client.repairTicket;
  }

  async $connect() {
    return this.client.$connect();
  }

  async $disconnect() {
    return this.client.$disconnect();
  }

  async $transaction(queries: any) {
    return this.client.$transaction(queries);
  }

  @Init()
  async onInit() {
    try {
      await this.$connect();
      console.log('[Prisma] Database connection established successfully.');
    } catch (error) {
      console.error('[Prisma] Failed to connect to database:', error);
      throw error;
    }
  }

  @Destroy()
  async onStop() {
    await this.$disconnect();
    console.log('[Prisma] Database connection disconnected.');
  }
}
