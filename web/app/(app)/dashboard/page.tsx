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
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { formatCurrencyINR } from '@/lib/utils/format';

const { Title, Text } = Typography;

const EXPENSE_COLORS = ['#fa541c', '#722ed1'];

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

  const expensePieData = [
    { name: 'Loading Expenses', value: summary?.totalLoadingAmount || 0 },
    { name: 'General Expenses', value: summary?.totalGeneralAmount || 0 },
  ].filter(item => item.value > 0);

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

      {/* Visual Representation Charts Section: Row 1 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        {/* Chart 1: Daily Revenue Billing Trend (Last 14 Days) */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <DollarOutlined style={{ color: '#1677ff' }} />
                <span>Daily Reports & Revenue Billing Trend (Last 14 Days)</span>
              </Space>
            }
            extra={<Link href="/reports/daily">View Daily Report</Link>}
            style={{ borderRadius: 8, height: '100%' }}
          >
            {summary?.dailyRevenueChart && summary.dailyRevenueChart.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.dailyRevenueChart} margin={{ top: 15, right: 20, left: 10, bottom: 15 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1677ff" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#1677ff" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="displayDate" style={{ fontSize: 11 }} />
                    <YAxis style={{ fontSize: 11 }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(val: any, name: string) => [
                        name === 'revenue' ? formatCurrencyINR(Number(val)) : val,
                        name === 'revenue' ? 'Billing Revenue' : name === 'billsCount' ? 'Processed Bills' : 'Trips',
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" name="Daily Revenue (₹)" stroke="#1677ff" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                    <Bar dataKey="billsCount" name="Processed Bills" fill="#52c41a" barSize={12} radius={[3, 3, 0, 0]} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">No daily revenue records found.</Text>
              </div>
            )}
          </Card>
        </Col>

        {/* Chart 2: Company-wise Revenue Billing */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>Company-wise Revenue Billing ({summary?.currentFinancialYear || 'Current FY'})</span>
              </Space>
            }
            extra={<Link href="/reports/company">View Company Report</Link>}
            style={{ borderRadius: 8, height: '100%' }}
          >
            {summary?.companyBillingChart && summary.companyBillingChart.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.companyBillingChart} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="companyName" style={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis style={{ fontSize: 11 }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(val: any) => formatCurrencyINR(Number(val))} />
                    <Legend />
                    <Bar dataKey="totalBilling" name="Billed Revenue (₹)" fill="#1677ff" radius={[4, 4, 0, 0]} />
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
      </Row>

      {/* Visual Representation Charts Section: Row 2 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        {/* Chart 3: Expenses Comparison (Loading Expenses vs General Expenses) */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <WalletOutlined style={{ color: '#fa541c' }} />
                <span>Operational Expenses Breakdown (Loading vs General)</span>
              </Space>
            }
            extra={
              <Space size={8}>
                <Link href="/expenses/loading">Loading</Link>
                <Text type="secondary">|</Text>
                <Link href="/expenses/general">General</Link>
              </Space>
            }
            style={{ borderRadius: 8, height: '100%' }}
          >
            <Row gutter={16} align="middle">
              <Col xs={24} sm={14}>
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          category: 'Loading Expenses',
                          amount: summary?.totalLoadingAmount || 0,
                          fill: '#fa541c',
                        },
                        {
                          category: 'General Expenses',
                          amount: summary?.totalGeneralAmount || 0,
                          fill: '#722ed1',
                        },
                      ]}
                      margin={{ top: 15, right: 20, left: 10, bottom: 15 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="category" style={{ fontSize: 11 }} />
                      <YAxis style={{ fontSize: 11 }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(val: any) => formatCurrencyINR(Number(val))} />
                      <Bar dataKey="amount" name="Expense Amount (₹)" radius={[4, 4, 0, 0]}>
                        <Cell fill="#fa541c" />
                        <Cell fill="#722ed1" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Col>
              <Col xs={24} sm={10}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ padding: '12px 14px', borderRadius: 8, background: '#fff2e8', border: '1px solid #ffbb96' }}>
                    <div style={{ fontSize: 12, color: '#d4380d', fontWeight: 600 }}>Trip Loading Expenses</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#d4380d', marginTop: 2 }}>
                      {formatCurrencyINR(summary?.totalLoadingAmount || 0)}
                    </div>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>Unloader, labour, port charges</div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 8, background: '#f9f0ff', border: '1px solid #d3adf7' }}>
                    <div style={{ fontSize: 12, color: '#531dab', fontWeight: 600 }}>General Expenses</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#531dab', marginTop: 2 }}>
                      {formatCurrencyINR(summary?.totalGeneralAmount || 0)}
                    </div>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>Office rent, utilities, overheads</div>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Chart 4: Pending Bills Company-wise Breakdown */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <FileAddOutlined style={{ color: '#fa8c16' }} />
                <span>Pending Bills Distribution (Company-wise Unbilled Jobs)</span>
              </Space>
            }
            extra={<Link href="/billing/pending">View Pending Bills</Link>}
            style={{ borderRadius: 8, height: '100%' }}
          >
            {summary?.pendingBillsCompanyChart && summary.pendingBillsCompanyChart.length > 0 ? (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.pendingBillsCompanyChart} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="companyName" style={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis style={{ fontSize: 11 }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(val: any, name: string) => [
                        name === 'amount' ? formatCurrencyINR(Number(val)) : val,
                        name === 'amount' ? 'Est. Amount' : 'Pending Jobs Count',
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="amount" name="Pending Amount (₹)" fill="#fa8c16" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="count" name="Unbilled Jobs Count" fill="#13c2c2" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">All completed jobs are currently billed. No pending bills.</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Row 3: Recent 10 Processed Invoices Table */}
      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <Card
            title="Recent Processed Invoices"
            style={{ borderRadius: 8 }}
            extra={<Link href="/billing/processed">View All Processed Bills</Link>}
          >
            <Table
              columns={recentBillsColumns}
              dataSource={summary?.recentBills || []}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
