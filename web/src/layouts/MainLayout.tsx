import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { HomeOutlined, ProjectOutlined, LogoutOutlined, TeamOutlined, CrownOutlined } from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

function isAdminPath(path: string): boolean {
  return path.startsWith('/admin');
}

export default function MainLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const isAdmin = isAdminPath(loc.pathname);

  const bItems = [
    { key: '/dashboard', icon: <HomeOutlined />, label: '看板' },
    { key: '/projects', icon: <ProjectOutlined />, label: '项目管理' },
    { key: '/users', icon: <TeamOutlined />, label: '用户数据' },
    { key: '/finance', icon: <CrownOutlined />, label: '财务' },
  ];

  const adminItems = [
    { key: '/admin/b', icon: <CrownOutlined />, label: 'B端管理' },
    { key: '/admin/projects', icon: <ProjectOutlined />, label: '项目审核' },
    { key: '/admin/dashboard', icon: <HomeOutlined />, label: '看板' },
  ];

  const menuItems = isAdmin ? adminItems : bItems;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={200}>
        <div style={{ padding: 24, fontWeight: 700, fontSize: 18 }}>{isAdmin ? '慧对接总后台' : '慧对接'}</div>
        <Menu
          mode="inline"
          selectedKeys={[loc.pathname]}
          items={menuItems}
          onClick={({ key }) => nav(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
          {isAdmin ? (
            <a onClick={() => nav('/dashboard')} style={{ cursor: 'pointer' }}>切到B端</a>
          ) : (
            <a onClick={() => nav('/admin/b')} style={{ cursor: 'pointer' }}>总后台</a>
          )}
          <a onClick={() => { localStorage.removeItem('token'); nav('/login'); }} style={{ cursor: 'pointer' }}>
            <LogoutOutlined /> 退出
          </a>
        </Header>
        <Content style={{ padding: 24, minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
