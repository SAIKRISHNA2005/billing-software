'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Breadcrumb,
  Card,
  Tabs,
  Descriptions,
  Tag,
  Button,
  Space,
  Spin,
  Alert,
  Timeline,
  Row,
  Col,
  Statistic,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  ClockCircleOutlined,
  CarOutlined,
  DollarOutlined,
  UserOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { StageStepper } from '@/components/enquiry/StageStepper';
import { MovementTimesModal } from '@/components/enquiry/MovementTimesModal';
import { EnquiryExpensesTab } from '@/components/enquiry/EnquiryExpensesTab';
import { STAGE_TAG_COLORS, STAGE_LABELS } from '@/lib/utils/enquiryValidation';
import { formatCurrencyINR, formatDate, formatDateTime } from '@/lib/utils/format';

const { Title, Text, Paragraph } = Typography;

interface PageProps {
  params: {
    id: string;
  };
}

export default function EnquiryDetailPage({ params }: PageProps) {
  const { id } = params;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [movementModalOpen, setMovementModalOpen] = useState(false);

  const fetchEnquiryDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>(`/enquiries/${id}`);
      if (res.data.success && res.data.data) {
        setData(res.data.data);
      } else {
        message.error(res.data.message || 'Failed to load enquiry');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error fetching enquiry');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEnquiryDetail();
  }, [fetchEnquiryDetail]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="Loading enquiry details..." />
      </div>
    );
  }

  if (!data || !data.enquiry) {
    return (
      <div style={{ maxWidth: 1000, margin: '40px auto' }}>
        <Alert
          message="Enquiry Not Found"
          description={`Could not locate transport enquiry with ID "${id}".`}
          type="error"
          showIcon
          action={
            <Button type="primary" onClick={() => router.push('/enquiries')}>
              Back to Enquiries
            </Button>
          }
        />
      </div>
    );
  }

  const { enquiry, movement, stageHistory, vendorFinance, company, client, vendor, vehicle, driver, container } = data;
  const stage = enquiry.stage || 'ENQUIRY_CREATED';
  const isBilled = enquiry.billId || stage === 'BILLING' || stage === 'PROCESSED';

  // Tab items definition
  const tabItems = [
    {
      key: 'basic',
      label: (
        <span>
          <SafetyCertificateOutlined /> Basic
        </span>
      ),
      children: (
        <Card bordered={false}>
          <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
            <Descriptions.Item label="Enquiry ID">
              <Text strong>{enquiry.id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Transaction No">
              <Text copyable strong style={{ color: '#1677ff' }}>
                {enquiry.transactionNumber}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Creation Date">{formatDate(enquiry.date)}</Descriptions.Item>

            <Descriptions.Item label="Company Name">
              <Text strong>{company?.name || enquiry.companyId}</Text>
              {company?.gstin && <div style={{ fontSize: 12, color: '#666' }}>GSTIN: {company.gstin}</div>}
            </Descriptions.Item>

            <Descriptions.Item label="Client Name">
              <Text strong>{client?.name || enquiry.clientId}</Text>
              {client?.gstin && <div style={{ fontSize: 12, color: '#666' }}>GSTIN: {client.gstin}</div>}
            </Descriptions.Item>

            <Descriptions.Item label="Loading Type">
              <Tag color={enquiry.loadingType === 'Import' ? 'blue' : 'orange'}>
                {enquiry.loadingType}
              </Tag>
            </Descriptions.Item>

            <Descriptions.Item label="Current Stage">
              <Tag color={STAGE_TAG_COLORS[stage] || 'default'}>{STAGE_LABELS[stage] || stage}</Tag>
            </Descriptions.Item>

            <Descriptions.Item label="Bill Association">
              {enquiry.billId ? (
                <Tag color="green">Billed ({enquiry.billId})</Tag>
              ) : (
                <Tag color="default">Unbilled</Tag>
              )}
            </Descriptions.Item>

            <Descriptions.Item label="Completed Date">
              {enquiry.completedAt ? formatDateTime(enquiry.completedAt) : '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ),
    },
    {
      key: 'vehicle',
      label: (
        <span>
          <CarOutlined /> Vehicle &amp; Driver
        </span>
      ),
      children: (
        <Card bordered={false}>
          <Descriptions bordered column={{ xs: 1, sm: 2, md: 2 }}>
            <Descriptions.Item label="Vehicle Number">
              <Text strong style={{ fontSize: 15 }}>
                {vehicle?.vehicleNumber || enquiry.vehicleNumber || '-'}
              </Text>
            </Descriptions.Item>

            <Descriptions.Item label="Driver Information">
              {driver ? (
                <div>
                  <Text strong>{driver.name}</Text>
                  <div>Phone: {driver.phone}</div>
                  {driver.licenseNumber && <div>License: {driver.licenseNumber}</div>}
                </div>
              ) : (
                enquiry.driverPhone || '-'
              )}
            </Descriptions.Item>

            <Descriptions.Item label="Container Number">
              <Text strong>{container?.containerNumber || enquiry.containerNumber || '-'}</Text>
              {container?.containerType && (
                <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>
                  ({container.containerType})
                </span>
              )}
            </Descriptions.Item>

            <Descriptions.Item label="Seal Number">{enquiry.sealNumber || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>
      ),
    },
    {
      key: 'movement',
      label: (
        <span>
          <ClockCircleOutlined /> Movement Gate Times
        </span>
      ),
      children: (
        <Card
          bordered={false}
          extra={
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => setMovementModalOpen(true)}
            >
              Update Gate Times
            </Button>
          }
        >
          <Descriptions bordered column={{ xs: 1, sm: 2, md: 2 }} style={{ marginBottom: 20 }}>
            <Descriptions.Item label="Factory / Company Gate-In">
              {formatDateTime(movement?.companyInTime)}
            </Descriptions.Item>
            <Descriptions.Item label="Factory / Company Gate-Out">
              {formatDateTime(movement?.companyOutTime)}
            </Descriptions.Item>

            <Descriptions.Item label="Print Gate-In">
              {formatDateTime(movement?.printInTime)}
            </Descriptions.Item>
            <Descriptions.Item label="Print Gate-Out">
              {formatDateTime(movement?.printOutTime)}
            </Descriptions.Item>

            <Descriptions.Item label="Port Gate-In">
              {formatDateTime(movement?.portInTime)}
            </Descriptions.Item>
            <Descriptions.Item label="Port Gate-Out">
              {formatDateTime(movement?.portOutTime)}
            </Descriptions.Item>

            <Descriptions.Item label="Movement Status">
              <Tag color={movement?.movementStatus === 'MOVED' ? 'green' : 'default'}>
                {movement?.movementStatus || 'NOT_MOVED'}
              </Tag>
            </Descriptions.Item>

            <Descriptions.Item label="Shipping Status">
              <Tag
                color={
                  movement?.shippingStatus === 'COMPLETED'
                    ? 'green'
                    : movement?.shippingStatus === 'IN_PROGRESS'
                    ? 'blue'
                    : 'default'
                }
              >
                {movement?.shippingStatus || 'PENDING'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ),
    },
    {
      key: 'money',
      label: (
        <span>
          <DollarOutlined /> Money &amp; Vendor Finance
        </span>
      ),
      children: (
        <Card bordered={false}>
          <Row gutter={24} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" style={{ backgroundColor: '#fafafa' }}>
                <Statistic
                  title="Freight Amount"
                  value={enquiry.freightAmount || 0}
                  precision={2}
                  prefix="₹"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" style={{ backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}>
                <Statistic
                  title="Vendor Total Payable"
                  value={vendorFinance?.totalPayable || 0}
                  precision={2}
                  prefix="₹"
                  valueStyle={{ color: '#389e0d' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" style={{ backgroundColor: '#fafafa' }}>
                <Statistic
                  title="Vendor Total Paid"
                  value={vendorFinance?.totalPaid || 0}
                  precision={2}
                  prefix="₹"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" style={{ backgroundColor: '#fffbe6', borderColor: '#ffe58f' }}>
                <Statistic
                  title="Vendor Balance Pending"
                  value={vendorFinance?.balance || 0}
                  precision={2}
                  prefix="₹"
                  valueStyle={{ color: '#d46b08' }}
                />
              </Card>
            </Col>
          </Row>

          <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
            <Descriptions.Item label="Advance Amount">
              {formatCurrencyINR(enquiry.advanceAmount)}
            </Descriptions.Item>
            <Descriptions.Item label="Extra Advance">
              {formatCurrencyINR(enquiry.extraAdvance)}
            </Descriptions.Item>
            <Descriptions.Item label="Diesel Amount">
              {formatCurrencyINR(enquiry.dieselAmount)}
            </Descriptions.Item>
            <Descriptions.Item label="Halting Days">{enquiry.haltingDays || 0} days</Descriptions.Item>
            <Descriptions.Item label="Halting Amount">
              {formatCurrencyINR(enquiry.haltingAmount)}
            </Descriptions.Item>
            <Descriptions.Item label="Bonus Amount">
              {formatCurrencyINR(enquiry.bonus)}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ),
    },
    {
      key: 'expenses',
      label: (
        <span>
          <WalletOutlined /> Expenses
        </span>
      ),
      children: (
        <Card bordered={false}>
          <EnquiryExpensesTab enquiryId={enquiry.id} vehicleId={enquiry.vehicleId} />
        </Card>
      ),
    },
    {
      key: 'vendor',
      label: (
        <span>
          <UserOutlined /> Vendor
        </span>
      ),
      children: (
        <Card bordered={false}>
          {vendor ? (
            <>
              <Row gutter={16} style={{ marginBottom: 20 }}>
                <Col xs={24} sm={8}>
                  <Card size="small" style={{ backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}>
                    <Statistic
                      title="Vendor Total Payable"
                      value={vendorFinance?.totalPayable || 0}
                      precision={2}
                      prefix="₹"
                      valueStyle={{ color: '#389e0d' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card size="small" style={{ backgroundColor: '#e6f4ff', borderColor: '#91caff' }}>
                    <Statistic
                      title="Vendor Total Paid"
                      value={vendorFinance?.totalPaid || 0}
                      precision={2}
                      prefix="₹"
                      valueStyle={{ color: '#0958d9' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card
                    size="small"
                    style={{
                      backgroundColor: (vendorFinance?.balance || 0) > 0 ? '#fffbe6' : '#f6ffed',
                      borderColor: (vendorFinance?.balance || 0) > 0 ? '#ffe58f' : '#b7eb8f',
                    }}
                  >
                    <Statistic
                      title="Vendor Balance Pending"
                      value={vendorFinance?.balance || 0}
                      precision={2}
                      prefix="₹"
                      valueStyle={{ color: (vendorFinance?.balance || 0) > 0 ? '#d46b08' : '#389e0d' }}
                    />
                  </Card>
                </Col>
              </Row>

              <Descriptions bordered column={{ xs: 1, sm: 2, md: 2 }}>
                <Descriptions.Item label="Vendor Name">
                  <a href={`/vendors/${vendor.id}`} style={{ fontWeight: 600, color: '#1677ff' }}>
                    {vendor.name}
                  </a>
                </Descriptions.Item>
                <Descriptions.Item label="Contact Person">{vendor.contactPerson || '-'}</Descriptions.Item>
                <Descriptions.Item label="Phone">{vendor.phone || '-'}</Descriptions.Item>
                <Descriptions.Item label="Email">{vendor.email || '-'}</Descriptions.Item>
                <Descriptions.Item label="GSTIN">{vendor.gstin || '-'}</Descriptions.Item>
                <Descriptions.Item label="PAN">{vendor.pan || '-'}</Descriptions.Item>
                <Descriptions.Item label="Address" span={2}>
                  {vendor.address || '-'}
                </Descriptions.Item>
              </Descriptions>
            </>
          ) : (
            <Alert
              message="No Vendor Attached"
              description="This enquiry is performed without an external vendor (or using internal fleet)."
              type="info"
              showIcon
            />
          )}
        </Card>
      ),
    },
    {
      key: 'history',
      label: (
        <span>
          <HistoryOutlined /> Stage History
        </span>
      ),
      children: (
        <Card bordered={false}>
          {Array.isArray(stageHistory) && stageHistory.length > 0 ? (
            <Timeline
              items={stageHistory.map((item: any) => ({
                color: item.direction === 'BACKWARD' ? 'orange' : 'green',
                children: (
                  <div>
                    <Space>
                      <Tag color={STAGE_TAG_COLORS[item.toStage] || 'blue'}>
                        {STAGE_LABELS[item.toStage] || item.toStage}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatDateTime(item.timestamp)}
                      </Text>
                    </Space>
                    {item.remarks && (
                      <div style={{ marginTop: 4, color: '#555', fontSize: 13 }}>
                        <em>Remarks:</em> {item.remarks}
                      </div>
                    )}
                    {item.fromStage && (
                      <div style={{ fontSize: 11, color: '#888' }}>
                        From: {STAGE_LABELS[item.fromStage] || item.fromStage}
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          ) : (
            <Text type="secondary">No stage history recorded yet.</Text>
          )}
        </Card>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { title: <Link href="/dashboard">Dashboard</Link> },
          { title: <Link href="/enquiries">Enquiries</Link> },
          { title: enquiry.id },
        ]}
        style={{ marginBottom: 16 }}
      />

      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <Space align="center">
            <Link href="/enquiries">
              <Button icon={<ArrowLeftOutlined />} shape="circle" />
            </Link>
            <Title level={2} style={{ margin: 0 }}>
              {enquiry.id}
            </Title>
            <Tag color="blue" style={{ fontSize: 13, padding: '2px 8px' }}>
              {enquiry.transactionNumber}
            </Tag>
            <Tag color={STAGE_TAG_COLORS[stage] || 'default'} style={{ fontSize: 13, padding: '2px 8px' }}>
              {STAGE_LABELS[stage] || stage}
            </Tag>
          </Space>
          <Paragraph type="secondary" style={{ marginTop: 6, marginLeft: 40 }}>
            Created on {formatDate(enquiry.date)} • {enquiry.loadingType} Job for {client?.name || enquiry.clientId}
          </Paragraph>
        </div>

        <Space>
          <Link href={`/enquiries/${id}/edit`}>
            <Button type="primary" icon={<EditOutlined />}>
              Edit Enquiry
            </Button>
          </Link>
        </Space>
      </div>

      {/* 7-Stage Visual Stepper Component */}
      <StageStepper
        enquiryId={id}
        currentStage={stage}
        enquiry={enquiry}
        movement={movement}
        onStageChanged={fetchEnquiryDetail}
      />

      {/* Tabbed Detail Sections (No fake tabs!) */}
      <Card style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <Tabs defaultActiveKey="basic" items={tabItems} />
      </Card>

      {/* Quick Movement Times Update Modal */}
      <MovementTimesModal
        open={movementModalOpen}
        enquiryId={id}
        initialMovement={movement}
        onClose={() => setMovementModalOpen(false)}
        onSuccess={fetchEnquiryDetail}
      />
    </div>
  );
}
