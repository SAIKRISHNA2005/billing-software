'use me';
'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Select, Button, Space, Typography, Tag, Row, Col, Statistic, message } from 'antd';
import { AuditOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { formatCurrencyINR } from '@/lib/utils/format';

const { Title, Text } = Typography;

export default function BillingReportPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [financialYear, setFinancialYear] = useState('');
  const [status, setStatus] = useState('');

  const fetchBillingReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/reports/billing', {
        params: { financialYear, status }
      });
      if (res.data && res.data.success) {
        setData(res.data.data.items || []);
        setTotals(res.data.data.totals || {});
      } else {
        message.error(res.data?.message || 'Failed to fetch billing report');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error loading report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingReport();
  }, []);

  const columns = [
    {
      title: 'Bill Number',
      dataIndex: 'billNumber',
      key: 'billNumber',
      render: (num: string) => <Text strong style={{ color: '#1677ff' }}>{num}</Text>
    },
    {
      title: 'FY',
      dataIndex: 'financialYear',
      key: 'financialYear',
      render: (fy: string) => <Tag color="purple">{fy}</Tag>
    },
    {
      title: 'Billing Date',
      dataIndex: 'billingDate',
      key: 'billingDate',
      render: (d: string) => (d ? dayjs(d).format('DD-MM-YYYY') : '-')
    },
    { title: 'Company', dataIndex: 'companyName', key: 'companyName' },
    { title: 'Client', dataIndex: 'clientName', key: 'clientName' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) => <Tag color={st === 'PROCESSED' ? 'green' : 'orange'}>{st}</Tag>
    },
    {
      title: 'Total Billed (₹)',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (amt: number) => <Text strong style={{ color: '#3f8600' }}>{formatCurrencyINR(amt)}</Text>
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <AuditOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Billing &amp; Revenue Summary Report
          </Title>
          <Text type="secondary">Financial overview of issued draft and processed invoices</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchBillingReport}>
          Refresh
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading} style={{ borderRadius: 8 }}>
            <Statistic title="Total Invoices Count" value={totals.totalBills || 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading} style={{ borderRadius: 8 }}>
            <Statistic title="Processed Bills" value={totals.processedCount || 0} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading} style={{ borderRadius: 8 }}>
            <Statistic title="Draft Bills" value={totals.draftCount || 0} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading} style={{ borderRadius: 8, backgroundColor: '#f6ffed' }}>
            <Statistic title="Total Revenue Billed" value={totals.totalBilled || 0} precision={2} prefix="₹" valueStyle={{ color: '#389e0d' }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 8 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="Financial Year"
            value={financialYear || undefined}
            onChange={(val) => setFinancialYear(val || '')}
            style={{ width: 160 }}
            allowClear
          >
            <Select.Option value="2026-27">2026-27</Select.Option>
            <Select.Option value="2025-26">2025-26</Select.Option>
          </Select>
          <Select
            placeholder="Status"
            value={status || undefined}
            onChange={(val) => setStatus(val || '')}
            style={{ width: 160 }}
            allowClear
          >
            <Select.Option value="PROCESSED">PROCESSED</Select.Option>
            <Select.Option value="DRAFT">DRAFT</Select.Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchBillingReport}>
            Filter
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15 }}
          footer={() => (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>Total Listed Invoices: {data.length}</span>
              <span>Total Amount Billed: <span style={{ color: '#3f8600' }}>{formatCurrencyINR(totals.totalBilled || 0)}</span></span>
            </div>
          )}
        />
      </Card>
    </div>
  );
}
