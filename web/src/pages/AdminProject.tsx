import { useState } from 'react';
import { Table, Modal, InputNumber, Form, Select, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, put } from '../api/client';

interface ProjectItem { id: number; title: string; bName: string; auditStatus: string; createdAt: string; }

export default function AdminProjectPage() {
  const qc = useQueryClient();
  const [auditOpen, setAuditOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({ queryKey: ['admin-projects'], queryFn: () => get<{ items: ProjectItem[] }>('/admin/project') });
  const auditMut = useMutation({
    mutationFn: (v: { id: number; action: string; authenticity?: number; risk?: number; profitability?: number }) => put(`/admin/project/${v.id}/audit`, v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-projects'] }); setAuditOpen(false); message.success('审核完成'); },
    onError: (e) => message.error((e as Error).message),
  });

  return (
    <div style={{ padding: 24 }}>
      <Table rowKey="id" loading={isLoading} dataSource={data?.items ?? []} columns={[
        { title: 'ID', dataIndex: 'id' }, { title: '标题', dataIndex: 'title' },
        { title: 'B端', dataIndex: 'bName' }, { title: '状态', dataIndex: 'auditStatus' },
        { title: '创建时间', dataIndex: 'createdAt' },
        { title: '操作', render: (_: unknown, r: ProjectItem) => (
          <a onClick={() => { setSelectedId(r.id); form.resetFields(); setAuditOpen(true); }}>审核</a>
        )},
      ]} />
      <Modal title="审核项目" open={auditOpen} onOk={() => form.validateFields().then((v) => { if (selectedId) auditMut.mutate({ id: selectedId, ...v }); })} onCancel={() => setAuditOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="action" label="审核结果" rules={[{ required: true }]}><Select options={[{ value: 'approved', label: '通过' }, { value: 'rejected', label: '驳回' }]} /></Form.Item>
          <Form.Item name="authenticity" label="真实性(1-100)" initialValue={50}><InputNumber min={0} max={100} /></Form.Item>
          <Form.Item name="risk" label="风险性(1-100)" initialValue={30}><InputNumber min={0} max={100} /></Form.Item>
          <Form.Item name="profitability" label="盈利性(1-100)" initialValue={70}><InputNumber min={0} max={100} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}