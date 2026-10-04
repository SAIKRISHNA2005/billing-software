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
  DatePicker,
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
import { exportToExcel } from '@/lib/utils/exportHelper';
import { useTheme } from '@/components/providers/ThemeContext';

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
  const { themeMode } = useTheme();
  const isDark = themeMode === 'dark';
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PendingBillRow[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<PendingBillRow[]>([]);
  const [search, setSearch] = useState('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [clientId, setClientId] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const fetchPending = async (overrideParams?: { companyId?: string; clientId?: string; search?: string }) => {
    setLoading(true);
    try {
      const p = overrideParams !== undefined ? overrideParams : { companyId, clientId, search };
      const res = await axios.get('/api/billing/pending', {
        params: p,
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

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (dateRange && dateRange[0] && dateRange[1]) {
        const itemDate = dayjs(item.completedAt || item.date || item.createdAt);
        if (itemDate.isValid()) {
          if (itemDate.isBefore(dateRange[0].startOf('day')) || itemDate.isAfter(dateRange[1].endOf('day'))) {
            return false;
          }
        }
      }
      return true;
    });
  }, [items, dateRange]);

  const handleResetFilters = () => {
    setSearch('');
    setCompanyId('');
    setClientId('');
    setDateRange(null);
    fetchPending({ search: '', companyId: '', clientId: '' });
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

  const exportRowsToCSV = (rowsToExport: PendingBillRow[], filename: string) => {
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

    const rows = rowsToExport.map((r) => [
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
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pendingExportColumns = [
    { key: 'enquiryId', title: 'Enquiry No' },
    { key: 'transactionNo', title: 'Transaction No' },
    { key: 'clientName', title: 'Client Name' },
    { key: 'companyName', title: 'Company Name' },
    { key: 'loadingType', title: 'Loading Type' },
    { key: 'vehicleNo', title: 'Vehicle Number' },
    { key: 'containerNo', title: 'Container Number' },
    { key: 'weight', title: 'Weight' },
    { key: 'haltingDays', title: 'Halting Days' },
    { key: 'haltingAmount', title: 'Halting Amount (INR)' },
    { key: 'suggestedAmount', title: 'Billing Amount (INR)' },
    { key: 'containerSize', title: 'Size' },
    { key: 'createdAt', title: 'Created Date' },
  ];

  // Export filtered rows currently visible as Excel
  const handleExportFiltered = () => {
    if (filteredItems.length === 0) {
      message.warning('No filtered pending bills data to export');
      return;
    }
    exportToExcel(filteredItems, pendingExportColumns, `TMS_Pending_Bills_Filtered_${dayjs().format('YYYY-MM-DD')}`);
    message.success(`Exported ${filteredItems.length} filtered pending bill records to Excel`);
  };

  // Export all pending rows from server as Excel
  const handleExportAll = async () => {
    try {
      message.loading({ content: 'Fetching all pending bills for export...', key: 'exportAll' });
      const res = await axios.get('/api/billing/pending', { params: { limit: 2000 } });
      const allItems: PendingBillRow[] = res.data?.data?.items || items;
      if (allItems.length === 0) {
        message.warning({ content: 'No pending bills available to export', key: 'exportAll' });
        return;
      }
      exportToExcel(allItems, pendingExportColumns, `TMS_Pending_Bills_ALL_${dayjs().format('YYYY-MM-DD')}`);
      message.success({ content: `Successfully exported all ${allItems.length} pending bills to Excel`, key: 'exportAll' });
    } catch {
      message.error({ content: 'Failed to export all records', key: 'exportAll' });
    }
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
        <Text strong style={{ color: isDark ? '#F1F5F9' : '#17324D' }}>
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
      render: (size: string) => <Tag color="default">{size || '40 FT'}</Tag>,
    },
    {
      title: 'Enquiry / TXN',
      dataIndex: 'transactionNo',
      key: 'transactionNo',
      width: 150,
      render: (txn: string, record: PendingBillRow) => (
        <RecordDetailPopover record={record} title={`Consignment ${record.enquiryId}`}>
          <div>
            <Link href={`/enquiries/${record.enquiryId}`} style={{ fontWeight: 600, color: isDark ? '#60A5FA' : '#1D4ED8' }}>
              {record.enquiryId}
            </Link>
            <div style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#5F6B73' }}>{txn}</div>
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
      title: 'Action',
      key: 'action',
      width: 140,
      align: 'center',
      render: (_, record: PendingBillRow) => (
        <Space size="small">
          <Tooltip title="Create invoice for this consignment">
            <Button
              type="primary"
              size="small"
              icon={<FileAddOutlined />}
              style={{
                backgroundColor: isDark ? '#2563EB' : '#1D4ED8',
                borderColor: isDark ? '#2563EB' : '#1D4ED8',
                fontSize: 12,
                fontWeight: 600,
              }}
              onClick={() => router.push(`/billing/create?enquiryIds=${record.enquiryId}&companyId=${record.companyId}&clientId=${record.clientId}`)}
            >
              Bill
            </Button>
          </Tooltip>
          <RecordDetailPopover record={record} title={`Consignment ${record.enquiryId}`}>
            <Tooltip title="View Consignment Details">
              <Button type="text" size="small" icon={<EyeOutlined style={{ color: isDark ? '#60A5FA' : '#365A73' }} />} />
            </Tooltip>
          </RecordDetailPopover>
          <Tooltip title="Edit Consignment">
            <Link href={`/enquiries/${record.enquiryId}`}>
              <Button type="text" size="small" icon={<EditOutlined style={{ color: isDark ? '#4ADE80' : '#3F6F4A' }} />} />
            </Link>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const totalSelectedAmount = selectedRows.reduce((sum, r) => sum + (r.suggestedAmount || 0), 0);

  return (
    <div style={{ padding: '4px 0 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={2} style={{ margin: 0, color: isDark ? '#F1F5F9' : '#1E2933', fontSize: 22, fontWeight: 600 }}>
            <FileAddOutlined style={{ marginRight: 8, color: '#C58A2A' }} />
            Pending Bills
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: isDark ? '#94A3B8' : '#5F6B73' }}>Completed transport jobs waiting to be grouped and issued into client invoices</Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => fetchPending()}>
            Refresh
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportAll}>
            Export All
          </Button>
          {selectedRows.length > 0 ? (
            <ActionConfirmPopover
              title={`Are you sure you want to create an invoice for ${selectedRows.length} item(s)?`}
              description={`Selected ${selectedRows.length} consignment(s) totaling ${formatCurrencyINR(totalSelectedAmount)}.`}
              okText="Yes, Proceed to Billing"
              cancelText="No, Cancel"
              onConfirm={handleCreateBill}
            >
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                size="large"
                style={{
                  backgroundColor: isDark ? '#2563EB' : '#1D4ED8',
                  borderColor: isDark ? '#2563EB' : '#1D4ED8',
                  fontWeight: 600,
                }}
              >
                Create Bill ({selectedRows.length})
              </Button>
            </ActionConfirmPopover>
          ) : (
            <Tooltip title="Select consignments using the checkboxes on the left to bill in batch, or click to open Bill Creation">
              <Button
                type="primary"
                icon={<FileAddOutlined />}
                size="large"
                style={{
                  backgroundColor: isDark ? '#2563EB' : '#1D4ED8',
                  borderColor: isDark ? '#2563EB' : '#1D4ED8',
                  fontWeight: 600,
                }}
                onClick={() => router.push('/billing/create')}
              >
                Create Bill
              </Button>
            </Tooltip>
          )}
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
            onPressEnter={() => fetchPending()}
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
          <DatePicker.RangePicker
            placeholder={['Start Date', 'End Date']}
            format="DD/MM/YYYY"
            value={dateRange}
            onChange={(d) => setDateRange(d as any)}
            style={{ width: 230 }}
          />
          <Button type="primary" onClick={() => fetchPending()}>
            Filter
          </Button>
          <Button onClick={handleResetFilters}>
            Reset
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportFiltered}>
            Export Filtered
          </Button>
        </Space>

        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={filteredItems}
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
