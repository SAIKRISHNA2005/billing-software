'use me';
'use client';

import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Button, Card, Row, Col, Upload, message, Typography, Divider, Space, Tag } from 'antd';
import { UploadOutlined, DeleteOutlined, SaveOutlined, SafetyCertificateOutlined, NumberOutlined, PictureOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;

export default function CompanyProfilePage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/settings');
      if (res.data && res.data.success) {
        setSettings(res.data.data);
        form.setFieldsValue(res.data.data);
      } else {
        message.error(res.data?.message || 'Failed to load settings');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error fetching company settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      const res = await axios.put('/api/settings', values);
      if (res.data && res.data.success) {
        message.success('Company profile & numbering settings updated!');
        setSettings(res.data.data);
      } else {
        message.error(res.data?.message || 'Failed to update settings');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (type: 'seal' | 'signature') => async (options: any) => {
    const { file, onSuccess, onError } = options;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Data = (reader.result as string).split(',')[1];
      try {
        const url = type === 'seal' ? '/api/settings/seal' : '/api/settings/signature';
        const res = await axios.post(url, {
          base64Data,
          contentType: file.type || 'image/png'
        });
        if (res.data && res.data.success) {
          message.success(`${type === 'seal' ? 'Company Seal' : 'Signature'} uploaded successfully!`);
          setSettings(res.data.data);
          onSuccess('OK');
        } else {
          message.error(res.data?.message || 'Upload failed');
          onError(new Error(res.data?.message));
        }
      } catch (err: any) {
        message.error('File upload failed');
        onError(err);
      }
    };
  };

  const handleRemoveImage = async (type: 'seal' | 'signature') => {
    try {
      const url = type === 'seal' ? '/api/settings/seal' : '/api/settings/signature';
      const res = await axios.delete(url);
      if (res.data && res.data.success) {
        message.success(`${type === 'seal' ? 'Company Seal' : 'Signature'} removed`);
        setSettings(res.data.data);
      } else {
        message.error(res.data?.message || 'Removal failed');
      }
    } catch (err: any) {
      message.error('Error removing image');
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        <SafetyCertificateOutlined style={{ marginRight: 8, color: '#1677ff' }} />
        Company Profile & Settings
      </Title>

      <Form form={form} layout="vertical" onFinish={handleSave} disabled={loading}>
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card title="Company Information" loading={loading} style={{ borderRadius: 8 }}>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    name="companyName"
                    label="Company Legal Name"
                    rules={[{ required: true, message: 'Please enter company name' }]}
                  >
                    <Input placeholder="e.g. SAIKRISHNA TRANSPORT & LOGISTICS" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="address" label="Registered Address">
                    <Input.TextArea rows={3} placeholder="Full office address for bill header" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="phone" label="Phone Number">
                    <Input placeholder="+91 98765 43210" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="email" label="Contact Email">
                    <Input placeholder="contact@company.com" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="gstin" label="GSTIN">
                    <Input placeholder="33AAAAA0000A1Z5" style={{ textTransform: 'uppercase' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="pan" label="Company PAN">
                    <Input placeholder="AAAAA0000A" style={{ textTransform: 'uppercase' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card title="Numbering Sequences Configuration" loading={loading} style={{ marginTop: 24, borderRadius: 8 }}>
              <Paragraph type="secondary">
                Configure starting numbers for auto-generated sequences. Modifying start numbers will affect new sequences.
              </Paragraph>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="enquiryStartNumber"
                    label="Enquiry Start Number"
                    rules={[{ required: true, message: 'Enquiry start number is required' }]}
                  >
                    <InputNumber style={{ width: '100%' }} min={1} addonBefore={<NumberOutlined />} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="billStartNumber"
                    label="Bill Sequence Start (per FY)"
                    rules={[{ required: true, message: 'Bill start number is required' }]}
                  >
                    <InputNumber style={{ width: '100%' }} min={1} addonBefore={<NumberOutlined />} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card title="Company Seal & Signature" loading={loading} style={{ borderRadius: 8 }}>
              <div style={{ marginBottom: 24 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  <PictureOutlined style={{ marginRight: 6 }} />
                  Company Official Seal
                </Text>
                {settings?.sealViewUrl ? (
                  <div style={{ textAlign: 'center', border: '1px dashed #d9d9d9', borderRadius: 8, padding: 12 }}>
                    <img
                      src={settings.sealViewUrl}
                      alt="Company Seal"
                      style={{ maxHeight: 120, maxWidth: '100%', objectFit: 'contain' }}
                    />
                    <div style={{ marginTop: 8 }}>
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveImage('seal')}
                      >
                        Remove Seal
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Upload customRequest={handleFileUpload('seal')} showUploadList={false} accept="image/*">
                    <Button icon={<UploadOutlined />} style={{ width: '100%' }}>
                      Upload Official Seal
                    </Button>
                  </Upload>
                )}
              </div>

              <Divider style={{ margin: '16px 0' }} />

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  <PictureOutlined style={{ marginRight: 6 }} />
                  Authorized Signature
                </Text>
                {settings?.signatureViewUrl ? (
                  <div style={{ textAlign: 'center', border: '1px dashed #d9d9d9', borderRadius: 8, padding: 12 }}>
                    <img
                      src={settings.signatureViewUrl}
                      alt="Authorized Signature"
                      style={{ maxHeight: 100, maxWidth: '100%', objectFit: 'contain' }}
                    />
                    <div style={{ marginTop: 8 }}>
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveImage('signature')}
                      >
                        Remove Signature
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Upload customRequest={handleFileUpload('signature')} showUploadList={false} accept="image/*">
                    <Button icon={<UploadOutlined />} style={{ width: '100%' }}>
                      Upload Signature
                    </Button>
                  </Upload>
                )}
              </div>
            </Card>

            <Card style={{ marginTop: 24, borderRadius: 8, textAlign: 'center' }}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size="large"
                loading={saving}
                onClick={() => form.submit()}
                style={{ width: '100%' }}
              >
                Save All Settings
              </Button>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
