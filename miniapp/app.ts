interface AppData {
  globalData: {
    apiBase: string;
    token: string | null;
    sceneBId: number | null;
    sceneSig: string | null;
    entrySource: 'platform' | 'b_only';
  };
  setToken: (token: string) => void;
  clearToken: () => void;
  [key: string]: unknown; // index signature for App<T>
}

/** 简单 scene 参数解析(替代 URLSearchParams,兼容小程序) */
function parseScene(scene: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!scene) return result;
  for (const pair of scene.split('&')) {
    const eq = pair.indexOf('=');
    if (eq > 0) {
      result[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1));
    }
  }
  return result;
}

App<AppData>({
  globalData: {
    apiBase: 'http://localhost:13000/api',
    token: null,
    sceneBId: null,
    sceneSig: null,
    entrySource: 'platform',
  },

  onLaunch(options) {
    // 解析 scene (B端专属入口: b=xxx&sig=yyy)
    const rawScene = options.query.scene || options.scene || '';
    const scene = typeof rawScene === 'string' ? rawScene : '';
    const params = parseScene(scene);
    const bId = params['b'];
    const sig = params['sig'];

    if (bId && sig) {
      this.globalData.sceneBId = Number(bId);
      this.globalData.sceneSig = sig;
      this.globalData.entrySource = 'b_only';
    }

    // 尝试恢复 token
    const token = wx.getStorageSync('token') as string;
    if (token) {
      this.globalData.token = token;
    }
  },

  setToken(token: string) {
    this.globalData.token = token;
    wx.setStorageSync('token', token);
  },

  clearToken() {
    this.globalData.token = null;
    wx.removeStorageSync('token');
  },
});

export {};
