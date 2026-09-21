'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Table,
  Card,
  Button,
  Select,
  DatePicker,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  BarChartOutlined,
  ReloadOutlined,
  UserOutlined,
  CarOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { AsyncMasterSelect } from '@/components/common/AsyncMasterSelect';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export interface VendorReportRow {
  vendorId: string;
  vendorName: string;
  vehiclesCount: number;
  tripsCount: number;
  advance: number;
  diesel: number;
  halting: number;
  extraAdvance: number;
  bonus: number;
  totalAmount: number;
  paid: number;
  pending: number;
}

export interface VendorReportTotals {
  vehiclesCount: number;
  tripsCount: number;
  advance: number;
  diesel: number;
  halting: number;
  extraAdvance: number;
  bonus: number;
  totalAmount: number;
  paid: number;
  pending: number;
}

export default function VendorReportPage() {
  const [rows, setRows] = useState<VendorReportRow[]>([]);
  const [grandTotals, setGrandTotals] = useState<VendorReportTotals | null>(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [vendorFilter, setVendorFilter] = useState<string | undefined>(undefined);
  const [companyFilter, setCompanyFilter] = useState<string | undefined>(undefined);
  const [clientFilter, setClientFilter] = useState<string | undefined>(undefined);
  const [loadingTypeFilter, setLoadingTypeFilter] = useState<string | undefined>(undefined);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (vendorFilter) params.vendorId = vendorFilter;
      if (companyFilter) params.companyId = companyFilter;
      if (clientFilter) params.clientId = clientFilter;
      if (loadingTypeFilter) params.loadingType = loadingTypeFilter;
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.fromDate = dateRange[0].format('DD-MM-YYYY');
        params.toDate = dateRange[1].format('DD-MM-YYYY');
      }

      const res = await axios.get('/api/vendors/report', { params });
      if (res.data.success && res.data.data) {
        setRows(res.data.data.rows || []);
        setGrandTotals(res.data.data.grandTotals || null);
      } else {
        message.error(res.data.message || 'Failed to generate vendor report');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error fetching vendor report');
    } finally {
      setLoading(false);
    }
  }, [vendorFilter, companyFilter, clientFilter, loadingTypeFilter, dateRange]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const columns: ColumnsType<VendorReportRow> = [
    {
      title: 'Vendor',
      dataIndex: 'vendorName',
      key: 'vendorName',
      fixed: 'left',
      width: 200,
      render: (name: string, record: VendorReportRow) => (
        <Link href={`/vendors/${record.vendorId}`} style={{ fontWeight: 600, color: '#1677ff' }}>
          {name || record.vendorId}
        </Link>
      ),
    },
    {
      title: 'Vehicles',
      dataIndex: 'vehiclesCount',
      key: 'vehiclesCount',
      align: 'center',
      width: 90,
      render: (count: number) => <Tag color="blue">{count || 0}</Tag>,
    },
    {
      title: 'Trips',
      dataIndex: 'tripsCount',
      key: 'tripsCount',
      align: 'center',
      width: 80,
      render: (trips: number) => <Text strong>{trips || 0}</Text>,
    },
    {
      title: 'Advance',
      dataIndex: 'advance',
      key: 'advance',
      align: 'right',
      width: 120,
      render: (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Diesel',
      dataIndex: 'diesel',
      key: 'diesel',
      align: 'right',
      width: 120,
      render: (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Halting',
      dataIndex: 'halting',
      key: 'halting',
      align: 'right',
      width: 110,
      render: (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Extra Adv',
      dataIndex: 'extraAdvance',
      key: 'extraAdvance',
      align: 'right',
      width: 110,
      render: (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Bonus',
      dataIndex: 'bonus',
      key: 'bonus',
      align: 'right',
      width: 110,
      render: (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Total Payable',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      width: 140,
      render: (v: number) => (
        <Text strong style={{ color: '#389e0d' }}>
          ₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Paid',
      dataIndex: 'paid',
      key: 'paid',
      align: 'right',
      width: 140,
      render: (v: number) => (
        <Text strong style={{ color: '#0958d9' }}>
          ₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Pending',
      dataIndex: 'pending',
      key: 'pending',
      align: 'right',
      width: 140,
      render: (v: number) => (
        <Text strong style={{ color: Number(v || 0) > 0 ? '#cf1322' : '#389e0d' }}>
          ₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <BarChartOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Vendor Report
          </Title>
          <Text type="secondary">
            Aggregate vendor financial statements, trips, diesel, halting, total payable, paid and pending balances.
          </Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => fetchReport()} loading={loading}>
              Refresh
            </Button>
          </Space>
        </Col>
      </Row>

      {/* KPI Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ backgroundColor: '#f6ffed', borderColor: '#b7eb8f', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic
              title="Grand Total Payable"
              value={grandTotals?.totalAmount || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#389e0d', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ backgroundColor: '#e6f4ff', borderColor: '#91caff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic
              title="Grand Total Paid"
              value={grandTotals?.paid || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#0958d9', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            bordered={false}
            style={{
              backgroundColor: (grandTotals?.pending || 0) > 0 ? '#fffbe6' : '#f6ffed',
              borderColor: (grandTotals?.pending || 0) > 0 ? '#ffe58f' : '#b7eb8f',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <Statistic
              title="Grand Total Pending"
              value={grandTotals?.pending || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: (grandTotals?.pending || 0) > 0 ? '#cf1322' : '#389e0d', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic
              title="Total Trips / Vendors"
              value={`${grandTotals?.tripsCount || 0} trips / ${rows.length} vendors`}
              valueStyle={{ fontSize: 18, fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card bordered={false} style={{ marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={5}>
            <AsyncMasterSelect
              entity="vendors"
              entityLabel="Vendor"
              placeholder="Filter by Vendor"
              value={vendorFilter}
              onChange={(val) => setVendorFilter(val)}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <AsyncMasterSelect
              entity="companies"
              entityLabel="Company"
              placeholder="Filter by Company"
              value={companyFilter}
              onChange={(val) => setCompanyFilter(val)}
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <AsyncMasterSelect
              entity="clients"
              entityLabel="Client"
              placeholder="Filter by Client"
              value={clientFilter}
              onChange={(val) => setClientFilter(val)}
            />
          </Col>
          <Col xs={24} sm={12} md={3}>
            <Select
              placeholder="Loading Type"
              style={{ width: '100%' }}
              allowClear
              value={loadingTypeFilter}
              onChange={(val) => setLoadingTypeFilter(val)}
            >
              <Select.Option value="IMPORT">Import</Select.Option>
              <Select.Option value="EXPORT">Export</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <RangePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              value={dateRange}
              onChange={(dates) => setDateRange(dates as any)}
            />
          </Col>
          <Col xs={24} sm={12} md={2}>
            <Button
              onClick={() => {
                setVendorFilter(undefined);
                setCompanyFilter(undefined);
                setClientFilter(undefined);
                setLoadingTypeFilter(undefined);
                setDateRange(null);
              }}
            >
              Reset
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Table with Grand Totals Footer */}
      <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Table
          rowKey="vendorId"
          columns={columns}
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (tot) => `Total ${tot} vendors`,
          }}
          summary={() => {
            if (!grandTotals || rows.length === 0) return null;
            return (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ backgroundColor: '#fafafa', fontWeight: 'bold' }}>
                  <Table.Summary.Cell index={0}>
                    <Text strong>GRAND TOTAL ({rows.length} Vendors)</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="center">
                    <Tag color="blue">{grandTotals.vehiclesCount}</Tag>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="center">
                    <Text strong>{grandTotals.tripsCount}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <Text strong>₹{grandTotals.advance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong>₹{grandTotals.diesel.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    <Text strong>₹{grandTotals.halting.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">
                    <Text strong>₹{grandTotals.extraAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right">
                    <Text strong>₹{grandTotals.bonus.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={8} align="right">
                    <Text strong style={{ color: '#389e0d' }}>
                      ₹{grandTotals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={9} align="right">
                    <Text strong style={{ color: '#0958d9' }}>
                      ₹{grandTotals.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={10} align="right">
                    <Text strong style={{ color: grandTotals.pending > 0 ? '#cf1322' : '#389e0d' }}>
                      ₹{grandTotals.pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>
    </div>
  );
}
