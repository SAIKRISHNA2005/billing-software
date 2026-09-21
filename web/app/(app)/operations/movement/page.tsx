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
  Modal,
  Form,
  message,
  Row,
  Col,
  Breadcrumb,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  CarOutlined,
  ClockCircleOutlined,
  EditOutlined,
  EyeOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { apiClient } from '@/lib/api/client';
import { AsyncMasterSelect } from '@/components/common/AsyncMasterSelect';
import { formatDateTime, formatDate } from '@/lib/utils/format';
import { STAGE_TAG_COLORS, STAGE_LABELS } from '@/lib/utils/enquiryValidation';

const { Title, Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;

interface MovementRow {
  id: string;
  enquiryNumber: number | string;
  transactionNumber: string;
  date: string;
  companyId: string;
  companyName?: string;
  clientId: string;
  clientName?: string;
  loadingType: 'Import' | 'Export';
  vehicleNumber?: string;
  driverInfo?: string;
  containerNumber?: string;
  sealNumber?: string;
  stage: string;
  movement?: {
    id?: string;
    companyInTime?: string;
    companyOutTime?: string;
    printInTime?: string;
    printOutTime?: string;
    portInTime?: string;
    portOutTime?: string;
    movementStatus?: string;
    shippingStatus?: string;
  };
}

export default function VehicleMovementPage() {
  const [data, setData] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState('enquiryNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filters
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState<string | undefined>();
  const [clientId, setClientId] = useState<string | undefined>();
  const [vendorId, setVendorId] = useState<string | undefined>();
  const [loadingType, setLoadingType] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  // Inline quick-edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MovementRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Fetch active movements
  const fetchMovements = useCallback(async () => {
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
      if (dateRange && dateRange[0] && dateRange[1]) {
        query.set('dateFrom', dateRange[0]);
        query.set('dateTo', dateRange[1]);
      }

      const res = await apiClient.get<any>(`/operations/movements?${query.toString()}`);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
      } else {
        message.error(res.data?.message || 'Failed to load movements');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error fetching vehicle movements');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortField, sortOrder, search, companyId, clientId, vendorId, loadingType, dateRange]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  // Open quick-edit modal for row
  const handleOpenEdit = (record: MovementRow) => {
    setSelectedRecord(record);
    const mov = record.movement || {};
    const timeKeys = [
      'companyInTime',
      'companyOutTime',
      'printInTime',
      'printOutTime',
      'portInTime',
      'portOutTime',
    ];
    const initialVals: Record<string, any> = {
      movementStatus: mov.movementStatus || 'NOT_MOVED',
      shippingStatus: mov.shippingStatus || 'PENDING',
    };

    timeKeys.forEach((key) => {
      const val = mov[key as keyof typeof mov];
      if (val) {
        initialVals[key] = dayjs(val, 'DD-MM-YYYY hh:mm A').isValid()
          ? dayjs(val, 'DD-MM-YYYY hh:mm A')
          : dayjs(val).isValid()
          ? dayjs(val)
          : undefined;
      } else {
        initialVals[key] = undefined;
      }
    });

    form.setFieldsValue(initialVals);
    setEditModalOpen(true);
  };

  const handleSetNow = (fieldName: string) => {
    form.setFieldsValue({ [fieldName]: dayjs() });
  };

  // Save quick-edit gate times & statuses
  const handleSaveMovement = async (values: any) => {
    if (!selectedRecord) return;
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        movementStatus: values.movementStatus,
        shippingStatus: values.shippingStatus,
      };

      const timeKeys = [
        'companyInTime',
        'companyOutTime',
        'printInTime',
        'printOutTime',
        'portInTime',
        'portOutTime',
      ];

      timeKeys.forEach((k) => {
        if (values[k] && dayjs.isDayjs(values[k])) {
          payload[k] = values[k].format('DD-MM-YYYY hh:mm A');
        } else {
          payload[k] = '';
        }
      });

      const res = await apiClient.patch<any>(`/enquiries/${selectedRecord.id}/movement`, payload);
      if (res.data?.success) {
        message.success(`Movement times updated for ${selectedRecord.transactionNumber}`);
        setEditModalOpen(false);
        fetchMovements();
      } else {
        message.error(res.data?.message || 'Failed to update movement times');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error updating movement');
    } finally {
      setSubmitting(false);
    }
  };

  // Compact Table Columns
  const columns: ColumnsType<MovementRow> = [
    {
      title: 'Job / TXN',
      key: 'job',
      width: 150,
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
      title: 'Vehicle & Driver',
      key: 'vehicle',
      width: 160,
      render: (_, rec) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>
            {rec.vehicleNumber || '-'}
          </Text>
          {rec.driverInfo && (
            <div style={{ fontSize: 11, color: '#888' }} title={rec.driverInfo}>
              {rec.driverInfo}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Container / Seal',
      key: 'container',
      width: 140,
      render: (_, rec) => (
        <div>
          <div>{rec.containerNumber || '-'}</div>
          {rec.sealNumber && <div style={{ fontSize: 11, color: '#888' }}>Seal: {rec.sealNumber}</div>}
        </div>
      ),
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      width: 140,
      render: (s) => (
        <Tag color={STAGE_TAG_COLORS[s] || 'default'}>{STAGE_LABELS[s] || s}</Tag>
      ),
    },
    {
      title: 'Factory In / Out',
      key: 'factoryTimes',
      width: 160,
      render: (_, rec) => (
        <div style={{ fontSize: 12 }}>
          <div>
            <Text type="secondary">In:</Text> {formatDateTime(rec.movement?.companyInTime)}
          </div>
          <div>
            <Text type="secondary">Out:</Text> {formatDateTime(rec.movement?.companyOutTime)}
          </div>
        </div>
      ),
    },
    {
      title: 'Print In / Out',
      key: 'printTimes',
      width: 160,
      render: (_, rec) => (
        <div style={{ fontSize: 12 }}>
          <div>
            <Text type="secondary">In:</Text> {formatDateTime(rec.movement?.printInTime)}
          </div>
          <div>
            <Text type="secondary">Out:</Text> {formatDateTime(rec.movement?.printOutTime)}
          </div>
        </div>
      ),
    },
    {
      title: 'Port In / Out',
      key: 'portTimes',
      width: 160,
      render: (_, rec) => (
        <div style={{ fontSize: 12 }}>
          <div>
            <Text type="secondary">In:</Text> {formatDateTime(rec.movement?.portInTime)}
          </div>
          <div>
            <Text type="secondary">Out:</Text> {formatDateTime(rec.movement?.portOutTime)}
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, rec) => {
        const mov = rec.movement?.movementStatus || 'NOT_MOVED';
        const ship = rec.movement?.shippingStatus || 'PENDING';
        return (
          <Space direction="vertical" size={2}>
            <Tag color={mov === 'MOVED' ? 'green' : 'default'} style={{ margin: 0 }}>
              {mov}
            </Tag>
            <Tag
              color={ship === 'COMPLETED' ? 'green' : ship === 'IN_PROGRESS' ? 'blue' : 'default'}
              style={{ margin: 0 }}
            >
              {ship}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, rec) => (
        <Space size="small">
          <Tooltip title="Quick Edit Movement Times">
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(rec)}
            >
              Edit
            </Button>
          </Tooltip>
          <Tooltip title="View Full Enquiry">
            <Link href={`/enquiries/${rec.id}`}>
              <Button size="small" icon={<EyeOutlined />} />
            </Link>
          </Tooltip>
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
          { title: 'Vehicle Movement' },
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
            <CarOutlined style={{ marginRight: 10, color: '#1677ff' }} />
            Vehicle Movement Control Room
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            Track and update real-time factory, print, and port terminal gate-in/out times directly from the row.
          </Paragraph>
        </div>

        <Button icon={<ReloadOutlined />} onClick={fetchMovements} loading={loading}>
          Refresh Board
        </Button>
      </div>

      {/* Filter Bar */}
      <Card style={{ marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Search TXN, vehicle, container, driver..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={() => {
                setPage(1);
                fetchMovements();
              }}
              allowClear
            />
          </Col>

          <Col xs={24} sm={12} md={6}>
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

          <Col xs={24} sm={12} md={6}>
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

      {/* Compact Movements Table */}
      <Card style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} bodyStyle={{ padding: 0 }}>
        <Table<MovementRow>
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
            showTotal: (t) => `Active movements: ${t} jobs`,
          }}
        />
      </Card>

      {/* Inline Quick Edit Movement Modal */}
      <Modal
        title={
          <Space>
            <ClockCircleOutlined style={{ color: '#1677ff' }} />
            <span>
              Update Gate Times: {selectedRecord?.transactionNumber} ({selectedRecord?.vehicleNumber || 'No Vehicle'})
            </span>
          </Space>
        }
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={720}
        okText="Update Times"
      >
        <Form form={form} layout="vertical" onFinish={handleSaveMovement} style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Factory / Company Gate-In">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="companyInTime" noStyle>
                    <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                  </Form.Item>
                  <Button onClick={() => handleSetNow('companyInTime')}>Now</Button>
                </Space.Compact>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item label="Factory / Company Gate-Out">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="companyOutTime" noStyle>
                    <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                  </Form.Item>
                  <Button onClick={() => handleSetNow('companyOutTime')}>Now</Button>
                </Space.Compact>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item label="Print Gate-In">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="printInTime" noStyle>
                    <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                  </Form.Item>
                  <Button onClick={() => handleSetNow('printInTime')}>Now</Button>
                </Space.Compact>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item label="Print Gate-Out">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="printOutTime" noStyle>
                    <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                  </Form.Item>
                  <Button onClick={() => handleSetNow('printOutTime')}>Now</Button>
                </Space.Compact>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item label="Port Gate-In">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="portInTime" noStyle>
                    <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                  </Form.Item>
                  <Button onClick={() => handleSetNow('portInTime')}>Now</Button>
                </Space.Compact>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item label="Port Gate-Out">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="portOutTime" noStyle>
                    <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                  </Form.Item>
                  <Button onClick={() => handleSetNow('portOutTime')}>Now</Button>
                </Space.Compact>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name="movementStatus" label="Movement Status">
                <Select
                  options={[
                    { value: 'NOT_MOVED', label: 'NOT_MOVED' },
                    { value: 'MOVED', label: 'MOVED' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name="shippingStatus" label="Shipping Status">
                <Select
                  options={[
                    { value: 'PENDING', label: 'PENDING' },
                    { value: 'IN_PROGRESS', label: 'IN_PROGRESS' },
                    { value: 'COMPLETED', label: 'COMPLETED' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
