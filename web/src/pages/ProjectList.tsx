import { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusOutlined } from '@ant-design/icons';
import { get, post, put, del } from '../api/client';

interface Project {
  id: number; title: string; audit_status: string; join_count: number; created_at: string;
}

interface ProjectList { items: Project[] }

export default function ProjectListPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['b-projects'],
    queryFn: () => get<ProjectList>('/b/project'),
  });

  const createMut = useMutation({
    mutationFn: (v: unknown) => post('/b/project', v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['b-projects'] }); setOpen(false); message.success('已创建'); },
    onError: (e) => message.error((e as Error).message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, values }: { id: number; values: unknown }) => put(`/b/project/${id}`, values),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['b-projects'] }); setOpen(false); message.success('已更新'); },
    onError: (e) => message.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => del(`/b/project/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['b-projects'] }); message.success('已删除'); },
    onError: (e) => message.error((e as Error).message),
  });

  const onAdd = () => { setEditing(null); form.resetFields(); setOpen(true); };
  const onEdit = (r: Project) => { setEditing(r); form.setFieldsValue({ title: r.title }); setOpen(true); };
  const onSubmit = async () => {
    const values = await form.validateFields();
    if (editing) updateMut.mutate({ id: editing.id, values });
    else createMut.mutate(values);
  };

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>新增项目</Button>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data?.items ?? []}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: '标题', dataIndex: 'title' },
          { title: '审核状态', dataIndex: 'audit_status' },
          { title: '加入数', dataIndex: 'join_count', width: 100 },
          { title: '创建时间', dataIndex: 'created_at' },
          {
            title: '操作', width: 160,
            render: (_, r) => (
              <Space>
                <a onClick={() => onEdit(r)}>编辑</a>
                <a onClick={() => deleteMut.mutate(r.id)} style={{ color: 'red' }}>删除</a>
              </Space>
            ),
          },
        ]}
      />
      <Modal title={editing ? '编辑项目' : '新增项目'} open={open} onOk={onSubmit} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="项目标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="one_liner" label="一句话介绍" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category_id" label="类别" rules={[{ required: true }]}>
            <Select options={[
              { value: 1, label: 'AI' }, { value: 2, label: '直播' }, { value: 3, label: '电商' },
            ]} />
          </Form.Item>
          <Form.Item name="intro" label="项目简介"><Input.TextArea /></Form.Item>
          <Form.Item name="join_mode" label="加入模式" initialValue="free">
            <Select options={[{ value: 'free', label: '免费' }, { value: 'paid', label: '付费' }]} />
          </Form.Item>
          <Form.Item name="join_price" label="加入价格(分)"><InputNumber min={0} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
