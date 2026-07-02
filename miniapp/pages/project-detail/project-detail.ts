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
      await request({ url: `/c/project/${this.data.id}/join`, method: 'POST' });
      wx.showToast({ title: '加入成功', icon: 'success' });
      this.loadDetail(this.data.id);
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
