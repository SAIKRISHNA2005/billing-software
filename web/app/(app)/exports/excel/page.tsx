'use me';
'use client';

import React, { useState } from 'react';
import { Card, Button, Typography, Space, Alert, Divider, message, Row, Col } from 'antd';
import { FileExcelOutlined, ExportOutlined, DownloadOutlined, LockOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;

export default function ExcelExportPage() {
  const [downloading, setDownloading] = useState(false);

  const handleDownloadSnapshot = async () => {
    setDownloading(true);
    try {
      const res = await axios.get('/api/exports/master-excel');
      if (res.data && res.data.success && res.data.data?.base64Data) {
        const { base64Data, filename } = res.data.data;
        const link = document.createElement('a');
        link.href = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + base64Data;
        link.download = filename || 'TMS_Master_Database.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success('Master Excel snapshot downloaded successfully!');
      } else {
        message.error(res.data?.message || 'Failed to generate Excel snapshot');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error downloading Excel snapshot');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadCsv = async (reportType: string) => {
    try {
      const res = await axios.get('/api/exports/report-csv', {
        params: { report: reportType }
      });
      if (res.data && res.data.success && res.data.data?.csvData) {
        const { csvData, filename } = res.data.data;
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename || `TMS_${reportType}_Export.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success(`${reportType.toUpperCase()} CSV exported!`);
      } else {
        message.error(res.data?.message || 'Export failed');
      }
    } catch (e: any) {
      message.error('Failed to export CSV');
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        <FileExcelOutlined style={{ marginRight: 8, color: '#52c41a' }} />
        Live Spreadsheet Access &amp; Excel Exports
      </Title>

      <Alert
        message="Protected Single Source of Truth"
        description="The system uses Google Sheets directly as the database. Data is always 100% up to date in real time without background sync delays. The live Sheet is protected with Range Protection so it remains read-only to external viewers."
        type="info"
        showIcon
        icon={<LockOutlined />}
        style={{ marginBottom: 24 }}
      />

      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <Card
            title="Live Google Sheet Access"
            bordered
            style={{ borderRadius: 8, height: '100%' }}
          >
            <Paragraph>
              Open the live Google Spreadsheet in your browser to view all raw data tabs in real time.
            </Paragraph>
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Button
                type="primary"
                icon={<ExportOutlined />}
                size="large"
                style={{ backgroundColor: '#217346', borderColor: '#217346' }}
                onClick={() => window.open('https://docs.google.com/spreadsheets/', '_blank')}
              >
                Open Live Master Sheet
              </Button>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            title="On-Demand Excel Snapshot (.xlsx)"
            bordered
            style={{ borderRadius: 8, height: '100%' }}
          >
            <Paragraph>
              Download a complete point-in-time `.xlsx` workbook copy of the database to your local machine.
            </Paragraph>
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                size="large"
                loading={downloading}
                onClick={handleDownloadSnapshot}
              >
                Download Master .xlsx Snapshot
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '32px 0' }} />

      <Card title="Export Specific Reports (CSV)" style={{ borderRadius: 8 }}>
        <Paragraph>Download isolated report files in CSV format for analysis:</Paragraph>
        <Space wrap size="middle">
          <Button icon={<CloudDownloadOutlined />} onClick={() => handleDownloadCsv('enquiries')}>
            Enquiries List CSV
          </Button>
          <Button icon={<CloudDownloadOutlined />} onClick={() => handleDownloadCsv('bills')}>
            Processed Bills CSV
          </Button>
        </Space>
      </Card>
    </div>
  );
}
