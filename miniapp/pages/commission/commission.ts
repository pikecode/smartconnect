import { request } from '../../utils/request';

interface CommissionItem { id: number; order_id: number; amount: number; rate: number; status: string; created_at: string; }
interface Summary { pending: number; settled: number; withdrawable: number; }

Page<{ items: CommissionItem[]; summary: Summary | null }, {}>({
  data: { items: [], summary: null },

  async onLoad() {
    try {
      const res = await request<{ items: CommissionItem[]; summary: Summary }>({ url: '/c/me/commissions' });
      this.setData({ items: res.items, summary: res.summary });
    } catch { /* */ }
  },

  goWithdraw() {
    wx.showToast({ title: '提现功能开发中', icon: 'none' });
  },
});
