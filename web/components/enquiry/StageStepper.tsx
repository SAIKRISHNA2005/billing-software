'use client';

import React, { useState } from 'react';
import {
  Steps,
  Button,
  Space,
  Modal,
  Input,
  Alert,
  Tooltip,
  message,
  Typography,
  Card,
} from 'antd';
import {
  ArrowRightOutlined,
  ArrowLeftOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { apiClient } from '@/lib/api/client';

const { Text } = Typography;

export const STAGES_CONFIG = [
  {
    key: 'ENQUIRY_CREATED',
    title: 'Created',
    description: 'Job initiated',
    requirementText: 'Initial creation',
  },
  {
    key: 'VEHICLE_ASSIGNED',
    title: 'Vehicle Assigned',
    description: 'Vehicle & driver allocated',
    requirementText: 'Requires Vehicle Number and Driver Number',
  },
  {
    key: 'CONTAINER_MOVEMENT',
    title: 'Container Movement',
    description: 'Container allocated',
    requirementText: 'Requires Container Number',
  },
  {
    key: 'PORT_MOVEMENT',
    title: 'Port Movement',
    description: 'In transit to port',
    requirementText: 'Requires Factory Gate-Out time',
  },
  {
    key: 'COMPLETED',
    title: 'Completed',
    description: 'Port operations finished',
    requirementText: 'Requires Port Gate-Out time',
  },
  {
    key: 'BILLING',
    title: 'Billing',
    description: 'Drafted in invoice',
    requirementText: 'Initiated via Billing Module',
  },
  {
    key: 'PROCESSED',
    title: 'Processed',
    description: 'Billed & closed',
    requirementText: 'Finalized via Billing Module',
  },
];

interface StageStepperProps {
  enquiryId: string;
  currentStage: string;
  enquiry: Record<string, any>;
  movement?: Record<string, any> | null;
  onStageChanged: () => void;
}

export const StageStepper: React.FC<StageStepperProps> = ({
  enquiryId,
  currentStage,
  enquiry,
  movement,
  onStageChanged,
}) => {
  const [loading, setLoading] = useState(false);
  const [backModalOpen, setBackModalOpen] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [missingReqModalOpen, setMissingReqModalOpen] = useState(false);
  const [missingReqMessage, setMissingReqMessage] = useState('');

  const currentIndex = STAGES_CONFIG.findIndex((s) => s.key === currentStage);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;

  const nextStageConfig =
    safeCurrentIndex < STAGES_CONFIG.length - 1 ? STAGES_CONFIG[safeCurrentIndex + 1] : null;
  const prevStageConfig = safeCurrentIndex > 0 ? STAGES_CONFIG[safeCurrentIndex - 1] : null;

  // Local pre-validation for next stage requirements
  const checkMissingPrerequisite = (toStageKey: string): string | null => {
    if (toStageKey === 'VEHICLE_ASSIGNED') {
      if (!enquiry.vehicleId && !enquiry.vehicleNumber) {
        return 'Missing Requirement: A Vehicle Number must be assigned before advancing to Vehicle Assigned stage.';
      }
      if (!enquiry.driverId && !enquiry.driverPhone && !enquiry.driverName) {
        return 'Missing Requirement: A Driver must be assigned before advancing to Vehicle Assigned stage.';
      }
    }

    if (toStageKey === 'CONTAINER_MOVEMENT') {
      if (!enquiry.containerId && !enquiry.containerNumber) {
        return 'Missing Requirement: A Container Number must be assigned before advancing to Container Movement stage.';
      }
    }

    if (toStageKey === 'PORT_MOVEMENT') {
      if (!movement || !movement.companyOutTime) {
        return 'Missing Requirement: Factory / Company Gate-Out time must be recorded before moving to Port Movement.';
      }
    }

    if (toStageKey === 'COMPLETED') {
      if (!movement || !movement.portOutTime) {
        return 'Missing Requirement: Port Gate-Out time must be recorded before completing the transport enquiry.';
      }
    }

    if (toStageKey === 'BILLING' || toStageKey === 'PROCESSED') {
      return 'Notice: Transitions to Billing and Processed stages must be performed through the Billing module when creating an invoice.';
    }

    return null;
  };

  const handleNextStage = async () => {
    if (!nextStageConfig) return;

    if (nextStageConfig.key === 'BILLING' || nextStageConfig.key === 'PROCESSED') {
      Modal.info({
        title: 'Billing Module Action Required',
        icon: <InfoCircleOutlined style={{ color: '#1677ff' }} />,
        content: (
          <div>
            <p>
              This job is completed! In accordance with transport workflow, advancing to{' '}
              <strong>Billing</strong> is handled by selecting completed enquiries in the{' '}
              <strong>Billing &gt; Pending Bills</strong> module.
            </p>
          </div>
        ),
      });
      return;
    }

    // Pre-check requirements
    const preCheckError = checkMissingPrerequisite(nextStageConfig.key);
    if (preCheckError) {
      setMissingReqMessage(preCheckError);
      setMissingReqModalOpen(true);
      return;
    }

    // Call API
    setLoading(true);
    try {
      const res = await apiClient.post<any>(`/enquiries/${enquiryId}/stage`, {
        toStage: nextStageConfig.key,
        remarks: `Advanced to ${nextStageConfig.title}`,
      });

      if (res.data.success) {
        message.success(`Successfully transitioned to ${nextStageConfig.title}`);
        onStageChanged();
      } else {
        setMissingReqMessage(res.data.message || 'Stage transition rejected by server.');
        setMissingReqModalOpen(true);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to advance stage';
      setMissingReqMessage(msg);
      setMissingReqModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevStage = async () => {
    if (!prevStageConfig) return;

    setLoading(true);
    try {
      const res = await apiClient.post<any>(`/enquiries/${enquiryId}/stage`, {
        toStage: prevStageConfig.key,
        remarks: remarks || `Moved back to ${prevStageConfig.title}`,
      });

      if (res.data.success) {
        message.warning(`Enquiry reverted back to ${prevStageConfig.title}`);
        setBackModalOpen(false);
        setRemarks('');
        onStageChanged();
      } else {
        message.error(res.data.message || 'Failed to revert stage');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || err.message || 'Failed to revert stage');
    } finally {
      setLoading(false);
    }
  };

  // Determine stage status
  const isBilledStage = currentStage === 'BILLING' || currentStage === 'PROCESSED';

  return (
    <Card style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      {/* 7-Stage Visual Stepper */}
      <Steps
        current={safeCurrentIndex}
        size="small"
        items={STAGES_CONFIG.map((stage, idx) => {
          let status: 'wait' | 'process' | 'finish' = 'wait';
          if (idx < safeCurrentIndex) status = 'finish';
          else if (idx === safeCurrentIndex) status = 'process';

          return {
            title: stage.title,
            description: stage.description,
            status,
          };
        })}
        style={{ marginBottom: 24 }}
      />

      {/* Action Controls & Stage Indicators */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          paddingTop: 8,
          borderTop: '1px solid #f0f0f0',
        }}
      >
        <Space>
          <Text strong>Current Stage:</Text>
          <Text
            style={{
              fontWeight: 600,
              padding: '4px 12px',
              backgroundColor: isBilledStage ? '#f6ffed' : '#e6f4ff',
              color: isBilledStage ? '#389e0d' : '#0958d9',
              borderRadius: 6,
              border: `1px solid ${isBilledStage ? '#b7eb8f' : '#91caff'}`,
            }}
          >
            {STAGES_CONFIG[safeCurrentIndex]?.title || currentStage}
          </Text>
          {nextStageConfig && (
            <Text type="secondary" style={{ fontSize: 13, marginLeft: 8 }}>
              (Next: {nextStageConfig.title})
            </Text>
          )}
        </Space>

        <Space>
          {/* Move Back Button */}
          {prevStageConfig && !isBilledStage && (
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => setBackModalOpen(true)}
              disabled={loading || safeCurrentIndex === 0}
            >
              Move Back to {prevStageConfig.title}
            </Button>
          )}

          {/* Move Next Button */}
          {nextStageConfig && (
            <Tooltip
              title={
                nextStageConfig.key === 'BILLING'
                  ? 'Completed enquiries are billed via Billing Module'
                  : `Advance to ${nextStageConfig.title}`
              }
            >
              <Button
                type="primary"
                icon={nextStageConfig.key === 'BILLING' ? <LockOutlined /> : <ArrowRightOutlined />}
                onClick={handleNextStage}
                loading={loading}
                style={{
                  backgroundColor: nextStageConfig.key === 'COMPLETED' ? '#52c41a' : undefined,
                }}
              >
                {nextStageConfig.key === 'BILLING'
                  ? 'Ready for Billing'
                  : `Move to ${nextStageConfig.title}`}
              </Button>
            </Tooltip>
          )}

          {currentStage === 'PROCESSED' && (
            <Space style={{ color: '#52c41a' }}>
              <CheckCircleOutlined />
              <Text strong style={{ color: '#52c41a' }}>
                Job Fully Processed
              </Text>
            </Space>
          )}
        </Space>
      </div>

      {/* Confirmation Modal for Moving Back */}
      <Modal
        title="Confirm Stage Reversion"
        open={backModalOpen}
        onOk={handlePrevStage}
        confirmLoading={loading}
        onCancel={() => {
          setBackModalOpen(false);
          setRemarks('');
        }}
        okText="Yes, Move Back"
        okType="danger"
      >
        <Alert
          message="Reverting Stage"
          description={`Are you sure you want to move this enquiry backwards from "${
            STAGES_CONFIG[safeCurrentIndex]?.title
          }" to "${prevStageConfig?.title}"?`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <div style={{ marginTop: 8 }}>
          <Text strong>Reason / Remarks (Optional):</Text>
          <Input.TextArea
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Specify reason for moving back..."
            style={{ marginTop: 6 }}
          />
        </div>
      </Modal>

      {/* Modal for Missing Stage Requirement */}
      <Modal
        title="Stage Advance Blocked"
        open={missingReqModalOpen}
        onOk={() => setMissingReqModalOpen(false)}
        onCancel={() => setMissingReqModalOpen(false)}
        okText="Got it"
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <ExclamationCircleOutlined style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            Prerequisite Not Met
          </div>
          <Alert message={missingReqMessage} type="error" showIcon style={{ textAlign: 'left' }} />
          <div style={{ marginTop: 16, textAlign: 'left', color: '#666', fontSize: 13 }}>
            Please update the required enquiry details or movement gate times before advancing.
          </div>
        </div>
      </Modal>
    </Card>
  );
};
