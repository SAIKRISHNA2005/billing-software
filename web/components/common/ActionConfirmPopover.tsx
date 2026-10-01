'use client';

import React, { useState } from 'react';
import { Popover, Button, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useTheme } from '@/components/providers/ThemeContext';

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
  const { themeMode } = useTheme();
  const isDark = themeMode === 'dark';
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
            borderRadius: 4,
            backgroundColor: isDark ? '#27272A' : '#EEF3F6',
            border: isDark ? '1px solid #3F3F46' : '1px solid #D4DAD9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <QuestionCircleOutlined style={{ fontSize: 16, color: isDark ? '#38BDF8' : '#365A73' }} />
        </div>
        <div>
          <Text strong style={{ fontSize: 13.5, display: 'block', lineHeight: 1.35, color: isDark ? '#FFFFFF' : '#1E2933' }}>
            {title}
          </Text>
          {description && (
            <div style={{ fontSize: 12, color: isDark ? '#A1A1AA' : '#5F6B73', marginTop: 4, lineHeight: 1.4 }}>
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
