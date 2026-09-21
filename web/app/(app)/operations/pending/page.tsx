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
  Alert,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
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

interface PendingRow {
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
    companyInTime?: string;
    companyOutTime?: string;
    portInTime?: string;
    portOutTime?: string;
    movementStatus?: string;
    shippingStatus?: string;
  };
}

export default function PendingJobsPage() {
  const [data, setData] = useState<PendingRow[]>([]);
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
  const [stage, setStage] = useState<string | undefined>();
  const [loadingType, setLoadingType] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  // Quick Complete modal with missing prerequisite helper
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PendingRow | null>(null);
  const [portOutTime, setPortOutTime] = useState<dayjs.Dayjs | null>(dayjs());
  const [completing, setCompleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchPendingJobs = useCallback(async () => {
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

      const res = await apiClient.get<any>(`/operations/pending?${query.toString()}`);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
      } else {
        message.error(res.data?.message || 'Failed to load pending jobs');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error fetching pending jobs');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortField, sortOrder, search, companyId, clientId, stage, loadingType, dateRange]);

  useEffect(() => {
    fetchPendingJobs();
  }, [fetchPendingJobs]);

  // Handle Mark Completed click
  const handleInitiateComplete = (record: PendingRow) => {
    setSelectedRecord(record);
    setErrorMessage(null);

    // If portOutTime already recorded and stage is PORT_MOVEMENT, prompt confirmation directly
    const hasPortOut = Boolean(record.movement?.portOutTime);
    if (hasPortOut && record.stage === 'PORT_MOVEMENT') {
      Modal.confirm({
        title: `Mark Job Completed: ${record.transactionNumber}?`,
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
        content: `Port Gate-Out was recorded at ${record.movement?.portOutTime}. Completing this job will auto-sync diesel & halting expenses and make it ready for billing.`,
        okText: 'Yes, Complete Job',
        okType: 'primary',
        onOk: async () => {
          try {
            const res = await apiClient.post<any>(`/enquiries/${record.id}/stage`, {
              toStage: 'COMPLETED',
              remarks: 'Marked Completed via Operations Control',
            });
            if (res.data?.success) {
              message.success(`Job ${record.transactionNumber} marked as COMPLETED!`);
              fetchPendingJobs();
            } else {
              message.error(res.data?.message || 'Failed to complete job');
            }
          } catch (err: any) {
            message.error(err.response?.data?.message || 'Failed to complete job');
          }
        },
      });
    } else {
      // Need portOutTime or step-by-step advance
      setPortOutTime(dayjs());
      setCompleteModalOpen(true);
    }
  };

  // Perform multi-step completion if needed (update portOutTime then move stage)
  const handleConfirmCompleteWithPortOut = async () => {
    if (!selectedRecord) return;
    setCompleting(true);
    setErrorMessage(null);

    try {
      // 1. If portOutTime not present on record, save it first
      if (portOutTime) {
        const timeFormatted = portOutTime.format('DD-MM-YYYY hh:mm A');
        const movRes = await apiClient.patch<any>(`/enquiries/${selectedRecord.id}/movement`, {
          portOutTime: timeFormatted,
          shippingStatus: 'COMPLETED',
          movementStatus: 'MOVED',
        });
        if (!movRes.data?.success) {
          throw new Error(movRes.data?.message || 'Failed to update Port Gate-Out time');
        }
      }

      // 2. Advance stage step-by-step if needed or directly to COMPLETED
      // If at ENQUIRY_CREATED, VEHICLE_ASSIGNED, etc., backend requires step by step:
      const stageChain = ['ENQUIRY_CREATED', 'VEHICLE_ASSIGNED', 'CONTAINER_MOVEMENT', 'PORT_MOVEMENT', 'COMPLETED'];
      const currentIdx = stageChain.indexOf(selectedRecord.stage);

      if (currentIdx < 0) {
        throw new Error(`Current stage ${selectedRecord.stage} cannot be completed.`);
      }

      // Step sequentially to COMPLETED
      for (let i = currentIdx + 1; i < stageChain.length; i++) {
        const targetStage = stageChain[i];
        const stepRes = await apiClient.post<any>(`/enquiries/${selectedRecord.id}/stage`, {
          toStage: targetStage,
          remarks: `Advanced towards completion via Operations Control (${targetStage})`,
        });

        if (!stepRes.data?.success) {
          throw new Error(stepRes.data?.message || `Failed to transition to ${targetStage}`);
        }
      }

      message.success(`Job ${selectedRecord.transactionNumber} successfully marked as COMPLETED!`);
      setCompleteModalOpen(false);
      fetchPendingJobs();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to mark job completed';
      setErrorMessage(msg);
    } finally {
      setCompleting(false);
    }
  };

  const columns: ColumnsType<PendingRow> = [
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
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 100,
      render: (d) => formatDate(d),
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
      title: 'Vehicle & Container',
      key: 'assets',
      width: 170,
      render: (_, rec) => (
        <div>
          <Text strong>{rec.vehicleNumber || 'No vehicle'}</Text>
          <div style={{ fontSize: 12, color: '#666' }}>{rec.containerNumber || 'No container'}</div>
        </div>
      ),
    },
    {
      title: 'Current Stage',
      dataIndex: 'stage',
      key: 'stage',
      width: 160,
      render: (s) => (
        <Tag color={STAGE_TAG_COLORS[s] || 'default'} style={{ fontWeight: 500 }}>
          {STAGE_LABELS[s] || s}
        </Tag>
      ),
    },
    {
      title: 'Factory Gate-Out',
      key: 'companyOut',
      width: 150,
      render: (_, rec) => formatDateTime(rec.movement?.companyOutTime) || <Text type="secondary">-</Text>,
    },
    {
      title: 'Port Gate-Out',
      key: 'portOut',
      width: 150,
      render: (_, rec) => formatDateTime(rec.movement?.portOutTime) || <Text type="secondary">Pending</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, rec) => (
        <Space size="small">
          <Tooltip title="Advance job to COMPLETED stage">
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleInitiateComplete(rec)}
              style={{ backgroundColor: '#52c41a' }}
            >
              Complete
            </Button>
          </Tooltip>

          <Tooltip title="View Details">
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
          { title: 'Pending Jobs' },
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
            <FieldTimeOutlined style={{ marginRight: 10, color: '#1677ff' }} />
            Pending Transport Jobs
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            All active jobs before completion. Mark completed jobs directly to trigger expense auto-sync and billing readiness.
          </Paragraph>
        </div>

        <Button icon={<ReloadOutlined />} onClick={fetchPendingJobs} loading={loading}>
          Refresh List
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
                fetchPendingJobs();
              }}
              allowClear
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
              options={[
                { value: 'ENQUIRY_CREATED', label: 'Created' },
                { value: 'VEHICLE_ASSIGNED', label: 'Vehicle Assigned' },
                { value: 'CONTAINER_MOVEMENT', label: 'Container Movement' },
                { value: 'PORT_MOVEMENT', label: 'Port Movement' },
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

      {/* Table */}
      <Card style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} bodyStyle={{ padding: 0 }}>
        <Table<PendingRow>
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1100 }}
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
            showTotal: (t) => `Pending jobs: ${t}`,
          }}
        />
      </Card>

      {/* Quick Mark Completed Modal */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span>Mark Completed: {selectedRecord?.transactionNumber}</span>
          </Space>
        }
        open={completeModalOpen}
        onCancel={() => {
          setCompleteModalOpen(false);
          setErrorMessage(null);
        }}
        onOk={handleConfirmCompleteWithPortOut}
        confirmLoading={completing}
        okText="Confirm Completion"
        width={550}
      >
        <div style={{ marginTop: 12 }}>
          {errorMessage && (
            <Alert
              message="Completion Error"
              description={errorMessage}
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Paragraph>
            Transport rules require a <strong>Port Gate-Out time</strong> to mark an enquiry as completed.
          </Paragraph>

          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              Port Gate-Out Timestamp:
            </Text>
            <Space.Compact style={{ width: '100%' }}>
              <DatePicker
                showTime
                format="DD-MM-YYYY hh:mm A"
                value={portOutTime}
                onChange={(val) => setPortOutTime(val)}
                style={{ width: '100%' }}
              />
              <Button onClick={() => setPortOutTime(dayjs())}>Now</Button>
            </Space.Compact>
          </div>

          <Alert
            message="What happens on completion?"
            description="Movement status becomes MOVED, shipping status becomes COMPLETED, and diesel & halting amounts are automatically synced to loading expenses."
            type="info"
            showIcon
          />
        </div>
      </Modal>
    </div>
  );
}
