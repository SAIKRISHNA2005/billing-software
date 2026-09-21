'use me';
'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Select, Button, Space, Typography, Tag, Modal, message } from 'antd';
import { BankOutlined, SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
import { formatCurrencyINR } from '@/lib/utils/format';

const { Title, Text } = Typography;

export default function CompanyReportPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [loadingType, setLoadingType] = useState('');
  const [selectedCompanyTrips, setSelectedCompanyTrips] = useState<any>(null);

  const fetchCompanyReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/reports/company', {
        params: { companyId, loadingType }
      });
      if (res.data && res.data.success) {
        setData(res.data.data.items || []);
        setTotals(res.data.data.totals || {});
      } else {
        message.error(res.data?.message || 'Failed to fetch company report');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error loading report');
    } finally {
      setLoading(false);
    }
  };

  const fetchMasters = async () => {
    try {
      const res = await axios.get('/api/master/companies?limit=100');
      if (res.data?.success) setCompanies(res.data.data.items || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMasters();
    fetchCompanyReport();
  }, []);

  const columns = [
    {
      title: 'Company Name',
      dataIndex: 'companyName',
      key: 'companyName',
      render: (name: string) => <Text strong style={{ color: '#1677ff' }}>{name}</Text>
    },
    {
      title: 'Total Trips',
      dataIndex: 'totalTrips',
      key: 'totalTrips',
      align: 'center' as const,
      render: (count: number) => <Tag color="blue" style={{ fontSize: 14 }}>{count}</Tag>
    },
    {
      title: 'Completed Trips',
      dataIndex: 'completedTrips',
      key: 'completedTrips',
      align: 'center' as const,
      render: (count: number) => <Tag color="green" style={{ fontSize: 14 }}>{count}</Tag>
    },
    {
      title: 'Pending Trips',
      dataIndex: 'pendingTrips',
      key: 'pendingTrips',
      align: 'center' as const,
      render: (count: number) => <Tag color="orange" style={{ fontSize: 14 }}>{count}</Tag>
    },
    {
      title: 'Total Billing (₹)',
      dataIndex: 'totalBilling',
      key: 'totalBilling',
      align: 'right' as const,
      render: (amt: number) => <Text strong style={{ color: '#3f8600', fontSize: 15 }}>{formatCurrencyINR(amt)}</Text>
    },
    {
      title: 'Drill-down',
      key: 'action',
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => setSelectedCompanyTrips(record)}
        >
          View Trips ({record.trips?.length || 0})
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <BankOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Company-wise Performance Report
          </Title>
          <Text type="secondary">Consolidated trip volumes and revenue billed across legal operating companies</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchCompanyReport}>
          Refresh
        </Button>
      </div>

      <Card style={{ borderRadius: 8 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="Filter Company"
            value={companyId || undefined}
            onChange={(val) => setCompanyId(val || '')}
            style={{ width: 220 }}
            allowClear
          >
            {companies.map((c) => (
              <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
            ))}
          </Select>
          <Select
            placeholder="Loading Type"
            value={loadingType || undefined}
            onChange={(val) => setLoadingType(val || '')}
            style={{ width: 160 }}
            allowClear
          >
            <Select.Option value="Import">Import</Select.Option>
            <Select.Option value="Export">Export</Select.Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchCompanyReport}>
            Apply Filters
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="companyId"
          loading={loading}
          pagination={false}
          footer={() => (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 'bold', fontSize: 15 }}>
              <span>Grand Totals Summary:</span>
              <Space size="large">
                <span>Total Trips: <Tag color="blue">{totals.totalTrips || 0}</Tag></span>
                <span>Completed: <Tag color="green">{totals.completedTrips || 0}</Tag></span>
                <span>Pending: <Tag color="orange">{totals.pendingTrips || 0}</Tag></span>
                <span>Total Billing: <span style={{ color: '#3f8600' }}>{formatCurrencyINR(totals.totalBilling || 0)}</span></span>
              </Space>
            </div>
          )}
        />
      </Card>

      <Modal
        title={`Trips Drill-down (${selectedCompanyTrips?.companyName || ''})`}
        open={!!selectedCompanyTrips}
        onCancel={() => setSelectedCompanyTrips(null)}
        footer={null}
        width={800}
      >
        <Table
          columns={[
            { title: 'Enquiry ID', dataIndex: 'id', key: 'id' },
            { title: 'Transaction No', dataIndex: 'transactionNo', key: 'transactionNo' },
            { title: 'Vehicle No', dataIndex: 'vehicleNo', key: 'vehicleNo' },
            { title: 'Stage', dataIndex: 'stage', key: 'stage', render: (s: string) => <Tag color="blue">{s}</Tag> },
            { title: 'Freight (₹)', dataIndex: 'freightAmount', key: 'freightAmount', render: (amt: number) => formatCurrencyINR(amt) }
          ]}
          dataSource={selectedCompanyTrips?.trips || []}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Modal>
    </div>
  );
}
