'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Card,
  Row,
  Col,
  Statistic,
  Descriptions,
  Table,
  Button,
  Tag,
  Typography,
  Space,
  Tabs,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Alert,
  Tooltip,
  Popconfirm,
  Spin,
  message,
  notification,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  ReloadOutlined,
  UserOutlined,
  CarOutlined,
  WalletOutlined,
  WarningOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { checkOverpayment } from '@/lib/utils/vendorHelper';

const { Title, Text } = Typography;

interface VendorDetailProps {
  params: { id: string };
}

const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Other'];

export default function VendorDetailPage({ params }: VendorDetailProps) {
  const { id: vendorId } = params;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<any>(null);
  const [tripsData, setTripsData] = useState<{
    trips: any[];
    payments: any[];
    totals: { totalPayable: number; totalPaid: number; netPending: number; unallocatedPaid: number };
  }>({
    trips: [],
    payments: [],
    totals: { totalPayable: 0, totalPaid: 0, netPending: 0, unallocatedPaid: 0 },
  });

  // Payment Drawer state
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [selectedEnquiryPending, setSelectedEnquiryPending] = useState<number | null>(null);
  const [overpaymentWarning, setOverpaymentWarning] = useState<string | null>(null);

  const fetchVendorData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch vendor master info
      const vRes = await axios.get(`/api/master/vendors/${vendorId}`);
      if (vRes.data.success && vRes.data.data) {
        setVendor(vRes.data.data);
      }

      // 2. Fetch vendor trips, payments & balances
      const tRes = await axios.get(`/api/vendors/${vendorId}/trips`);
      if (tRes.data.success && tRes.data.data) {
        setTripsData(tRes.data.data);
      } else {
        message.error(tRes.data.message || 'Failed to load vendor trips');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error loading vendor details');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    fetchVendorData();
  }, [fetchVendorData]);

  const evaluateOverpayment = (amount: number, enquiryId?: string) => {
    if (!amount || amount <= 0) {
      setOverpaymentWarning(null);
      return;
    }

    if (enquiryId && tripsData.trips.length > 0) {
      const trip = tripsData.trips.find((t) => t.id === enquiryId);
      if (trip && trip.pending !== undefined) {
        const check = checkOverpayment(amount, trip.pending);
        if (check.isOverpayment) {
          setOverpaymentWarning(
            `Warning: ₹${amount.toLocaleString('en-IN')} exceeds trip pending balance (₹${trip.pending.toLocaleString('en-IN')}) by ₹${check.excess.toLocaleString('en-IN')}. (Will not block payment)`
          );
          return;
        }
      }
    } else if (tripsData.totals.netPending > 0) {
      const check = checkOverpayment(amount, tripsData.totals.netPending);
      if (check.isOverpayment) {
        setOverpaymentWarning(
          `Warning: ₹${amount.toLocaleString('en-IN')} exceeds vendor net pending balance (₹${tripsData.totals.netPending.toLocaleString('en-IN')}) by ₹${check.excess.toLocaleString('en-IN')}. (Will not block payment)`
        );
        return;
      }
    }

    setOverpaymentWarning(null);
  };

  const openAddPayment = (enquiryId?: string) => {
    setEditingPayment(null);
    setOverpaymentWarning(null);
    form.resetFields();
    form.setFieldsValue({
      enquiryId: enquiryId || undefined,
      paymentDate: dayjs(),
      mode: 'Bank Transfer',
    });

    if (enquiryId) {
      const trip = tripsData.trips.find((t) => t.id === enquiryId);
      setSelectedEnquiryPending(trip?.pending ?? null);
    } else {
      setSelectedEnquiryPending(null);
    }

    setDrawerVisible(true);
  };

  const openEditPayment = (record: any) => {
    setEditingPayment(record);
    setOverpaymentWarning(null);
    form.setFieldsValue({
      enquiryId: record.enquiryId || undefined,
      paymentDate: record.paymentDate ? dayjs(record.paymentDate, 'YYYY-MM-DD') : dayjs(),
      amount: record.amount,
      mode: record.mode,
      reference: record.reference,
      notes: record.notes,
    });

    if (record.enquiryId) {
      const trip = tripsData.trips.find((t) => t.id === record.enquiryId);
      setSelectedEnquiryPending(trip?.pending ?? null);
    } else {
      setSelectedEnquiryPending(null);
    }

    setDrawerVisible(true);
  };

  const handleSubmitPayment = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        vendorId,
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
          if (res.data.warning) {
            notification.warning({
              message: 'Overpayment Warning',
              description: res.data.message || 'Payment updated with overpayment warning.',
            });
          } else {
            message.success('Payment updated successfully');
          }
          setDrawerVisible(false);
          fetchVendorData();
        } else {
          message.error(res.data.message || 'Failed to update payment');
        }
      } else {
        const res = await axios.post('/api/vendors/payments', payload);
        if (res.data.success) {
          if (res.data.warning) {
            notification.warning({
              message: 'Overpayment Warning',
              description: res.data.message || 'Payment recorded with overpayment warning.',
            });
          } else {
            message.success('Payment recorded successfully');
          }
          setDrawerVisible(false);
          fetchVendorData();
        } else {
          message.error(res.data.message || 'Failed to record payment');
        }
      }
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Error saving payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    try {
      const res = await axios.delete(`/api/vendors/payments/${id}`);
      if (res.data.success) {
        message.success('Payment deleted successfully');
        fetchVendorData();
      } else {
        message.error(res.data.message || 'Failed to delete payment');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error deleting payment');
    }
  };

  const tripColumns: ColumnsType<any> = [
    {
      title: 'Enquiry / Trans #',
      dataIndex: 'transactionNo',
      key: 'transactionNo',
      render: (tNo: string, record: any) => (
        <Link href={`/enquiries/${record.id}`} style={{ fontWeight: 600, color: '#1677ff' }}>
          {tNo || record.id}
        </Link>
      ),
    },
    {
      title: 'Vehicle',
      dataIndex: 'vehicleNumber',
      key: 'vehicleNumber',
      render: (v: string) => <Tag color="blue">{v || 'N/A'}</Tag>,
    },
    {
      title: 'Container',
      dataIndex: 'containerNumber',
      key: 'containerNumber',
      render: (c: string) => c || '-',
    },
    {
      title: 'Advance',
      dataIndex: 'advance',
      key: 'advance',
      align: 'right',
      render: (v: number) => `₹${(v || 0).toLocaleString('en-IN')}`,
    },
    {
      title: 'Extra Adv',
      dataIndex: 'extraAdvance',
      key: 'extraAdvance',
      align: 'right',
      render: (v: number) => (v ? `₹${v.toLocaleString('en-IN')}` : '-'),
    },
    {
      title: 'Diesel',
      dataIndex: 'diesel',
      key: 'diesel',
      align: 'right',
      render: (v: number) => (v ? `₹${v.toLocaleString('en-IN')}` : '-'),
    },
    {
      title: 'Halting',
      dataIndex: 'halting',
      key: 'halting',
      align: 'right',
      render: (v: number) => (v ? `₹${v.toLocaleString('en-IN')}` : '-'),
    },
    {
      title: 'Bonus',
      dataIndex: 'bonus',
      key: 'bonus',
      align: 'right',
      render: (v: number) => (v ? `₹${v.toLocaleString('en-IN')}` : '-'),
    },
    {
      title: 'Total Payable',
      dataIndex: 'totalPayable',
      key: 'totalPayable',
      align: 'right',
      render: (amt: number) => (
        <Text strong style={{ color: '#389e0d' }}>
          ₹{(amt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Paid',
      dataIndex: 'paid',
      key: 'paid',
      align: 'right',
      render: (amt: number) => `₹${(amt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Pending',
      dataIndex: 'pending',
      key: 'pending',
      align: 'right',
      render: (amt: number) => (
        <Text strong style={{ color: (amt || 0) > 0 ? '#cf1322' : '#389e0d' }}>
          ₹{(amt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      align: 'center',
      render: (_, record: any) => (
        <Button
          type="link"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => openAddPayment(record.id)}
        >
          Pay
        </Button>
      ),
    },
  ];

  const paymentColumns: ColumnsType<any> = [
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
      render: (d: string) => (d ? dayjs(d).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Trip / Enquiry',
      dataIndex: 'enquiryId',
      key: 'enquiryId',
      render: (eId: string, record: any) => {
        if (!eId) return <Tag color="default">Unallocated Payment</Tag>;
        return (
          <Link href={`/enquiries/${eId}`} style={{ color: '#1677ff' }}>
            {record.enquiryTransactionNo || eId}
          </Link>
        );
      },
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (amt: number) => (
        <Text strong style={{ color: '#0958d9' }}>
          ₹{Number(amt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Mode',
      dataIndex: 'mode',
      key: 'mode',
      render: (m: string) => <Tag color="blue">{m}</Tag>,
    },
    {
      title: 'Reference',
      dataIndex: 'reference',
      key: 'reference',
      render: (r: string) => r || '-',
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      render: (n: string) => n || '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 90,
      align: 'center',
      render: (_, record: any) => (
        <Space size="small">
          <Tooltip title="Edit Payment">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditPayment(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Payment"
            description="Are you sure you want to delete this payment?"
            onConfirm={() => handleDeletePayment(record.id)}
            okText="Yes"
            cancelText="No"
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

  if (loading && !vendor) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="Loading vendor details..." />
      </div>
    );
  }

  const { totals } = tripsData;

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space align="center" size="middle">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push('/master/vendors')}
            >
              Vendors
            </Button>
            <div>
              <Title level={3} style={{ margin: 0 }}>
                <UserOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                {vendor?.name || 'Vendor Details'}
              </Title>
              <Text type="secondary">
                Financial summary, transport trips, and payment reconciliation ledger.
              </Text>
            </div>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => fetchVendorData()} loading={loading}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openAddPayment()}>
              Record Payment
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Summary KPI Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ backgroundColor: '#f6ffed', borderColor: '#b7eb8f', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic
              title="Total Payable"
              value={totals.totalPayable}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#389e0d', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ backgroundColor: '#e6f4ff', borderColor: '#91caff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic
              title="Total Paid"
              value={totals.totalPaid}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#0958d9', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            bordered={false}
            style={{
              backgroundColor: totals.netPending > 0 ? '#fffbe6' : '#f6ffed',
              borderColor: totals.netPending > 0 ? '#ffe58f' : '#b7eb8f',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <Statistic
              title="Pending Balance"
              value={totals.netPending}
              precision={2}
              prefix="₹"
              valueStyle={{ color: totals.netPending > 0 ? '#cf1322' : '#389e0d', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic
              title="Unallocated Payments"
              value={totals.unallocatedPaid}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#595959' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Vendor Master Information */}
      <Card title="Vendor Profile" bordered={false} style={{ marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
          <Descriptions.Item label="Vendor Name">
            <Text strong>{vendor?.name || '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Contact Person">{vendor?.contactPerson || '-'}</Descriptions.Item>
          <Descriptions.Item label="Phone">{vendor?.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="Email">{vendor?.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="PAN">{vendor?.pan || '-'}</Descriptions.Item>
          <Descriptions.Item label="Bank Details">{vendor?.bankDetails || '-'}</Descriptions.Item>
          <Descriptions.Item label="Address" span={3}>
            {vendor?.address || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Tabs: Trips Ledger & Payment History */}
      <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Tabs
          defaultActiveKey="trips"
          items={[
            {
              key: 'trips',
              label: (
                <span>
                  <CarOutlined /> Transport Trips ({tripsData.trips.length})
                </span>
              ),
              children: (
                <Table
                  rowKey="id"
                  columns={tripColumns}
                  dataSource={tripsData.trips}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                />
              ),
            },
            {
              key: 'payments',
              label: (
                <span>
                  <WalletOutlined /> Payment History ({tripsData.payments.length})
                </span>
              ),
              children: (
                <Table
                  rowKey="id"
                  columns={paymentColumns}
                  dataSource={tripsData.payments}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* Record / Edit Payment Drawer */}
      <Drawer
        title={editingPayment ? `Edit Payment #${editingPayment.id}` : `Record Payment to ${vendor?.name || 'Vendor'}`}
        width={500}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        extra={
          <Space>
            <Button onClick={() => setDrawerVisible(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSubmitPayment} loading={submitting}>
              {editingPayment ? 'Save' : 'Record'}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f0f5ff', borderRadius: 6 }}>
            <Text>
              Vendor Net Pending: <Text strong style={{ color: totals.netPending > 0 ? '#cf1322' : '#389e0d' }}>₹{totals.netPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </Text>
          </div>

          <Form.Item
            name="enquiryId"
            label="Linked Trip / Enquiry (Optional)"
            tooltip="Leave empty to record an unallocated general payment"
          >
            <Select
              placeholder="Select trip or leave unallocated"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              onChange={(val) => {
                const trip = tripsData.trips.find((t) => t.id === val);
                setSelectedEnquiryPending(trip?.pending ?? null);
                evaluateOverpayment(form.getFieldValue('amount'), val);
              }}
              options={tripsData.trips.map((t) => ({
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
                        throw new Error('Amount must be greater than 0');
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
