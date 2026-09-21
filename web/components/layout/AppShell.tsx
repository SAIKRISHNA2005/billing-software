'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Layout,
  Menu,
  Button,
  Space,
  Typography,
  Spin,
  Dropdown,
  Avatar,
  Modal,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  CompassOutlined,
  DollarOutlined,
  ContainerOutlined,
  TeamOutlined,
  BarChartOutlined,
  ExportOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  KeyOutlined,
  CarOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth/AuthContext';
import ChangePasswordModal from '@/components/auth/ChangePasswordModal';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  // Protected route check
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f7fa',
        }}
      >
        <Space direction="vertical" align="center" size="middle">
          <Spin size="large" />
          <Text type="secondary">Authenticating TMS session...</Text>
        </Space>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleLogout = () => {
    Modal.confirm({
      title: 'Confirm Logout',
      content: 'Are you sure you want to end your current session?',
      okText: 'Logout',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => logout(),
    });
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'change-password',
      icon: <KeyOutlined />,
      label: 'Change Password',
      onClick: () => setChangePasswordOpen(true),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      danger: true,
      onClick: handleLogout,
    },
  ];

  const menuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: <Link href="/dashboard">Dashboard</Link>,
    },
    {
      key: 'enquiries',
      icon: <FileTextOutlined />,
      label: 'Enquiries',
      children: [
        {
          key: '/enquiries/new',
          label: <Link href="/enquiries/new">Add Enquiry</Link>,
        },
        {
          key: '/enquiries',
          label: <Link href="/enquiries">View / Edit Enquiry</Link>,
        },
      ],
    },
    {
      key: 'operations',
      icon: <CompassOutlined />,
      label: 'Operations',
      children: [
        {
          key: '/operations/movement',
          label: <Link href="/operations/movement">Vehicle Movement</Link>,
        },
        {
          key: '/operations/pending',
          label: <Link href="/operations/pending">Pending Jobs</Link>,
        },
        {
          key: '/operations/completed',
          label: <Link href="/operations/completed">Completed Jobs</Link>,
        },
      ],
    },
    {
      key: 'expenses',
      icon: <DollarOutlined />,
      label: 'Expenses',
      children: [
        {
          key: '/expenses/loading',
          label: <Link href="/expenses/loading">Loading Expenses</Link>,
        },
        {
          key: '/expenses/general',
          label: <Link href="/expenses/general">General Expenses</Link>,
        },
      ],
    },
    {
      key: 'billing',
      icon: <ContainerOutlined />,
      label: 'Billing',
      children: [
        {
          key: '/billing/pending',
          label: <Link href="/billing/pending">Pending Bills</Link>,
        },
        {
          key: '/billing/create',
          label: <Link href="/billing/create">Create Bill</Link>,
        },
        {
          key: '/billing/processed',
          label: <Link href="/billing/processed">Processed Bills</Link>,
        },
      ],
    },
    {
      key: 'vendors',
      icon: <TeamOutlined />,
      label: 'Vendors',
      children: [
        {
          key: '/vendors',
          label: <Link href="/vendors">Vendor List</Link>,
        },
        {
          key: '/vendors/payments',
          label: <Link href="/vendors/payments">Vendor Payments</Link>,
        },
        {
          key: '/vendors/report',
          label: <Link href="/vendors/report">Vendor Report</Link>,
        },
      ],
    },
    {
      key: 'reports',
      icon: <BarChartOutlined />,
      label: 'Reports',
      children: [
        {
          key: '/reports/daily',
          label: <Link href="/reports/daily">Daily Report</Link>,
        },
        {
          key: '/reports/company',
          label: <Link href="/reports/company">Company Report</Link>,
        },
        {
          key: '/reports/vendor',
          label: <Link href="/reports/vendor">Vendor Report</Link>,
        },
        {
          key: '/reports/billing',
          label: <Link href="/reports/billing">Billing Report</Link>,
        },
      ],
    },
    {
      key: 'exports',
      icon: <ExportOutlined />,
      label: 'Exports',
      children: [
        {
          key: '/exports/excel',
          label: <Link href="/exports/excel">Excel</Link>,
        },
        {
          key: '/exports/pdf',
          label: <Link href="/exports/pdf">PDF</Link>,
        },
      ],
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      children: [
        {
          key: '/settings/master',
          label: <Link href="/settings/master">Master Data</Link>,
        },
        {
          key: '/settings/profile',
          label: <Link href="/settings/profile">Company Profile</Link>,
        },
        {
          key: '/settings/audit',
          label: <Link href="/settings/audit">Audit Log</Link>,
        },
      ],
    },
  ];

  // Helper to determine active/open keys in menu
  const getSelectedKeys = () => [pathname];
  const getOpenKeys = () => {
    if (pathname.startsWith('/enquiries')) return ['enquiries'];
    if (pathname.startsWith('/operations')) return ['operations'];
    if (pathname.startsWith('/expenses')) return ['expenses'];
    if (pathname.startsWith('/billing')) return ['billing'];
    if (pathname.startsWith('/vendors')) return ['vendors'];
    if (pathname.startsWith('/reports')) return ['reports'];
    if (pathname.startsWith('/exports')) return ['exports'];
    if (pathname.startsWith('/settings')) return ['settings'];
    return [];
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          background: '#001529',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Space>
            <CarOutlined style={{ fontSize: 24, color: '#1677ff' }} />
            {!collapsed && (
              <Title level={4} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
                TMS Portal
              </Title>
            )}
          </Space>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getOpenKeys()}
          items={menuItems}
          style={{ borderRight: 0 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'all 0.2s' }}>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0, 21, 41, 0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 99,
          }}
        >
          <Text strong style={{ fontSize: 16 }}>
            Transport & Logistics Management System
          </Text>

          <Space size="large">
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar style={{ backgroundColor: '#1677ff' }} icon={<UserOutlined />} />
                <Text strong>{user.name || user.email}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: '24px 24px 0', overflow: 'initial' }}>
          {children}
        </Content>

        <ChangePasswordModal
          open={changePasswordOpen}
          onClose={() => setChangePasswordOpen(false)}
        />
      </Layout>
    </Layout>
  );
}
