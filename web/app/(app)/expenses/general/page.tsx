'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  ShopOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import {
  GeneralExpenseItem,
  GENERAL_EXPENSE_CATEGORIES,
  getGeneralCategoryColor,
  formatINR,
  ExpenseTotals,
} from '@/lib/utils/expensesHelper';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function GeneralExpensesPage() {
  const [data, setData] = useState<GeneralExpenseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  // Summary totals
  const [summaryTotals, setSummaryTotals] = useState<ExpenseTotals>({
    totalAmount: 0,
    count: 0,
    categoryBreakdown: {},
  });

  // Drawer state
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<GeneralExpenseItem | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(pageSize),
      };

      if (searchText) params.search = searchText;
      if (categoryFilter) params.category = categoryFilter;
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.fromDate = dateRange[0].format('DD-MM-YYYY');
        params.toDate = dateRange[1].format('DD-MM-YYYY');
      }

      const res = await axios.get('/api/expenses/general', { params });
      if (res.data.success && res.data.data) {
        setData(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
        if (res.data.data.totals) {
          setSummaryTotals(res.data.data.totals);
        }
      } else {
        message.error(res.data.message || 'Failed to fetch general expenses');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching general expenses';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchText, categoryFilter, dateRange]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleOpenDrawer = (item?: GeneralExpenseItem) => {
    if (item) {
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
        category: 'Office Stationery',
      });
    }
    setDrawerVisible(true);
  };

  const handleDrawerSubmit = async () => {
    try {
      const values = await form.validateFields();
      setDrawerLoading(true);

      const payload = {
        expenseDate: values.expenseDate.format('DD-MM-YYYY'),
        category: values.category,
        amount: values.amount,
        description: values.description || '',
      };

      if (editingItem) {
        const res = await axios.put(`/api/expenses/general/${editingItem.id}`, payload);
        if (res.data.success) {
          message.success('General expense updated successfully');
          setDrawerVisible(false);
          fetchExpenses();
        } else {
          message.error(res.data.message || 'Update failed');
        }
      } else {
        const res = await axios.post('/api/expenses/general', payload);
        if (res.data.success) {
          message.success('General expense recorded successfully');
          setDrawerVisible(false);
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
      setDrawerLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await axios.delete(`/api/expenses/general/${id}`);
      if (res.data.success) {
        message.success('General expense deleted successfully');
        fetchExpenses();
      } else {
        message.error(res.data.message || 'Failed to delete expense');
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        message.error(err.response.data.message);
      } else {
        message.error('Delete failed');
      }
    }
  };

  const handleResetFilters = () => {
    setSearchText('');
    setCategoryFilter(undefined);
    setDateRange(null);
    setPage(1);
  };

  const columns: ColumnsType<GeneralExpenseItem> = [
    {
      title: 'Expense Date',
      dataIndex: 'expenseDate',
      key: 'expenseDate',
      width: 130,
      render: (val: string) => <Text strong>{val || '-'}</Text>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 180,
      render: (cat: string) => (
        <Tag color={getGeneralCategoryColor(cat)} style={{ fontSize: 13, padding: '2px 8px' }}>
          {cat}
        </Tag>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      align: 'right',
      render: (amt: number) => (
        <Text strong style={{ color: '#0958d9', fontSize: 14 }}>
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
      title: 'Actions',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenDrawer(record)}
          />
          <Popconfirm
            title="Delete this expense record?"
            description="Are you sure you want to delete this administrative expense?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            General Expenses
          </Title>
          <Text type="secondary">
            Office, administrative, and overhead expenses tracking and itemized categorization.
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={() => handleOpenDrawer()}
        >
          Record Expense
        </Button>
      </div>

      {/* KPI Stats Row */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" bordered={false} style={{ background: '#e6f4ff', borderColor: '#91caff' }}>
            <Statistic
              title="Total General Expenses"
              value={summaryTotals.totalAmount}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#0958d9', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
            <Statistic
              title="Recorded Entries"
              value={summaryTotals.count}
              prefix={<FileDoneOutlined />}
              valueStyle={{ color: '#262626', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" bordered={false} style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
            <Statistic
              title="Salary-Related"
              value={summaryTotals.categoryBreakdown['Salary-Related'] || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#389e0d', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" bordered={false} style={{ background: '#fff7e6', borderColor: '#ffd591' }}>
            <Statistic
              title="Electricity & Internet"
              value={
                (summaryTotals.categoryBreakdown['Electricity'] || 0) +
                (summaryTotals.categoryBreakdown['Internet'] || 0)
              }
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#d46b08', fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter Bar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search ID, Description..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6} md={5}>
            <Select
              placeholder="Category"
              style={{ width: '100%' }}
              value={categoryFilter}
              onChange={setCategoryFilter}
              allowClear
            >
              {GENERAL_EXPENSE_CATEGORIES.map((cat) => (
                <Select.Option key={cat} value={cat}>
                  {cat}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={7}>
            <RangePicker
              style={{ width: '100%' }}
              format="DD-MM-YYYY"
              value={dateRange}
              onChange={(val) => setDateRange(val as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
            />
          </Col>
          <Col xs={24} sm={12} md={4} style={{ textAlign: 'right' }}>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>
                Reset
              </Button>
              <Button type="primary" onClick={fetchExpenses}>
                Filter
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card bordered={false} bodyStyle={{ padding: 0 }}>
        <Table<GeneralExpenseItem>
          columns={columns}
          dataSource={data}
          rowKey="id"
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
            showTotal: (tot) => `Total ${tot} general expenses`,
          }}
          summary={(pageData) => {
            let pageTotal = 0;
            pageData.forEach((item) => {
              pageTotal += item.amount || 0;
            });
            return (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
                  <Table.Summary.Cell index={0} colSpan={2}>
                    Page Total
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong style={{ color: '#0958d9' }}>
                      {formatINR(pageTotal)}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} colSpan={2} />
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>

      {/* Create / Edit Drawer */}
      <Drawer
        title={editingItem ? `Edit General Expense (${editingItem.id})` : 'Record General Expense'}
        width={480}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        extra={
          <Space>
            <Button onClick={() => setDrawerVisible(false)}>Cancel</Button>
            <Button type="primary" loading={drawerLoading} onClick={handleDrawerSubmit}>
              {editingItem ? 'Update' : 'Save Expense'}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="expenseDate"
            label="Expense Date"
            rules={[{ required: true, message: 'Please select expense date' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
          </Form.Item>

          <Form.Item
            name="category"
            label="Expense Category"
            rules={[{ required: true, message: 'Please select a category' }]}
          >
            <Select placeholder="Select category">
              {GENERAL_EXPENSE_CATEGORIES.map((cat) => (
                <Select.Option key={cat} value={cat}>
                  <Tag color={getGeneralCategoryColor(cat)} style={{ marginRight: 8 }}>
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
              { type: 'number', min: 0.01, message: 'Amount must be greater than 0' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              precision={2}
              prefix="₹"
              placeholder="0.00"
            />
          </Form.Item>

          <Form.Item name="description" label="Description / Notes">
            <Input.TextArea
              rows={4}
              placeholder="Enter details, vendor invoice info, or itemized notes..."
            />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
