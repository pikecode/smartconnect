import { request } from '../../utils/request';

interface UserItem { user_id: number; nickname: string | null; resources: { id: number; type: string; content: string }[]; }

Page<{ items: UserItem[]; keyword: string }, {}>({
  data: { items: [], keyword: '' },
  async onLoad() { this.load(); },
  async load() {
    try {
      const res = await request<{ items: UserItem[] }>({ url: '/c/resource', data: { keyword: this.data.keyword } });
      this.setData({ items: res.items });
    } catch { /* */ }
  },
  onSearch(e: WechatMiniprogram.Input) { this.setData({ keyword: e.detail.value }, () => this.load()); },
  async requestSwap(e: WechatMiniprogram.TouchEvent) {
    const uid = e.currentTarget.dataset.uid as number;
    try {
      await request({ url: '/c/resource/swap', method: 'POST', data: { to_user_id: uid } });
      wx.showToast({ title: '申请已发送', icon: 'success' });
    } catch { /* toast 内 */ }
  },
});
