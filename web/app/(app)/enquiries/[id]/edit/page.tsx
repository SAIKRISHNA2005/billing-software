'use client';

import React, { useState, useEffect } from 'react';
import { Typography, Breadcrumb, message, Spin, Alert, Button } from 'antd';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { EditOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { EnquiryForm } from '@/components/enquiry/EnquiryForm';
import { apiClient } from '@/lib/api/client';

const { Title, Paragraph } = Typography;

interface PageProps {
  params: {
    id: string;
  };
}

export default function EditEnquiryPage({ params }: PageProps) {
  const { id } = params;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(`/enquiries/${id}`);
        const responseData = res.data;
        if (responseData.success && responseData.data?.enquiry) {
          const enq = responseData.data.enquiry;
          const mov = responseData.data.movement || {};
          const veh = responseData.data.vehicle;
          const drv = responseData.data.driver;
          const con = responseData.data.container;

          // Merge fields for the form
          const merged = {
            ...enq,
            vehicleNumber: veh?.vehicleNumber || enq.vehicleNumber,
            driverName: drv?.name || enq.driverName,
            driverPhone: drv?.phone || enq.driverPhone,
            containerNumber: con?.containerNumber || enq.containerNumber,
            containerType: con?.containerType,
            ...mov,
          };
          setInitialData(merged);
        } else {
          message.error(responseData.message || 'Failed to load enquiry for editing');
        }
      } catch (err: any) {
        message.error(err.response?.data?.message || 'Error loading enquiry');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleSubmit = async (values: Record<string, any>) => {
    setSubmitting(true);
    try {
      const res = await apiClient.put<any>(`/enquiries/${id}`, values);
      if (res.data.success) {
        message.success('Enquiry updated successfully');
        router.push(`/enquiries/${id}`);
      } else {
        message.error(res.data.message || 'Failed to update enquiry');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update enquiry';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="Loading enquiry details..." />
      </div>
    );
  }

  if (!initialData) {
    return (
      <div style={{ maxWidth: 1000, margin: '40px auto' }}>
        <Alert
          message="Enquiry Not Found"
          description={`Could not locate transport enquiry "${id}" for editing.`}
          type="error"
          showIcon
          action={
            <Button type="primary" onClick={() => router.push('/enquiries')}>
              Back to Enquiries
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { title: <Link href="/dashboard">Dashboard</Link> },
          { title: <Link href="/enquiries">Enquiries</Link> },
          { title: <Link href={`/enquiries/${id}`}>{id}</Link> },
          { title: 'Edit' },
        ]}
        style={{ marginBottom: 16 }}
      />

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <EditOutlined style={{ marginRight: 10, color: '#1677ff' }} />
          Edit Transport Enquiry ({id})
        </Title>
        <Paragraph type="secondary" style={{ marginTop: 4 }}>
          Transaction No: <strong>{initialData.transactionNumber}</strong>
        </Paragraph>
      </div>

      {/* Form */}
      <EnquiryForm
        initialValues={initialData}
        isEdit={true}
        onSubmit={handleSubmit}
        loading={submitting}
      />
    </div>
  );
}
