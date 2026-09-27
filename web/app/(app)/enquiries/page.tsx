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
import { ActionConfirmPopover } from '@/components/common/ActionConfirmPopover';
import { RecordDetailPopover } from '@/components/common/RecordDetailPopover';
import { VehicleStatusToggle } from '@/components/common/VehicleStatusToggle';
import axios from 'axios';

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
  loadingType: string;
  vehicleId?: string;
  vehicleNumber?: string;
  driverId?: string;
  driverInfo?: string;
  containerId?: string;
  containerNumber?: string;
  sealNumber?: string;
  freightAmount?: number;
  advanceAmount?: number;
  haltingAmount?: number;
  otherCharges?: number;
  weight?: string;
  shipmentDate?: string;
  stage: string;
  billId?: string;
  vehicleStatus?: boolean;
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
  const [vehicleStatusOverrides, setVehicleStatusOverrides] = useState<Record<string, boolean>>({});

  const handleToggleVehicleStatus = async (record: EnquiryRow, newStatus: boolean) => {
    setVehicleStatusOverrides((prev) => ({
      ...prev,
      [record.id]: newStatus,
    }));

    if (newStatus) {
      message.success(`Vehicle ${record.vehicleNumber ? record.vehicleNumber + ' ' : ''}marked as sent for work!`);
    } else {
      message.info(`Vehicle marked as not sent for work.`);
    }

    try {
      await axios.patch(`/api/enquiries/${record.id}/movement`, {
        movementStatus: newStatus ? 'MOVED' : 'NOT_MOVED',
        shippingStatus: newStatus ? 'IN_PROGRESS' : 'PENDING',
      }).catch(() => null);
    } catch {
      // non-blocking
    }
  };

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
        <RecordDetailPopover record={record} title={`Enquiry #ENQ-${enqNo}`}>
          <Link href={`/enquiries/${record.id}`} style={{ fontWeight: 600, color: '#1677ff' }}>
            {`ENQ-${enqNo}`}
          </Link>
        </RecordDetailPopover>
      ),
    },
    {
      title: 'TXN No',
      dataIndex: 'transactionNumber',
      key: 'transactionNumber',
      width: 170,
      responsive: ['xl'],
      render: (val, record) => (
        <RecordDetailPopover record={record} title={`TXN ${val || record.id}`}>
          <Text copyable style={{ fontSize: 13, cursor: 'pointer' }}>
            {val || '-'}
          </Text>
        </RecordDetailPopover>
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
      responsive: ['md'],
      render: (name, rec) => name || rec.companyId,
    },
    {
      title: 'Client',
      dataIndex: 'clientName',
      key: 'clientName',
      ellipsis: true,
      responsive: ['md'],
      render: (name, rec) => name || rec.clientId,
    },
    {
      title: 'Type',
      dataIndex: 'loadingType',
      key: 'loadingType',
      width: 90,
      responsive: ['sm'],
      render: (type) => (
        <Tag color={type === 'Import' ? 'blue' : type === 'Export' ? 'orange' : 'purple'} style={{ fontWeight: 500 }}>
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
      title: (
        <div style={{ textAlign: 'center' }}>
          <div>Vehicle Status</div>
          <div style={{ fontSize: 11, fontWeight: 'normal', color: '#6b7280' }}>Sent for work</div>
        </div>
      ),
      key: 'vehicleStatus',
      width: 140,
      align: 'center',
      render: (_, rec) => {
        const hasVehicle = Boolean(
          rec.vehicleNumber && rec.vehicleNumber !== '-' && String(rec.vehicleNumber).trim() !== ''
        );
        // Default to ON if vehicle details mentioned, OFF if not. User can toggle anytime.
        const isToggled =
          vehicleStatusOverrides[rec.id] !== undefined
            ? vehicleStatusOverrides[rec.id]
            : (rec.vehicleStatus !== undefined ? rec.vehicleStatus : hasVehicle);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <VehicleStatusToggle
              checked={isToggled}
              vehicleNumber={rec.vehicleNumber}
              onChange={(newVal) => handleToggleVehicleStatus(rec, newVal)}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.3,
                color: isToggled ? '#1677ff' : '#8c8c8c',
              }}
            >
              {isToggled ? 'SENT FOR WORK' : 'NOT ASSIGNED'}
            </span>
          </div>
        );
      },
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
      responsive: ['xl'],
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
      responsive: ['lg'],
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
      responsive: ['lg'],
      render: (_, rec) => {
        const shipStatus = rec.movement?.shippingStatus || 'PENDING';
        let color = 'default';
        if (shipStatus === 'IN_PROGRESS') color = 'blue';
        if (shipStatus === 'COMPLETED') color = 'green';
        return <Tag color={color}>{shipStatus}</Tag>;
      },
    },
    {
      title: 'Freight',
      dataIndex: 'freightAmount',
      key: 'freightAmount',
      width: 120,
      align: 'right',
      responsive: ['xxl'],
      render: (val) => (val ? formatCurrencyINR(val) : '-'),
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
            <RecordDetailPopover record={record} title={`Enquiry #ENQ-${record.enquiryNumber || record.id}`}>
              <Tooltip title="Quick View Popover">
                <Button
                  type="text"
                  icon={<EyeOutlined style={{ color: '#1677ff' }} />}
                  size="small"
                />
              </Tooltip>
            </RecordDetailPopover>

            <Tooltip title="Edit Enquiry">
              <Button
                type="text"
                icon={<EditOutlined style={{ color: '#52c41a' }} />}
                size="small"
                onClick={() => router.push(`/enquiries/${record.id}/edit`)}
              />
            </Tooltip>

            <Tooltip title={isBilled ? 'Cannot delete billed enquiry' : 'Delete Enquiry'}>
              <ActionConfirmPopover
                title="Delete this transport enquiry?"
                description="Are you sure you want to delete this enquiry? It will soft-delete the record and remove linked movements."
                okText="Yes, Delete"
                cancelText="No, Keep It"
                disabled={Boolean(isBilled)}
                onConfirm={() => handleDelete(record.id, record)}
              >
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  disabled={Boolean(isBilled)}
                />
              </ActionConfirmPopover>
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
          scroll={{ x: 1100 }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '12px 20px', backgroundColor: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                <Row gutter={[16, 12]}>
                  <Col xs={24} sm={12} md={6}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>TXN Number</Text>
                    <Text strong>{record.transactionNumber || '-'}</Text>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Company</Text>
                    <Text strong>{record.companyName || record.companyId || '-'}</Text>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Client</Text>
                    <Text strong>{record.clientName || record.clientId || '-'}</Text>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Driver Info</Text>
                    <Text strong>{record.driverInfo || '-'}</Text>
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Freight Amount</Text>
                    <Text strong>{formatCurrencyINR(record.freightAmount)}</Text>
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Advance Cash</Text>
                    <Text strong>{formatCurrencyINR(record.advanceAmount)}</Text>
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Halting Charges</Text>
                    <Text strong>{formatCurrencyINR(record.haltingAmount)}</Text>
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Other Charges</Text>
                    <Text strong>{formatCurrencyINR(record.otherCharges)}</Text>
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Vendor Payable</Text>
                    <Text strong style={{ color: '#389e0d' }}>{formatCurrencyINR(record.vendorFinance?.totalPayable)}</Text>
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Movement Status</Text>
                    <Tag>{record.movement?.movementStatus || 'NOT_MOVED'}</Tag>
                  </Col>
                </Row>
              </div>
            ),
            rowExpandable: () => true,
          }}
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
