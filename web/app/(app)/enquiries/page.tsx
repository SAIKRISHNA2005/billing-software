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
  Popconfirm,
  message,
  Row,
  Col,
  Breadcrumb,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  FilterOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/api/client';
import { AsyncMasterSelect } from '@/components/common/AsyncMasterSelect';
import { formatCurrencyINR, formatDate } from '@/lib/utils/format';
import { STAGE_TAG_COLORS, STAGE_LABELS } from '@/lib/utils/enquiryValidation';

const { Title, Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;

interface EnquiryRow {
  id: string;
  enquiryNumber: number | string;
  transactionNumber: string;
  date: string;
  companyId: string;
  companyName?: string;
  clientId: string;
  clientName?: string;
  loadingType: 'Import' | 'Export';
  vehicleId?: string;
  vehicleNumber?: string;
  driverId?: string;
  driverInfo?: string;
  containerId?: string;
  containerNumber?: string;
  sealNumber?: string;
  stage: string;
  billId?: string;
  movement?: {
    movementStatus?: string;
    shippingStatus?: string;
  };
  vendorFinance?: {
    totalPayable?: number;
    balance?: number;
  };
}

export default function EnquiriesListPage() {
  const router = useRouter();

  // Table Data State
  const [data, setData] = useState<EnquiryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // Pagination & Sorting State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortField, setSortField] = useState('enquiryNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter States
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState<string | undefined>();
  const [clientId, setClientId] = useState<string | undefined>();
  const [vendorId, setVendorId] = useState<string | undefined>();
  const [loadingType, setLoadingType] = useState<string | undefined>();
  const [stage, setStage] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  // Fetch enquiries
  const fetchEnquiries = useCallback(async () => {
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
      if (vendorId) query.set('vendorId', vendorId);
      if (loadingType) query.set('loadingType', loadingType);
      if (stage) query.set('stage', stage);
      if (dateRange && dateRange[0] && dateRange[1]) {
        query.set('dateFrom', dateRange[0]);
        query.set('dateTo', dateRange[1]);
      }

      const res = await apiClient.get<any>(`/enquiries?${query.toString()}`);
      if (res.data.success && res.data.data) {
        setData(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
      } else {
        message.error(res.data.message || 'Failed to load enquiries');
      }
    } catch (err: any) {
      console.error('Fetch enquiries error', err);
      message.error(err.response?.data?.message || 'Error fetching enquiries');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortField, sortOrder, search, companyId, clientId, vendorId, loadingType, stage, dateRange]);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  // Handle Delete
  const handleDelete = async (id: string, record: EnquiryRow) => {
    if (record.billId || record.stage === 'BILLING' || record.stage === 'PROCESSED') {
      message.error('Cannot delete: This enquiry is already linked to a bill or processed.');
      return;
    }

    try {
      const res = await apiClient.delete<any>(`/enquiries/${id}`);
      if (res.data.success) {
        message.success(`Enquiry ${record.transactionNumber || id} deleted successfully`);
        fetchEnquiries();
      } else {
        message.error(res.data.message || 'Failed to delete enquiry');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to delete enquiry');
    }
  };

  const resetFilters = () => {
    setSearch('');
    setCompanyId(undefined);
    setClientId(undefined);
    setVendorId(undefined);
    setLoadingType(undefined);
    setStage(undefined);
    setDateRange(null);
    setPage(1);
  };

  // Table Columns Definition
  const columns: ColumnsType<EnquiryRow> = [
    {
      title: 'Enquiry ID',
      dataIndex: 'enquiryNumber',
      key: 'enquiryNumber',
      width: 110,
      sorter: true,
      render: (enqNo, record) => (
        <Link href={`/enquiries/${record.id}`} style={{ fontWeight: 600 }}>
          {`ENQ-${enqNo}`}
        </Link>
      ),
    },
    {
      title: 'TXN No',
      dataIndex: 'transactionNumber',
      key: 'transactionNumber',
      width: 170,
      render: (val, record) => (
        <Text copyable style={{ fontSize: 13 }}>
          {val || '-'}
        </Text>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (d) => formatDate(d),
    },
    {
      title: 'Company',
      dataIndex: 'companyName',
      key: 'companyName',
      ellipsis: true,
      render: (name, rec) => name || rec.companyId,
    },
    {
      title: 'Client',
      dataIndex: 'clientName',
      key: 'clientName',
      ellipsis: true,
      render: (name, rec) => name || rec.clientId,
    },
    {
      title: 'Type',
      dataIndex: 'loadingType',
      key: 'loadingType',
      width: 90,
      render: (type) => (
        <Tag color={type === 'Import' ? 'blue' : 'orange'} style={{ fontWeight: 500 }}>
          {type}
        </Tag>
      ),
    },
    {
      title: 'Vehicle',
      dataIndex: 'vehicleNumber',
      key: 'vehicleNumber',
      width: 130,
      render: (veh) => (veh ? <Text strong>{veh}</Text> : <Text type="secondary">-</Text>),
    },
    {
      title: 'Container',
      dataIndex: 'containerNumber',
      key: 'containerNumber',
      width: 130,
      render: (con) => con || <Text type="secondary">-</Text>,
    },
    {
      title: 'Driver',
      dataIndex: 'driverInfo',
      key: 'driverInfo',
      ellipsis: true,
      render: (drv) => drv || <Text type="secondary">-</Text>,
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      width: 150,
      render: (s) => (
        <Tag color={STAGE_TAG_COLORS[s] || 'default'} style={{ fontWeight: 500 }}>
          {STAGE_LABELS[s] || s}
        </Tag>
      ),
    },
    {
      title: 'Movement',
      key: 'movementStatus',
      width: 110,
      render: (_, rec) => {
        const movStatus = rec.movement?.movementStatus || 'NOT_MOVED';
        return (
          <Tag color={movStatus === 'MOVED' ? 'green' : 'default'}>
            {movStatus === 'MOVED' ? 'Moved' : 'Not Moved'}
          </Tag>
        );
      },
    },
    {
      title: 'Shipping',
      key: 'shippingStatus',
      width: 120,
      render: (_, rec) => {
        const shipStatus = rec.movement?.shippingStatus || 'PENDING';
        let color = 'default';
        if (shipStatus === 'IN_PROGRESS') color = 'blue';
        if (shipStatus === 'COMPLETED') color = 'green';
        return <Tag color={color}>{shipStatus}</Tag>;
      },
    },
    {
      title: 'Vendor Payable',
      key: 'vendorPayable',
      width: 130,
      align: 'right',
      render: (_, rec) => {
        const val = rec.vendorFinance?.totalPayable ?? 0;
        return <Text strong>{formatCurrencyINR(val)}</Text>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => {
        const isBilled = record.billId || record.stage === 'BILLING' || record.stage === 'PROCESSED';

        return (
          <Space size="small">
            <Tooltip title="View Details">
              <Button
                type="text"
                icon={<EyeOutlined />}
                size="small"
                onClick={() => router.push(`/enquiries/${record.id}`)}
              />
            </Tooltip>

            <Tooltip title="Edit Enquiry">
              <Button
                type="text"
                icon={<EditOutlined />}
                size="small"
                onClick={() => router.push(`/enquiries/${record.id}/edit`)}
              />
            </Tooltip>

            <Tooltip title={isBilled ? 'Cannot delete billed enquiry' : 'Delete Enquiry'}>
              <Popconfirm
                title="Delete this enquiry?"
                description="This will soft-delete the transport enquiry and linked movement records."
                onConfirm={() => handleDelete(record.id, record)}
                okText="Yes, Delete"
                okType="danger"
                disabled={Boolean(isBilled)}
              >
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  disabled={Boolean(isBilled)}
                />
              </Popconfirm>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 40 }}>
      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { title: <Link href="/dashboard">Dashboard</Link> },
          { title: 'Enquiries' },
          { title: 'View / Edit' },
        ]}
        style={{ marginBottom: 16 }}
      />

      {/* Page Header */}
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
            <FileTextOutlined style={{ marginRight: 10, color: '#1677ff' }} />
            Transport Enquiries
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            Manage and track end-to-end transport jobs across all 7 operational stages.
          </Paragraph>
        </div>

        <Link href="/enquiries/new">
          <Button type="primary" icon={<PlusOutlined />} size="large">
            Add New Enquiry
          </Button>
        </Link>
      </div>

      {/* FILTER & SEARCH BAR */}
      <Card style={{ marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Search Enquiry, TXN, Vehicle, Driver..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={() => {
                setPage(1);
                fetchEnquiries();
              }}
              allowClear
            />
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="Loading Type"
              value={loadingType}
              onChange={(val) => {
                setLoadingType(val);
                setPage(1);
              }}
              allowClear
              style={{ width: '100%' }}
              options={[
                { value: 'Import', label: 'Import' },
                { value: 'Export', label: 'Export' },
              ]}
            />
          </Col>

          <Col xs={24} sm={12} md={5}>
            <Select
              placeholder="Filter by Stage"
              value={stage}
              onChange={(val) => {
                setStage(val);
                setPage(1);
              }}
              allowClear
              style={{ width: '100%' }}
              options={Object.entries(STAGE_LABELS).map(([k, v]) => ({
                value: k,
                label: v,
              }))}
            />
          </Col>

          <Col xs={24} sm={12} md={5}>
            <RangePicker
              format="DD-MM-YYYY"
              style={{ width: '100%' }}
              onChange={(_, dateStrings) => {
                if (dateStrings[0] && dateStrings[1]) {
                  setDateRange([dateStrings[0], dateStrings[1]]);
                } else {
                  setDateRange(null);
                }
                setPage(1);
              }}
            />
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button icon={<ReloadOutlined />} onClick={fetchEnquiries} loading={loading}>
                Refresh
              </Button>
              <Button onClick={resetFilters}>Reset</Button>
            </Space>
          </Col>
        </Row>

        {/* Secondary Master Data Filter Row */}
        <Row gutter={[16, 16]} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed #f0f0f0' }}>
          <Col xs={24} sm={8} md={8}>
            <AsyncMasterSelect
              entity="companies"
              placeholder="Filter by Company..."
              value={companyId}
              onChange={(val) => {
                setCompanyId(val);
                setPage(1);
              }}
              allowClear
              showAddNew={false}
            />
          </Col>

          <Col xs={24} sm={8} md={8}>
            <AsyncMasterSelect
              entity="clients"
              placeholder="Filter by Client..."
              value={clientId}
              onChange={(val) => {
                setClientId(val);
                setPage(1);
              }}
              allowClear
              showAddNew={false}
            />
          </Col>

          <Col xs={24} sm={8} md={8}>
            <AsyncMasterSelect
              entity="vendors"
              placeholder="Filter by Vendor..."
              value={vendorId}
              onChange={(val) => {
                setVendorId(val);
                setPage(1);
              }}
              allowClear
              showAddNew={false}
            />
          </Col>
        </Row>
      </Card>

      {/* ENQUIRIES DATA TABLE */}
      <Card style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} bodyStyle={{ padding: 0 }}>
        <Table<EnquiryRow>
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['15', '30', '50', '100'],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showTotal: (t, range) => `Showing ${range[0]}-${range[1]} of ${t} enquiries`,
          }}
          onChange={(_, __, sorter: any) => {
            if (sorter && sorter.field) {
              setSortField(sorter.field);
              setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
            }
          }}
        />
      </Card>
    </div>
  );
}
