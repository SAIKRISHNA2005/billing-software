'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  Tooltip,
  Popconfirm,
  Radio,
  Input,
  message,
  Spin,
  Empty,
  Badge,
  Alert,
} from 'antd';
import {
  FolderOpenOutlined,
  UploadOutlined,
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  FilePdfOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  GoogleOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useTheme } from '@/components/providers/ThemeContext';
import { DocumentViewerModal, DocumentItem } from './DocumentViewerModal';
import { DocumentUploadModal, DOCUMENT_CATEGORIES } from './DocumentUploadModal';

const { Text, Title } = Typography;

interface VehicleDocumentVaultProps {
  open: boolean;
  vehicleId: string;
  vehicleNumber: string;
  ownerName?: string;
  driverName?: string;
  onClose: () => void;
  onDocumentsChanged?: () => void;
}

export const VehicleDocumentVault: React.FC<VehicleDocumentVaultProps> = ({
  open,
  vehicleId,
  vehicleNumber,
  ownerName,
  driverName,
  onClose,
  onDocumentsChanged,
}) => {
  const { themeMode } = useTheme();
  const isDark = themeMode === 'dark';

  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [driveFolderUrl, setDriveFolderUrl] = useState<string | null>(null);
  const [driveFolderName, setDriveFolderName] = useState<string | null>(null);
  const [isDriveAuthorized, setIsDriveAuthorized] = useState<boolean>(true);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Sub-modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [viewerModalOpen, setViewerModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);

  // Rename state
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renamingDoc, setRenamingDoc] = useState<DocumentItem | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Fetch documents for the vehicle
  const fetchDocuments = useCallback(async () => {
    if (!vehicleId) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/documents?vehicleId=${encodeURIComponent(vehicleId)}`);
      if (res.data?.success && res.data?.data) {
        const docs: DocumentItem[] = res.data.data.documents || [];
        setDocuments(docs);
        if (typeof res.data.data.isDriveAuthorized === 'boolean') {
          setIsDriveAuthorized(res.data.data.isDriveAuthorized);
        }
        if (res.data.data.driveFolderUrl) {
          setDriveFolderUrl(res.data.data.driveFolderUrl);
        }
        if (res.data.data.folderName) {
          setDriveFolderName(res.data.data.folderName);
        }
      } else {
        message.error(res.data?.message || 'Failed to load vehicle documents.');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error connecting to document storage.');
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    if (open) {
      fetchDocuments();
    }
  }, [open, fetchDocuments]);

  // Sync pending documents with Google Drive
  const handleSyncDrive = async () => {
    setSyncingDrive(true);
    try {
      const res = await axios.post('/api/documents/sync');
      if (res.data?.success) {
        message.success(res.data.data?.message || 'Sync with Google Drive completed!');
        fetchDocuments();
        if (onDocumentsChanged) onDocumentsChanged();
      } else {
        message.warning(res.data?.message || 'Drive authorization is still pending.');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Could not sync with Google Drive');
    } finally {
      setSyncingDrive(false);
    }
  };

  // Handle document deletion
  const handleDeleteDoc = async (docId: string) => {
    try {
      const res = await axios.delete(`/api/documents/${docId}`);
      if (res.data?.success) {
        message.success('Document deleted and moved to Drive trash.');
        fetchDocuments();
        if (onDocumentsChanged) onDocumentsChanged();
      } else {
        message.error(res.data?.message || 'Failed to delete document.');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error deleting document.');
    }
  };

  // Handle document renaming
  const handleRenameSubmit = async () => {
    if (!renamingDoc || !newFileName.trim()) return;
    setRenaming(true);
    try {
      const res = await axios.patch(`/api/documents/${renamingDoc.id}`, {
        fileName: newFileName.trim(),
      });
      if (res.data?.success) {
        message.success('Document renamed successfully.');
        setRenameModalOpen(false);
        setRenamingDoc(null);
        fetchDocuments();
      } else {
        message.error(res.data?.message || 'Failed to rename document.');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error renaming document.');
    } finally {
      setRenaming(false);
    }
  };

  // Check validity badge
  const getValidityBadge = (expiryDate?: string) => {
    if (!expiryDate || expiryDate.trim() === '' || expiryDate === '-') {
      return <Tag color="default">No Expiry Set</Tag>;
    }
    const d = dayjs(expiryDate);
    if (!d.isValid()) {
      return <Tag color="default">{expiryDate}</Tag>;
    }
    const today = dayjs().startOf('day');
    const target = d.startOf('day');
    const diffDays = target.diff(today, 'day');

    if (diffDays < 0) {
      return (
        <Tag color="error" icon={<ExclamationCircleOutlined />}>
          Expired ({Math.abs(diffDays)}d ago)
        </Tag>
      );
    }
    if (diffDays <= 30) {
      return (
        <Tag color="warning" icon={<ClockCircleOutlined />}>
          Expiring in {diffDays}d
        </Tag>
      );
    }
    return (
      <Tag color="success" icon={<CheckCircleOutlined />}>
        Valid ({d.format('DD-MMM-YYYY')})
      </Tag>
    );
  };

  // Filtered documents
  const filteredDocs = documents.filter((doc) => {
    if (categoryFilter === 'ALL') return true;
    if (categoryFilter === 'PERMITS') {
      return doc.category === 'STATE_PERMIT' || doc.category === 'NATIONAL_PERMIT';
    }
    return doc.category === categoryFilter;
  });

  const columns = [
    {
      title: 'Document Category',
      dataIndex: 'category',
      key: 'category',
      width: 170,
      render: (cat: string) => {
        const found = DOCUMENT_CATEGORIES.find((c) => c.value === cat);
        return (
          <Tag color={found?.color || 'blue'} style={{ fontWeight: 600, fontSize: 12 }}>
            {found?.label || cat}
          </Tag>
        );
      },
    },
    {
      title: 'File Name',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (name: string, record: DocumentItem) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FilePdfOutlined style={{ color: '#E11D48', fontSize: 18, flexShrink: 0 }} />
          <div>
            <span
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: isDark ? '#FFFFFF' : '#1E2933',
                cursor: 'pointer',
              }}
              onClick={() => {
                setSelectedDoc(record);
                setViewerModalOpen(true);
              }}
            >
              {name}
            </span>
            <div style={{ fontSize: 11, color: isDark ? '#A1A1AA' : '#64748B' }}>
              {record.fileSize ? `${(record.fileSize / 1024).toFixed(1)} KB` : 'PDF'}
              {record.documentNumber ? ` • Doc #${record.documentNumber}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Validity Status',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      width: 170,
      render: (expiry: string) => getValidityBadge(expiry),
    },
    {
      title: 'Uploaded At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (dateStr: string) => (
        <span style={{ fontSize: 12, color: isDark ? '#D4D4D8' : '#475569' }}>
          {dateStr ? dayjs(dateStr).format('DD-MMM-YYYY') : '-'}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 170,
      align: 'center' as const,
      render: (_: any, record: DocumentItem) => (
        <Space size="small">
          <Tooltip title="View Document (In-App PDF Viewer)">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined style={{ color: isDark ? '#38BDF8' : '#0284C7' }} />}
              onClick={() => {
                setSelectedDoc(record);
                setViewerModalOpen(true);
              }}
            />
          </Tooltip>

          <Tooltip title="Download PDF">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined style={{ color: isDark ? '#34D399' : '#059669' }} />}
              href={`/api/documents/${record.id}/download`}
              download={record.fileName}
            />
          </Tooltip>

          <Tooltip title="Rename File">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ color: isDark ? '#FBBF24' : '#D97706' }} />}
              onClick={() => {
                setRenamingDoc(record);
                setNewFileName(record.fileName);
                setRenameModalOpen(true);
              }}
            />
          </Tooltip>

          <Popconfirm
            title="Delete this document?"
            description="The file will be moved to Google Drive trash and archived from database."
            onConfirm={() => handleDeleteDoc(record.id)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete Document">
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined style={{ color: isDark ? '#F87171' : '#DC2626' }} />}
                style={{
                  color: isDark ? '#F87171' : '#DC2626',
                  borderColor: isDark ? '#7F1D1D' : '#FCA5A5',
                  backgroundColor: isDark ? '#450A0A' : '#FEF2F2',
                }}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={940}
      destroyOnClose
      title={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingRight: 24,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FolderOpenOutlined style={{ color: '#0284C7', fontSize: 22 }} />
            <div>
              <span
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: isDark ? '#FFFFFF' : '#0F172A',
                }}
              >
                Vehicle Document Vault — {vehicleNumber}
              </span>
              <div style={{ fontSize: 12, color: isDark ? '#A1A1AA' : '#64748B' }}>
                Drive Folder: <strong>{driveFolderName || `${(vehicleNumber || '').replace(/[\s-]/g, '').toUpperCase()}${driverName || ownerName ? ` - ${(driverName || ownerName || '').trim().toUpperCase()}` : ''} documents`}</strong> • Powered by Google Drive
              </div>
            </div>
          </div>

          <Space wrap size="small">
            {driveFolderUrl && (
              <Button
                icon={<GoogleOutlined style={{ color: '#4285F4' }} />}
                href={driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  borderColor: isDark ? '#3F3F46' : '#CBD5E1',
                  color: isDark ? '#FFFFFF' : '#1E2933',
                }}
              >
                Open Google Drive Folder
              </Button>
            )}
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadModalOpen(true)}
              style={{ background: '#0284C7', borderColor: '#0284C7' }}
            >
              Upload Documents
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchDocuments}
              loading={loading}
            />
          </Space>
        </div>
      }
    >
      <div style={{ marginTop: 12 }}>
        {!isDriveAuthorized && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <strong>Google Drive Authorization:</strong> Google requires a one-time permission grant from your account to sync files into Google Drive.
                  <div style={{ fontSize: 12, marginTop: 3, color: isDark ? '#94A3B8' : '#64748B' }}>
                    Drive Path: <strong>Billing-Software-Documents / {driveFolderName || `${(vehicleNumber || '').replace(/[\s-]/g, '').toUpperCase()}${driverName || ownerName ? ` - ${(driverName || ownerName || '').trim().toUpperCase()}` : ''} documents`}</strong>
                  </div>
                </div>
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    icon={<GoogleOutlined />}
                    href="https://script.google.com/d/1loTjhVuqP4DFJrChavoZWzfGj57sjZRneDGuzeLMBwo7BItcHV2bcBLs/edit"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    1-Click Authorize in Apps Script
                  </Button>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    loading={syncingDrive}
                    onClick={handleSyncDrive}
                  >
                    Check &amp; Sync Drive
                  </Button>
                </Space>
              </div>
            }
          />
        )}
        {/* Category Filters */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Radio.Group
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            size="small"
            buttonStyle="solid"
          >
            <Radio.Button value="ALL">All ({documents.length})</Radio.Button>
            <Radio.Button value="RC">RC</Radio.Button>
            <Radio.Button value="INSURANCE">Insurance</Radio.Button>
            <Radio.Button value="FITNESS">Fitness</Radio.Button>
            <Radio.Button value="PUCC">PUCC</Radio.Button>
            <Radio.Button value="PERMITS">Permits</Radio.Button>
            <Radio.Button value="OTHER">Other</Radio.Button>
          </Radio.Group>

          <Text type="secondary" style={{ fontSize: 12, color: isDark ? '#A1A1AA' : '#64748B' }}>
            Showing {filteredDocs.length} of {documents.length} document(s)
          </Text>
        </div>

        {/* Documents Table */}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredDocs}
          loading={loading}
          pagination={false}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div style={{ padding: '16px 0' }}>
                    <Text style={{ display: 'block', color: isDark ? '#A1A1AA' : '#64748B', marginBottom: 8 }}>
                      No vehicle documents uploaded in Google Drive yet.
                    </Text>
                    <Button
                      type="primary"
                      size="small"
                      icon={<UploadOutlined />}
                      onClick={() => setUploadModalOpen(true)}
                      style={{ background: '#0284C7', borderColor: '#0284C7' }}
                    >
                      Upload RC, Insurance, or Fitness Now
                    </Button>
                  </div>
                }
              />
            ),
          }}
        />

        {/* Footer Note */}
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: isDark ? '1px solid #27272A' : '1px solid #F1F5F9',
            paddingTop: 12,
          }}
        >
          <Text type="secondary" style={{ fontSize: 11, color: isDark ? '#71717A' : '#94A3B8' }}>
            All documents are securely archived in Google Drive under: <code>Billing-Software-Documents/{driveFolderName || `${(vehicleNumber || '').replace(/[\s-]/g, '').toUpperCase()}${driverName || ownerName ? ` - ${(driverName || ownerName || '').trim().toUpperCase()}` : ''} documents`}</code>
          </Text>
          <Button onClick={onClose} size="small">
            Close
          </Button>
        </div>
      </div>

      {/* Upload Modal */}
      <DocumentUploadModal
        open={uploadModalOpen}
        vehicleId={vehicleId}
        vehicleNumber={vehicleNumber}
        defaultDriverName={driverName || ownerName}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          fetchDocuments();
          if (onDocumentsChanged) onDocumentsChanged();
        }}
      />

      {/* Viewer Modal */}
      <DocumentViewerModal
        open={viewerModalOpen}
        document={selectedDoc}
        onClose={() => {
          setViewerModalOpen(false);
          setSelectedDoc(null);
        }}
      />

      {/* Rename File Modal */}
      <Modal
        open={renameModalOpen}
        title="Rename Document"
        onCancel={() => {
          setRenameModalOpen(false);
          setRenamingDoc(null);
        }}
        onOk={handleRenameSubmit}
        confirmLoading={renaming}
        okText="Save Name"
        destroyOnClose
      >
        <div style={{ marginTop: 12 }}>
          <Text style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
            New File Name:
          </Text>
          <Input
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="e.g. RC_2026.pdf"
            onPressEnter={handleRenameSubmit}
          />
          <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 11 }}>
            This will rename the file in both the database registry and Google Drive.
          </Text>
        </div>
      </Modal>
    </Modal>
  );
};
