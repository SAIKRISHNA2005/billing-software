'use client';

import React, { useState } from 'react';
import { Typography, Breadcrumb, message, Modal, Result, Button, Space } from 'antd';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileAddOutlined, EyeOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { EnquiryForm } from '@/components/enquiry/EnquiryForm';
import { apiClient } from '@/lib/api/client';

const { Title, Paragraph } = Typography;

export default function NewEnquiryPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ id: string; transactionNumber: string } | null>(null);

  const handleSubmit = async (values: Record<string, any>) => {
    setSubmitting(true);
    try {
      const res = await apiClient.post<any>('/enquiries', values);

      if (res.data.success && res.data.data?.enquiry) {
        setCreatedResult({
          id: res.data.data.enquiry.id,
          transactionNumber: res.data.data.enquiry.transactionNumber,
        });
        setSuccessModalOpen(true);
      } else {
        message.error(res.data.message || 'Failed to create enquiry');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create enquiry';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { title: <Link href="/dashboard">Dashboard</Link> },
          { title: <Link href="/enquiries">Enquiries</Link> },
          { title: 'Add Enquiry' },
        ]}
        style={{ marginBottom: 16 }}
      />

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <FileAddOutlined style={{ marginRight: 10, color: '#1677ff' }} />
          Add Transport Enquiry
        </Title>
        <Paragraph type="secondary" style={{ marginTop: 4 }}>
          Initialize a new transport job. Enquiry ID and Transaction Number are atomically assigned
          under sequence locks upon saving.
        </Paragraph>
      </div>

      {/* Form */}
      <EnquiryForm onSubmit={handleSubmit} loading={submitting} />

      {/* Success Modal Showing Auto-generated Numbers */}
      <Modal
        open={successModalOpen}
        closable={false}
        footer={null}
        centered
        width={500}
      >
        <Result
          status="success"
          title="Transport Enquiry Created!"
          subTitle={
            <div>
              <p style={{ fontSize: 16, margin: '8px 0' }}>
                Enquiry ID: <strong>{createdResult?.id}</strong>
              </p>
              <p style={{ fontSize: 16, margin: '8px 0', color: '#1677ff' }}>
                Transaction No: <strong>{createdResult?.transactionNumber}</strong>
              </p>
              <p style={{ color: '#666', fontSize: 13, marginTop: 12 }}>
                Enquiry and linked movement gate records have been successfully saved.
              </p>
            </div>
          }
          extra={[
            <Button
              key="view"
              type="primary"
              icon={<EyeOutlined />}
              onClick={() => router.push(`/enquiries/${createdResult?.id}`)}
            >
              View Enquiry Details
            </Button>,
            <Button
              key="list"
              icon={<UnorderedListOutlined />}
              onClick={() => router.push('/enquiries')}
            >
              Back to Enquiries List
            </Button>,
          ]}
        />
      </Modal>
    </div>
  );
}
