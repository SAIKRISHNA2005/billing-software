'use client';

import React, { useState } from 'react';
import { Card, Button, Typography, Space, Divider, message, Tag } from 'antd';
import { DownloadOutlined, EyeOutlined, ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function BillTemplatePreviewPage() {
  const [downloading, setDownloading] = useState(false);

  const handleDownloadSamplePdf = async () => {
    setDownloading(true);
    try {
      const response = await fetch('/api/billing/preview?format=pdf');
      if (!response.ok) throw new Error('Failed to generate preview PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Sample_Invoice_231-2026-27.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success('Sample Invoice PDF downloaded successfully!');
    } catch (e: any) {
      message.error(e.message || 'Error downloading sample PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ padding: '24px 0', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Space>
            <Link href="/billing/processed">
              <Button icon={<ArrowLeftOutlined />}>Back to Processed Bills</Button>
            </Link>
            <Title level={3} style={{ margin: 0 }}>
              Sri Ponniamman Trans - Bill Template Preview
            </Title>
          </Space>
          <div>
            <Text type="secondary">
              A4 Print-Ready Transport Invoice matching official visual reference
            </Text>
            <Tag color="green" style={{ marginLeft: 8 }}>A4 Portrait</Tag>
            <Tag color="blue">Dynamic Calculations</Tag>
          </div>
        </div>

        <Space>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={downloading}
            onClick={handleDownloadSamplePdf}
            size="large"
          >
            Download Sample PDF
          </Button>
          <Button
            icon={<PrinterOutlined />}
            onClick={() => window.open('/api/billing/preview?format=html', '_blank')}
            size="large"
          >
            Open HTML View
          </Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <Text type="secondary" italic>
            Interactive live preview rendered from real HTML/CSS template engine:
          </Text>
        </div>
        <div style={{ border: '1px solid #d9d9d9', borderRadius: 4, overflow: 'auto', background: '#e9ecef', padding: '20px 0' }}>
          <iframe
            src="/api/billing/preview?format=html"
            style={{
              width: '210mm',
              height: '297mm',
              margin: '0 auto',
              display: 'block',
              border: 'none',
              background: '#fff',
              boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            }}
            title="Bill Preview"
          />
        </div>
      </Card>
    </div>
  );
}
