import { useState } from 'react';
import { Card, Form, Input, Button, message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { post } from '../api/client';

interface LoginResult { token: string; b_tenant?: { id: number; name: string } }

export default function LoginPage({ mode = 'login' }: { mode?: 'login' | 'init' }) {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (values: Record<string, string>) => {
    setLoading(true);
    try {
      let result: LoginResult;
      if (mode === 'init') {
        result = await post<LoginResult>('/b/auth/init-password', {
          init_token: values.init_token,
          password: values.password,
        });
      } else {
        result = await post<LoginResult>('/b/auth/login', {
          phone: values.phone,
          password: values.password,
        });
      }
      localStorage.setItem('token', result.token);
      nav('/');
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const isInit = mode === 'init';
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card title={isInit ? '初始化密码' : 'B端登录'} style={{ width: 400 }}>
        <Form layout="vertical" onFinish={onSubmit} initialValues={{ init_token: sp.get('token') ?? '' }}>
          {isInit ? (
            <>
              <Form.Item name="init_token" label="初始化token" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="password" label="设置密码" rules={[{ required: true, min: 8 }]}>
                <Input.Password />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item name="phone" label="手机号" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true }]}>
                <Input.Password />
              </Form.Item>
            </>
          )}
          <Button type="primary" htmlType="submit" loading={loading} block>
            {isInit ? '设置并登录' : '登录'}
          </Button>
        </Form>
      </Card>
    </div>
  );
}
