import { Provide } from '@midwayjs/core';
import axios from 'axios';

export interface WxSessionResponse {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

@Provide()
export class WxService {
  private appId: string;
  private appSecret: string;

  constructor() {
    // 直接从环境变量获取微信小程序配置
    this.appId = process.env.WX_APP_ID || '';
    this.appSecret = process.env.WX_APP_SECRET || '';

    // 调试日志
    console.log('WxService 初始化 - appId:', this.appId ? '已配置' : '未配置');
    console.log('WxService 初始化 - appSecret:', this.appSecret ? '已配置' : '未配置');
  }

  /**
   * 通过code获取微信session信息
   * @param code 微信登录code
   * @returns 微信session信息
   */
  async code2Session(code: string): Promise<WxSessionResponse> {
    try {
      const url = 'https://api.weixin.qq.com/sns/jscode2session';
      const params = {
        appid: this.appId,
        secret: this.appSecret,
        js_code: code,
        grant_type: 'authorization_code',
      };

      const response = await axios.get(url, { params });
      const data = response.data;

      // 检查微信API返回的错误
      if (data.errcode) {
        throw new Error(
          `微信API错误: ${data.errmsg || '未知错误'} (错误码: ${data.errcode})`
        );
      }

      return {
        openid: data.openid,
        session_key: data.session_key,
        unionid: data.unionid,
      };
    } catch (error) {
      console.error('获取微信session失败:', error);
      throw new Error(`微信登录失败: ${error.message}`);
    }
  }

  /**
   * 验证微信小程序配置是否完整
   */
  validateConfig(): boolean {
    return !!(this.appId && this.appSecret);
  }

  /**
   * 获取微信配置状态
   */
  getConfigStatus() {
    return {
      appId: this.appId ? '已配置' : '未配置',
      appSecret: this.appSecret ? '已配置' : '未配置',
      isComplete: this.validateConfig(),
      message: this.validateConfig()
        ? '微信配置完整，可以使用真实微信登录'
        : '微信配置不完整，当前使用开发模式',
    };
  }
}
