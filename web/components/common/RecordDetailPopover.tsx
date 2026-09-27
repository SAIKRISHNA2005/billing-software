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
          <Text strong style={{ fontSize: 15, color: '#111827' }}>
            {title || id}
          </Text>
          {record.transactionNo && (
            <div style={{ fontSize: 11.5, color: '#6b7280' }}>{record.transactionNo}</div>
          )}
        </div>
        <Tag color={getStageColor(stage)} style={{ fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>
          {stage}
        </Tag>
      </div>

      <Divider style={{ margin: '8px 0' }} />

      {/* Parties */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <UserOutlined style={{ color: '#1677ff', fontSize: 13 }} />
          <Text strong style={{ fontSize: 12.5, color: '#1e293b' }}>Client & Consignor</Text>
        </div>
        <div style={{ paddingLeft: 18, fontSize: 12 }}>
          <div><Text type="secondary">Client:</Text> <Text strong>{client}</Text></div>
          <div><Text type="secondary">Company:</Text> <Text>{company}</Text></div>
          {record.billingNumber && record.billingNumber !== '-' && (
            <div><Text type="secondary">Bill No:</Text> <Text strong style={{ color: '#1677ff' }}>{record.billingNumber}</Text></div>
          )}
        </div>
      </div>

      {/* Assets & Fleet */}
      {(vehicle !== '-' || container !== '-') && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <CarOutlined style={{ color: '#52c41a', fontSize: 13 }} />
            <Text strong style={{ fontSize: 12.5, color: '#1e293b' }}>Transport & Assets</Text>
          </div>
          <div style={{ paddingLeft: 18, fontSize: 12 }}>
            <div><Text type="secondary">Container:</Text> <Text strong>{container}</Text> {record.feet && <Tag style={{ fontSize: 10 }}>{record.feet}</Tag>}</div>
            {seal && <div><Text type="secondary">Seal:</Text> <Text>{seal}</Text></div>}
            <div><Text type="secondary">Vehicle:</Text> <Text strong>{vehicle}</Text></div>
            <div><Text type="secondary">Driver Contact:</Text> <Text>{driver}</Text></div>
          </div>
        </div>
      )}

      {/* Route & Timestamps */}
      {(route || record.companyIn || record.portIn) && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <CompassOutlined style={{ color: '#fa8c16', fontSize: 13 }} />
            <Text strong style={{ fontSize: 12.5, color: '#1e293b' }}>Route & Gate Times</Text>
          </div>
          <div style={{ paddingLeft: 18, fontSize: 12 }}>
            {route && <div style={{ marginBottom: 4, fontWeight: 500, color: '#334155' }}>{route}</div>}
            {record.companyIn && record.companyIn !== '-' && (
              <div><Text type="secondary">Company In/Out:</Text> {record.companyIn} / {record.companyOut || '-'}</div>
            )}
            {record.portIn && record.portIn !== '-' && (
              <div><Text type="secondary">Port In/Out:</Text> {record.portIn} / {record.portOut || '-'}</div>
            )}
          </div>
        </div>
      )}

      {/* Financials */}
      {freight !== undefined && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <DollarOutlined style={{ color: '#722ed1', fontSize: 13 }} />
            <Text strong style={{ fontSize: 12.5, color: '#1e293b' }}>Financial Breakdown</Text>
          </div>
          <div style={{ paddingLeft: 18, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Freight Charges:</Text>
              <Text strong>{formatCurrencyINR(freight)}</Text>
            </div>
            {halting > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Halting ({haltingDays}d):</Text>
                <Text style={{ color: '#d46b08' }}>{formatCurrencyINR(halting)}</Text>
              </div>
            )}
            {advance > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Advance Disbursed:</Text>
                <Text style={{ color: '#0958d9' }}>{formatCurrencyINR(advance)}</Text>
              </div>
            )}
            {diesel > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Diesel Advance:</Text>
                <Text>{formatCurrencyINR(diesel)}</Text>
              </div>
            )}
            {record.paidAmount !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: 3, marginTop: 3 }}>
                <Text type="secondary">Paid / Pending:</Text>
                <Text>
                  <span style={{ color: '#389e0d' }}>{formatCurrencyINR(record.paidAmount)}</span> /{' '}
                  <span style={{ color: '#cf1322' }}>{formatCurrencyINR(record.pendingAmount || 0)}</span>
                </Text>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comments */}
      {comments && (
        <div style={{ padding: '6px 10px', background: '#f8fafc', borderRadius: 6, fontSize: 11.5, color: '#475569', marginBottom: 8 }}>
          <Text strong style={{ fontSize: 11, color: '#64748b' }}>Remarks: </Text>
          {comments}
        </div>
      )}

      {onViewFull && (
        <div style={{ textAlign: 'right', marginTop: 8 }}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={onViewFull} style={{ padding: 0 }}>
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
      icon={<EyeOutlined style={{ color: '#1677ff' }} />}
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
