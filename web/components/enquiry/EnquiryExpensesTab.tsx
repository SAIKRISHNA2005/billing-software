'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Tag,
  Typography,
  Space,
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Input,
  Popconfirm,
  Tooltip,
  Row,
  Col,
  Statistic,
  Card,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  LockOutlined,
  DeleteOutlined,
  WalletOutlined,
  EditOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import {
  LoadingExpenseItem,
  LOADING_EXPENSE_CATEGORIES,
  getLoadingCategoryColor,
  formatINR,
} from '@/lib/utils/expensesHelper';

const { Text } = Typography;

interface EnquiryExpensesTabProps {
  enquiryId: string;
  vehicleId?: string;
}

export function EnquiryExpensesTab({ enquiryId, vehicleId }: EnquiryExpensesTabProps) {
  const [expenses, setExpenses] = useState<LoadingExpenseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LoadingExpenseItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchExpenses = useCallback(async () => {
    if (!enquiryId) return;
    setLoading(true);
    try {
      const res = await axios.get('/api/expenses/loading', {
        params: { enquiryId, limit: '100' },
      });
      if (res.data.success && res.data.data) {
        setExpenses(res.data.data.items || []);
      }
    } catch {
      message.error('Failed to load enquiry expenses');
    } finally {
      setLoading(false);
    }
  }, [enquiryId]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleOpenModal = (item?: LoadingExpenseItem) => {
    if (item) {
      if (item.source === 'ENQUIRY') {
        message.warning('This expense is auto-synced from the enquiry. Edit the enquiry fields directly.');
        return;
      }
      setEditingItem(item);
      form.setFieldsValue({
        expenseDate: item.expenseDate ? dayjs(item.expenseDate, 'DD-MM-YYYY') : dayjs(),
        category: item.category,
        amount: item.amount,
        description: item.description,
      });
    } else {
      setEditingItem(null);
      form.resetFields();
      form.setFieldsValue({
        expenseDate: dayjs(),
        category: 'Parking',
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        expenseDate: values.expenseDate.format('DD-MM-YYYY'),
        category: values.category,
        amount: values.amount,
        description: values.description || '',
        enquiryId,
        vehicleId: vehicleId || '',
      };

      if (editingItem) {
        const res = await axios.put(`/api/expenses/loading/${editingItem.id}`, payload);
        if (res.data.success) {
          message.success('Expense updated');
          setModalOpen(false);
          fetchExpenses();
        } else {
          message.error(res.data.message || 'Update failed');
        }
      } else {
        const res = await axios.post('/api/expenses/loading', payload);
        if (res.data.success) {
          message.success('Trip expense recorded');
          setModalOpen(false);
          fetchExpenses();
        } else {
          message.error(res.data.message || 'Creation failed');
        }
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        message.error(err.response.data.message);
      } else if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await axios.delete(`/api/expenses/loading/${id}`);
      if (res.data.success) {
        message.success('Expense removed');
        fetchExpenses();
      } else {
        message.error(res.data.message || 'Delete failed');
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        message.error(err.response.data.message);
      } else {
        message.error('Delete failed');
      }
    }
  };

  const totalAmount = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const dieselAmount = expenses
    .filter((e) => e.category === 'Diesel')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const haltingAmount = expenses
    .filter((e) => e.category === 'Halting')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const otherExpenses = totalAmount - dieselAmount - haltingAmount;

  const columns: ColumnsType<LoadingExpenseItem> = [
    {
      title: 'Expense Date',
      dataIndex: 'expenseDate',
      key: 'expenseDate',
      width: 120,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 160,
      render: (cat: string) => <Tag color={getLoadingCategoryColor(cat)}>{cat}</Tag>,
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right',
      render: (amt: number) => (
        <Text strong style={{ color: '#cf1322' }}>
          {formatINR(amt)}
        </Text>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string) => desc || <Text type="secondary">-</Text>,
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 130,
      align: 'center',
      render: (source: string) => {
        if (source === 'ENQUIRY') {
          return (
            <Tooltip title="Auto-synced from enquiry Diesel/Halting. Edit from the enquiry form.">
              <Tag color="purple" icon={<LockOutlined />}>
                Auto (Enquiry)
              </Tag>
            </Tooltip>
          );
        }
        return <Tag color="geekblue">Manual</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_, record) => {
        if (record.source === 'ENQUIRY') {
          return (
            <Tooltip title="Managed via enquiry form">
              <LockOutlined style={{ color: '#8c8c8c' }} />
            </Tooltip>
          );
        }
        return (
          <Space size="small">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
            <Popconfirm
              title="Delete this expense?"
              onConfirm={() => handleDelete(record.id)}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ backgroundColor: '#fff1f0', borderColor: '#ffa39e' }}>
            <Statistic
              title="Total Job Expenses"
              value={totalAmount}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#cf1322', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ backgroundColor: '#fffbe6', borderColor: '#ffe58f' }}>
            <Statistic
              title="Diesel"
              value={dieselAmount}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#d46b08', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ backgroundColor: '#e6f4ff', borderColor: '#91caff' }}>
            <Statistic
              title="Halting"
              value={haltingAmount}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#0958d9', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ backgroundColor: '#fafafa' }}>
            <Statistic
              title="Other Trip Expenses"
              value={otherExpenses}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#595959', fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text strong style={{ fontSize: 16 }}>
          <WalletOutlined style={{ marginRight: 8 }} />
          Itemized Trip Expenses
        </Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          Add Trip Expense
        </Button>
      </div>

      <Table<LoadingExpenseItem>
        columns={columns}
        dataSource={expenses}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
      />

      <Modal
        title={editingItem ? 'Edit Trip Expense' : 'Add Trip Expense'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="expenseDate"
            label="Expense Date"
            rules={[{ required: true, message: 'Please select date' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
          </Form.Item>

          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true, message: 'Please select category' }]}
          >
            <Select placeholder="Select category">
              {LOADING_EXPENSE_CATEGORIES.map((cat) => (
                <Select.Option key={cat} value={cat}>
                  <Tag color={getLoadingCategoryColor(cat)} style={{ marginRight: 8 }}>
                    {cat}
                  </Tag>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="amount"
            label="Amount (₹)"
            rules={[
              { required: true, message: 'Please enter amount' },
              { type: 'number', min: 0.01, message: 'Must be greater than 0' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} precision={2} prefix="₹" placeholder="0.00" />
          </Form.Item>

          <Form.Item name="description" label="Description / Notes">
            <Input.TextArea rows={3} placeholder="Toll, parking, unloading specifics..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
