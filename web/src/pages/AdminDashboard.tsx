import { Card, Row, Col, Statistic } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';

interface AdminDashboard { bCount: number; cCount: number; projectCount: number; revenueTotal: number; revenueMonth: number; }

export default function AdminDashboardPage() {
  const { data } = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => get<AdminDashboard>('/admin/data/dashboard') });
  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16}>
        <Col span={6}><Card><Statistic title="B端数" value={data?.bCount ?? 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="C端数" value={data?.cCount ?? 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="项目数" value={data?.projectCount ?? 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="累计收入(元)" value={data ? data.revenueTotal / 100 : 0} /></Card></Col>
      </Row>
    </div>
  );
}