import { useState } from 'react';
import { Card, Form, InputNumber, Button, Descriptions, message } from 'antd';
import { post } from '../api/client';

interface SceneResult { scene: string; sig: string; link: string; }

export default function ScenePage() {
  const [result, setResult] = useState<SceneResult | null>(null);
  const [loading, setLoading] = useState(false);

  const onGenerate = async (values: { b_id: number }) => {
    setLoading(true);
    try {
      const res = await post<SceneResult>('/admin/scene/generate', values);
      setResult(res);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <Card title="千人千面 — B端专属小程序码生成">
        <Form layout="inline" onFinish={onGenerate} style={{ marginBottom: 24 }}>
          <Form.Item name="b_id" label="B端ID" rules={[{ required: true }]}>
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>生成</Button>
          </Form.Item>
        </Form>
        {result && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Scene参数">{result.scene}</Descriptions.Item>
            <Descriptions.Item label="签名">{result.sig}</Descriptions.Item>
            <Descriptions.Item label="分享链接">
              <a href={result.link} target="_blank" rel="noreferrer">{result.link}</a>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>
      <Card title="说明" style={{ marginTop: 16 }}>
        <ul>
          <li>Scene 格式: <code>b=&lt;id&gt;&sig=&lt;hmac&gt;</code></li>
          <li>小程序扫码进入后自动绑定 B 端租户</li>
          <li>仅展示自己项目，无类别/搜索</li>
          <li>生产环境使用正式公众号/小程序码替换链接</li>
        </ul>
      </Card>
    </div>
  );
}
