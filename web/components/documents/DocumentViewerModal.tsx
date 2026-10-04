'use client';

import React, { useState } from 'react';
import { Modal, Button, Space, Tag, Spin, Tooltip } from 'antd';
import {
  DownloadOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  ExportOutlined,
  CloseOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import { useTheme } from '@/components/providers/ThemeContext';

export interface DocumentItem {
  id: string;
  entityType?: string;
  entityId?: string;
  vehicleNumber?: string;
  category: string;
  documentNumber?: string;
  fileName: string;
  originalFileName?: string;
  mimeType?: string;
  fileSize?: number;
  driveFileId?: string;
  driveViewUrl?: string;
  driveDownloadUrl?: string;
  expiryDate?: string;
  issueDate?: string;
  status?: string;
  notes?: string;
  uploadedBy?: string;
  createdAt?: string;
}

interface DocumentViewerModalProps {
  open: boolean;
  document: DocumentItem | null;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  open,
  document,
  onClose,
}) => {
  const { themeMode } = useTheme();
  const isDark = themeMode === 'dark';
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);

  if (!document) return null;

  const viewUrl = `/api/documents/${document.id}/view`;
  const downloadUrl = `/api/documents/${document.id}/download`;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={fullscreen ? '98vw' : 920}
      style={{ top: fullscreen ? 10 : 30 }}
      styles={{
        body: {
          padding: 0,
          height: fullscreen ? 'calc(96vh - 55px)' : '75vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: isDark ? '#141416' : '#F8FAFC',
        },
      }}
      title={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingRight: 28,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FilePdfOutlined style={{ color: '#E11D48', fontSize: 20 }} />
            <div>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 15,
                  color: isDark ? '#FFFFFF' : '#1E2933',
                  maxWidth: 320,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'inline-block',
                  verticalAlign: 'bottom',
                }}
              >
                {document.fileName}
              </span>
              <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>
                {document.category}
              </Tag>
              {document.vehicleNumber && (
                <Tag color="cyan" style={{ fontSize: 11 }}>
                  {document.vehicleNumber}
                </Tag>
              )}
            </div>
          </div>

          <Space size="small">
            <Tooltip title={fullscreen ? 'Exit Full Screen' : 'Full Screen'}>
              <Button
                type="text"
                size="small"
                icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onClick={() => setFullscreen(!fullscreen)}
              />
            </Tooltip>
            <Tooltip title="Download PDF">
              <Button
                type="primary"
                ghost
                size="small"
                icon={<DownloadOutlined />}
                href={downloadUrl}
                download={document.fileName}
              >
                Download
              </Button>
            </Tooltip>
            {document.driveViewUrl && (
              <Tooltip title="Open in Google Drive">
                <Button
                  type="text"
                  size="small"
                  icon={<ExportOutlined />}
                  href={document.driveViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              </Tooltip>
            )}
          </Space>
        </div>
      }
      destroyOnClose
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              backgroundColor: isDark ? '#141416' : '#FFFFFF',
              zIndex: 10,
            }}
          >
            <Spin size="large" />
            <span style={{ fontSize: 13, color: isDark ? '#A1A1AA' : '#64748B' }}>
              Loading document from secure storage...
            </span>
          </div>
        )}
        <iframe
          src={viewUrl}
          title={document.fileName}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '0 0 8px 8px',
          }}
          onLoad={() => setLoading(false)}
        />
      </div>
    </Modal>
  );
};
