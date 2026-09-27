'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Input,
  Select,
  Tag,
  Button,
  Space,
  Typography,
  DatePicker,
  Popconfirm,
  Tooltip,
  message,
} from 'antd';
import {
  AuditOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  ReloadOutlined,
  DownloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import { formatCurrencyINR } from '@/lib/utils/format';
import { ActionConfirmPopover } from '@/components/common/ActionConfirmPopover';
import { RecordDetailPopover } from '@/components/common/RecordDetailPopover';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

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
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [grandTotal, setGrandTotal] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchBills = async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        limit: pagination.pageSize,
        status: 'PROCESSED',
        financialYear,
        companyId,
        clientId,
        search,
      };

      if (dateRange && dateRange[0] && dateRange[1]) {
        params.dateFrom = dateRange[0].format('YYYY-MM-DD');
        params.dateTo = dateRange[1].format('YYYY-MM-DD');
      }

      const res = await axios.get('/api/billing/bills', { params });
      if (res.data && res.data.success) {
        const result = res.data.data;
        setItems(result.items || []);
        setGrandTotal(result.grandTotal || 0);
        setPagination({
          current: result.page || page,
          pageSize: result.limit || 15,
          total: result.total || 0,
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
    fetchBills(1);
  }, []);

  // Handle Download PDF
  const handleDownloadPdf = async (record: any) => {
    setDownloadingId(record.id);
    try {
      const res = await axios.get(`/api/billing/pdf/${record.id}`);
      if (res.data && res.data.success) {
        if (res.data.data?.pdfUrl) {
          window.open(res.data.data.pdfUrl, '_blank');
        } else if (res.data.data?.pdfBase64) {
          const link = document.createElement('a');
          link.href = 'data:application/pdf;base64,' + res.data.data.pdfBase64;
          link.download = `Invoice_${record.billNumber ? String(record.billNumber).replace(/\//g, '-') : record.id}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          message.success('Invoice PDF downloaded successfully');
        } else {
          message.info('PDF generated successfully');
        }
      } else {
        message.error(res.data?.message || 'Failed to generate PDF for download');
      }
    } catch {
      message.error('Error generating PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle Delete Bill
  const handleDeleteBill = async (record: any) => {
    try {
      const res = await axios.delete(`/api/billing/bills/${record.id}`);
      if (res.data && res.data.success) {
        message.success('Bill deleted successfully');
        fetchBills(pagination.current);
      } else {
        message.error(res.data?.message || 'Failed to delete bill');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error deleting bill');
    }
  };

  // Export List to CSV
  const handleExportCSV = () => {
    if (items.length === 0) {
      message.warning('No processed bills to export');
      return;
    }

    const headers = ['Company Name', 'Bill Number', 'Client Name', 'Total Amount', 'Billing Date', 'Financial Year', 'Status'];
    const rows = items.map((b) => [
      `"${(b.companyName || '').replace(/"/g, '""')}"`,
      `"${b.billNumber || ''}"`,
      `"${(b.clientName || '').replace(/"/g, '""')}"`,
      b.totalAmount || 0,
      `"${b.billingDate || ''}"`,
      `"${b.financialYear || ''}"`,
      `"${b.status || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `TMS_Processed_Bills_${dayjs().format('YYYY-MM-DD')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Processed bills exported to CSV successfully');
  };

  const columns: ColumnsType<any> = [
    {
      title: 'Company Name',
      dataIndex: 'companyName',
      key: 'companyName',
      ellipsis: true,
      render: (name: string) => <Text strong>{name || '-'}</Text>,
    },
    {
      title: 'Bill Number',
      dataIndex: 'billNumber',
      key: 'billNumber',
      width: 140,
      render: (num: string, record: any) => (
        <RecordDetailPopover record={record} title={`Invoice ${num || record.id}`} type="bill">
          <Link href={`/billing/processed/${record.id}`} style={{ fontWeight: 600, color: '#1677ff' }}>
            {num || record.id}
          </Link>
        </RecordDetailPopover>
      ),
    },
    {
      title: 'Client Name',
      dataIndex: 'clientName',
      key: 'clientName',
      ellipsis: true,
      render: (name: string) => <Text>{name || '-'}</Text>,
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      width: 140,
      render: (amt: number) => (
        <Text strong style={{ color: '#3f8600' }}>
          {formatCurrencyINR(amt)}
        </Text>
      ),
    },
    {
      title: 'Billing Date',
      dataIndex: 'billingDate',
      key: 'billingDate',
      width: 120,
      render: (d: string) => (d ? dayjs(d).format('DD-MM-YYYY') : '-'),
    },
    {
      title: 'FY',
      dataIndex: 'financialYear',
      key: 'financialYear',
      width: 90,
      align: 'center',
      render: (fy: string) => <Tag color="purple">{fy || '-'}</Tag>,
    },
    {
      title: 'Download',
      key: 'download',
      width: 110,
      align: 'center',
      render: (_, record: any) => (
        <ActionConfirmPopover
          title="Download Official Bill PDF?"
          description={`Generate and download PDF invoice for ${record.billNumber || record.id}.`}
          okText="Yes, Download"
          cancelText="No, Cancel"
          onConfirm={() => handleDownloadPdf(record)}
        >
          <Button
            type="primary"
            size="small"
            icon={<DownloadOutlined />}
            loading={downloadingId === record.id}
          >
            Download
          </Button>
        </ActionConfirmPopover>
      ),
    },
    {
      title: 'Delete',
      key: 'delete',
      width: 90,
      align: 'center',
      render: (_, record: any) => (
        <ActionConfirmPopover
          title="Delete Invoice Record?"
          description={`Are you sure you want to delete invoice ${record.billNumber || record.id}? This action cannot be undone.`}
          okText="Yes, Delete"
          cancelText="No, Keep It"
          onConfirm={() => handleDeleteBill(record)}
        >
          <Tooltip title="Delete Invoice">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </ActionConfirmPopover>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 170,
      fixed: 'right' as const,
      align: 'center',
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <Link href={`/billing/processed/${record.id}`}>
            <Button
              type="primary"
              ghost
              size="small"
              icon={<EyeOutlined />}
              style={{ borderRadius: 4 }}
            >
              View
            </Button>
          </Link>
          <Link href={`/billing/processed/${record.id}/edit`}>
            <Button
              size="small"
              icon={<EditOutlined />}
              style={{ borderColor: '#52c41a', color: '#52c41a', borderRadius: 4 }}
            >
              Edit
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <AuditOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Processed Bills Directory
          </Title>
          <Text type="secondary">Issued invoices with assigned financial-year sequence numbers and generated PDFs</Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => fetchBills(1)}>
            Refresh
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
            Export Excel
          </Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {/* Filters bar */}
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Search Bill No, Company, Client..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => fetchBills(1)}
            style={{ width: 240 }}
            allowClear
          />
          <RangePicker
            style={{ width: 240 }}
            format="DD/MM/YYYY"
            value={dateRange}
            onChange={(dates) => setDateRange(dates as any)}
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
              <Select.Option key={c.id} value={c.id}>
                {c.name}
              </Select.Option>
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
              <Select.Option key={c.id} value={c.id}>
                {c.name}
              </Select.Option>
            ))}
          </Select>
          <Button type="primary" onClick={() => fetchBills(1)}>
            Filter
          </Button>
          <Button
            onClick={() => {
              setSearch('');
              setDateRange(null);
              setFinancialYear('');
              setCompanyId('');
              setClientId('');
            }}
          >
            Reset
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={pagination}
          onChange={(pag) => fetchBills(pag.current)}
          footer={() => (
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <Text strong>Total Processed Invoices Count: {pagination.total}</Text>
              <Text strong>
                Grand Total Billed:{' '}
                <span style={{ color: '#3f8600' }}>{formatCurrencyINR(grandTotal)}</span>
              </Text>
            </div>
          )}
        />
      </Card>
    </div>
  );
}
