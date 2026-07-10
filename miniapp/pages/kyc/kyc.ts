import { request } from '../../utils/request';

Page<{ realName: string; idCard: string; loading: boolean; status: string | null }, {}>({
  data: { realName: '', idCard: '', loading: false, status: null },

  onLoad() {
    request<{ status: string | null; verified_at: string | null }>({ url: '/c/me/kyc/status' })
      .then((r) => this.setData({ status: r.status }))
      .catch(() => {});
  },

  onNameInput(e: WechatMiniprogram.Input) { this.setData({ realName: e.detail.value }); },
  onIdCardInput(e: WechatMiniprogram.Input) { this.setData({ idCard: e.detail.value }); },

  async submit() {
    const { realName, idCard } = this.data;
    if (!realName || !idCard) { wx.showToast({ title: '请填写完整', icon: 'none' }); return; }
    this.setData({ loading: true });
    try {
      await request({ url: '/c/me/kyc', method: 'POST', data: { real_name: realName, id_card: idCard } });
      wx.showToast({ title: '提交成功，等待审核', icon: 'success' });
      this.setData({ status: 'pending' });
    } catch { /* toast 内 */ } finally { this.setData({ loading: false }); }
  },
});
