import { request } from '../../utils/request';

interface ProjectListItem {
  id: number; title: string; one_liner: string;
  category: { id: number; name: string };
  join_mode: string; join_price: number; bp_price: number;
}

Page<{ items: ProjectListItem[]; keyword: string; loading: boolean }, {}>({
  data: { items: [], keyword: '', loading: false },

  onLoad() { this.load(); },

  async load() {
    this.setData({ loading: true });
    try {
      const items = await request<ProjectListItem[]>({
        url: '/c/project',
        data: { keyword: this.data.keyword },
      });
      this.setData({ items: items ?? [], loading: false });
    } catch {
      this.setData({ loading: false });
    }
  },

  onSearch(e: WechatMiniprogram.Input) {
    this.setData({ keyword: e.detail.value }, () => this.load());
  },

  goDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/project-detail/project-detail?id=${id}` });
  },
});
