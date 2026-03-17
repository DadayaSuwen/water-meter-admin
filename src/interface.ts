import { MidwayConfig } from '@midwayjs/core';

/**
 * @description User-Service parameters
 */
export interface IUserOptions {
  uid: number;
}

/**
 * @description Midway Configuration Interface
 */
export interface IMidwayConfig extends MidwayConfig {
  prisma: {
    databaseUrl: string;
  };
}
