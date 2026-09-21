'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Space,
  Tag,
  Card,
  Typography,
  Tooltip,
  message,
  Row,
  Col,
  Breadcrumb,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  FileDoneOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/api/client';
import { AsyncMasterSelect } from '@/components/common/AsyncMasterSelect';
import { formatDateTime, formatDate, formatCurrencyINR } from '@/lib/utils/format';
import { STAGE_TAG_COLORS, STAGE_LABELS } from '@/lib/utils/enquiryValidation';

const { Title, Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;

interface CompletedRow {
  id: string;
  enquiryNumber: number | string;
  transactionNumber: string;
  date: string;
  completedAt?: string;
  companyId: string;
  companyName?: string;
  clientId: string;
  clientName?: string;
  loadingType: 'Import' | 'Export';
  vehicleNumber?: string;
  driverInfo?: string;
  containerNumber?: string;
  stage: string;
  billId?: string;
  vendorFinance?: {
    totalPayable?: number;
    balance?: number;
  };
}

export default function CompletedJobsPage() {
  const [data, setData] = useState<CompletedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState('completedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filters
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState<string | undefined>();
  const [clientId, setClientId] = useState<string | undefined>();
  const [stage, setStage] = useState<string | undefined>();
  const [loadingType, setLoadingType] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  const fetchCompletedJobs = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        sortField,
        sortOrder,
      });

      if (search.trim()) query.set('search', search.trim());
      if (companyId) query.set('companyId', companyId);
      if (clientId) query.set('clientId', clientId);
      if (stage) query.set('stage', stage);
      if (loadingType) query.set('loadingType', loadingType);
      if (dateRange && dateRange[0] && dateRange[1]) {
        query.set('dateFrom', dateRange[0]);
        query.set('dateTo', dateRange[1]);
      }

      const res = await apiClient.get<any>(`/operations/completed?${query.toString()}`);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
      } else {
        message.error(res.data?.message || 'Failed to load completed jobs');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error fetching completed jobs');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortField, sortOrder, search, companyId, clientId, stage, loadingType, dateRange]);

  useEffect(() => {
    fetchCompletedJobs();
  }, [fetchCompletedJobs]);

  const columns: ColumnsType<CompletedRow> = [
    {
      title: 'Enquiry / TXN',
      key: 'job',
      width: 160,
      render: (_, rec) => (
        <div>
          <Link href={`/enquiries/${rec.id}`} style={{ fontWeight: 600 }}>
            {rec.id}
          </Link>
          <div style={{ fontSize: 12, color: '#666' }}>{rec.transactionNumber}</div>
        </div>
      ),
    },
    {
      title: 'Completed Date',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 150,
      render: (d) => (d ? formatDateTime(d) : <Text type="secondary">-</Text>),
    },
    {
      title: 'Client & Company',
      key: 'parties',
      ellipsis: true,
      render: (_, rec) => (
        <div>
          <Text strong>{rec.clientName || rec.clientId}</Text>
          <div style={{ fontSize: 12, color: '#888' }}>{rec.companyName || rec.companyId}</div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'loadingType',
      key: 'loadingType',
      width: 90,
      render: (t) => (
        <Tag color={t === 'Import' ? 'blue' : 'orange'} style={{ fontWeight: 500 }}>
          {t}
        </Tag>
      ),
    },
    {
      title: 'Vehicle & Container',
      key: 'assets',
      width: 160,
      render: (_, rec) => (
        <div>
          <Text strong>{rec.vehicleNumber || '-'}</Text>
          <div style={{ fontSize: 12, color: '#666' }}>{rec.containerNumber || '-'}</div>
        </div>
      ),
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      width: 140,
      render: (s) => (
        <Tag color={STAGE_TAG_COLORS[s] || 'default'} style={{ fontWeight: 500 }}>
          {STAGE_LABELS[s] || s}
        </Tag>
      ),
    },
    {
      title: 'Billing Status',
      key: 'billingStatus',
      width: 160,
      render: (_, rec) => {
        if (rec.billId) {
          return (
            <Tag color="green" icon={<FileDoneOutlined />}>
              Billed: {rec.billId}
            </Tag>
          );
        }
        return <Tag color="gold">Ready for Billing</Tag>;
      },
    },
    {
      title: 'Vendor Payable',
      key: 'vendorPayable',
      width: 130,
      align: 'right',
      render: (_, rec) => (
        <Text strong>{formatCurrencyINR(rec.vendorFinance?.totalPayable ?? 0)}</Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, rec) => (
        <Space size="small">
          <Tooltip title="View Enquiry Details">
            <Link href={`/enquiries/${rec.id}`}>
              <Button size="small" icon={<EyeOutlined />} />
            </Link>
          </Tooltip>

          {rec.billId ? (
            <Tooltip title={`View Bill ${rec.billId}`}>
              <Link href={`/billing/processed`}>
                <Button size="small" icon={<AuditOutlined />} type="dashed" />
              </Link>
            </Tooltip>
          ) : (
            <Tooltip title="Create Bill (Phase 13)">
              <Link href={`/billing/create?enquiryId=${rec.id}`}>
                <Button size="small" icon={<FileDoneOutlined />} />
              </Link>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 40 }}>
      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { title: <Link href="/dashboard">Dashboard</Link> },
          { title: 'Operations' },
          { title: 'Completed Jobs' },
        ]}
        style={{ marginBottom: 16 }}
      />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 20,
          gap: 16,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <CheckCircleOutlined style={{ marginRight: 10, color: '#52c41a' }} />
            Completed Transport Jobs
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            Archived and completed transport jobs ready for invoice aggregation and client billing.
          </Paragraph>
        </div>

        <Button icon={<ReloadOutlined />} onClick={fetchCompletedJobs} loading={loading}>
          Refresh List
        </Button>
      </div>

      {/* Filter Bar */}
      <Card style={{ marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Search TXN, vehicle, container..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={() => {
                setPage(1);
                fetchCompletedJobs();
              }}
              allowClear
            />
          </Col>

          <Col xs={24} sm={12} md={5}>
            <Select
              placeholder="Stage"
              value={stage}
              onChange={(val) => {
                setStage(val);
                setPage(1);
              }}
              allowClear
              style={{ width: '100%' }}
              options={[
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'BILLING', label: 'Billing' },
                { value: 'PROCESSED', label: 'Processed' },
              ]}
            />
          </Col>

          <Col xs={24} sm={12} md={6}>
            <AsyncMasterSelect
              entity="companies"
              placeholder="Filter Company..."
              value={companyId}
              onChange={(val) => {
                setCompanyId(val);
                setPage(1);
              }}
              allowClear
              showAddNew={false}
            />
          </Col>

          <Col xs={24} sm={12} md={7}>
            <AsyncMasterSelect
              entity="clients"
              placeholder="Filter Client..."
              value={clientId}
              onChange={(val) => {
                setClientId(val);
                setPage(1);
              }}
              allowClear
              showAddNew={false}
            />
          </Col>
        </Row>
      </Card>

      {/* Completed Table */}
      <Card style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} bodyStyle={{ padding: 0 }}>
        <Table<CompletedRow>
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          size="middle"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showTotal: (t) => `Completed jobs: ${t}`,
          }}
        />
      </Card>
    </div>
  );
}
