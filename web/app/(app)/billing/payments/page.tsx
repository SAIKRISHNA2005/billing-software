'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Typography, Space, Row, Col, Statistic, Select, DatePicker, Modal, Form, Input, InputNumber, message, Popconfirm } from 'antd';
import { DollarOutlined, PlusOutlined, DeleteOutlined, CreditCardOutlined, SearchOutlined, CheckCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { formatCurrencyINR } from '@/lib/utils/format';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function ClientPaymentsPage() {
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);

  // Filter state
  const [selectedMode, setSelectedMode] = useState<string | undefined>();
  const [selectedClient, setSelectedClient] = useState<string | undefined>();

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [payRes, billRes] = await Promise.all([
        axios.get('/api/billing/payments'),
        axios.get('/api/billing/bills'),
      ]);

      if (payRes.data && payRes.data.success) {
        setPayments(payRes.data.data || []);
      }
      if (billRes.data && billRes.data.success) {
        setBills(billRes.data.data || []);
      }
    } catch (err: any) {
      message.error('Failed to load payments data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreatePayment = async (values: any) => {
    setSubmitting(true);
    try {
      const payload = {
        billId: values.billId,
        amount: values.amount,
        paymentDate: values.paymentDate ? values.paymentDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        paymentMode: values.paymentMode,
        referenceNo: values.referenceNo,
        notes: values.notes,
      };

      const res = await axios.post('/api/billing/payments', payload);
      if (res.data && res.data.success) {
        message.success('Payment recorded successfully!');
        setModalVisible(false);
        form.resetFields();
        fetchData();
      } else {
        message.error(res.data?.message || 'Failed to record payment');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error recording payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    try {
      const res = await axios.delete(`/api/billing/payments/${id}`);
      if (res.data && res.data.success) {
        message.success('Payment record deleted');
        fetchData();
      } else {
        message.error(res.data?.message || 'Failed to delete payment');
      }
    } catch (err: any) {
      message.error('Error deleting payment');
    }
  };

  // Filtered payments
  const filteredPayments = payments.filter((p) => {
    if (selectedMode && p.paymentMode !== selectedMode) return false;
    if (selectedClient && p.clientId !== selectedClient) return false;
    return true;
  });

  const totalCollected = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalBillsPending = bills.reduce((sum, b) => sum + (Number(b.pendingAmount || 0)), 0);

  const columns = [
    { title: 'Payment ID', dataIndex: 'id', key: 'id', render: (val: string) => <Text strong style={{ color: '#17324D' }}>{val}</Text> },
    { title: 'Bill Number', dataIndex: 'billNumber', key: 'billNumber' },
    { title: 'Client Name', dataIndex: 'clientName', key: 'clientName', render: (val: string) => <strong>{val}</strong> },
    { title: 'Date', dataIndex: 'paymentDate', key: 'paymentDate', render: (val: string) => (val ? dayjs(val).format('DD-MM-YYYY') : '-') },
    {
      title: 'Payment Mode',
      dataIndex: 'paymentMode',
      key: 'paymentMode',
      render: (mode: string) => <Tag color="default">{mode}</Tag>,
    },
    { title: 'Reference / UTR', dataIndex: 'referenceNo', key: 'referenceNo', render: (val: string) => val || '-' },
    {
      title: 'Amount (₹)',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      render: (amt: number) => <Text strong style={{ color: '#3F6F4A' }}>{formatCurrencyINR(amt)}</Text>,
    },
    {
      title: 'Actions',
      key: 'act',
      render: (_: any, r: any) => (
        <Popconfirm title="Delete payment record?" onConfirm={() => handleDeletePayment(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: '4px 0 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={2} style={{ margin: 0, color: '#1E2933', fontSize: 22, fontWeight: 600 }}>
            <DollarOutlined style={{ marginRight: 8, color: '#3F6F4A' }} />
            Client Payments Control Room
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: '#5F6B73' }}>Record and manage payments received from clients against processed bills</Text>
        </div>
        <Button type="primary" style={{ backgroundColor: '#3F6F4A', borderColor: '#3F6F4A' }} icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          Record New Payment
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card className="spt-kpi-card spt-kpi-steel">
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>Total Payments Recorded</span>}
              value={filteredPayments.length}
              prefix={<CreditCardOutlined style={{ color: '#365A73' }} />}
              valueStyle={{ color: '#17324D', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="spt-kpi-card spt-kpi-green">
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>Total Collections (Filtered)</span>}
              value={formatCurrencyINR(totalCollected)}
              valueStyle={{ color: '#3F6F4A', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="spt-kpi-card spt-kpi-red">
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>Total Outstanding Receivables</span>}
              value={formatCurrencyINR(totalBillsPending)}
              valueStyle={{ color: '#A8473C', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 4 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="Filter by Payment Mode"
            allowClear
            style={{ width: 220 }}
            value={selectedMode}
            onChange={(val) => setSelectedMode(val)}
          >
            <Option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</Option>
            <Option value="CASH">Cash</Option>
            <Option value="CHEQUE">Cheque</Option>
            <Option value="UPI">UPI / Wallet</Option>
          </Select>
        </Space>

        <Table
          columns={columns}
          dataSource={filteredPayments}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Record Payment Modal */}
      <Modal
        title="Record Client Payment"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="Record Payment"
      >
        <Form form={form} layout="vertical" onFinish={handleCreatePayment}>
          <Form.Item
            name="billId"
            label="Select Processed Bill"
            rules={[{ required: true, message: 'Please select a bill' }]}
          >
            <Select placeholder="Choose bill to pay" showSearch optionFilterProp="children">
              {bills
                .filter((b) => (b.pendingAmount === undefined ? true : b.pendingAmount > 0))
                .map((b) => (
                  <Option key={b.id} value={b.id}>
                    {b.billNumber} - {b.clientName} (Pending: ₹{b.pendingAmount || b.totalAmount})
                  </Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="amount"
            label="Payment Amount (₹)"
            rules={[{ required: true, message: 'Please enter payment amount' }]}
          >
            <InputNumber style={{ width: '100%' }} min={1} placeholder="Amount in ₹" />
          </Form.Item>

          <Form.Item
            name="paymentDate"
            label="Payment Date"
            rules={[{ required: true, message: 'Please select payment date' }]}
            initialValue={dayjs()}
          >
            <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
          </Form.Item>

          <Form.Item
            name="paymentMode"
            label="Payment Mode"
            rules={[{ required: true, message: 'Please select payment mode' }]}
            initialValue="BANK_TRANSFER"
          >
            <Select>
              <Option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</Option>
              <Option value="CASH">Cash</Option>
              <Option value="CHEQUE">Cheque</Option>
              <Option value="UPI">UPI / Digital Wallet</Option>
            </Select>
          </Form.Item>

          <Form.Item name="referenceNo" label="Reference / UTR / Cheque No">
            <Input placeholder="e.g. UTR12345678" />
          </Form.Item>

          <Form.Item name="notes" label="Notes / Remarks">
            <Input.TextArea rows={2} placeholder="Optional payment remarks" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
