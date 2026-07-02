import { Card, Col, Row, Statistic } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';

interface DashboardData { revenue_total: number; revenue_month: number; commission_total: number; join_count: number; bp_unlock_count: number }

export default function DashboardPage() {
  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => get<DashboardData>('/b/finance/dashboard'),
  });

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16}>
        <Col span={6}>
          <Card><Statistic title="累计收入(元)" value={data ? data.revenue_total / 100 : 0} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="本月收入(元)" value={data ? data.revenue_month / 100 : 0} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="加入人次" value={data?.join_count ?? 0} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="BP解锁" value={data?.bp_unlock_count ?? 0} /></Card>
        </Col>
      </Row>
      <Card style={{ marginTop: 16 }} title="说明">
        v0.1 看板骨架。支付/分佣数据在 v0.2 接入后填充。
      </Card>
    </div>
  );
}
