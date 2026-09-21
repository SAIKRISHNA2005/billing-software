'use me';
'use client';

import React, { useState, useEffect } from 'react';
import { Table, Card, Input, Select, Tag, Button, Space, Typography, message } from 'antd';
import { AuditOutlined, SearchOutlined, EyeOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import dayjs from 'dayjs';
import { formatCurrencyINR } from '@/lib/utils/format';

const { Title, Text } = Typography;

export default function ProcessedBillsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });
  const [search, setSearch] = useState('');
  const [financialYear, setFinancialYear] = useState('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [clientId, setClientId] = useState('');
  const [grandTotal, setGrandTotal] = useState(0);

  const fetchBills = async (page = 1) => {
    setLoading(true);
    try {
      const res = await axios.get('/api/billing/bills', {
        params: {
          page,
          limit: pagination.pageSize,
          status: 'PROCESSED',
          financialYear,
          companyId,
          clientId,
          search
        }
      });
      if (res.data && res.data.success) {
        const result = res.data.data;
        setItems(result.items || []);
        setGrandTotal(result.grandTotal || 0);
        setPagination({
          current: result.page || page,
          pageSize: result.limit || 15,
          total: result.total || 0
        });
      } else {
        message.error(res.data?.message || 'Failed to fetch processed bills');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error loading bills');
    } finally {
      setLoading(false);
    }
  };

  const fetchMasters = async () => {
    try {
      const [compRes, cltRes] = await Promise.all([
        axios.get('/api/master/companies?limit=100'),
        axios.get('/api/master/clients?limit=100')
      ]);
      if (compRes.data?.success) setCompanies(compRes.data.data.items || []);
      if (cltRes.data?.success) setClients(cltRes.data.data.items || []);
    } catch (e) {
      console.error('Failed to load masters:', e);
    }
  };

  useEffect(() => {
    fetchMasters();
    fetchBills(1);
  }, []);

  const columns = [
    {
      title: 'Bill Number',
      dataIndex: 'billNumber',
      key: 'billNumber',
      render: (num: string) => <Text strong style={{ color: '#1677ff' }}>{num}</Text>
    },
    {
      title: 'Billing Date',
      dataIndex: 'billingDate',
      key: 'billingDate',
      render: (d: string) => (d ? dayjs(d).format('DD-MM-YYYY') : '-')
    },
    {
      title: 'FY',
      dataIndex: 'financialYear',
      key: 'financialYear',
      render: (fy: string) => <Tag color="purple">{fy || '-'}</Tag>
    },
    {
      title: 'Company',
      dataIndex: 'companyName',
      key: 'companyName'
    },
    {
      title: 'Client',
      dataIndex: 'clientName',
      key: 'clientName'
    },
    {
      title: 'Amount (₹)',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (amt: number) => <Text strong style={{ color: '#3f8600' }}>{formatCurrencyINR(amt)}</Text>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color="green">{status}</Tag>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/billing/processed/${record.id}`)}
          >
            View
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => router.push(`/billing/processed/${record.id}/edit`)}
          >
            Edit
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <AuditOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Processed Bills Directory
          </Title>
          <Text type="secondary">Issued invoices with assigned financial-year sequence numbers</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => fetchBills(1)}>
          Refresh
        </Button>
      </div>

      <Card style={{ borderRadius: 8 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Search Bill No, Company, Client..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => fetchBills(1)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="Financial Year"
            value={financialYear || undefined}
            onChange={(val) => setFinancialYear(val || '')}
            style={{ width: 140 }}
            allowClear
          >
            <Select.Option value="2026-27">2026-27</Select.Option>
            <Select.Option value="2025-26">2025-26</Select.Option>
          </Select>
          <Select
            placeholder="Filter Company"
            value={companyId || undefined}
            onChange={(val) => setCompanyId(val || '')}
            style={{ width: 180 }}
            allowClear
          >
            {companies.map((c) => (
              <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
            ))}
          </Select>
          <Select
            placeholder="Filter Client"
            value={clientId || undefined}
            onChange={(val) => setClientId(val || '')}
            style={{ width: 180 }}
            allowClear
          >
            {clients.map((c) => (
              <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
            ))}
          </Select>
          <Button type="primary" onClick={() => fetchBills(1)}>Filter</Button>
        </Space>

        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={(pag) => fetchBills(pag.current)}
          footer={() => (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text strong>Total Processed Invoices Count: {pagination.total}</Text>
              <Text strong>Grand Total Billed: <span style={{ color: '#3f8600' }}>{formatCurrencyINR(grandTotal)}</span></Text>
            </div>
          )}
        />
      </Card>
    </div>
  );
}
