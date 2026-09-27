'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
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
  Steps,
  Tag,
  Collapse,
  Badge,
  Descriptions,
  Grid,
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
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  UserOutlined,
  FileTextOutlined,
  WalletOutlined,
  CompassOutlined,
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { AsyncMasterSelect } from '@/components/common/AsyncMasterSelect';
import { computeVendorPayable } from '@/lib/utils/vendorFinance';
import { formatCurrencyINR, formatDate } from '@/lib/utils/format';
import { isValidVehicleNumber, isValidDriverPhone } from '@/lib/utils/masterValidation';
import { isValidContainerNumber } from '@/lib/utils/enquiryValidation';
import { apiClient } from '@/lib/api/client';
import { ActionConfirmPopover } from '@/components/common/ActionConfirmPopover';

const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

export interface EnquiryFormProps {
  initialValues?: Record<string, any>;
  isEdit?: boolean;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  loading?: boolean;
}

export interface ContainerDetail {
  containerNumber?: string;
  sealNumber?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
}

const STEPS = [
  { key: 'basic', title: 'Basic', description: 'Job Details', icon: <InfoCircleOutlined /> },
  { key: 'client', title: 'Client & Booking', description: 'Client & Address', icon: <UserOutlined /> },
  { key: 'container', title: 'Container & Vehicle', description: 'Assets & Drivers', icon: <CarOutlined /> },
  { key: 'movement', title: 'Movement', description: 'Gate Times', icon: <ClockCircleOutlined /> },
  { key: 'charges', title: 'Charges', description: 'Freight & Expenses', icon: <DollarOutlined /> },
  { key: 'vendor', title: 'Vendor & Payment', description: 'Fleet Provider', icon: <WalletOutlined /> },
  { key: 'route', title: 'Route & Documents', description: 'Route & Invoicing', icon: <CompassOutlined /> },
  { key: 'review', title: 'Review', description: 'Confirm & Submit', icon: <CheckCircleOutlined /> },
];

export const EnquiryForm: React.FC<EnquiryFormProps> = ({
  initialValues,
  isEdit = false,
  onSubmit,
  loading = false,
}) => {
  const [form] = Form.useForm();
  const router = useRouter();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // Active step index (0 to 7)
  const [currentStep, setCurrentStep] = useState(0);

  // Guard for billed enquiries
  const initialStage = initialValues?.stage || 'ENQUIRY_CREATED';
  const isBilledStage = initialStage === 'BILLING' || initialStage === 'PROCESSED';
  const [isUnlocked, setIsUnlocked] = useState(!isBilledStage);

  // Unsaved changes tracking
  const [isDirty, setIsDirty] = useState(false);

  // Expandable sections inside steps
  const [showExtraAddress, setShowExtraAddress] = useState(false);

  // AutoComplete options for vehicle, driver, container
  const [vehicleOptions, setVehicleOptions] = useState<{ value: string; label: string; item?: any }[]>([]);
  const [driverOptions, setDriverOptions] = useState<{ value: string; label: string; item?: any }[]>([]);
  const [containerOptions, setContainerOptions] = useState<{ value: string; label: string; item?: any }[]>([]);

  // Watch critical reactive form values
  const noOfContainers = Form.useWatch('noOfContainers', form) || 1;
  const loadingType = Form.useWatch('loadingType', form) || 'Import';
  const containerSize = Form.useWatch('containerSize', form) || '40 FT';
  const companyId = Form.useWatch('companyId', form);
  const clientId = Form.useWatch('clientId', form);
  const vendorId = Form.useWatch('vendorId', form);
  const paidStatus = Form.useWatch('paidStatus', form) || 'Unpaid';

  // Watch money fields for live financial calculation
  const freightAmount = Form.useWatch('freightAmount', form) || 0;
  const advanceAmount = Form.useWatch('advanceAmount', form) || 0;
  const extraAdvance = Form.useWatch('extraAdvance', form) || 0;
  const dieselAmount = Form.useWatch('dieselAmount', form) || 0;
  const haltingAmount = Form.useWatch('haltingAmount', form) || 0;
  const otherCharges = Form.useWatch('otherCharges', form) || 0;
  const bonus = Form.useWatch('bonus', form) || 0;

  // Additional containers state (for container 2..N)
  const [extraContainers, setExtraContainers] = useState<ContainerDetail[]>([]);

  // Keep extraContainers array in sync with noOfContainers count
  useEffect(() => {
    const targetExtraCount = Math.max(0, Number(noOfContainers) - 1);
    setExtraContainers((prev) => {
      if (prev.length === targetExtraCount) return prev;
      if (prev.length < targetExtraCount) {
        const next = [...prev];
        for (let i = prev.length; i < targetExtraCount; i++) {
          next.push({
            containerNumber: '',
            sealNumber: '',
            vehicleNumber: '',
            driverName: '',
            driverPhone: '',
          });
        }
        return next;
      }
      return prev.slice(0, targetExtraCount);
    });
  }, [noOfContainers]);

  // Synchronize 20FT / 40FT Truck Counts in Section 7 based on Section 1 containerSize & noOfContainers
  useEffect(() => {
    const count = parseInt(String(noOfContainers || 1), 10) || 1;
    const sizeStr = String(containerSize || '');
    if (sizeStr.includes('20')) {
      form.setFieldsValue({
        truckCount20: count,
        truckCount40: 0,
      });
    } else if (sizeStr.includes('40')) {
      form.setFieldsValue({
        truckCount20: 0,
        truckCount40: count,
      });
    }
  }, [containerSize, noOfContainers, form]);

  // Live vendor payable computation (official formula: D7)
  const vendorFinance = useMemo(() => {
    return computeVendorPayable({
      advanceAmount,
      extraAdvance,
      dieselAmount,
      haltingAmount,
      bonus,
    });
  }, [advanceAmount, extraAdvance, dieselAmount, haltingAmount, bonus]);

  // Client total charges
  const clientTotalCharges = useMemo(() => {
    const f = Number(freightAmount) || 0;
    const h = Number(haltingAmount) || 0;
    const o = Number(otherCharges) || 0;
    return Math.round((f + h + o) * 100) / 100;
  }, [freightAmount, haltingAmount, otherCharges]);

  // Load type-ahead lookup suggestions on mount
  useEffect(() => {
    async function loadLookups() {
      try {
        const [vRes, dRes, cRes] = await Promise.all([
          apiClient.get<any>('/master/vehicles?lookup=true&limit=100'),
          apiClient.get<any>('/master/drivers?lookup=true&limit=100'),
          apiClient.get<any>('/master/containers?lookup=true&limit=100'),
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

      if (initialValues.bookingDate) {
        formatted.bookingDate = dayjs(initialValues.bookingDate, 'DD-MM-YYYY').isValid()
          ? dayjs(initialValues.bookingDate, 'DD-MM-YYYY')
          : dayjs(initialValues.bookingDate);
      }

      if (initialValues.paymentDate) {
        formatted.paymentDate = dayjs(initialValues.paymentDate, 'DD-MM-YYYY').isValid()
          ? dayjs(initialValues.paymentDate, 'DD-MM-YYYY')
          : dayjs(initialValues.paymentDate);
      }

      if (initialValues.amountReceivedDate) {
        formatted.amountReceivedDate = dayjs(initialValues.amountReceivedDate, 'DD-MM-YYYY').isValid()
          ? dayjs(initialValues.amountReceivedDate, 'DD-MM-YYYY')
          : dayjs(initialValues.amountReceivedDate);
      }

      if (initialValues.shipmentDate) {
        formatted.shipmentDate = dayjs(initialValues.shipmentDate, 'DD-MM-YYYY').isValid()
          ? dayjs(initialValues.shipmentDate, 'DD-MM-YYYY')
          : dayjs(initialValues.shipmentDate);
      }

      if (initialValues.invoiceDate) {
        formatted.invoiceDate = dayjs(initialValues.invoiceDate, 'DD-MM-YYYY').isValid()
          ? dayjs(initialValues.invoiceDate, 'DD-MM-YYYY')
          : dayjs(initialValues.invoiceDate);
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

      // Default containerSize & noOfContainers
      if (!formatted.noOfContainers) formatted.noOfContainers = 1;
      if (!formatted.containerSize) formatted.containerSize = '40 FT';
      if (!formatted.loadingType) formatted.loadingType = 'Import';
      if (!formatted.movementStatus) formatted.movementStatus = mov.movementStatus || 'NOT_MOVED';
      if (!formatted.shippingStatus) formatted.shippingStatus = mov.shippingStatus || 'PENDING';
      if (!formatted.paidStatus) formatted.paidStatus = 'Unpaid';

      // Multiple containers restore
      if (Array.isArray(initialValues.containers) && initialValues.containers.length > 1) {
        setExtraContainers(initialValues.containers.slice(1));
        formatted.noOfContainers = initialValues.containers.length;
      }

      form.setFieldsValue(formatted);
    } else {
      // Default new enquiry
      const currentYear = new Date().getFullYear();
      const defaultInvoiceNum = `INV-${currentYear}-001`;
      form.setFieldsValue({
        date: dayjs(),
        loadingType: 'Import',
        containerSize: '40 FT',
        noOfContainers: 1,
        truckCount20: 0,
        truckCount40: 1,
        invoiceDate: dayjs(),
        invoiceNumber: defaultInvoiceNum,
        freightAmount: 0,
        dieselAmount: 0,
        advanceAmount: 0,
        extraAdvance: 0,
        haltingDays: 0,
        haltingAmount: 0,
        otherCharges: 0,
        bonus: 0,
        paidStatus: 'Unpaid',
        movementStatus: 'NOT_MOVED',
        shippingStatus: 'PENDING',
        paymentType: 'Cash',
      });

      // Preview live sequential invoice number from server
      apiClient.get<any>('/enquiries/next-number')
        .then((res) => {
          if (res.data?.success && res.data.data?.nextInvoiceNumber) {
            form.setFieldsValue({
              invoiceNumber: res.data.data.nextInvoiceNumber,
            });
          }
        })
        .catch(() => {
          // Keep default INV-YYYY-001
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

  // Handle client selection and pre-fill address/GST if available
  const handleClientChange = (_clientId: string, item?: any) => {
    if (item) {
      if (item.address && !form.getFieldValue('clientAddress')) {
        form.setFieldsValue({ clientAddress: item.address });
      }
      if (item.gstin && !form.getFieldValue('clientGstin')) {
        form.setFieldsValue({ clientGstin: item.gstin });
      }
      if (item.companyId && !form.getFieldValue('companyId')) {
        form.setFieldsValue({ companyId: item.companyId });
      }
    }
  };

  // Validate fields for the given step
  const validateStep = async (stepIndex: number): Promise<boolean> => {
    try {
      if (stepIndex === 0) {
        await form.validateFields(['date', 'loadingType', 'companyId', 'containerSize', 'noOfContainers']);
      } else if (stepIndex === 1) {
        await form.validateFields(['clientId']);
      } else if (stepIndex === 2) {
        await form.validateFields(['vehicleNumber', 'driverPhone', 'containerNumber']);
      } else if (stepIndex === 3) {
        // Validate gate time chronological constraints (Out >= In)
        const values = form.getFieldsValue();
        const pairs = [
          ['companyInTime', 'companyOutTime', 'Factory Gate'],
          ['printInTime', 'printOutTime', 'Print Gate'],
          ['portInTime', 'portOutTime', 'Port Gate'],
        ];
        for (const [inKey, outKey, label] of pairs) {
          const inVal = values[inKey];
          const outVal = values[outKey];
          if (inVal && outVal && dayjs.isDayjs(inVal) && dayjs.isDayjs(outVal)) {
            if (outVal.isBefore(inVal)) {
              message.error(`${label}: Out-time cannot be earlier than In-time`);
              return false;
            }
          }
        }
      } else if (stepIndex === 4) {
        await form.validateFields(['freightAmount']);
      }
      return true;
    } catch {
      return false;
    }
  };

  // Step navigation
  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (!isValid) {
      message.error('Please complete required fields before continuing');
      return;
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStepClick = async (targetStep: number) => {
    if (targetStep < currentStep) {
      setCurrentStep(targetStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // Only jump forward if current step is valid
    const isValid = await validateStep(currentStep);
    if (isValid) {
      setCurrentStep(targetStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Form submission handler
  const handleFinish = async () => {
    try {
      const allFormValues = form.getFieldsValue(true);
      if (!allFormValues.companyId) {
        message.warning('Please select an Operating Company in Section 1');
        setCurrentStep(0);
        return;
      }
      if (!allFormValues.clientId) {
        message.warning('Please select a Client in Section 2');
        setCurrentStep(1);
        return;
      }

      const values = { ...allFormValues, ...form.getFieldsValue() };
      const formatted: Record<string, any> = { ...values };

      // Dates formatting
      if (values.date && dayjs.isDayjs(values.date)) {
        formatted.date = values.date.format('DD-MM-YYYY');
      }
      if (values.bookingDate && dayjs.isDayjs(values.bookingDate)) {
        formatted.bookingDate = values.bookingDate.format('DD-MM-YYYY');
      }
      if (values.paymentDate && dayjs.isDayjs(values.paymentDate)) {
        formatted.paymentDate = values.paymentDate.format('DD-MM-YYYY');
      }
      if (values.amountReceivedDate && dayjs.isDayjs(values.amountReceivedDate)) {
        formatted.amountReceivedDate = values.amountReceivedDate.format('DD-MM-YYYY');
      }
      if (values.shipmentDate && dayjs.isDayjs(values.shipmentDate)) {
        formatted.shipmentDate = values.shipmentDate.format('DD-MM-YYYY');
      }
      if (values.invoiceDate && dayjs.isDayjs(values.invoiceDate)) {
        formatted.invoiceDate = values.invoiceDate.format('DD-MM-YYYY');
      } else if (!formatted.invoiceDate) {
        formatted.invoiceDate = dayjs().format('DD-MM-YYYY');
      }

      if (values.invoiceNumber && String(values.invoiceNumber).trim()) {
        formatted.invoiceNumber = String(values.invoiceNumber).trim();
      } else {
        formatted.invoiceNumber = `INV-${new Date().getFullYear()}-001`;
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
      formatted.otherCharges = Number(values.otherCharges) || 0;
      formatted.bonus = Number(values.bonus) || 0;
      formatted.amountPaid = Number(values.amountPaid) || 0;
      formatted.amountReceived = Number(values.amountReceived) || 0;
      formatted.truckCount20 = parseInt(String(values.truckCount20 || '0'), 10) || 0;
      formatted.truckCount40 = parseInt(String(values.truckCount40 || '0'), 10) || 0;
      formatted.noOfContainers = parseInt(String(values.noOfContainers || '1'), 10) || 1;

      // Clean uppercase assets for primary container
      if (formatted.vehicleNumber) {
        formatted.vehicleNumber = formatted.vehicleNumber.replace(/[\s-]/g, '').toUpperCase();
      }
      if (formatted.containerNumber) {
        formatted.containerNumber = formatted.containerNumber.replace(/[\s-]/g, '').toUpperCase();
      }
      if (formatted.driverPhone) {
        formatted.driverPhone = formatted.driverPhone.replace(/[\s-]/g, '');
      }

      // Clean extra containers array
      const allContainersList = [
        {
          containerNumber: formatted.containerNumber || '',
          sealNumber: formatted.sealNumber || '',
          vehicleNumber: formatted.vehicleNumber || '',
          driverName: formatted.driverName || '',
          driverPhone: formatted.driverPhone || '',
        },
        ...extraContainers.map((c) => ({
          containerNumber: (c.containerNumber || '').replace(/[\s-]/g, '').toUpperCase(),
          sealNumber: c.sealNumber || '',
          vehicleNumber: (c.vehicleNumber || '').replace(/[\s-]/g, '').toUpperCase(),
          driverName: c.driverName || '',
          driverPhone: (c.driverPhone || '').replace(/[\s-]/g, ''),
        })),
      ];
      formatted.containers = allContainersList;

      await onSubmit(formatted);
      setIsDirty(false);
    } catch (err: any) {
      message.error(err?.message || 'Please check form fields for errors');
    }
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
            Modifying critical fields (such as Company, Client, Loading Type, or Freight Amount) may cause
            discrepancies with existing invoices or draft bills.
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
      preserve={true}
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
                <Button size="small" type="primary" danger icon={<UnlockOutlined />} onClick={handleRequestUnlock}>
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

      {/* PROGRESS STEPPER HEADER */}
      <Card
        style={{
          marginBottom: 24,
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          backgroundColor: '#ffffff',
        }}
        bodyStyle={{ padding: isMobile ? '16px' : '20px 24px' }}
      >
        {isMobile ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong style={{ fontSize: 15, color: '#1677ff' }}>
                Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].title}
              </Text>
              <Tag color="blue">{STEPS[currentStep].description}</Tag>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {STEPS.map((s, idx) => (
                <div
                  key={s.key}
                  onClick={() => handleStepClick(idx)}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor:
                      idx === currentStep ? '#1677ff' : idx < currentStep ? '#52c41a' : '#e8e8e8',
                    cursor: idx <= currentStep ? 'pointer' : 'default',
                    transition: 'all 0.3s',
                  }}
                  title={s.title}
                />
              ))}
            </div>
          </div>
        ) : (
          <Steps
            current={currentStep}
            onChange={handleStepClick}
            size="small"
            items={STEPS.map((s, idx) => ({
              title: s.title,
              description: s.description,
              icon: s.icon,
              status: idx === currentStep ? 'process' : idx < currentStep ? 'finish' : 'wait',
            }))}
          />
        )}
      </Card>

      {/* ========================================================================= */}
      {/* STEP 0: BASIC ENQUIRY */}
      {/* ========================================================================= */}
      {currentStep === 0 && (
        <Card
          title={
            <Space>
              <InfoCircleOutlined style={{ color: '#1677ff' }} />
              <span>Section 1: Basic Enquiry Details</span>
            </Space>
          }
          style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        >
          <Paragraph type="secondary" style={{ marginBottom: 20 }}>
            Capture the fundamental parameters to initialize the transport job.
          </Paragraph>

          <Row gutter={24}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="date"
                label="Creation Date"
                rules={[{ required: true, message: 'Creation date is required' }]}
              >
                <DatePicker format="DD-MM-YYYY" style={{ width: '100%' }} disabled={!isUnlocked} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="loadingType"
                label="Type / Loading Type"
                rules={[{ required: true, message: 'Please select loading type' }]}
              >
                <Select
                  placeholder="Select Type"
                  disabled={!isUnlocked}
                  options={[
                    { value: 'Import', label: 'Import' },
                    { value: 'Export', label: 'Export' },
                    { value: 'Empty', label: 'Empty' },
                    { value: 'Offload', label: 'Offload' },
                    { value: 'Flattrack', label: 'Flattrack' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="containerSize"
                label="Container Size"
                rules={[{ required: true, message: 'Please select container size' }]}
              >
                <Select
                  placeholder="Select Size"
                  options={[
                    { value: '20 FT', label: '20 FT' },
                    { value: '40 FT', label: '40 FT' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={12}>
              <Form.Item
                name="companyId"
                label="Operating Company"
                rules={[{ required: true, message: 'Please select an operating company' }]}
                extra="Select company entity raising or managing this transport trip."
              >
                <AsyncMasterSelect entity="companies" placeholder="Search company..." disabled={!isUnlocked} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={12}>
              <Form.Item
                name="noOfContainers"
                label="No. of Containers"
                rules={[{ required: true, message: 'Please select number of containers' }]}
                extra="Dynamically creates container & vehicle assignment cards in Section 3."
              >
                <Select
                  placeholder="Select count (1-15)"
                  options={Array.from({ length: 15 }, (_, i) => ({
                    value: i + 1,
                    label: `${i + 1} Container${i > 0 ? 's' : ''}`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {isEdit && (
            <>
              <Divider style={{ margin: '16px 0' }} />
              <Row gutter={24}>
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
            </>
          )}
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: CLIENT & BOOKING */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <Card
          title={
            <Space>
              <UserOutlined style={{ color: '#1677ff' }} />
              <span>Section 2: Client & Booking Details</span>
            </Space>
          }
          style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        >
          <Paragraph type="secondary" style={{ marginBottom: 20 }}>
            Specify the client, booking reference number, delivery address, and tax information.
          </Paragraph>

          <Row gutter={24}>
            <Col xs={24} sm={12} md={12}>
              <Form.Item
                name="clientId"
                label="Client Name"
                rules={[{ required: true, message: 'Please select a client' }]}
                extra="Select client or click '+ Add New Client' inside the dropdown."
              >
                <AsyncMasterSelect
                  entity="clients"
                  placeholder="Search or add client..."
                  disabled={!isUnlocked}
                  onChange={handleClientChange}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={12}>
              <Form.Item name="bookingNumber" label="Booking Number">
                <Input placeholder="e.g. 31614465" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="bookingDate" label="Booking Date">
                <DatePicker format="DD-MM-YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="weight" label="Cargo Weight">
                <Input placeholder="e.g. 24,500 KG" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="billAmount" label="Client Billing Rate / Amount (INR)">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="₹" placeholder="Rate / Bill" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item name="clientAddress" label="Client Address">
                <Input.TextArea rows={2} placeholder="Primary Delivery / Billing Address" />
              </Form.Item>
            </Col>

            {/* EXPANDABLE ADDITIONAL CLIENT / TAX DETAILS */}
            <Col xs={24} style={{ marginBottom: 16 }}>
              <Button
                type="link"
                style={{ padding: 0 }}
                onClick={() => setShowExtraAddress((prev) => !prev)}
              >
                {showExtraAddress ? '▲ Hide detailed address & tax lines' : '▼ Add more address details (Lines 1-3, PAN, GST)'}
              </Button>
            </Col>

            {showExtraAddress && (
              <>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="clientAdd1" label="Address Line 1">
                    <Input placeholder="Door / Suite / Building" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="clientAdd2" label="Address Line 2">
                    <Input placeholder="Street / Industrial Area" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="clientAdd3" label="Address Line 3">
                    <Input placeholder="City, State, Pincode" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} md={12}>
                  <Form.Item name="clientPan" label="PAN Number">
                    <Input placeholder="10-character PAN (e.g. ABCDE1234F)" maxLength={10} />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} md={12}>
                  <Form.Item name="clientGstin" label="Client GST Number">
                    <Input placeholder="15-character GSTIN (e.g. 33AAAAA0000A1Z5)" maxLength={15} />
                  </Form.Item>
                </Col>
              </>
            )}

            <Col xs={24}>
              <Form.Item name="comments" label="Comments / Instructions">
                <Input.TextArea rows={2} placeholder="Operational notes, special handling instructions, etc." />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: CONTAINER & VEHICLE */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <CarOutlined style={{ color: '#1677ff' }} />
                <span>Section 3: Container & Vehicle Details</span>
              </Space>
              <Tag color="blue">{noOfContainers} Container{noOfContainers > 1 ? 's' : ''} Configured</Tag>
            </div>
          }
          style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        >
          <Paragraph type="secondary" style={{ marginBottom: 20 }}>
            Assign containers, transport vehicles, and drivers for this consignment.
          </Paragraph>

          {/* PRIMARY CONTAINER (CONTAINER 1) */}
          <Card
            type="inner"
            title={
              <Space>
                <Badge count={1} style={{ backgroundColor: '#1677ff' }} />
                <span style={{ fontWeight: 600 }}>Container 1 (Primary Job Record)</span>
              </Space>
            }
            style={{ marginBottom: 16, borderColor: '#d9d9d9', backgroundColor: '#fafafa' }}
          >
            <Row gutter={24}>
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
                    placeholder="MSCU1234567"
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} md={6}>
                <Form.Item name="sealNumber" label="Seal Number">
                  <Input placeholder="e.g. HLK5678711" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} md={6}>
                <Form.Item
                  name="vehicleNumber"
                  label="Vehicle Number"
                  extra="Format: TN04AB1234"
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
                    placeholder="TN04AB1234"
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
                    placeholder="Full name"
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
                        return Promise.reject(new Error('10 digits starting with 6-9'));
                      },
                    },
                  ]}
                >
                  <Input placeholder="9876543210" maxLength={10} />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* DYNAMIC ADDITIONAL CONTAINERS (CONTAINERS 2..N) */}
          {extraContainers.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Collapse
                defaultActiveKey={['container-1']}
                items={extraContainers.map((c, idx) => {
                  const num = idx + 2;
                  const isFilled = Boolean(c.containerNumber || c.vehicleNumber);
                  return {
                    key: `container-${idx}`,
                    label: (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <Space>
                          <Badge count={num} style={{ backgroundColor: '#52c41a' }} />
                          <span style={{ fontWeight: 600 }}>Container {num}</span>
                          {c.containerNumber && <Tag color="blue">{c.containerNumber}</Tag>}
                          {c.vehicleNumber && <Tag color="geekblue">{c.vehicleNumber}</Tag>}
                        </Space>
                        <Tag color={isFilled ? 'green' : 'default'}>{isFilled ? '✓ Configured' : '○ Pending'}</Tag>
                      </div>
                    ),
                    children: (
                      <Row gutter={24}>
                        <Col xs={24} sm={12} md={6}>
                          <Form.Item label="Container Number" extra="4 letters + 7 digits">
                            <Input
                              value={c.containerNumber}
                              placeholder="e.g. HLBU2126820"
                              onChange={(e) => {
                                const val = e.target.value.toUpperCase();
                                setExtraContainers((prev) => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], containerNumber: val };
                                  return copy;
                                });
                                setIsDirty(true);
                              }}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                          <Form.Item label="Seal Number">
                            <Input
                              value={c.sealNumber}
                              placeholder="Seal number"
                              onChange={(e) => {
                                const val = e.target.value;
                                setExtraContainers((prev) => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], sealNumber: val };
                                  return copy;
                                });
                                setIsDirty(true);
                              }}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                          <Form.Item label="Vehicle Number" extra="Format: TN04AB1234">
                            <Input
                              value={c.vehicleNumber}
                              placeholder="e.g. TN20BZ4732"
                              onChange={(e) => {
                                const val = e.target.value.toUpperCase();
                                setExtraContainers((prev) => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], vehicleNumber: val };
                                  return copy;
                                });
                                setIsDirty(true);
                              }}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                          <Form.Item label="Driver Name">
                            <Input
                              value={c.driverName}
                              placeholder="Driver name"
                              onChange={(e) => {
                                const val = e.target.value;
                                setExtraContainers((prev) => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], driverName: val };
                                  return copy;
                                });
                                setIsDirty(true);
                              }}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                          <Form.Item label="Driver Mobile" extra="10 digits starting with 6-9">
                            <Input
                              value={c.driverPhone}
                              placeholder="9876543210"
                              maxLength={10}
                              onChange={(e) => {
                                const val = e.target.value;
                                setExtraContainers((prev) => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], driverPhone: val };
                                  return copy;
                                });
                                setIsDirty(true);
                              }}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    ),
                  };
                })}
              />
            </div>
          )}
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: MOVEMENT & GATE TIMES */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <Card
          title={
            <Space>
              <ClockCircleOutlined style={{ color: '#1677ff' }} />
              <span>Section 4: Movement & Gate Times</span>
            </Space>
          }
          style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        >
          <Paragraph type="secondary" style={{ marginBottom: 20 }}>
            Track checkpoint timestamps across factory, print/customs, and port terminals.
          </Paragraph>

          {/* CHECKPOINT 1: FACTORY / COMPANY */}
          <Card type="inner" title="1. Factory / Company Gate" style={{ marginBottom: 16 }}>
            <Row gutter={24}>
              <Col xs={24} sm={12}>
                <Form.Item label="Factory Gate-In">
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name="companyInTime" noStyle>
                      <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                    </Form.Item>
                    <Button onClick={() => handleSetNow('companyInTime')}>Set now</Button>
                  </Space.Compact>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item label="Factory Gate-Out">
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name="companyOutTime" noStyle>
                      <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                    </Form.Item>
                    <Button onClick={() => handleSetNow('companyOutTime')}>Set now</Button>
                  </Space.Compact>
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* CHECKPOINT 2: PRINT / CUSTOMS */}
          <Card type="inner" title="2. Print / Customs Gate" style={{ marginBottom: 16 }}>
            <Row gutter={24}>
              <Col xs={24} sm={12}>
                <Form.Item label="Print Gate-In">
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name="printInTime" noStyle>
                      <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                    </Form.Item>
                    <Button onClick={() => handleSetNow('printInTime')}>Set now</Button>
                  </Space.Compact>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item label="Print Gate-Out">
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name="printOutTime" noStyle>
                      <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                    </Form.Item>
                    <Button onClick={() => handleSetNow('printOutTime')}>Set now</Button>
                  </Space.Compact>
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* CHECKPOINT 3: PORT TERMINAL */}
          <Card type="inner" title="3. Port Terminal Gate" style={{ marginBottom: 16 }}>
            <Row gutter={24}>
              <Col xs={24} sm={12}>
                <Form.Item label="Port Gate-In">
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name="portInTime" noStyle>
                      <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                    </Form.Item>
                    <Button onClick={() => handleSetNow('portInTime')}>Set now</Button>
                  </Space.Compact>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
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

          {/* STATUSES & BONUS */}
          <Row gutter={24}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="shippingStatus" label="Shipping Status">
                <Select
                  options={[
                    { value: 'PENDING', label: 'Pending' },
                    { value: 'IN_PROGRESS', label: 'In Progress' },
                    { value: 'COMPLETED', label: 'Completed' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="movementStatus" label="Movement Status">
                <Select
                  options={[
                    { value: 'NOT_MOVED', label: 'Not Moved' },
                    { value: 'MOVED', label: 'Moved' },
                    { value: 'Cancelled', label: 'Cancelled' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="bonus" label="Bonus / Trip Incentive (INR)">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="₹" placeholder="0.00" />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: FREIGHT & CHARGES */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <Card
          title={
            <Space>
              <DollarOutlined style={{ color: '#1677ff' }} />
              <span>Section 5: Freight, Advances & Charges</span>
            </Space>
          }
          style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        >
          <Paragraph type="secondary" style={{ marginBottom: 20 }}>
            Record billing freight charges to client and advances/fuel given for transport operations.
          </Paragraph>

          <Row gutter={24}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="freightAmount"
                label="Freight Amount (INR)"
                rules={[{ required: true, message: 'Freight amount is required' }]}
                extra="Base transport charge to client"
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

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="advanceAmount" label="Advance Cash (INR)">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="₹" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="extraAdvance" label="Extra Advance (INR)">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="₹" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="dieselAmount" label="Diesel Advance (INR)">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="₹" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="haltingDays" label="Halting No. of Days">
                <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder="Days" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="haltingAmount" label="Halting Amount (INR)">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="₹" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="otherCharges" label="Other Charges (INR)">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="₹" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="paidStatus" label="Paid Status">
                <Select
                  options={[
                    { value: 'Unpaid', label: 'Unpaid' },
                    { value: 'Partial', label: 'Partial' },
                    { value: 'Paid', label: 'Paid' },
                  ]}
                />
              </Form.Item>
            </Col>

            {(paidStatus === 'Paid' || paidStatus === 'Partial') && (
              <>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="amountReceived" label="Amount Received (INR)">
                    <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="₹" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="amountReceivedDate" label="Amount Received Date">
                    <DatePicker format="DD-MM-YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>

          {/* LIVE CHARGE SUMMARY CARD */}
          <div
            style={{
              marginTop: 16,
              padding: '20px 24px',
              backgroundColor: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Live Charge Summary
                </Text>
                <div style={{ display: 'flex', gap: 24, marginTop: 4, flexWrap: 'wrap' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Client Bill Total</Text>
                    <Title level={4} style={{ margin: 0, color: '#1677ff' }}>
                      {formatCurrencyINR(clientTotalCharges)}
                    </Title>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Vendor Total Payable</Text>
                    <Title level={4} style={{ margin: 0, color: '#389e0d' }}>
                      {formatCurrencyINR(vendorFinance.totalPayable)}
                    </Title>
                  </div>
                </div>
              </div>

              <Space size="middle" wrap>
                <Tag color="blue">Freight: {formatCurrencyINR(freightAmount)}</Tag>
                <Tag color="cyan">Advance: {formatCurrencyINR(advanceAmount + extraAdvance)}</Tag>
                <Tag color="orange">Diesel: {formatCurrencyINR(dieselAmount)}</Tag>
                <Tag color="purple">Halting: {formatCurrencyINR(haltingAmount)}</Tag>
                {otherCharges > 0 && <Tag color="gold">Other: {formatCurrencyINR(otherCharges)}</Tag>}
              </Space>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              * Calculated using official unified business formula: Vendor Total Payable = Advance + Extra Advance + Diesel + Halting + Bonus.
            </Text>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STEP 5: VENDOR & PAYMENT */}
      {/* ========================================================================= */}
      {currentStep === 5 && (
        <Card
          title={
            <Space>
              <WalletOutlined style={{ color: '#1677ff' }} />
              <span>Section 6: Vendor & Fleet Disbursement</span>
            </Space>
          }
          style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        >
          <Paragraph type="secondary" style={{ marginBottom: 20 }}>
            Associate an external transport vendor and manage fleet disbursement records.
          </Paragraph>

          <Row gutter={24}>
            <Col xs={24} sm={12} md={12}>
              <Form.Item
                name="vendorId"
                label="Associated Vendor (Optional)"
                extra="Select if trip is outsourced to a third-party transporter."
              >
                <AsyncMasterSelect entity="vendors" placeholder="Search or add vendor..." allowClear />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={12}>
              <Form.Item name="vendorDriverName" label="Driver Name (Vendor Trip)">
                <Input placeholder="Driver operating vendor vehicle" />
              </Form.Item>
            </Col>

            {vendorId ? (
              <>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="amountPaid" label="Amount Paid to Vendor (INR)">
                    <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="₹" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="paymentType" label="Payment Mode">
                    <Select
                      options={[
                        { value: 'Cash', label: 'Cash' },
                        { value: 'Online', label: 'Online / Bank Transfer' },
                        { value: 'Cheque', label: 'Cheque' },
                        { value: 'UPI', label: 'UPI' },
                      ]}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="paymentDate" label="Payment Date">
                    <DatePicker format="DD-MM-YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <div
                    style={{
                      padding: '12px 16px',
                      backgroundColor: '#f5f5f5',
                      borderRadius: 6,
                      border: '1px dashed #d9d9d9',
                    }}
                  >
                    <Space size="large" wrap>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Vendor Total Payable</Text>
                        <div style={{ fontWeight: 600, color: '#389e0d' }}>{formatCurrencyINR(vendorFinance.totalPayable)}</div>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Halting ({form.getFieldValue('haltingDays') || 0} days)</Text>
                        <div style={{ fontWeight: 600 }}>{formatCurrencyINR(haltingAmount)}</div>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Extra Advance</Text>
                        <div style={{ fontWeight: 600 }}>{formatCurrencyINR(extraAdvance)}</div>
                      </div>
                    </Space>
                  </div>
                </Col>
              </>
            ) : (
              <Col xs={24}>
                <Alert
                  type="info"
                  showIcon
                  message="Internal Fleet Operation"
                  description="No vendor is currently associated. The trip will be recorded as operated by your internal fleet. Select a vendor above if outsourcing."
                />
              </Col>
            )}
          </Row>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STEP 6: ROUTE & DOCUMENTS */}
      {/* ========================================================================= */}
      {currentStep === 6 && (
        <Card
          title={
            <Space>
              <CompassOutlined style={{ color: '#1677ff' }} />
              <span>Section 7: Route & Document Tracking</span>
            </Space>
          }
          style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        >
          <Paragraph type="secondary" style={{ marginBottom: 20 }}>
            Specify shipment route and cross-reference invoice and truck metrics.
          </Paragraph>

          <Row gutter={24}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="shipmentDate" label="Shipment Date">
                <DatePicker format="DD-MM-YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="containerFrom" label="Container From Address">
                <Input placeholder="e.g. ZIRCON CFS" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="containerTo" label="Container To Address">
                <Input placeholder="e.g. GODREJ-AMBATTUR" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Form.Item
                name="invoiceNumber"
                label="Invoice Number"
                extra={`Auto-generated: INV-${new Date().getFullYear()}-001 (auto-increments if blank)`}
              >
                <Input placeholder={`INV-${new Date().getFullYear()}-001`} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Form.Item name="invoiceDate" label="Invoice Date">
                <DatePicker format="DD-MM-YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Form.Item
                name="truckCount20"
                label="20 FT Truck Count"
                extra="Auto-fed from Section 1 Container Size & Count"
              >
                <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder="0" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Form.Item
                name="truckCount40"
                label="40 FT Truck Count"
                extra="Auto-fed from Section 1 Container Size & Count"
              >
                <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STEP 7: REVIEW & SUBMIT */}
      {/* ========================================================================= */}
      {currentStep === 7 && (
        <div>
          <Card
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>Section 8: Review & Confirm Enquiry</span>
              </Space>
            }
            style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          >
            <Paragraph type="secondary" style={{ marginBottom: 20 }}>
              Review all entered information across the 7 sections before saving to the database.
            </Paragraph>

            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {/* 1. Basic Enquiry Summary */}
              <Card
                size="small"
                type="inner"
                title="1. Basic Enquiry"
                extra={
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => setCurrentStep(0)}>
                    Edit
                  </Button>
                }
              >
                <Descriptions column={{ xs: 1, sm: 2, md: 4 }} size="small">
                  <Descriptions.Item label="Date">{formatDate(form.getFieldValue('date'))}</Descriptions.Item>
                  <Descriptions.Item label="Type">
                    <Tag color="blue">{loadingType}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Size">{containerSize}</Descriptions.Item>
                  <Descriptions.Item label="Containers">{noOfContainers}</Descriptions.Item>
                  <Descriptions.Item label="Company ID">{companyId || '-'}</Descriptions.Item>
                </Descriptions>
              </Card>

              {/* 2. Client & Booking Summary */}
              <Card
                size="small"
                type="inner"
                title="2. Client & Booking"
                extra={
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => setCurrentStep(1)}>
                    Edit
                  </Button>
                }
              >
                <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
                  <Descriptions.Item label="Client ID">{clientId || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Booking No">{form.getFieldValue('bookingNumber') || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Booking Date">{formatDate(form.getFieldValue('bookingDate'))}</Descriptions.Item>
                  <Descriptions.Item label="Weight">{form.getFieldValue('weight') || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Rate / Bill">{formatCurrencyINR(form.getFieldValue('billAmount'))}</Descriptions.Item>
                  <Descriptions.Item label="Address">{form.getFieldValue('clientAddress') || '-'}</Descriptions.Item>
                  {form.getFieldValue('clientGstin') && (
                    <Descriptions.Item label="GSTIN">{form.getFieldValue('clientGstin')}</Descriptions.Item>
                  )}
                </Descriptions>
              </Card>

              {/* 3. Container & Vehicles Summary */}
              <Card
                size="small"
                type="inner"
                title={`3. Containers & Vehicles (${noOfContainers} Container${noOfContainers > 1 ? 's' : ''})`}
                extra={
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => setCurrentStep(2)}>
                    Edit
                  </Button>
                }
              >
                <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small" title="Container 1 (Primary)">
                  <Descriptions.Item label="Container No">{form.getFieldValue('containerNumber') || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Seal No">{form.getFieldValue('sealNumber') || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Vehicle No">
                    {form.getFieldValue('vehicleNumber') ? (
                      <Tag color="geekblue">{form.getFieldValue('vehicleNumber')}</Tag>
                    ) : (
                      '-'
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Driver">{form.getFieldValue('driverName') || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Mobile">{form.getFieldValue('driverPhone') || '-'}</Descriptions.Item>
                </Descriptions>

                {extraContainers.map((c, i) => (
                  <div key={i} style={{ marginTop: 12, borderTop: '1px dashed #eee', paddingTop: 8 }}>
                    <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small" title={`Container ${i + 2}`}>
                      <Descriptions.Item label="Container No">{c.containerNumber || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Seal No">{c.sealNumber || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Vehicle No">{c.vehicleNumber || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Driver">{c.driverName || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Mobile">{c.driverPhone || '-'}</Descriptions.Item>
                    </Descriptions>
                  </div>
                ))}
              </Card>

              {/* 4. Movement Summary */}
              <Card
                size="small"
                type="inner"
                title="4. Movement & Gate Times"
                extra={
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => setCurrentStep(3)}>
                    Edit
                  </Button>
                }
              >
                <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
                  <Descriptions.Item label="Factory In">
                    {form.getFieldValue('companyInTime') ? dayjs(form.getFieldValue('companyInTime')).format('DD-MM-YYYY hh:mm A') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Factory Out">
                    {form.getFieldValue('companyOutTime') ? dayjs(form.getFieldValue('companyOutTime')).format('DD-MM-YYYY hh:mm A') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Port In">
                    {form.getFieldValue('portInTime') ? dayjs(form.getFieldValue('portInTime')).format('DD-MM-YYYY hh:mm A') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Shipping Status">
                    <Tag color="cyan">{form.getFieldValue('shippingStatus') || 'PENDING'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Movement Status">
                    <Tag>{form.getFieldValue('movementStatus') || 'NOT_MOVED'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Bonus">{formatCurrencyINR(bonus)}</Descriptions.Item>
                </Descriptions>
              </Card>

              {/* 5. Freight & Charges Summary */}
              <Card
                size="small"
                type="inner"
                title="5. Freight & Charges"
                extra={
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => setCurrentStep(4)}>
                    Edit
                  </Button>
                }
              >
                <Descriptions column={{ xs: 1, sm: 2, md: 4 }} size="small">
                  <Descriptions.Item label="Freight">{formatCurrencyINR(freightAmount)}</Descriptions.Item>
                  <Descriptions.Item label="Advance">{formatCurrencyINR(advanceAmount)}</Descriptions.Item>
                  <Descriptions.Item label="Extra Advance">{formatCurrencyINR(extraAdvance)}</Descriptions.Item>
                  <Descriptions.Item label="Diesel">{formatCurrencyINR(dieselAmount)}</Descriptions.Item>
                  <Descriptions.Item label="Halting ({form.getFieldValue('haltingDays') || 0}d)">
                    {formatCurrencyINR(haltingAmount)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Other Charges">{formatCurrencyINR(otherCharges)}</Descriptions.Item>
                  <Descriptions.Item label="Client Total">
                    <strong style={{ color: '#1677ff' }}>{formatCurrencyINR(clientTotalCharges)}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="Vendor Payable">
                    <strong style={{ color: '#389e0d' }}>{formatCurrencyINR(vendorFinance.totalPayable)}</strong>
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {/* 6. Vendor & Payment Summary */}
              <Card
                size="small"
                type="inner"
                title="6. Vendor & Fleet Provider"
                extra={
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => setCurrentStep(5)}>
                    Edit
                  </Button>
                }
              >
                <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
                  <Descriptions.Item label="Transporter">{vendorId ? `Vendor: ${vendorId}` : 'Internal Fleet'}</Descriptions.Item>
                  <Descriptions.Item label="Paid Mode">{form.getFieldValue('paymentType') || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Amount Disbursed">
                    {formatCurrencyINR(form.getFieldValue('amountPaid'))}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {/* 7. Route & Documents Summary */}
              <Card
                size="small"
                type="inner"
                title="7. Route & Documents"
                extra={
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => setCurrentStep(6)}>
                    Edit
                  </Button>
                }
              >
                <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
                  <Descriptions.Item label="Route">
                    {form.getFieldValue('containerFrom') || form.getFieldValue('containerTo')
                      ? `${form.getFieldValue('containerFrom') || 'Origin'} ➔ ${form.getFieldValue('containerTo') || 'Destination'}`
                      : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Shipment Date">{formatDate(form.getFieldValue('shipmentDate'))}</Descriptions.Item>
                  <Descriptions.Item label="Invoice No">{form.getFieldValue('invoiceNumber') || `INV-${new Date().getFullYear()}-001 (Auto-generated)`}</Descriptions.Item>
                  <Descriptions.Item label="20 FT Trucks">{form.getFieldValue('truckCount20') || 0}</Descriptions.Item>
                  <Descriptions.Item label="40 FT Trucks">{form.getFieldValue('truckCount40') || 0}</Descriptions.Item>
                </Descriptions>
              </Card>
            </Space>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FORM ACTION FOOTER (STICKY) */}
      {/* ========================================================================= */}
      <Card
        style={{
          position: 'sticky',
          bottom: 16,
          zIndex: 10,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.06)',
          borderRadius: 8,
        }}
        bodyStyle={{ padding: '12px 20px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Button onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>

          <Space size="middle">
            {currentStep > 0 && (
              <Button icon={<ArrowLeftOutlined />} onClick={handlePrev} disabled={loading}>
                Previous
              </Button>
            )}

            {currentStep < STEPS.length - 1 ? (
              <Button type="primary" onClick={handleNext} disabled={loading}>
                Continue <ArrowRightOutlined />
              </Button>
            ) : (
              <ActionConfirmPopover
                title={isEdit ? 'Save Changes to Enquiry?' : 'Are you sure you want to create enquiry?'}
                description={
                  isEdit
                    ? 'All updated movement times, charges, and notes will be saved.'
                    : 'A new transport consignment job will be registered with atomic tracking numbers.'
                }
                okText={isEdit ? 'Yes, Save' : 'Yes, Create'}
                cancelText="No, Cancel"
                onConfirm={async () => {
                  try {
                    await form.validateFields();
                    form.submit();
                  } catch {
                    message.error('Please complete all required fields before creating enquiry.');
                  }
                }}
                disabled={loading}
                loading={loading}
                placement="topRight"
              >
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={loading}
                  size="large"
                  style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', fontWeight: 600 }}
                >
                  {isEdit ? '✓ Save Changes' : '✓ Create Enquiry'}
                </Button>
              </ActionConfirmPopover>
            )}
          </Space>
        </div>
      </Card>
    </Form>
  );
};
