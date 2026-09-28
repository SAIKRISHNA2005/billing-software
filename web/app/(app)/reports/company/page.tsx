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
      render: (name: string) => <Text strong style={{ color: '#17324D' }}>{name}</Text>
    },
    {
      title: 'Total Trips',
      dataIndex: 'totalTrips',
      key: 'totalTrips',
      align: 'center' as const,
      render: (count: number) => <Tag style={{ background: '#EEF3F6', color: '#17324D', border: '1px solid #D4DAD9', fontVariantNumeric: 'tabular-nums' }}>{count}</Tag>
    },
    {
      title: 'Completed Trips',
      dataIndex: 'completedTrips',
      key: 'completedTrips',
      align: 'center' as const,
      render: (count: number) => <Tag style={{ background: '#EBF4ED', color: '#3F6F4A', border: '1px solid #D4DAD9', fontVariantNumeric: 'tabular-nums' }}>{count}</Tag>
    },
    {
      title: 'Pending Trips',
      dataIndex: 'pendingTrips',
      key: 'pendingTrips',
      align: 'center' as const,
      render: (count: number) => <Tag style={{ background: '#FDF6E8', color: '#9E6B1D', border: '1px solid #D4DAD9', fontVariantNumeric: 'tabular-nums' }}>{count}</Tag>
    },
    {
      title: 'Total Billing (₹)',
      dataIndex: 'totalBilling',
      key: 'totalBilling',
      align: 'right' as const,
      render: (amt: number) => <Text strong style={{ color: '#3F6F4A', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyINR(amt)}</Text>
    },
    {
      title: 'Drill-down',
      key: 'action',
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          style={{ color: '#365A73' }}
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
          <Title level={2} style={{ margin: 0, color: '#17324D', letterSpacing: '-0.01em' }}>
            <BankOutlined style={{ marginRight: 8, color: '#17324D' }} />
            Company-wise Performance Report
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: '#5F6B73' }}>Consolidated trip volumes and revenue billed across legal operating companies</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchCompanyReport}>
          Refresh
        </Button>
      </div>

      <Card style={{ borderRadius: 4, borderColor: '#D4DAD9' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 'bold', fontSize: 13 }}>
              <span>Grand Totals Summary:</span>
              <Space size="large">
                <span>Total Trips: <Tag style={{ background: '#EEF3F6', color: '#17324D', border: '1px solid #D4DAD9' }}>{totals.totalTrips || 0}</Tag></span>
                <span>Completed: <Tag style={{ background: '#EBF4ED', color: '#3F6F4A', border: '1px solid #D4DAD9' }}>{totals.completedTrips || 0}</Tag></span>
                <span>Pending: <Tag style={{ background: '#FDF6E8', color: '#9E6B1D', border: '1px solid #D4DAD9' }}>{totals.pendingTrips || 0}</Tag></span>
                <span>Total Billing: <span style={{ color: '#3F6F4A', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyINR(totals.totalBilling || 0)}</span></span>
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
            { title: 'Enquiry ID', dataIndex: 'id', key: 'id', render: (id: string) => <span style={{ fontFamily: 'monospace' }}>{id}</span> },
            { title: 'Transaction No', dataIndex: 'transactionNo', key: 'transactionNo', render: (txn: string) => <span style={{ fontFamily: 'monospace' }}>{txn}</span> },
            { title: 'Vehicle No', dataIndex: 'vehicleNo', key: 'vehicleNo', render: (veh: string) => <span style={{ fontFamily: 'monospace' }}>{veh}</span> },
            { title: 'Stage', dataIndex: 'stage', key: 'stage', render: (s: string) => <Tag style={{ background: '#EEF3F6', color: '#17324D', border: '1px solid #D4DAD9' }}>{s}</Tag> },
            { title: 'Freight (₹)', dataIndex: 'freightAmount', key: 'freightAmount', render: (amt: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyINR(amt)}</span> }
          ]}
          dataSource={selectedCompanyTrips?.trips || []}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Modal>
    </div>
  );
}
