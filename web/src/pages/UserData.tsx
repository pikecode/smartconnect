import { useState } from 'react';
import { Table, Tabs } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';

interface ViewItem { user_id: number; nickname: string; view_time: string; duration_sec: number; }
interface JoinedItem { user_id: number; nickname: string; project_id: number; joined_at: string; }
interface ReferralItem { user_id: number; nickname: string; joined_count: number; }

export default function UserDataPage() {
  const [tab, setTab] = useState<'views' | 'joined' | 'referrals'>('views');

  const { data: views } = useQuery({
    queryKey: ['b-user-views'], queryFn: () => get<{ items: ViewItem[] }>('/b/user/views'),
    enabled: tab === 'views',
  });
  const { data: joined } = useQuery({
    queryKey: ['b-user-joined'], queryFn: () => get<{ items: JoinedItem[] }>('/b/user/joined'),
    enabled: tab === 'joined',
  });
  const { data: referrals } = useQuery({
    queryKey: ['b-user-referrals'], queryFn: () => get<{ items: ReferralItem[] }>('/b/user/referrals'),
    enabled: tab === 'referrals',
  });

  return (
    <div style={{ padding: 24 }}>
      <Tabs activeKey={tab} onChange={(k) => setTab(k as typeof tab)} items={[
        { key: 'views', label: '浏览数据', children: (
          <Table rowKey="user_id" dataSource={views?.items ?? []} columns={[
            { title: '用户ID', dataIndex: 'user_id' }, { title: '昵称', dataIndex: 'nickname' },
            { title: '浏览时间', dataIndex: 'view_time' }, { title: '时长(秒)', dataIndex: 'duration_sec' },
          ]} />
        )},
        { key: 'joined', label: '加入用户', children: (
          <Table rowKey="user_id" dataSource={joined?.items ?? []} columns={[
            { title: '用户ID', dataIndex: 'user_id' }, { title: '昵称', dataIndex: 'nickname' },
            { title: '项目ID', dataIndex: 'project_id' }, { title: '加入时间', dataIndex: 'joined_at' },
          ]} />
        )},
        { key: 'referrals', label: '下级用户', children: (
          <Table rowKey="user_id" dataSource={referrals?.items ?? []} columns={[
            { title: '用户ID', dataIndex: 'user_id' }, { title: '昵称', dataIndex: 'nickname' },
            { title: '加入数', dataIndex: 'joined_count' },
          ]} />
        )},
      ]} />
    </div>
  );
}