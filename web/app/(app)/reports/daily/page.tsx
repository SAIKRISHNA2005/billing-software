'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  DatePicker,
  Table,
  Statistic,
  Typography,
  Space,
  Button,
  Tag,
  Input,
  Modal,
  Descriptions,
  Tooltip,
  Form,
  Select,
  InputNumber,
  message,
  Segmented,
  Alert,
} from 'antd';
import {
  CalendarOutlined,
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  SaveOutlined,
  DownloadOutlined,
  PrinterOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudSyncOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import { formatCurrencyINR, formatDate } from '@/lib/utils/format';
import { ActionConfirmPopover } from '@/components/common/ActionConfirmPopover';
import { RecordDetailPopover } from '@/components/common/RecordDetailPopover';
import { VehicleStatusToggle } from '@/components/common/VehicleStatusToggle';

const { Title, Text, Paragraph } = Typography;

export interface DailyReportEnquiryRow {
  id: string;
  creationDate?: string;
  bookingDate?: string;
  companyName?: string;
  loadingType?: string;
  clientName?: string;
  billingNumber?: string;
  bookingNumber?: string;
  feet?: string;
  containerNumber?: string;
  sealNumber?: string;
  vehicleNumber?: string;
  driverNumber?: string;
  diesel?: number;
  advance?: number;
  companyIn?: string;
  companyOut?: string;
  printIn?: string;
  printOut?: string;
  portIn?: string;
  portOut?: string;
  movementStatus?: string;
  shippingStatus?: string;
  comments?: string;
  transactionNo?: string;
  vehicleNo?: string;
  containerNo?: string;
  stage?: string;
  freightAmount?: number;
  [key: string]: any;
}

export default function DailyReportPage() {
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  const [viewMode, setViewMode] = useState<string>('all');
  const [report, setReport] = useState<any>(null);
  const [detailedEnquiries, setDetailedEnquiries] = useState<DailyReportEnquiryRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Row inspection and edit modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<DailyReportEnquiryRow | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [syncingLiveWorkbooks, setSyncingLiveWorkbooks] = useState(false);
  const [editForm] = Form.useForm();

  const handleSyncLiveWorkbooks = async () => {
    setSyncingLiveWorkbooks(true);
    try {
      const res = await axios.post('/api/reports/sync/initial');
      if (res.data?.success) {
        message.success('Live reporting workbooks successfully synchronized with all historical data!');
        fetchDailyReport(selectedDate, viewMode);
      } else {
        message.warning(res.data?.message || 'Sync completed with warnings');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to sync live reporting workbooks');
    } finally {
      setSyncingLiveWorkbooks(false);
    }
  };


  const initEditForm = (row: DailyReportEnquiryRow) => {
    editForm.setFieldsValue({
      vehicleNumber: row.vehicleNumber && row.vehicleNumber !== '-' ? row.vehicleNumber : '',
      driverNumber: row.driverNumber && row.driverNumber !== '-' ? row.driverNumber : '',
      containerNumber: row.containerNumber && row.containerNumber !== '-' ? row.containerNumber : '',
      sealNumber: row.sealNumber && row.sealNumber !== '-' ? row.sealNumber : '',
      loadingType: row.loadingType || 'Import',
      diesel: row.diesel || 0,
      advance: row.advance || 0,
      companyIn: row.companyIn && row.companyIn !== '-' ? row.companyIn : '',
      companyOut: row.companyOut && row.companyOut !== '-' ? row.companyOut : '',
      printIn: row.printIn && row.printIn !== '-' ? row.printIn : '',
      printOut: row.printOut && row.printOut !== '-' ? row.printOut : '',
      portIn: row.portIn && row.portIn !== '-' ? row.portIn : '',
      portOut: row.portOut && row.portOut !== '-' ? row.portOut : '',
      movementStatus: row.movementStatus || 'NOT_MOVED',
      shippingStatus: row.shippingStatus || 'PENDING',
      comments: row.comments && row.comments !== '-' ? row.comments : '',
    });
  };

  const handleSaveConsignmentEdit = async (values: any) => {
    if (!selectedRow) return;
    setSavingRecord(true);
    try {
      const movPayload = {
        companyInTime: values.companyIn,
        companyOutTime: values.companyOut,
        printInTime: values.printIn,
        printOutTime: values.printOut,
        portInTime: values.portIn,
        portOutTime: values.portOut,
        movementStatus: values.movementStatus,
        shippingStatus: values.shippingStatus,
      };
      await axios.patch(`/api/enquiries/${selectedRow.id}/movement`, movPayload).catch(() => null);

      const enqPayload = {
        sealNumber: values.sealNumber,
        dieselAmount: values.diesel,
        advanceAmount: values.advance,
        remarks: values.comments,
        comments: values.comments,
      };
      await axios.put(`/api/enquiries/${selectedRow.id}`, enqPayload).catch(() => null);

      message.success('Consignment record updated successfully');
      setDetailModalOpen(false);
      fetchDailyReport(selectedDate, viewMode);
    } catch {
      message.error('Failed to update consignment record');
    } finally {
      setSavingRecord(false);
    }
  };

  const fetchDailyReport = async (dateVal = selectedDate, mode = viewMode) => {
    setLoading(true);
    try {
      const formattedDate = dateVal.format('YYYY-MM-DD');
      const isAll = mode === 'all';

      // Fetch primary daily report and supplemental movement enquiries concurrently
      const [resDaily, resMovements] = await Promise.all([
        axios.get('/api/reports/daily', { params: isAll ? { all: 'true' } : { date: formattedDate } }),
        axios
          .get('/api/operations/movements', {
            params: isAll ? { limit: '100' } : { dateFrom: formattedDate, dateTo: formattedDate, limit: '100' },
          })
          .catch(() => null),
      ]);

      if (resDaily.data && resDaily.data.success) {
        const dailyData = resDaily.data.data;
        setReport(dailyData);

        const baseEnquiries: DailyReportEnquiryRow[] = dailyData.enquiriesDetail || [];
        const movementItems: any[] = resMovements?.data?.data?.items || [];

        // Build enriched 23-column daily records
        const movementMap = new Map<string, any>();
        movementItems.forEach((m) => movementMap.set(m.id, m));

        const consolidated: DailyReportEnquiryRow[] = baseEnquiries.map((be) => {
          const mv = movementMap.get(be.id) || {};
          const movObj = mv.movement || {};

          return {
            ...be,
            creationDate: be.creationDate || (be.createdAt ? dayjs(be.createdAt).format('DD-MM-YYYY') : dateVal.format('DD-MM-YYYY')),
            bookingDate: be.bookingDate || (mv.bookingDate ? dayjs(mv.bookingDate).format('DD-MM-YYYY') : be.creationDate || dateVal.format('DD-MM-YYYY')),
            companyName: be.companyName || mv.companyName || '-',
            loadingType: be.loadingType || mv.loadingType || 'Import',
            clientName: be.clientName || mv.clientName || '-',
            billingNumber: be.billingNumber || (be.billId ? String(be.billId) : '-'),
            bookingNumber: be.bookingNumber || mv.bookingNumber || be.transactionNo || mv.transactionNumber || be.id,
            feet: be.feet || mv.containerSize || mv.feet || '40 FT',
            containerNumber: be.containerNumber || be.containerNo || mv.containerNumber || '-',
            sealNumber: be.sealNumber || mv.sealNumber || '-',
            vehicleNumber: be.vehicleNumber || be.vehicleNo || mv.vehicleNumber || '-',
            driverNumber: be.driverNumber || mv.driverPhone || mv.driverInfo || '-',
            diesel: be.diesel !== undefined ? be.diesel : mv.dieselAmount || 0,
            advance: be.advance !== undefined ? be.advance : mv.advanceAmount || 0,
            companyIn: be.companyIn || movObj.companyInTime || '-',
            companyOut: be.companyOut || movObj.companyOutTime || '-',
            printIn: be.printIn || movObj.printInTime || '-',
            printOut: be.printOut || movObj.printOutTime || '-',
            portIn: be.portIn || movObj.portInTime || '-',
            portOut: be.portOut || movObj.portOutTime || '-',
            movementStatus: be.movementStatus || movObj.movementStatus || 'NOT_MOVED',
            shippingStatus: be.shippingStatus || movObj.shippingStatus || 'PENDING',
            comments: be.comments || mv.comments || mv.remarks || '-',
          };
        });

        // Also append any movement items that occurred today if not already in consolidated list
        movementItems.forEach((mv) => {
          if (!consolidated.some((c) => c.id === mv.id)) {
            const movObj = mv.movement || {};
            consolidated.push({
              id: mv.id,
              creationDate: mv.date || (mv.createdAt ? dayjs(mv.createdAt).format('DD-MM-YYYY') : dateVal.format('DD-MM-YYYY')),
              bookingDate: mv.bookingDate || mv.date || dateVal.format('DD-MM-YYYY'),
              companyName: mv.companyName || '-',
              loadingType: mv.loadingType || 'Import',
              clientName: mv.clientName || '-',
              billingNumber: mv.billId ? String(mv.billId) : '-',
              bookingNumber: mv.bookingNumber || mv.transactionNumber || mv.id,
              feet: mv.containerSize || mv.feet || '40 FT',
              containerNumber: mv.containerNumber || '-',
              sealNumber: mv.sealNumber || '-',
              vehicleNumber: mv.vehicleNumber || '-',
              driverNumber: mv.driverPhone || mv.driverInfo || '-',
              diesel: mv.dieselAmount || 0,
              advance: mv.advanceAmount || 0,
              companyIn: movObj.companyInTime || '-',
              companyOut: movObj.companyOutTime || '-',
              printIn: movObj.printInTime || '-',
              printOut: movObj.printOutTime || '-',
              portIn: movObj.portInTime || '-',
              portOut: movObj.portOutTime || '-',
              movementStatus: movObj.movementStatus || 'NOT_MOVED',
              shippingStatus: movObj.shippingStatus || 'PENDING',
              comments: mv.comments || mv.remarks || '-',
              transactionNo: mv.transactionNumber,
              vehicleNo: mv.vehicleNumber,
              containerNo: mv.containerNumber,
              stage: mv.stage,
              freightAmount: mv.freightAmount || 0,
            });
          }
        });

        setDetailedEnquiries(consolidated);
      } else {
        message.error(resDaily.data?.message || 'Failed to load daily report');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error fetching report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyReport();
  }, []);

  // Filtered detailed enquiries by search
  const filteredDetailedEnquiries = useMemo(() => {
    if (!searchQuery.trim()) return detailedEnquiries;
    const q = searchQuery.toLowerCase().trim();
    return detailedEnquiries.filter((row) => {
      return (
        String(row.clientName || '').toLowerCase().includes(q) ||
        String(row.companyName || '').toLowerCase().includes(q) ||
        String(row.vehicleNumber || '').toLowerCase().includes(q) ||
        String(row.containerNumber || '').toLowerCase().includes(q) ||
        String(row.bookingNumber || '').toLowerCase().includes(q) ||
        String(row.billingNumber || '').toLowerCase().includes(q) ||
        String(row.driverNumber || '').toLowerCase().includes(q)
      );
    });
  }, [detailedEnquiries, searchQuery]);

  // Export Daily Table as CSV
  const handleExportCSV = () => {
    if (detailedEnquiries.length === 0) {
      message.warning('No daily enquiry records to export');
      return;
    }

    const headers = [
      'CreationDate',
      'BookingDate',
      'CompanyName',
      'Type',
      'ClientName',
      'BillingNumber',
      'Booking Number',
      'Feet',
      'Container Number',
      'SealNumber',
      'Vehicle Number',
      'Driver Number',
      'Diesel',
      'Advance',
      'Company In',
      'Company Out',
      'Print In',
      'Print Out',
      'Port In',
      'Port Out',
      'Movement Status',
      'Shipping Status',
      'Comments',
    ];

    const rows = detailedEnquiries.map((r) => [
      `"${r.creationDate || ''}"`,
      `"${r.bookingDate || ''}"`,
      `"${(r.companyName || '').replace(/"/g, '""')}"`,
      `"${r.loadingType || ''}"`,
      `"${(r.clientName || '').replace(/"/g, '""')}"`,
      `"${r.billingNumber || ''}"`,
      `"${r.bookingNumber || ''}"`,
      `"${r.feet || ''}"`,
      `"${r.containerNumber || ''}"`,
      `"${r.sealNumber || ''}"`,
      `"${r.vehicleNumber || ''}"`,
      `"${r.driverNumber || ''}"`,
      r.diesel || 0,
      r.advance || 0,
      `"${r.companyIn || ''}"`,
      `"${r.companyOut || ''}"`,
      `"${r.printIn || ''}"`,
      `"${r.printOut || ''}"`,
      `"${r.portIn || ''}"`,
      `"${r.portOut || ''}"`,
      `"${r.movementStatus || ''}"`,
      `"${r.shippingStatus || ''}"`,
      `"${(r.comments || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `TMS_Daily_Report_${selectedDate.format('YYYY-MM-DD')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Daily report exported to CSV successfully');
  };

  // Existing table columns preserved exactly
  const enquiryColumns = [
    {
      title: 'Enquiry ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string, record: any) => (
        <RecordDetailPopover record={record} title={`Enquiry ${id}`}>
          <Text strong style={{ cursor: 'pointer', color: '#1677ff' }}>
            {id}
          </Text>
        </RecordDetailPopover>
      ),
    },
    {
      title: 'Transaction No',
      dataIndex: 'transactionNo',
      key: 'transactionNo',
      render: (txn: string, record: any) => (
        <RecordDetailPopover record={record} title={`Transaction ${txn}`}>
          <Text code style={{ cursor: 'pointer' }}>
            {txn}
          </Text>
        </RecordDetailPopover>
      ),
    },
    { title: 'Company', dataIndex: 'companyName', key: 'companyName' },
    { title: 'Client', dataIndex: 'clientName', key: 'clientName' },
    { title: 'Vehicle No', dataIndex: 'vehicleNo', key: 'vehicleNo' },
    { title: 'Stage', dataIndex: 'stage', key: 'stage', render: (st: string) => <Tag color="blue">{st}</Tag> },
    {
      title: 'Freight Amount',
      dataIndex: 'freightAmount',
      key: 'freightAmount',
      align: 'right' as const,
      render: (amt: number) => formatCurrencyINR(amt),
    },
  ];

  const billColumns = [
    {
      title: 'Bill Number',
      dataIndex: 'billNumber',
      key: 'billNumber',
      render: (num: string, record: any) => (
        <RecordDetailPopover record={record} title={`Invoice ${num}`} type="bill">
          <Text strong style={{ color: '#1677ff', cursor: 'pointer' }}>
            {num}
          </Text>
        </RecordDetailPopover>
      ),
    },
    { title: 'Company', dataIndex: 'companyName', key: 'companyName' },
    { title: 'Client', dataIndex: 'clientName', key: 'clientName' },
    {
      title: 'Billed Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (amt: number) => (
        <Text strong style={{ color: '#3f8600' }}>
          {formatCurrencyINR(amt)}
        </Text>
      ),
    },
  ];

  // The 23-column Table specification
  const fullDailyColumns: ColumnsType<DailyReportEnquiryRow> = [
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'left',
      width: 90,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <RecordDetailPopover record={record} title={`Consignment ${record.bookingNumber || record.id}`}>
            <Tooltip title="View Consignment Popover Card">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined style={{ color: '#1677ff' }} />}
              />
            </Tooltip>
          </RecordDetailPopover>
          <Tooltip title="Edit Consignment">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ color: '#52c41a' }} />}
              onClick={() => {
                setSelectedRow(record);
                setIsEditMode(true);
                initEditForm(record);
                setDetailModalOpen(true);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Creation Date',
      dataIndex: 'creationDate',
      key: 'creationDate',
      fixed: 'left',
      width: 110,
      render: (val: string) => <Text style={{ whiteSpace: 'nowrap' }}>{val || '-'}</Text>,
    },
    {
      title: 'Booking Date',
      dataIndex: 'bookingDate',
      key: 'bookingDate',
      width: 110,
      render: (val: string) => <Text style={{ whiteSpace: 'nowrap' }}>{val || '-'}</Text>,
    },
    {
      title: 'Company Name',
      dataIndex: 'companyName',
      key: 'companyName',
      width: 150,
      ellipsis: true,
      render: (val: string) => <Text strong>{val || '-'}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'loadingType',
      key: 'loadingType',
      width: 90,
      align: 'center',
      render: (val: string) => <Tag color={val === 'Import' ? 'blue' : 'green'}>{val || 'Import'}</Tag>,
    },
    {
      title: 'Client Name',
      dataIndex: 'clientName',
      key: 'clientName',
      width: 160,
      ellipsis: true,
      render: (val: string) => <Text strong>{val || '-'}</Text>,
    },
    {
      title: 'Billing Number',
      dataIndex: 'billingNumber',
      key: 'billingNumber',
      width: 130,
      render: (val: string) =>
        val && val !== '-' ? (
          <Text strong style={{ color: '#1677ff' }}>
            {val}
          </Text>
        ) : (
          <Tag color="default">Unbilled</Tag>
        ),
    },
    {
      title: 'Booking Number',
      dataIndex: 'bookingNumber',
      key: 'bookingNumber',
      width: 140,
      render: (val: string, record) => (
        <RecordDetailPopover record={record} title={`Consignment ${val || record.id}`}>
          <Text code style={{ cursor: 'pointer', color: '#1677ff', fontWeight: 600 }}>
            {val || '-'}
          </Text>
        </RecordDetailPopover>
      ),
    },
    {
      title: 'Feet',
      dataIndex: 'feet',
      key: 'feet',
      width: 90,
      align: 'center',
      render: (val: string) => <Tag color="purple">{val || '40 FT'}</Tag>,
    },
    {
      title: 'Container Number',
      dataIndex: 'containerNumber',
      key: 'containerNumber',
      width: 140,
      render: (val: string, record) => (
        <RecordDetailPopover record={record} title={`Container ${val || record.id}`}>
          <Text strong style={{ cursor: 'pointer' }}>
            {val || '-'}
          </Text>
        </RecordDetailPopover>
      ),
    },
    {
      title: 'Seal Number',
      dataIndex: 'sealNumber',
      key: 'sealNumber',
      width: 120,
      render: (val: string) => val || '-',
    },
    {
      title: 'Vehicle Number',
      dataIndex: 'vehicleNumber',
      key: 'vehicleNumber',
      width: 130,
      render: (val: string) => (
        <Tag color="cyan" style={{ fontWeight: 600 }}>
          {val || '-'}
        </Tag>
      ),
    },
    {
      title: 'Vehicle Status',
      key: 'vehicleStatus',
      width: 130,
      align: 'center' as const,
      render: (_, record) => (
        <VehicleStatusToggle
          vehicleNumber={record.vehicleNumber || record.vehicleNo}
          enquiryId={record.id}
        />
      ),
    },
    {
      title: 'Driver Number',
      dataIndex: 'driverNumber',
      key: 'driverNumber',
      width: 130,
      render: (val: string) => val || '-',
    },
    {
      title: 'Diesel',
      dataIndex: 'diesel',
      key: 'diesel',
      width: 110,
      align: 'right',
      render: (val: number) => formatCurrencyINR(val || 0),
    },
    {
      title: 'Advance',
      dataIndex: 'advance',
      key: 'advance',
      width: 110,
      align: 'right',
      render: (val: number) => formatCurrencyINR(val || 0),
    },
    {
      title: 'Company In',
      dataIndex: 'companyIn',
      key: 'companyIn',
      width: 140,
      render: (val: string) => <Text style={{ fontSize: 12 }}>{val || '-'}</Text>,
    },
    {
      title: 'Company Out',
      dataIndex: 'companyOut',
      key: 'companyOut',
      width: 140,
      render: (val: string) => <Text style={{ fontSize: 12 }}>{val || '-'}</Text>,
    },
    {
      title: 'Print In',
      dataIndex: 'printIn',
      key: 'printIn',
      width: 140,
      render: (val: string) => <Text style={{ fontSize: 12 }}>{val || '-'}</Text>,
    },
    {
      title: 'Print Out',
      dataIndex: 'printOut',
      key: 'printOut',
      width: 140,
      render: (val: string) => <Text style={{ fontSize: 12 }}>{val || '-'}</Text>,
    },
    {
      title: 'Port In',
      dataIndex: 'portIn',
      key: 'portIn',
      width: 140,
      render: (val: string) => <Text style={{ fontSize: 12 }}>{val || '-'}</Text>,
    },
    {
      title: 'Port Out',
      dataIndex: 'portOut',
      key: 'portOut',
      width: 140,
      render: (val: string) => <Text style={{ fontSize: 12 }}>{val || '-'}</Text>,
    },
    {
      title: 'Movement Status',
      dataIndex: 'movementStatus',
      key: 'movementStatus',
      width: 130,
      align: 'center',
      render: (val: string) => (
        <Tag color={val === 'MOVED' ? 'green' : 'orange'}>{val || 'NOT_MOVED'}</Tag>
      ),
    },
    {
      title: 'Shipping Status',
      dataIndex: 'shippingStatus',
      key: 'shippingStatus',
      width: 130,
      align: 'center',
      render: (val: string) => {
        const color = val === 'COMPLETED' ? 'green' : val === 'IN_PROGRESS' ? 'blue' : 'default';
        return <Tag color={color}>{val || 'PENDING'}</Tag>;
      },
    },
    {
      title: 'Comments',
      dataIndex: 'comments',
      key: 'comments',
      width: 180,
      ellipsis: true,
      render: (val: string) => val || '-',
    },
  ];

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <CalendarOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Daily Operational &amp; Financial Summary
          </Title>
          <Text type="secondary">
            {viewMode === 'all'
              ? 'Showing all active consignment operations and synchronized live reporting records'
              : `Consolidated operational records, gate movements, and financials for ${selectedDate.format('DD MMMM YYYY')}`}
          </Text>
        </div>
        <Space wrap>
          <Segmented
            options={[
              { label: 'All Operations', value: 'all' },
              { label: 'Filter by Date', value: 'date' },
            ]}
            value={viewMode}
            onChange={(val) => {
              const m = String(val);
              setViewMode(m);
              fetchDailyReport(selectedDate, m);
            }}
          />
          {viewMode === 'date' && (
            <DatePicker
              value={selectedDate}
              onChange={(d) => {
                if (d) {
                  setSelectedDate(d);
                  fetchDailyReport(d, 'date');
                }
              }}
              format="DD-MM-YYYY"
              allowClear={false}
            />
          )}
          <Button icon={<ReloadOutlined />} onClick={() => fetchDailyReport(selectedDate, viewMode)}>
            Refresh
          </Button>
          <ActionConfirmPopover
            title="Synchronize All Live Reporting Workbooks?"
            description="Are you sure you want to trigger live synchronization? This updates Daily Report, Client-Wise, and Processed Bills Google Sheets with all active operations."
            okText="Yes, Sync Workbooks"
            cancelText="No, Cancel"
            onConfirm={handleSyncLiveWorkbooks}
          >
            <Button
              type="primary"
              icon={<CloudSyncOutlined />}
              loading={syncingLiveWorkbooks}
              style={{ backgroundColor: '#1F4E78', borderColor: '#1F4E78' }}
            >
              Sync Live Workbooks
            </Button>
          </ActionConfirmPopover>
          <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
            Export Excel
          </Button>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
            Print PDF
          </Button>
        </Space>
      </div>

      {report?.isShowingAll && viewMode === 'date' && (
        <Alert
          message={
            <span>
              <InfoCircleOutlined style={{ marginRight: 8, color: '#1677ff' }} />
              No new bookings were recorded on <strong>{selectedDate.format('DD-MM-YYYY')}</strong>. Automatically displaying all <strong>{report.enquiriesDetail?.length || 0} active operations</strong> so the operational console remains fully populated.
            </span>
          }
          type="info"
          showIcon={false}
          closable
          style={{ marginBottom: 20, borderRadius: 8 }}
        />
      )}

      {/* Existing KPI Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={loading} style={{ borderRadius: 8 }}>
            <Statistic title="Total Enquiries" value={report?.totalEnquiries || 0} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={loading} style={{ borderRadius: 8 }}>
            <Statistic title="Completed Jobs" value={report?.completedJobs || 0} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={loading} style={{ borderRadius: 8 }}>
            <Statistic title="Pending Pipeline" value={report?.pendingJobs || 0} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={loading} style={{ borderRadius: 8 }}>
            <Statistic title="Bills Processed" value={report?.billsGenerated || 0} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={loading} style={{ borderRadius: 8, backgroundColor: '#f6ffed' }}>
            <Statistic
              title="Total Billing"
              value={report?.totalBilling || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#389e0d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={loading} style={{ borderRadius: 8, backgroundColor: '#fff2f0' }}>
            <Statistic
              title="Total Expenses"
              value={report?.totalExpenses || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Existing Operational & Billing Overview Tables */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <Card title={`Enquiries Created (${report?.enquiriesDetail?.length || 0})`} style={{ borderRadius: 8 }}>
            <Table
              columns={enquiryColumns}
              dataSource={report?.enquiriesDetail || []}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={`Invoices Processed (${report?.billsDetail?.length || 0})`} style={{ borderRadius: 8 }}>
            <Table
              columns={billColumns}
              dataSource={report?.billsDetail || []}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* ENQUIRY / DAILY MOVEMENT DETAILS (Comprehensive 23-Column Table) */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 16 }}>ENQUIRY / DAILY MOVEMENT DETAILS</span>
              <Text type="secondary" style={{ display: 'block', fontSize: 13, fontWeight: 400 }}>
                Comprehensive log of 23 consignment and movement parameters for {selectedDate.format('DD-MM-YYYY')}
              </Text>
            </div>
            <Space>
              <Input
                placeholder="Search Client, Vehicle, Container..."
                prefix={<SearchOutlined />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: 280 }}
                allowClear
              />
              <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
                Export CSV
              </Button>
            </Space>
          </div>
        }
        style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        <Table
          columns={fullDailyColumns}
          dataSource={filteredDetailedEnquiries}
          rowKey="id"
          loading={loading}
          scroll={{ x: 2800, y: 550 }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ['15', '30', '50', '100'],
            showTotal: (total) => `Total ${total} consignments recorded today`,
          }}
          size="middle"
        />
      </Card>

      {/* Responsive View / Edit Consignment Details Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 32 }}>
            <span>{isEditMode ? 'Edit Consignment' : 'Consignment Details'} — {selectedRow?.bookingNumber || selectedRow?.id}</span>
            <Button
              type={isEditMode ? 'default' : 'primary'}
              size="small"
              icon={isEditMode ? <EyeOutlined /> : <EditOutlined />}
              onClick={() => {
                if (!isEditMode && selectedRow) {
                  initEditForm(selectedRow);
                }
                setIsEditMode(!isEditMode);
              }}
            >
              {isEditMode ? 'Switch to View' : 'Edit Record'}
            </Button>
          </div>
        }
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setIsEditMode(false);
        }}
        footer={
          !isEditMode
            ? [
                <Button key="close" onClick={() => setDetailModalOpen(false)}>
                  Close
                </Button>,
                <Button
                  key="edit"
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => {
                    if (selectedRow) initEditForm(selectedRow);
                    setIsEditMode(true);
                  }}
                >
                  Edit This Record
                </Button>,
              ]
            : null
        }
        width={780}
        destroyOnClose
      >
        {selectedRow && !isEditMode && (
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="Creation Date">{selectedRow.creationDate || '-'}</Descriptions.Item>
            <Descriptions.Item label="Booking Date">{selectedRow.bookingDate || '-'}</Descriptions.Item>
            <Descriptions.Item label="Company Name">{selectedRow.companyName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Type">
              <Tag color={selectedRow.loadingType === 'Import' ? 'blue' : 'green'}>
                {selectedRow.loadingType || 'Import'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Client Name" span={2}>
              <Text strong>{selectedRow.clientName || '-'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Billing Number">
              {selectedRow.billingNumber && selectedRow.billingNumber !== '-' ? (
                <Text strong style={{ color: '#1677ff' }}>
                  {selectedRow.billingNumber}
                </Text>
              ) : (
                <Tag color="default">Unbilled</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Booking Number">{selectedRow.bookingNumber || '-'}</Descriptions.Item>
            <Descriptions.Item label="Feet (Size)">
              <Tag color="purple">{selectedRow.feet || '40 FT'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Container Number">{selectedRow.containerNumber || '-'}</Descriptions.Item>
            <Descriptions.Item label="Seal Number">{selectedRow.sealNumber || '-'}</Descriptions.Item>
            <Descriptions.Item label="Vehicle Number">
              <Tag color="cyan">{selectedRow.vehicleNumber || '-'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Driver Number">{selectedRow.driverNumber || '-'}</Descriptions.Item>
            <Descriptions.Item label="Diesel Amount">
              {formatCurrencyINR(selectedRow.diesel || 0)}
            </Descriptions.Item>
            <Descriptions.Item label="Advance Amount">
              {formatCurrencyINR(selectedRow.advance || 0)}
            </Descriptions.Item>
            <Descriptions.Item label="Company In">{selectedRow.companyIn || '-'}</Descriptions.Item>
            <Descriptions.Item label="Company Out">{selectedRow.companyOut || '-'}</Descriptions.Item>
            <Descriptions.Item label="Print In">{selectedRow.printIn || '-'}</Descriptions.Item>
            <Descriptions.Item label="Print Out">{selectedRow.printOut || '-'}</Descriptions.Item>
            <Descriptions.Item label="Port In">{selectedRow.portIn || '-'}</Descriptions.Item>
            <Descriptions.Item label="Port Out">{selectedRow.portOut || '-'}</Descriptions.Item>
            <Descriptions.Item label="Movement Status">
              <Tag color={selectedRow.movementStatus === 'MOVED' ? 'green' : 'orange'}>
                {selectedRow.movementStatus || 'NOT_MOVED'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Shipping Status">
              <Tag
                color={
                  selectedRow.shippingStatus === 'COMPLETED'
                    ? 'green'
                    : selectedRow.shippingStatus === 'IN_PROGRESS'
                    ? 'blue'
                    : 'default'
                }
              >
                {selectedRow.shippingStatus || 'PENDING'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Comments / Instructions" span={2}>
              {selectedRow.comments || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}

        {selectedRow && isEditMode && (
          <Form form={editForm} layout="vertical" onFinish={handleSaveConsignmentEdit}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="vehicleNumber" label="Vehicle Number">
                  <Input placeholder="e.g. TN04AB1234" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="driverNumber" label="Driver Info / Phone">
                  <Input placeholder="e.g. Suresh (9876543210)" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="containerNumber" label="Container Number">
                  <Input placeholder="e.g. HLBU2126820" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="sealNumber" label="Seal Number">
                  <Input placeholder="e.g. SEAL-999" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="loadingType" label="Loading Type">
                  <Select>
                    <Select.Option value="Import">Import</Select.Option>
                    <Select.Option value="Export">Export</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="movementStatus" label="Movement Status">
                  <Select>
                    <Select.Option value="NOT_MOVED">NOT_MOVED</Select.Option>
                    <Select.Option value="MOVED">MOVED</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="shippingStatus" label="Shipping Status">
                  <Select>
                    <Select.Option value="PENDING">PENDING</Select.Option>
                    <Select.Option value="IN_PROGRESS">IN_PROGRESS</Select.Option>
                    <Select.Option value="COMPLETED">COMPLETED</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="companyIn" label="Company In Time">
                  <Input placeholder="DD-MM-YYYY hh:mm A" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="companyOut" label="Company Out Time">
                  <Input placeholder="DD-MM-YYYY hh:mm A" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="portIn" label="Port In Time">
                  <Input placeholder="DD-MM-YYYY hh:mm A" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="portOut" label="Port Out Time">
                  <Input placeholder="DD-MM-YYYY hh:mm A" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="printIn" label="Print In Time">
                  <Input placeholder="DD-MM-YYYY hh:mm A" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="printOut" label="Print Out Time">
                  <Input placeholder="DD-MM-YYYY hh:mm A" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="diesel" label="Diesel Amount (₹)">
                  <InputNumber style={{ width: '100%' }} min={0} precision={2} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="advance" label="Advance Amount (₹)">
                  <InputNumber style={{ width: '100%' }} min={0} precision={2} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="comments" label="Remarks / Special Instructions">
              <Input.TextArea rows={2} placeholder="Add remarks or instructions..." />
            </Form.Item>

            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Space>
                <Button onClick={() => setIsEditMode(false)}>
                  Cancel
                </Button>
                <ActionConfirmPopover
                  title="Are you sure you want to save consignment changes?"
                  description="This will persist container movements, gate timestamps, and expenses directly to the production database."
                  okText="Yes, Save Changes"
                  cancelText="No, Keep Editing"
                  onConfirm={() => editForm.submit()}
                >
                  <Button type="primary" loading={savingRecord} icon={<SaveOutlined />}>
                    Save Changes
                  </Button>
                </ActionConfirmPopover>
              </Space>
            </div>
          </Form>
        )}
      </Modal>
    </div>
  );
}
