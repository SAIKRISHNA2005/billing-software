'use me';
'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Tag, Button, Typography, Space, Descriptions, Divider, message } from 'antd';
import { FileTextOutlined, ArrowLeftOutlined, EditOutlined, SafetyOutlined } from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';
import dayjs from 'dayjs';
import { formatCurrencyINR } from '@/lib/utils/format';

const { Title, Text } = Typography;

export default function ProcessedBillDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(false);
  const [bill, setBill] = useState<any>(null);

  const fetchBillDetail = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/billing/bills/${id}`);
      if (res.data && res.data.success) {
        setBill(res.data.data);
      } else {
        message.error(res.data?.message || 'Failed to fetch bill details');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error loading bill');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchBillDetail();
  }, [id]);

  if (loading || !bill) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text>Loading bill details...</Text>
      </div>
    );
  }

  const itemColumns = [
    { title: '#', dataIndex: 'sortOrder', key: 'sortOrder', width: 60 },
    { title: 'Item Description', dataIndex: 'description', key: 'description' },
    {
      title: 'Linked Enquiry ID',
      dataIndex: 'enquiryId',
      key: 'enquiryId',
      render: (enqId: string) =>
        enqId ? (
          <Button type="link" onClick={() => router.push(`/enquiries/${enqId}`)}>
            {enqId}
          </Button>
        ) : (
          '-'
        )
    },
    {
      title: 'Amount (₹)',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      render: (amt: number) => <Text strong>{formatCurrencyINR(amt)}</Text>
    }
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            Back to Directory
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            <FileTextOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Invoice Details ({bill.billNumber})
          </Title>
        </Space>
        <Space>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => router.push(`/billing/processed/${id}/edit`)}
          >
            Edit Invoice
          </Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 8, marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Descriptions title="Invoice Overview" bordered column={{ xs: 1, sm: 2, md: 3 }}>
              <Descriptions.Item label="Bill Number">
                <Text strong style={{ color: '#1677ff', fontSize: 16 }}>{bill.billNumber}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Financial Year">
                <Tag color="purple">{bill.financialYear}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color="green">{bill.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Billing Date">
                {bill.billingDate ? dayjs(bill.billingDate).format('DD-MM-YYYY') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Company Name">
                <strong>{bill.companyName}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Client Name">
                <strong>{bill.clientName}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Processed Timestamp" span={3}>
                {bill.processedAt ? dayjs(bill.processedAt).format('DD-MM-YYYY HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Remarks" span={3}>
                {bill.remarks || 'No remarks provided.'}
              </Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>
      </Card>

      <Card title="Itemized Invoice Charges" style={{ borderRadius: 8, marginBottom: 24 }}>
        <Table
          columns={itemColumns}
          dataSource={bill.items || []}
          rowKey="id"
          pagination={false}
          footer={() => (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: 16 }}>Total Billed Amount:</Text>
              <Title level={3} style={{ margin: 0, color: '#3f8600' }}>
                {formatCurrencyINR(bill.totalAmount)}
              </Title>
            </div>
          )}
        />
      </Card>

      {bill.enquiries && bill.enquiries.length > 0 && (
        <Card title={`Linked Transport Enquiries (${bill.enquiries.length})`} style={{ borderRadius: 8 }}>
          <Table
            columns={[
              { title: 'Enquiry ID', dataIndex: 'id', key: 'id' },
              { title: 'Transaction No', dataIndex: 'transactionNo', key: 'transactionNo' },
              { title: 'Vehicle No', dataIndex: 'vehicleNo', key: 'vehicleNo' },
              { title: 'Container No', dataIndex: 'containerNo', key: 'containerNo' },
              { title: 'Stage', dataIndex: 'stage', key: 'stage', render: (st: string) => <Tag color="blue">{st}</Tag> },
              {
                title: 'Action',
                key: 'act',
                render: (_: any, r: any) => (
                  <Button type="link" onClick={() => router.push(`/enquiries/${r.id}`)}>
                    Open Enquiry
                  </Button>
                )
              }
            ]}
            dataSource={bill.enquiries}
            rowKey="id"
            pagination={false}
          />
        </Card>
      )}
    </div>
  );
}
