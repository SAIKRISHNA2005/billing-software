'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Table,
  Card,
  Button,
  Input,
  Select,
  DatePicker,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Statistic,
  Drawer,
  Form,
  InputNumber,
  Popconfirm,
  Tooltip,
  Alert,
  message,
  notification,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  WalletOutlined,
  UserOutlined,
  WarningOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { AsyncMasterSelect } from '@/components/common/AsyncMasterSelect';
import { checkOverpayment } from '@/lib/utils/vendorHelper';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

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
  createdBy?: string;
}

const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Other'];

export default function VendorPaymentsPage() {
  const [data, setData] = useState<VendorPaymentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [vendorFilter, setVendorFilter] = useState<string | undefined>(undefined);
  const [modeFilter, setModeFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  // Summary Totals
  const [summaryTotal, setSummaryTotal] = useState(0);

  // Drawer / Form state
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<VendorPaymentItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Selected vendor & enquiry pending tracking in drawer
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>(undefined);
  const [vendorTrips, setVendorTrips] = useState<any[]>([]);
  const [selectedEnquiryPending, setSelectedEnquiryPending] = useState<number | null>(null);
  const [vendorNetPending, setVendorNetPending] = useState<number | null>(null);
  const [overpaymentWarning, setOverpaymentWarning] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(pageSize),
      };

      if (searchText) params.search = searchText;
      if (vendorFilter) params.vendorId = vendorFilter;
      if (modeFilter) params.mode = modeFilter;
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.fromDate = dateRange[0].format('DD-MM-YYYY');
        params.toDate = dateRange[1].format('DD-MM-YYYY');
      }

      const res = await axios.get('/api/vendors/payments', { params });
      if (res.data.success && res.data.data) {
        setData(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
        setSummaryTotal(res.data.data.summaryTotal || 0);
      } else {
        message.error(res.data.message || 'Failed to fetch vendor payments');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error fetching vendor payments');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchText, vendorFilter, modeFilter, dateRange]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // When vendor changes in modal, load vendor trips & pending balance
  const handleVendorSelect = async (vId: string) => {
    setSelectedVendorId(vId);
    form.setFieldsValue({ enquiryId: undefined });
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

  // Check overpayment when amount or enquiry changes
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
            `Warning: ₹${amount.toLocaleString('en-IN')} exceeds trip pending balance (₹${trip.pending.toLocaleString('en-IN')}) by ₹${check.excess.toLocaleString('en-IN')}. (Payment will be recorded but not blocked)`
          );
          return;
        }
      }
    } else if (vendorNetPending !== null && vendorNetPending > 0) {
      const check = checkOverpayment(amount, vendorNetPending);
      if (check.isOverpayment) {
        setOverpaymentWarning(
          `Warning: ₹${amount.toLocaleString('en-IN')} exceeds vendor net pending balance (₹${vendorNetPending.toLocaleString('en-IN')}) by ₹${check.excess.toLocaleString('en-IN')}. (Payment will be recorded but not blocked)`
        );
        return;
      }
    }

    setOverpaymentWarning(null);
  };

  const openAddDrawer = () => {
    setEditingItem(null);
    setSelectedVendorId(undefined);
    setVendorTrips([]);
    setSelectedEnquiryPending(null);
    setVendorNetPending(null);
    setOverpaymentWarning(null);
    form.resetFields();
    form.setFieldsValue({
      paymentDate: dayjs(),
      mode: 'Bank Transfer',
    });
    setDrawerVisible(true);
  };

  const openEditDrawer = async (record: VendorPaymentItem) => {
    setEditingItem(record);
    setSelectedVendorId(record.vendorId);
    setOverpaymentWarning(null);

    form.setFieldsValue({
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

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        vendorId: values.vendorId,
        enquiryId: values.enquiryId || undefined,
        paymentDate: values.paymentDate.format('YYYY-MM-DD'),
        amount: Number(values.amount),
        mode: values.mode,
        reference: values.reference || undefined,
        notes: values.notes || undefined,
      };

      if (editingItem) {
        const res = await axios.put(`/api/vendors/payments/${editingItem.id}`, payload);
        if (res.data.success) {
          if (res.data.warning) {
            notification.warning({
              message: 'Overpayment Warning',
              description: res.data.message || 'Payment updated, but amount exceeds pending balance.',
              placement: 'topRight',
            });
          } else {
            message.success('Vendor payment updated successfully');
          }
          setDrawerVisible(false);
          fetchPayments();
        } else {
          message.error(res.data.message || 'Failed to update vendor payment');
        }
      } else {
        const res = await axios.post('/api/vendors/payments', payload);
        if (res.data.success) {
          if (res.data.warning) {
            notification.warning({
              message: 'Overpayment Warning',
              description: res.data.message || 'Payment recorded, but amount exceeds pending balance.',
              placement: 'topRight',
            });
          } else {
            message.success('Vendor payment recorded successfully');
          }
          setDrawerVisible(false);
          fetchPayments();
        } else {
          message.error(res.data.message || 'Failed to record vendor payment');
        }
      }
    } catch (err: any) {
      if (err.errorFields) return; // validation error
      message.error(err.response?.data?.message || 'Error saving vendor payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await axios.delete(`/api/vendors/payments/${id}`);
      if (res.data.success) {
        message.success('Vendor payment deleted successfully');
        fetchPayments();
      } else {
        message.error(res.data.message || 'Failed to delete vendor payment');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error deleting vendor payment');
    }
  };

  const columns: ColumnsType<VendorPaymentItem> = [
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
        <Link href={`/vendors/${record.vendorId}`} style={{ fontWeight: 600, color: '#1677ff' }}>
          {name || record.vendorId}
        </Link>
      ),
    },
    {
      title: 'Enquiry / Trip',
      dataIndex: 'enquiryId',
      key: 'enquiryId',
      render: (enquiryId: string, record: VendorPaymentItem) => {
        if (!enquiryId) {
          return <Tag color="default">Unallocated</Tag>;
        }
        return (
          <Space direction="vertical" size={2}>
            <Link href={`/enquiries/${enquiryId}`} style={{ color: '#1677ff' }}>
              {record.enquiryTransactionNo || enquiryId}
            </Link>
            {record.vehicleNumber && (
              <Text type="secondary" style={{ fontSize: 12 }}>
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
        <Text strong style={{ color: '#0958d9' }}>
          ₹{Number(amt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Mode',
      dataIndex: 'mode',
      key: 'mode',
      width: 120,
      render: (mode: string) => {
        const color =
          mode === 'Cash'
            ? 'green'
            : mode === 'Bank Transfer'
            ? 'blue'
            : mode === 'UPI'
            ? 'purple'
            : mode === 'Cheque'
            ? 'orange'
            : 'default';
        return <Tag color={color}>{mode}</Tag>;
      },
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
              onClick={() => openEditDrawer(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Payment"
            description="Are you sure you want to delete this payment record?"
            onConfirm={() => handleDelete(record.id)}
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
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <WalletOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Vendor Payments
          </Title>
          <Text type="secondary">
            Manage vendor payments, reconcile against transport trips, and track unallocated payouts.
          </Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => fetchPayments()} loading={loading}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddDrawer}>
              Record Payment
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Summary KPI Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic
              title="Total Payments Recorded"
              value={summaryTotal}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#0958d9', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic
              title="Number of Transactions"
              value={total}
              valueStyle={{ fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic
              title="Vendor Balances"
              value="Live Ledger"
              formatter={() => (
                <Link href="/vendors/report" style={{ fontSize: 16, color: '#1677ff' }}>
                  View Vendor Report &rarr;
                </Link>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters & Search */}
      <Card bordered={false} style={{ marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Search reference, notes, vendor..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <AsyncMasterSelect
              entity="vendors"
              entityLabel="Vendor"
              placeholder="Filter by Vendor"
              value={vendorFilter}
              onChange={(val) => setVendorFilter(val)}
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="Payment Mode"
              style={{ width: '100%' }}
              allowClear
              value={modeFilter}
              onChange={(val) => setModeFilter(val)}
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
              value={dateRange}
              onChange={(dates) => setDateRange(dates as any)}
            />
          </Col>
          <Col xs={24} sm={12} md={2}>
            <Button
              onClick={() => {
                setSearchText('');
                setVendorFilter(undefined);
                setModeFilter(undefined);
                setDateRange(null);
              }}
            >
              Reset
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showTotal: (tot) => `Total ${tot} payments`,
          }}
        />
      </Card>

      {/* Add / Edit Drawer */}
      <Drawer
        title={editingItem ? `Edit Vendor Payment #${editingItem.id}` : 'Record Vendor Payment'}
        width={520}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        extra={
          <Space>
            <Button onClick={() => setDrawerVisible(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSubmit} loading={submitting}>
              {editingItem ? 'Save Changes' : 'Record Payment'}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
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
              disabled={!!editingItem}
            />
          </Form.Item>

          {selectedVendorId && vendorNetPending !== null && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f0f5ff', borderRadius: 6 }}>
              <Text type="secondary">Vendor Net Pending Balance: </Text>
              <Text strong style={{ color: vendorNetPending > 0 ? '#cf1322' : '#389e0d' }}>
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
                evaluateOverpayment(form.getFieldValue('amount'), val);
              }}
              options={vendorTrips.map((t) => ({
                value: t.id,
                label: `${t.transactionNo || t.id} — Vehicle: ${t.vehicleNumber || 'N/A'} | Pending: ₹${(t.pending || 0).toLocaleString('en-IN')}`,
              }))}
            />
          </Form.Item>

          {selectedEnquiryPending !== null && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fffbe6', borderRadius: 6 }}>
              <Text type="secondary">Selected Trip Pending: </Text>
              <Text strong style={{ color: '#d46b08' }}>
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
                    evaluateOverpayment(Number(val), form.getFieldValue('enquiryId'));
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
