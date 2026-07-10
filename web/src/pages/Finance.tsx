import { useState } from 'react';
import { Table, Tabs, Button, Modal, message, Statistic, Row, Col, Card } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';

interface CommItem { id: number; order_id: number; referrer_id: number; b_id: number; amount: number; rate: number; status: string; created_at: string; }
interface OrderItem { id: number; user_id: number; type: string; amount: number; status: string; paid_at: string | null; }

export default function FinancePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'commissions' | 'orders'>('commissions');

  const { data: comms } = useQuery({
    queryKey: ['admin-commissions'], queryFn: () => get<{ items: CommItem[] }>('/admin/commission'),
  });
  const { data: orders } = useQuery({
    queryKey: ['admin-orders'], queryFn: () => get<{ items: OrderItem[] }>('/b/finance/orders'),
    enabled: tab === 'orders',
  });

  const settleMut = useMutation({
    mutationFn: () => post('/admin/commission/settle'),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ['admin-commissions'] }); message.success(`已结算 ${(data as { count: number }).count} 条佣金`); },
    onError: (e) => message.error((e as Error).message),
  });

  const pendingTotal = (comms?.items ?? []).filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title="待结算佣金(元)" value={pendingTotal / 100} /></Card></Col>
      </Row>
      <Tabs activeKey={tab} onChange={(k) => setTab(k as typeof tab)} tabBarExtraContent={
        tab === 'commissions' ? <Button type="primary" onClick={() => settleMut.mutate()}>批量结算(pending → settled)</Button> : null
      } items={[
        { key: 'commissions', label: '分佣记录', children: (
          <Table rowKey="id" dataSource={comms?.items ?? []} columns={[
            { title: 'ID', dataIndex: 'id', width: 80 },
            { title: '订单', dataIndex: 'order_id' },
            { title: '推荐人', dataIndex: 'referrer_id' },
            { title: '金额(元)', dataIndex: 'amount', render: (v: number) => (v / 100).toFixed(2) },
            { title: '比例%', dataIndex: 'rate' },
            { title: '状态', dataIndex: 'status' },
            { title: '创建', dataIndex: 'created_at' },
          ]} />
        )},
        { key: 'orders', label: '订单记录', children: (
          <Table rowKey="id" dataSource={orders?.items ?? []} columns={[
            { title: 'ID', dataIndex: 'id' },
            { title: '用户', dataIndex: 'user_id' },
            { title: '类型', dataIndex: 'type' },
            { title: '金额(元)', dataIndex: 'amount', render: (v: number) => (v / 100).toFixed(2) },
            { title: '状态', dataIndex: 'status' },
            { title: '支付时间', dataIndex: 'paid_at' },
          ]} />
        )},
      ]} />
    </div>
  );
}
