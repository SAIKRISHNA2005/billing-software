'use me';
'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Table, Statistic, Typography, Space, Button, Tag, message } from 'antd';
import { CalendarOutlined, ReloadOutlined, FileTextOutlined, CarOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { formatCurrencyINR } from '@/lib/utils/format';

const { Title, Text } = Typography;

export default function DailyReportPage() {
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  const [report, setReport] = useState<any>(null);

  const fetchDailyReport = async (dateVal = selectedDate) => {
    setLoading(true);
    try {
      const formattedDate = dateVal.format('YYYY-MM-DD');
      const res = await axios.get('/api/reports/daily', {
        params: { date: formattedDate }
      });

      if (res.data && res.data.success) {
        setReport(res.data.data);
      } else {
        message.error(res.data?.message || 'Failed to load daily report');
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

  const enquiryColumns = [
    { title: 'Enquiry ID', dataIndex: 'id', key: 'id', render: (id: string) => <Text strong>{id}</Text> },
    { title: 'Transaction No', dataIndex: 'transactionNo', key: 'transactionNo', render: (txn: string) => <Text code>{txn}</Text> },
    { title: 'Company', dataIndex: 'companyName', key: 'companyName' },
    { title: 'Client', dataIndex: 'clientName', key: 'clientName' },
    { title: 'Vehicle No', dataIndex: 'vehicleNo', key: 'vehicleNo' },
    { title: 'Stage', dataIndex: 'stage', key: 'stage', render: (st: string) => <Tag color="blue">{st}</Tag> },
    { title: 'Freight Amount', dataIndex: 'freightAmount', key: 'freightAmount', align: 'right' as const, render: (amt: number) => formatCurrencyINR(amt) }
  ];

  const billColumns = [
    { title: 'Bill Number', dataIndex: 'billNumber', key: 'billNumber', render: (num: string) => <Text strong style={{ color: '#1677ff' }}>{num}</Text> },
    { title: 'Company', dataIndex: 'companyName', key: 'companyName' },
    { title: 'Client', dataIndex: 'clientName', key: 'clientName' },
    { title: 'Billed Amount', dataIndex: 'totalAmount', key: 'totalAmount', align: 'right' as const, render: (amt: number) => <Text strong style={{ color: '#3f8600' }}>{formatCurrencyINR(amt)}</Text> }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <CalendarOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Daily Operational &amp; Financial Summary
          </Title>
          <Text type="secondary">Key performance metrics and transactions for {selectedDate.format('DD MMMM YYYY')}</Text>
        </div>
        <Space>
          <DatePicker
            value={selectedDate}
            onChange={(d) => {
              if (d) {
                setSelectedDate(d);
                fetchDailyReport(d);
              }
            }}
            format="DD-MM-YYYY"
            allowClear={false}
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchDailyReport()}>
            Refresh
          </Button>
        </Space>
      </div>

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
            <Statistic title="Total Billing" value={report?.totalBilling || 0} precision={2} prefix="₹" valueStyle={{ color: '#389e0d' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={loading} style={{ borderRadius: 8, backgroundColor: '#fff2f0' }}>
            <Statistic title="Total Expenses" value={report?.totalExpenses || 0} precision={2} prefix="₹" valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
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
    </div>
  );
}
