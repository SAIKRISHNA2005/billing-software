'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  Table,
  Tabs,
  Button,
  Tag,
  Space,
  Typography,
  Tooltip,
  Popconfirm,
  message,
  Input,
  Row,
  Col,
  Statistic,
  Badge,
} from 'antd';
import {
  DeleteOutlined,
  RollbackOutlined,
  ReloadOutlined,
  SearchOutlined,
  CarOutlined,
  DollarOutlined,
  FileTextOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  DownloadOutlined,
  TeamOutlined,
  ContainerOutlined,
  UserOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTheme } from '@/components/providers/ThemeContext';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

interface TrashItem {
  id: string;
  category: string;
  tabName: string;
  sheetName: string;
  sourceSheet: string;
  badge: string;
  title: string;
  subtitle: string;
  amount: number | null;
  date?: string;
  deletedAt?: string;
  deletedBy?: string;
  raw?: any;
}

export default function TrashbinPage() {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [items, setItems] = useState<TrashItem[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    vehicle: 0,
    generalExpense: 0,
    loadingExpense: 0,
    dailyReport: 0,
    billing: 0,
    vendor: 0,
    driver: 0,
    container: 0,
  });
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/trashbin', {
        params: { category: activeTab, search: searchText },
      });
      if (res.data?.success) {
        setItems(res.data.data?.items || []);
        if (res.data.data?.counts) {
          setCounts(res.data.data.counts);
        }
      } else {
        message.error(res.data?.message || 'Failed to fetch trash records');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error loading trashbin');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchText]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const handleRestore = async (item: TrashItem) => {
    setRestoringId(item.id);
    const prevItems = [...items];
    const prevCounts = { ...counts };

    // Optimistic removal: instantly disappears from table and badges decrement
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setCounts((prev) => {
      const catKeyMap: Record<string, keyof typeof prev> = {
        'vehicle': 'vehicle',
        'general-expense': 'generalExpense',
        'loading-expense': 'loadingExpense',
        'daily-report': 'dailyReport',
        'billing': 'billing',
        'vendor': 'vendor',
        'driver': 'driver',
        'container': 'container',
      };
      const key = catKeyMap[item.category];
      return {
        ...prev,
        total: Math.max(0, prev.total - 1),
        ...(key ? { [key]: Math.max(0, (prev[key] || 1) - 1) } : {}),
      };
    });

    try {
      const res = await axios.post('/api/trashbin/restore', {
        category: item.category,
        id: item.id,
      });
      if (res.data?.success) {
        message.success({
          content: res.data.message || `Successfully restored ${item.title} back to active page & master Excel!`,
          duration: 4,
        });
      } else {
        // Rollback on failure
        setItems(prevItems);
        setCounts(prevCounts);
        message.error(res.data?.message || 'Failed to restore record');
      }
    } catch (err: any) {
      // Rollback on network/server error
      setItems(prevItems);
      setCounts(prevCounts);
      message.error(err.response?.data?.message || 'Error during restoration');
    } finally {
      setRestoringId(null);
    }
  };

  const handleDownloadMasterExcel = async () => {
    setDownloading(true);
    try {
      const res = await axios.get('/api/exports/master-excel');
      if (res.data && res.data.success) {
        const payload = res.data.data;
        if (payload?.base64Data) {
          const { base64Data, filename } = payload;
          const link = document.createElement('a');
          link.href = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + base64Data;
          link.download = filename || 'TMS_Master_Database_With_Trashbins.xlsx';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          message.success('Master Production Excel snapshot with all trashbin sheets downloaded!');
        } else if (payload?.downloadUrl) {
          const link = document.createElement('a');
          link.href = payload.downloadUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          message.success('Master Production Excel download started!');
        } else {
          message.error(res.data?.message || 'No download payload returned');
        }
      } else {
        message.error(res.data?.message || 'Failed to generate Excel snapshot');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error downloading Excel snapshot');
    } finally {
      setDownloading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchText) return items;
    const q = searchText.toLowerCase();
    return items.filter(
      (item) =>
        item.title?.toLowerCase().includes(q) ||
        item.subtitle?.toLowerCase().includes(q) ||
        item.id?.toLowerCase().includes(q) ||
        item.badge?.toLowerCase().includes(q)
    );
  }, [items, searchText]);

  const columns = [
    {
      title: 'Category',
      key: 'category',
      width: 150,
      render: (_: any, record: TrashItem) => {
        if (record.category === 'vehicle') {
          return <Tag color="blue" icon={<CarOutlined />}>Vehicle</Tag>;
        }
        if (record.category === 'general-expense') {
          return <Tag color="cyan" icon={<DollarOutlined />}>General Expense</Tag>;
        }
        if (record.category === 'loading-expense') {
          return <Tag color="orange" icon={<DollarOutlined />}>Loading Expense</Tag>;
        }
        if (record.category === 'daily-report') {
          return <Tag color="purple" icon={<FileTextOutlined />}>Daily Report</Tag>;
        }
        if (record.category === 'billing') {
          return <Tag color="green" icon={<ContainerOutlined />}>Billing</Tag>;
        }
        if (record.category === 'vendor') {
          return <Tag color="geekblue" icon={<TeamOutlined />}>Vendor</Tag>;
        }
        if (record.category === 'driver') {
          return <Tag color="magenta" icon={<UserOutlined />}>Driver</Tag>;
        }
        return <Tag color="gold" icon={<ContainerOutlined />}>Container</Tag>;
      },
    },
    {
      title: 'Record Identifier / Title',
      key: 'title',
      width: 220,
      render: (_: any, record: TrashItem) => (
        <div>
          <Text strong style={{ fontSize: 13, color: isDark ? '#F1F5F9' : '#0F172A' }}>
            {record.title}
          </Text>
          <div style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>
            ID: {record.id}
          </div>
        </div>
      ),
    },
    {
      title: 'Details / Description',
      key: 'subtitle',
      render: (_: any, record: TrashItem) => (
        <div>
          <Text style={{ color: isDark ? '#CBD5E1' : '#334155' }}>
            {record.subtitle || '-'}
          </Text>
          {record.amount !== null && record.amount !== undefined && record.amount > 0 && (
            <div style={{ marginTop: 2 }}>
              <Tag color="green" style={{ fontWeight: 600 }}>
                ₹{Number(record.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Deleted Date & Time',
      dataIndex: 'deletedAt',
      key: 'deletedAt',
      width: 180,
      render: (val: string) => (
        <div>
          <Text style={{ fontSize: 12, color: isDark ? '#E2E8F0' : '#1E293B' }}>
            {val ? dayjs(val).format('DD-MMM-YYYY HH:mm') : '-'}
          </Text>
          {val && (
            <div style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>
              {dayjs(val).fromNow()}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Deleted By',
      dataIndex: 'deletedBy',
      key: 'deletedBy',
      width: 120,
      render: (val: string) => (
        <Tag color="default" style={{ fontSize: 11 }}>
          {val || 'USR-001'}
        </Tag>
      ),
    },
    {
      title: 'Production Excel Sheet',
      dataIndex: 'sheetName',
      key: 'sheetName',
      width: 190,
      render: (sheet: string) => (
        <code
          style={{
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 4,
            background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
            color: isDark ? '#FCA5A5' : '#B91C1C',
            border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #FECACA',
          }}
        >
          {sheet}
        </code>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 140,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, record: TrashItem) => (
        <Popconfirm
          title="Restore this record?"
          description={`This will restore ${record.title} back to its active page and active sheet in the master production Excel.`}
          onConfirm={() => handleRestore(record)}
          okText="Restore"
          cancelText="Cancel"
          okButtonProps={{ type: 'primary', icon: <RollbackOutlined /> }}
        >
          <Button
            type="primary"
            size="small"
            icon={<RollbackOutlined />}
            loading={restoringId === record.id}
            style={{
              background: isDark ? '#059669' : '#10B981',
              borderColor: isDark ? '#10B981' : '#059669',
              fontWeight: 600,
            }}
          >
            Restore
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header Banner */}
      <div
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)'
            : 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
          border: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
          borderRadius: 12,
          padding: '20px 24px',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}
            >
              <DeleteOutlined />
            </div>
            <div>
              <Title level={3} style={{ margin: 0, color: isDark ? '#F1F5F9' : '#0F172A' }}>
                Trashbin &amp; Data Recovery Vault
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Review and restore deleted records for each page. All changes reflect in the master production Excel in real time.
              </Text>
            </div>
          </div>
        </div>

        <Space size="middle" wrap>
          <Input
            placeholder="Search deleted records..."
            prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 240 }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchTrash} loading={loading}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownloadMasterExcel}
            loading={downloading}
            style={{ background: '#217346', borderColor: '#217346' }}
          >
            Export Master Excel
          </Button>
        </Space>
      </div>

      {/* Summary KPI Cards for Each Page */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <Card
            bordered
            style={{
              borderRadius: 8,
              background: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            }}
          >
            <Statistic
              title={<span style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 12 }}>Total Trash</span>}
              value={counts.total}
              prefix={<HistoryOutlined style={{ color: '#6366F1' }} />}
              valueStyle={{ color: isDark ? '#F1F5F9' : '#0F172A', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card
            bordered
            style={{
              borderRadius: 8,
              background: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            }}
          >
            <Statistic
              title={<span style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 12 }}>Vehicles</span>}
              value={counts.vehicle}
              prefix={<CarOutlined style={{ color: '#3B82F6' }} />}
              valueStyle={{ color: '#3B82F6', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card
            bordered
            style={{
              borderRadius: 8,
              background: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            }}
          >
            <Statistic
              title={<span style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 12 }}>General Exp</span>}
              value={counts.generalExpense}
              prefix={<DollarOutlined style={{ color: '#06B6D4' }} />}
              valueStyle={{ color: '#06B6D4', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card
            bordered
            style={{
              borderRadius: 8,
              background: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            }}
          >
            <Statistic
              title={<span style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 12 }}>Loading Exp</span>}
              value={counts.loadingExpense}
              prefix={<DollarOutlined style={{ color: '#F59E0B' }} />}
              valueStyle={{ color: '#F59E0B', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card
            bordered
            style={{
              borderRadius: 8,
              background: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            }}
          >
            <Statistic
              title={<span style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 12 }}>Daily Report</span>}
              value={counts.dailyReport}
              prefix={<FileTextOutlined style={{ color: '#A855F7' }} />}
              valueStyle={{ color: '#A855F7', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card
            bordered
            style={{
              borderRadius: 8,
              background: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            }}
          >
            <Statistic
              title={<span style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 12 }}>Bills, Vendors &amp; Assets</span>}
              value={counts.billing + counts.vendor + counts.driver + counts.container}
              prefix={<ContainerOutlined style={{ color: '#10B981' }} />}
              valueStyle={{ color: '#10B981', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Table Card with Distinct Page Tabs */}
      <Card
        bordered
        style={{
          borderRadius: 8,
          background: isDark ? '#1E293B' : '#FFFFFF',
          borderColor: isDark ? '#334155' : '#E2E8F0',
        }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          items={[
            {
              key: 'all',
              label: (
                <span>
                  All Deleted Items <Badge count={counts.total} overflowCount={999} style={{ backgroundColor: '#64748B', marginLeft: 4 }} />
                </span>
              ),
            },
            {
              key: 'vehicle',
              label: (
                <span>
                  <CarOutlined /> Vehicles (<code>vehicle-trashbin</code>){' '}
                  <Badge count={counts.vehicle} style={{ backgroundColor: '#3B82F6', marginLeft: 4 }} />
                </span>
              ),
            },
            {
              key: 'general-expense',
              label: (
                <span>
                  <DollarOutlined /> General Expense (<code>general-expense-trashbin</code>){' '}
                  <Badge count={counts.generalExpense} style={{ backgroundColor: '#06B6D4', marginLeft: 4 }} />
                </span>
              ),
            },
            {
              key: 'loading-expense',
              label: (
                <span>
                  <DollarOutlined /> Loading Expense (<code>loading-expense-trashbin</code>){' '}
                  <Badge count={counts.loadingExpense} style={{ backgroundColor: '#F59E0B', marginLeft: 4 }} />
                </span>
              ),
            },
            {
              key: 'daily-report',
              label: (
                <span>
                  <FileTextOutlined /> Daily Report (<code>daily-report-trashbin</code>){' '}
                  <Badge count={counts.dailyReport} style={{ backgroundColor: '#A855F7', marginLeft: 4 }} />
                </span>
              ),
            },
            {
              key: 'billing',
              label: (
                <span>
                  <ContainerOutlined /> Billing (<code>billing-trashbin</code>){' '}
                  <Badge count={counts.billing} style={{ backgroundColor: '#10B981', marginLeft: 4 }} />
                </span>
              ),
            },
            {
              key: 'vendor',
              label: (
                <span>
                  <TeamOutlined /> Vendors (<code>vendor-trashbin</code>){' '}
                  <Badge count={counts.vendor} style={{ backgroundColor: '#6366F1', marginLeft: 4 }} />
                </span>
              ),
            },
            {
              key: 'driver',
              label: (
                <span>
                  <UserOutlined /> Drivers (<code>driver-trashbin</code>){' '}
                  <Badge count={counts.driver} style={{ backgroundColor: '#EC4899', marginLeft: 4 }} />
                </span>
              ),
            },
            {
              key: 'container',
              label: (
                <span>
                  <ContainerOutlined /> Containers (<code>container-trashbin</code>){' '}
                  <Badge count={counts.container} style={{ backgroundColor: '#D97706', marginLeft: 4 }} />
                </span>
              ),
            },
          ]}
        />

        <Table
          dataSource={filteredItems}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ['15', '30', '50'] }}
          scroll={{ x: 1100 }}
          locale={{
            emptyText: (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <SafetyCertificateOutlined style={{ fontSize: 36, color: '#10B981', marginBottom: 12 }} />
                <div>
                  <Text strong style={{ fontSize: 15, color: isDark ? '#E2E8F0' : '#1E293B' }}>
                    Trashbin is Empty
                  </Text>
                </div>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  No deleted records found in this category. All active records are in place in your active sheets and master Excel.
                </Text>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
}
