import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import { useMemo } from 'react';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/Login';
import ProjectListPage from './pages/ProjectList';
import DashboardPage from './pages/Dashboard';
import UserDataPage from './pages/UserData';
import AdminBPage from './pages/AdminB';
import AdminProjectPage from './pages/AdminProject';
import AdminDashboardPage from './pages/AdminDashboard';
import FinancePage from './pages/Finance';
import ScenePage from './pages/Scene';

const { Content } = Layout;

function Protected({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const content = useMemo(
    () => (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/init-password" element={<LoginPage mode="init" />} />
        <Route element={<Protected><MainLayout /></Protected>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectListPage />} />
          <Route path="/users" element={<UserDataPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/admin/scene" element={<ScenePage />} />
          {/* 总后台 */}
          <Route path="/admin/b" element={<AdminBPage />} />
          <Route path="/admin/projects" element={<AdminProjectPage />} />
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        </Route>
        <Route path="/admin" element={<Navigate to="/admin/b" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    ),
    [],
  );

  return <Content style={{ minHeight: '100vh' }}>{content}</Content>;
}
