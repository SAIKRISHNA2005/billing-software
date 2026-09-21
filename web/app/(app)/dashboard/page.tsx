'use client';

import React from 'react';
import { Card, Typography, Row, Col, Space, Button, Alert, Tag } from 'antd';
import {
  UserOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  CalendarOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth/AuthContext';
import { formatDateTime } from '@/lib/utils/format';
import Link from 'next/link';

const { Title, Text, Paragraph } = Typography;

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          Welcome, {user?.name || user?.email || 'Operator'}!
        </Title>
        <Text type="secondary">
          Transport & Logistics Management System — Dashboard & Control Room
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={16}>
          <Card
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>Session Active & Authenticated</span>
              </Space>
            }
            style={{ borderRadius: 8, height: '100%' }}
          >
            <Alert
              type="success"
              showIcon
              message="Authentication Verified"
              description="You are currently authenticated with a secure, httpOnly session proxy connecting Next.js to Google Apps Script."
              style={{ marginBottom: 20 }}
            />

            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">Authenticated Operator:</Text>
                <div>
                  <Text strong style={{ fontSize: 16 }}>
                    {user?.name} ({user?.email})
                  </Text>
                </div>
              </div>

              <div>
                <Text type="secondary">Account Role:</Text>
                <div>
                  <Tag color="blue">Single Business Operator (Full System Access)</Tag>
                </div>
              </div>

              <div>
                <Text type="secondary">System Time (Asia/Kolkata):</Text>
                <div>
                  <Space>
                    <CalendarOutlined />
                    <Text>{formatDateTime(new Date())}</Text>
                  </Space>
                </div>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card
            title={
              <Space>
                <RocketOutlined style={{ color: '#1677ff' }} />
                <span>Quick Actions</span>
              </Space>
            }
            style={{ borderRadius: 8, height: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Link href="/settings/master">
                <Button block size="large">
                  Master Data
                </Button>
              </Link>
              <Link href="/enquiries/new">
                <Button type="primary" block size="large">
                  + Add Enquiry
                </Button>
              </Link>
              <Link href="/billing/pending">
                <Button block size="large">
                  Pending Bills
                </Button>
              </Link>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
