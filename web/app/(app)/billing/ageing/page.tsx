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
      render: (cnt: number) => <Tag color="blue">{cnt} Bills</Tag>,
    },
    {
      title: '0 - 30 Days (Current)',
      dataIndex: 'bucket_0_30',
      key: 'bucket_0_30',
      align: 'right' as const,
      render: (amt: number) => <Text style={{ color: '#52c41a' }}>{formatCurrencyINR(amt)}</Text>,
    },
    {
      title: '31 - 60 Days',
      dataIndex: 'bucket_31_60',
      key: 'bucket_31_60',
      align: 'right' as const,
      render: (amt: number) => <Text style={{ color: '#fa8c16' }}>{formatCurrencyINR(amt)}</Text>,
    },
    {
      title: '61 - 90 Days',
      dataIndex: 'bucket_61_90',
      key: 'bucket_61_90',
      align: 'right' as const,
      render: (amt: number) => <Text style={{ color: '#f5222d' }}>{formatCurrencyINR(amt)}</Text>,
    },
    {
      title: '90+ Days (Critical)',
      dataIndex: 'bucket_90_plus',
      key: 'bucket_90_plus',
      align: 'right' as const,
      render: (amt: number) => <Text strong style={{ color: '#cf1322' }}>{formatCurrencyINR(amt)}</Text>,
    },
    {
      title: 'Total Outstanding (₹)',
      dataIndex: 'totalPending',
      key: 'totalPending',
      align: 'right' as const,
      render: (amt: number) => <Text strong style={{ fontSize: 15, color: '#1677ff' }}>{formatCurrencyINR(amt)}</Text>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <ClockCircleOutlined style={{ marginRight: 8, color: '#fa8c16' }} />
          Client Payment Ageing Analysis
        </Title>
        <Text type="secondary">Accounts receivable breakdown by age buckets (0–30d, 31–60d, 61–90d, 90+d overdue)</Text>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card style={{ borderLeft: '4px solid #52c41a' }}>
            <Statistic title="0 - 30 Days (Fresh)" value={formatCurrencyINR(summary.bucket_0_30)} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderLeft: '4px solid #fa8c16' }}>
            <Statistic title="31 - 60 Days" value={formatCurrencyINR(summary.bucket_31_60)} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderLeft: '4px solid #f5222d' }}>
            <Statistic title="61 - 90 Days" value={formatCurrencyINR(summary.bucket_61_90)} valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderLeft: '4px solid #cf1322', backgroundColor: '#fff1f0' }}>
            <Statistic title="90+ Days Overdue" value={formatCurrencyINR(summary.bucket_90_plus)} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      {summary.bucket_90_plus > 0 && (
        <Alert
          message="Critical Overdue Warning"
          description={`₹${summary.bucket_90_plus.toLocaleString()} in client receivables has exceeded 90 days. Immediate follow-up is recommended.`}
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 24 }}
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
              <Table.Summary.Row style={{ backgroundColor: '#fafafa', fontWeight: 'bold' }}>
                <Table.Summary.Cell index={0}>Grand Total ({summary.totalOverdueBills} Bills)</Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="center">{summary.totalOverdueBills}</Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">{formatCurrencyINR(summary.bucket_0_30)}</Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">{formatCurrencyINR(summary.bucket_31_60)}</Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">{formatCurrencyINR(summary.bucket_61_90)}</Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">{formatCurrencyINR(summary.bucket_90_plus)}</Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <Text strong style={{ color: '#1677ff', fontSize: 16 }}>
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
