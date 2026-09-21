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
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  LockOutlined,
  EditOutlined,
  DeleteOutlined,
  CarOutlined,
  FileTextOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import {
  LoadingExpenseItem,
  LOADING_EXPENSE_CATEGORIES,
  getLoadingCategoryColor,
  formatINR,
  ExpenseTotals,
} from '@/lib/utils/expensesHelper';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function LoadingExpensesPage() {
  const [data, setData] = useState<LoadingExpenseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [sourceFilter, setSourceFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  // Summary totals
  const [summaryTotals, setSummaryTotals] = useState<ExpenseTotals>({
    totalAmount: 0,
    count: 0,
    categoryBreakdown: {},
  });

  // Drawer state
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<LoadingExpenseItem | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [form] = Form.useForm();

  // Enquiry & Vehicle lookups for Drawer
  const [enquiryOptions, setEnquiryOptions] = useState<Array<{ label: string; value: string; vehicleId?: string }>>([]);
  const [vehicleOptions, setVehicleOptions] = useState<Array<{ label: string; value: string }>>([]);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(pageSize),
      };

      if (searchText) params.search = searchText;
      if (categoryFilter) params.category = categoryFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.fromDate = dateRange[0].format('DD-MM-YYYY');
        params.toDate = dateRange[1].format('DD-MM-YYYY');
      }

      const res = await axios.get('/api/expenses/loading', { params });
      if (res.data.success && res.data.data) {
        setData(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
        if (res.data.data.totals) {
          setSummaryTotals(res.data.data.totals);
        }
      } else {
        message.error(res.data.message || 'Failed to fetch loading expenses');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching loading expenses';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchText, categoryFilter, sourceFilter, dateRange]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Load lookups for drawer
  const loadDrawerLookups = async () => {
    try {
      const [enqRes, vehRes] = await Promise.all([
        axios.get('/api/enquiries?limit=100'),
        axios.get('/api/master/vehicles?limit=100'),
      ]);

      if (enqRes.data.success && enqRes.data.data?.items) {
        setEnquiryOptions(
          enqRes.data.data.items.map((e: { id: string; enquiryNumber: string; vehicleId?: string }) => ({
            label: `${e.enquiryNumber || e.id}`,
            value: e.id,
            vehicleId: e.vehicleId,
          }))
        );
      }

      if (vehRes.data.success && vehRes.data.data?.items) {
        setVehicleOptions(
          vehRes.data.data.items.map((v: { id: string; vehicleNumber: string }) => ({
            label: v.vehicleNumber,
            value: v.id,
          }))
        );
      }
    } catch {
      // Non-critical background lookup
    }
  };

  const handleOpenDrawer = (item?: LoadingExpenseItem) => {
    loadDrawerLookups();
    if (item) {
      if (item.source === 'ENQUIRY') {
        message.warning('This expense is auto-synced from an enquiry. Edit it directly from the enquiry screen.');
        return;
      }
      setEditingItem(item);
      form.setFieldsValue({
        expenseDate: item.expenseDate ? dayjs(item.expenseDate, 'DD-MM-YYYY') : dayjs(),
        category: item.category,
        amount: item.amount,
        description: item.description,
        enquiryId: item.enquiryId || undefined,
        vehicleId: item.vehicleId || undefined,
      });
    } else {
      setEditingItem(null);
      form.resetFields();
      form.setFieldsValue({
        expenseDate: dayjs(),
        category: 'Parking',
      });
    }
    setDrawerVisible(true);
  };

  const handleEnquiryChange = (enqId: string) => {
    const selected = enquiryOptions.find((o) => o.value === enqId);
    if (selected && selected.vehicleId) {
      form.setFieldsValue({ vehicleId: selected.vehicleId });
    }
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
        enquiryId: values.enquiryId || '',
        vehicleId: values.vehicleId || '',
      };

      if (editingItem) {
        const res = await axios.put(`/api/expenses/loading/${editingItem.id}`, payload);
        if (res.data.success) {
          message.success('Loading expense updated successfully');
          setDrawerVisible(false);
          fetchExpenses();
        } else {
          message.error(res.data.message || 'Update failed');
        }
      } else {
        const res = await axios.post('/api/expenses/loading', payload);
        if (res.data.success) {
          message.success('Loading expense recorded successfully');
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
      const res = await axios.delete(`/api/expenses/loading/${id}`);
      if (res.data.success) {
        message.success('Expense deleted successfully');
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
    setSourceFilter(undefined);
    setDateRange(null);
    setPage(1);
  };

  const columns: ColumnsType<LoadingExpenseItem> = [
    {
      title: 'Expense Date',
      dataIndex: 'expenseDate',
      key: 'expenseDate',
      width: 120,
      render: (val: string) => <Text strong>{val || '-'}</Text>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 160,
      render: (cat: string) => (
        <Tag color={getLoadingCategoryColor(cat)} style={{ fontSize: 13, padding: '2px 8px' }}>
          {cat}
        </Tag>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right',
      render: (amt: number) => (
        <Text strong style={{ color: '#cf1322', fontSize: 14 }}>
          {formatINR(amt)}
        </Text>
      ),
    },
    {
      title: 'Linked Enquiry',
      dataIndex: 'enquiryId',
      key: 'enquiryId',
      width: 160,
      render: (enqId: string, record) => {
        if (!enqId) return <Text type="secondary">-</Text>;
        const label = record.enquiryNumber || enqId;
        return (
          <Link href={`/enquiries/${enqId}`}>
            <Tag color="blue" icon={<FileTextOutlined />} style={{ cursor: 'pointer' }}>
              {label}
            </Tag>
          </Link>
        );
      },
    },
    {
      title: 'Vehicle',
      dataIndex: 'vehicleNumber',
      key: 'vehicleNumber',
      width: 140,
      render: (veh: string) =>
        veh ? (
          <Tag icon={<CarOutlined />}>{veh}</Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Description / Notes',
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
      render: (source: string, record) => {
        if (source === 'ENQUIRY') {
          return (
            <Tooltip title={`Auto-synced from enquiry ${record.enquiryNumber || record.enquiryId}. Edit from the enquiry.`}>
              <Tag color="purple" icon={<LockOutlined />}>
                Enquiry
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
      width: 140,
      align: 'center',
      render: (_, record) => {
        if (record.source === 'ENQUIRY') {
          return (
            <Tooltip title="Edit this from the enquiry">
              <Link href={`/enquiries/${record.enquiryId}`}>
                <Button size="small" type="link">
                  Open Job
                </Button>
              </Link>
            </Tooltip>
          );
        }

        return (
          <Space size="small">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenDrawer(record)}
            />
            <Popconfirm
              title="Delete this expense record?"
              description="Are you sure you want to delete this trip expense?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes, Delete"
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
            Loading Expenses
          </Title>
          <Text type="secondary">
            Trip and job-associated operational expenses with automatic synchronization from transport enquiries.
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
          <Card size="small" bordered={false} style={{ background: '#fff1f0', borderColor: '#ffa39e' }}>
            <Statistic
              title="Total Loading Expenses"
              value={summaryTotals.totalAmount}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#cf1322', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
            <Statistic
              title="Recorded Entries"
              value={summaryTotals.count}
              prefix={<WalletOutlined />}
              valueStyle={{ color: '#262626', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" bordered={false} style={{ background: '#fffbe6', borderColor: '#ffe58f' }}>
            <Statistic
              title="Diesel Total"
              value={summaryTotals.categoryBreakdown['Diesel'] || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#d46b08', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" bordered={false} style={{ background: '#e6f4ff', borderColor: '#91caff' }}>
            <Statistic
              title="Halting Total"
              value={summaryTotals.categoryBreakdown['Halting'] || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#0958d9', fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter Bar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Search ID, Notes, Enquiry, Vehicle..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="Category"
              style={{ width: '100%' }}
              value={categoryFilter}
              onChange={setCategoryFilter}
              allowClear
            >
              {LOADING_EXPENSE_CATEGORIES.map((cat) => (
                <Select.Option key={cat} value={cat}>
                  {cat}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="Source"
              style={{ width: '100%' }}
              value={sourceFilter}
              onChange={setSourceFilter}
              allowClear
            >
              <Select.Option value="ENQUIRY">Auto (Enquiry)</Select.Option>
              <Select.Option value="MANUAL">Manual</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
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
        <Table<LoadingExpenseItem>
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
            showTotal: (tot) => `Total ${tot} trip expenses`,
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
                    <Text strong style={{ color: '#cf1322' }}>
                      {formatINR(pageTotal)}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} colSpan={5} />
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>

      {/* Create / Edit Drawer */}
      <Drawer
        title={editingItem ? `Edit Loading Expense (${editingItem.id})` : 'Record Loading Expense'}
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

          <Form.Item name="enquiryId" label="Linked Job / Enquiry (Optional)">
            <Select
              placeholder="Select associated enquiry (auto-fills vehicle)"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={enquiryOptions}
              onChange={handleEnquiryChange}
              allowClear
            />
          </Form.Item>

          <Form.Item name="vehicleId" label="Linked Vehicle (Optional)">
            <Select
              placeholder="Select vehicle"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={vehicleOptions}
              allowClear
            />
          </Form.Item>

          <Form.Item name="description" label="Description / Notes">
            <Input.TextArea
              rows={3}
              placeholder="Enter remarks, toll receipts, or parking specifics..."
            />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
