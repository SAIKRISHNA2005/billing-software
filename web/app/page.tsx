'use client';

import React, { useState } from 'react';
import { Layout, Card, Typography, Button, Space, Tag, Alert, Row, Col, Spin } from 'antd';
import {
  CheckCircleOutlined,
  ApiOutlined,
  DollarCircleOutlined,
  CalendarOutlined,
  CarOutlined,
} from '@ant-design/icons';
import { formatCurrencyINR, formatDate, formatDateTime } from '@/lib/utils/format';
import apiClient from '@/lib/api/client';

const { Header, Content, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;

interface HealthResponse {
  success: boolean;
  data: {
    ok: boolean;
    sheetConnected: boolean;
    spreadsheetName?: string;
    timestamp?: string;
  } | null;
  message: string;
}

export default function HomePage() {
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoadingHealth(true);
    setHealthError(null);
    try {
      const response = await apiClient.get<HealthResponse>('/health');
      setHealthStatus(response.data);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axErr = err as { response?: { data?: HealthResponse } };
        setHealthStatus(axErr.response?.data || null);
        setHealthError(axErr.response?.data?.message || 'Failed to connect to health endpoint');
      } else {
        setHealthError((err as Error).message || 'Network error');
      }
    } finally {
      setLoadingHealth(false);
    }
  };

  const sampleAmount = 185000;
  const sampleDate = new Date();

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header
        style={{
          background: '#001529',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Space size="middle">
          <CarOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <Title level={4} style={{ color: '#fff', margin: 0 }}>
            Transport & Logistics Management System
          </Title>
        </Space>
        <Tag color="blue">Phase 2 — Project Scaffolding</Tag>
      </Header>

      <Content style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <Row gutter={[24, 24]}>
          <Col xs={24} md={14}>
            <Card
              title={
                <Space>
                  <ApiOutlined />
                  <span>Backend Connectivity & Health Check</span>
                </Space>
              }
              bordered={false}
              style={{ height: '100%' }}
            >
              <Paragraph>
                The frontend proxies requests through Next.js Route Handlers to Google Apps Script.
                Click the button below to test connectivity to the Apps Script Web App and Google
                Sheet.
              </Paragraph>

              <Button
                type="primary"
                icon={<ApiOutlined />}
                loading={loadingHealth}
                onClick={checkHealth}
                size="large"
              >
                Test /api/health Round-Trip
              </Button>

              <div style={{ marginTop: 20 }}>
                {loadingHealth && <Spin tip="Connecting to Google Apps Script Web App..." />}

                {healthStatus && (
                  <Alert
                    type={healthStatus.success ? 'success' : 'error'}
                    showIcon
                    icon={healthStatus.success ? <CheckCircleOutlined /> : undefined}
                    message={healthStatus.message}
                    description={
                      healthStatus.data ? (
                        <div style={{ marginTop: 8 }}>
                          <div>
                            <strong>Spreadsheet Connected:</strong>{' '}
                            {healthStatus.data.sheetConnected ? 'Yes' : 'No'}
                          </div>
                          {healthStatus.data.spreadsheetName && (
                            <div>
                              <strong>Sheet Name:</strong> {healthStatus.data.spreadsheetName}
                            </div>
                          )}
                          {healthStatus.data.timestamp && (
                            <div>
                              <strong>Timestamp:</strong>{' '}
                              {formatDateTime(healthStatus.data.timestamp)}
                            </div>
                          )}
                        </div>
                      ) : (
                        healthError
                      )
                    }
                  />
                )}

                {healthError && !healthStatus && (
                  <Alert
                    type="error"
                    showIcon
                    message="Health Check Failed"
                    description={healthError}
                  />
                )}
              </div>
            </Card>
          </Col>

          <Col xs={24} md={10}>
            <Card
              title={
                <Space>
                  <DollarCircleOutlined />
                  <span>Shared Utilities (R8 Rules)</span>
                </Space>
              }
              bordered={false}
              style={{ height: '100%' }}
            >
              <Paragraph>Standardized formatting verified via unit tests:</Paragraph>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <Text type="secondary">Currency (INR):</Text>
                  <div>
                    <Text strong style={{ fontSize: 20, color: '#1677ff' }}>
                      {formatCurrencyINR(sampleAmount)}
                    </Text>
                  </div>
                </div>

                <div>
                  <Text type="secondary">
                    <CalendarOutlined /> Date (DD-MM-YYYY):
                  </Text>
                  <div>
                    <Text strong style={{ fontSize: 16 }}>
                      {formatDate(sampleDate)}
                    </Text>
                  </div>
                </div>

                <div>
                  <Text type="secondary">DateTime (Asia/Kolkata 12-hr AM/PM):</Text>
                  <div>
                    <Text strong style={{ fontSize: 16 }}>
                      {formatDateTime(sampleDate)}
                    </Text>
                  </div>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      </Content>

      <Footer style={{ textAlign: 'center', background: 'transparent' }}>
        Transport & Logistics Management System ©{new Date().getFullYear()} — Phase 2 Scaffolding
      </Footer>
    </Layout>
  );
}
