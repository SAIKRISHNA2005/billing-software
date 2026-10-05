'use client';

import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Button, Card, Row, Col, Table, DatePicker, Typography, Alert, Space, message } from 'antd';
import { EditOutlined, SaveOutlined, ArrowLeftOutlined, PlusOutlined, DeleteOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';
import dayjs from 'dayjs';
import { formatCurrencyINR } from '@/lib/utils/format';
import { ActionConfirmPopover } from '@/components/common/ActionConfirmPopover';

const { Title, Text } = Typography;

export default function EditProcessedBillPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bill, setBill] = useState<any>(null);
  const [items, setItems] = useState<Array<{ id: string; description: string; amount: number; enquiryId?: string }>>([]);

  const fetchBillDetail = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/billing/bills/${id}`);
      if (res.data && res.data.success) {
        const b = res.data.data;
        setBill(b);
        setItems(b.items || []);
        form.setFieldsValue({
          billingDate: b.billingDate ? dayjs(b.billingDate, 'YYYY-MM-DD') : dayjs(),
          remarks: b.remarks
        });
      } else {
        message.error(res.data?.message || 'Failed to load bill');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error fetching bill');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchBillDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: 'item-' + Date.now(), description: 'Additional Services / Adjustments', amount: 0 }
    ]);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter((it) => it.id !== itemId));
  };

  const handleItemChange = (itemId: string, field: string, value: any) => {
    setItems(
      items.map((it) => (it.id === itemId ? { ...it, [field]: value } : it))
    );
  };

  const totalAmount = items.reduce((sum, it) => sum + (parseFloat(it.amount as any) || 0), 0);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      const payload = {
        isProcessed: true,
        billingDate: values.billingDate.format('YYYY-MM-DD'),
        remarks: values.remarks,
        items
      };

      const res = await axios.put(`/api/billing/bills/${id}`, payload);
      if (res.data && res.data.success) {
        message.success('Processed bill updated successfully!');
        router.push(`/billing/processed/${id}`);
      } else {
        message.error(res.data?.message || 'Failed to update processed bill');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error updating bill');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !bill) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text>Loading invoice for editing...</Text>
      </div>
    );
  }

  const columns = [
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string, record: any) => (
        <Input
          value={text}
          onChange={(e) => handleItemChange(record.id, 'description', e.target.value)}
        />
      )
    },
    {
      title: 'Amount (₹)',
      dataIndex: 'amount',
      key: 'amount',
      width: 200,
      render: (val: number, record: any) => (
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          value={val}
          onChange={(v) => handleItemChange(record.id, 'amount', v || 0)}
        />
      )
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      render: (_: any, record: any) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveItem(record.id)}
        />
      )
    }
  ];

  return (
    <div style={{ padding: '4px 0 24px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            Back
          </Button>
          <Title level={2} style={{ margin: 0, color: '#1E2933', fontSize: 22, fontWeight: 600 }}>
            <EditOutlined style={{ marginRight: 8, color: '#17324D' }} />
            Edit Processed Bill ({bill.billNumber})
          </Title>
        </Space>
      </div>

      <Alert
        message={<span style={{ fontWeight: 600, color: '#9E6B1D' }}>Immutable Bill Number Notice</span>}
        description={`The allocated Bill Number (${bill.billNumber}) and Financial Year (${bill.financialYear}) are immutable. Every modification to line items, amounts, or remarks will be logged to the System Audit Log.`}
        type="warning"
        showIcon
        icon={<SafetyCertificateOutlined style={{ color: '#C58A2A' }} />}
        style={{ marginBottom: 20, borderRadius: 4, background: '#FDF6E8', border: '1px solid #E8CCA1' }}
      />

      <Form form={form} layout="vertical" disabled={submitting}>
        <Card title="Invoice Meta Information" style={{ borderRadius: 4, marginBottom: 20 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Bill Number">
                <Input value={bill.billNumber} disabled style={{ fontWeight: 600, color: '#17324D' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Financial Year">
                <Input value={bill.financialYear} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Company">
                <Input value={bill.companyName} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Client">
                <Input value={bill.clientName} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="billingDate"
                label="Billing Date"
                rules={[{ required: true, message: 'Please select billing date' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="remarks" label="Remarks">
                <Input placeholder="Updated invoice remarks" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card
          title="Itemized Line Items"
          style={{ borderRadius: 4, marginBottom: 20 }}
          extra={
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddItem} style={{ borderColor: '#B9C3C4', color: '#17324D' }}>
              Add Line Item
            </Button>
          }
        >
          <Table
            columns={columns}
            dataSource={items}
            rowKey="id"
            pagination={false}
            footer={() => (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 14, color: '#34424C' }}>Updated Total Amount:</Text>
                <Title level={3} style={{ margin: 0, color: '#17324D', fontWeight: 700 }}>
                  {formatCurrencyINR(totalAmount)}
                </Title>
              </div>
            )}
          />
        </Card>

        <Card style={{ borderRadius: 8, textAlign: 'right' }}>
          <Space size="middle">
            <Button size="large" onClick={() => router.back()}>
              Cancel
            </Button>
            <ActionConfirmPopover
              title="Save Changes to Processed Bill?"
              description="Are you sure you want to update the line items, charges, and remarks for this issued invoice?"
              okText="Yes, Save Changes"
              cancelText="No, Cancel"
              onConfirm={handleSave}
              loading={submitting}
              placement="topRight"
            >
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                loading={submitting}
              >
                Save Updated Processed Bill
              </Button>
            </ActionConfirmPopover>
          </Space>
        </Card>
      </Form>
    </div>
  );
}
