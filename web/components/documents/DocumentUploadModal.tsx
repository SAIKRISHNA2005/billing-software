'use client';

import React, { useState } from 'react';
import {
  Modal,
  Upload,
  Button,
  Select,
  DatePicker,
  Input,
  Space,
  Typography,
  Alert,
  message,
  Card,
  Row,
  Col,
  Popconfirm,
} from 'antd';
import {
  InboxOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  CloudUploadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useTheme } from '@/components/providers/ThemeContext';

const { Text, Title } = Typography;
const { Option } = Select;

export const DOCUMENT_CATEGORIES = [
  { value: 'RC', label: 'Registration Certificate (RC)', color: 'blue' },
  { value: 'INSURANCE', label: 'Insurance Policy', color: 'purple' },
  { value: 'FITNESS', label: 'Fitness Certificate', color: 'green' },
  { value: 'PUCC', label: 'PUCC / Emission Certificate', color: 'orange' },
  { value: 'STATE_PERMIT', label: 'State Goods Permit', color: 'cyan' },
  { value: 'NATIONAL_PERMIT', label: 'National Permit (All India)', color: 'geekblue' },
  { value: 'TAX_TOKEN', label: 'Road Tax Token / Receipt', color: 'gold' },
  { value: 'OTHER', label: 'Other Compliance Document', color: 'default' },
];

export interface PendingFileItem {
  uid: string;
  file: File;
  name: string;
  size: number;
  category: string;
  documentNumber: string;
  expiryDate: string | null;
  notes: string;
  base64Data?: string;
}

interface DocumentUploadModalProps {
  open: boolean;
  vehicleId: string;
  vehicleNumber: string;
  defaultDriverName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  open,
  vehicleId,
  vehicleNumber,
  defaultDriverName,
  onClose,
  onSuccess,
}) => {
  const { themeMode } = useTheme();
  const isDark = themeMode === 'dark';

  const [pendingFiles, setPendingFiles] = useState<PendingFileItem[]>([]);
  const [driverName, setDriverName] = useState<string>(defaultDriverName || '');
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setDriverName(defaultDriverName || '');
    }
  }, [open, defaultDriverName]);

  // Reset when closing
  const handleCancel = () => {
    if (uploading) return;
    setPendingFiles([]);
    setErrorMsg(null);
    onClose();
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:application/pdf;base64, prefix
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle incoming files
  const handleBeforeUpload = async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');
    
    if (!isPdf && !isImage) {
      message.error(`"${file.name}" is not a PDF or image document.`);
      return Upload.LIST_IGNORE;
    }

    if (file.size > 25 * 1024 * 1024) {
      message.error(`"${file.name}" exceeds the 25MB file size limit.`);
      return Upload.LIST_IGNORE;
    }

    // Auto-detect category from file name
    const lowerName = file.name.toLowerCase();
    let detectedCategory = 'OTHER';
    if (lowerName.includes('rc') || lowerName.includes('reg')) detectedCategory = 'RC';
    else if (lowerName.includes('insur') || lowerName.includes('policy')) detectedCategory = 'INSURANCE';
    else if (lowerName.includes('fit') || lowerName.includes('fc')) detectedCategory = 'FITNESS';
    else if (lowerName.includes('puc') || lowerName.includes('pollut')) detectedCategory = 'PUCC';
    else if (lowerName.includes('nat') || lowerName.includes('np')) detectedCategory = 'NATIONAL_PERMIT';
    else if (lowerName.includes('per') || lowerName.includes('state')) detectedCategory = 'STATE_PERMIT';
    else if (lowerName.includes('tax')) detectedCategory = 'TAX_TOKEN';

    const newItem: PendingFileItem = {
      uid: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      file,
      name: file.name,
      size: file.size,
      category: detectedCategory,
      documentNumber: '',
      expiryDate: null,
      notes: '',
    };

    setPendingFiles((prev) => [...prev, newItem]);
    return false; // Prevent automatic antd upload
  };

  const handleUpdateItem = (uid: string, field: keyof PendingFileItem, value: any) => {
    setPendingFiles((prev) =>
      prev.map((item) => (item.uid === uid ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveItem = (uid: string) => {
    setPendingFiles((prev) => prev.filter((item) => item.uid !== uid));
  };

  // Submit all pending files
  const handleUploadSubmit = async () => {
    if (pendingFiles.length === 0) {
      message.warning('Please select at least one document to upload.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);

    try {
      // Convert all files to base64
      const payloadFiles = await Promise.all(
        pendingFiles.map(async (item) => {
          const b64 = await fileToBase64(item.file);
          return {
            category: item.category,
            fileName: item.name,
            mimeType: item.file.type || 'application/pdf',
            base64Data: b64,
            documentNumber: item.documentNumber || undefined,
            expiryDate: item.expiryDate || undefined,
            notes: item.notes || undefined,
          };
        })
      );

      const res = await axios.post('/api/documents', {
        vehicleId,
        vehicleNumber,
        driverName: driverName.trim(),
        files: payloadFiles,
      });

      if (res.data?.success) {
        if (res.data.data?.isPendingDriveSync || res.data.data?.isDriveAuthorized === false) {
          message.success(
            `Successfully saved ${payloadFiles.length} document(s) to secure storage!`
          );
        } else {
          message.success(
            `Successfully uploaded ${payloadFiles.length} document(s) to vehicle Google Drive folder!`
          );
        }
        setPendingFiles([]);
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.data?.message || 'Failed to upload documents.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Error uploading documents.');
    } finally {
      setUploading(false);
    }
  };

  const isAuthError = Boolean(
    errorMsg && (
      errorMsg.includes('permission') ||
      errorMsg.includes('DriveApp') ||
      errorMsg.includes('Required permissions')
    )
  );

  const cleanVeh = (vehicleNumber || '').replace(/[\s-]/g, '').toUpperCase();
  const folderPreview = driverName.trim()
    ? `${cleanVeh} - ${driverName.trim().toUpperCase()} documents`
    : `${cleanVeh} documents`;

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={780}
      destroyOnClose
      title={
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <CloudUploadOutlined style={{ color: '#0284C7', fontSize: 22, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: isDark ? '#FFFFFF' : '#1E2933' }}>
              Upload Vehicle Documents
            </span>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Vehicle: <strong style={{ color: isDark ? '#38BDF8' : '#0284C7' }}>{vehicleNumber}</strong>
              </Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: isDark ? '#CBD5E1' : '#475569' }}>
                  Driver Name:
                </span>
                <Input
                  size="small"
                  placeholder="e.g. RAJESH"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  style={{ width: 160 }}
                />
              </div>
              <span style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>
                Drive Folder: <strong>{folderPreview}</strong>
              </span>
            </div>
          </div>
        </div>
      }
    >
      <div style={{ marginTop: 12 }}>
        {errorMsg && (
          <Alert
            message={isAuthError ? 'Google Drive One-Time Authorization Required' : 'Upload Failed'}
            description={
              isAuthError ? (
                <div>
                  <p style={{ margin: '4px 0 8px 0' }}>
                    Google Apps Script requires a one-time permission grant from the Google account owner to create folders and upload files into Google Drive.
                  </p>
                  <Button
                    type="primary"
                    size="small"
                    href="https://script.google.com/d/1loTjhVuqP4DFJrChavoZWzfGj57sjZRneDGuzeLMBwo7BItcHV2bcBLs/edit"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Authorize in Apps Script (Click Run on authorizeDriveAccess)
                  </Button>
                </div>
              ) : (
                errorMsg
              )
            }
            type={isAuthError ? 'warning' : 'error'}
            showIcon
            closable
            onClose={() => setErrorMsg(null)}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Drag and Drop Zone */}
        <Upload.Dragger
          multiple
          accept=".pdf,application/pdf,image/*"
          showUploadList={false}
          beforeUpload={handleBeforeUpload}
          style={{
            padding: '20px 16px',
            background: isDark ? '#141416' : '#F8FAFC',
            borderColor: isDark ? '#3F3F46' : '#CBD5E1',
            borderRadius: 8,
          }}
        >
          <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
            <InboxOutlined style={{ color: '#0284C7', fontSize: 40 }} />
          </p>
          <p
            className="ant-upload-text"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: isDark ? '#FFFFFF' : '#1E2933',
              margin: '0 0 4px',
            }}
          >
            Click or drag RC, Insurance, Fitness, Permits, or PUCC PDFs to upload
          </p>
          <p
            className="ant-upload-hint"
            style={{ fontSize: 12, color: isDark ? '#A1A1AA' : '#64748B', margin: 0 }}
          >
            Supports single or multi-file uploads (PDF up to 25MB per file). Files are securely stored in vehicle-specific Google Drive folders.
          </p>
        </Upload.Dragger>

        {/* Selected Files List */}
        {pendingFiles.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <Text strong style={{ fontSize: 13, color: isDark ? '#FFFFFF' : '#1E2933' }}>
                Files Selected ({pendingFiles.length})
              </Text>
              <Popconfirm
                title="Delete all selected files?"
                description="Are you sure you want to remove all files from this upload list?"
                onConfirm={() => {
                  setPendingFiles([]);
                  message.info('All selected documents removed.');
                }}
                okText="Delete All"
                cancelText="Keep"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<DeleteOutlined />}>
                  Delete All
                </Button>
              </Popconfirm>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '42vh', overflowY: 'auto' }}>
              {pendingFiles.map((item, idx) => (
                <Card
                  key={item.uid}
                  size="small"
                  style={{
                    background: isDark ? '#18181B' : '#FFFFFF',
                    borderColor: isDark ? '#27272A' : '#E2E8F0',
                  }}
                >
                  <Row gutter={[12, 12]} align="middle">
                    <Col span={24}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: isDark ? '1px solid #27272A' : '1px solid #F1F5F9',
                          paddingBottom: 6,
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          <FilePdfOutlined style={{ color: '#E11D48', fontSize: 16, flexShrink: 0 }} />
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: 13,
                              color: isDark ? '#FFFFFF' : '#0F172A',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {idx + 1}. {item.name}
                          </span>
                          <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                            ({(item.size / (1024 * 1024)).toFixed(2)} MB)
                          </Text>
                        </div>
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveItem(item.uid)}
                        />
                      </div>
                    </Col>

                    <Col xs={24} sm={10}>
                      <Text style={{ fontSize: 11, color: isDark ? '#A1A1AA' : '#64748B', display: 'block', marginBottom: 2 }}>
                        Category *
                      </Text>
                      <Select
                        style={{ width: '100%' }}
                        value={item.category}
                        onChange={(val) => handleUpdateItem(item.uid, 'category', val)}
                        size="small"
                      >
                        {DOCUMENT_CATEGORIES.map((cat) => (
                          <Option key={cat.value} value={cat.value}>
                            {cat.label}
                          </Option>
                        ))}
                      </Select>
                    </Col>

                    <Col xs={24} sm={7}>
                      <Text style={{ fontSize: 11, color: isDark ? '#A1A1AA' : '#64748B', display: 'block', marginBottom: 2 }}>
                        Validity / Expiry Date
                      </Text>
                      <DatePicker
                        style={{ width: '100%' }}
                        size="small"
                        format="DD-MM-YYYY"
                        placeholder="Valid Up To"
                        value={item.expiryDate ? dayjs(item.expiryDate) : null}
                        onChange={(_, dateString) =>
                          handleUpdateItem(item.uid, 'expiryDate', dateString as string)
                        }
                      />
                    </Col>

                    <Col xs={24} sm={7}>
                      <Text style={{ fontSize: 11, color: isDark ? '#A1A1AA' : '#64748B', display: 'block', marginBottom: 2 }}>
                        Doc / Policy No.
                      </Text>
                      <Input
                        size="small"
                        placeholder="e.g. POL-98124"
                        value={item.documentNumber}
                        onChange={(e) => handleUpdateItem(item.uid, 'documentNumber', e.target.value)}
                      />
                    </Col>
                  </Row>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 12,
            marginTop: 20,
            borderTop: isDark ? '1px solid #27272A' : '1px solid #E2E8F0',
            paddingTop: 16,
          }}
        >
          {pendingFiles.length > 0 && (
            <Popconfirm
              title="Delete all selected files?"
              description="Are you sure you want to remove all files before confirming?"
              onConfirm={() => {
                setPendingFiles([]);
                message.info('All selected documents removed.');
              }}
              okText="Delete All"
              cancelText="Keep"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />} disabled={uploading} style={{ marginRight: 'auto' }}>
                Delete All
              </Button>
            </Popconfirm>
          )}
          <Button onClick={handleCancel} disabled={uploading}>
            Cancel
          </Button>
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            loading={uploading}
            disabled={pendingFiles.length === 0}
            onClick={handleUploadSubmit}
            style={{
              background: '#0284C7',
              borderColor: '#0284C7',
              paddingLeft: 20,
              paddingRight: 20,
            }}
          >
            {uploading
              ? 'Uploading to Google Drive...'
              : `Confirm & Upload ${pendingFiles.length} Document${pendingFiles.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
