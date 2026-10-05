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
  Modal,
  Descriptions,
  Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  LockOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CarOutlined,
  FileTextOutlined,
  WalletOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { ActionConfirmPopover } from '@/components/common/ActionConfirmPopover';
import {
  LoadingExpenseItem,
  LOADING_EXPENSE_CATEGORIES,
  getLoadingCategoryColor,
  formatINR,
  ExpenseTotals,
} from '@/lib/utils/expensesHelper';
import { exportToExcel } from '@/lib/utils/exportHelper';
import { formatDate } from '@/lib/utils/format';

import { useTheme } from '@/components/providers/ThemeContext';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function LoadingExpensesPage() {
  const { isDark } = useTheme();
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

  // View modal state
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<LoadingExpenseItem | null>(null);

  const handleOpenViewModal = (record: LoadingExpenseItem) => {
    setViewingRecord(record);
    setViewModalVisible(true);
  };

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

  const handleResetFilters = () => {
    setSearchText('');
    setCategoryFilter(undefined);
    setSourceFilter(undefined);
    setDateRange(null);
    setPage(1);
  };

  const exportToCSV = (items: LoadingExpenseItem[], filename: string) => {
    if (!items || items.length === 0) {
      message.warning('No loading expense records to export');
      return;
    }
    const headers = [
      'Expense ID',
      'Date',
      'Category',
      'Source',
      'Vehicle No',
      'Enquiry / TXN',
      'Amount (INR)',
      'Description'
    ];
    const rows = items.map((r) => [
      `"${r.id}"`,
      `"${r.expenseDate || ''}"`,
      `"${r.category || ''}"`,
      `"${r.source || ''}"`,
      `"${r.vehicleNumber || ''}"`,
      `"${r.enquiryNumber || r.enquiryId || ''}"`,
      r.amount || 0,
      `"${(r.description || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success(`Exported ${items.length} record(s) successfully!`);
  };

  const loadingExportColumns = [
    { key: 'id', title: 'Expense ID' },
    { key: 'expenseDate', title: 'Date' },
    { key: 'category', title: 'Category' },
    { key: 'amount', title: 'Amount (INR)' },
    { key: 'source', title: 'Source' },
    { key: 'vehicleNumber', title: 'Vehicle Number' },
    { key: 'enquiryId', title: 'Enquiry ID' },
    { key: 'notes', title: 'Notes / Remarks' },
  ];

  const handleExportFiltered = () => {
    if (data.length === 0) {
      message.warning('No loading expense records to export');
      return;
    }
    const formattedData = data.map((item) => ({ ...item, expenseDate: formatDate(item.expenseDate) }));
    exportToExcel(formattedData, loadingExportColumns, `Loading_Expenses_Filtered_${dayjs().format('YYYY-MM-DD')}`);
    message.success(`Exported ${data.length} filtered loading expense records to Excel`);
  };

  const handleExportAll = async () => {
    try {
      message.loading({ content: 'Fetching all loading expenses for export...', key: 'exportLoading' });
      const res = await axios.get('/api/expenses/loading?limit=2000');
      const allItems = res.data?.data?.items || data;
      if (allItems.length === 0) {
        message.warning({ content: 'No loading expenses available to export', key: 'exportLoading' });
        return;
      }
      const formattedItems = allItems.map((item: LoadingExpenseItem) => ({ ...item, expenseDate: formatDate(item.expenseDate) }));
      exportToExcel(formattedItems, loadingExportColumns, `Loading_Expenses_ALL_${dayjs().format('YYYY-MM-DD')}`);
      message.success({ content: `Exported all ${allItems.length} loading expense records to Excel`, key: 'exportLoading' });
    } catch {
      const formattedData = data.map((item) => ({ ...item, expenseDate: formatDate(item.expenseDate) }));
      exportToExcel(formattedData, loadingExportColumns, `Loading_Expenses_ALL_${dayjs().format('YYYY-MM-DD')}`);
      message.success({ content: `Exported ${data.length} loading expense records to Excel`, key: 'exportLoading' });
    }
  };

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
      setEditingItem(item);
      let parsedDate = dayjs();
      if (item.expenseDate) {
        if (/^\d{2}-\d{2}-\d{4}$/.test(item.expenseDate.trim())) {
          const [d, m, y] = item.expenseDate.trim().split('-').map(Number);
          parsedDate = dayjs(new Date(y, m - 1, d));
        } else {
          const p = dayjs(item.expenseDate);
          if (p.isValid()) parsedDate = p;
        }
      }
      form.setFieldsValue({
        expenseDate: parsedDate,
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

  const getLoadingCategoryTagStyle = (cat: string) => {
    switch (cat) {
      case 'Diesel':
        return { bg: isDark ? '#451A03' : '#FEFCE8', text: isDark ? '#FBBF24' : '#B45309', border: isDark ? '#F59E0B' : '#FDE047' };
      case 'Loading Charges':
        return { bg: isDark ? '#1E293B' : '#EFF6FF', text: isDark ? '#60A5FA' : '#1D4ED8', border: isDark ? '#3B82F6' : '#93C5FD' };
      case 'Unloading Charges':
        return { bg: isDark ? '#134E4A' : '#F0FDFA', text: isDark ? '#2DD4BF' : '#0F766E', border: isDark ? '#14B8A6' : '#99F6E4' };
      case 'Parking':
        return { bg: isDark ? '#1E1B4B' : '#EEF2FF', text: isDark ? '#818CF8' : '#4338CA', border: isDark ? '#6366F1' : '#C7D2FE' };
      case 'Halting':
        return { bg: isDark ? '#3B0764' : '#FAF5FF', text: isDark ? '#C084FC' : '#7E22CE', border: isDark ? '#A855F7' : '#E9D5FF' };
      case 'Other Trip Expenses':
      default:
        return { bg: isDark ? '#27272A' : '#F8FAFC', text: isDark ? '#A1A1AA' : '#475569', border: isDark ? '#52525B' : '#CBD5E1' };
    }
  };

  const columns: ColumnsType<LoadingExpenseItem> = [
    {
      title: 'Expense Date',
      dataIndex: 'expenseDate',
      key: 'expenseDate',
      width: 120,
      render: (val: string) => <Text strong style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}>{formatDate(val)}</Text>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 160,
      render: (cat: string) => {
        const s = getLoadingCategoryTagStyle(cat);
        return (
          <Tag style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border, fontSize: 13, padding: '2px 8px', fontWeight: 600 }}>
            {cat}
          </Tag>
        );
      },
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right',
      render: (amt: number) => (
        <span style={{ color: isDark ? '#F8FAFC' : '#0F172A', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {formatINR(amt)}
        </span>
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
            <Tag
              style={{
                backgroundColor: isDark ? '#1E293B' : '#EFF6FF',
                color: isDark ? '#60A5FA' : '#1D4ED8',
                borderColor: isDark ? '#3B82F6' : '#93C5FD',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontWeight: 600,
                padding: '2px 8px',
              }}
              icon={<FileTextOutlined />}
            >
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
          <Tag
            style={{
              backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
              color: isDark ? '#38BDF8' : '#0369A1',
              borderColor: isDark ? '#334155' : '#CBD5E1',
              fontFamily: 'monospace',
              fontWeight: 600,
              padding: '2px 8px',
            }}
            icon={<CarOutlined />}
          >
            {veh}
          </Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Description / Notes',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string) => <span style={{ color: isDark ? '#CBD5E1' : '#334155' }}>{desc || '-'}</span>,
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
              <Tag
                style={{
                  backgroundColor: isDark ? '#052E16' : '#F0FDF4',
                  color: isDark ? '#4ADE80' : '#15803D',
                  borderColor: isDark ? '#22C55E' : '#BBF7D0',
                  fontWeight: 600,
                }}
                icon={<LockOutlined />}
              >
                Enquiry
              </Tag>
            </Tooltip>
          );
        }
        return (
          <Tag
            style={{
              backgroundColor: isDark ? '#27272A' : '#F8FAFC',
              color: isDark ? '#94A3B8' : '#475569',
              borderColor: isDark ? '#3F3F46' : '#E2E8F0',
              fontWeight: 600,
            }}
          >
            Manual
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      align: 'center',
      render: (_, record) => {
        return (
          <Space size="small">
            <Tooltip title="View Expense Details">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleOpenViewModal(record)}
                style={{
                  color: isDark ? '#38BDF8' : '#0284C7',
                  borderColor: isDark ? '#0284C7' : '#BAE6FD',
                  backgroundColor: isDark ? '#082F49' : '#F0F9FF',
                }}
              />
            </Tooltip>
            <Tooltip title="Edit Expense">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenDrawer(record)}
                style={{
                  color: isDark ? '#93C5FD' : '#2563EB',
                  borderColor: isDark ? '#3B82F6' : '#93C5FD',
                  backgroundColor: isDark ? '#1E293B' : '#EFF6FF',
                }}
              />
            </Tooltip>
            <ActionConfirmPopover
              title="Delete Loading Expense?"
              description="Are you sure you want to permanently delete this loading operational expense?"
              okText="Yes, Delete"
              cancelText="No, Keep It"
              onConfirm={() => handleDelete(record.id)}
              placement="topRight"
            >
              <Tooltip title="Delete Expense">
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  style={{
                    color: isDark ? '#F87171' : '#DC2626',
                    borderColor: isDark ? '#7F1D1D' : '#FCA5A5',
                    backgroundColor: isDark ? '#450A0A' : '#FEF2F2',
                  }}
                />
              </Tooltip>
            </ActionConfirmPopover>
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
          <Title level={3} style={{ margin: 0, color: isDark ? '#F8FAFC' : '#17324D', letterSpacing: '-0.01em' }}>
            Loading Expenses
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: isDark ? '#94A3B8' : '#5F6B73' }}>
            Trip and job-associated operational expenses with automatic synchronization from transport enquiries.
          </Text>
        </div>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={handleExportAll}>
            Export All
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => handleOpenDrawer()}
          >
            Record Expense
          </Button>
        </Space>
      </div>

      {/* KPI Stats Row */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="spt-kpi-card spt-kpi-amber">
            <Statistic
              title={<span style={{ fontSize: 12, textTransform: 'uppercase', color: isDark ? '#94A3B8' : '#5F6B73', fontWeight: 600 }}>Total Loading Expenses</span>}
              value={summaryTotals.totalAmount}
              precision={2}
              prefix="₹"
              valueStyle={{ color: isDark ? '#38BDF8' : '#17324D', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="spt-kpi-card spt-kpi-steel">
            <Statistic
              title={<span style={{ fontSize: 12, textTransform: 'uppercase', color: isDark ? '#94A3B8' : '#5F6B73', fontWeight: 600 }}>Recorded Entries</span>}
              value={summaryTotals.count}
              prefix={<WalletOutlined style={{ color: isDark ? '#60A5FA' : '#365A73' }} />}
              valueStyle={{ color: isDark ? '#F8FAFC' : '#1E2933', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="spt-kpi-card spt-kpi-amber">
            <Statistic
              title={<span style={{ fontSize: 12, textTransform: 'uppercase', color: isDark ? '#94A3B8' : '#5F6B73', fontWeight: 600 }}>Diesel Total</span>}
              value={summaryTotals.categoryBreakdown['Diesel'] || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: isDark ? '#FBBF24' : '#C58A2A', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="spt-kpi-card spt-kpi-steel">
            <Statistic
              title={<span style={{ fontSize: 12, textTransform: 'uppercase', color: isDark ? '#94A3B8' : '#5F6B73', fontWeight: 600 }}>Halting Total</span>}
              value={summaryTotals.categoryBreakdown['Halting'] || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: isDark ? '#A78BFA' : '#365A73', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
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
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>
                Reset
              </Button>
              <Button type="primary" onClick={fetchExpenses}>
                Filter
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleExportFiltered}>
                Export Filtered
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
                <Table.Summary.Row
                  style={{
                    background: isDark ? '#1E293B' : '#F1F5F9',
                    borderTop: isDark ? '2px solid #334155' : '2px solid #CBD5E1',
                    borderBottom: isDark ? '2px solid #334155' : '2px solid #CBD5E1',
                  }}
                >
                  <Table.Summary.Cell index={0} colSpan={2}>
                    <span style={{ color: isDark ? '#F8FAFC' : '#0F172A', fontWeight: 700, fontSize: 13 }}>
                      Page Total
                    </span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <span style={{ color: isDark ? '#38BDF8' : '#0284C7', fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>
                      {formatINR(pageTotal)}
                    </span>
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
            <ActionConfirmPopover
              title={editingItem ? 'Save Updated Loading Expense?' : 'Record New Loading Expense?'}
              description={
                editingItem
                  ? 'Confirm saving modifications for this loading trip expense entry.'
                  : 'Confirm saving this operational loading trip expense.'
              }
              okText={editingItem ? 'Yes, Update' : 'Yes, Save Expense'}
              cancelText="No, Cancel"
              onConfirm={handleDrawerSubmit}
              loading={drawerLoading}
              placement="bottomRight"
            >
              <Button type="primary" loading={drawerLoading}>
                {editingItem ? 'Update' : 'Save Expense'}
              </Button>
            </ActionConfirmPopover>
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

      {/* View Expense Details Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <EyeOutlined style={{ color: '#0284C7', fontSize: 18 }} />
            <span style={{ fontWeight: 600 }}>Loading Expense Details</span>
            {viewingRecord?.category && (
              <Tag
                style={{
                  ...(() => {
                    const s = getLoadingCategoryTagStyle(viewingRecord.category);
                    return { backgroundColor: s.bg, color: s.text, borderColor: s.border };
                  })(),
                  fontSize: 12,
                  fontWeight: 600,
                  marginLeft: 4,
                }}
              >
                {viewingRecord.category}
              </Tag>
            )}
          </div>
        }
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            Close
          </Button>,
          <Button
            key="edit"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              const rec = viewingRecord;
              setViewModalVisible(false);
              if (rec) handleOpenDrawer(rec);
            }}
          >
            Edit Expense
          </Button>,
        ]}
        width={580}
      >
        {viewingRecord && (
          <div style={{ padding: '8px 0' }}>
            {/* Amount Banner */}
            <div
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)'
                  : 'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)',
                border: isDark ? '1px solid #334155' : '1px solid #BAE6FD',
                borderRadius: 8,
                padding: '16px 20px',
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Expense Amount
                </Text>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    color: isDark ? '#38BDF8' : '#0284C7',
                    fontFamily: 'monospace',
                    marginTop: 2,
                  }}
                >
                  {formatINR(viewingRecord.amount)}
                </div>
              </div>
              <Tag
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 10px',
                  backgroundColor: viewingRecord.source === 'ENQUIRY' ? (isDark ? '#052E16' : '#F0FDF4') : (isDark ? '#27272A' : '#F8FAFC'),
                  color: viewingRecord.source === 'ENQUIRY' ? (isDark ? '#4ADE80' : '#15803D') : (isDark ? '#94A3B8' : '#475569'),
                  borderColor: viewingRecord.source === 'ENQUIRY' ? (isDark ? '#22C55E' : '#BBF7D0') : (isDark ? '#3F3F46' : '#E2E8F0'),
                }}
              >
                {viewingRecord.source === 'ENQUIRY' ? 'Auto-synced from Enquiry' : 'Manual Expense'}
              </Tag>
            </div>

            {/* Detailed Key-Values */}
            <Descriptions
              bordered
              size="small"
              column={1}
              labelStyle={{ width: '38%', fontWeight: 600, color: isDark ? '#94A3B8' : '#475569' }}
              contentStyle={{ color: isDark ? '#F1F5F9' : '#0F172A' }}
            >
              <Descriptions.Item label="Expense ID">
                <code style={{ fontSize: 12, fontWeight: 700 }}>{viewingRecord.id}</code>
              </Descriptions.Item>
              <Descriptions.Item label="Expense Date">
                <Text strong>{viewingRecord.expenseDate || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                <Text strong>{viewingRecord.category}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Vehicle">
                {viewingRecord.vehicleNumber ? (
                  <Tag
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                      color: isDark ? '#38BDF8' : '#0369A1',
                      borderColor: isDark ? '#334155' : '#CBD5E1',
                    }}
                    icon={<CarOutlined />}
                  >
                    {viewingRecord.vehicleNumber}
                  </Tag>
                ) : (
                  <Text type="secondary">Not assigned</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Linked Enquiry / Job">
                {viewingRecord.enquiryId ? (
                  <Link href={`/enquiries/${viewingRecord.enquiryId}`}>
                    <Tag
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        cursor: 'pointer',
                        backgroundColor: isDark ? '#1E293B' : '#EFF6FF',
                        color: isDark ? '#60A5FA' : '#1D4ED8',
                        borderColor: isDark ? '#3B82F6' : '#93C5FD',
                      }}
                      icon={<FileTextOutlined />}
                    >
                      {viewingRecord.enquiryNumber || viewingRecord.enquiryId}
                    </Tag>
                  </Link>
                ) : (
                  <Text type="secondary">None</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Description / Notes">
                <span style={{ whiteSpace: 'pre-wrap' }}>{viewingRecord.description || 'No additional remarks provided.'}</span>
              </Descriptions.Item>
              {viewingRecord.createdAt && (
                <Descriptions.Item label="Recorded At">
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(viewingRecord.createdAt).format('DD-MMM-YYYY HH:mm')}
                  </Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
}
