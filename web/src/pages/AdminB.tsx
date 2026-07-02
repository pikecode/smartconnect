import { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Space, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusOutlined } from '@ant-design/icons';
import { get, post, del } from '../api/client';

interface BItem { id: number; phone: string; name: string; status: string; feeCap: number; createdAt: string; }

export default function AdminBPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({ queryKey: ['admin-b'], queryFn: () => get<{ items: BItem[] }>('/admin/b') });
  const createMut = useMutation({
    mutationFn: (v: { phone: string; name: string }) => post('/admin/b', v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-b'] }); setOpen(false); message.success('创建成功'); },
    onError: (e) => message.error((e as Error).message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => del(`/admin/b/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-b'] }); message.success('已删除'); },
    onError: (e) => message.error((e as Error).message),
  });

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}><Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true); }}>新增B端</Button></Space>
      <Table rowKey="id" loading={isLoading} dataSource={data?.items ?? []} columns={[
        { title: 'ID', dataIndex: 'id' }, { title: '手机号', dataIndex: 'phone' }, { title: '名称', dataIndex: 'name' },
        { title: '状态', dataIndex: 'status' }, { title: '费用上限(元)', dataIndex: 'feeCap', render: (v: number) => v / 100 },
        { title: '创建时间', dataIndex: 'createdAt' },
        { title: '操作', render: (_: unknown, r: BItem) => <a onClick={() => deleteMut.mutate(r.id)} style={{ color: 'red' }}>删除</a> },
      ]} />
      <Modal title="新增B端" open={open} onOk={() => form.validateFields().then((v) => createMut.mutate(v))} onCancel={() => setOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="phone" label="手机号" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="feeCap" label="费用上限(分)" initialValue={99900}><InputNumber min={0} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}