Component({
  properties: {
    authenticity: { type: Number, value: 50 },
    risk: { type: Number, value: 50 },
    profitability: { type: Number, value: 50 },
    reviewCount: { type: Number, value: 0 },
  },
  data: {
    bars: [] as { label: string; percent: number; color: string; warning: boolean }[],
  },
  observers: {
    'authenticity, risk, profitability, reviewCount': function (auth: number, risk: number, profit: number, count: number) {
      this.setData({
        bars: [
          { label: '真实性', percent: auth, color: '#34a853', warning: false },
          { label: '风险性', percent: risk, color: '#ea4335', warning: risk >= 70 },
          { label: '盈利性', percent: profit, color: '#fbbc05', warning: false },
        ],
        reviewCountLabel: count < 3 ? '平台评分' : `${count}人评价`,
      });
    },
  },
});
