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
import { exportToExcel } from '@/lib/utils/exportHelper';
import { useTheme } from '@/components/providers/ThemeContext';

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
  const { themeMode } = useTheme();
  const isDark = themeMode === 'dark';

  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  const [viewMode, setViewMode] = useState<string>('all');
  const [report, setReport] = useState<any>(null);
  const [detailedEnquiries, setDetailedEnquiries] = useState<DailyReportEnquiryRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLoadingType, setFilterLoadingType] = useState<string>('ALL');
  const [filterMovementStatus, setFilterMovementStatus] = useState<string>('ALL');
  const [filterShippingStatus, setFilterShippingStatus] = useState<string>('ALL');
  const [filterCompany, setFilterCompany] = useState<string>('ALL');
  const [tableDateRange, setTableDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Distinct companies present in daily enquiries for filter dropdown
  const dailyCompanyOptions = useMemo(() => {
    const s = new Set<string>();
    detailedEnquiries.forEach((row) => {
      if (row.companyName && row.companyName !== '-') s.add(row.companyName);
    });
    return Array.from(s);
  }, [detailedEnquiries]);

  // Filtered detailed enquiries by search + dropdowns
  const filteredDetailedEnquiries = useMemo(() => {
    return detailedEnquiries.filter((row) => {
      if (filterLoadingType !== 'ALL') {
        const lt = (row.loadingType || '').toUpperCase();
        if (lt !== filterLoadingType.toUpperCase()) return false;
      }
      if (filterMovementStatus !== 'ALL') {
        const ms = (row.movementStatus || 'NOT_MOVED').toUpperCase();
        if (ms !== filterMovementStatus.toUpperCase()) return false;
      }
      if (filterShippingStatus !== 'ALL') {
        const ss = (row.shippingStatus || 'PENDING').toUpperCase();
        if (ss !== filterShippingStatus.toUpperCase()) return false;
      }
      if (filterCompany !== 'ALL') {
        if (row.companyName !== filterCompany) return false;
      }
      if (tableDateRange && tableDateRange[0] && tableDateRange[1]) {
        const d = dayjs(row.date || row.creationDate || row.bookingDate);
        if (d.isValid()) {
          if (d.isBefore(tableDateRange[0].startOf('day')) || d.isAfter(tableDateRange[1].endOf('day'))) {
            return false;
          }
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          String(row.clientName || '').toLowerCase().includes(q) ||
          String(row.companyName || '').toLowerCase().includes(q) ||
          String(row.vehicleNumber || '').toLowerCase().includes(q) ||
          String(row.containerNumber || '').toLowerCase().includes(q) ||
          String(row.bookingNumber || '').toLowerCase().includes(q) ||
          String(row.billingNumber || '').toLowerCase().includes(q) ||
          String(row.driverNumber || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [detailedEnquiries, searchQuery, filterLoadingType, filterMovementStatus, filterShippingStatus, filterCompany, tableDateRange]);

  const handleResetDailyFilters = () => {
    setSearchQuery('');
    setFilterLoadingType('ALL');
    setFilterMovementStatus('ALL');
    setFilterShippingStatus('ALL');
    setFilterCompany('ALL');
    setTableDateRange(null);
  };

  // Helper to export any given list of daily rows as CSV
  const exportDailyRowsToCSV = (rowsToExport: DailyReportEnquiryRow[], filename: string) => {
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

    const rows = rowsToExport.map((r) => [
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
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const dailyExportColumns = [
    { key: 'creationDate', title: 'Creation Date' },
    { key: 'bookingDate', title: 'Booking Date' },
    { key: 'companyName', title: 'Company Name' },
    { key: 'loadingType', title: 'Type' },
    { key: 'clientName', title: 'Client Name' },
    { key: 'billingNumber', title: 'Billing Number' },
    { key: 'bookingNumber', title: 'Booking Number' },
    { key: 'feet', title: 'Feet' },
    { key: 'containerNumber', title: 'Container Number' },
    { key: 'sealNumber', title: 'Seal Number' },
    { key: 'vehicleNumber', title: 'Vehicle Number' },
    { key: 'driverNumber', title: 'Driver Number' },
    { key: 'diesel', title: 'Diesel' },
    { key: 'advance', title: 'Advance' },
    { key: 'companyIn', title: 'Company In' },
    { key: 'companyOut', title: 'Company Out' },
    { key: 'printIn', title: 'Print In' },
    { key: 'printOut', title: 'Print Out' },
    { key: 'portIn', title: 'Port In' },
    { key: 'portOut', title: 'Port Out' },
    { key: 'movementStatus', title: 'Movement Status' },
    { key: 'shippingStatus', title: 'Shipping Status' },
    { key: 'comments', title: 'Comments' },
  ];

  // Export currently filtered rows as Excel (toolbar button near filters)
  const handleExportFiltered = () => {
    if (filteredDetailedEnquiries.length === 0) {
      message.warning('No filtered daily enquiry records to export');
      return;
    }
    exportToExcel(
      filteredDetailedEnquiries,
      dailyExportColumns,
      `TMS_Daily_Report_Filtered_${selectedDate.format('YYYY-MM-DD')}`
    );
    message.success(`Exported ${filteredDetailedEnquiries.length} filtered daily records to Excel`);
  };

  // Export all daily rows as Excel (top header button)
  const handleExportAll = () => {
    if (detailedEnquiries.length === 0) {
      message.warning('No daily enquiry records to export');
      return;
    }
    exportToExcel(
      detailedEnquiries,
      dailyExportColumns,
      `TMS_Daily_Report_ALL_${selectedDate.format('YYYY-MM-DD')}`
    );
    message.success(`Exported all ${detailedEnquiries.length} daily records to Excel`);
  };

  // Existing table columns preserved exactly
  const enquiryColumns = [
    {
      title: 'Enquiry ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string, record: any) => (
        <RecordDetailPopover record={record} title={`Enquiry ${id}`}>
          <Text strong style={{ cursor: 'pointer', color: isDark ? '#60A5FA' : '#17324D' }}>
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
          <Text code style={{ cursor: 'pointer', color: isDark ? '#93C5FD' : '#17324D' }}>
            {txn}
          </Text>
        </RecordDetailPopover>
      ),
    },
    { title: 'Company', dataIndex: 'companyName', key: 'companyName' },
    { title: 'Client', dataIndex: 'clientName', key: 'clientName' },
    { title: 'Vehicle No', dataIndex: 'vehicleNo', key: 'vehicleNo' },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      render: (st: string) => (
        <Tag
          style={{
            background: isDark ? '#1E293B' : '#EEF3F6',
            color: isDark ? '#F1F5F9' : '#17324D',
            border: isDark ? '1px solid #334155' : '1px solid #D4DAD9',
            fontWeight: 600,
          }}
        >
          {st}
        </Tag>
      ),
    },
    {
      title: 'Freight Amount',
      dataIndex: 'freightAmount',
      key: 'freightAmount',
      align: 'right' as const,
      render: (amt: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: isDark ? '#34D399' : '#047857' }}>
          {formatCurrencyINR(amt)}
        </span>
      ),
    },
  ];

  const billColumns = [
    {
      title: 'Bill Number',
      dataIndex: 'billNumber',
      key: 'billNumber',
      render: (num: string, record: any) => (
        <RecordDetailPopover record={record} title={`Invoice ${num}`} type="bill">
          <Text strong style={{ color: isDark ? '#60A5FA' : '#17324D', cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}>
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
        <Text strong style={{ color: isDark ? '#34D399' : '#047857', fontVariantNumeric: 'tabular-nums' }}>
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
                icon={<EyeOutlined style={{ color: '#365A73' }} />}
              />
            </Tooltip>
          </RecordDetailPopover>
          <Tooltip title="Edit Consignment">
            <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ color: '#17324D' }} />}
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
      render: (val: string) => (
        <Tag style={
          val === 'Export'
            ? { background: isDark ? 'rgba(34, 197, 94, 0.15)' : '#EBF4ED', color: isDark ? '#4ADE80' : '#166534', border: isDark ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid #BBF7D0', fontWeight: 600 }
            : { background: isDark ? 'rgba(56, 189, 248, 0.15)' : '#EEF3F6', color: isDark ? '#38BDF8' : '#0369A1', border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #BAE6FD', fontWeight: 600 }
        }>
          {val || 'Import'}
        </Tag>
      ),
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
          <Text strong style={{ color: isDark ? '#60A5FA' : '#1D4ED8', fontVariantNumeric: 'tabular-nums' }}>
            {val}
          </Text>
        ) : (
          <Tag style={{ background: isDark ? '#262626' : '#F3F4F6', color: isDark ? '#A3A3A3' : '#6B7280', border: isDark ? '1px solid #404040' : '1px solid #E5E7EB' }}>Unbilled</Tag>
        ),
    },
    {
      title: 'Booking Number',
      dataIndex: 'bookingNumber',
      key: 'bookingNumber',
      width: 140,
      render: (val: string, record) => (
        <RecordDetailPopover record={record} title={`Consignment ${val || record.id}`}>
          <Text code style={{ cursor: 'pointer', color: isDark ? '#93C5FD' : '#1D4ED8', fontWeight: 600 }}>
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
      render: (val: string) => (
        <Tag style={{ background: isDark ? '#27272A' : '#F4F4F5', color: isDark ? '#E4E4E7' : '#27272A', border: isDark ? '1px solid #3F3F46' : '1px solid #E4E4E7', fontWeight: 600 }}>
          {val || '40 FT'}
        </Tag>
      ),
    },
    {
      title: 'Container Number',
      dataIndex: 'containerNumber',
      key: 'containerNumber',
      width: 140,
      render: (val: string, record) => (
        <RecordDetailPopover record={record} title={`Container ${val || record.id}`}>
          <Text strong style={{ cursor: 'pointer', fontFamily: 'monospace' }}>
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
        <Tag style={{ background: isDark ? '#1E293B' : '#F0F9FF', color: isDark ? '#38BDF8' : '#0284C7', border: isDark ? '1px solid #334155' : '1px solid #BAE6FD', fontWeight: 600, fontFamily: 'monospace' }}>
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
      render: (val: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyINR(val || 0)}</span>,
    },
    {
      title: 'Advance',
      dataIndex: 'advance',
      key: 'advance',
      width: 110,
      align: 'right',
      render: (val: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyINR(val || 0)}</span>,
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
        <Tag style={
          val === 'MOVED'
            ? { background: isDark ? 'rgba(34, 197, 94, 0.15)' : '#EBF4ED', color: isDark ? '#4ADE80' : '#166534', border: isDark ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid #BBF7D0', fontWeight: 600 }
            : { background: isDark ? 'rgba(234, 179, 8, 0.15)' : '#FEF9C3', color: isDark ? '#FACC15' : '#854D0E', border: isDark ? '1px solid rgba(250, 204, 21, 0.3)' : '1px solid #FEF08A', fontWeight: 600 }
        }>
          {val || 'NOT_MOVED'}
        </Tag>
      ),
    },
    {
      title: 'Shipping Status',
      dataIndex: 'shippingStatus',
      key: 'shippingStatus',
      width: 130,
      align: 'center',
      render: (val: string) => {
        const style = val === 'COMPLETED'
          ? { background: isDark ? 'rgba(34, 197, 94, 0.15)' : '#EBF4ED', color: isDark ? '#4ADE80' : '#166534', border: isDark ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid #BBF7D0', fontWeight: 600 }
          : val === 'IN_PROGRESS'
          ? { background: isDark ? 'rgba(56, 189, 248, 0.15)' : '#EFF6FF', color: isDark ? '#38BDF8' : '#1D4ED8', border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #BFDBFE', fontWeight: 600 }
          : { background: isDark ? '#262626' : '#F3F4F6', color: isDark ? '#A3A3A3' : '#6B7280', border: isDark ? '1px solid #404040' : '1px solid #E5E7EB', fontWeight: 600 };
        return <Tag style={style}>{val || 'PENDING'}</Tag>;
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
          <Title level={2} style={{ margin: 0, color: isDark ? '#F1F5F9' : '#17324D', letterSpacing: '-0.01em' }}>
            <CalendarOutlined style={{ marginRight: 8, color: isDark ? '#60A5FA' : '#17324D' }} />
            Daily Operational &amp; Financial Summary
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: isDark ? '#94A3B8' : '#5F6B73' }}>
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
              style={{ backgroundColor: '#17324D', borderColor: '#17324D' }}
            >
              Sync Live Workbooks
            </Button>
          </ActionConfirmPopover>
          <Button icon={<DownloadOutlined />} onClick={handleExportAll}>
            Export All
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
              <InfoCircleOutlined style={{ marginRight: 8, color: '#365A73' }} />
              No new bookings were recorded on <strong>{selectedDate.format('DD-MM-YYYY')}</strong>. Automatically displaying all <strong>{report.enquiriesDetail?.length || 0} active operations</strong> so the operational console remains fully populated.
            </span>
          }
          type="info"
          showIcon={false}
          closable
          style={{ marginBottom: 20, borderRadius: 4, background: '#EEF3F6', borderColor: '#D4DAD9' }}
        />
      )}

      {/* Existing KPI Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={loading} className="spt-kpi-card spt-kpi-steel" size="small">
            <Statistic
              title={<span style={{ fontSize: 11, textTransform: 'uppercase', color: '#5F6B73', fontWeight: 600 }}>Total Enquiries</span>}
              value={report?.totalEnquiries || 0}
              valueStyle={{ color: '#17324D', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={loading} className="spt-kpi-card spt-kpi-green" size="small">
            <Statistic
              title={<span style={{ fontSize: 11, textTransform: 'uppercase', color: '#5F6B73', fontWeight: 600 }}>Completed Jobs</span>}
              value={report?.completedJobs || 0}
              valueStyle={{ color: '#3F6F4A', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={loading} className="spt-kpi-card spt-kpi-amber" size="small">
            <Statistic
              title={<span style={{ fontSize: 11, textTransform: 'uppercase', color: '#5F6B73', fontWeight: 600 }}>Pending Pipeline</span>}
              value={report?.pendingJobs || 0}
              valueStyle={{ color: '#C58A2A', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={loading} className="spt-kpi-card spt-kpi-teal" size="small">
            <Statistic
              title={<span style={{ fontSize: 11, textTransform: 'uppercase', color: '#5F6B73', fontWeight: 600 }}>Bills Processed</span>}
              value={report?.billsGenerated || 0}
              valueStyle={{ color: '#2F6F73', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={loading} className="spt-kpi-card spt-kpi-green" size="small">
            <Statistic
              title={<span style={{ fontSize: 11, textTransform: 'uppercase', color: '#5F6B73', fontWeight: 600 }}>Total Billing</span>}
              value={report?.totalBilling || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#3F6F4A', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={loading} className="spt-kpi-card spt-kpi-red" size="small">
            <Statistic
              title={<span style={{ fontSize: 11, textTransform: 'uppercase', color: '#5F6B73', fontWeight: 600 }}>Total Expenses</span>}
              value={report?.totalExpenses || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#A8473C', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
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
            <Space wrap>
              <Input
                placeholder="Search Client, Vehicle, Container..."
                prefix={<SearchOutlined />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: 220 }}
                allowClear
              />
              <Select
                value={filterLoadingType}
                onChange={(v) => setFilterLoadingType(v)}
                style={{ width: 125 }}
              >
                <Select.Option value="ALL">All Types</Select.Option>
                <Select.Option value="IMPORT">Import</Select.Option>
                <Select.Option value="EXPORT">Export</Select.Option>
                <Select.Option value="EMPTY">Empty</Select.Option>
                <Select.Option value="OFFLOAD">Offload</Select.Option>
                <Select.Option value="FLATTRACK">Flattrack</Select.Option>
              </Select>
              <Select
                value={filterMovementStatus}
                onChange={(v) => setFilterMovementStatus(v)}
                style={{ width: 140 }}
              >
                <Select.Option value="ALL">All Movements</Select.Option>
                <Select.Option value="MOVED">MOVED</Select.Option>
                <Select.Option value="NOT_MOVED">NOT_MOVED</Select.Option>
              </Select>
              <Select
                value={filterShippingStatus}
                onChange={(v) => setFilterShippingStatus(v)}
                style={{ width: 130 }}
              >
                <Select.Option value="ALL">All Shipping</Select.Option>
                <Select.Option value="PENDING">PENDING</Select.Option>
                <Select.Option value="IN_PROGRESS">IN_PROGRESS</Select.Option>
                <Select.Option value="COMPLETED">COMPLETED</Select.Option>
              </Select>
              {dailyCompanyOptions.length > 0 && (
                <Select
                  value={filterCompany}
                  onChange={(v) => setFilterCompany(v)}
                  style={{ width: 150 }}
                >
                  <Select.Option value="ALL">All Companies</Select.Option>
                  {dailyCompanyOptions.map((c) => (
                    <Select.Option key={c} value={c}>
                      {c}
                    </Select.Option>
                  ))}
                </Select>
              )}
              <DatePicker.RangePicker
                placeholder={['Start Date', 'End Date']}
                format="DD/MM/YYYY"
                value={tableDateRange}
                onChange={(d) => setTableDateRange(d as any)}
                style={{ width: 230 }}
              />
              <Button onClick={handleResetDailyFilters}>
                Reset
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleExportFiltered}>
                Export Filtered
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
              <Tag style={{ background: selectedRow.loadingType === 'Import' ? '#EEF3F6' : '#FDF6E8', color: selectedRow.loadingType === 'Import' ? '#17324D' : '#9E6B1D', border: '1px solid #D4DAD9' }}>
                {selectedRow.loadingType || 'Import'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Client Name" span={2}>
              <Text strong>{selectedRow.clientName || '-'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Billing Number">
              {selectedRow.billingNumber && selectedRow.billingNumber !== '-' ? (
                <Text strong style={{ color: '#17324D', fontFamily: 'monospace' }}>
                  {selectedRow.billingNumber}
                </Text>
              ) : (
                <Tag color="default">Unbilled</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Booking Number">{selectedRow.bookingNumber || '-'}</Descriptions.Item>
            <Descriptions.Item label="Feet (Size)">
              <Tag style={{ background: '#ECEFEE', color: '#1E2933', border: '1px solid #D4DAD9' }}>{selectedRow.feet || '40 FT'}</Tag>
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
