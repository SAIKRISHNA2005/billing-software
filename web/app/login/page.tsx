'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Form, Input, Button, Typography, Alert, Space } from 'antd';
import { MailOutlined, LockOutlined, CarOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth/AuthContext';

const { Title, Text } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { user, login, isAuthenticated } = useAuth();
  const [form] = Form.useForm<LoginFormValues>();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await login(values.email, values.password);
      router.replace('/dashboard');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axErr = err as { response?: { data?: { message?: string } } };
        setErrorMessage(axErr.response?.data?.message || 'Login failed. Please verify your credentials.');
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0b192c 0%, #1e3e62 50%, #000000 100%)',
        padding: '24px',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        bodyStyle={{ padding: '36px 32px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: '#e6f4ff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <CarOutlined style={{ fontSize: 28, color: '#1677ff' }} />
          </div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
            TMS Portal
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Transport & Logistics Management System
          </Text>
        </div>

        {errorMessage && (
          <Alert
            type="error"
            message={errorMessage}
            showIcon
            style={{ marginBottom: 20, borderRadius: 6 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
          initialValues={{ email: '', password: '' }}
        >
          <Form.Item
            name="email"
            label="Email Address"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="e.g. admin@tms.local"
              size="large"
              autoComplete="email"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Enter your password"
              size="large"
              autoComplete="current-password"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 28, marginBottom: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              style={{ height: 44, fontSize: 16, fontWeight: 600 }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Space direction="vertical" size={4}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Single-Operator Secure Access
            </Text>
            <Text type="secondary" style={{ fontSize: 11, color: '#8c8c8c' }}>
              Protected by server-side session authentication
            </Text>
          </Space>
        </div>
      </Card>
    </div>
  );
}
