'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, DatePicker, Button, Row, Col, Space, message } from 'antd';
import dayjs from 'dayjs';
import { apiClient } from '@/lib/api/client';

interface MovementTimesModalProps {
  open: boolean;
  enquiryId: string;
  initialMovement?: Record<string, any> | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const MovementTimesModal: React.FC<MovementTimesModalProps> = ({
  open,
  enquiryId,
  initialMovement,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const mov = initialMovement || {};
      const timeKeys = [
        'companyInTime',
        'companyOutTime',
        'printInTime',
        'printOutTime',
        'portInTime',
        'portOutTime',
      ];
      const initialVals: Record<string, any> = {};
      timeKeys.forEach((key) => {
        const val = mov[key];
        if (val) {
          initialVals[key] = dayjs(val, 'DD-MM-YYYY hh:mm A').isValid()
            ? dayjs(val, 'DD-MM-YYYY hh:mm A')
            : dayjs(val).isValid()
            ? dayjs(val)
            : undefined;
        } else {
          initialVals[key] = undefined;
        }
      });
      form.setFieldsValue(initialVals);
    }
  }, [open, initialMovement, form]);

  const handleSetNow = (field: string) => {
    form.setFieldsValue({ [field]: dayjs() });
  };

  const handleSave = async (values: any) => {
    setSubmitting(true);
    try {
      const payload: Record<string, string> = {};
      const timeKeys = [
        'companyInTime',
        'companyOutTime',
        'printInTime',
        'printOutTime',
        'portInTime',
        'portOutTime',
      ];

      timeKeys.forEach((k) => {
        if (values[k] && dayjs.isDayjs(values[k])) {
          payload[k] = values[k].format('DD-MM-YYYY hh:mm A');
        } else {
          payload[k] = '';
        }
      });

      const res = await apiClient.patch<any>(`/enquiries/${enquiryId}/movement`, payload);
      if (res.data.success) {
        message.success('Movement gate times updated successfully');
        onSuccess();
        onClose();
      } else {
        message.error(res.data.message || 'Failed to update movement times');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error updating movement times';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Update Movement Gate Times"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={700}
      okText="Save Times"
    >
      <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item label="Factory / Company Gate-In">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="companyInTime" noStyle>
                  <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                </Form.Item>
                <Button onClick={() => handleSetNow('companyInTime')}>Set now</Button>
              </Space.Compact>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item label="Factory / Company Gate-Out">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="companyOutTime" noStyle>
                  <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                </Form.Item>
                <Button onClick={() => handleSetNow('companyOutTime')}>Set now</Button>
              </Space.Compact>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item label="Print Gate-In">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="printInTime" noStyle>
                  <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                </Form.Item>
                <Button onClick={() => handleSetNow('printInTime')}>Set now</Button>
              </Space.Compact>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item label="Print Gate-Out">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="printOutTime" noStyle>
                  <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                </Form.Item>
                <Button onClick={() => handleSetNow('printOutTime')}>Set now</Button>
              </Space.Compact>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item label="Port Gate-In">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="portInTime" noStyle>
                  <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                </Form.Item>
                <Button onClick={() => handleSetNow('portInTime')}>Set now</Button>
              </Space.Compact>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item label="Port Gate-Out">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="portOutTime" noStyle>
                  <DatePicker showTime format="DD-MM-YYYY hh:mm A" style={{ width: '100%' }} />
                </Form.Item>
                <Button onClick={() => handleSetNow('portOutTime')}>Set now</Button>
              </Space.Compact>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};
