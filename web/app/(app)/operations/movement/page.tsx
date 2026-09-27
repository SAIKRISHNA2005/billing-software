'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
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
  Tabs,
  Alert,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  CarOutlined,
  ClockCircleOutlined,
  EditOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  ExclamationCircleOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { apiClient } from '@/lib/api/client';
import { AsyncMasterSelect } from '@/components/common/AsyncMasterSelect';
import { formatDateTime, formatDate, formatCurrencyINR } from '@/lib/utils/format';
import { STAGE_TAG_COLORS, STAGE_LABELS } from '@/lib/utils/enquiryValidation';
import { VehicleStatusToggle } from '@/components/common/VehicleStatusToggle';
import { ActionConfirmPopover } from '@/components/common/ActionConfirmPopover';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

// Types
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

function VehicleManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'movement';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab with URL
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    router.replace(`/operations/movement?tab=${key}`, { scroll: false });
  };

  // ==========================================
  // TAB 1: ALL / CURRENT MOVEMENT STATE
  // ==========================================
  const [movData, setMovData] = useState<MovementRow[]>([]);
  const [movLoading, setMovLoading] = useState(false);
  const [movTotal, setMovTotal] = useState(0);
  const [movPage, setMovPage] = useState(1);
  const [movPageSize, setMovPageSize] = useState(20);
  const [movSearch, setMovSearch] = useState('');
  const [movCompanyId, setMovCompanyId] = useState<string | undefined>();
  const [movClientId, setMovClientId] = useState<string | undefined>();
  const [movVendorId, setMovVendorId] = useState<string | undefined>();
  const [movLoadingType, setMovLoadingType] = useState<string | undefined>();
  const [movDateRange, setMovDateRange] = useState<[string, string] | null>(null);

  // Quick edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedMovRecord, setSelectedMovRecord] = useState<MovementRow | null>(null);
  const [submittingMov, setSubmittingMov] = useState(false);
  const [movForm] = Form.useForm();

  const fetchMovements = useCallback(async () => {
    setMovLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(movPage),
        limit: String(movPageSize),
        sortField: 'enquiryNumber',
        sortOrder: 'desc',
      });

      if (movSearch.trim()) query.set('search', movSearch.trim());
      if (movCompanyId) query.set('companyId', movCompanyId);
      if (movClientId) query.set('clientId', movClientId);
      if (movVendorId) query.set('vendorId', movVendorId);
      if (movLoadingType) query.set('loadingType', movLoadingType);
      if (movDateRange && movDateRange[0] && movDateRange[1]) {
        query.set('dateFrom', movDateRange[0]);
        query.set('dateTo', movDateRange[1]);
      }

      const res = await apiClient.get<any>(`/operations/movements?${query.toString()}`);
      if (res.data?.success && res.data?.data) {
        setMovData(res.data.data.items || []);
        setMovTotal(res.data.data.total || 0);
      }
    } catch {
      message.error('Error fetching vehicle movements');
    } finally {
      setMovLoading(false);
    }
  }, [movPage, movPageSize, movSearch, movCompanyId, movClientId, movVendorId, movLoadingType, movDateRange]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  const handleOpenEdit = (record: MovementRow) => {
    setSelectedMovRecord(record);
    const mov = record.movement || {};
    const timeKeys = ['companyInTime', 'companyOutTime', 'printInTime', 'printOutTime', 'portInTime', 'portOutTime'];
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
      }
    });

    movForm.setFieldsValue(initialVals);
    setEditModalOpen(true);
  };

  const handleSetNow = (fieldName: string) => {
    movForm.setFieldsValue({ [fieldName]: dayjs() });
  };

  const handleSaveMovement = async (values: any) => {
    if (!selectedMovRecord) return;
    setSubmittingMov(true);
    try {
      const payload: Record<string, any> = {
        movementStatus: values.movementStatus,
        shippingStatus: values.shippingStatus,
      };

      const timeKeys = ['companyInTime', 'companyOutTime', 'printInTime', 'printOutTime', 'portInTime', 'portOutTime'];
      timeKeys.forEach((k) => {
        if (values[k] && dayjs.isDayjs(values[k])) {
          payload[k] = values[k].format('DD-MM-YYYY hh:mm A');
        } else {
          payload[k] = '';
        }
      });

      const res = await apiClient.patch<any>(`/enquiries/${selectedMovRecord.id}/movement`, payload);
      if (res.data?.success) {
        message.success('Gate times & movement status updated successfully!');
        setEditModalOpen(false);
        fetchMovements();
      } else {
        message.error(res.data?.message || 'Failed to update movement status');
      }
    } catch {
      message.error('Error updating movement');
    } finally {
      setSubmittingMov(false);
    }
  };

  // ==========================================
  // TAB 2: PENDING JOBS STATE
  // ==========================================
  const [pendingData, setPendingData] = useState<PendingRow[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(20);
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingCompanyId, setPendingCompanyId] = useState<string | undefined>();
  const [pendingClientId, setPendingClientId] = useState<string | undefined>();
  const [pendingStage, setPendingStage] = useState<string | undefined>();

  // Complete job modal
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedPendingRecord, setSelectedPendingRecord] = useState<PendingRow | null>(null);
  const [portOutTime, setPortOutTime] = useState<dayjs.Dayjs | null>(dayjs());
  const [completing, setCompleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchPendingJobs = useCallback(async () => {
    setPendingLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(pendingPage),
        limit: String(pendingPageSize),
        sortField: 'enquiryNumber',
        sortOrder: 'desc',
      });

      if (pendingSearch.trim()) query.set('search', pendingSearch.trim());
      if (pendingCompanyId) query.set('companyId', pendingCompanyId);
      if (pendingClientId) query.set('clientId', pendingClientId);
      if (pendingStage) query.set('stage', pendingStage);

      const res = await apiClient.get<any>(`/operations/pending?${query.toString()}`);
      if (res.data?.success && res.data?.data) {
        setPendingData(res.data.data.items || []);
        setPendingTotal(res.data.data.total || 0);
      }
    } catch {
      message.error('Error fetching pending jobs');
    } finally {
      setPendingLoading(false);
    }
  }, [pendingPage, pendingPageSize, pendingSearch, pendingCompanyId, pendingClientId, pendingStage]);

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingJobs();
    }
  }, [activeTab, fetchPendingJobs]);

  const handleInitiateComplete = (record: PendingRow) => {
    setSelectedPendingRecord(record);
    setErrorMessage(null);

    const hasPortOut = Boolean(record.movement?.portOutTime);
    if (hasPortOut && record.stage === 'PORT_MOVEMENT') {
      Modal.confirm({
        title: `Mark Job Completed: ${record.transactionNumber}?`,
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
        content: `Port Gate-Out recorded at ${record.movement?.portOutTime}. Completing will auto-sync expenses and mark ready for billing.`,
        okText: 'Yes, Complete Job',
        okType: 'primary',
        onOk: async () => {
          try {
            const res = await apiClient.post<any>(`/enquiries/${record.id}/stage`, {
              toStage: 'COMPLETED',
              remarks: 'Marked Completed via Vehicle Management Control',
            });
            if (res.data?.success) {
              message.success(`Job ${record.transactionNumber} marked as COMPLETED!`);
              fetchPendingJobs();
              fetchMovements();
            } else {
              message.error(res.data?.message || 'Failed to complete job');
            }
          } catch {
            message.error('Failed to complete job');
          }
        },
      });
    } else {
      setPortOutTime(dayjs());
      setCompleteModalOpen(true);
    }
  };

  const handleConfirmCompleteWithPortOut = async () => {
    if (!selectedPendingRecord) return;
    setCompleting(true);
    setErrorMessage(null);

    try {
      if (portOutTime) {
        const timeFormatted = portOutTime.format('DD-MM-YYYY hh:mm A');
        await apiClient.patch<any>(`/enquiries/${selectedPendingRecord.id}/movement`, {
          portOutTime: timeFormatted,
          shippingStatus: 'COMPLETED',
          movementStatus: 'MOVED',
        });
      }

      const stageChain = ['ENQUIRY_CREATED', 'VEHICLE_ASSIGNED', 'CONTAINER_MOVEMENT', 'PORT_MOVEMENT', 'COMPLETED'];
      const currentIdx = stageChain.indexOf(selectedPendingRecord.stage);

      if (currentIdx < 0) {
        throw new Error(`Current stage ${selectedPendingRecord.stage} cannot be completed.`);
      }

      for (let i = currentIdx + 1; i < stageChain.length; i++) {
        const targetStage = stageChain[i];
        const stepRes = await apiClient.post<any>(`/enquiries/${selectedPendingRecord.id}/stage`, {
          toStage: targetStage,
          remarks: `Advanced to ${targetStage} via Vehicle Management Control`,
        });

        if (!stepRes.data?.success) {
          throw new Error(stepRes.data?.message || `Failed to transition to ${targetStage}`);
        }
      }

      message.success(`Job ${selectedPendingRecord.transactionNumber} marked as COMPLETED!`);
      setCompleteModalOpen(false);
      fetchPendingJobs();
      fetchMovements();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to complete job');
    } finally {
      setCompleting(false);
    }
  };

  // ==========================================
  // TAB 3: COMPLETED JOBS STATE
  // ==========================================
  const [compData, setCompData] = useState<CompletedRow[]>([]);
  const [compLoading, setCompLoading] = useState(false);
  const [compTotal, setCompTotal] = useState(0);
  const [compPage, setCompPage] = useState(1);
  const [compPageSize, setCompPageSize] = useState(20);
  const [compSearch, setCompSearch] = useState('');
  const [compCompanyId, setCompCompanyId] = useState<string | undefined>();
  const [compClientId, setCompClientId] = useState<string | undefined>();

  const fetchCompletedJobs = useCallback(async () => {
    setCompLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(compPage),
        limit: String(compPageSize),
        sortField: 'completedAt',
        sortOrder: 'desc',
      });

      if (compSearch.trim()) query.set('search', compSearch.trim());
      if (compCompanyId) query.set('companyId', compCompanyId);
      if (compClientId) query.set('clientId', compClientId);

      const res = await apiClient.get<any>(`/operations/completed?${query.toString()}`);
      if (res.data?.success && res.data?.data) {
        setCompData(res.data.data.items || []);
        setCompTotal(res.data.data.total || 0);
      }
    } catch {
      message.error('Error fetching completed jobs');
    } finally {
      setCompLoading(false);
    }
  }, [compPage, compPageSize, compSearch, compCompanyId, compClientId]);

  useEffect(() => {
    if (activeTab === 'completed') {
      fetchCompletedJobs();
    }
  }, [activeTab, fetchCompletedJobs]);

  // Movement Columns
  const movColumns: ColumnsType<MovementRow> = [
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
      width: 240,
      render: (_, rec) => (
        <div style={{ minWidth: 200, wordBreak: 'break-word', whiteSpace: 'normal' }}>
          <Text strong style={{ display: 'block', color: '#1f1f1f', fontSize: 13 }}>
            {rec.clientName || rec.clientId || '-'}
          </Text>
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
            {rec.companyName || rec.companyId || '-'}
          </div>
        </div>
      ),
    },
    {
      title: 'Vehicle & Driver',
      key: 'vehicle',
      width: 180,
      render: (_, rec) => (
        <div>
          <Tag color="blue">{rec.vehicleNumber || 'Unassigned'}</Tag>
          {rec.driverInfo && <div style={{ fontSize: 12, color: '#666' }}>{rec.driverInfo}</div>}
        </div>
      ),
    },
    {
      title: 'Vehicle Status',
      key: 'vehicleStatus',
      width: 130,
      align: 'center' as const,
      render: (_, rec) => (
        <VehicleStatusToggle
          vehicleNumber={rec.vehicleNumber}
          enquiryId={rec.id}
        />
      ),
    },
    {
      title: 'Container & Seal',
      key: 'container',
      width: 160,
      render: (_, rec) => (
        <div>
          <div>{rec.containerNumber || '-'}</div>
          {rec.sealNumber && <div style={{ fontSize: 12, color: '#666' }}>Seal: {rec.sealNumber}</div>}
        </div>
      ),
    },
    {
      title: 'Gate Status',
      key: 'gateTimes',
      width: 220,
      render: (_, rec) => {
        const mov = rec.movement || {};
        return (
          <Space direction="vertical" size={2} style={{ fontSize: 12 }}>
            <div>
              <Text type="secondary">Co: </Text>
              <span>{mov.companyInTime ? 'In' : '-'} / {mov.companyOutTime ? 'Out' : '-'}</span>
            </div>
            <div>
              <Text type="secondary">Port: </Text>
              <span>{mov.portInTime ? 'In' : '-'} / {mov.portOutTime ? 'Out' : '-'}</span>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Movement Status',
      key: 'movementStatus',
      width: 130,
      align: 'center',
      render: (_, rec) => (
        <Tag color={rec.movement?.movementStatus === 'MOVED' ? 'green' : 'orange'}>
          {rec.movement?.movementStatus || 'NOT_MOVED'}
        </Tag>
      ),
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      width: 150,
      render: (st: string) => (
        <Tag color={STAGE_TAG_COLORS[st] || 'default'}>{STAGE_LABELS[st] || st}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Update Gate Times">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#1677ff' }} />}
              onClick={() => handleOpenEdit(record)}
            />
          </Tooltip>
          <Tooltip title="View Consignment Details">
            <Link href={`/enquiries/${record.id}`}>
              <Button type="text" icon={<EyeOutlined />} />
            </Link>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Pending Columns
  const pendingColumns: ColumnsType<PendingRow> = [
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
      width: 240,
      render: (_, rec) => (
        <div style={{ minWidth: 200, wordBreak: 'break-word', whiteSpace: 'normal' }}>
          <Text strong style={{ display: 'block', color: '#1f1f1f', fontSize: 13 }}>
            {rec.clientName || rec.clientId || '-'}
          </Text>
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
            {rec.companyName || rec.companyId || '-'}
          </div>
        </div>
      ),
    },
    {
      title: 'Vehicle',
      dataIndex: 'vehicleNumber',
      key: 'vehicleNumber',
      width: 130,
      render: (v) => <Tag color="blue">{v || 'N/A'}</Tag>,
    },
    {
      title: 'Vehicle Status',
      key: 'vehicleStatus',
      width: 130,
      align: 'center' as const,
      render: (_, rec) => (
        <VehicleStatusToggle
          vehicleNumber={rec.vehicleNumber}
          enquiryId={rec.id}
        />
      ),
    },
    {
      title: 'Container',
      dataIndex: 'containerNumber',
      key: 'containerNumber',
      width: 130,
      render: (c) => c || '-',
    },
    {
      title: 'Current Stage',
      dataIndex: 'stage',
      key: 'stage',
      width: 160,
      render: (st: string) => (
        <Tag color={STAGE_TAG_COLORS[st] || 'default'}>{STAGE_LABELS[st] || st}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <ActionConfirmPopover
            title="Mark Consignment Completed?"
            description={`Advance consignment ${record.transactionNumber || record.id} to COMPLETED state and finalize movement.`}
            okText="Yes, Complete"
            cancelText="No, Cancel"
            onConfirm={() => handleInitiateComplete(record)}
          >
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
            >
              Complete
            </Button>
          </ActionConfirmPopover>
          <Tooltip title="View Consignment">
            <Link href={`/enquiries/${record.id}`}>
              <Button type="text" size="small" icon={<EyeOutlined />} />
            </Link>
          </Tooltip>
          <Tooltip title="Edit Consignment">
            <Link href={`/enquiries/${record.id}`}>
              <Button type="text" size="small" icon={<EditOutlined style={{ color: '#1677ff' }} />} />
            </Link>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Completed Columns
  const compColumns: ColumnsType<CompletedRow> = [
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
      width: 120,
      render: (d) => (d ? formatDate(d) : '-'),
    },
    {
      title: 'Client & Company',
      key: 'parties',
      width: 240,
      render: (_, rec) => (
        <div style={{ minWidth: 200, wordBreak: 'break-word', whiteSpace: 'normal' }}>
          <Text strong style={{ display: 'block', color: '#1f1f1f', fontSize: 13 }}>
            {rec.clientName || rec.clientId || '-'}
          </Text>
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
            {rec.companyName || rec.companyId || '-'}
          </div>
        </div>
      ),
    },
    {
      title: 'Vehicle',
      dataIndex: 'vehicleNumber',
      key: 'vehicleNumber',
      width: 130,
      render: (v) => <Tag color="blue">{v || 'N/A'}</Tag>,
    },
    {
      title: 'Container',
      dataIndex: 'containerNumber',
      key: 'containerNumber',
      width: 130,
      render: (c) => c || '-',
    },
    {
      title: 'Billing Status',
      key: 'billing',
      width: 130,
      align: 'center',
      render: (_, rec) =>
        rec.billId ? (
          <Tag color="green">Billed</Tag>
        ) : (
          <Tag color="orange">Pending Bill</Tag>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Consignment">
            <Link href={`/enquiries/${record.id}`}>
              <Button type="text" size="small" icon={<EyeOutlined />} />
            </Link>
          </Tooltip>
          <Tooltip title="Edit Consignment">
            <Link href={`/enquiries/${record.id}`}>
              <Button type="text" size="small" icon={<EditOutlined style={{ color: '#1677ff' }} />} />
            </Link>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Top Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24, gap: 12 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            <CarOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Vehicle Management
          </Title>
          <Text type="secondary">
            Operational vehicle tracking, gate timestamps, pending operational consignments, and completed jobs
          </Text>
        </Col>
        <Col>
          <Space wrap>
            <Link href="/enquiries/new">
              <Button type="primary" icon={<PlusOutlined />}>
                Add Enquiry
              </Button>
            </Link>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                if (activeTab === 'movement') fetchMovements();
                else if (activeTab === 'pending') fetchPendingJobs();
                else if (activeTab === 'completed') fetchCompletedJobs();
              }}
            >
              Refresh
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Main Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        type="card"
        items={[
          {
            key: 'movement',
            label: (
              <span>
                <CarOutlined style={{ marginRight: 6 }} />
                Current / All Movement ({movTotal})
              </span>
            ),
            children: (
              <div>
                {/* Movement Filters */}
                <Card bordered={false} style={{ marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={12} md={6}>
                      <Input
                        placeholder="Search vehicle, container, driver..."
                        prefix={<SearchOutlined />}
                        value={movSearch}
                        onChange={(e) => setMovSearch(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col xs={24} sm={12} md={5}>
                      <AsyncMasterSelect
                        entity="companies"
                        entityLabel="Company"
                        placeholder="Filter Company"
                        value={movCompanyId}
                        onChange={(val) => setMovCompanyId(val)}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={5}>
                      <AsyncMasterSelect
                        entity="clients"
                        entityLabel="Client"
                        placeholder="Filter Client"
                        value={movClientId}
                        onChange={(val) => setMovClientId(val)}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={4}>
                      <Select
                        placeholder="Loading Type"
                        style={{ width: '100%' }}
                        allowClear
                        value={movLoadingType}
                        onChange={(val) => setMovLoadingType(val)}
                      >
                        <Select.Option value="Import">Import</Select.Option>
                        <Select.Option value="Export">Export</Select.Option>
                      </Select>
                    </Col>
                    <Col xs={24} sm={12} md={4}>
                      <Button
                        onClick={() => {
                          setMovSearch('');
                          setMovCompanyId(undefined);
                          setMovClientId(undefined);
                          setMovVendorId(undefined);
                          setMovLoadingType(undefined);
                          setMovDateRange(null);
                        }}
                      >
                        Reset
                      </Button>
                    </Col>
                  </Row>
                </Card>

                {/* Table */}
                <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Table
                    columns={movColumns}
                    dataSource={movData}
                    rowKey="id"
                    loading={movLoading}
                    scroll={{ x: 1550 }}
                    pagination={{
                      current: movPage,
                      pageSize: movPageSize,
                      total: movTotal,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50'],
                      onChange: (p, ps) => {
                        setMovPage(p);
                        setMovPageSize(ps);
                      },
                      showTotal: (total) => `Total ${total} active vehicle movements`,
                    }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'pending',
            label: (
              <span>
                <ClockCircleOutlined style={{ marginRight: 6 }} />
                Pending Jobs ({pendingTotal})
              </span>
            ),
            children: (
              <div>
                {/* Pending Filters */}
                <Card bordered={false} style={{ marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={12} md={6}>
                      <Input
                        placeholder="Search vehicle, enquiry, container..."
                        prefix={<SearchOutlined />}
                        value={pendingSearch}
                        onChange={(e) => setPendingSearch(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <AsyncMasterSelect
                        entity="companies"
                        entityLabel="Company"
                        placeholder="Filter Company"
                        value={pendingCompanyId}
                        onChange={(val) => setPendingCompanyId(val)}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <AsyncMasterSelect
                        entity="clients"
                        entityLabel="Client"
                        placeholder="Filter Client"
                        value={pendingClientId}
                        onChange={(val) => setPendingClientId(val)}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Button
                        onClick={() => {
                          setPendingSearch('');
                          setPendingCompanyId(undefined);
                          setPendingClientId(undefined);
                          setPendingStage(undefined);
                        }}
                      >
                        Reset
                      </Button>
                    </Col>
                  </Row>
                </Card>

                {/* Table */}
                <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Table
                    columns={pendingColumns}
                    dataSource={pendingData}
                    rowKey="id"
                    loading={pendingLoading}
                    scroll={{ x: 1250 }}
                    pagination={{
                      current: pendingPage,
                      pageSize: pendingPageSize,
                      total: pendingTotal,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50'],
                      onChange: (p, ps) => {
                        setPendingPage(p);
                        setPendingPageSize(ps);
                      },
                      showTotal: (total) => `Total ${total} pending consignments`,
                    }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'completed',
            label: (
              <span>
                <FileDoneOutlined style={{ marginRight: 6 }} />
                Completed Jobs ({compTotal})
              </span>
            ),
            children: (
              <div>
                {/* Completed Filters */}
                <Card bordered={false} style={{ marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={12} md={8}>
                      <Input
                        placeholder="Search vehicle, enquiry, container..."
                        prefix={<SearchOutlined />}
                        value={compSearch}
                        onChange={(e) => setCompSearch(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <AsyncMasterSelect
                        entity="companies"
                        entityLabel="Company"
                        placeholder="Filter Company"
                        value={compCompanyId}
                        onChange={(val) => setCompCompanyId(val)}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <AsyncMasterSelect
                        entity="clients"
                        entityLabel="Client"
                        placeholder="Filter Client"
                        value={compClientId}
                        onChange={(val) => setCompClientId(val)}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={4}>
                      <Button
                        onClick={() => {
                          setCompSearch('');
                          setCompCompanyId(undefined);
                          setCompClientId(undefined);
                        }}
                      >
                        Reset
                      </Button>
                    </Col>
                  </Row>
                </Card>

                {/* Table */}
                <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Table
                    columns={compColumns}
                    dataSource={compData}
                    rowKey="id"
                    loading={compLoading}
                    scroll={{ x: 1450 }}
                    pagination={{
                      current: compPage,
                      pageSize: compPageSize,
                      total: compTotal,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50'],
                      onChange: (p, ps) => {
                        setCompPage(p);
                        setCompPageSize(ps);
                      },
                      showTotal: (total) => `Total ${total} completed consignments`,
                    }}
                  />
                </Card>
              </div>
            ),
          },
        ]}
      />

      {/* Quick Edit Gate Times Modal */}
      <Modal
        title={`Update Gate Times & Status — ${selectedMovRecord?.transactionNumber || selectedMovRecord?.id}`}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        width={680}
        footer={[
          <Button key="cancel" onClick={() => setEditModalOpen(false)}>
            Cancel
          </Button>,
          <ActionConfirmPopover
            key="save"
            title="Save Gate Movement Changes?"
            description="Confirm updating factory, print, and port gate timestamps."
            okText="Yes, Save"
            cancelText="No, Cancel"
            onConfirm={() => movForm.submit()}
            loading={submittingMov}
          >
            <Button type="primary" loading={submittingMov}>
              Save Gate Times
            </Button>
          </ActionConfirmPopover>,
        ]}
      >
        <Form form={movForm} layout="vertical" onFinish={handleSaveMovement} style={{ marginTop: 16 }}>
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

      {/* Quick Complete Pending Job Modal */}
      <Modal
        title={`Complete Consignment: ${selectedPendingRecord?.transactionNumber || selectedPendingRecord?.id}`}
        open={completeModalOpen}
        onCancel={() => setCompleteModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setCompleteModalOpen(false)}>
            Cancel
          </Button>,
          <ActionConfirmPopover
            key="complete"
            title="Confirm Job Completion?"
            description="This will register Port Gate-Out time and advance consignment to COMPLETED state."
            okText="Yes, Complete Job"
            cancelText="No, Cancel"
            onConfirm={handleConfirmCompleteWithPortOut}
            loading={completing}
          >
            <Button type="primary" loading={completing} icon={<CheckCircleOutlined />}>
              Confirm & Mark Completed
            </Button>
          </ActionConfirmPopover>,
        ]}
      >
        <div style={{ marginTop: 12 }}>
          {errorMessage && (
            <Alert
              message={errorMessage}
              type="error"
              showIcon
              icon={<ExclamationCircleOutlined />}
              style={{ marginBottom: 16 }}
            />
          )}

          <Paragraph>
            Current Stage: <Tag color="blue">{selectedPendingRecord?.stage}</Tag>
          </Paragraph>

          <Form layout="vertical">
            <Form.Item label="Port Gate-Out Timestamp" required>
              <Space.Compact style={{ width: '100%' }}>
                <DatePicker
                  showTime
                  format="DD-MM-YYYY hh:mm A"
                  value={portOutTime}
                  onChange={(d) => setPortOutTime(d)}
                  style={{ width: '100%' }}
                />
                <Button onClick={() => setPortOutTime(dayjs())}>Now</Button>
              </Space.Compact>
            </Form.Item>
          </Form>

          <Alert
            message="Auto-Advancement to COMPLETED"
            description="Saving will register Port Gate-Out time and advance the consignment through prerequisites to COMPLETED, updating auto-synced diesel and halting expense entries."
            type="info"
            showIcon
          />
        </div>
      </Modal>
    </div>
  );
}

export default function VehicleManagementPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}><Text type="secondary">Loading Vehicle Management...</Text></div>}>
      <VehicleManagementContent />
    </Suspense>
  );
}
