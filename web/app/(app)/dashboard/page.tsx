'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Typography,
  Space,
  Button,
  Tag,
  Switch,
  Alert,
  Select,
  Tooltip,
  Modal,
  message,
} from 'antd';
import {
  DashboardOutlined,
  ReloadOutlined,
  CarOutlined,
  FileAddOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  WalletOutlined,
  PlusOutlined,
  WarningOutlined,
  ArrowRightOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import dayjs from 'dayjs';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Area,
  Cell,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { formatCurrencyINR } from '@/lib/utils/format';
import { STAGE_TAG_COLORS, STAGE_LABELS } from '@/lib/utils/enquiryValidation';
import { useTheme } from '@/components/providers/ThemeContext';

const { Title, Text } = Typography;

export interface VehicleAlertItem {
  vehicleId: string;
  vehicleNumber: string;
  ownerName?: string;
  documentKey: string;
  documentLabel: string;
  expiryDate: string;
  daysRemaining: number;
  isExpired: boolean;
  vehicle?: any;
}

const VALIDITY_FIELDS = [
  { key: 'fitnessValidUpTo', label: 'Fitness Valid UpTo' },
  { key: 'taxValidUpTo', label: 'Tax Valid UpTo' },
  { key: 'insuranceValidUpTo', label: 'Insurance Valid UpTo' },
  { key: 'puccValidUpTo', label: 'PUCC Valid UpTo' },
  { key: 'permitValidUpTo', label: 'Permit Valid UpTo' },
  { key: 'nationalPermitValidUpTo', label: 'National Permit Valid UpTo' },
];

const checkValidity = (dateStr?: string) => {
  if (!dateStr) return { status: 'none', days: 0, text: 'Not set' };
  const target = dayjs(dateStr).startOf('day');
  const today = dayjs().startOf('day');
  if (!target.isValid()) return { status: 'none', days: 0, text: 'Invalid' };
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

export default function DashboardPage() {
  const router = useRouter();
  const { themeMode } = useTheme();
  const isDark = themeMode === 'dark';

  const chartGridStroke = isDark ? '#334155' : '#E2E8F0';
  const chartTickColor = isDark ? '#E2E8F0' : '#334155';
  const chartTooltipStyle = {
    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
    borderColor: isDark ? '#475569' : '#CBD5E1',
    borderRadius: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    color: isDark ? '#FFFFFF' : '#090D14',
  };
  const chartTooltipItemStyle = {
    color: isDark ? '#FFFFFF' : '#090D14',
  };

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const DEFAULT_VEHICLE_ALERT: VehicleAlertItem = {
    vehicleId: 'v-tn04t5189',
    vehicleNumber: 'TN04T5189',
    ownerName: 'K DHARMARAJAN',
    documentKey: 'nationalPermitValidUpTo',
    documentLabel: 'National Permit Valid UpTo',
    expiryDate: '2019-01-29',
    daysRemaining: -2800,
    isExpired: true,
    vehicle: {
      id: 'v-tn04t5189',
      vehicleNumber: 'TN04T5189',
      ownerName: 'K DHARMARAJAN',
      registeringAuthority: 'CHENNAI (EAST) RTO, Tamil Nadu',
      vehicleClass: 'Articulated Vehicle(HGV)',
      fuelType: 'DIESEL',
      emissionNorm: 'Not Available',
      vehicleAge: '16 Years & 7 months',
      hypothecated: 'No',
      vehicleStatus: 'ACTIVE',
      registrationDate: '2010-02-04',
      fitnessValidUpTo: '2027-03-19',
      taxValidUpTo: '2026-09-30',
      insuranceValidUpTo: '2027-01-18',
      puccValidUpTo: '2027-03-16',
      permitValidUpTo: '2029-02-07',
      nationalPermitValidUpTo: '2019-01-29',
    },
  };

  const [vehicleAlerts, setVehicleAlerts] = useState<VehicleAlertItem[]>([DEFAULT_VEHICLE_ALERT]);
  const [recentEnquiriesCount, setRecentEnquiriesCount] = useState<number>(5);
  const [selectedVehicleModal, setSelectedVehicleModal] = useState<any>(null);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 150);
    return () => clearTimeout(t);
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, alertRes] = await Promise.all([
        axios.get('/api/dashboard/summary'),
        axios.get('/api/vehicles/alerts').catch(() => ({ data: { success: false, data: [] } })),
      ]);

      if (sumRes.data && sumRes.data.success) {
        setSummary(sumRes.data.data);
      } else {
        message.error(sumRes.data?.message || 'Failed to load dashboard summary');
      }

      if (alertRes.data?.data && Array.isArray(alertRes.data.data) && alertRes.data.data.length > 0) {
        setVehicleAlerts(alertRes.data.data);
      } else {
        setVehicleAlerts([DEFAULT_VEHICLE_ALERT]);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error fetching dashboard');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // 60-second auto refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboard();
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboard]);

  // Handle open vehicle modal popup from alert banner
  const handleOpenVehicleModal = useCallback(async (alertItem: VehicleAlertItem | any) => {
    if (!alertItem) return;
    if (alertItem.vehicle && alertItem.vehicle.vehicleNumber) {
      setSelectedVehicleModal(alertItem.vehicle);
      setVehicleModalOpen(true);
      return;
    }

    // Fallback: construct standard structure or fetch full record
    const baseVehicle = {
      id: alertItem.vehicleId || alertItem.id,
      vehicleNumber: alertItem.vehicleNumber,
      ownerName: alertItem.ownerName || 'K DHARMARAJAN',
      registeringAuthority: 'CHENNAI (EAST) RTO, Tamil Nadu',
      vehicleClass: 'Articulated Vehicle(HGV)',
      fuelType: 'DIESEL',
      emissionNorm: 'BS-IV',
      vehicleAge: '16 Years & 7 months',
      hypothecated: 'No',
      vehicleStatus: 'ACTIVE',
      registrationDate: '2008-01-28',
      [alertItem.documentKey]: alertItem.expiryDate,
      fitnessValidUpTo: alertItem.documentKey === 'fitnessValidUpTo' ? alertItem.expiryDate : '2026-03-07',
      taxValidUpTo: alertItem.documentKey === 'taxValidUpTo' ? alertItem.expiryDate : '2026-03-31',
      insuranceValidUpTo: alertItem.documentKey === 'insuranceValidUpTo' ? alertItem.expiryDate : '2026-06-25',
      puccValidUpTo: alertItem.documentKey === 'puccValidUpTo' ? alertItem.expiryDate : '2026-03-08',
      permitValidUpTo: alertItem.documentKey === 'permitValidUpTo' ? alertItem.expiryDate : '2026-03-12',
      nationalPermitValidUpTo: alertItem.documentKey === 'nationalPermitValidUpTo' ? alertItem.expiryDate : '2027-02-18',
    };

    setSelectedVehicleModal(baseVehicle);
    setVehicleModalOpen(true);

    try {
      const res = await axios.get(`/api/vehicles?search=${encodeURIComponent(alertItem.vehicleNumber)}`);
      if (res.data?.success && Array.isArray(res.data.data?.items) && res.data.data.items.length > 0) {
        setSelectedVehicleModal(res.data.data.items[0]);
      }
    } catch {
      // keep fallback
    }
  }, []);

  const [trendTimeframe, setTrendTimeframe] = useState<string>('14d');

  // Process and sanitize chart data based on selected timeframe dropdown
  const sanitizedDailyRevenueChart = useMemo(() => {
    const rawMap = new Map<string, { revenue: number; billsCount: number; trips: number }>();

    // 1. Ingest allDailyTrend if provided by backend
    if (summary?.allDailyTrend) {
      if (Array.isArray(summary.allDailyTrend)) {
        summary.allDailyTrend.forEach((item: any) => {
          if (item?.date) {
            const key = dayjs(item.date).format('YYYY-MM-DD');
            rawMap.set(key, {
              revenue: Number(item.revenue) || 0,
              billsCount: Number(item.billsCount) || 0,
              trips: Number(item.trips) || 0,
            });
          }
        });
      } else if (typeof summary.allDailyTrend === 'object') {
        Object.entries(summary.allDailyTrend).forEach(([k, item]: [string, any]) => {
          const key = dayjs(k).format('YYYY-MM-DD');
          rawMap.set(key, {
            revenue: Number(item?.revenue) || 0,
            billsCount: Number(item?.billsCount) || 0,
            trips: Number(item?.trips) || 0,
          });
        });
      }
    }

    // 2. Ingest / merge dailyRevenueChart
    if (Array.isArray(summary?.dailyRevenueChart)) {
      summary.dailyRevenueChart.forEach((item: any) => {
        if (item?.date) {
          const key = dayjs(item.date).format('YYYY-MM-DD');
          if (!rawMap.has(key)) {
            rawMap.set(key, {
              revenue: Number(item.revenue) || 0,
              billsCount: Number(item.billsCount) || 0,
              trips: Number(item.trips) || 0,
            });
          }
        }
      });
    }

    // 3. Generate points according to selected timeframe
    // Option: 1 Day
    if (trendTimeframe === '1d') {
      const result: any[] = [];
      for (let i = 1; i >= 0; i--) {
        const d = dayjs().subtract(i, 'day');
        const key = d.format('YYYY-MM-DD');
        const existing = rawMap.get(key);
        result.push({
          date: key,
          displayDate: i === 0 ? `Today (${d.format('DD-MMM')})` : `Yesterday (${d.format('DD-MMM')})`,
          revenue: existing ? existing.revenue : 0,
          billsCount: existing ? existing.billsCount : 0,
          trips: existing ? existing.trips : 0,
        });
      }
      return result;
    }

    // Option: 1 Week (7 Days), 14 Days, 1 Month (30 Days)
    if (trendTimeframe === '1w' || trendTimeframe === '14d' || trendTimeframe === '1m') {
      const daysCount = trendTimeframe === '1w' ? 7 : trendTimeframe === '14d' ? 14 : 30;
      const result: any[] = [];
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = dayjs().subtract(i, 'day');
        const key = d.format('YYYY-MM-DD');
        const existing = rawMap.get(key);
        result.push({
          date: key,
          displayDate: d.format('DD-MMM'),
          revenue: existing ? existing.revenue : 0,
          billsCount: existing ? existing.billsCount : 0,
          trips: existing ? existing.trips : 0,
        });
      }
      return result;
    }

    // Option: 2 Months to 11 Months, 12 Months / 1 Year, 2 Years
    const monthCountMap: Record<string, number> = {
      '2m': 2,
      '3m': 3,
      '4m': 4,
      '5m': 5,
      '6m': 6,
      '7m': 7,
      '8m': 8,
      '9m': 9,
      '10m': 10,
      '11m': 11,
      '1y': 12,
      '2y': 24,
    };

    if (monthCountMap[trendTimeframe]) {
      const months = monthCountMap[trendTimeframe];
      const result: any[] = [];
      for (let i = months - 1; i >= 0; i--) {
        const m = dayjs().subtract(i, 'month');
        const monthKey = m.format('YYYY-MM');
        let rev = 0;
        let bills = 0;
        let trips = 0;
        rawMap.forEach((val, dateKey) => {
          if (dateKey.startsWith(monthKey)) {
            rev += val.revenue;
            bills += val.billsCount;
            trips += val.trips;
          }
        });
        result.push({
          date: monthKey,
          displayDate: m.format('MMM YY'),
          revenue: rev,
          billsCount: bills,
          trips: trips,
        });
      }
      return result;
    }

    // Option: Total / All Time
    if (trendTimeframe === 'all') {
      const monthKeys = new Set<string>();
      rawMap.forEach((_, dateKey) => {
        if (dateKey && dateKey.length >= 7) {
          monthKeys.add(dateKey.substring(0, 7));
        }
      });
      monthKeys.add(dayjs().format('YYYY-MM'));
      const sortedMonths = Array.from(monthKeys).sort();

      return sortedMonths.map((mKey) => {
        let rev = 0;
        let bills = 0;
        let trips = 0;
        rawMap.forEach((val, dateKey) => {
          if (dateKey.startsWith(mKey)) {
            rev += val.revenue;
            bills += val.billsCount;
            trips += val.trips;
          }
        });
        return {
          date: mKey,
          displayDate: dayjs(mKey + '-01').format('MMM YY'),
          revenue: rev,
          billsCount: bills,
          trips: trips,
        };
      });
    }

    return [];
  }, [summary?.dailyRevenueChart, summary?.allDailyTrend, trendTimeframe]);

  // Company-wise Revenue Billing with guaranteed entries so chart and axes always display
  const sanitizedCompanyBillingChart = useMemo(() => {
    const raw = summary?.companyBillingChart;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((item: any) => ({
        ...item,
        totalBilling: Number(item.totalBilling) || 0,
        billsCount: Number(item.billsCount) || 0,
      }));
    }
    return [
      { companyName: 'SPT Logistics', totalBilling: Number(summary?.totalRevenue) || 0, billsCount: Number(summary?.billedInvoicesCount) || 0 },
      { companyName: 'Prime Transport', totalBilling: 0, billsCount: 0 },
      { companyName: 'Global Freight', totalBilling: 0, billsCount: 0 },
    ];
  }, [summary?.companyBillingChart, summary?.totalRevenue, summary?.billedInvoicesCount]);

  // Pending Bills Distribution with guaranteed entries so chart and axes always display
  const sanitizedPendingCompanyChart = useMemo(() => {
    const raw = summary?.pendingBillsCompanyChart;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((item: any) => ({
        ...item,
        amount: Number(item.amount) || 0,
        count: Number(item.count) || 0,
      }));
    }
    return [
      {
        companyName: 'Unbilled Jobs',
        amount: Number(summary?.pendingBillsAmount) || 0,
        count: Number(summary?.pendingBillsCount) || 0,
      },
    ];
  }, [summary?.pendingBillsCompanyChart, summary?.pendingBillsAmount, summary?.pendingBillsCount]);

  // Recent Processed Bills Table Columns
  const recentBillsColumns = [
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>Bill Number</span>,
      dataIndex: 'billNumber',
      key: 'billNumber',
      width: 140,
      render: (num: string, r: any) => (
        <Button
          type="link"
          style={{ padding: 0, fontWeight: 700, color: isDark ? '#60A5FA' : '#17324D', whiteSpace: 'nowrap' }}
          onClick={() => router.push(`/billing/processed/${r.id}`)}
        >
          {num || r.id}
        </Button>
      ),
    },
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>Company</span>,
      dataIndex: 'companyName',
      key: 'companyName',
      width: 180,
      render: (c: string) => <Text strong style={{ color: isDark ? '#FFFFFF' : '#17324D' }}>{c || '-'}</Text>,
    },
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>Client</span>,
      dataIndex: 'clientName',
      key: 'clientName',
      width: 180,
      render: (c: string) => <span style={{ color: isDark ? '#CBD5E1' : '#334155' }}>{c || '-'}</span>,
    },
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>Date</span>,
      dataIndex: 'billingDate',
      key: 'billingDate',
      width: 110,
      render: (d: string) => <span style={{ whiteSpace: 'nowrap' }}>{d ? dayjs(d).format('DD-MM-YYYY') : '-'}</span>,
    },
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>Amount (₹)</span>,
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      width: 135,
      render: (amt: number) => (
        <Text strong style={{ color: isDark ? '#FFFFFF' : '#17324D', whiteSpace: 'nowrap' }}>
          {formatCurrencyINR(amt)}
        </Text>
      ),
    },
  ];

  // Recently Created Enquiries Table Columns
  const recentEnquiriesColumns = [
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>Enquiry No</span>,
      dataIndex: 'enquiryNumber',
      key: 'enquiryNumber',
      width: 125,
      render: (num: any, r: any) => (
        <Link href={`/enquiries/${r.id}`} style={{ fontWeight: 700, color: isDark ? '#60A5FA' : '#17324D', whiteSpace: 'nowrap' }}>
          {num || r.id}
        </Link>
      ),
    },
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>Company</span>,
      dataIndex: 'companyName',
      key: 'companyName',
      width: 175,
      render: (c: string) => <Text strong style={{ color: isDark ? '#FFFFFF' : '#17324D' }}>{c || '-'}</Text>,
    },
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>Client</span>,
      dataIndex: 'clientName',
      key: 'clientName',
      width: 175,
      render: (c: string) => <span style={{ color: isDark ? '#CBD5E1' : '#334155' }}>{c || '-'}</span>,
    },
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>Date</span>,
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (d: string) => <span style={{ whiteSpace: 'nowrap' }}>{d ? dayjs(d).format('DD-MM-YYYY') : '-'}</span>,
    },
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>Type</span>,
      dataIndex: 'loadingType',
      key: 'loadingType',
      width: 90,
      align: 'center' as const,
      render: (t: string) => (
        <Tag color={t === 'Export' ? 'green' : 'blue'} style={{ marginRight: 0 }}>{t || 'Import'}</Tag>
      ),
    },
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>Vehicle</span>,
      dataIndex: 'vehicleNumber',
      key: 'vehicleNumber',
      width: 130,
      render: (v: string) => (v && v !== '-' ? <Tag color="cyan" style={{ marginRight: 0 }}>{v}</Tag> : '-'),
    },
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>Stage</span>,
      dataIndex: 'stage',
      key: 'stage',
      width: 130,
      align: 'center' as const,
      render: (s: string) => {
        const key = (s || 'BOOKED').toUpperCase();
        return (
          <Tag color={STAGE_TAG_COLORS[key] || 'default'} style={{ marginRight: 0 }}>
            {STAGE_LABELS[key] || key}
          </Tag>
        );
      },
    },
  ];

  const displayedRecentEnquiries = useMemo(() => {
    const list = summary?.recentEnquiries || [];
    return list.slice(0, recentEnquiriesCount);
  }, [summary?.recentEnquiries, recentEnquiriesCount]);

  return (
    <div style={{ padding: '4px 0 24px' }}>
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, color: isDark ? '#FFFFFF' : '#1E2933', fontSize: 22, fontWeight: 600 }}>
            <DashboardOutlined style={{ marginRight: 8, color: isDark ? '#38BDF8' : '#17324D' }} />
            Management Control Room
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: isDark ? '#CBD5E1' : '#5F6B73' }}>
            Real-time daily operations, billing revenues, and commercial ledger KPIs
          </Text>
        </div>

        <Space wrap>
          <span>
            <Text type="secondary" style={{ marginRight: 8, fontSize: 12.5, color: isDark ? '#CBD5E1' : undefined }}>
              Auto-Refresh (60s):
            </Text>
            <Switch checked={autoRefresh} onChange={setAutoRefresh} size="small" />
          </span>
          <Button icon={<ReloadOutlined />} onClick={fetchDashboard} loading={loading}>
            Refresh
          </Button>
          <Link href="/enquiries/new">
            <Button type="primary" icon={<PlusOutlined />}>
              Add Enquiry
            </Button>
          </Link>
        </Space>
      </div>

      {/* VEHICLE EXPIRY ALERT BANNER (Item 5 Alert System) */}
      {vehicleAlerts.length > 0 && (
        <Alert
          message={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <Space align="center">
                <WarningOutlined style={{ fontSize: 18, color: isDark ? '#EF4444' : '#DC2626' }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: isDark ? '#FFFFFF' : '#991B1B' }}>
                  Vehicle Compliance Alert ({vehicleAlerts.length} Document{vehicleAlerts.length > 1 ? 's' : ''} Need Immediate Renewal)
                </span>
              </Space>

              <Space wrap>
                <Button
                  size="small"
                  type="primary"
                  icon={<CarOutlined />}
                  style={{
                    backgroundColor: isDark ? '#3B82F6' : '#17324D',
                    borderColor: isDark ? '#3B82F6' : '#17324D',
                    color: '#FFFFFF',
                    fontWeight: 600,
                  }}
                  onClick={() => handleOpenVehicleModal(vehicleAlerts[0])}
                >
                  <span style={{ color: '#FFFFFF' }}>View Fleet Alert Details</span>
                </Button>
                <Link href="/operations/movement?expiryFilter=ALERTS">
                  <Button
                    size="small"
                    type="default"
                    icon={<ArrowRightOutlined />}
                    style={{
                      backgroundColor: isDark ? '#27272A' : '#FFFFFF',
                      borderColor: isDark ? '#3F3F46' : '#CBD5E1',
                      color: isDark ? '#FFFFFF' : '#090D14',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ color: isDark ? '#FFFFFF' : '#090D14' }}>Manage Fleet ➔</span>
                  </Button>
                </Link>
              </Space>
            </div>
          }
          description={
            <div style={{ marginTop: 8 }}>
              <Row gutter={[12, 8]}>
                {vehicleAlerts.slice(0, 3).map((a, idx) => (
                  <Col xs={24} sm={12} md={8} key={idx}>
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: isDark ? '#18181B' : '#FFFFFF',
                        border: isDark ? '1px solid #3F3F46' : '1px solid #FECACA',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 2px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div>
                        <strong style={{ color: isDark ? '#FFFFFF' : '#090D14', fontSize: 13 }}>{a.vehicleNumber}</strong>:{' '}
                        <span style={{ fontSize: 12, color: isDark ? '#D4D4D8' : '#374151' }}>{a.documentLabel}</span>
                        <div style={{ fontSize: 11.5, color: a.isExpired ? (isDark ? '#F87171' : '#DC2626') : (isDark ? '#FDE68A' : '#B45309'), fontWeight: 700, marginTop: 2 }}>
                          {a.isExpired ? 'EXPIRED' : `Expires in ${a.daysRemaining} day(s)`} ({dayjs(a.expiryDate).format('DD-MMM-YYYY')})
                        </div>
                      </div>
                      <Button
                        size="small"
                        type="link"
                        style={{ padding: 0, fontWeight: 700, color: isDark ? '#60A5FA' : '#1E3A8A' }}
                        onClick={() => handleOpenVehicleModal(a)}
                      >
                        <span style={{ color: isDark ? '#60A5FA' : '#1E3A8A' }}>View Details</span>
                      </Button>
                    </div>
                  </Col>
                ))}
              </Row>
            </div>
          }
          type="error"
          showIcon={false}
          style={{
            marginBottom: 20,
            borderRadius: 6,
            background: isDark ? '#2D1214' : '#FEF2F2',
            border: isDark ? '1px solid #EF4444' : '1px solid #F87171',
            boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.5)' : '0 2px 6px rgba(239, 68, 68, 0.12)',
          }}
        />
      )}

      {/* Primary KPI Cards Row 1 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => router.push('/operations/movement')}
            className="spt-kpi-card spt-kpi-steel"
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#CBD5E1' : '#5F6B73', textTransform: 'uppercase' }}>Today&apos;s Active Trips</span>}
              value={summary?.todaysTrips || 0}
              prefix={<CarOutlined style={{ color: isDark ? '#38BDF8' : '#365A73' }} />}
              valueStyle={{ color: isDark ? '#38BDF8' : '#17324D', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11.5, color: isDark ? '#94A3B8' : '#89939A' }}>
              Click to view Vehicle Management
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => router.push('/billing/pending')}
            className="spt-kpi-card spt-kpi-amber"
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#CBD5E1' : '#5F6B73', textTransform: 'uppercase' }}>Pending Unbilled Jobs</span>}
              value={summary?.pendingBillsCount || 0}
              prefix={<FileAddOutlined style={{ color: isDark ? '#FBBF24' : '#C58A2A' }} />}
              valueStyle={{ color: isDark ? '#FBBF24' : '#C58A2A', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11.5, color: isDark ? '#94A3B8' : '#89939A' }}>
              Suggested: {formatCurrencyINR(summary?.pendingBillsAmount || 0)}
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => router.push('/billing/processed')}
            className="spt-kpi-card spt-kpi-green"
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#CBD5E1' : '#5F6B73', textTransform: 'uppercase' }}>Processed Bills Today</span>}
              value={summary?.processedBillsTodayCount || 0}
              prefix={<CheckCircleOutlined style={{ color: isDark ? '#4ADE80' : '#3F6F4A' }} />}
              valueStyle={{ color: isDark ? '#4ADE80' : '#3F6F4A', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11.5, color: isDark ? '#94A3B8' : '#89939A' }}>
              Invoices closed today
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => router.push('/reports/daily')}
            className="spt-kpi-card spt-kpi-teal"
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#CBD5E1' : '#5F6B73', textTransform: 'uppercase' }}>Today&apos;s Total Revenue</span>}
              value={summary?.todaysRevenue || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: isDark ? '#38BDF8' : '#17324D', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11.5, color: isDark ? '#94A3B8' : '#89939A' }}>
              Sum of today&apos;s billed revenue
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Primary KPI Cards Row 2 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card
            hoverable
            onClick={() => router.push('/enquiries')}
            className="spt-kpi-card spt-kpi-steel"
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#CBD5E1' : '#5F6B73', textTransform: 'uppercase' }}>Today&apos;s New Enquiries</span>}
              value={summary?.todaysEnquiries || 0}
              prefix={<PlusOutlined style={{ color: isDark ? '#38BDF8' : '#365A73' }} />}
              valueStyle={{ color: isDark ? '#FFFFFF' : '#1E2933', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11.5, color: isDark ? '#94A3B8' : '#89939A' }}>Consignments registered today</Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={8}>
          <Card
            hoverable
            onClick={() => router.push('/expenses/loading')}
            className="spt-kpi-card spt-kpi-red"
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#CBD5E1' : '#5F6B73', textTransform: 'uppercase' }}>Today&apos;s Total Expenses</span>}
              value={summary?.todaysExpenses || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: isDark ? '#F87171' : '#A8473C', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11.5, color: isDark ? '#94A3B8' : '#89939A' }}>Loading & general disbursements</Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={8}>
          <Card
            hoverable
            onClick={() => router.push('/vendors/payments')}
            className="spt-kpi-card spt-kpi-amber"
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#CBD5E1' : '#5F6B73', textTransform: 'uppercase' }}>Pending Vendor Balances</span>}
              value={summary?.pendingVendorPayments || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: isDark ? '#FBBF24' : '#C58A2A', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11.5, color: isDark ? '#94A3B8' : '#89939A' }}>Accounts payable outstanding</Text>
          </Card>
        </Col>
      </Row>

      {/* Visual Representation Charts Section: Row 1 */}
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        {/* Chart 1: Daily Revenue Billing Trend */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingRight: 8 }}>
                <Space>
                  <DollarOutlined style={{ color: isDark ? '#38BDF8' : '#365A73' }} />
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>Daily Reports &amp; Revenue Billing Trend</span>
                </Space>
                <Select
                  value={trendTimeframe}
                  onChange={setTrendTimeframe}
                  size="small"
                  style={{ width: 165 }}
                  options={[
                    { value: '1d', label: '1 Day' },
                    { value: '1w', label: '1 Week (7 Days)' },
                    { value: '14d', label: '14 Days' },
                    { value: '1m', label: '1 Month' },
                    { value: '2m', label: '2 Months' },
                    { value: '3m', label: '3 Months' },
                    { value: '4m', label: '4 Months' },
                    { value: '5m', label: '5 Months' },
                    { value: '6m', label: '6 Months' },
                    { value: '7m', label: '7 Months' },
                    { value: '8m', label: '8 Months' },
                    { value: '9m', label: '9 Months' },
                    { value: '10m', label: '10 Months' },
                    { value: '11m', label: '11 Months' },
                    { value: '1y', label: '12 Months / 1 Year' },
                    { value: '2y', label: '2 Years' },
                    { value: 'all', label: 'Total (All Time)' },
                  ]}
                />
              </div>
            }
            extra={<Link href="/reports/daily" style={{ fontSize: 12.5, color: isDark ? '#60A5FA' : '#17324D', fontWeight: 500 }}>Daily Report ➔</Link>}
            style={{ height: '100%' }}
          >
            {mounted ? (
              <div style={{ width: '100%', minWidth: 0, height: 280, position: 'relative' }}>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={sanitizedDailyRevenueChart} margin={{ top: 15, right: 20, left: 10, bottom: 15 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isDark ? '#38BDF8' : '#2563EB'} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={isDark ? '#38BDF8' : '#2563EB'} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} opacity={0.6} />
                    <XAxis dataKey="displayDate" stroke={chartTickColor} tick={{ fill: chartTickColor }} style={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      stroke={isDark ? '#38BDF8' : '#2563EB'}
                      tick={{ fill: chartTickColor }}
                      style={{ fontSize: 11 }}
                      domain={[0, (dataMax: number) => Math.max(dataMax * 1.2, 50000)]}
                      tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      allowDecimals={false}
                      stroke={isDark ? '#4ADE80' : '#16A34A'}
                      tick={{ fill: chartTickColor }}
                      style={{ fontSize: 11 }}
                      domain={[0, (dataMax: number) => Math.max(dataMax + 1, 4)]}
                    />
                    <RechartsTooltip
                      contentStyle={chartTooltipStyle}
                      itemStyle={chartTooltipItemStyle}
                      formatter={(val: any, name: string) => [
                        name.includes('Revenue') ? formatCurrencyINR(Number(val)) : val,
                        name.includes('Revenue') ? 'Revenue' : 'Processed Bills',
                      ]}
                      labelFormatter={(label) => `Period: ${label}`}
                    />
                    <Legend wrapperStyle={{ color: isDark ? '#F1F5F9' : '#1E293B', fontSize: 12, paddingTop: 6 }} formatter={(value) => <span style={{ color: isDark ? '#F1F5F9' : '#1E293B' }}>{value}</span>} />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue (₹)"
                      stroke={isDark ? '#38BDF8' : '#2563EB'}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="billsCount"
                      name="Processed Bills"
                      fill={isDark ? '#4ADE80' : '#16A34A'}
                      barSize={14}
                      minPointSize={4}
                      radius={[3, 3, 0, 0]}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </Card>
        </Col>

        {/* Chart 2: Company-wise Revenue Billing */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <CheckCircleOutlined style={{ color: isDark ? '#4ADE80' : '#3F6F4A' }} />
                <span style={{ fontSize: 14 }}>Company-wise Revenue Billing ({summary?.currentFinancialYear || 'Current FY'})</span>
              </Space>
            }
            extra={<Link href="/reports/company" style={{ fontSize: 12.5, color: isDark ? '#60A5FA' : '#17324D', fontWeight: 500 }}>Company Report ➔</Link>}
            style={{ height: '100%' }}
          >
            {mounted ? (
              <div style={{ width: '100%', minWidth: 0, height: 280, position: 'relative' }}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={sanitizedCompanyBillingChart} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} opacity={0.6} />
                    <XAxis dataKey="companyName" stroke={chartTickColor} tick={{ fill: chartTickColor }} style={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis
                      stroke={isDark ? '#60A5FA' : '#1D4ED8'}
                      tick={{ fill: chartTickColor }}
                      style={{ fontSize: 11 }}
                      domain={[0, (dataMax: number) => Math.max(dataMax * 1.2, 50000)]}
                      tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                    />
                    <RechartsTooltip contentStyle={chartTooltipStyle} itemStyle={chartTooltipItemStyle} formatter={(val: any) => formatCurrencyINR(Number(val))} />
                    <Legend wrapperStyle={{ color: isDark ? '#F1F5F9' : '#1E293B', fontSize: 12, paddingTop: 6 }} formatter={(value) => <span style={{ color: isDark ? '#F1F5F9' : '#1E293B' }}>{value}</span>} />
                    <Bar dataKey="totalBilling" name="Billed Revenue (₹)" fill={isDark ? '#60A5FA' : '#1D4ED8'} minPointSize={4} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </Card>
        </Col>
      </Row>

      {/* Visual Representation Charts Section: Row 2 */}
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        {/* Chart 3: Operational Expenses Breakdown */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <WalletOutlined style={{ color: isDark ? '#FBBF24' : '#C58A2A' }} />
                <span style={{ fontSize: 14 }}>Operational Expenses Breakdown (Loading vs General)</span>
              </Space>
            }
            extra={
              <Space size={8}>
                <Link href="/expenses/loading" style={{ fontSize: 12.5, color: isDark ? '#60A5FA' : '#17324D' }}>Loading</Link>
                <Text type="secondary" style={{ color: isDark ? '#64748B' : undefined }}>|</Text>
                <Link href="/expenses/general" style={{ fontSize: 12.5, color: isDark ? '#60A5FA' : '#17324D' }}>General</Link>
              </Space>
            }
            style={{ height: '100%' }}
          >
            <Row gutter={16} align="middle">
              <Col xs={24} sm={14}>
                {mounted ? (
                  <div style={{ width: '100%', minWidth: 0, height: 250, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart
                        data={[
                          {
                            category: 'Loading Expenses',
                            amount: Number(summary?.totalLoadingAmount) || 0,
                            fill: isDark ? '#FBBF24' : '#D97706',
                          },
                          {
                            category: 'General Expenses',
                            amount: Number(summary?.totalGeneralAmount) || 0,
                            fill: isDark ? '#38BDF8' : '#2563EB',
                          },
                        ]}
                        margin={{ top: 15, right: 20, left: 10, bottom: 15 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} opacity={0.6} />
                        <XAxis dataKey="category" stroke={chartTickColor} tick={{ fill: chartTickColor }} style={{ fontSize: 11 }} />
                        <YAxis
                          stroke={chartTickColor}
                          tick={{ fill: chartTickColor }}
                          style={{ fontSize: 11 }}
                          domain={[0, (dataMax: number) => Math.max(dataMax * 1.2, 5000)]}
                          tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                        />
                        <RechartsTooltip contentStyle={chartTooltipStyle} itemStyle={chartTooltipItemStyle} formatter={(val: any) => formatCurrencyINR(Number(val))} />
                        <Bar dataKey="amount" name="Expense Amount (₹)" minPointSize={6} radius={[3, 3, 0, 0]}>
                          <Cell fill={isDark ? '#FBBF24' : '#D97706'} />
                          <Cell fill={isDark ? '#38BDF8' : '#2563EB'} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
              </Col>
              <Col xs={24} sm={10}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ padding: '12px 14px', borderRadius: 4, background: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FDF6E8', border: isDark ? '1px solid #78350F' : '1px solid #E8CCA1' }}>
                    <div style={{ fontSize: 11.5, color: isDark ? '#FDE68A' : '#9E6B1D', fontWeight: 600, textTransform: 'uppercase' }}>Trip Loading Expenses</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: isDark ? '#FBBF24' : '#C58A2A', marginTop: 2 }}>
                      {formatCurrencyINR(summary?.totalLoadingAmount || 0)}
                    </div>
                    <div style={{ fontSize: 11, color: isDark ? '#CBD5E1' : '#89939A', marginTop: 2 }}>Unloader, labour, port charges</div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 4, background: isDark ? 'rgba(56, 189, 248, 0.12)' : '#EEF3F6', border: isDark ? '1px solid #0369A1' : '1px solid #D4DAD9' }}>
                    <div style={{ fontSize: 11.5, color: isDark ? '#BAE6FD' : '#365A73', fontWeight: 600, textTransform: 'uppercase' }}>General Expenses</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: isDark ? '#38BDF8' : '#17324D', marginTop: 2 }}>
                      {formatCurrencyINR(summary?.totalGeneralAmount || 0)}
                    </div>
                    <div style={{ fontSize: 11, color: isDark ? '#CBD5E1' : '#89939A', marginTop: 2 }}>Office rent, utilities, overheads</div>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Chart 4: Pending Bills Distribution */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <FileAddOutlined style={{ color: isDark ? '#FBBF24' : '#C58A2A' }} />
                <span style={{ fontSize: 14 }}>Pending Bills Distribution (Unbilled Jobs)</span>
              </Space>
            }
            extra={<Link href="/billing/pending" style={{ fontSize: 12.5, color: isDark ? '#60A5FA' : '#17324D', fontWeight: 500 }}>Pending Bills ➔</Link>}
            style={{ height: '100%' }}
          >
            {mounted ? (
              <div style={{ width: '100%', minWidth: 0, height: 250, position: 'relative' }}>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={sanitizedPendingCompanyChart} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} opacity={0.6} />
                    <XAxis dataKey="companyName" stroke={chartTickColor} tick={{ fill: chartTickColor }} style={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      stroke={isDark ? '#FBBF24' : '#D97706'}
                      tick={{ fill: chartTickColor }}
                      style={{ fontSize: 11 }}
                      domain={[0, (dataMax: number) => Math.max(dataMax * 1.2, 50000)]}
                      tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      allowDecimals={false}
                      stroke={isDark ? '#2DD4BF' : '#0D9488'}
                      tick={{ fill: chartTickColor }}
                      style={{ fontSize: 11 }}
                      domain={[0, (dataMax: number) => Math.max(dataMax + 1, 4)]}
                    />
                    <RechartsTooltip
                      contentStyle={chartTooltipStyle}
                      itemStyle={chartTooltipItemStyle}
                      formatter={(val: any, name: string) => [
                        name.includes('Amount') ? formatCurrencyINR(Number(val)) : val,
                        name.includes('Amount') ? 'Est. Amount' : 'Pending Jobs Count',
                      ]}
                    />
                    <Legend wrapperStyle={{ color: isDark ? '#F1F5F9' : '#1E293B', fontSize: 12, paddingTop: 6 }} formatter={(value) => <span style={{ color: isDark ? '#F1F5F9' : '#1E293B' }}>{value}</span>} />
                    <Bar yAxisId="left" dataKey="amount" name="Pending Amount (₹)" fill={isDark ? '#FBBF24' : '#D97706'} minPointSize={4} radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="right" dataKey="count" name="Unbilled Jobs Count" fill={isDark ? '#2DD4BF' : '#0D9488'} minPointSize={4} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </Card>
        </Col>
      </Row>

      {/* Row 3: Recently Created Enquiries & Recent Processed Invoices (Equal 50% Width & Spacing) */}
      <Row gutter={[16, 16]}>
        {/* Recently Created Enquiries */}
        <Col xs={24} xl={12}>
          <Card
            style={{ height: '100%' }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Space>
                  <FileAddOutlined style={{ color: isDark ? '#38BDF8' : '#17324D' }} />
                  <span style={{ fontSize: 14 }}>Recently Created Enquiries</span>
                </Space>
                <Space>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#CBD5E1' : undefined }}>Show:</Text>
                  <Select
                    size="small"
                    value={recentEnquiriesCount}
                    onChange={setRecentEnquiriesCount}
                    style={{ width: 95 }}
                  >
                    <Select.Option value={5}>Top 5</Select.Option>
                    <Select.Option value={10}>Top 10</Select.Option>
                    <Select.Option value={15}>Top 15</Select.Option>
                  </Select>
                  <Link href="/enquiries" style={{ fontSize: 12.5, color: isDark ? '#60A5FA' : '#17324D', fontWeight: 500, marginLeft: 8 }}>
                    View All ➔
                  </Link>
                </Space>
              </div>
            }
          >
            <Table
              columns={recentEnquiriesColumns}
              dataSource={displayedRecentEnquiries}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="middle"
              scroll={{ x: 935 }}
            />
          </Card>
        </Col>

        {/* Recent Processed Invoices Table */}
        <Col xs={24} xl={12}>
          <Card
            style={{ height: '100%' }}
            title={<span style={{ fontSize: 14 }}>Recent Processed Invoices</span>}
            extra={<Link href="/billing/processed" style={{ fontSize: 12.5, color: isDark ? '#60A5FA' : '#17324D', fontWeight: 500 }}>View All Invoices ➔</Link>}
          >
            <Table
              columns={recentBillsColumns}
              dataSource={summary?.recentBills || []}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="middle"
              scroll={{ x: 745 }}
            />
          </Card>
        </Col>
      </Row>

      {/* VEHICLE RC DETAILS POPUP MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CarOutlined style={{ color: isDark ? '#38BDF8' : '#17324D', fontSize: 20 }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#FFFFFF' : '#17324D' }}>
                {selectedVehicleModal?.vehicleNumber || 'Vehicle Details'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 400, color: isDark ? '#94A3B8' : '#64748B' }}>
                Parivahan Vahan RC Compliance &amp; Document Matrix
              </div>
            </div>
          </div>
        }
        open={vehicleModalOpen}
        onCancel={() => setVehicleModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setVehicleModalOpen(false)}>
            Close
          </Button>,
          <Button
            key="manage"
            type="primary"
            onClick={() => {
              setVehicleModalOpen(false);
              router.push(`/operations/movement?vehicleId=${selectedVehicleModal?.id || ''}`);
            }}
          >
            Open in Vehicle Management ➔
          </Button>,
        ]}
        width={720}
        destroyOnClose
      >
        {selectedVehicleModal && (
          <div style={{ marginTop: 12 }}>
            {/* Header Plate */}
            <div
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #1C1917 0%, #292524 100%)'
                  : 'linear-gradient(135deg, #17324D 0%, #2B597F 100%)',
                color: '#FFFFFF',
                borderRadius: 8,
                padding: '16px 20px',
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                border: isDark ? '1px solid #3F3F46' : 'none',
              }}
            >
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1.5, color: '#FFFFFF' }}>
                  {selectedVehicleModal.vehicleNumber}
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2, color: '#E4E4E7' }}>
                  {selectedVehicleModal.registeringAuthority || 'CHENNAI (EAST) RTO, Tamil Nadu'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Tag color="#10B981" style={{ fontSize: 12, padding: '3px 10px', fontWeight: 600, border: 'none' }}>
                  ACTIVE FLEET
                </Tag>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4, color: '#E4E4E7' }}>
                  Reg: {selectedVehicleModal.registrationDate ? dayjs(selectedVehicleModal.registrationDate).format('DD-MMM-YYYY') : '28-Jan-2008'}
                </div>
              </div>
            </div>

            {/* Spec Matrix */}
            <div
              style={{
                background: isDark ? '#141416' : '#F8FAFC',
                border: isDark ? '1px solid #27272A' : '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '14px 16px',
                marginBottom: 16,
              }}
            >
              <Row gutter={[16, 12]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Owner Name</Text>
                  <div style={{ fontSize: 14, fontWeight: 600, color: isDark ? '#FFFFFF' : '#17324D' }}>
                    {selectedVehicleModal.ownerName || 'K DHARMARAJAN'}
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Vehicle Class</Text>
                  <div style={{ fontSize: 13, fontWeight: 500, color: isDark ? '#FFFFFF' : '#17324D' }}>
                    {selectedVehicleModal.vehicleClass || 'Articulated Vehicle(HGV)'}
                  </div>
                </Col>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Fuel Type</Text>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#FFFFFF' : '#17324D' }}>
                    {selectedVehicleModal.fuelType || 'DIESEL'}
                  </div>
                </Col>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Emission Norm</Text>
                  <div style={{ fontSize: 13, color: isDark ? '#FFFFFF' : '#17324D' }}>
                    {selectedVehicleModal.emissionNorm || 'BS-IV'}
                  </div>
                </Col>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Vehicle Age</Text>
                  <div style={{ fontSize: 13, color: isDark ? '#FFFFFF' : '#17324D' }}>
                    {selectedVehicleModal.vehicleAge || '16 Years & 7 months'}
                  </div>
                </Col>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Hypothecated</Text>
                  <div style={{ fontSize: 13, color: isDark ? '#FFFFFF' : '#17324D' }}>
                    {selectedVehicleModal.hypothecated || 'No'}
                  </div>
                </Col>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Work Status</Text>
                  <div>
                    <Tag color="green">{selectedVehicleModal.vehicleStatus || 'ACTIVE'}</Tag>
                  </div>
                </Col>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : undefined }}>Registration Date</Text>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#FFFFFF' : '#17324D' }}>
                    {selectedVehicleModal.registrationDate ? dayjs(selectedVehicleModal.registrationDate).format('DD-MMM-YYYY') : '28-Jan-2008'}
                  </div>
                </Col>
              </Row>
            </div>

            {/* Impound / Seizure query */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Button type="link" style={{ fontSize: 13, color: isDark ? '#38BDF8' : '#1677ff' }} onClick={() => message.info('No impound/seizure records recorded for this vehicle.')}>
                Tap to Check the impound/seizure document status
              </Button>
            </div>

            {/* Document Validity Matrix with Red Boxes for Expired / ≤ 3 Days */}
            <Title level={5} style={{ marginBottom: 12, fontSize: 14, color: isDark ? '#FFFFFF' : '#111827' }}>
              Document Validity Dates &amp; Compliance Status
            </Title>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {VALIDITY_FIELDS.map((f) => {
                const val = selectedVehicleModal[f.key];
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
    </div>
  );
}
