import { request } from '../../utils/request';

interface ProjectDetail {
  id: number; title: string; one_liner: string; intro: string | null;
  vision: string | null; goals: string | null; team: string | null;
  technology: string | null; competition: string | null; requirements: string | null;
  swot: unknown; company_info: unknown; qcc_url: string | null;
  founder_intro: string | null; origin_story: string | null;
  join_requirement: string | null; join_mode: string; join_price: number;
  score: { authenticity: number; risk: number; profitability: number; review_count: number } | null;
  bp: { locked: boolean; price: number };
  is_favorited: boolean; is_joined: boolean;
  contact?: { name: string | null; phone: string | null; wechat: string | null };
}

Page<{ detail: ProjectDetail | null; id: number }, {}>({
  data: { detail: null, id: 0 },

  onLoad(options: { id?: string }) {
    const id = Number(options.id || '0');
    this.setData({ id });
    this.loadDetail(id);
  },

  async loadDetail(id: number) {
    try {
      const detail = await request<ProjectDetail>({ url: `/c/project/${id}` });
      this.setData({ detail });
    } catch { /* toast 已在 request 内 */ }
  },

  async toggleFavorite() {
    const { id, detail } = this.data;
    if (!detail) return;
    if (detail.is_favorited) {
      await request({ url: `/c/project/${id}/favorite`, method: 'DELETE' });
    } else {
      await request({ url: `/c/project/${id}/favorite`, method: 'POST' });
    }
    this.setData({ detail: { ...detail, is_favorited: !detail.is_favorited } });
  },

  async joinProject() {
    try {
      const res = await request<{ joined: boolean; requires_payment?: boolean; project_id?: number }>({
        url: `/c/project/${this.data.id}/join`, method: 'POST',
      });
      if ((res as { requires_payment?: boolean }).requires_payment) {
        // 付费加入: 先下单再调起支付
        await this.requestPayment('join_project');
      } else {
        wx.showToast({ title: '加入成功', icon: 'success' });
        this.loadDetail(this.data.id);
      }
    } catch { /* toast 内 */ }
  },

  async unlockBp() {
    await this.requestPayment('bp_unlock');
  },

  async requestPayment(type: 'join_project' | 'bp_unlock') {
    try {
      const order = await request<{ orderId: number; payParams: { appId: string; timeStamp: string; nonceStr: string; package: string; signType: string; paySign: string } }>({
        url: '/c/pay/order', method: 'POST',
        data: { type, project_id: this.data.id },
      });
      wx.requestPayment({
        timeStamp: order.payParams.timeStamp,
        nonceStr: order.payParams.nonceStr,
        package: order.payParams.package,
        signType: order.payParams.signType as 'RSA',
        paySign: order.payParams.paySign,
        success: () => { wx.showToast({ title: '支付成功', icon: 'success' }); this.loadDetail(this.data.id); },
        fail: (e) => { if ((e as { errMsg: string }).errMsg !== 'requestPayment:fail cancel') wx.showToast({ title: '支付失败', icon: 'none' }); },
      });
    } catch { /* toast 内 */ }
  },

  goQcc() {
    const url = this.data.detail?.qcc_url;
    if (url) {
      wx.setClipboardData({ data: url });
      wx.showToast({ title: '链接已复制', icon: 'success' });
    }
  },
});
