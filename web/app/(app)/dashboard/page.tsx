'use me';
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Table, Typography, Space, Button, Tag, Switch, Spin, message } from 'antd';
import {
  DashboardOutlined,
  ReloadOutlined,
  CarOutlined,
  FileAddOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  WalletOutlined,
  UserOutlined,
  EyeOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import dayjs from 'dayjs';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { formatCurrencyINR } from '@/lib/utils/format';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/dashboard/summary');
      if (res.data && res.data.success) {
        setSummary(res.data.data);
      } else {
        message.error(res.data?.message || 'Failed to load dashboard summary');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error fetching dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // 60-second auto refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboard();
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboard]);

  const recentBillsColumns = [
    {
      title: 'Bill Number',
      dataIndex: 'billNumber',
      key: 'billNumber',
      render: (num: string, r: any) => (
        <Button type="link" onClick={() => router.push(`/billing/processed/${r.id}`)}>
          {num}
        </Button>
      )
    },
    { title: 'Company', dataIndex: 'companyName', key: 'companyName' },
    { title: 'Client', dataIndex: 'clientName', key: 'clientName' },
    {
      title: 'Billing Date',
      dataIndex: 'billingDate',
      key: 'billingDate',
      render: (d: string) => (d ? dayjs(d).format('DD-MM-YYYY') : '-')
    },
    {
      title: 'Amount (₹)',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (amt: number) => <Text strong style={{ color: '#3f8600' }}>{formatCurrencyINR(amt)}</Text>
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <DashboardOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Management Control Room
          </Title>
          <Text type="secondary">Real-time daily operations, billing revenues, and financial KPIs</Text>
        </div>

        <Space wrap>
          <span>
            <Text type="secondary" style={{ marginRight: 8 }}>Auto-Refresh (60s):</Text>
            <Switch checked={autoRefresh} onChange={setAutoRefresh} size="small" />
          </span>
          <Button icon={<ReloadOutlined />} onClick={fetchDashboard} loading={loading}>
            Refresh Dashboard
          </Button>
          <Link href="/enquiries/new">
            <Button type="primary" icon={<PlusOutlined />}>
              Add Enquiry
            </Button>
          </Link>
        </Space>
      </div>

      {/* Primary KPI Cards Row 1 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => router.push('/operations/movement')}
            style={{ borderRadius: 8, cursor: 'pointer' }}
          >
            <Statistic
              title="Today's Active Trips"
              value={summary?.todaysTrips || 0}
              prefix={<CarOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff', fontWeight: 'bold' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>Click to open Vehicle Movement</Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => router.push('/billing/pending')}
            style={{ borderRadius: 8, cursor: 'pointer' }}
          >
            <Statistic
              title="Pending Unbilled Jobs"
              value={summary?.pendingBillsCount || 0}
              prefix={<FileAddOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16', fontWeight: 'bold' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Suggested: {formatCurrencyINR(summary?.pendingBillsAmount || 0)}
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => router.push('/billing/processed')}
            style={{ borderRadius: 8, cursor: 'pointer' }}
          >
            <Statistic
              title="Processed Bills Today"
              value={summary?.processedBillsTodayCount || 0}
              prefix={<CheckCircleOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1', fontWeight: 'bold' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>Invoices processed today</Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => router.push('/reports/daily')}
            style={{ borderRadius: 8, backgroundColor: '#f6ffed', cursor: 'pointer' }}
          >
            <Statistic
              title="Today's Total Revenue"
              value={summary?.todaysRevenue || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#389e0d', fontWeight: 'bold' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>Sum of today&apos;s processed bills</Text>
          </Card>
        </Col>
      </Row>

      {/* Primary KPI Cards Row 2 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card
            hoverable
            onClick={() => router.push('/enquiries')}
            style={{ borderRadius: 8, cursor: 'pointer' }}
          >
            <Statistic
              title="Today's New Enquiries"
              value={summary?.todaysEnquiries || 0}
              prefix={<PlusOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={8}>
          <Card
            hoverable
            onClick={() => router.push('/expenses/loading')}
            style={{ borderRadius: 8, cursor: 'pointer' }}
          >
            <Statistic
              title="Today's Total Expenses"
              value={summary?.todaysExpenses || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={8}>
          <Card
            hoverable
            onClick={() => router.push('/vendors/payments')}
            style={{ borderRadius: 8, cursor: 'pointer' }}
          >
            <Statistic
              title="Pending Vendor Balances"
              value={summary?.pendingVendorPayments || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#d46b08' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Chart and Recent Bills Grid */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card
            title={`Company-wise Revenue Billing (${summary?.currentFinancialYear || 'Current FY'})`}
            style={{ borderRadius: 8, height: '100%' }}
          >
            {summary?.companyBillingChart && summary.companyBillingChart.length > 0 ? (
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.companyBillingChart} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="companyName" />
                    <YAxis />
                    <Tooltip formatter={(val: any) => formatCurrencyINR(Number(val))} />
                    <Bar dataKey="totalBilling" fill="#1677ff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">No processed billing records available for current financial year.</Text>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title="Recent 10 Processed Invoices"
            style={{ borderRadius: 8, height: '100%' }}
            extra={<Link href="/billing/processed">View All</Link>}
          >
            <Table
              columns={recentBillsColumns}
              dataSource={summary?.recentBills || []}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
