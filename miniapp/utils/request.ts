interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: Record<string, unknown> | string;
  auth?: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  meta: { pagination?: { page: number; page_size: number; total: number } } | null;
}

interface AppGlobal {
  apiBase: string;
  token: string | null;
  sceneBId: number | null;
  sceneSig: string | null;
  entrySource: 'platform' | 'b_only';
}

const app = getApp<{ globalData: AppGlobal; setToken(t: string): void }>();

export function request<T>(opts: RequestOptions): Promise<T> {
  const header: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth !== false && app.globalData.token) {
    header.Authorization = `Bearer ${app.globalData.token}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBase}${opts.url}`,
      method: opts.method ?? 'GET',
      data: opts.data,
      header,
      success: (res) => {
        const body = res.data as ApiResponse<T>;
        if (body.success && body.data !== null) {
          resolve(body.data);
        } else {
          const msg = body.error?.message ?? '请求失败';
          wx.showToast({ title: msg, icon: 'none' });
          reject(new Error(msg));
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络错误', icon: 'none' });
        reject(err);
      },
    });
  });
}

export function login(): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.login({
      success: async (res) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _reApp = app; // use top-level typed app
          const result = await request<{ token: string; user: { id: number; isNew: boolean } }>({
            url: '/c/auth/wx-login',
            method: 'POST',
            auth: false,
            data: {
              code: res.code,
              ...(app.globalData.sceneBId ? {
                sceneBId: app.globalData.sceneBId,
                sceneSig: app.globalData.sceneSig,
              } : {}),
            },
          });
          app.setToken(result.token);
          resolve();
        } catch (e) {
          reject(e);
        }
      },
      fail: reject,
    });
  });
}
