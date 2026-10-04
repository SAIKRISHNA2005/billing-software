'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Card,
  Table,
  Select,
  Button,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Statistic,
  Input,
  DatePicker,
  Tabs,
  Modal,
  Form,
  InputNumber,
  Popconfirm,
  Alert,
  Tooltip,
  message,
} from 'antd';
import {
  BarChartOutlined,
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PrinterOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  AuditOutlined,
  FileAddOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import { formatCurrencyINR } from '@/lib/utils/format';
import { useTheme } from '@/components/providers/ThemeContext';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

export default function ConsolidatedBillingReportPage() {
  const { themeMode } = useTheme();
  const isDark = themeMode === 'dark';
  const [activeTab, setActiveTab] = useState('invoices');

  // ==========================================
  // TAB 1: INVOICES & REVENUE REPORT STATE
  // ==========================================
  const [reportLoading, setReportLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [financialYear, setFinancialYear] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string | undefined>();
  const [clientFilter, setClientFilter] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  // Master dropdown data
  const [companies, setCompanies] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  // ==========================================
  // TAB 2: CLIENT PAYMENTS STATE
  // ==========================================
  const [payments, setPayments] = useState<any[]>([]);
  const [billsList, setBillsList] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentModeFilter, setPaymentModeFilter] = useState<string | undefined>();
  const [paymentClientFilter, setPaymentClientFilter] = useState<string | undefined>();
  const [paymentSearch, setPaymentSearch] = useState('');

  // Payment Modal State
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentForm] = Form.useForm();

  // Invoice Edit Modal State
  const [editInvoiceModalOpen, setEditInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [invoiceForm] = Form.useForm();

  // ==========================================
  // TAB 3: AGEING ANALYSIS STATE
  // ==========================================
  const [ageingLoading, setAgeingLoading] = useState(false);
  const [ageingReport, setAgeingReport] = useState<any>(null);

  // Load master companies and clients
  const fetchMasters = async () => {
    try {
      const [compRes, cltRes] = await Promise.all([
        axios.get('/api/master/companies?limit=100'),
        axios.get('/api/master/clients?limit=100'),
      ]);
      if (compRes.data?.success) setCompanies(compRes.data.data?.items || (Array.isArray(compRes.data.data) ? compRes.data.data : []));
      if (cltRes.data?.success) setClients(cltRes.data.data?.items || (Array.isArray(cltRes.data.data) ? cltRes.data.data : []));
    } catch (e) {
      console.error('Failed to load masters:', e);
    }
  };

  // Fetch primary billing invoices report
  const fetchBillingReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const params: Record<string, string> = {};
      if (financialYear) params.financialYear = financialYear;
      if (statusFilter) params.status = statusFilter;
      if (companyFilter) params.companyId = companyFilter;
      if (clientFilter) params.clientId = clientFilter;
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.dateFrom = dateRange[0].format('YYYY-MM-DD');
        params.dateTo = dateRange[1].format('YYYY-MM-DD');
      }

      const res = await axios.get('/api/reports/billing', { params });
      if (res.data && res.data.success) {
        const raw = res.data.data;
        const list = Array.isArray(raw) ? raw : (raw?.items || []);
        setInvoices(list);
        setTotals(raw?.totals || {});
      } else {
        message.error(res.data?.message || 'Failed to fetch billing report');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error loading billing report');
    } finally {
      setReportLoading(false);
    }
  }, [financialYear, statusFilter, companyFilter, clientFilter, dateRange]);

  // Fetch client payments
  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const [payRes, billRes] = await Promise.all([
        axios.get('/api/billing/payments'),
        axios.get('/api/billing/bills?limit=100&status=PROCESSED'),
      ]);

      if (payRes.data?.success) {
        const raw = payRes.data.data;
        const list = Array.isArray(raw) ? raw : (raw?.items || []);
        setPayments(list);
      }
      if (billRes.data?.success) {
        const rawB = billRes.data.data;
        const bList = Array.isArray(rawB) ? rawB : (rawB?.items || []);
        setBillsList(bList);
      }
    } catch {
      message.error('Failed to load client payment records');
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  // Fetch ageing report
  const fetchAgeingReport = useCallback(async () => {
    setAgeingLoading(true);
    try {
      const res = await axios.get('/api/billing/ageing');
      if (res.data?.success) {
        setAgeingReport(res.data.data);
      }
    } catch {
      message.error('Failed to load ageing report');
    } finally {
      setAgeingLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMasters();
    fetchBillingReport();
    fetchPayments();
    fetchAgeingReport();
  }, [fetchBillingReport, fetchPayments, fetchAgeingReport]);

  // Filtered invoices by search
  const filteredInvoices = useMemo(() => {
    if (!Array.isArray(invoices)) return [];
    if (!searchQuery.trim()) return invoices;
    const q = searchQuery.toLowerCase().trim();
    return invoices.filter((b) => {
      return (
        String(b.billNumber || '').toLowerCase().includes(q) ||
        String(b.companyName || '').toLowerCase().includes(q) ||
        String(b.clientName || '').toLowerCase().includes(q) ||
        String(b.financialYear || '').toLowerCase().includes(q)
      );
    });
  }, [invoices, searchQuery]);

  // Filtered payments (strictly guarded against non-array values)
  const filteredPayments = useMemo(() => {
    if (!Array.isArray(payments)) return [];
    return payments.filter((p) => {
      if (paymentModeFilter && p.paymentMode !== paymentModeFilter) return false;
      if (paymentClientFilter && p.clientId !== paymentClientFilter) return false;
      if (paymentSearch.trim()) {
        const q = paymentSearch.toLowerCase().trim();
        const match =
          String(p.billNumber || '').toLowerCase().includes(q) ||
          String(p.clientName || '').toLowerCase().includes(q) ||
          String(p.referenceNo || p.referenceNumber || '').toLowerCase().includes(q) ||
          String(p.id || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [payments, paymentModeFilter, paymentClientFilter, paymentSearch]);

  const totalPaymentsReceived = useMemo(() => {
    if (!Array.isArray(payments)) return 0;
    return payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }, [payments]);

  // Handle Recording / Updating Client Payment
  const handleRecordPaymentSubmit = async (values: any) => {
    setSubmittingPayment(true);
    try {
      const payload = {
        billId: values.billId,
        amount: values.amount,
        paymentDate: values.paymentDate ? values.paymentDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        paymentMode: values.paymentMode,
        referenceNo: values.referenceNo,
        notes: values.notes,
      };

      if (editingPayment) {
        const res = await axios.put(`/api/billing/payments/${editingPayment.id}`, payload);
        if (res.data?.success) {
          message.success('Client payment updated successfully!');
          setPaymentModalVisible(false);
          setEditingPayment(null);
          paymentForm.resetFields();
          fetchPayments();
          fetchBillingReport();
          fetchAgeingReport();
        } else {
          message.error(res.data?.message || 'Failed to update payment');
        }
      } else {
        const res = await axios.post('/api/billing/payments', payload);
        if (res.data?.success) {
          message.success('Client payment recorded successfully!');
          setPaymentModalVisible(false);
          paymentForm.resetFields();
          fetchPayments();
          fetchBillingReport();
          fetchAgeingReport();
        } else {
          message.error(res.data?.message || 'Failed to record payment');
        }
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error recording payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleOpenAddPayment = () => {
    setEditingPayment(null);
    paymentForm.resetFields();
    paymentForm.setFieldsValue({
      paymentDate: dayjs(),
      paymentMode: 'Bank Transfer',
    });
    setPaymentModalVisible(true);
  };

  const handleOpenEditPayment = (record: any) => {
    setEditingPayment(record);
    paymentForm.setFieldsValue({
      billId: record.billId,
      amount: record.amount,
      paymentDate: record.paymentDate ? dayjs(record.paymentDate) : dayjs(),
      paymentMode: record.paymentMode || 'Bank Transfer',
      referenceNo: record.referenceNo || record.referenceNumber || '',
      notes: record.notes || record.remarks || '',
    });
    setPaymentModalVisible(true);
  };

  const handleOpenEditInvoice = (record: any) => {
    setEditingInvoice(record);
    invoiceForm.setFieldsValue({
      billingDate: record.billingDate ? dayjs(record.billingDate) : dayjs(),
      dueDate: record.dueDate ? dayjs(record.dueDate) : undefined,
      status: record.status || 'PROCESSED',
      notes: record.notes || '',
    });
    setEditInvoiceModalOpen(true);
  };

  const handleSaveInvoiceEdit = async (values: any) => {
    if (!editingInvoice) return;
    setSubmittingInvoice(true);
    try {
      const payload = {
        billingDate: values.billingDate ? values.billingDate.format('YYYY-MM-DD') : undefined,
        dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : undefined,
        status: values.status,
        notes: values.notes,
      };
      const res = await axios.put(`/api/billing/bills/${editingInvoice.id}`, payload);
      if (res.data?.success) {
        message.success('Invoice details updated successfully');
        setEditInvoiceModalOpen(false);
        setEditingInvoice(null);
        fetchBillingReport();
      } else {
        message.error(res.data?.message || 'Failed to update invoice');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error updating invoice');
    } finally {
      setSubmittingInvoice(false);
    }
  };

  // Handle Delete Payment
  const handleDeletePayment = async (id: string) => {
    try {
      const res = await axios.delete(`/api/billing/payments/${id}`);
      if (res.data?.success) {
        message.success('Payment record deleted');
        fetchPayments();
        fetchBillingReport();
        fetchAgeingReport();
      } else {
        message.error(res.data?.message || 'Failed to delete payment');
      }
    } catch {
      message.error('Error deleting payment');
    }
  };

  // Handle Delete Invoice
  const handleDeleteInvoice = async (id: string) => {
    try {
      const res = await axios.delete(`/api/billing/bills/${id}`);
      if (res.data?.success) {
        message.success('Invoice record deleted successfully');
        fetchBillingReport();
        fetchAgeingReport();
      } else {
        message.error(res.data?.message || 'Failed to delete invoice');
      }
    } catch {
      message.error('Error deleting invoice');
    }
  };

  // Export Billing Invoices helper
  const exportInvoicesToCSV = (rows: any[], filename: string) => {
    const headers = ['Bill Number', 'Financial Year', 'Billing Date', 'Company', 'Client', 'Status', 'Total Amount'];
    const csvRows = rows.map((b) => [
      `"${b.billNumber || ''}"`,
      `"${b.financialYear || ''}"`,
      `"${b.billingDate || ''}"`,
      `"${(b.companyName || '').replace(/"/g, '""')}"`,
      `"${(b.clientName || '').replace(/"/g, '""')}"`,
      `"${b.status || ''}"`,
      b.totalAmount || 0,
    ]);

    const csvContent = [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportFiltered = () => {
    if (filteredInvoices.length === 0) {
      message.warning('No filtered billing records to export');
      return;
    }
    exportInvoicesToCSV(filteredInvoices, `TMS_Billing_Report_Filtered_${dayjs().format('YYYY-MM-DD')}.csv`);
    message.success(`Exported ${filteredInvoices.length} filtered billing records`);
  };

  const handleExportAll = () => {
    if (invoices.length === 0) {
      message.warning('No billing records to export');
      return;
    }
    exportInvoicesToCSV(invoices, `TMS_Billing_Report_ALL_${dayjs().format('YYYY-MM-DD')}.csv`);
    message.success(`Exported all ${invoices.length} billing records`);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setFinancialYear('');
    setCompanyFilter(undefined);
    setClientFilter(undefined);
    setStatusFilter('');
    setDateRange(null);
  };

  // Columns for Tab 1: Invoices
  const invoiceColumns: ColumnsType<any> = [
    {
      title: 'Bill Number',
      dataIndex: 'billNumber',
      key: 'billNumber',
      width: 140,
      render: (num: string, record: any) => (
        <Link href={`/billing/processed/${record.id}`} style={{ fontWeight: 600, color: isDark ? '#60A5FA' : '#1D4ED8', fontVariantNumeric: 'tabular-nums' }}>
          {num || 'DRAFT'}
        </Link>
      ),
    },
    {
      title: 'FY',
      dataIndex: 'financialYear',
      key: 'financialYear',
      width: 90,
      align: 'center',
      render: (fy: string) => (
        <Tag style={{
          background: isDark ? '#27272A' : '#F4F4F5',
          color: isDark ? '#E4E4E7' : '#27272A',
          border: isDark ? '1px solid #3F3F46' : '1px solid #E4E4E7',
          fontWeight: 600
        }}>
          {fy || '-'}
        </Tag>
      ),
    },
    {
      title: 'Billing Date',
      dataIndex: 'billingDate',
      key: 'billingDate',
      width: 110,
      render: (d: string) => (d ? dayjs(d).format('DD-MM-YYYY') : '-'),
    },
    { title: 'Company', dataIndex: 'companyName', key: 'companyName', ellipsis: true },
    { title: 'Client', dataIndex: 'clientName', key: 'clientName', ellipsis: true },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      align: 'center',
      render: (st: string) => (
        <Tag style={
          st === 'PROCESSED'
            ? { background: isDark ? 'rgba(34, 197, 94, 0.15)' : '#EBF4ED', color: isDark ? '#4ADE80' : '#166534', border: isDark ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid #BBF7D0', fontWeight: 600 }
            : { background: isDark ? 'rgba(234, 179, 8, 0.15)' : '#FEF9C3', color: isDark ? '#FACC15' : '#854D0E', border: isDark ? '1px solid rgba(250, 204, 21, 0.3)' : '1px solid #FEF08A', fontWeight: 600 }
        }>
          {st || 'DRAFT'}
        </Tag>
      ),
    },
    {
      title: 'Total Billed',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      width: 140,
      render: (amt: number) => (
        <Text strong style={{ color: isDark ? '#4ADE80' : '#166534', fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrencyINR(amt)}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      align: 'center',
      render: (_, record: any) => (
        <Space size="small">
          <Tooltip title="View Invoice">
            <Link href={`/billing/processed/${record.id}`}>
              <Button type="text" size="small" icon={<EyeOutlined style={{ color: isDark ? '#60A5FA' : '#1D4ED8' }} />} />
            </Link>
          </Tooltip>
          <Tooltip title="Edit Invoice Details">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ color: isDark ? '#F59E0B' : '#D97706' }} />}
              onClick={() => handleOpenEditInvoice(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Invoice?"
            description={`Are you sure you want to delete invoice ${record.billNumber || record.id}?`}
            onConfirm={() => handleDeleteInvoice(record.id)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete Invoice">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined style={{ color: isDark ? '#F87171' : '#DC2626', fontSize: 14 }} />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Columns for Tab 2: Payments
  const paymentColumns: ColumnsType<any> = [
    {
      title: 'Payment ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <Text strong style={{ fontFamily: 'monospace' }}>{id}</Text>,
    },
    {
      title: 'Bill Number',
      dataIndex: 'billNumber',
      key: 'billNumber',
      width: 130,
      render: (num: string, record: any) => (
        <Link href={`/billing/processed/${record.billId}`} style={{ color: isDark ? '#60A5FA' : '#1D4ED8', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {num || record.billId}
        </Link>
      ),
    },
    {
      title: 'Client',
      dataIndex: 'clientName',
      key: 'clientName',
      render: (c: string) => c || '-',
    },
    {
      title: 'Date',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      width: 110,
      render: (d: string) => (d ? dayjs(d).format('DD-MM-YYYY') : '-'),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      width: 130,
      render: (amt: number) => (
        <Text strong style={{ color: isDark ? '#4ADE80' : '#166534', fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrencyINR(amt)}
        </Text>
      ),
    },
    {
      title: 'Mode',
      dataIndex: 'paymentMode',
      key: 'paymentMode',
      width: 120,
      render: (mode: string) => (
        <Tag style={{
          background: isDark ? '#27272A' : '#F4F4F5',
          color: isDark ? '#E4E4E7' : '#27272A',
          border: isDark ? '1px solid #3F3F46' : '1px solid #E4E4E7',
          fontWeight: 600
        }}>
          {mode}
        </Tag>
      ),
    },
    {
      title: 'Reference',
      dataIndex: 'referenceNo',
      key: 'referenceNo',
      ellipsis: true,
      render: (ref: string) => ref || '-',
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (n: string) => n || '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_, record: any) => (
        <Space size="small">
          <Tooltip title="Edit Payment">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ color: isDark ? '#60A5FA' : '#1D4ED8' }} />}
              onClick={() => handleOpenEditPayment(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Payment"
            description="Are you sure you want to remove this client payment record?"
            onConfirm={() => handleDeletePayment(record.id)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete Payment">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined style={{ color: isDark ? '#F87171' : '#DC2626', fontSize: 14 }} />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Columns for Tab 3: Ageing Analysis
  const ageingColumns: ColumnsType<any> = [
    {
      title: 'Client Name',
      dataIndex: 'clientName',
      key: 'clientName',
      render: (val: string) => <strong>{val}</strong>,
    },
    {
      title: 'Overdue Bills',
      dataIndex: 'billsCount',
      key: 'billsCount',
      align: 'center',
      render: (cnt: number) => <Tag color="blue">{cnt} Bills</Tag>,
    },
    {
      title: '0 - 30 Days (Current)',
      dataIndex: 'bucket_0_30',
      key: 'bucket_0_30',
      align: 'right',
      render: (amt: number) => <Text style={{ color: '#3F6F4A', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyINR(amt)}</Text>,
    },
    {
      title: '31 - 60 Days',
      dataIndex: 'bucket_31_60',
      key: 'bucket_31_60',
      align: 'right',
      render: (amt: number) => <Text style={{ color: '#C58A2A', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyINR(amt)}</Text>,
    },
    {
      title: '61 - 90 Days',
      dataIndex: 'bucket_61_90',
      key: 'bucket_61_90',
      align: 'right',
      render: (amt: number) => <Text style={{ color: '#C58A2A', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyINR(amt)}</Text>,
    },
    {
      title: '90+ Days (Critical)',
      dataIndex: 'bucket_90_plus',
      key: 'bucket_90_plus',
      align: 'right',
      render: (amt: number) => <Text strong style={{ color: '#A8473C', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyINR(amt)}</Text>,
    },
    {
      title: 'Total Outstanding',
      dataIndex: 'totalPending',
      key: 'totalPending',
      align: 'right',
      render: (amt: number) => (
        <Text strong style={{ fontSize: 13, color: '#17324D', fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrencyINR(amt)}
        </Text>
      ),
    },
  ];

  const totalOutstandingReceivable = Math.max(0, (totals.totalBilled || 0) - totalPaymentsReceived);

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Top Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24, gap: 12 }}>
        <Col>
          <Title level={2} style={{ margin: 0, color: '#17324D', letterSpacing: '-0.01em' }}>
            <BarChartOutlined style={{ marginRight: 8, color: '#17324D' }} />
            Billing Revenue &amp; Accounts Receivable Report
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: '#5F6B73' }}>
            Consolidated invoices analysis, customer receipts reconciliation, and overdue ageing buckets
          </Text>
        </Col>
        <Col>
          <Space wrap>
            <Link href="/billing/pending">
              <Button icon={<FileAddOutlined />}>Pending Bills</Button>
            </Link>
            <Link href="/billing/processed">
              <Button icon={<AuditOutlined />}>Processed Bills</Button>
            </Link>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setPaymentModalVisible(true)}>
              Record Client Payment
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchBillingReport}>
              Refresh
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExportAll}>
              Export All
            </Button>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              Print PDF
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Top KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={reportLoading} className="spt-kpi-card spt-kpi-steel" size="small">
            <Statistic
              title={<span style={{ fontSize: 11, textTransform: 'uppercase', color: '#5F6B73', fontWeight: 600 }}>Total Invoices</span>}
              value={totals.totalBills || 0}
              valueStyle={{ color: '#17324D', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card loading={reportLoading} className="spt-kpi-card spt-kpi-green" size="small">
            <Statistic
              title={<span style={{ fontSize: 11, textTransform: 'uppercase', color: '#5F6B73', fontWeight: 600 }}>Total Billed Revenue</span>}
              value={totals.totalBilled || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#3F6F4A', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card loading={reportLoading} className="spt-kpi-card spt-kpi-teal" size="small">
            <Statistic
              title={<span style={{ fontSize: 11, textTransform: 'uppercase', color: '#5F6B73', fontWeight: 600 }}>Processed / Draft</span>}
              value={`${totals.processedCount || 0} / ${totals.draftCount || 0}`}
              valueStyle={{ color: '#2F6F73', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card loading={paymentsLoading} className="spt-kpi-card spt-kpi-green" size="small">
            <Statistic
              title={<span style={{ fontSize: 11, textTransform: 'uppercase', color: '#5F6B73', fontWeight: 600 }}>Total Payments Received</span>}
              value={totalPaymentsReceived}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#3F6F4A', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card loading={reportLoading} className={`spt-kpi-card ${totalOutstandingReceivable > 0 ? 'spt-kpi-amber' : 'spt-kpi-green'}`} size="small">
            <Statistic
              title={<span style={{ fontSize: 11, textTransform: 'uppercase', color: '#5F6B73', fontWeight: 600 }}>Outstanding Balance</span>}
              value={totalOutstandingReceivable}
              precision={2}
              prefix="₹"
              valueStyle={{ color: totalOutstandingReceivable > 0 ? '#C58A2A' : '#3F6F4A', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Consolidated Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: 'invoices',
            label: (
              <span>
                <BarChartOutlined style={{ marginRight: 6 }} />
                Invoices &amp; Revenue Breakdown ({invoices.length})
              </span>
            ),
            children: (
              <div>
                {/* Invoices Filters */}
                <Card bordered={false} style={{ marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} sm={12} md={4}>
                      <Input
                        placeholder="Search Bill No, Client, Company..."
                        prefix={<SearchOutlined />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col xs={24} sm={12} md={3}>
                      <Select
                        placeholder="Financial Year"
                        style={{ width: '100%' }}
                        value={financialYear || undefined}
                        onChange={(val) => setFinancialYear(val || '')}
                        allowClear
                      >
                        <Select.Option value="2026-27">2026-27</Select.Option>
                        <Select.Option value="2025-26">2025-26</Select.Option>
                      </Select>
                    </Col>
                    <Col xs={24} sm={12} md={4}>
                      <Select
                        placeholder="Filter Company"
                        style={{ width: '100%' }}
                        value={companyFilter}
                        onChange={(val) => setCompanyFilter(val)}
                        allowClear
                      >
                        {companies.map((c) => (
                          <Select.Option key={c.id} value={c.id}>
                            {c.name}
                          </Select.Option>
                        ))}
                      </Select>
                    </Col>
                    <Col xs={24} sm={12} md={4}>
                      <Select
                        placeholder="Filter Client"
                        style={{ width: '100%' }}
                        value={clientFilter}
                        onChange={(val) => setClientFilter(val)}
                        allowClear
                      >
                        {clients.map((c) => (
                          <Select.Option key={c.id} value={c.id}>
                            {c.name}
                          </Select.Option>
                        ))}
                      </Select>
                    </Col>
                    <Col xs={24} sm={12} md={3}>
                      <Select
                        placeholder="Status"
                        style={{ width: '100%' }}
                        value={statusFilter || undefined}
                        onChange={(val) => setStatusFilter(val || '')}
                        allowClear
                      >
                        <Select.Option value="PROCESSED">PROCESSED</Select.Option>
                        <Select.Option value="DRAFT">DRAFT</Select.Option>
                      </Select>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <RangePicker
                        style={{ width: '100%' }}
                        format="DD/MM/YYYY"
                        value={dateRange}
                        onChange={(dates) => setDateRange(dates as any)}
                      />
                    </Col>
                  </Row>
                  <Row justify="end" style={{ marginTop: 12 }}>
                    <Col>
                      <Space>
                        <Button type="primary" onClick={fetchBillingReport}>
                          Filter
                        </Button>
                        <Button onClick={handleResetFilters}>
                          Reset
                        </Button>
                        <Button icon={<DownloadOutlined />} onClick={handleExportFiltered}>
                          Export Filtered
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>

                {/* Table */}
                <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Table
                    columns={invoiceColumns}
                    dataSource={filteredInvoices}
                    rowKey="id"
                    loading={reportLoading}
                    pagination={{
                      pageSize: 15,
                      showSizeChanger: true,
                      pageSizeOptions: ['15', '30', '50', '100'],
                      showTotal: (total) => `Total ${total} bills listed`,
                    }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'payments',
            label: (
              <span>
                <DollarOutlined style={{ marginRight: 6 }} />
                Client Payments &amp; Receipts ({payments.length})
              </span>
            ),
            children: (
              <div>
                {/* Payments Filters */}
                <Card bordered={false} style={{ marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={12} md={8}>
                      <Input
                        placeholder="Search Receipt ID, Bill No, Client, Ref..."
                        prefix={<SearchOutlined />}
                        value={paymentSearch}
                        onChange={(e) => setPaymentSearch(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col xs={24} sm={12} md={5}>
                      <Select
                        placeholder="Filter Client"
                        style={{ width: '100%' }}
                        value={paymentClientFilter}
                        onChange={(val) => setPaymentClientFilter(val)}
                        allowClear
                      >
                        {clients.map((c) => (
                          <Select.Option key={c.id} value={c.id}>
                            {c.name}
                          </Select.Option>
                        ))}
                      </Select>
                    </Col>
                    <Col xs={24} sm={12} md={5}>
                      <Select
                        placeholder="Payment Mode"
                        style={{ width: '100%' }}
                        value={paymentModeFilter}
                        onChange={(val) => setPaymentModeFilter(val)}
                        allowClear
                      >
                        {['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Other'].map((m) => (
                          <Select.Option key={m} value={m}>
                            {m}
                          </Select.Option>
                        ))}
                      </Select>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Space>
                        <Button
                          onClick={() => {
                            setPaymentSearch('');
                            setPaymentClientFilter(undefined);
                            setPaymentModeFilter(undefined);
                          }}
                        >
                          Reset
                        </Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAddPayment}>
                          Record Client Receipt
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>

                {/* Table */}
                <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Table
                    columns={paymentColumns}
                    dataSource={filteredPayments}
                    rowKey="id"
                    loading={paymentsLoading}
                    pagination={{
                      pageSize: 15,
                      showSizeChanger: true,
                      pageSizeOptions: ['15', '30', '50', '100'],
                      showTotal: (total) => `Total ${total} client payments received`,
                    }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'ageing',
            label: (
              <span>
                <ClockCircleOutlined style={{ marginRight: 6 }} />
                Accounts Receivable Ageing Analysis
              </span>
            ),
            children: (
              <div>
                {/* Ageing Summary Metric Cards */}
                {ageingReport?.summary && (
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={24} sm={12} md={6}>
                      <Card className="spt-kpi-card spt-kpi-green">
                        <Statistic
                          title="Current (0 - 30 Days)"
                          value={ageingReport.summary.bucket_0_30 || 0}
                          precision={2}
                          prefix="₹"
                          valueStyle={{ color: '#3F6F4A', fontFamily: 'monospace', fontWeight: 600 }}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Card className="spt-kpi-card spt-kpi-amber">
                        <Statistic
                          title="Due (31 - 60 Days)"
                          value={ageingReport.summary.bucket_31_60 || 0}
                          precision={2}
                          prefix="₹"
                          valueStyle={{ color: '#C58A2A', fontFamily: 'monospace', fontWeight: 600 }}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Card className="spt-kpi-card spt-kpi-steel">
                        <Statistic
                          title="Overdue (61 - 90 Days)"
                          value={ageingReport.summary.bucket_61_90 || 0}
                          precision={2}
                          prefix="₹"
                          valueStyle={{ color: '#365A73', fontFamily: 'monospace', fontWeight: 600 }}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Card className="spt-kpi-card spt-kpi-red">
                        <Statistic
                          title="Critical (90+ Days)"
                          value={ageingReport.summary.bucket_90_plus || 0}
                          precision={2}
                          prefix="₹"
                          valueStyle={{ color: '#A8473C', fontFamily: 'monospace', fontWeight: 700 }}
                        />
                      </Card>
                    </Col>
                  </Row>
                )}

                <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ marginBottom: 16 }}>
                    <Title level={4} style={{ marginBottom: 4 }}>
                      Customer-wise Outstanding Breakdown
                    </Title>
                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      Detailed receivables analysis segmented by overdue duration to prioritize collection activities.
                    </Paragraph>
                  </div>
                  <Table
                    columns={ageingColumns}
                    dataSource={ageingReport?.clients || []}
                    rowKey="clientId"
                    loading={ageingLoading}
                    pagination={{ pageSize: 15 }}
                  />
                </Card>
              </div>
            ),
          },
        ]}
      />

      {/* Record / Edit Client Payment Modal */}
      <Modal
        title={editingPayment ? `Edit Client Payment #${editingPayment.id}` : 'Record Client Payment Receipt'}
        open={paymentModalVisible}
        onCancel={() => {
          setPaymentModalVisible(false);
          setEditingPayment(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={paymentForm} layout="vertical" onFinish={handleRecordPaymentSubmit}>
          <Form.Item
            name="billId"
            label="Select Invoice / Bill Number"
            rules={[{ required: true, message: 'Please select an invoice' }]}
          >
            <Select
              placeholder="Search and select bill"
              showSearch
              disabled={!!editingPayment}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={billsList.map((b) => ({
                value: b.id,
                label: `${b.billNumber || b.id} — ${b.clientName || 'Client'} (₹${(b.totalAmount || 0).toLocaleString('en-IN')})`,
              }))}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="Amount (₹)"
                rules={[{ required: true, message: 'Please enter amount' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0.01} precision={2} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="paymentDate"
                label="Receipt Date"
                rules={[{ required: true, message: 'Please select date' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="paymentMode"
            label="Payment Mode"
            rules={[{ required: true, message: 'Please select mode' }]}
          >
            <Select placeholder="Select mode">
              {['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Other'].map((m) => (
                <Select.Option key={m} value={m}>
                  {m}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="referenceNo" label="Reference / Cheque / UTR #">
            <Input placeholder="e.g. UTR98765432, Cheque #123456" />
          </Form.Item>

          <Form.Item name="notes" label="Notes / Remarks">
            <Input.TextArea rows={2} placeholder="Payment details or remarks..." />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => { setPaymentModalVisible(false); setEditingPayment(null); }}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={submittingPayment}>
                {editingPayment ? 'Save Changes' : 'Record Payment'}
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* Edit Invoice Details Modal */}
      <Modal
        title={`Edit Invoice — ${editingInvoice?.billNumber || editingInvoice?.id || ''}`}
        open={editInvoiceModalOpen}
        onCancel={() => {
          setEditInvoiceModalOpen(false);
          setEditingInvoice(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={invoiceForm} layout="vertical" onFinish={handleSaveInvoiceEdit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="billingDate"
                label="Billing Date"
                rules={[{ required: true, message: 'Billing date is required' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="dueDate" label="Due Date">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="status" label="Invoice Status" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="PROCESSED">PROCESSED (Final)</Select.Option>
              <Select.Option value="DRAFT">DRAFT</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="notes" label="Invoice Remarks / Notes">
            <Input.TextArea rows={3} placeholder="Add invoice remarks or terms..." />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => { setEditInvoiceModalOpen(false); setEditingInvoice(null); }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={submittingInvoice}>
                Save Changes
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
