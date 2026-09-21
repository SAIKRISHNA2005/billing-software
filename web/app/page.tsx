'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spin, Space, Typography } from 'antd';
import { useAuth } from '@/lib/auth/AuthContext';

const { Text } = Typography;

export default function RootIndexPage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

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
        <Text type="secondary">Loading Transport & Logistics Management System...</Text>
      </Space>
    </div>
  );
}
