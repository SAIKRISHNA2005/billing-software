'use client';

import React, { useState } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import apiClient from '@/lib/api/client';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { currentPassword: string; newPassword: string }) => {
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      if (response.data.success) {
        message.success(response.data.message || 'Password updated successfully! Please log in again.');
        form.resetFields();
        onClose();
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
      } else {
        message.error(response.data.message || 'Failed to update password');
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axErr = err as { response?: { data?: { message?: string } } };
        message.error(axErr.response?.data?.message || 'Failed to update password');
      } else if (err instanceof Error) {
        message.error(err.message);
      } else {
        message.error('An error occurred while changing password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Change Password"
      open={open}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="Update Password"
      cancelText="Cancel"
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="currentPassword"
          label="Current Password"
          rules={[{ required: true, message: 'Please enter your current password' }]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Enter current password"
          />
        </Form.Item>

        <Form.Item
          name="newPassword"
          label="New Password"
          rules={[
            { required: true, message: 'Please enter a new password' },
            { min: 6, message: 'Password must be at least 6 characters' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Enter new password (min. 6 characters)"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirm New Password"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Please confirm your new password' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('The two passwords do not match'));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Re-enter new password"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
