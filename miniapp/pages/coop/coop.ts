import { request } from '../../utils/request';

interface Center { id: number; city_name: string; address: string | null; contact_name: string | null; contact_phone: string | null; }

Page<{ centers: Center[] }, {}>({
  data: { centers: [] },
  async onLoad() {
    try {
      const res = await request<{ items: Center[] }>({ url: '/c/coop/city-centers' });
      this.setData({ centers: res.items });
    } catch { /* */ }
  },
  async joinCircle(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as number;
    try { await request({ url: `/c/coop/city-centers/${id}/join`, method: 'POST' }); wx.showToast({ title: '入圈成功', icon: 'success' }); }
    catch { /* toast 内 */ }
  },
  applyPartner(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as number;
    wx.showModal({
      title: '申请合伙人', content: '填写信息后提交申请', showCancel: true,
      success: async (r) => {
        if (!r.confirm) return;
        try { await request({ url: `/c/coop/city-centers/${id}/partner-apply`, method: 'POST', data: { name: '', phone: '' } }); wx.showToast({ title: '申请已提交', icon: 'success' }); }
        catch { /* */ }
      },
    });
  },
});
