'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Tag, Button, Typography, Space, Descriptions, Modal, Form, Input, InputNumber, Select, DatePicker, message } from 'antd';
import { FileTextOutlined, ArrowLeftOutlined, EditOutlined, DownloadOutlined, EyeOutlined, DollarOutlined } from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';
import dayjs from 'dayjs';
import { formatCurrencyINR } from '@/lib/utils/format';

const { Title, Text } = Typography;
const { Option } = Select;

export default function ProcessedBillDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(false);
  const [bill, setBill] = useState<any>(null);

  // PDF Modal State
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfData, setPdfData] = useState<{ pdfUrl?: string; pdfBase64?: string } | null>(null);

  // Payment Modal State
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [form] = Form.useForm();

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

  const handleGeneratePdf = async (preview: boolean = false) => {
    setPdfGenerating(true);
    try {
      const res = await axios.get(`/api/billing/pdf/${id}`);
      if (res.data && res.data.success) {
        setPdfData(res.data.data);
        if (preview) {
          setPdfModalVisible(true);
        } else if (res.data.data.pdfUrl) {
          window.open(res.data.data.pdfUrl, '_blank');
        } else {
          message.success('PDF generated successfully!');
        }
      } else {
        message.error(res.data?.message || 'Failed to generate PDF');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error generating PDF');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleRecordPayment = async (values: any) => {
    setRecordingPayment(true);
    try {
      const payload = {
        billId: id,
        amount: values.amount,
        paymentDate: values.paymentDate ? values.paymentDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        paymentMode: values.paymentMode,
        referenceNo: values.referenceNo,
        notes: values.notes,
      };

      const res = await axios.post('/api/billing/payments', payload);
      if (res.data && res.data.success) {
        message.success('Client payment recorded successfully!');
        setPaymentModalVisible(false);
        form.resetFields();
        fetchBillDetail();
      } else {
        message.error(res.data?.message || 'Failed to record payment');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error recording payment');
    } finally {
      setRecordingPayment(false);
    }
  };

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
    <div style={{ padding: 24, maxWidth: 1050, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            Back to Directory
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            <FileTextOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Invoice ({bill.billNumber})
          </Title>
        </Space>
        <Space wrap>
          <Button
            icon={<EyeOutlined />}
            loading={pdfGenerating}
            onClick={() => handleGeneratePdf(true)}
          >
            Preview PDF
          </Button>
          <Button
            type="default"
            icon={<DownloadOutlined />}
            loading={pdfGenerating}
            onClick={() => handleGeneratePdf(false)}
          >
            Download PDF
          </Button>
          <Button
            type="primary"
            style={{ backgroundColor: '#52c41a' }}
            icon={<DollarOutlined />}
            onClick={() => {
              form.setFieldsValue({
                paymentDate: dayjs(),
                paymentMode: 'BANK_TRANSFER',
                amount: bill.pendingAmount || (bill.totalAmount - (bill.paidAmount || 0)),
              });
              setPaymentModalVisible(true);
            }}
          >
            Record Payment
          </Button>
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
                <Tag color="purple">{bill.financialYear || bill.fy}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Payment Status">
                <Tag color={bill.paymentStatus === 'PAID' ? 'green' : bill.paymentStatus === 'PARTIAL' ? 'orange' : 'red'}>
                  {bill.paymentStatus || 'UNPAID'}
                </Tag>
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
              <Descriptions.Item label="Total Amount">
                <Text strong style={{ color: '#1677ff' }}>{formatCurrencyINR(bill.totalAmount)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Paid Amount">
                <Text type="success" strong>{formatCurrencyINR(bill.paidAmount || 0)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Pending Amount">
                <Text type="danger" strong>{formatCurrencyINR(bill.pendingAmount !== undefined ? bill.pendingAmount : (bill.totalAmount - (bill.paidAmount || 0)))}</Text>
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

      {/* PDF Preview Modal */}
      <Modal
        title={`Invoice PDF Preview - ${bill.billNumber}`}
        open={pdfModalVisible}
        onCancel={() => setPdfModalVisible(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setPdfModalVisible(false)}>
            Close
          </Button>,
          pdfData?.pdfUrl && (
            <Button
              key="download"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => window.open(pdfData.pdfUrl, '_blank')}
            >
              Open Drive File
            </Button>
          ),
        ]}
      >
        {pdfData?.pdfBase64 ? (
          <iframe
            src={`data:application/pdf;base64,${pdfData.pdfBase64}`}
            style={{ width: '100%', height: '550px', border: 'none' }}
            title="PDF Preview"
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Text type="secondary">Generating PDF preview...</Text>
          </div>
        )}
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        title={`Record Client Payment for Bill ${bill.billNumber}`}
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={recordingPayment}
        okText="Save Payment"
      >
        <Form form={form} layout="vertical" onFinish={handleRecordPayment}>
          <Form.Item
            name="amount"
            label="Payment Amount (₹)"
            rules={[{ required: true, message: 'Please enter payment amount' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              max={bill.pendingAmount || bill.totalAmount}
              formatter={(value) => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value?.replace(/₹\s?|(,*)/g, '') as unknown as number}
            />
          </Form.Item>

          <Form.Item
            name="paymentDate"
            label="Payment Date"
            rules={[{ required: true, message: 'Please select payment date' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
          </Form.Item>

          <Form.Item
            name="paymentMode"
            label="Payment Mode"
            rules={[{ required: true, message: 'Please select payment mode' }]}
          >
            <Select>
              <Option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</Option>
              <Option value="CASH">Cash</Option>
              <Option value="CHEQUE">Cheque</Option>
              <Option value="UPI">UPI / Digital Wallet</Option>
            </Select>
          </Form.Item>

          <Form.Item name="referenceNo" label="Reference / UTR / Cheque No">
            <Input placeholder="e.g. UTR12345678" />
          </Form.Item>

          <Form.Item name="notes" label="Notes / Remarks">
            <Input.TextArea rows={2} placeholder="Optional payment notes" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
