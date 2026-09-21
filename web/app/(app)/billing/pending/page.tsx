'use me';
'use client';

import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Select, Tag, Space, Typography, Alert, message } from 'antd';
import { FileAddOutlined, SearchOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import dayjs from 'dayjs';
import { formatCurrencyINR } from '@/lib/utils/format';

const { Title, Text } = Typography;

export default function PendingBillsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [clientId, setClientId] = useState('');

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/billing/pending', {
        params: { companyId, clientId, search }
      });
      if (res.data && res.data.success) {
        setItems(res.data.data.items || []);
      } else {
        message.error(res.data?.message || 'Failed to fetch pending bills');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error loading pending bills');
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
    fetchPending();
  }, []);

  const handleCreateBill = () => {
    if (selectedRows.length === 0) {
      message.warning('Please select at least one enquiry to create a bill.');
      return;
    }
    const enquiryIds = selectedRows.map((r) => r.enquiryId).join(',');
    const company = selectedRows[0].companyId;
    const client = selectedRows[0].clientId;
    router.push(`/billing/create?enquiryIds=${enquiryIds}&companyId=${company}&clientId=${client}`);
  };

  // Determine row selection lock
  const activeCompany = selectedRows.length > 0 ? selectedRows[0].companyId : null;
  const activeClient = selectedRows.length > 0 ? selectedRows[0].clientId : null;

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[], rows: any[]) => {
      setSelectedRowKeys(keys);
      setSelectedRows(rows);
    },
    getCheckboxProps: (record: any) => ({
      disabled:
        (activeCompany !== null && record.companyId !== activeCompany) ||
        (activeClient !== null && record.clientId !== activeClient),
      name: record.enquiryId
    })
  };

  const columns = [
    {
      title: 'Enquiry No',
      dataIndex: 'enquiryId',
      key: 'enquiryId',
      render: (id: string) => <Text strong>{id}</Text>
    },
    {
      title: 'Transaction No',
      dataIndex: 'transactionNo',
      key: 'transactionNo',
      render: (txn: string) => <Text code>{txn}</Text>
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
      title: 'Vehicle No',
      dataIndex: 'vehicleNo',
      key: 'vehicleNo',
      render: (v: string) => v || '-'
    },
    {
      title: 'Type',
      dataIndex: 'loadingType',
      key: 'loadingType',
      render: (type: string) => (
        <Tag color={type === 'Import' ? 'blue' : 'green'}>{type}</Tag>
      )
    },
    {
      title: 'Suggested Amount',
      dataIndex: 'suggestedAmount',
      key: 'suggestedAmount',
      align: 'right' as const,
      render: (amt: number) => <Text strong style={{ color: '#3f8600' }}>{formatCurrencyINR(amt)}</Text>
    },
    {
      title: 'Completed Date',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (d: string) => (d ? dayjs(d).format('DD-MM-YYYY') : '-')
    }
  ];

  const totalSelectedAmount = selectedRows.reduce((sum, r) => sum + (r.suggestedAmount || 0), 0);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <FileAddOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Pending Bills
          </Title>
          <Text type="secondary">Completed transport jobs waiting to be grouped into client invoices</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchPending}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            size="large"
            disabled={selectedRows.length === 0}
            onClick={handleCreateBill}
          >
            Create Bill ({selectedRows.length})
          </Button>
        </Space>
      </div>

      {selectedRows.length > 0 && (
        <Alert
          message={
            <span>
              Selected <strong>{selectedRows.length}</strong> enquiry jobs for{' '}
              <strong>{selectedRows[0].companyName}</strong> / <strong>{selectedRows[0].clientName}</strong>.{' '}
              Total Suggested Amount: <strong>{formatCurrencyINR(totalSelectedAmount)}</strong>
            </span>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card style={{ borderRadius: 8 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Search Enquiry, Vehicle..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={fetchPending}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="Filter Company"
            value={companyId || undefined}
            onChange={(val) => setCompanyId(val || '')}
            style={{ width: 200 }}
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
            style={{ width: 200 }}
            allowClear
          >
            {clients.map((c) => (
              <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
            ))}
          </Select>
          <Button type="primary" onClick={fetchPending}>Filter</Button>
        </Space>

        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={items}
          rowKey="enquiryId"
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
      </Card>
    </div>
  );
}
