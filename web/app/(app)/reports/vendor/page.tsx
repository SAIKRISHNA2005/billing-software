'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Table,
  Card,
  Button,
  Select,
  DatePicker,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  Tag,
  Tabs,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Tooltip,
  Alert,
  message,
  notification,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  BarChartOutlined,
  ReloadOutlined,
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  DollarOutlined,
  WalletOutlined,
  WarningOutlined,
  DownloadOutlined,
  PrinterOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { AsyncMasterSelect } from '@/components/common/AsyncMasterSelect';
import { checkOverpayment } from '@/lib/utils/vendorHelper';
import { GenericMasterManager } from '@/components/master/GenericMasterManager';
import { vendorColumns, vendorFields, VendorRecord } from '@/components/master/masterConfig';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

export interface VendorReportRow {
  vendorId: string;
  vendorName: string;
  vehiclesCount: number;
  tripsCount: number;
  advance: number;
  diesel: number;
  halting: number;
  extraAdvance: number;
  bonus: number;
  totalAmount: number;
  paid: number;
  pending: number;
}

export interface VendorReportTotals {
  vehiclesCount: number;
  tripsCount: number;
  advance: number;
  diesel: number;
  halting: number;
  extraAdvance: number;
  bonus: number;
  totalAmount: number;
  paid: number;
  pending: number;
}

export interface VendorPaymentItem {
  id: string;
  vendorId: string;
  vendorName?: string;
  enquiryId?: string;
  enquiryTransactionNo?: string;
  vehicleNumber?: string;
  paymentDate: string;
  amount: number;
  mode: 'Cash' | 'Bank Transfer' | 'Cheque' | 'UPI' | 'Other';
  reference?: string;
  notes?: string;
  createdAt?: string;
}

const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Other'];

export default function ConsolidatedVendorReportPage() {
  const [activeTab, setActiveTab] = useState('statement');

  // ==========================================
  // TAB 1: VENDOR STATEMENT REPORT STATE
  // ==========================================
  const [rows, setRows] = useState<VendorReportRow[]>([]);
  const [grandTotals, setGrandTotals] = useState<VendorReportTotals | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Statement Filters
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [vendorFilter, setVendorFilter] = useState<string | undefined>(undefined);
  const [companyFilter, setCompanyFilter] = useState<string | undefined>(undefined);
  const [clientFilter, setClientFilter] = useState<string | undefined>(undefined);
  const [loadingTypeFilter, setLoadingTypeFilter] = useState<string | undefined>(undefined);

  const fetchReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const params: Record<string, string> = {};
      if (vendorFilter) params.vendorId = vendorFilter;
      if (companyFilter) params.companyId = companyFilter;
      if (clientFilter) params.clientId = clientFilter;
      if (loadingTypeFilter) params.loadingType = loadingTypeFilter;
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.fromDate = dateRange[0].format('DD-MM-YYYY');
        params.toDate = dateRange[1].format('DD-MM-YYYY');
      }

      const res = await axios.get('/api/vendors/report', { params });
      if (res.data.success && res.data.data) {
        setRows(res.data.data.rows || []);
        setGrandTotals(res.data.data.grandTotals || null);
      } else {
        message.error(res.data.message || 'Failed to generate vendor report');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error fetching vendor report');
    } finally {
      setReportLoading(false);
    }
  }, [vendorFilter, companyFilter, clientFilter, loadingTypeFilter, dateRange]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // ==========================================
  // TAB 2: VENDOR PAYMENTS STATE
  // ==========================================
  const [payments, setPayments] = useState<VendorPaymentItem[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsSummaryTotal, setPaymentsSummaryTotal] = useState(0);
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentPageSize, setPaymentPageSize] = useState(20);

  // Payments Filters
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentVendorFilter, setPaymentVendorFilter] = useState<string | undefined>(undefined);
  const [paymentModeFilter, setPaymentModeFilter] = useState<string | undefined>(undefined);
  const [paymentDateRange, setPaymentDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  // Drawer / Form state for recording payment
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingPayment, setEditingPayment] = useState<VendorPaymentItem | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentForm] = Form.useForm();

  // Selected vendor & enquiry pending tracking in drawer
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>(undefined);
  const [vendorTrips, setVendorTrips] = useState<any[]>([]);
  const [selectedEnquiryPending, setSelectedEnquiryPending] = useState<number | null>(null);
  const [vendorNetPending, setVendorNetPending] = useState<number | null>(null);
  const [overpaymentWarning, setOverpaymentWarning] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(paymentPage),
        limit: String(paymentPageSize),
      };

      if (paymentSearch) params.search = paymentSearch;
      if (paymentVendorFilter) params.vendorId = paymentVendorFilter;
      if (paymentModeFilter) params.mode = paymentModeFilter;
      if (paymentDateRange && paymentDateRange[0] && paymentDateRange[1]) {
        params.fromDate = paymentDateRange[0].format('DD-MM-YYYY');
        params.toDate = paymentDateRange[1].format('DD-MM-YYYY');
      }

      const res = await axios.get('/api/vendors/payments', { params });
      if (res.data.success && res.data.data) {
        setPayments(res.data.data.items || []);
        setPaymentsTotal(res.data.data.total || 0);
        setPaymentsSummaryTotal(res.data.data.summaryTotal || 0);
      }
    } catch (err: any) {
      console.error('Error fetching payments:', err);
    } finally {
      setPaymentsLoading(false);
    }
  }, [paymentPage, paymentPageSize, paymentSearch, paymentVendorFilter, paymentModeFilter, paymentDateRange]);

  useEffect(() => {
    if (activeTab === 'payments') {
      fetchPayments();
    }
  }, [activeTab, fetchPayments]);

  const handleVendorSelect = async (vId: string) => {
    setSelectedVendorId(vId);
    paymentForm.setFieldsValue({ enquiryId: undefined });
    setSelectedEnquiryPending(null);
    setOverpaymentWarning(null);

    if (!vId) {
      setVendorTrips([]);
      setVendorNetPending(null);
      return;
    }

    try {
      const res = await axios.get(`/api/vendors/${vId}/trips`);
      if (res.data.success && res.data.data) {
        setVendorTrips(res.data.data.trips || []);
        setVendorNetPending(res.data.data.netPending ?? null);
      }
    } catch {
      setVendorTrips([]);
      setVendorNetPending(null);
    }
  };

  const evaluateOverpayment = (amount: number, enquiryId?: string) => {
    if (!amount || amount <= 0) {
      setOverpaymentWarning(null);
      return;
    }

    if (enquiryId && vendorTrips.length > 0) {
      const trip = vendorTrips.find((t) => t.id === enquiryId);
      if (trip && trip.pending !== undefined) {
        const check = checkOverpayment(amount, trip.pending);
        if (check.isOverpayment) {
          setOverpaymentWarning(
            `Warning: ₹${amount.toLocaleString('en-IN')} exceeds trip pending balance (₹${trip.pending.toLocaleString('en-IN')}) by ₹${check.excess.toLocaleString('en-IN')}.`
          );
          return;
        }
      }
    } else if (vendorNetPending !== null && vendorNetPending > 0) {
      const check = checkOverpayment(amount, vendorNetPending);
      if (check.isOverpayment) {
        setOverpaymentWarning(
          `Warning: ₹${amount.toLocaleString('en-IN')} exceeds vendor net pending balance (₹${vendorNetPending.toLocaleString('en-IN')}) by ₹${check.excess.toLocaleString('en-IN')}.`
        );
        return;
      }
    }

    setOverpaymentWarning(null);
  };

  const openAddPaymentDrawer = () => {
    setEditingPayment(null);
    setSelectedVendorId(undefined);
    setVendorTrips([]);
    setSelectedEnquiryPending(null);
    setVendorNetPending(null);
    setOverpaymentWarning(null);
    paymentForm.resetFields();
    paymentForm.setFieldsValue({
      paymentDate: dayjs(),
      mode: 'Bank Transfer',
    });
    setDrawerVisible(true);
  };

  const openEditPaymentDrawer = async (record: VendorPaymentItem) => {
    setEditingPayment(record);
    setSelectedVendorId(record.vendorId);
    setOverpaymentWarning(null);

    paymentForm.setFieldsValue({
      vendorId: record.vendorId,
      enquiryId: record.enquiryId || undefined,
      paymentDate: record.paymentDate ? dayjs(record.paymentDate, 'YYYY-MM-DD') : dayjs(),
      amount: record.amount,
      mode: record.mode,
      reference: record.reference,
      notes: record.notes,
    });

    try {
      const res = await axios.get(`/api/vendors/${record.vendorId}/trips`);
      if (res.data.success && res.data.data) {
        setVendorTrips(res.data.data.trips || []);
        setVendorNetPending(res.data.data.netPending ?? null);
        if (record.enquiryId) {
          const trip = (res.data.data.trips || []).find((t: any) => t.id === record.enquiryId);
          if (trip) setSelectedEnquiryPending(trip.pending);
        }
      }
    } catch {
      setVendorTrips([]);
    }

    setDrawerVisible(true);
  };

  const handleSubmitPayment = async () => {
    try {
      const values = await paymentForm.validateFields();
      setSubmittingPayment(true);

      const payload = {
        vendorId: values.vendorId,
        enquiryId: values.enquiryId || undefined,
        paymentDate: values.paymentDate.format('YYYY-MM-DD'),
        amount: Number(values.amount),
        mode: values.mode,
        reference: values.reference || undefined,
        notes: values.notes || undefined,
      };

      if (editingPayment) {
        const res = await axios.put(`/api/vendors/payments/${editingPayment.id}`, payload);
        if (res.data.success) {
          message.success('Vendor payment updated successfully');
          setDrawerVisible(false);
          fetchPayments();
          fetchReport();
        } else {
          message.error(res.data.message || 'Failed to update vendor payment');
        }
      } else {
        const res = await axios.post('/api/vendors/payments', payload);
        if (res.data.success) {
          message.success('Vendor payment recorded successfully');
          setDrawerVisible(false);
          fetchPayments();
          fetchReport();
        } else {
          message.error(res.data.message || 'Failed to record vendor payment');
        }
      }
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Error saving vendor payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    try {
      const res = await axios.delete(`/api/vendors/payments/${id}`);
      if (res.data.success) {
        message.success('Vendor payment deleted successfully');
        fetchPayments();
        fetchReport();
      } else {
        message.error(res.data.message || 'Failed to delete payment');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error deleting payment');
    }
  };

  // Export Vendor Report to CSV
  const handleExportCSV = () => {
    if (rows.length === 0) {
      message.warning('No vendor report rows to export');
      return;
    }

    const headers = [
      'Vendor Name',
      'Vehicles',
      'Trips',
      'Advance',
      'Diesel',
      'Halting',
      'Extra Advance',
      'Bonus',
      'Total Payable',
      'Paid',
      'Pending',
    ];

    const csvRows = rows.map((r) => [
      `"${r.vendorName.replace(/"/g, '""')}"`,
      r.vehiclesCount || 0,
      r.tripsCount || 0,
      r.advance || 0,
      r.diesel || 0,
      r.halting || 0,
      r.extraAdvance || 0,
      r.bonus || 0,
      r.totalAmount || 0,
      r.paid || 0,
      r.pending || 0,
    ]);

    if (grandTotals) {
      csvRows.push([
        '"GRAND TOTAL"',
        grandTotals.vehiclesCount || 0,
        grandTotals.tripsCount || 0,
        grandTotals.advance || 0,
        grandTotals.diesel || 0,
        grandTotals.halting || 0,
        grandTotals.extraAdvance || 0,
        grandTotals.bonus || 0,
        grandTotals.totalAmount || 0,
        grandTotals.paid || 0,
        grandTotals.pending || 0,
      ]);
    }

    const csvContent = [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `TMS_Vendor_Report_${dayjs().format('YYYY-MM-DD')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Vendor report exported to CSV successfully');
  };

  // Statement Columns
  const statementColumns: ColumnsType<VendorReportRow> = [
    {
      title: 'Vendor',
      dataIndex: 'vendorName',
      key: 'vendorName',
      fixed: 'left',
      width: 200,
      render: (name: string, record: VendorReportRow) => (
        <Link href={`/vendors/${record.vendorId}`} style={{ fontWeight: 600, color: '#17324D' }}>
          {name || record.vendorId}
        </Link>
      ),
    },
    {
      title: 'Vehicles',
      dataIndex: 'vehiclesCount',
      key: 'vehiclesCount',
      align: 'center',
      width: 90,
      render: (count: number) => <Tag style={{ background: '#EEF3F6', color: '#17324D', border: '1px solid #D4DAD9', fontVariantNumeric: 'tabular-nums' }}>{count || 0}</Tag>,
    },
    {
      title: 'Trips',
      dataIndex: 'tripsCount',
      key: 'tripsCount',
      align: 'center',
      width: 80,
      render: (trips: number) => <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{trips || 0}</Text>,
    },
    {
      title: 'Advance',
      dataIndex: 'advance',
      key: 'advance',
      align: 'right',
      width: 120,
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>,
    },
    {
      title: 'Diesel',
      dataIndex: 'diesel',
      key: 'diesel',
      align: 'right',
      width: 120,
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>,
    },
    {
      title: 'Halting',
      dataIndex: 'halting',
      key: 'halting',
      align: 'right',
      width: 110,
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>,
    },
    {
      title: 'Extra Adv',
      dataIndex: 'extraAdvance',
      key: 'extraAdvance',
      align: 'right',
      width: 110,
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>,
    },
    {
      title: 'Bonus',
      dataIndex: 'bonus',
      key: 'bonus',
      align: 'right',
      width: 110,
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>,
    },
    {
      title: 'Total Payable',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      width: 140,
      render: (v: number) => (
        <Text strong style={{ color: '#17324D', fontVariantNumeric: 'tabular-nums' }}>
          ₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Paid',
      dataIndex: 'paid',
      key: 'paid',
      align: 'right',
      width: 140,
      render: (v: number) => (
        <Text strong style={{ color: '#3F6F4A', fontVariantNumeric: 'tabular-nums' }}>
          ₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Pending',
      dataIndex: 'pending',
      key: 'pending',
      align: 'right',
      width: 140,
      render: (v: number) => (
        <Text strong style={{ color: Number(v || 0) > 0 ? '#C58A2A' : '#3F6F4A', fontVariantNumeric: 'tabular-nums' }}>
          ₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      align: 'center',
      render: (_, record: VendorReportRow) => (
        <Space size="small">
          <Tooltip title="View Trips & Ledger">
            <Link href={`/vendors/${record.vendorId}`}>
              <Button type="text" size="small" icon={<EyeOutlined style={{ color: '#365A73' }} />} />
            </Link>
          </Tooltip>
          <Tooltip title="Record Payment">
            <Button
              type="text"
              size="small"
              icon={<DollarOutlined style={{ color: '#3F6F4A' }} />}
              onClick={() => {
                openAddPaymentDrawer();
                paymentForm.setFieldsValue({ vendorId: record.vendorId });
              }}
            />
          </Tooltip>
          <Tooltip title="View / Edit Vendor">
            <Link href={`/vendors/${record.vendorId}`}>
              <Button type="text" size="small" icon={<EditOutlined style={{ color: '#17324D' }} />} />
            </Link>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Payments Columns
  const paymentsColumns: ColumnsType<VendorPaymentItem> = [
    {
      title: 'Payment ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <Text strong>{id}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      width: 110,
      render: (date: string) => (date ? dayjs(date).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Vendor',
      dataIndex: 'vendorName',
      key: 'vendorName',
      render: (name: string, record: VendorPaymentItem) => (
        <Link href={`/vendors/${record.vendorId}`} style={{ fontWeight: 600, color: '#17324D' }}>
          {name || record.vendorId}
        </Link>
      ),
    },
    {
      title: 'Enquiry / Trip',
      dataIndex: 'enquiryId',
      key: 'enquiryId',
      render: (enquiryId: string, record: VendorPaymentItem) => {
        if (!enquiryId) return <Tag style={{ background: '#ECEFEE', color: '#5F6B73', border: '1px solid #D4DAD9' }}>Unallocated</Tag>;
        return (
          <Space direction="vertical" size={2}>
            <Link href={`/enquiries/${enquiryId}`} style={{ color: '#17324D', fontFamily: 'monospace' }}>
              {record.enquiryTransactionNo || enquiryId}
            </Link>
            {record.vehicleNumber && (
              <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
                {record.vehicleNumber}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      width: 130,
      render: (amt: number) => (
        <Text strong style={{ color: '#3F6F4A', fontVariantNumeric: 'tabular-nums' }}>
          ₹{Number(amt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Mode',
      dataIndex: 'mode',
      key: 'mode',
      width: 120,
      render: (mode: string) => (
        <Tag style={{ background: '#ECEFEE', color: '#34424C', border: '1px solid #D4DAD9' }}>{mode}</Tag>
      ),
    },
    {
      title: 'Reference',
      dataIndex: 'reference',
      key: 'reference',
      ellipsis: true,
      render: (ref: string) => ref || '-',
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (notes: string) => notes || '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 90,
      align: 'center',
      render: (_, record: VendorPaymentItem) => (
        <Space size="small">
          <Tooltip title="Edit Payment">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditPaymentDrawer(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Payment"
            description="Are you sure you want to delete this payment record?"
            onConfirm={() => handleDeletePayment(record.id)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete Payment">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Top Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24, gap: 12 }}>
        <Col>
          <Title level={2} style={{ margin: 0, color: '#17324D', letterSpacing: '-0.01em' }}>
            <TeamOutlined style={{ marginRight: 8, color: '#17324D' }} />
            Vendor Financial &amp; Operations Report
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: '#5F6B73' }}>
            Consolidated vendor financial statements, ledger balances, disbursement tracking, and master directory
          </Text>
        </Col>
        <Col>
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openAddPaymentDrawer}
            >
              Record Payment
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchReport(); if (activeTab === 'payments') fetchPayments(); }}>
              Refresh
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
              Export Excel
            </Button>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              Print PDF
            </Button>
          </Space>
        </Col>
      </Row>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="spt-kpi-card spt-kpi-steel" size="small">
            <Statistic
              title={<span style={{ fontSize: 11, textTransform: 'uppercase', color: '#5F6B73', fontWeight: 600 }}>Grand Total Payable</span>}
              value={grandTotals?.totalAmount || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#17324D', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="spt-kpi-card spt-kpi-green" size="small">
            <Statistic
              title={<span style={{ fontSize: 11, textTransform: 'uppercase', color: '#5F6B73', fontWeight: 600 }}>Grand Total Paid</span>}
              value={grandTotals?.paid || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#3F6F4A', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className={`spt-kpi-card ${(grandTotals?.pending || 0) > 0 ? 'spt-kpi-amber' : 'spt-kpi-green'}`} size="small">
            <Statistic
              title={<span style={{ fontSize: 11, textTransform: 'uppercase', color: '#5F6B73', fontWeight: 600 }}>Grand Total Pending</span>}
              value={grandTotals?.pending || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: (grandTotals?.pending || 0) > 0 ? '#C58A2A' : '#3F6F4A', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="spt-kpi-card spt-kpi-teal" size="small">
            <Statistic
              title={<span style={{ fontSize: 11, textTransform: 'uppercase', color: '#5F6B73', fontWeight: 600 }}>Trips / Vendors</span>}
              value={`${grandTotals?.tripsCount || 0} trips / ${rows.length} vendors`}
              valueStyle={{ fontSize: 16, fontWeight: 700, color: '#2F6F73', fontVariantNumeric: 'tabular-nums' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Consolidated Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: 'statement',
            label: (
              <span>
                <BarChartOutlined style={{ marginRight: 6 }} />
                Vendor Statement &amp; Ledger
              </span>
            ),
            children: (
              <div>
                {/* Statement Filters */}
                <Card bordered={false} style={{ marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={12} md={5}>
                      <AsyncMasterSelect
                        entity="vendors"
                        entityLabel="Vendor"
                        placeholder="Filter by Vendor"
                        value={vendorFilter}
                        onChange={(val) => setVendorFilter(val)}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={5}>
                      <AsyncMasterSelect
                        entity="companies"
                        entityLabel="Company"
                        placeholder="Filter by Company"
                        value={companyFilter}
                        onChange={(val) => setCompanyFilter(val)}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={4}>
                      <AsyncMasterSelect
                        entity="clients"
                        entityLabel="Client"
                        placeholder="Filter by Client"
                        value={clientFilter}
                        onChange={(val) => setClientFilter(val)}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={3}>
                      <Select
                        placeholder="Loading Type"
                        style={{ width: '100%' }}
                        allowClear
                        value={loadingTypeFilter}
                        onChange={(val) => setLoadingTypeFilter(val)}
                      >
                        <Select.Option value="IMPORT">Import</Select.Option>
                        <Select.Option value="EXPORT">Export</Select.Option>
                      </Select>
                    </Col>
                    <Col xs={24} sm={12} md={5}>
                      <RangePicker
                        style={{ width: '100%' }}
                        format="DD/MM/YYYY"
                        value={dateRange}
                        onChange={(dates) => setDateRange(dates as any)}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={2}>
                      <Button
                        onClick={() => {
                          setVendorFilter(undefined);
                          setCompanyFilter(undefined);
                          setClientFilter(undefined);
                          setLoadingTypeFilter(undefined);
                          setDateRange(null);
                        }}
                      >
                        Reset
                      </Button>
                    </Col>
                  </Row>
                </Card>

                {/* Table with Grand Totals Footer */}
                <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Table
                    rowKey="vendorId"
                    columns={statementColumns}
                    dataSource={rows}
                    loading={reportLoading}
                    scroll={{ x: 1400 }}
                    pagination={{
                      pageSize: 20,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50', '100'],
                      showTotal: (tot) => `Total ${tot} vendors`,
                    }}
                    summary={() => {
                      if (!grandTotals || rows.length === 0) return null;
                      return (
                        <Table.Summary fixed>
                          <Table.Summary.Row style={{ backgroundColor: '#fafafa', fontWeight: 'bold' }}>
                            <Table.Summary.Cell index={0}>
                              <Text strong>GRAND TOTAL ({rows.length} Vendors)</Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={1} align="center">
                              <Tag color="blue">{grandTotals.vehiclesCount}</Tag>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={2} align="center">
                              <Text strong>{grandTotals.tripsCount}</Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={3} align="right">
                              <Text strong>₹{grandTotals.advance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={4} align="right">
                              <Text strong>₹{grandTotals.diesel.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={5} align="right">
                              <Text strong>₹{grandTotals.halting.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={6} align="right">
                              <Text strong>₹{grandTotals.extraAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={7} align="right">
                              <Text strong>₹{grandTotals.bonus.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={8} align="right">
                              <Text strong style={{ color: '#3F6F4A', fontFamily: 'monospace' }}>
                                ₹{grandTotals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={9} align="right">
                              <Text strong style={{ color: '#365A73', fontFamily: 'monospace' }}>
                                ₹{grandTotals.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={10} align="right">
                              <Text strong style={{ color: grandTotals.pending > 0 ? '#A8473C' : '#3F6F4A', fontFamily: 'monospace' }}>
                                ₹{grandTotals.pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </Text>
                            </Table.Summary.Cell>
                          </Table.Summary.Row>
                        </Table.Summary>
                      );
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
                <WalletOutlined style={{ marginRight: 6 }} />
                Payment Disbursements ({paymentsTotal})
              </span>
            ),
            children: (
              <div>
                {/* Payments Filters */}
                <Card bordered={false} style={{ marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={12} md={6}>
                      <Input
                        placeholder="Search reference, notes, vendor..."
                        prefix={<SearchOutlined />}
                        value={paymentSearch}
                        onChange={(e) => setPaymentSearch(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <AsyncMasterSelect
                        entity="vendors"
                        entityLabel="Vendor"
                        placeholder="Filter by Vendor"
                        value={paymentVendorFilter}
                        onChange={(val) => setPaymentVendorFilter(val)}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={4}>
                      <Select
                        placeholder="Payment Mode"
                        style={{ width: '100%' }}
                        allowClear
                        value={paymentModeFilter}
                        onChange={(val) => setPaymentModeFilter(val)}
                      >
                        {PAYMENT_MODES.map((mode) => (
                          <Select.Option key={mode} value={mode}>
                            {mode}
                          </Select.Option>
                        ))}
                      </Select>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <RangePicker
                        style={{ width: '100%' }}
                        format="DD/MM/YYYY"
                        value={paymentDateRange}
                        onChange={(dates) => setPaymentDateRange(dates as any)}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={2}>
                      <Button
                        onClick={() => {
                          setPaymentSearch('');
                          setPaymentVendorFilter(undefined);
                          setPaymentModeFilter(undefined);
                          setPaymentDateRange(null);
                        }}
                      >
                        Reset
                      </Button>
                    </Col>
                  </Row>
                </Card>

                {/* Table */}
                <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text strong>
                      Total Disbursements Filtered: <span style={{ color: '#17324D', fontFamily: 'monospace' }}>₹{paymentsSummaryTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </Text>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openAddPaymentDrawer}>
                      Record Payment
                    </Button>
                  </div>
                  <Table
                    rowKey="id"
                    columns={paymentsColumns}
                    dataSource={payments}
                    loading={paymentsLoading}
                    pagination={{
                      current: paymentPage,
                      pageSize: paymentPageSize,
                      total: paymentsTotal,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50', '100'],
                      onChange: (p, ps) => {
                        setPaymentPage(p);
                        setPaymentPageSize(ps);
                      },
                      showTotal: (tot) => `Total ${tot} payments`,
                    }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'directory',
            label: (
              <span>
                <TeamOutlined style={{ marginRight: 6 }} />
                Vendor Directory (Master Data)
              </span>
            ),
            children: (
              <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ marginBottom: 16 }}>
                  <Title level={4} style={{ marginBottom: 4 }}>
                    Vendor Master Records
                  </Title>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    Manage external transporters, PAN numbers, bank IFSC, and contact phone numbers.
                  </Paragraph>
                </div>
                <GenericMasterManager<VendorRecord>
                  entity="vendors"
                  entitySingular="Vendor"
                  columns={vendorColumns}
                  formFields={vendorFields}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* Record / Edit Payment Drawer */}
      <Drawer
        title={editingPayment ? `Edit Vendor Payment #${editingPayment.id}` : 'Record Vendor Payment'}
        width={520}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        extra={
          <Space>
            <Button onClick={() => setDrawerVisible(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSubmitPayment} loading={submittingPayment}>
              {editingPayment ? 'Save Changes' : 'Record Payment'}
            </Button>
          </Space>
        }
      >
        <Form form={paymentForm} layout="vertical">
          <Form.Item
            name="vendorId"
            label="Vendor"
            rules={[{ required: true, message: 'Please select a vendor' }]}
          >
            <AsyncMasterSelect
              entity="vendors"
              entityLabel="Vendor"
              placeholder="Search and select vendor"
              value={selectedVendorId}
              onChange={(val) => handleVendorSelect(val || '')}
              disabled={!!editingPayment}
            />
          </Form.Item>

          {selectedVendorId && vendorNetPending !== null && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#ECEFEE', border: '1px solid #D4DAD9', borderRadius: 4 }}>
              <Text type="secondary">Vendor Net Pending Balance: </Text>
              <Text strong style={{ color: vendorNetPending > 0 ? '#A8473C' : '#3F6F4A', fontFamily: 'monospace' }}>
                ₹{vendorNetPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </div>
          )}

          <Form.Item
            name="enquiryId"
            label="Linked Enquiry / Trip (Optional)"
            tooltip="Leave empty to record an unallocated general vendor advance or payout"
          >
            <Select
              placeholder="Select trip or leave unallocated"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              onChange={(val) => {
                const trip = vendorTrips.find((t) => t.id === val);
                setSelectedEnquiryPending(trip?.pending ?? null);
                evaluateOverpayment(paymentForm.getFieldValue('amount'), val);
              }}
              options={vendorTrips.map((t) => ({
                value: t.id,
                label: `${t.transactionNo || t.id} — Vehicle: ${t.vehicleNumber || 'N/A'} | Pending: ₹${(t.pending || 0).toLocaleString('en-IN')}`,
              }))}
            />
          </Form.Item>

          {selectedEnquiryPending !== null && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#FDF6E8', border: '1px solid #F0D59E', borderRadius: 4 }}>
              <Text type="secondary">Selected Trip Pending: </Text>
              <Text strong style={{ color: '#9E6B1D', fontFamily: 'monospace' }}>
                ₹{selectedEnquiryPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </div>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="paymentDate"
                label="Payment Date"
                rules={[{ required: true, message: 'Please select payment date' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="Amount (₹)"
                rules={[
                  { required: true, message: 'Please enter payment amount' },
                  {
                    validator: async (_, value) => {
                      if (value !== undefined && Number(value) <= 0) {
                        throw new Error('Payment amount must be greater than 0');
                      }
                    },
                  },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0.01}
                  precision={2}
                  placeholder="0.00"
                  onChange={(val) => {
                    evaluateOverpayment(Number(val), paymentForm.getFieldValue('enquiryId'));
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          {overpaymentWarning && (
            <Alert
              message={overpaymentWarning}
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            name="mode"
            label="Payment Mode"
            rules={[{ required: true, message: 'Please select payment mode' }]}
          >
            <Select placeholder="Select payment mode">
              {PAYMENT_MODES.map((mode) => (
                <Select.Option key={mode} value={mode}>
                  {mode}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="reference" label="Reference / Cheque / UTR #">
            <Input placeholder="e.g. UTR12345678, Cheque #456123" />
          </Form.Item>

          <Form.Item name="notes" label="Notes / Remarks">
            <Input.TextArea rows={3} placeholder="Additional payment remarks..." />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
