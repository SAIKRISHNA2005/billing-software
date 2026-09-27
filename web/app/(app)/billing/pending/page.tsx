'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Card,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Typography,
  Alert,
  Tooltip,
  message,
} from 'antd';
import {
  FileAddOutlined,
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  EditOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import { formatCurrencyINR, formatDate } from '@/lib/utils/format';
import { ActionConfirmPopover } from '@/components/common/ActionConfirmPopover';
import { RecordDetailPopover } from '@/components/common/RecordDetailPopover';

const { Title, Text, Paragraph } = Typography;

export interface PendingBillRow {
  enquiryId: string;
  transactionNo: string;
  companyId: string;
  companyName: string;
  clientId: string;
  clientName: string;
  vehicleNo: string;
  containerNo: string;
  loadingType: 'Import' | 'Export';
  freightAmount: number;
  haltingAmount: number;
  suggestedAmount: number;
  weight?: string;
  haltingDays?: number;
  containerSize?: string;
  createdAt?: string;
  enquiryNumber?: string | number;
  completedAt: string;
  [key: string]: any;
}

export default function PendingBillsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PendingBillRow[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<PendingBillRow[]>([]);
  const [search, setSearch] = useState('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [clientId, setClientId] = useState('');

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/billing/pending', {
        params: { companyId, clientId, search },
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
        axios.get('/api/master/clients?limit=100'),
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
    onChange: (keys: React.Key[], rows: PendingBillRow[]) => {
      setSelectedRowKeys(keys);
      setSelectedRows(rows);
    },
    getCheckboxProps: (record: PendingBillRow) => ({
      disabled:
        (activeCompany !== null && record.companyId !== activeCompany) ||
        (activeClient !== null && record.clientId !== activeClient),
      name: record.enquiryId,
    }),
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (items.length === 0) {
      message.warning('No pending bills data to export');
      return;
    }

    const headers = [
      'Enquiry No',
      'Transaction No',
      'Client Name',
      'Company Name',
      'Loading Type',
      'Vehicle Number',
      'Container Number',
      'Weight',
      'Halting Days',
      'Halting Amount',
      'Billing Amount',
      'Size',
      'Created Date',
    ];

    const rows = items.map((r) => [
      `"${r.enquiryId}"`,
      `"${r.transactionNo || ''}"`,
      `"${(r.clientName || '').replace(/"/g, '""')}"`,
      `"${(r.companyName || '').replace(/"/g, '""')}"`,
      `"${r.loadingType || 'Import'}"`,
      `"${r.vehicleNo || ''}"`,
      `"${r.containerNo || ''}"`,
      `"${r.weight || '-'}"`,
      r.haltingDays || 0,
      r.haltingAmount || 0,
      r.suggestedAmount || 0,
      `"${r.containerSize || '40 FT'}"`,
      `"${r.createdAt || r.completedAt || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `TMS_Pending_Bills_${dayjs().format('YYYY-MM-DD')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Pending bills exported to CSV successfully');
  };

  const columns: ColumnsType<PendingBillRow> = [
    {
      title: 'Client Name',
      dataIndex: 'clientName',
      key: 'clientName',
      width: 170,
      ellipsis: true,
      render: (val: string) => <Text strong>{val || '-'}</Text>,
    },
    {
      title: 'Company Name',
      dataIndex: 'companyName',
      key: 'companyName',
      width: 150,
      ellipsis: true,
      render: (val: string) => <Text>{val || '-'}</Text>,
    },
    {
      title: 'Loading Type',
      dataIndex: 'loadingType',
      key: 'loadingType',
      width: 110,
      align: 'center',
      render: (type: string) => (
        <Tag color={type === 'Import' ? 'blue' : 'green'}>{type || 'Import'}</Tag>
      ),
    },
    {
      title: 'Vehicle Number',
      dataIndex: 'vehicleNo',
      key: 'vehicleNo',
      width: 130,
      render: (v: string) => (v ? <Tag color="cyan">{v}</Tag> : '-'),
    },
    {
      title: 'Container Number',
      dataIndex: 'containerNo',
      key: 'containerNo',
      width: 140,
      render: (c: string) => <Text strong>{c || '-'}</Text>,
    },
    {
      title: 'Weight',
      dataIndex: 'weight',
      key: 'weight',
      width: 90,
      align: 'center',
      render: (w: string) => w || '-',
    },
    {
      title: 'Halting Days',
      dataIndex: 'haltingDays',
      key: 'haltingDays',
      width: 110,
      align: 'center',
      render: (days: number) => days || 0,
    },
    {
      title: 'Halting Amount',
      dataIndex: 'haltingAmount',
      key: 'haltingAmount',
      align: 'right',
      width: 120,
      render: (amt: number) => formatCurrencyINR(amt || 0),
    },
    {
      title: 'Billing Amount',
      dataIndex: 'suggestedAmount',
      key: 'suggestedAmount',
      align: 'right',
      width: 140,
      render: (amt: number) => (
        <Text strong style={{ color: '#3f8600' }}>
          {formatCurrencyINR(amt)}
        </Text>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'containerSize',
      key: 'containerSize',
      width: 90,
      align: 'center',
      render: (size: string) => <Tag color="purple">{size || '40 FT'}</Tag>,
    },
    {
      title: 'Enquiry / TXN',
      dataIndex: 'transactionNo',
      key: 'transactionNo',
      width: 150,
      render: (txn: string, record: PendingBillRow) => (
        <RecordDetailPopover record={record} title={`Consignment ${record.enquiryId}`}>
          <div>
            <Link href={`/enquiries/${record.enquiryId}`} style={{ fontWeight: 600, color: '#1677ff' }}>
              {record.enquiryId}
            </Link>
            <div style={{ fontSize: 12, color: '#666' }}>{txn}</div>
          </div>
        </RecordDetailPopover>
      ),
    },
    {
      title: 'Create Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (d: string, record: PendingBillRow) => {
        const dateVal = d || record.completedAt;
        return dateVal ? dayjs(dateVal).format('DD-MM-YYYY') : '-';
      },
    },
    {
      title: 'View / Edit',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record: PendingBillRow) => (
        <Space size="small">
          <RecordDetailPopover record={record} title={`Consignment ${record.enquiryId}`}>
            <Tooltip title="View Consignment Details">
              <Button type="text" size="small" icon={<EyeOutlined style={{ color: '#1677ff' }} />} />
            </Tooltip>
          </RecordDetailPopover>
          <Tooltip title="Edit Consignment">
            <Link href={`/enquiries/${record.enquiryId}`}>
              <Button type="text" size="small" icon={<EditOutlined style={{ color: '#52c41a' }} />} />
            </Link>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const totalSelectedAmount = selectedRows.reduce((sum, r) => sum + (r.suggestedAmount || 0), 0);

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <FileAddOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Pending Bills
          </Title>
          <Text type="secondary">Completed transport jobs waiting to be grouped and issued into client invoices</Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={fetchPending}>
            Refresh
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
            Export Excel
          </Button>
          <ActionConfirmPopover
            title={`Are you sure you want to create an invoice for ${selectedRows.length} item(s)?`}
            description={`Selected ${selectedRows.length} consignment(s) totaling ${formatCurrencyINR(totalSelectedAmount)}.`}
            okText="Yes, Proceed to Billing"
            cancelText="No, Cancel"
            disabled={selectedRows.length === 0}
            onConfirm={handleCreateBill}
          >
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              size="large"
              disabled={selectedRows.length === 0}
            >
              Create Bill ({selectedRows.length})
            </Button>
          </ActionConfirmPopover>
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

      <Card style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Search Enquiry, Vehicle, Container..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={fetchPending}
            style={{ width: 260 }}
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
              <Select.Option key={c.id} value={c.id}>
                {c.name}
              </Select.Option>
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
              <Select.Option key={c.id} value={c.id}>
                {c.name}
              </Select.Option>
            ))}
          </Select>
          <Button type="primary" onClick={fetchPending}>
            Filter
          </Button>
          <Button
            onClick={() => {
              setSearch('');
              setCompanyId('');
              setClientId('');
            }}
          >
            Reset
          </Button>
        </Space>

        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={items}
          rowKey="enquiryId"
          loading={loading}
          scroll={{ x: 1600 }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ['15', '30', '50', '100'],
            showTotal: (tot) => `Total ${tot} pending enquiry jobs`,
          }}
        />
      </Card>
    </div>
  );
}
