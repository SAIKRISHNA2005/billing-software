'use client';

import React, { useState } from 'react';
import { Popover, Button, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface ActionConfirmPopoverProps {
  title: string;
  description?: string | React.ReactNode;
  okText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  children: React.ReactNode;
  placement?: 'top' | 'left' | 'right' | 'bottom' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  disabled?: boolean;
  loading?: boolean;
}

export const ActionConfirmPopover: React.FC<ActionConfirmPopoverProps> = ({
  title,
  description,
  okText = 'Yes, Proceed',
  cancelText = 'No, Cancel',
  onConfirm,
  onCancel,
  children,
  placement = 'top',
  disabled = false,
  loading = false,
}) => {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (disabled || loading || confirming) return;
    setOpen(newOpen);
  };

  const handleOk = async () => {
    try {
      setConfirming(true);
      await onConfirm();
      setOpen(false);
    } finally {
      setConfirming(false);
    }
  };

  const handleNo = () => {
    setOpen(false);
    if (onCancel) onCancel();
  };

  const popoverContent = (
    <div style={{ maxWidth: 300, padding: '4px 2px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: '#e6f4ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <QuestionCircleOutlined style={{ fontSize: 18, color: '#1677ff' }} />
        </div>
        <div>
          <Text strong style={{ fontSize: 14, display: 'block', lineHeight: 1.35, color: '#111827' }}>
            {title}
          </Text>
          {description && (
            <div style={{ fontSize: 12.5, color: '#4b5563', marginTop: 4, lineHeight: 1.4 }}>
              {description}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <Button
          size="middle"
          onClick={handleNo}
          disabled={confirming}
          className="popover-confirm-no"
        >
          {cancelText}
        </Button>
        <Button
          type="primary"
          size="middle"
          onClick={handleOk}
          loading={confirming || loading}
          className="popover-confirm-yes"
        >
          {okText}
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      placement={placement}
      overlayClassName="action-popover-card"
    >
      <span style={{ display: 'inline-block' }}>{children}</span>
    </Popover>
  );
};
