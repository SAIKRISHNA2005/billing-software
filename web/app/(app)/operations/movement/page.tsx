'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
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
  Descriptions,
  Badge,
  Popconfirm,
  Statistic,
  Alert,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  CarOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ExclamationCircleOutlined,
  FileDoneOutlined,
  DownloadOutlined,
  DeleteOutlined,
  UploadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { VehicleStatusToggle } from '@/components/common/VehicleStatusToggle';
import { useSearchParams, useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import axios from 'axios';
import { exportToExcel } from '@/lib/utils/exportHelper';
import { useTheme } from '@/components/providers/ThemeContext';

import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;

export interface VehicleRecord {
  id: string;
  vehicleNumber: string;
  ownerName?: string;
  registeringAuthority?: string;
  vehicleClass?: string;
  fuelType?: string;
  emissionNorm?: string;
  vehicleAge?: string;
  hypothecated?: string;
  vehicleStatus?: string;
  registrationDate?: string;
  fitnessValidUpTo?: string;
  taxValidUpTo?: string;
  insuranceValidUpTo?: string;
  puccValidUpTo?: string;
  permitValidUpTo?: string;
  nationalPermitValidUpTo?: string;
  vehicleType?: string;
  vendorId?: string;
  active?: boolean | string;
  createdAt?: string;
  updatedAt?: string;
}

const VALIDITY_FIELDS = [
  { key: 'fitnessValidUpTo', label: 'Fitness Valid UpTo' },
  { key: 'taxValidUpTo', label: 'Tax Valid UpTo' },
  { key: 'insuranceValidUpTo', label: 'Insurance Valid UpTo' },
  { key: 'puccValidUpTo', label: 'PUCC Valid UpTo' },
  { key: 'permitValidUpTo', label: 'Permit Valid UpTo' },
  { key: 'nationalPermitValidUpTo', label: 'National Permit Valid UpTo' },
];

function VehicleManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightVehicleId = searchParams.get('vehicleId');
  const { themeMode } = useTheme();
  const isDark = themeMode === 'dark';

  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expiryFilter, setExpiryFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  // Modals
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleRecord | null>(null);

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // Documents Placeholder Modal
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docVehicle, setDocVehicle] = useState<VehicleRecord | null>(null);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/vehicles?limit=500');
      if (res.data?.success && res.data?.data) {
        const items: VehicleRecord[] = res.data.data.items || [];
        setVehicles(items);

        // If URL has vehicleId query param, auto-open details
        if (highlightVehicleId) {
          const match = items.find((v) => v.id === highlightVehicleId || v.vehicleNumber === highlightVehicleId);
          if (match) {
            setSelectedVehicle(match);
            setDetailsModalOpen(true);
          }
        }
      } else {
        message.error(res.data?.message || 'Failed to fetch vehicles');
      }
    } catch {
      message.error('Error connecting to backend for vehicles');
    } finally {
      setLoading(false);
    }
  }, [highlightVehicleId]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  // Check validity status for any date
  const checkValidity = (dateStr?: string) => {
    if (!dateStr || dateStr === '-' || dateStr.trim() === '') {
      return { status: 'none', days: 0, text: 'Not Available' };
    }
    const d = dayjs(dateStr);
    if (!d.isValid()) {
      return { status: 'none', days: 0, text: dateStr };
    }
    const today = dayjs().startOf('day');
    const target = d.startOf('day');
    const diffDays = target.diff(today, 'day');

    if (diffDays < 0) {
      return { status: 'expired', days: diffDays, text: `Expired (${Math.abs(diffDays)}d ago)` };
    }
    if (diffDays <= 3) {
      return { status: 'critical', days: diffDays, text: `Expiring in ${diffDays} day(s)` };
    }
    if (diffDays <= 30) {
      return { status: 'warning', days: diffDays, text: `${diffDays} days left` };
    }
    return { status: 'ok', days: diffDays, text: 'Valid' };
  };

  // Check if a vehicle has any critical/expired validity
  const getVehicleAlerts = (v: VehicleRecord) => {
    const alerts: Array<{ label: string; dateStr: string; status: string; days: number; text: string }> = [];
    VALIDITY_FIELDS.forEach((f) => {
      const val = v[f.key as keyof VehicleRecord] as string | undefined;
      if (val) {
        const res = checkValidity(val);
        if (res.status === 'expired' || res.status === 'critical') {
          alerts.push({
            label: f.label,
            dateStr: val,
            status: res.status,
            days: res.days,
            text: res.text,
          });
        }
      }
    });
    return alerts;
  };

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (statusFilter !== 'ALL') {
        const stat = (v.vehicleStatus || (v.active ? 'ACTIVE' : 'INACTIVE')).toUpperCase();
        if (statusFilter === 'ACTIVE' && stat !== 'ACTIVE') return false;
        if (statusFilter === 'INACTIVE' && stat !== 'INACTIVE') return false;
      }

      if (expiryFilter === 'ALERTS') {
        const alerts = getVehicleAlerts(v);
        if (alerts.length === 0) return false;
      } else if (expiryFilter === 'EXPIRED') {
        const alerts = getVehicleAlerts(v);
        if (!alerts.some((a) => a.status === 'expired')) return false;
      }

      if (searchText.trim()) {
        const q = searchText.toLowerCase().trim();
        const num = String(v.vehicleNumber || '').toLowerCase();
        const owner = String(v.ownerName || '').toLowerCase();
        const auth = String(v.registeringAuthority || '').toLowerCase();
        const vClass = String(v.vehicleClass || '').toLowerCase();
        if (!num.includes(q) && !owner.includes(q) && !auth.includes(q) && !vClass.includes(q)) {
          return false;
        }
      }

      if (dateRange && dateRange[0] && dateRange[1]) {
        const d = dayjs(v.registrationDate);
        if (d.isValid()) {
          if (d.isBefore(dateRange[0].startOf('day')) || d.isAfter(dateRange[1].endOf('day'))) {
            return false;
          }
        }
      }

      return true;
    });
  }, [vehicles, searchText, statusFilter, expiryFilter, dateRange]);

  // Overall Statistics
  const stats = useMemo(() => {
    let active = 0;
    let totalAlerts = 0;
    let expiredCount = 0;

    vehicles.forEach((v) => {
      const stat = (v.vehicleStatus || (v.active ? 'ACTIVE' : 'INACTIVE')).toUpperCase();
      if (stat === 'ACTIVE') active++;
      const alerts = getVehicleAlerts(v);
      if (alerts.length > 0) totalAlerts++;
      if (alerts.some((a) => a.status === 'expired')) expiredCount++;
    });

    return {
      total: vehicles.length,
      active,
      totalAlerts,
      expiredCount,
    };
  }, [vehicles]);

  // Handle Open Create Modal
  const handleOpenCreate = () => {
    setIsEditing(false);
    setSelectedVehicle(null);
    form.resetFields();
    form.setFieldsValue({
      vehicleStatus: 'ACTIVE',
      fuelType: 'DIESEL',
      hypothecated: 'No',
      emissionNorm: 'BS-IV',
    });
    setFormModalOpen(true);
  };

  // Handle Open Edit Modal
  const handleOpenEdit = (v: VehicleRecord) => {
    setIsEditing(true);
    setSelectedVehicle(v);
    form.resetFields();
    form.setFieldsValue({
      vehicleNumber: v.vehicleNumber,
      ownerName: v.ownerName,
      registeringAuthority: v.registeringAuthority,
      vehicleClass: v.vehicleClass || 'Articulated Vehicle(HGV)',
      fuelType: v.fuelType || 'DIESEL',
      emissionNorm: v.emissionNorm || 'Not Available',
      vehicleAge: v.vehicleAge,
      hypothecated: v.hypothecated || 'No',
      vehicleStatus: v.vehicleStatus || (v.active ? 'ACTIVE' : 'INACTIVE'),
      registrationDate: v.registrationDate ? dayjs(v.registrationDate) : undefined,
      fitnessValidUpTo: v.fitnessValidUpTo ? dayjs(v.fitnessValidUpTo) : undefined,
      taxValidUpTo: v.taxValidUpTo ? dayjs(v.taxValidUpTo) : undefined,
      insuranceValidUpTo: v.insuranceValidUpTo ? dayjs(v.insuranceValidUpTo) : undefined,
      puccValidUpTo: v.puccValidUpTo ? dayjs(v.puccValidUpTo) : undefined,
      permitValidUpTo: v.permitValidUpTo ? dayjs(v.permitValidUpTo) : undefined,
      nationalPermitValidUpTo: v.nationalPermitValidUpTo ? dayjs(v.nationalPermitValidUpTo) : undefined,
    });
    setFormModalOpen(true);
  };

  // Handle Save (Create or Update)
  const handleSaveVehicle = async (values: any) => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        vehicleNumber: String(values.vehicleNumber || '').toUpperCase().trim(),
        ownerName: values.ownerName || '',
        registeringAuthority: values.registeringAuthority || '',
        vehicleClass: values.vehicleClass || 'Articulated Vehicle(HGV)',
        fuelType: values.fuelType || 'DIESEL',
        emissionNorm: values.emissionNorm || 'Not Available',
        vehicleAge: values.vehicleAge || '',
        hypothecated: values.hypothecated || 'No',
        vehicleStatus: values.vehicleStatus || 'ACTIVE',
        active: values.vehicleStatus === 'ACTIVE',
        registrationDate: values.registrationDate ? dayjs(values.registrationDate).format('YYYY-MM-DD') : '',
        fitnessValidUpTo: values.fitnessValidUpTo ? dayjs(values.fitnessValidUpTo).format('YYYY-MM-DD') : '',
        taxValidUpTo: values.taxValidUpTo ? dayjs(values.taxValidUpTo).format('YYYY-MM-DD') : '',
        insuranceValidUpTo: values.insuranceValidUpTo ? dayjs(values.insuranceValidUpTo).format('YYYY-MM-DD') : '',
        puccValidUpTo: values.puccValidUpTo ? dayjs(values.puccValidUpTo).format('YYYY-MM-DD') : '',
        permitValidUpTo: values.permitValidUpTo ? dayjs(values.permitValidUpTo).format('YYYY-MM-DD') : '',
        nationalPermitValidUpTo: values.nationalPermitValidUpTo ? dayjs(values.nationalPermitValidUpTo).format('YYYY-MM-DD') : '',
      };

      if (isEditing && selectedVehicle) {
        const res = await axios.put(`/api/vehicles/${selectedVehicle.id}`, payload);
        if (res.data?.success) {
          message.success(`Vehicle ${payload.vehicleNumber} updated successfully!`);
          setFormModalOpen(false);
          fetchVehicles();
        } else {
          message.error(res.data?.message || 'Failed to update vehicle');
        }
      } else {
        const res = await axios.post('/api/vehicles', payload);
        if (res.data?.success) {
          message.success(`Vehicle ${payload.vehicleNumber} added successfully!`);
          setFormModalOpen(false);
          fetchVehicles();
        } else {
          message.error(res.data?.message || 'Failed to add vehicle');
        }
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error saving vehicle');
    } finally {
      setSaving(false);
    }
  };

  // Handle Deactivate / Delete
  const handleDeleteVehicle = async (v: VehicleRecord) => {
    try {
      const res = await axios.delete(`/api/vehicles/${v.id}`);
      if (res.data?.success) {
        message.success(`Vehicle ${v.vehicleNumber} deactivated successfully`);
        fetchVehicles();
      } else {
        message.error(res.data?.message || 'Failed to deactivate vehicle');
      }
    } catch {
      message.error('Error deactivating vehicle');
    }
  };

  // Export handlers
  const handleExportFiltered = () => {
    if (filteredVehicles.length === 0) {
      message.warning('No filtered vehicle records to export');
      return;
    }
    const cols = [
      { key: 'vehicleNumber', title: 'Vehicle Number' },
      { key: 'ownerName', title: 'Owner Name' },
      { key: 'registeringAuthority', title: 'Registering Authority' },
      { key: 'vehicleClass', title: 'Vehicle Class' },
      { key: 'fuelType', title: 'Fuel Type' },
      { key: 'emissionNorm', title: 'Emission Norm' },
      { key: 'vehicleAge', title: 'Vehicle Age' },
      { key: 'hypothecated', title: 'Hypothecated' },
      { key: 'vehicleStatus', title: 'Status' },
      { key: 'registrationDate', title: 'Registration Date' },
      { key: 'fitnessValidUpTo', title: 'Fitness Valid UpTo' },
      { key: 'taxValidUpTo', title: 'Tax Valid UpTo' },
      { key: 'insuranceValidUpTo', title: 'Insurance Valid UpTo' },
      { key: 'puccValidUpTo', title: 'PUCC Valid UpTo' },
      { key: 'permitValidUpTo', title: 'Permit Valid UpTo' },
      { key: 'nationalPermitValidUpTo', title: 'National Permit Valid UpTo' },
    ];
    exportToExcel(filteredVehicles, cols, `TMS_Vehicles_Filtered_${dayjs().format('YYYY-MM-DD')}`);
    message.success(`Exported ${filteredVehicles.length} vehicles to Excel!`);
  };

  const handleExportAll = () => {
    if (vehicles.length === 0) {
      message.warning('No vehicle records to export');
      return;
    }
    const cols = [
      { key: 'vehicleNumber', title: 'Vehicle Number' },
      { key: 'ownerName', title: 'Owner Name' },
      { key: 'registeringAuthority', title: 'Registering Authority' },
      { key: 'vehicleClass', title: 'Vehicle Class' },
      { key: 'fuelType', title: 'Fuel Type' },
      { key: 'emissionNorm', title: 'Emission Norm' },
      { key: 'vehicleAge', title: 'Vehicle Age' },
      { key: 'hypothecated', title: 'Hypothecated' },
      { key: 'vehicleStatus', title: 'Status' },
      { key: 'registrationDate', title: 'Registration Date' },
      { key: 'fitnessValidUpTo', title: 'Fitness Valid UpTo' },
      { key: 'taxValidUpTo', title: 'Tax Valid UpTo' },
      { key: 'insuranceValidUpTo', title: 'Insurance Valid UpTo' },
      { key: 'puccValidUpTo', title: 'PUCC Valid UpTo' },
      { key: 'permitValidUpTo', title: 'Permit Valid UpTo' },
      { key: 'nationalPermitValidUpTo', title: 'National Permit Valid UpTo' },
    ];
    exportToExcel(vehicles, cols, `TMS_Vehicles_ALL_${dayjs().format('YYYY-MM-DD')}`);
    message.success(`Exported all ${vehicles.length} vehicles to Excel!`);
  };

  // Table Columns
  const columns: ColumnsType<VehicleRecord> = [
    {
      title: 'Vehicle Number',
      dataIndex: 'vehicleNumber',
      key: 'vehicleNumber',
      width: 140,
      fixed: 'left',
      render: (num: string, record) => (
        <Button
          type="link"
          style={{ padding: 0, fontWeight: 700, fontSize: 13, color: '#17324D' }}
          onClick={() => {
            setSelectedVehicle(record);
            setDetailsModalOpen(true);
          }}
        >
          {num || record.id}
        </Button>
      ),
    },
    {
      title: 'Owner Name',
      dataIndex: 'ownerName',
      key: 'ownerName',
      width: 160,
      render: (val: string) => <Text strong>{val || '-'}</Text>,
    },
    {
      title: 'Registering Authority',
      dataIndex: 'registeringAuthority',
      key: 'registeringAuthority',
      width: 200,
      ellipsis: true,
      render: (val: string) => val || '-',
    },
    {
      title: 'Vehicle Class',
      dataIndex: 'vehicleClass',
      key: 'vehicleClass',
      width: 180,
      render: (val: string) => <Tag color="blue">{val || 'Articulated Vehicle(HGV)'}</Tag>,
    },
    {
      title: 'Fuel Type',
      dataIndex: 'fuelType',
      key: 'fuelType',
      width: 100,
      align: 'center',
      render: (val: string) => <Tag color="geekblue">{val || 'DIESEL'}</Tag>,
    },
    {
      title: 'Registration Date',
      dataIndex: 'registrationDate',
      key: 'registrationDate',
      width: 130,
      align: 'center',
      render: (d: string) => (d ? dayjs(d).format('DD-MMM-YYYY') : '-'),
    },
    {
      title: 'Validity Alerts',
      key: 'validityAlerts',
      width: 220,
      render: (_, record) => {
        const alerts = getVehicleAlerts(record);
        if (alerts.length === 0) {
          return <Tag color="success">All Valid</Tag>;
        }
        return (
          <Space direction="vertical" size={2}>
            {alerts.slice(0, 2).map((a, idx) => (
              <Tag key={idx} color={a.status === 'expired' ? 'error' : 'warning'}>
                {a.label.replace(' Valid UpTo', '')}: {a.text}
              </Tag>
            ))}
            {alerts.length > 2 && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                +{alerts.length - 2} more
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Work Status',
      key: 'workStatus',
      width: 120,
      align: 'center' as const,
      render: (_, record) => (
        <VehicleStatusToggle
          vehicleNumber={record.vehicleNumber}
          vehicleId={record.id}
          initialStatus={record.active !== false}
        />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'vehicleStatus',
      key: 'vehicleStatus',
      width: 100,
      align: 'center',
      render: (val: string, record) => {
        const isActive = val ? val.toUpperCase() === 'ACTIVE' : Boolean(record.active);
        return <Tag color={isActive ? 'green' : 'default'}>{isActive ? 'ACTIVE' : 'INACTIVE'}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Vehicle RC Details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined style={{ color: '#17324D' }} />}
              onClick={() => {
                setSelectedVehicle(record);
                setDetailsModalOpen(true);
              }}
            />
          </Tooltip>

          <Tooltip title="Edit Vehicle Details">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ color: '#365A73' }} />}
              onClick={() => handleOpenEdit(record)}
            />
          </Tooltip>

          <Tooltip title="Add Documents">
            <Button
              type="text"
              size="small"
              icon={<UploadOutlined style={{ color: '#3F6F4A' }} />}
              onClick={() => {
                setDocVehicle(record);
                setDocModalOpen(true);
              }}
            />
          </Tooltip>

          <Popconfirm
            title="Deactivate this vehicle?"
            onConfirm={() => handleDeleteVehicle(record)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="text" size="small" icon={<DeleteOutlined style={{ color: '#A8473C' }} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '4px 0 24px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, color: '#1E2933', fontSize: 22, fontWeight: 600 }}>
            <CarOutlined style={{ marginRight: 8, color: '#17324D' }} />
            Vehicle Fleet & RC Management
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: '#5F6B73' }}>
            Comprehensive fleet registry, registration certificates (RC), and automated document renewal alerts
          </Text>
        </div>

        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={fetchVehicles} loading={loading}>
            Refresh
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportAll}>
            Export All
          </Button>
          <Button
            icon={<UploadOutlined />}
            onClick={() => {
              setDocVehicle(vehicles[0] || null);
              setDocModalOpen(true);
            }}
          >
            Add Documents
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            Add Vehicle
          </Button>
        </Space>
      </div>

      {/* KPI Cards Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="spt-kpi-card spt-kpi-steel">
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>Total Registered Fleet</span>}
              value={stats.total}
              prefix={<CarOutlined style={{ color: '#365A73' }} />}
              valueStyle={{ color: '#17324D', fontWeight: 700 }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="spt-kpi-card spt-kpi-green">
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>Active Vehicles</span>}
              value={stats.active}
              prefix={<CheckCircleOutlined style={{ color: '#3F6F4A' }} />}
              valueStyle={{ color: '#3F6F4A', fontWeight: 700 }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            className="spt-kpi-card spt-kpi-amber"
            style={{ cursor: 'pointer' }}
            onClick={() => setExpiryFilter(expiryFilter === 'ALERTS' ? 'ALL' : 'ALERTS')}
          >
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>Expiring Soon (&le;3 Days)</span>}
              value={stats.totalAlerts}
              prefix={<WarningOutlined style={{ color: '#C58A2A' }} />}
              valueStyle={{ color: '#C58A2A', fontWeight: 700 }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            className="spt-kpi-card spt-kpi-red"
            style={{ cursor: 'pointer' }}
            onClick={() => setExpiryFilter(expiryFilter === 'EXPIRED' ? 'ALL' : 'EXPIRED')}
          >
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>Expired Documents</span>}
              value={stats.expiredCount}
              prefix={<ExclamationCircleOutlined style={{ color: '#A8473C' }} />}
              valueStyle={{ color: '#A8473C', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter Toolbar */}
      <Card style={{ marginBottom: 16, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Space wrap>
          <Input
            placeholder="Search Vehicle No, Owner, RTO..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />

          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 140 }}
          >
            <Select.Option value="ALL">All Statuses</Select.Option>
            <Select.Option value="ACTIVE">Active Only</Select.Option>
            <Select.Option value="INACTIVE">Inactive Only</Select.Option>
          </Select>

          <Select
            value={expiryFilter}
            onChange={setExpiryFilter}
            style={{ width: 170 }}
          >
            <Select.Option value="ALL">All Validity</Select.Option>
            <Select.Option value="ALERTS">Expiring Soon / Expired</Select.Option>
            <Select.Option value="EXPIRED">Expired Only</Select.Option>
          </Select>

          <DatePicker.RangePicker
            placeholder={['Reg Start Date', 'Reg End Date']}
            format="DD/MM/YYYY"
            value={dateRange}
            onChange={(d) => setDateRange(d as any)}
            style={{ width: 230 }}
          />

          <Button
            onClick={() => {
              setSearchText('');
              setStatusFilter('ALL');
              setExpiryFilter('ALL');
              setDateRange(null);
            }}
          >
            Reset
          </Button>

          <Button icon={<DownloadOutlined />} onClick={handleExportFiltered}>
            Export Filtered
          </Button>
        </Space>
      </Card>

      {/* Main Vehicles Table */}
      <Card style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Table<VehicleRecord>
          columns={columns}
          dataSource={filteredVehicles}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1350 }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ['15', '30', '50', '100'],
            showTotal: (tot) => `Total ${tot} vehicle records`,
          }}
        />
      </Card>

      {/* VEHICLE DETAILS MODAL (Designed like uploaded RC Card) */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 32 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>
              Vehicle Registration &amp; Validity Details — {selectedVehicle?.vehicleNumber}
            </span>
            <Tag color={selectedVehicle?.vehicleStatus === 'ACTIVE' || selectedVehicle?.active ? 'green' : 'default'}>
              {selectedVehicle?.vehicleStatus || (selectedVehicle?.active ? 'ACTIVE' : 'INACTIVE')}
            </Tag>
          </div>
        }
        open={detailsModalOpen}
        onCancel={() => setDetailsModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailsModalOpen(false)}>
            Close
          </Button>,
          <Button
            key="docs"
            icon={<UploadOutlined />}
            onClick={() => {
              setDocVehicle(selectedVehicle);
              setDocModalOpen(true);
            }}
          >
            Add Documents
          </Button>,
          <Button
            key="edit"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              if (selectedVehicle) {
                setDetailsModalOpen(false);
                handleOpenEdit(selectedVehicle);
              }
            }}
          >
            Edit Vehicle
          </Button>,
        ]}
        width={720}
        destroyOnClose
      >
        {selectedVehicle && (
          <div style={{ padding: '8px 4px' }}>
            {/* Upper Vehicle Specification Card */}
            <div
              style={{
                background: isDark ? '#141416' : '#F8FAFC',
                border: isDark ? '1px solid #27272A' : '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '16px 20px',
                marginBottom: 16,
              }}
            >
              <Row gutter={[16, 12]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Vehicle Number</Text>
                  <div style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#FFFFFF' : '#17324D' }}>
                    {selectedVehicle.vehicleNumber}
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Owner Name</Text>
                  <div style={{ fontSize: 14, fontWeight: 600, color: isDark ? '#FFFFFF' : '#17324D' }}>
                    {selectedVehicle.ownerName || '-'}
                  </div>
                </Col>

                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Registering Authority</Text>
                  <div style={{ fontSize: 13, fontWeight: 500, color: isDark ? '#FFFFFF' : '#17324D' }}>
                    {selectedVehicle.registeringAuthority || '-'}
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Vehicle Class</Text>
                  <div style={{ fontSize: 13, fontWeight: 500, color: isDark ? '#FFFFFF' : '#17324D' }}>
                    {selectedVehicle.vehicleClass || 'Articulated Vehicle(HGV)'}
                  </div>
                </Col>

                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Fuel Type</Text>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#FFFFFF' : '#17324D' }}>
                    {selectedVehicle.fuelType || 'DIESEL'}
                  </div>
                </Col>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Emission Norm</Text>
                  <div style={{ fontSize: 13, color: isDark ? '#FFFFFF' : '#17324D' }}>
                    {selectedVehicle.emissionNorm || 'Not Available'}
                  </div>
                </Col>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Vehicle Age</Text>
                  <div style={{ fontSize: 13, color: isDark ? '#FFFFFF' : '#17324D' }}>
                    {selectedVehicle.vehicleAge || (selectedVehicle.registrationDate ? `${dayjs().diff(dayjs(selectedVehicle.registrationDate), 'year')} Years` : '-')}
                  </div>
                </Col>

                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Hypothecated</Text>
                  <div style={{ fontSize: 13, color: isDark ? '#FFFFFF' : '#17324D' }}>
                    {selectedVehicle.hypothecated || 'No'}
                  </div>
                </Col>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Vehicle Status</Text>
                  <div>
                    <Tag color="green">{selectedVehicle.vehicleStatus || 'ACTIVE'}</Tag>
                  </div>
                </Col>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Registration Date</Text>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#FFFFFF' : '#17324D' }}>
                    {selectedVehicle.registrationDate ? dayjs(selectedVehicle.registrationDate).format('DD-MMM-YYYY') : '-'}
                  </div>
                </Col>
              </Row>
            </div>

            {/* Tap to check status link */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Button type="link" style={{ fontSize: 13, color: isDark ? '#38BDF8' : '#1677ff' }} onClick={() => message.info('No impound/seizure records recorded for this vehicle.')}>
                Tap to Check the impound/seizure document status
              </Button>
            </div>

            {/* Document Validity Matrix with Highlighted Red Boxes for ≤3 Days or Expired */}
            <Title level={5} style={{ marginBottom: 12, fontSize: 14, color: isDark ? '#FFFFFF' : '#111827' }}>
              Document Validity Dates &amp; Compliance Status
            </Title>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {VALIDITY_FIELDS.map((f) => {
                const val = selectedVehicle[f.key as keyof VehicleRecord] as string | undefined;
                const validity = checkValidity(val);
                const isCritical = validity.status === 'expired' || validity.status === 'critical';

                return (
                  <div
                    key={f.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: 6,
                      background: isCritical
                        ? (isDark ? '#2D1214' : '#FEF2F2')
                        : (isDark ? '#141416' : '#FFFFFF'),
                      border: isCritical
                        ? '2px solid #EF4444'
                        : (isDark ? '1px solid #27272A' : '1px solid #E2E8F0'),
                      boxShadow: isCritical
                        ? (isDark ? '0 0 10px rgba(239, 68, 68, 0.35)' : '0 0 8px rgba(239, 68, 68, 0.2)')
                        : 'none',
                    }}
                  >
                    <div>
                      <Text
                        strong
                        style={{
                          fontSize: 13,
                          color: isCritical
                            ? (isDark ? '#FCA5A5' : '#991B1B')
                            : (isDark ? '#FFFFFF' : '#111827'),
                        }}
                      >
                        {f.label}
                      </Text>
                      <div
                        style={{
                          fontSize: 11,
                          color: isCritical
                            ? (isDark ? '#FECACA' : '#B91C1C')
                            : (isDark ? '#A1A1AA' : '#64748B'),
                          fontWeight: 500,
                        }}
                      >
                        {val ? dayjs(val).format('DD-MMM-YYYY') : 'Not Configured'}
                      </div>
                    </div>

                    <div>
                      {isCritical ? (
                        <Tag
                          color="error"
                          style={{
                            padding: '4px 10px',
                            fontWeight: 700,
                            fontSize: 12,
                            borderRadius: 4,
                            border: '1px solid #DC2626',
                          }}
                        >
                          {validity.status === 'expired' ? 'EXPIRED — MANDATORY RENEWAL' : `RENEW NOW (${validity.days}D LEFT)`}
                        </Tag>
                      ) : val ? (
                        <Tag color="success" style={{ fontWeight: 600 }}>
                          Valid ({dayjs(val).format('DD-MMM-YYYY')})
                        </Tag>
                      ) : (
                        <Tag color="default">N/A</Tag>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* ADD / EDIT VEHICLE MODAL */}
      <Modal
        title={isEditing ? `Edit Vehicle — ${selectedVehicle?.vehicleNumber}` : 'Add New Vehicle to Fleet'}
        open={formModalOpen}
        onCancel={() => setFormModalOpen(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSaveVehicle} style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="vehicleNumber"
                label="Vehicle Number"
                rules={[{ required: true, message: 'Please enter Vehicle Number (e.g. TN04T5189)' }]}
              >
                <Input placeholder="e.g. TN04T5189" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ownerName" label="Owner Name">
                <Input placeholder="e.g. K DHARMARAJAN" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="registeringAuthority" label="Registering Authority">
                <Input placeholder="e.g. CHENNAI (EAST) RTO, Tamil Nadu" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="vehicleClass" label="Vehicle Class">
                <Select placeholder="Select Class">
                  <Select.Option value="Articulated Vehicle(HGV)">Articulated Vehicle(HGV)</Select.Option>
                  <Select.Option value="Heavy Goods Vehicle (HGV)">Heavy Goods Vehicle (HGV)</Select.Option>
                  <Select.Option value="Light Commercial Vehicle (LCV)">Light Commercial Vehicle (LCV)</Select.Option>
                  <Select.Option value="Medium Goods Vehicle (MGV)">Medium Goods Vehicle (MGV)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="fuelType" label="Fuel Type">
                <Select>
                  <Select.Option value="DIESEL">DIESEL</Select.Option>
                  <Select.Option value="PETROL">PETROL</Select.Option>
                  <Select.Option value="CNG">CNG</Select.Option>
                  <Select.Option value="ELECTRIC">ELECTRIC</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="emissionNorm" label="Emission Norm">
                <Input placeholder="e.g. BS-IV / BS-VI" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="vehicleAge" label="Vehicle Age">
                <Input placeholder="e.g. 16 Years & 7 months" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="hypothecated" label="Hypothecated">
                <Select>
                  <Select.Option value="No">No</Select.Option>
                  <Select.Option value="Yes">Yes</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="vehicleStatus" label="Vehicle Status">
                <Select>
                  <Select.Option value="ACTIVE">ACTIVE</Select.Option>
                  <Select.Option value="INACTIVE">INACTIVE</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="registrationDate" label="Registration Date">
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Title level={5} style={{ marginTop: 12, marginBottom: 12, fontSize: 13.5 }}>
            Document Expiry Dates (for automated alerts)
          </Title>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="fitnessValidUpTo" label="Fitness Valid UpTo">
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="taxValidUpTo" label="Tax Valid UpTo">
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="insuranceValidUpTo" label="Insurance Valid UpTo">
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="puccValidUpTo" label="PUCC Valid UpTo">
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="permitValidUpTo" label="Permit Valid UpTo">
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="nationalPermitValidUpTo" label="National Permit Valid UpTo">
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
            <Button onClick={() => setFormModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {isEditing ? 'Save Changes' : 'Create Vehicle'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* UPLOAD DOCUMENTS PLACEHOLDER MODAL */}
      <Modal
        title={<span>Add / Manage Documents — {docVehicle?.vehicleNumber}</span>}
        open={docModalOpen}
        onCancel={() => setDocModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDocModalOpen(false)}>
            Close
          </Button>,
        ]}
      >
        <div style={{ textAlign: 'center', padding: '24px 12px' }}>
          <UploadOutlined style={{ fontSize: 44, color: '#365A73', marginBottom: 12 }} />
          <Title level={4} style={{ margin: 0 }}>
            Document Vault for {docVehicle?.vehicleNumber}
          </Title>
          <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 13 }}>
            Upload and link scanned copies of RC, Fitness Certificate, Insurance Policy, State &amp; National Permits.
          </Paragraph>
          <Alert
            message="Feature Ready"
            description="The 'Add Documents' interface button is established. Document upload and storage specification will be activated with your provided cloud document configuration."
            type="info"
            showIcon
            style={{ textAlign: 'left', marginTop: 16 }}
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
