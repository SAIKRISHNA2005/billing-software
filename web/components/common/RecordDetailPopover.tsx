'use client';

import React from 'react';
import { Popover, Tag, Typography, Divider, Space, Button } from 'antd';
import {
  FileTextOutlined,
  UserOutlined,
  CarOutlined,
  CompassOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { formatCurrencyINR } from '@/lib/utils/format';
import { useTheme } from '@/components/providers/ThemeContext';

const { Text, Title } = Typography;

export interface RecordDetailPopoverProps {
  record: Record<string, any>;
  title?: string;
  type?: 'enquiry' | 'bill' | 'movement' | 'general';
  children?: React.ReactNode;
  onViewFull?: () => void;
  placement?: 'top' | 'left' | 'right' | 'bottom' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
}

export const RecordDetailPopover: React.FC<RecordDetailPopoverProps> = ({
  record,
  title,
  type = 'enquiry',
  children,
  onViewFull,
  placement = 'right',
}) => {
  const { themeMode } = useTheme();
  const isDark = themeMode === 'dark';

  if (!record) return null;

  const id = record.id || record.enquiryId || record.billId || record.bookingNumber || 'Record';
  const stage = record.stage || record.movementStatus || record.status || record.paymentStatus || 'ACTIVE';
  const client = record.clientName || record.client || '-';
  const company = record.companyName || record.company || '-';
  const vehicle = record.vehicleNumber || record.vehicleNo || '-';
  const driver = record.driverNumber || record.driverPhone || record.driverName || '-';
  const container = record.containerNumber || record.containerNo || record.feet || '-';
  const seal = record.sealNumber && record.sealNumber !== '-' ? record.sealNumber : null;
  const route = record.containerFrom && record.containerTo ? `${record.containerFrom} ➔ ${record.containerTo}` : record.route || null;
  const freight = record.freightAmount !== undefined ? record.freightAmount : record.totalAmount;
  const halting = record.haltingAmount || 0;
  const haltingDays = record.haltingDays || 0;
  const diesel = record.diesel || record.dieselAmount || 0;
  const advance = record.advance || record.advanceAmount || 0;
  const comments = record.comments && record.comments !== '-' ? record.comments : null;

  const getStageColor = (st: string) => {
    switch (st.toUpperCase()) {
      case 'COMPLETED':
      case 'PAID':
        return 'success';
      case 'IN_TRANSIT':
      case 'CONTAINER_MOVEMENT':
      case 'PARTIAL':
        return 'processing';
      case 'VEHICLE_ASSIGNED':
      case 'PROCESSED':
        return 'cyan';
      case 'UNPAID':
        return 'error';
      default:
        return 'default';
    }
  };

  const popoverContent = (
    <div style={{ width: 340, maxHeight: 460, overflowY: 'auto', padding: '4px 2px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <Text strong style={{ fontSize: 15, color: isDark ? '#FFFFFF' : '#111827' }}>
            {title || id}
          </Text>
          {record.transactionNo && (
            <div style={{ fontSize: 11.5, color: isDark ? '#A1A1AA' : '#6b7280' }}>{record.transactionNo}</div>
          )}
        </div>
        <Tag color={getStageColor(stage)} style={{ fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>
          {stage}
        </Tag>
      </div>

      <Divider style={{ margin: '8px 0', borderColor: isDark ? '#2E2E33' : '#E2E8F0' }} />

      {/* Parties */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <UserOutlined style={{ color: isDark ? '#38BDF8' : '#365A73', fontSize: 13 }} />
          <Text strong style={{ fontSize: 12.5, color: isDark ? '#FFFFFF' : '#1E2933' }}>Client & Consignor</Text>
        </div>
        <div style={{ paddingLeft: 18, fontSize: 12 }}>
          <div><Text type="secondary" style={{ color: isDark ? '#A1A1AA' : undefined }}>Client:</Text> <Text strong style={{ color: isDark ? '#FFFFFF' : '#111827' }}>{client}</Text></div>
          <div><Text type="secondary" style={{ color: isDark ? '#A1A1AA' : undefined }}>Company:</Text> <Text style={{ color: isDark ? '#FFFFFF' : '#111827' }}>{company}</Text></div>
          {record.billingNumber && record.billingNumber !== '-' && (
            <div><Text type="secondary" style={{ color: isDark ? '#A1A1AA' : undefined }}>Bill No:</Text> <Text strong style={{ color: isDark ? '#60A5FA' : '#17324D' }}>{record.billingNumber}</Text></div>
          )}
        </div>
      </div>

      {/* Assets & Fleet */}
      {(vehicle !== '-' || container !== '-') && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <CarOutlined style={{ color: isDark ? '#34D399' : '#2F6F73', fontSize: 13 }} />
            <Text strong style={{ fontSize: 12.5, color: isDark ? '#FFFFFF' : '#1E2933' }}>Transport & Assets</Text>
          </div>
          <div style={{ paddingLeft: 18, fontSize: 12 }}>
            <div><Text type="secondary" style={{ color: isDark ? '#A1A1AA' : undefined }}>Container:</Text> <Text strong style={{ color: isDark ? '#FFFFFF' : '#111827' }}>{container}</Text> {record.feet && <Tag style={{ fontSize: 10 }}>{record.feet}</Tag>}</div>
            {seal && <div><Text type="secondary" style={{ color: isDark ? '#A1A1AA' : undefined }}>Seal:</Text> <Text style={{ color: isDark ? '#FFFFFF' : '#111827' }}>{seal}</Text></div>}
            <div><Text type="secondary" style={{ color: isDark ? '#A1A1AA' : undefined }}>Vehicle:</Text> <Text strong style={{ color: isDark ? '#FFFFFF' : '#111827' }}>{vehicle}</Text></div>
            <div><Text type="secondary" style={{ color: isDark ? '#A1A1AA' : undefined }}>Driver Contact:</Text> <Text style={{ color: isDark ? '#FFFFFF' : '#111827' }}>{driver}</Text></div>
          </div>
        </div>
      )}

      {/* Route & Timestamps */}
      {(route || record.companyIn || record.portIn) && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <CompassOutlined style={{ color: isDark ? '#FBBF24' : '#C58A2A', fontSize: 13 }} />
            <Text strong style={{ fontSize: 12.5, color: isDark ? '#FFFFFF' : '#1E2933' }}>Route & Gate Times</Text>
          </div>
          <div style={{ paddingLeft: 18, fontSize: 12 }}>
            {route && <div style={{ marginBottom: 4, fontWeight: 500, color: isDark ? '#E4E4E7' : '#34424C' }}>{route}</div>}
            {record.companyIn && record.companyIn !== '-' && (
              <div><Text type="secondary" style={{ color: isDark ? '#A1A1AA' : undefined }}>Company In/Out:</Text> <span style={{ color: isDark ? '#FFFFFF' : undefined }}>{record.companyIn} / {record.companyOut || '-'}</span></div>
            )}
            {record.portIn && record.portIn !== '-' && (
              <div><Text type="secondary" style={{ color: isDark ? '#A1A1AA' : undefined }}>Port In/Out:</Text> <span style={{ color: isDark ? '#FFFFFF' : undefined }}>{record.portIn} / {record.portOut || '-'}</span></div>
            )}
          </div>
        </div>
      )}

      {/* Financials */}
      {freight !== undefined && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <DollarOutlined style={{ color: isDark ? '#60A5FA' : '#17324D', fontSize: 13 }} />
            <Text strong style={{ fontSize: 12.5, color: isDark ? '#FFFFFF' : '#1E2933' }}>Financial Breakdown</Text>
          </div>
          <div style={{ paddingLeft: 18, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary" style={{ color: isDark ? '#A1A1AA' : undefined }}>Freight Charges:</Text>
              <Text strong style={{ color: isDark ? '#FFFFFF' : '#111827' }}>{formatCurrencyINR(freight)}</Text>
            </div>
            {halting > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ color: isDark ? '#A1A1AA' : undefined }}>Halting ({haltingDays}d):</Text>
                <Text style={{ color: isDark ? '#FBBF24' : '#C58A2A', fontWeight: 600 }}>{formatCurrencyINR(halting)}</Text>
              </div>
            )}
            {advance > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ color: isDark ? '#A1A1AA' : undefined }}>Advance Disbursed:</Text>
                <Text style={{ color: isDark ? '#38BDF8' : '#365A73', fontWeight: 600 }}>{formatCurrencyINR(advance)}</Text>
              </div>
            )}
            {diesel > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ color: isDark ? '#A1A1AA' : undefined }}>Diesel Advance:</Text>
                <Text style={{ color: isDark ? '#FFFFFF' : '#111827' }}>{formatCurrencyINR(diesel)}</Text>
              </div>
            )}
            {record.paidAmount !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: isDark ? '1px dashed #3F3F46' : '1px dashed #D4DAD9', paddingTop: 3, marginTop: 3 }}>
                <Text type="secondary" style={{ color: isDark ? '#A1A1AA' : undefined }}>Paid / Pending:</Text>
                <Text>
                  <span style={{ color: isDark ? '#4ADE80' : '#3F6F4A', fontWeight: 600 }}>{formatCurrencyINR(record.paidAmount)}</span> /{' '}
                  <span style={{ color: isDark ? '#F87171' : '#A8473C', fontWeight: 600 }}>{formatCurrencyINR(record.pendingAmount || 0)}</span>
                </Text>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comments */}
      {comments && (
        <div style={{ padding: '6px 10px', background: isDark ? '#27272A' : '#ECEFEE', borderRadius: 4, fontSize: 11.5, color: isDark ? '#D4D4D8' : '#5F6B73', marginBottom: 8 }}>
          <Text strong style={{ fontSize: 11, color: isDark ? '#FFFFFF' : '#1E2933' }}>Remarks: </Text>
          {comments}
        </div>
      )}

      {onViewFull && (
        <div style={{ textAlign: 'right', marginTop: 8 }}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={onViewFull} style={{ padding: 0, color: isDark ? '#38BDF8' : '#17324D' }}>
            Open Complete Details ➔
          </Button>
        </div>
      )}
    </div>
  );

  const triggerNode = children || (
    <Button
      type="text"
      size="small"
      icon={<EyeOutlined style={{ color: '#365A73' }} />}
      style={{ display: 'inline-flex', alignItems: 'center' }}
    />
  );

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      placement={placement}
      overlayClassName="action-popover-card"
    >
      <span style={{ cursor: 'pointer', display: 'inline-block' }}>{triggerNode}</span>
    </Popover>
  );
};
