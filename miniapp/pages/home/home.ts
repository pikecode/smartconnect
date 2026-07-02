import { request, login } from '../../utils/request';

interface HomeData {
  stats: { total_users: number; recent_viewers: { id: number; nickname: string }[] };
  slogan: string;
  dynamics: { id: number; projectId: number; title: string; content: string }[];
}

interface AppGlobal {
  token: string | null;
}

const app = getApp<{ globalData: AppGlobal }>();

Page<{ home: HomeData | null; loading: boolean }, {}>({
  data: { home: null, loading: true },

  async onLoad() {
    await this.loadHome();
  },

  async loadHome() {
    try {
      if (!app.globalData.token) {
        await login();
      }
      const home = await request<HomeData>({ url: '/c/home' });
      this.setData({ home, loading: false });
    } catch {
      this.setData({ loading: false });
    }
  },

  onPullDownRefresh() {
    this.loadHome().then(() => wx.stopPullDownRefresh());
  },
});
