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
  Tooltip,
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
  CalendarOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTheme } from '@/components/providers/ThemeContext';
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
  const { themeMode, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Responsive screen size listener
  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-close drawer on route change on mobile
  React.useEffect(() => {
    if (isMobile) {
      setCollapsed(true);
    }
  }, [pathname, isMobile]);

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
          background: '#F3F4F2',
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

  const settingsMenuItems: MenuProps['items'] = [
    {
      key: '/settings/master',
      icon: <SettingOutlined />,
      label: <Link href="/settings/master">Master Data</Link>,
    },
    {
      key: '/settings/profile',
      icon: <UserOutlined />,
      label: <Link href="/settings/profile">Company Profile</Link>,
    },
    {
      key: '/settings/audit',
      icon: <FileTextOutlined />,
      label: <Link href="/settings/audit">Audit Log</Link>,
    },
    {
      type: 'divider',
    },
    {
      key: '/exports/excel',
      icon: <ExportOutlined />,
      label: <Link href="/exports/excel">Master Excel & Backups</Link>,
    },
    {
      key: '/exports/pdf',
      icon: <FileTextOutlined />,
      label: <Link href="/exports/pdf">PDF & Reports Export</Link>,
    },
  ];

  const menuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: <Link href="/dashboard">Dashboard</Link>,
    },
    {
      key: '/enquiries/new',
      icon: <FileTextOutlined />,
      label: <Link href="/enquiries/new">Add Enquiry</Link>,
    },
    {
      key: '/enquiries',
      icon: <FileTextOutlined />,
      label: <Link href="/enquiries">View / Edit Enquiry</Link>,
    },
    {
      key: '/reports/daily',
      icon: <CalendarOutlined />,
      label: <Link href="/reports/daily">Daily Report</Link>,
    },
    {
      key: '/reports/vendor',
      icon: <TeamOutlined />,
      label: <Link href="/reports/vendor">Vendor Report</Link>,
    },
    {
      key: '/reports/billing',
      icon: <BarChartOutlined />,
      label: <Link href="/reports/billing">Billing Report</Link>,
    },
    {
      key: 'expenses',
      icon: <DollarOutlined />,
      label: 'Expense',
      children: [
        {
          key: '/expenses/general',
          label: <Link href="/expenses/general">General Expense</Link>,
        },
        {
          key: '/expenses/loading',
          label: <Link href="/expenses/loading">Loading Expenses</Link>,
        },
      ],
    },
    {
      key: '/billing/pending',
      icon: <ContainerOutlined />,
      label: <Link href="/billing/pending">Pending Bills</Link>,
    },
    {
      key: '/billing/processed',
      icon: <FileTextOutlined />,
      label: <Link href="/billing/processed">Processed Bills</Link>,
    },
    {
      key: '/operations/movement',
      icon: <CarOutlined />,
      label: <Link href="/operations/movement">Vehicle Management</Link>,
    },
  ];

  // Helper to determine active/open keys in menu
  const getSelectedKeys = () => {
    if (pathname === '/dashboard') return ['/dashboard'];
    if (pathname === '/enquiries/new') return ['/enquiries/new'];
    if (pathname.startsWith('/enquiries')) return ['/enquiries'];
    if (pathname.startsWith('/reports/daily')) return ['/reports/daily'];
    if (pathname.startsWith('/reports/vendor') || pathname.startsWith('/vendors')) return ['/reports/vendor'];
    if (pathname.startsWith('/reports/billing') || pathname.startsWith('/reports/company')) return ['/reports/billing'];
    if (pathname === '/expenses/general') return ['/expenses/general'];
    if (pathname === '/expenses/loading') return ['/expenses/loading'];
    if (pathname.startsWith('/billing/pending')) return ['/billing/pending'];
    if (pathname.startsWith('/billing/processed')) return ['/billing/processed'];
    if (pathname.startsWith('/operations')) return ['/operations/movement'];
    return [pathname];
  };

  const getOpenKeys = () => {
    if (pathname.startsWith('/expenses')) return ['expenses'];
    return [];
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Mobile Backdrop Overlay */}
      {isMobile && !collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            zIndex: 999,
            transition: 'opacity 0.25s ease',
          }}
        />
      )}

      <Sider
        trigger={null}
        collapsible
        collapsed={isMobile ? false : collapsed}
        width={240}
        className="spt-sidebar"
        style={{
          height: '100vh',
          position: 'fixed',
          left: isMobile ? (collapsed ? -240 : 0) : 0,
          top: 0,
          bottom: 0,
          zIndex: isMobile ? 1000 : 100,
          background: themeMode === 'dark' ? '#121214' : '#172A3A',
          boxShadow: isMobile && !collapsed ? '4px 0 16px rgba(0, 0, 0, 0.4)' : 'none',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Official Sri Ponniamman Trans Typographic Brand Header */}
          <div
            style={{
              height: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
              padding: collapsed && !isMobile ? '0' : '0 18px',
              borderBottom: themeMode === 'dark' ? '1px solid #27272A' : '1px solid rgba(255, 255, 255, 0.08)',
              background: themeMode === 'dark' ? '#121214' : '#172A3A',
              flexShrink: 0,
            }}
          >
            {collapsed && !isMobile ? (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 4,
                  background: themeMode === 'dark' ? '#27272A' : '#24445D',
                  border: themeMode === 'dark' ? '1px solid #3F3F46' : '1px solid #365A73',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: '0.5px',
                }}
              >
                SPT
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 13.5, letterSpacing: '0.6px', lineHeight: 1.2 }}>
                  SRI PONNIAMMAN TRANS
                </div>
                <div style={{ color: themeMode === 'dark' ? '#A1A1AA' : '#89939A', fontSize: 10, fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase', marginTop: 3 }}>
                  Transport Operations
                </div>
              </div>
            )}
          </div>

          {/* Scrollable Navigation Menu */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={getSelectedKeys()}
              defaultOpenKeys={getOpenKeys()}
              items={menuItems}
              style={{ borderRight: 0, background: themeMode === 'dark' ? '#121214' : '#172A3A' }}
            />
          </div>

          {/* Pinned Logout Action at Sidebar Bottom */}
          <div
            style={{
              padding: collapsed && !isMobile ? '12px 8px' : '14px 16px',
              borderTop: themeMode === 'dark' ? '1px solid #27272A' : '1px solid rgba(255, 255, 255, 0.08)',
              background: themeMode === 'dark' ? '#121214' : '#172A3A',
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Button
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              block={!collapsed || isMobile}
              style={{
                height: '36px',
                fontWeight: 500,
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                background: themeMode === 'dark' ? '#27272A' : '#24445D',
                borderColor: themeMode === 'dark' ? '#3F3F46' : '#365A73',
                color: themeMode === 'dark' ? '#FFFFFF' : '#C2CCD4',
                width: collapsed && !isMobile ? '36px' : '100%',
              }}
              title="Sign Out"
            >
              {(!collapsed || isMobile) && 'Sign Out'}
            </Button>
          </div>
        </div>
      </Sider>

      <Layout
        style={{
          marginLeft: isMobile ? 0 : (collapsed ? 80 : 240),
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <Header
          className="spt-command-header"
          style={{
            background: themeMode === 'dark' ? '#18181B' : '#FFFFFF',
            padding: isMobile ? '0 12px' : '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: themeMode === 'dark' ? '1px solid #2E2E33' : '1px solid #D4DAD9',
            boxShadow: themeMode === 'dark' ? '0 1px 3px rgba(0, 0, 0, 0.4)' : '0 1px 3px rgba(23, 42, 58, 0.04)',
            position: 'sticky',
            top: 0,
            zIndex: 99,
            height: 56,
            lineHeight: '56px',
          }}
        >
          <Space align="center" size={isMobile ? 'small' : 'middle'}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16, width: 34, height: 34, color: themeMode === 'dark' ? '#FFFFFF' : '#34424C' }}
              title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            />
            <Text strong style={{ fontSize: isMobile ? 13.5 : 15, color: themeMode === 'dark' ? '#FFFFFF' : '#1E2933', letterSpacing: '0.2px' }}>
              {isMobile ? 'Sri Ponniamman Trans' : 'Transport & Logistics Management System'}
            </Text>
          </Space>

          <Space size={isMobile ? 'small' : 'middle'}>
            {/* Icon-Only Dark Mode / Light Mode Toggle Button */}
            <Tooltip title={themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              <Button
                onClick={toggleTheme}
                icon={
                  themeMode === 'dark' ? (
                    <SunOutlined style={{ color: '#F59E0B', fontSize: 16 }} />
                  ) : (
                    <MoonOutlined style={{ color: '#17324D', fontSize: 16 }} />
                  )
                }
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: themeMode === 'dark' ? '#27272A' : '#EEF2F6',
                  border: themeMode === 'dark' ? '1px solid #3F3F46' : '1px solid #CBD5E1',
                  cursor: 'pointer',
                  boxShadow: themeMode === 'dark' ? '0 1px 3px rgba(0, 0, 0, 0.5)' : '0 1px 2px rgba(15, 23, 42, 0.08)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            </Tooltip>

            <Dropdown menu={{ items: settingsMenuItems }} placement="bottomRight">
              <Button type="text" icon={<SettingOutlined />} style={{ color: themeMode === 'dark' ? '#A1A1AA' : '#5F6B73', fontSize: 13 }}>
                {!isMobile && 'Settings & Tools'}
              </Button>
            </Dropdown>

            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar style={{ backgroundColor: themeMode === 'dark' ? '#27272A' : '#17324D', color: '#FFFFFF', fontSize: 13 }} icon={<UserOutlined />} />
                {!isMobile && <Text strong style={{ fontSize: 13, color: themeMode === 'dark' ? '#FFFFFF' : '#1E2933' }}>{user.name || user.email}</Text>}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            margin: isMobile ? '12px 12px 0' : '24px 24px 0',
            overflow: 'initial',
          }}
        >
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
