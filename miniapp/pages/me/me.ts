import { request } from '../../utils/request';

interface MeData {
  user: { id: number; phone: string | null; nickname: string | null };
  entry_source: string | null;
}

interface FavoriteItem { project_id: number; title: string; }
interface JoinedItem { project_id: number; title: string; joined_at: string; unlock_contact: boolean; }
interface ReferralItem { user_id: number; nickname: string | null; joined_count: number; }

Page<{
  me: MeData | null;
  tab: 'favorites' | 'joined' | 'referrals';
  favorites: FavoriteItem[];
  joined: JoinedItem[];
  referrals: ReferralItem[];
}, {}>({
  data: {
    me: null, tab: 'favorites',
    favorites: [], joined: [], referrals: [],
  },

  onLoad() { this.loadMe(); this.loadTab('favorites'); },

  async loadMe() {
    try { const me = await request<MeData>({ url: '/c/me' }); this.setData({ me }); }
    catch { /* 未登录 */ }
  },

  async switchTab(e: WechatMiniprogram.TouchEvent) {
    const tab = e.currentTarget.dataset.tab as 'favorites' | 'joined' | 'referrals';
    this.setData({ tab });
    await this.loadTab(tab);
  },

  async loadTab(tab: 'favorites' | 'joined' | 'referrals') {
    try {
      if (tab === 'favorites') {
        const res = await request<{ items: FavoriteItem[] }>({ url: '/c/me/favorites' });
        this.setData({ favorites: res.items });
      } else if (tab === 'joined') {
        const res = await request<{ items: JoinedItem[] }>({ url: '/c/me/joined' });
        this.setData({ joined: res.items });
      } else {
        const res = await request<{ items: ReferralItem[] }>({ url: '/c/me/referrals' });
        this.setData({ referrals: res.items });
      }
    } catch { /* */ }
  },
});
