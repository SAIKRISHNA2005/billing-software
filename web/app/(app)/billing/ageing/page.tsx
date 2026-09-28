'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Typography, Row, Col, Statistic, Spin, message, Alert } from 'antd';
import { ClockCircleOutlined, WarningOutlined, DollarOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { formatCurrencyINR } from '@/lib/utils/format';

const { Title, Text } = Typography;

export default function AgeingAnalysisPage() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  const fetchAgeingReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/billing/ageing');
      if (res.data && res.data.success) {
        setReport(res.data.data);
      } else {
        message.error(res.data?.message || 'Failed to load Ageing Analysis Report');
      }
    } catch (err: any) {
      message.error('Error fetching ageing analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgeingReport();
  }, []);

  if (loading || !report) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>Calculating Accounts Receivable Ageing Analysis...</p>
      </div>
    );
  }

  const { summary, clients } = report;

  const clientColumns = [
    {
      title: 'Client Name',
      dataIndex: 'clientName',
      key: 'clientName',
      render: (val: string) => <strong>{val}</strong>,
    },
    {
      title: 'Overdue Bills',
      dataIndex: 'billsCount',
      key: 'billsCount',
      align: 'center' as const,
      render: (cnt: number) => <Tag color="default">{cnt} Bills</Tag>,
    },
    {
      title: '0 - 30 Days (Current)',
      dataIndex: 'bucket_0_30',
      key: 'bucket_0_30',
      align: 'right' as const,
      render: (amt: number) => <Text style={{ color: '#3F6F4A', fontWeight: 600 }}>{formatCurrencyINR(amt)}</Text>,
    },
    {
      title: '31 - 60 Days',
      dataIndex: 'bucket_31_60',
      key: 'bucket_31_60',
      align: 'right' as const,
      render: (amt: number) => <Text style={{ color: '#C58A2A', fontWeight: 600 }}>{formatCurrencyINR(amt)}</Text>,
    },
    {
      title: '61 - 90 Days',
      dataIndex: 'bucket_61_90',
      key: 'bucket_61_90',
      align: 'right' as const,
      render: (amt: number) => <Text style={{ color: '#87362D', fontWeight: 600 }}>{formatCurrencyINR(amt)}</Text>,
    },
    {
      title: '90+ Days (Critical)',
      dataIndex: 'bucket_90_plus',
      key: 'bucket_90_plus',
      align: 'right' as const,
      render: (amt: number) => <Text strong style={{ color: '#A8473C' }}>{formatCurrencyINR(amt)}</Text>,
    },
    {
      title: 'Total Outstanding (₹)',
      dataIndex: 'totalPending',
      key: 'totalPending',
      align: 'right' as const,
      render: (amt: number) => <Text strong style={{ fontSize: 14.5, color: '#17324D' }}>{formatCurrencyINR(amt)}</Text>,
    },
  ];

  return (
    <div style={{ padding: '4px 0 24px' }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={2} style={{ margin: 0, color: '#1E2933', fontSize: 22, fontWeight: 600 }}>
          <ClockCircleOutlined style={{ marginRight: 8, color: '#C58A2A' }} />
          Client Payment Ageing Analysis
        </Title>
        <Text type="secondary" style={{ fontSize: 13, color: '#5F6B73' }}>Accounts receivable breakdown by age buckets (0–30d, 31–60d, 61–90d, 90+d overdue)</Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="spt-kpi-card spt-kpi-green">
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>0 - 30 Days (Current)</span>}
              value={formatCurrencyINR(summary.bucket_0_30)}
              valueStyle={{ color: '#3F6F4A', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="spt-kpi-card spt-kpi-amber">
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>31 - 60 Days</span>}
              value={formatCurrencyINR(summary.bucket_31_60)}
              valueStyle={{ color: '#C58A2A', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="spt-kpi-card spt-kpi-steel">
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>61 - 90 Days</span>}
              value={formatCurrencyINR(summary.bucket_61_90)}
              valueStyle={{ color: '#87362D', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="spt-kpi-card spt-kpi-red">
            <Statistic
              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#5F6B73', textTransform: 'uppercase' }}>90+ Days (Critical)</span>}
              value={formatCurrencyINR(summary.bucket_90_plus)}
              valueStyle={{ color: '#A8473C', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {summary.bucket_90_plus > 0 && (
        <Alert
          message={<span style={{ fontWeight: 600, color: '#87362D' }}>Critical Overdue Warning</span>}
          description={`₹${summary.bucket_90_plus.toLocaleString()} in client receivables has exceeded 90 days. Immediate operational follow-up is recommended.`}
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined style={{ color: '#A8473C' }} />}
          style={{ marginBottom: 20, borderRadius: 4, background: '#FBEFEF', border: '1px solid #E5BDB9' }}
        />
      )}

      <Card title="Client-wise Receivables Ageing Breakdown" style={{ borderRadius: 8 }}>
        <Table
          columns={clientColumns}
          dataSource={clients}
          rowKey="clientId"
          pagination={false}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ backgroundColor: '#E5E9E8', fontWeight: 'bold' }}>
                <Table.Summary.Cell index={0}>Grand Total ({summary.totalOverdueBills} Bills)</Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="center">{summary.totalOverdueBills}</Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">{formatCurrencyINR(summary.bucket_0_30)}</Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">{formatCurrencyINR(summary.bucket_31_60)}</Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">{formatCurrencyINR(summary.bucket_61_90)}</Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">{formatCurrencyINR(summary.bucket_90_plus)}</Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <Text strong style={{ color: '#17324D', fontSize: 16, fontFamily: 'monospace' }}>
                    {formatCurrencyINR(summary.totalPending)}
                  </Text>
                </Table.Summary.Cell>

              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </div>
  );
}
