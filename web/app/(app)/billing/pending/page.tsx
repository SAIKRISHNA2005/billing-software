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
  Modal,
  Divider,
  Row,
  Col,
  message,
} from 'antd';
import {
  FileAddOutlined,
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ArrowRightOutlined,
  DollarOutlined,
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
import { getCachedCompanies, getCachedClients, setCachedCompanies, setCachedClients } from '@/lib/client/masterCache';

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
  otherCharges?: number;
  advanceAmount?: number;
  extraAdvance?: number;
  totalAdvance?: number;
  customCharges?: any[];
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

  // Create Bill Charges Confirmation Popup State
  const [createBillModalOpen, setCreateBillModalOpen] = useState(false);
  const [modalRows, setModalRows] = useState<PendingBillRow[]>([]);

  const fetchPending = async (overrideParams?: { companyId?: string; clientId?: string; search?: string }) => {
    setLoading(true);
    try {
      const p = overrideParams !== undefined ? overrideParams : { companyId, clientId, search };
      const res = await axios.get('/api/billing/pending', {
        params: p,
      });
      if (res.data && res.data.success) {
        setItems(res.data.data.items || []);
        if (res.data.data.companies && Array.isArray(res.data.data.companies) && res.data.data.companies.length > 0) {
          setCompanies(res.data.data.companies);
          setCachedCompanies(res.data.data.companies);
        }
        if (res.data.data.clients && Array.isArray(res.data.data.clients) && res.data.data.clients.length > 0) {
          setClients(res.data.data.clients);
          setCachedClients(res.data.data.clients);
        }
      } else {
        message.error(res.data?.message || 'Failed to fetch pending bills');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error loading pending bills');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePending = async (record: PendingBillRow) => {
    const targetId = record.enquiryId || record.id;
    if (!targetId) {
      message.error('No valid consignment ID found to delete');
      return;
    }

    try {
      const res = await axios.delete(`/api/enquiries/${targetId}`);
      if (res.data && res.data.success) {
        message.success(`Consignment ${record.transactionNo || record.enquiryNumber || targetId} deleted successfully`);
        fetchPending();
      } else {
        message.error(res.data?.message || 'Failed to delete pending consignment');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error deleting pending consignment');
    }
  };

  const parseDateFlexible = (val: any): dayjs.Dayjs | null => {
    if (!val) return null;
    const str = String(val).trim();
    if (!str || str === '-') return null;
    const match = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (match) {
      const d = parseInt(match[1], 10);
      const m = parseInt(match[2], 10) - 1;
      const y = parseInt(match[3], 10);
      const dt = dayjs(new Date(y, m, d));
      if (dt.isValid()) return dt;
    }
    const dt = dayjs(val);
    return dt.isValid() ? dt : null;
  };

  const filteredItems = useMemo(() => {
    const list = items.filter((item) => {
      if (dateRange && dateRange[0] && dateRange[1]) {
        const itemDate = parseDateFlexible(item.completedAt || item.date || item.createdAt);
        if (itemDate) {
          if (itemDate.isBefore(dateRange[0].startOf('day')) || itemDate.isAfter(dateRange[1].endOf('day'))) {
            return false;
          }
        } else {
          return false;
        }
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const numA = parseInt(String(a.enquiryNumber || a.enquiryId || '').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.enquiryNumber || b.enquiryId || '').replace(/\D/g, ''), 10) || 0;
      if (numA !== numB) return numB - numA;
      const timeA = parseDateFlexible(a.createdAt || a.completedAt || a.date)?.valueOf() || 0;
      const timeB = parseDateFlexible(b.createdAt || b.completedAt || b.date)?.valueOf() || 0;
      return timeB - timeA;
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
      const [comps, clts] = await Promise.all([
        getCachedCompanies(),
        getCachedClients(),
      ]);
      if (comps && comps.length > 0) setCompanies(comps);
      if (clts && clts.length > 0) setClients(clts);
    } catch (e) {
      console.error('Failed to load masters:', e);
    }
  };

  useEffect(() => {
    fetchPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modalCalculations = useMemo(() => {
    let freightTotal = 0;
    let haltingTotal = 0;
    let otherTotal = 0;
    let customTotal = 0;
    let advanceCashTotal = 0;
    let extraAdvanceTotal = 0;
    let totalAdvance = 0;
    let grossTotal = 0;
    let netTotal = 0;

    const itemsDetail = modalRows.map((row) => {
      const freight = Number(row.freightAmount) || 0;
      const halting = Number(row.haltingAmount) || 0;
      const haltingDays = Number(row.haltingDays) || 0;
      const other = Number(row.otherCharges) || 0;
      const advCash = Number(row.advanceAmount) || 0;
      const extraAdv = Number(row.extraAdvance) || 0;
      const advSum = advCash + extraAdv;

      let customList: { name: string; amount: number }[] = [];
      const rawCustom = (row as any).customCharges;
      if (Array.isArray(rawCustom)) {
        customList = rawCustom;
      } else if (typeof rawCustom === 'string' && rawCustom.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(rawCustom);
          if (Array.isArray(parsed)) customList = parsed;
        } catch {}
      }
      const cTotal = customList.reduce((s, c) => s + (Number(c.amount || (c as any).chargeAmount) || 0), 0);
      const gross = freight + halting + other + cTotal;
      const net = Math.max(0, gross - advSum);

      freightTotal += freight;
      haltingTotal += halting;
      otherTotal += other;
      customTotal += cTotal;
      advanceCashTotal += advCash;
      extraAdvanceTotal += extraAdv;
      totalAdvance += advSum;
      grossTotal += gross;
      netTotal += net;

      return {
        row,
        freight,
        halting,
        haltingDays,
        other,
        customList,
        cTotal,
        advCash,
        extraAdv,
        advSum,
        gross,
        net,
      };
    });

    return {
      itemsDetail,
      freightTotal,
      haltingTotal,
      otherTotal,
      customTotal,
      advanceCashTotal,
      extraAdvanceTotal,
      totalAdvance,
      grossTotal,
      netTotal,
    };
  }, [modalRows]);

  const handleOpenCreateBillModal = (rowsToBill?: PendingBillRow[]) => {
    const targets = rowsToBill && rowsToBill.length > 0 ? rowsToBill : selectedRows;
    if (targets.length === 0) {
      message.warning('Please select at least one enquiry to create a bill.');
      return;
    }
    setModalRows(targets);
    setCreateBillModalOpen(true);
  };

  const handleProceedFromModal = () => {
    if (modalRows.length === 0) return;
    const enquiryIds = modalRows.map((r) => r.enquiryId).join(',');
    const company = modalRows[0].companyId;
    const client = modalRows[0].clientId;
    setCreateBillModalOpen(false);
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
      width: 175,
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
              onClick={() => handleOpenCreateBillModal([record])}
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
          <ActionConfirmPopover
            title="Delete Consignment?"
            description={`Are you sure you want to delete pending consignment ${record.transactionNo || record.enquiryId || record.id}? This will move it to the trash bin.`}
            okText="Yes, Delete"
            cancelText="No, Keep It"
            onConfirm={() => handleDeletePending(record)}
          >
            <Tooltip title="Delete Consignment">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined style={{ color: isDark ? '#F87171' : '#DC2626' }} />}
              />
            </Tooltip>
          </ActionConfirmPopover>
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
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              size="large"
              style={{
                backgroundColor: isDark ? '#2563EB' : '#1D4ED8',
                borderColor: isDark ? '#2563EB' : '#1D4ED8',
                fontWeight: 600,
              }}
              onClick={() => handleOpenCreateBillModal(selectedRows)}
            >
              Create Bill ({selectedRows.length})
            </Button>
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

      {/* ========================================================================= */}
      {/* CREATE BILL CHARGES BREAKDOWN & CONFIRMATION POPUP MODAL */}
      {/* ========================================================================= */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
            <FileAddOutlined style={{ color: isDark ? '#38BDF8' : '#1D4ED8', fontSize: 20 }} />
            <span style={{ fontSize: 17, fontWeight: 700, color: isDark ? '#F1F5F9' : '#1E2933' }}>
              Create Bill - Review Charges &amp; Deductions
            </span>
            <Tag color="blue" style={{ fontWeight: 600, marginLeft: 8 }}>
              {modalRows.length} Job{modalRows.length > 1 ? 's' : ''} Selected
            </Tag>
          </div>
        }
        open={createBillModalOpen}
        onCancel={() => setCreateBillModalOpen(false)}
        width={780}
        footer={[
          <Button key="cancel" size="large" onClick={() => setCreateBillModalOpen(false)}>
            Cancel
          </Button>,
          <Button
            key="proceed"
            type="primary"
            size="large"
            icon={<ArrowRightOutlined />}
            style={{
              backgroundColor: isDark ? '#2563EB' : '#1D4ED8',
              borderColor: isDark ? '#2563EB' : '#1D4ED8',
              fontWeight: 600,
            }}
            onClick={handleProceedFromModal}
          >
            Proceed to Create Bill Invoice ➔
          </Button>,
        ]}
      >
        <div style={{ maxHeight: '68vh', overflowY: 'auto', paddingRight: 4 }}>
          {/* 1. Client & Company Context Card */}
          {modalRows.length > 0 && (
            <div
              style={{
                backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                borderRadius: 6,
                padding: '12px 16px',
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                border: isDark ? '1px solid #334155' : '1px solid #CBD5E1',
              }}
            >
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Client / Billed Party</Text>
                <Text strong style={{ fontSize: 15, color: isDark ? '#F8FAFC' : '#0F172A' }}>
                  {modalRows[0].clientName || modalRows[0].clientId}
                </Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Operating Transporter Company</Text>
                <Text strong style={{ fontSize: 14, color: isDark ? '#E2E8F0' : '#1E293B' }}>
                  {modalRows[0].companyName || modalRows[0].companyId}
                </Text>
              </div>
            </div>
          )}

          {/* 2. Itemized Consignments Charges Breakdown */}
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: isDark ? '#94A3B8' : '#475569' }}>
              Enquiry Charges Breakdown:
            </Text>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {modalCalculations.itemsDetail.map((item, idx) => (
              <div
                key={item.row.enquiryId || idx}
                style={{
                  border: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
                  borderRadius: 6,
                  padding: 14,
                  backgroundColor: isDark ? '#0F172A' : '#FAFAFA',
                }}
              >
                {/* Consignment Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <Space wrap>
                    <Tag color="cyan" style={{ fontWeight: 700, fontSize: 12 }}>
                      Enquiry #{item.row.enquiryNumber || item.row.enquiryId}
                    </Tag>
                    <Text strong style={{ fontSize: 13 }}>
                      Vehicle: {item.row.vehicleNo || '-'}
                    </Text>
                    <span style={{ color: '#94A3B8' }}>|</span>
                    <Text strong style={{ fontSize: 13 }}>
                      Container: {item.row.containerNo || '-'}
                    </Text>
                    <Tag>{item.row.containerSize || '40 FT'}</Tag>
                  </Space>
                  <Tag color="blue" style={{ fontSize: 13, fontWeight: 700, padding: '3px 8px' }}>
                    Net Amount: {formatCurrencyINR(item.net)}
                  </Tag>
                </div>

                {/* Charges Breakdown Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                    gap: 10,
                    fontSize: 12.5,
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    padding: 10,
                    borderRadius: 4,
                    border: isDark ? '1px solid #334155' : '1px solid #EDF2F7',
                  }}
                >
                  <div>
                    <span style={{ color: '#64748B', display: 'block' }}>Transportation / Freight:</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrencyINR(item.freight)}</span>
                  </div>

                  <div>
                    <span style={{ color: '#64748B', display: 'block' }}>
                      Halting {item.haltingDays > 0 ? `(${item.haltingDays} Day${item.haltingDays > 1 ? 's' : ''})` : ''}:
                    </span>
                    <span style={{ fontWeight: 600 }}>{formatCurrencyINR(item.halting)}</span>
                  </div>

                  {item.other > 0 && (
                    <div>
                      <span style={{ color: '#64748B', display: 'block' }}>Other Charges:</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrencyINR(item.other)}</span>
                    </div>
                  )}

                  {item.customList.map((c, cIdx) => (
                    <div key={cIdx}>
                      <span style={{ color: '#64748B', display: 'block' }}>{c.name || 'Custom Charge'}:</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrencyINR(Number(c.amount || (c as any).chargeAmount) || 0)}</span>
                    </div>
                  ))}

                  <div style={{ borderTop: isDark ? '1px dashed #475569' : '1px dashed #CBD5E1', paddingTop: 6, gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Gross Charges:</span>
                    <span style={{ fontWeight: 700 }}>{formatCurrencyINR(item.gross)}</span>
                  </div>

                  {item.advSum > 0 && (
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDark ? '#450A0A' : '#FEF2F2', padding: '6px 10px', borderRadius: 4 }}>
                      <span style={{ color: '#DC2626', fontWeight: 600 }}>
                        Less: Advance Paid (Advance: {formatCurrencyINR(item.advCash)}{item.extraAdv > 0 ? ` + Extra: ${formatCurrencyINR(item.extraAdv)}` : ''}):
                      </span>
                      <span style={{ color: '#DC2626', fontWeight: 700, fontSize: 13 }}>
                        - {formatCurrencyINR(item.advSum)}
                      </span>
                    </div>
                  )}

                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                    <span style={{ fontWeight: 700, color: isDark ? '#F8FAFC' : '#0F172A' }}>Consignment Total Payable:</span>
                    <span style={{ fontWeight: 800, fontSize: 14.5, color: '#16A34A' }}>{formatCurrencyINR(item.net)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 3. Consolidated Grand Total Summary Card */}
          <div
            style={{
              marginTop: 18,
              padding: 16,
              borderRadius: 6,
              backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
              border: isDark ? '1.5px solid #3B82F6' : '1.5px solid #2563EB',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span>Total Freight Charges:</span>
              <span style={{ fontWeight: 600 }}>{formatCurrencyINR(modalCalculations.freightTotal)}</span>
            </div>
            {modalCalculations.haltingTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span>Total Halting Charges:</span>
                <span style={{ fontWeight: 600 }}>{formatCurrencyINR(modalCalculations.haltingTotal)}</span>
              </div>
            )}
            {modalCalculations.otherTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span>Total Other Charges:</span>
                <span style={{ fontWeight: 600 }}>{formatCurrencyINR(modalCalculations.otherTotal)}</span>
              </div>
            )}
            {modalCalculations.customTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span>Total Custom Charges:</span>
                <span style={{ fontWeight: 600 }}>{formatCurrencyINR(modalCalculations.customTotal)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, borderTop: isDark ? '1px dashed #475569' : '1px dashed #CBD5E1', paddingTop: 6 }}>
              <span style={{ fontWeight: 600 }}>Gross Total:</span>
              <span style={{ fontWeight: 700 }}>{formatCurrencyINR(modalCalculations.grossTotal)}</span>
            </div>
            {modalCalculations.totalAdvance > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13.5, color: '#DC2626' }}>
                <span style={{ fontWeight: 600 }}>Less: Total Advance Paid (Deductions):</span>
                <span style={{ fontWeight: 700 }}>- {formatCurrencyINR(modalCalculations.totalAdvance)}</span>
              </div>
            )}
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, display: 'block', color: isDark ? '#F8FAFC' : '#0F172A' }}>
                  Total Bill Amount:
                </span>
                <span style={{ fontSize: 11.5, color: '#64748B' }}>(Gross Charges minus Advance)</span>
              </div>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#16A34A' }}>
                {formatCurrencyINR(modalCalculations.netTotal)}
              </span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
