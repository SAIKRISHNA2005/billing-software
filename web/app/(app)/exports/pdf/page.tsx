'use me';
'use client';

import React from 'react';
import { Card, Button, Typography, Select, Space, Alert } from 'antd';
import { FilePdfOutlined, DownloadOutlined, PrinterOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Title, Text, Paragraph } = Typography;

export default function PdfExportPage() {
  const router = useRouter();

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        <FilePdfOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
        PDF Report Exports
      </Title>

      <Alert
        message="Invoice PDF vs Report PDF"
        description="Individual bill invoice PDFs are generated using Google Docs templates (Phase 14). System reports can be printed or exported to PDF directly from their respective report screens."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card title="Available Report PDF Views" style={{ borderRadius: 8 }}>
        <Paragraph>Select a report to view and print/export as PDF:</Paragraph>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Button block type="dashed" size="large" icon={<PrinterOutlined />} onClick={() => router.push('/reports/daily')}>
            Daily Operational Summary Report
          </Button>
          <Button block type="dashed" size="large" icon={<PrinterOutlined />} onClick={() => router.push('/reports/company')}>
            Company-wise Performance Report
          </Button>
          <Button block type="dashed" size="large" icon={<PrinterOutlined />} onClick={() => router.push('/reports/billing')}>
            Billing Revenue Summary Report
          </Button>
          <Button block type="dashed" size="large" icon={<PrinterOutlined />} onClick={() => router.push('/vendors/report')}>
            Vendor Settlement Report
          </Button>
        </Space>
      </Card>
    </div>
  );
}
