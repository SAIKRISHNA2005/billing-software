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

const EXPENSE_COLORS = ['#C58A2A', '#365A73'];

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
        <Button
          type="link"
          style={{ padding: 0, fontWeight: 600, color: '#17324D' }}
          onClick={() => router.push(`/billing/processed/${r.id}`)}
        >
          {num}
        </Button>
      ),
    },
    { title: 'Company', dataIndex: 'companyName', key: 'companyName' },
    { title: 'Client', dataIndex: 'clientName', key: 'clientName' },
    {
      title: 'Billing Date',
      dataIndex: 'billingDate',
      key: 'billingDate',
      render: (d: string) => (d ? dayjs(d).format('DD-MM-YYYY') : '-'),
    },
    {
      title: 'Amount (₹)',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (amt: number) => (
        <Text strong style={{ color: '#17324D' }}>
          {formatCurrencyINR(amt)}
        </Text>
      ),
    },
  ];

  return (
    <div style={{ padding: '4px 0 24px' }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, color: '#1E2933', fontSize: 22, fontWeight: 600 }}>
            <DashboardOutlined style={{ marginRight: 8, color: '#17324D' }} />
            Management Control Room
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: '#5F6B73' }}>
            Real-time daily operations, billing revenues, and commercial ledger KPIs
          </Text>
        </div>

        <Space wrap>
          <span>
            <Text type="secondary" style={{ marginRight: 8, fontSize: 12.5 }}>
              Auto-Refresh (60s):
            </Text>
            <Switch checked={autoRefresh} onChange={setAutoRefresh} size="small" />
          </span>
          <Button icon={<ReloadOutlined />} onClick={fetchDashboard} loading={loading}>
            Refresh
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
            className="spt-kpi-card spt-kpi-steel"
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>Today&apos;s Active Trips</span>}
              value={summary?.todaysTrips || 0}
              prefix={<CarOutlined style={{ color: '#365A73' }} />}
              valueStyle={{ color: '#17324D', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11.5, color: '#89939A' }}>
              Click to view Vehicle Movement
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => router.push('/billing/pending')}
            className="spt-kpi-card spt-kpi-amber"
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>Pending Unbilled Jobs</span>}
              value={summary?.pendingBillsCount || 0}
              prefix={<FileAddOutlined style={{ color: '#C58A2A' }} />}
              valueStyle={{ color: '#C58A2A', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11.5, color: '#89939A' }}>
              Suggested: {formatCurrencyINR(summary?.pendingBillsAmount || 0)}
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => router.push('/billing/processed')}
            className="spt-kpi-card spt-kpi-green"
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>Processed Bills Today</span>}
              value={summary?.processedBillsTodayCount || 0}
              prefix={<CheckCircleOutlined style={{ color: '#3F6F4A' }} />}
              valueStyle={{ color: '#3F6F4A', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11.5, color: '#89939A' }}>
              Invoices closed today
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => router.push('/reports/daily')}
            className="spt-kpi-card spt-kpi-teal"
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>Today&apos;s Total Revenue</span>}
              value={summary?.todaysRevenue || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#17324D', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11.5, color: '#89939A' }}>
              Sum of today&apos;s billed revenue
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Primary KPI Cards Row 2 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card
            hoverable
            onClick={() => router.push('/enquiries')}
            className="spt-kpi-card spt-kpi-steel"
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>Today&apos;s New Enquiries</span>}
              value={summary?.todaysEnquiries || 0}
              prefix={<PlusOutlined style={{ color: '#365A73' }} />}
              valueStyle={{ color: '#1E2933', fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 11.5, color: '#89939A' }}>Consignments registered today</Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={8}>
          <Card
            hoverable
            onClick={() => router.push('/expenses/loading')}
            className="spt-kpi-card spt-kpi-red"
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>Today&apos;s Total Expenses</span>}
              value={summary?.todaysExpenses || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#A8473C', fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 11.5, color: '#89939A' }}>Loading & general disbursements</Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={8}>
          <Card
            hoverable
            onClick={() => router.push('/vendors/payments')}
            className="spt-kpi-card spt-kpi-amber"
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>Pending Vendor Balances</span>}
              value={summary?.pendingVendorPayments || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#C58A2A', fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 11.5, color: '#89939A' }}>Accounts payable outstanding</Text>
          </Card>
        </Col>
      </Row>

      {/* Visual Representation Charts Section: Row 1 */}
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        {/* Chart 1: Daily Revenue Billing Trend (Last 14 Days) */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <DollarOutlined style={{ color: '#365A73' }} />
                <span style={{ fontSize: 14 }}>Daily Reports & Revenue Billing Trend (14 Days)</span>
              </Space>
            }
            extra={<Link href="/reports/daily" style={{ fontSize: 12.5, color: '#17324D', fontWeight: 500 }}>Daily Report ➔</Link>}
            style={{ height: '100%' }}
          >
            {summary?.dailyRevenueChart && summary.dailyRevenueChart.length > 0 ? (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.dailyRevenueChart} margin={{ top: 15, right: 20, left: 10, bottom: 15 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#365A73" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#365A73" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E9E8" />
                    <XAxis dataKey="displayDate" style={{ fontSize: 11, fill: '#5F6B73' }} />
                    <YAxis style={{ fontSize: 11, fill: '#5F6B73' }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(val: any, name: string) => [
                        name === 'revenue' ? formatCurrencyINR(Number(val)) : val,
                        name === 'revenue' ? 'Billing Revenue' : name === 'billsCount' ? 'Processed Bills' : 'Trips',
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" name="Daily Revenue (₹)" stroke="#365A73" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                    <Bar dataKey="billsCount" name="Processed Bills" fill="#3F6F4A" barSize={12} radius={[2, 2, 0, 0]} />
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
                <CheckCircleOutlined style={{ color: '#3F6F4A' }} />
                <span style={{ fontSize: 14 }}>Company-wise Revenue Billing ({summary?.currentFinancialYear || 'Current FY'})</span>
              </Space>
            }
            extra={<Link href="/reports/company" style={{ fontSize: 12.5, color: '#17324D', fontWeight: 500 }}>Company Report ➔</Link>}
            style={{ height: '100%' }}
          >
            {summary?.companyBillingChart && summary.companyBillingChart.length > 0 ? (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.companyBillingChart} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E9E8" />
                    <XAxis dataKey="companyName" style={{ fontSize: 11, fill: '#5F6B73' }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis style={{ fontSize: 11, fill: '#5F6B73' }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(val: any) => formatCurrencyINR(Number(val))} />
                    <Legend />
                    <Bar dataKey="totalBilling" name="Billed Revenue (₹)" fill="#17324D" radius={[3, 3, 0, 0]} />
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
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        {/* Chart 3: Expenses Comparison (Loading Expenses vs General Expenses) */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <WalletOutlined style={{ color: '#C58A2A' }} />
                <span style={{ fontSize: 14 }}>Operational Expenses Breakdown (Loading vs General)</span>
              </Space>
            }
            extra={
              <Space size={8}>
                <Link href="/expenses/loading" style={{ fontSize: 12.5, color: '#17324D' }}>Loading</Link>
                <Text type="secondary">|</Text>
                <Link href="/expenses/general" style={{ fontSize: 12.5, color: '#17324D' }}>General</Link>
              </Space>
            }
            style={{ height: '100%' }}
          >
            <Row gutter={16} align="middle">
              <Col xs={24} sm={14}>
                <div style={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          category: 'Loading Expenses',
                          amount: summary?.totalLoadingAmount || 0,
                          fill: '#C58A2A',
                        },
                        {
                          category: 'General Expenses',
                          amount: summary?.totalGeneralAmount || 0,
                          fill: '#365A73',
                        },
                      ]}
                      margin={{ top: 15, right: 20, left: 10, bottom: 15 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E9E8" />
                      <XAxis dataKey="category" style={{ fontSize: 11, fill: '#5F6B73' }} />
                      <YAxis style={{ fontSize: 11, fill: '#5F6B73' }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(val: any) => formatCurrencyINR(Number(val))} />
                      <Bar dataKey="amount" name="Expense Amount (₹)" radius={[3, 3, 0, 0]}>
                        <Cell fill="#C58A2A" />
                        <Cell fill="#365A73" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Col>
              <Col xs={24} sm={10}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ padding: '12px 14px', borderRadius: 4, background: '#FDF6E8', border: '1px solid #E8CCA1' }}>
                    <div style={{ fontSize: 11.5, color: '#9E6B1D', fontWeight: 600, textTransform: 'uppercase' }}>Trip Loading Expenses</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#C58A2A', marginTop: 2 }}>
                      {formatCurrencyINR(summary?.totalLoadingAmount || 0)}
                    </div>
                    <div style={{ fontSize: 11, color: '#89939A', marginTop: 2 }}>Unloader, labour, port charges</div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 4, background: '#EEF3F6', border: '1px solid #D4DAD9' }}>
                    <div style={{ fontSize: 11.5, color: '#365A73', fontWeight: 600, textTransform: 'uppercase' }}>General Expenses</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#17324D', marginTop: 2 }}>
                      {formatCurrencyINR(summary?.totalGeneralAmount || 0)}
                    </div>
                    <div style={{ fontSize: 11, color: '#89939A', marginTop: 2 }}>Office rent, utilities, overheads</div>
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
                <FileAddOutlined style={{ color: '#C58A2A' }} />
                <span style={{ fontSize: 14 }}>Pending Bills Distribution (Unbilled Jobs)</span>
              </Space>
            }
            extra={<Link href="/billing/pending" style={{ fontSize: 12.5, color: '#17324D', fontWeight: 500 }}>Pending Bills ➔</Link>}
            style={{ height: '100%' }}
          >
            {summary?.pendingBillsCompanyChart && summary.pendingBillsCompanyChart.length > 0 ? (
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.pendingBillsCompanyChart} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E9E8" />
                    <XAxis dataKey="companyName" style={{ fontSize: 11, fill: '#5F6B73' }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis style={{ fontSize: 11, fill: '#5F6B73' }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(val: any, name: string) => [
                        name === 'amount' ? formatCurrencyINR(Number(val)) : val,
                        name === 'amount' ? 'Est. Amount' : 'Pending Jobs Count',
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="amount" name="Pending Amount (₹)" fill="#C58A2A" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="count" name="Unbilled Jobs Count" fill="#2F6F73" radius={[3, 3, 0, 0]} />
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
      <Row gutter={[20, 20]}>
        <Col xs={24}>
          <Card
            title={<span style={{ fontSize: 14 }}>Recent Processed Invoices</span>}
            extra={<Link href="/billing/processed" style={{ fontSize: 12.5, color: '#17324D', fontWeight: 500 }}>View All Invoices ➔</Link>}
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
