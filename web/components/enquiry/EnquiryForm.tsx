'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Form,
  Input,
  InputNumber,
  DatePicker,
  Radio,
  Button,
  Card,
  Row,
  Col,
  Typography,
  Alert,
  Space,
  Divider,
  Modal,
  message,
  AutoComplete,
  Spin,
} from 'antd';
import {
  SaveOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  CarOutlined,
  InfoCircleOutlined,
  LockOutlined,
  UnlockOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useRouter } from 'next/navigation';
import { AsyncMasterSelect, LookupItem } from '@/components/common/AsyncMasterSelect';
import { computeVendorPayable } from '@/lib/utils/vendorFinance';
import { formatCurrencyINR } from '@/lib/utils/format';
import { isValidVehicleNumber, isValidDriverPhone } from '@/lib/utils/masterValidation';
import { isValidContainerNumber } from '@/lib/utils/enquiryValidation';
import { apiClient } from '@/lib/api/client';

const { Title, Text } = Typography;

export interface EnquiryFormProps {
  initialValues?: Record<string, any>;
  isEdit?: boolean;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  loading?: boolean;
}

export const EnquiryForm: React.FC<EnquiryFormProps> = ({
  initialValues,
  isEdit = false,
  onSubmit,
  loading = false,
}) => {
  const [form] = Form.useForm();
  const router = useRouter();

  // Guard for billed enquiries
  const initialStage = initialValues?.stage || 'ENQUIRY_CREATED';
  const isBilledStage = initialStage === 'BILLING' || initialStage === 'PROCESSED';
  const [isUnlocked, setIsUnlocked] = useState(!isBilledStage);

  // Unsaved changes tracking
  const [isDirty, setIsDirty] = useState(false);

  // AutoComplete options for vehicle, driver, container
  const [vehicleOptions, setVehicleOptions] = useState<{ value: string; label: string; item?: any }[]>([]);
  const [driverOptions, setDriverOptions] = useState<{ value: string; label: string; item?: any }[]>([]);
  const [containerOptions, setContainerOptions] = useState<{ value: string; label: string; item?: any }[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);

  // Live money fields watcher
  const advanceAmount = Form.useWatch('advanceAmount', form) || 0;
  const extraAdvance = Form.useWatch('extraAdvance', form) || 0;
  const dieselAmount = Form.useWatch('dieselAmount', form) || 0;
  const haltingAmount = Form.useWatch('haltingAmount', form) || 0;
  const bonus = Form.useWatch('bonus', form) || 0;

  // Live vendor payable computation
  const vendorFinance = useMemo(() => {
    return computeVendorPayable({
      advanceAmount,
      extraAdvance,
      dieselAmount,
      haltingAmount,
      bonus,
    });
  }, [advanceAmount, extraAdvance, dieselAmount, haltingAmount, bonus]);

  // Load type-ahead lookup suggestions on mount
  useEffect(() => {
    async function loadLookups() {
      setLoadingLookups(true);
      try {
        const [vRes, dRes, cRes] = await Promise.all([
          apiClient.get<any>('/master/vehicles?lookup=true&limit=50'),
          apiClient.get<any>('/master/drivers?lookup=true&limit=50'),
          apiClient.get<any>('/master/containers?lookup=true&limit=50'),
        ]);

        if (vRes.data?.success && Array.isArray(vRes.data?.data)) {
          setVehicleOptions(
            vRes.data.data.map((item: any) => ({
              value: item.label || item.vehicleNumber,
              label: `${item.label || item.vehicleNumber}${item.vendorName ? ` (${item.vendorName})` : ''}`,
              item,
            }))
          );
        }

        if (dRes.data?.success && Array.isArray(dRes.data?.data)) {
          setDriverOptions(
            dRes.data.data.map((item: any) => ({
              value: item.name,
              label: `${item.name} (${item.phone})`,
              item,
            }))
          );
        }

        if (cRes.data?.success && Array.isArray(cRes.data?.data)) {
          setContainerOptions(
            cRes.data.data.map((item: any) => ({
              value: item.label || item.containerNumber,
              label: `${item.label || item.containerNumber}${item.containerType ? ` (${item.containerType})` : ''}`,
              item,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load asset lookups', err);
      } finally {
        setLoadingLookups(false);
      }
    }
    loadLookups();
  }, []);

  // Format initial values into form
  useEffect(() => {
    if (initialValues) {
      const formatted: Record<string, any> = { ...initialValues };

      if (initialValues.date) {
        formatted.date = dayjs(initialValues.date, 'DD-MM-YYYY').isValid()
          ? dayjs(initialValues.date, 'DD-MM-YYYY')
          : dayjs(initialValues.date);
      } else {
        formatted.date = dayjs();
      }

      // Movement gate times
      const mov = initialValues.movement || {};
      const timeKeys = [
        'companyInTime',
        'companyOutTime',
        'printInTime',
        'printOutTime',
        'portInTime',
        'portOutTime',
      ];
      timeKeys.forEach((key) => {
        const val = mov[key] || initialValues[key];
        if (val) {
          formatted[key] = dayjs(val, 'DD-MM-YYYY hh:mm A').isValid()
            ? dayjs(val, 'DD-MM-YYYY hh:mm A')
            : dayjs(val).isValid()
            ? dayjs(val)
            : undefined;
        }
      });

      form.setFieldsValue(formatted);
    } else {
      // Default new enquiry
      form.setFieldsValue({
        date: dayjs(),
        loadingType: 'Import',
        freightAmount: 0,
        dieselAmount: 0,
        advanceAmount: 0,
        extraAdvance: 0,
        haltingDays: 0,
        haltingAmount: 0,
        bonus: 0,
      });
    }
  }, [initialValues, form]);

  // Warn on window reload if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // "Set now" helper for movement times
  const handleSetNow = (fieldName: string) => {
    form.setFieldsValue({ [fieldName]: dayjs() });
    setIsDirty(true);
    message.success(`Set ${fieldName} to current time`);
  };

  // Handle vehicle selected from auto-complete
  const handleSelectVehicle = (value: string, option: any) => {
    if (option.item?.vendorId) {
      // Auto-suggest vendor if vehicle is tied to one
      if (!form.getFieldValue('vendorId')) {
        form.setFieldsValue({ vendorId: option.item.vendorId });
      }
    }
  };

  // Handle driver selected from auto-complete
  const handleSelectDriver = (value: string, option: any) => {
    if (option.item?.phone) {
      form.setFieldsValue({
        driverName: option.item.name,
        driverPhone: option.item.phone,
      });
    }
  };

  // Form submission handler
  const handleFinish = async (values: any) => {
    const formatted: Record<string, any> = { ...values };

    // Format date to DD-MM-YYYY
    if (values.date) {
      formatted.date = values.date.format('DD-MM-YYYY');
    }

    // Format movement gate times to DD-MM-YYYY hh:mm A
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
        formatted[k] = values[k].format('DD-MM-YYYY hh:mm A');
      } else if (!values[k]) {
        formatted[k] = '';
      }
    });

    // Ensure numeric fields
    formatted.freightAmount = Number(values.freightAmount) || 0;
    formatted.dieselAmount = Number(values.dieselAmount) || 0;
    formatted.advanceAmount = Number(values.advanceAmount) || 0;
    formatted.extraAdvance = Number(values.extraAdvance) || 0;
    formatted.haltingDays = parseInt(String(values.haltingDays || '0'), 10) || 0;
    formatted.haltingAmount = Number(values.haltingAmount) || 0;
    formatted.bonus = Number(values.bonus) || 0;

    // Clean uppercase assets
    if (formatted.vehicleNumber) {
      formatted.vehicleNumber = formatted.vehicleNumber.replace(/[\s-]/g, '').toUpperCase();
    }
    if (formatted.containerNumber) {
      formatted.containerNumber = formatted.containerNumber.replace(/[\s-]/g, '').toUpperCase();
    }
    if (formatted.driverPhone) {
      formatted.driverPhone = formatted.driverPhone.replace(/[\s-]/g, '');
    }

    await onSubmit(formatted);
    setIsDirty(false);
  };

  // Confirm Unlock for Billing/Processed stage
  const handleRequestUnlock = () => {
    Modal.confirm({
      title: 'Override Billing Lock?',
      icon: <WarningOutlined style={{ color: '#faad14' }} />,
      content: (
        <div>
          <p>
            This enquiry is currently in <strong>{initialStage}</strong> stage.
          </p>
          <p>
            Modifying critical fields (such as Company, Client, Loading Type, or Freight Amount)
            may cause discrepancies with existing invoices or draft bills.
          </p>
          <p>Are you sure you want to unlock editing anyway?</p>
        </div>
      ),
      okText: 'Yes, Unlock Fields',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() {
        setIsUnlocked(true);
        message.warning('Billing fields unlocked for editing');
      },
    });
  };

  const handleCancel = () => {
    if (isDirty) {
      Modal.confirm({
        title: 'Discard Unsaved Changes?',
        content: 'You have modified fields in this enquiry. Navigating away will lose these changes.',
        okText: 'Yes, Discard',
        okType: 'danger',
        cancelText: 'Stay on Page',
        onOk() {
          router.back();
        },
      });
    } else {
      router.back();
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      onValuesChange={() => setIsDirty(true)}
      requiredMark="optional"
    >
      {/* Read-only notification if in billing stage and locked */}
      {isBilledStage && (
        <Alert
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <LockOutlined style={{ marginRight: 8 }} />
                This enquiry is at stage <strong>{initialStage}</strong>. Financial and billing fields are protected.
              </span>
              {!isUnlocked ? (
                <Button
                  size="small"
                  type="primary"
                  danger
                  icon={<UnlockOutlined />}
                  onClick={handleRequestUnlock}
                >
                  Edit Anyway
                </Button>
              ) : (
                <Text type="danger">
                  <UnlockOutlined /> Unlocked for modification
                </Text>
              )}
            </div>
          }
          type={isUnlocked ? 'warning' : 'info'}
          showIcon={false}
          style={{ marginBottom: 20 }}
        />
      )}

      {/* SECTION A: BASIC DETAILS */}
      <Card
        title={
          <Space>
            <InfoCircleOutlined style={{ color: '#1677ff' }} />
            <span>Section A: Basic Details</span>
          </Space>
        }
        style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
      >
        <Row gutter={24}>
          <Col xs={24} sm={12} md={6}>
            <Form.Item
              name="date"
              label="Creation Date"
              rules={[{ required: true, message: 'Creation date is required' }]}
            >
              <DatePicker
                format="DD-MM-YYYY"
                style={{ width: '100%' }}
                disabled={!isUnlocked}
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item
              name="companyId"
              label="Company"
              rules={[{ required: true, message: 'Please select a company' }]}
            >
              <AsyncMasterSelect
                entity="companies"
                placeholder="Search or add company..."
                disabled={!isUnlocked}
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item
              name="clientId"
              label="Client"
              rules={[{ required: true, message: 'Please select a client' }]}
            >
              <AsyncMasterSelect
                entity="clients"
                placeholder="Search or add client..."
                disabled={!isUnlocked}
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item
              name="loadingType"
              label="Loading Type"
              rules={[{ required: true, message: 'Please select Import or Export' }]}
            >
              <Radio.Group buttonStyle="solid" disabled={!isUnlocked} style={{ width: '100%' }}>
                <Radio.Button value="Import" style={{ width: '50%', textAlign: 'center' }}>
                  Import
                </Radio.Button>
                <Radio.Button value="Export" style={{ width: '50%', textAlign: 'center' }}>
                  Export
                </Radio.Button>
              </Radio.Group>
            </Form.Item>
          </Col>
        </Row>

        {isEdit && (
          <Row gutter={24} style={{ marginTop: 8 }}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item label="Enquiry ID">
                <Input value={initialValues?.id} readOnly disabled style={{ background: '#f5f5f5' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item label="Transaction Number">
                <Input value={initialValues?.transactionNumber} readOnly disabled style={{ background: '#f5f5f5' }} />
              </Form.Item>
            </Col>
          </Row>
        )}
      </Card>

      {/* SECTION B: VEHICLE & DRIVER */}
      <Card
        title={
          <Space>
            <CarOutlined style={{ color: '#1677ff' }} />
            <span>Section B: Vehicle & Driver Details</span>
          </Space>
        }
        style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
      >
        <Row gutter={24}>
          <Col xs={24} sm={12} md={6}>
            <Form.Item
              name="vehicleNumber"
              label="Vehicle Number"
              extra="Format: TN04AB1234 (uppercase, no spaces)"
              rules={[
                {
                  validator: (_, val) => {
                    if (!val || !val.trim()) return Promise.resolve();
                    if (isValidVehicleNumber(val)) return Promise.resolve();
                    return Promise.reject(new Error('Invalid vehicle format (e.g. TN04AB1234)'));
                  },
                },
              ]}
            >
              <AutoComplete
                options={vehicleOptions}
                placeholder="Type or pick vehicle..."
                onSelect={handleSelectVehicle}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item name="driverName" label="Driver Name">
              <AutoComplete
                options={driverOptions}
                placeholder="Driver name..."
                onSelect={handleSelectDriver}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item
              name="driverPhone"
              label="Driver Mobile"
              extra="10 digits starting with 6-9"
              rules={[
                {
                  validator: (_, val) => {
                    if (!val || !val.trim()) return Promise.resolve();
                    if (isValidDriverPhone(val)) return Promise.resolve();
                    return Promise.reject(new Error('Driver mobile must be 10 digits starting with 6-9'));
                  },
                },
              ]}
            >
              <Input placeholder="9876543210" maxLength={10} />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item
              name="containerNumber"
              label="Container Number"
              extra="Format: 4 letters + 7 digits (e.g. MSCU1234567)"
              rules={[
                {
                  validator: (_, val) => {
                    if (!val || !val.trim()) return Promise.resolve();
                    if (isValidContainerNumber(val)) return Promise.resolve();
                    return Promise.reject(new Error('Format: 4 letters + 7 digits (e.g. MSCU1234567)'));
                  },
                },
              ]}
            >
              <AutoComplete
                options={containerOptions}
                placeholder="Type container number..."
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item name="sealNumber" label="Seal Number">
              <Input placeholder="Enter seal number..." />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* SECTION C: MOVEMENT DETAILS */}
      <Card
        title={
          <Space>
            <ClockCircleOutlined style={{ color: '#1677ff' }} />
            <span>Section C: Movement Details (Gate Times)</span>
          </Space>
        }
        style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
      >
        <Row gutter={24}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item label="Factory / Company Gate-In">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="companyInTime" noStyle>
                  <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                </Form.Item>
                <Button onClick={() => handleSetNow('companyInTime')}>Set now</Button>
              </Space.Compact>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Form.Item label="Factory / Company Gate-Out">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="companyOutTime" noStyle>
                  <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                </Form.Item>
                <Button onClick={() => handleSetNow('companyOutTime')}>Set now</Button>
              </Space.Compact>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Form.Item label="Print Gate-In">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="printInTime" noStyle>
                  <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                </Form.Item>
                <Button onClick={() => handleSetNow('printInTime')}>Set now</Button>
              </Space.Compact>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Form.Item label="Print Gate-Out">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="printOutTime" noStyle>
                  <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                </Form.Item>
                <Button onClick={() => handleSetNow('printOutTime')}>Set now</Button>
              </Space.Compact>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Form.Item label="Port Gate-In">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="portInTime" noStyle>
                  <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                </Form.Item>
                <Button onClick={() => handleSetNow('portInTime')}>Set now</Button>
              </Space.Compact>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Form.Item label="Port Gate-Out">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="portOutTime" noStyle>
                  <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                </Form.Item>
                <Button onClick={() => handleSetNow('portOutTime')}>Set now</Button>
              </Space.Compact>
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* SECTION D: MONEY & FINANCIAL DETAILS */}
      <Card
        title={
          <Space>
            <DollarOutlined style={{ color: '#1677ff' }} />
            <span>Section D: Money & Pricing</span>
          </Space>
        }
        style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
      >
        <Row gutter={24}>
          <Col xs={24} sm={12} md={6}>
            <Form.Item
              name="freightAmount"
              label="Freight Amount (INR)"
              rules={[{ required: true, message: 'Freight amount is required' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                prefix="₹"
                disabled={!isUnlocked}
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item name="advanceAmount" label="Advance Amount (INR)">
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                prefix="₹"
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item name="extraAdvance" label="Extra Advance (INR)">
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                prefix="₹"
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item name="dieselAmount" label="Diesel Amount (INR)">
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                prefix="₹"
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item name="haltingDays" label="Halting Days">
              <InputNumber style={{ width: '100%' }} min={0} precision={0} />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item name="haltingAmount" label="Halting Amount (INR)">
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                prefix="₹"
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item name="bonus" label="Bonus (INR)">
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                prefix="₹"
              />
            </Form.Item>
          </Col>
        </Row>

        {/* LIVE VENDOR TOTAL PAYABLE CALCULATION BANNER (D7) */}
        <div
          style={{
            marginTop: 12,
            padding: '16px 20px',
            backgroundColor: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
              Live Computed Vendor Total Payable (Advance + Extra Advance + Diesel + Halting + Bonus)
            </Text>
            <Title level={4} style={{ margin: 0, color: '#389e0d' }}>
              {formatCurrencyINR(vendorFinance.totalPayable)}
            </Title>
          </div>

          <Space size="large">
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Advance + Extra</Text>
              <div style={{ fontWeight: 600 }}>{formatCurrencyINR(vendorFinance.advance + vendorFinance.extraAdvance)}</div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Diesel</Text>
              <div style={{ fontWeight: 600 }}>{formatCurrencyINR(vendorFinance.diesel)}</div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Halting</Text>
              <div style={{ fontWeight: 600 }}>{formatCurrencyINR(vendorFinance.halting)}</div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Bonus</Text>
              <div style={{ fontWeight: 600 }}>{formatCurrencyINR(vendorFinance.bonus)}</div>
            </div>
          </Space>
        </div>
      </Card>

      {/* SECTION E: VENDOR DETAILS */}
      <Card
        title={
          <Space>
            <CarOutlined style={{ color: '#1677ff' }} />
            <span>Section E: Vendor Details</span>
          </Space>
        }
        style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
      >
        <Row gutter={24}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="vendorId"
              label="Associated Vendor (Optional)"
              extra="Select if this transport trip is operated by an external vendor."
            >
              <AsyncMasterSelect
                entity="vendors"
                placeholder="Search or add vendor..."
                allowClear
              />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* FORM ACTION BUTTONS */}
      <Card style={{ position: 'sticky', bottom: 16, zIndex: 10, boxShadow: '0 -2px 10px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large">
            {isEdit ? 'Save Changes' : 'Create Enquiry'}
          </Button>
        </div>
      </Card>
    </Form>
  );
};
