'use client';

import React, { useState, useEffect } from 'react';
import { Table, Card, Input, Select, Tag, Modal, Typography, Space, Button, Descriptions } from 'antd';
import {
  AuditOutlined,
  SearchOutlined,
  EyeOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  UserOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function AuditLogPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  const fetchAuditLogs = async (page = 1, searchVal = search, entityVal = entityFilter) => {
    setLoading(true);
    try {
      const res = await axios.get('/api/settings/audit', {
        params: {
          page,
          limit: pagination.pageSize,
          search: searchVal,
          entity: entityVal,
        },
      });

      if (res.data && res.data.success) {
        const result = res.data.data;
        setData(result.items || []);
        setPagination({
          current: result.page || page,
          pageSize: result.limit || 20,
          total: result.total || 0,
        });
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs(1);
  }, []);

  const handleTableChange = (newPagination: any) => {
    fetchAuditLogs(newPagination.current);
  };

  const formatJSON = (val: string) => {
    if (!val) return 'None';
    try {
      return JSON.stringify(JSON.parse(val), null, 2);
    } catch {
      return val;
    }
  };

  const getActionTagColor = (action: string) => {
    switch (action?.toUpperCase()) {
      case 'LOGIN':
        return 'cyan';
      case 'CREATE':
        return 'green';
      case 'UPDATE':
        return 'orange';
      case 'DELETE':
        return 'red';
      default:
        return 'blue';
    }
  };

  const columns = [
    {
      title: 'Timestamp & Date',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 175,
      render: (ts: string) => (
        <Space size={6}>
          <ClockCircleOutlined style={{ color: '#365A73' }} />
          <Text style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>
            {ts ? dayjs(ts).format('DD-MM-YYYY HH:mm:ss') : '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'User ID',
      dataIndex: 'userId',
      key: 'userId',
      width: 130,
      render: (userId: string) => (
        <Tag style={{ background: '#EEF3F6', color: '#17324D', border: '1px solid #D4DAD9', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <UserOutlined />
          {userId || 'USR-001'}
        </Tag>
      ),
    },
    {
      title: 'Physical Location',
      dataIndex: 'location',
      key: 'location',
      width: 280,
      render: (loc: string, record: any) => {
        const locationText = loc || 'Chennai, Tamil Nadu, India';

        // Extract coordinates if present (e.g. "GPS: 13.0827, 80.2707" or "Lat 13.08, Lon 80.27")
        const coordsMatch = locationText.match(/(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/);
        const mapUrl = coordsMatch
          ? `https://www.google.com/maps?q=${coordsMatch[1]},${coordsMatch[2]}`
          : null;

        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <EnvironmentOutlined style={{ color: '#365A73', marginTop: 3, flexShrink: 0 }} />
              <div style={{ fontSize: 12, lineHeight: 1.35, color: '#1f1f1f', wordBreak: 'break-word' }}>
                {locationText}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, paddingLeft: 18 }}>
              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11, color: '#17324D', fontWeight: 600 }}
                >
                  📍 Open in Google Maps
                </a>
              )}
              {record.ipAddress && record.ipAddress !== '-' && (
                <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                  IP: {record.ipAddress}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 110,
      align: 'center' as const,
      render: (action: string) => (
        <Tag color={getActionTagColor(action)} style={{ fontWeight: 700, padding: '2px 8px' }}>
          {action?.toUpperCase() || 'ACTION'}
        </Tag>
      ),
    },
    {
      title: 'Entity',
      dataIndex: 'entity',
      key: 'entity',
      width: 110,
      render: (entity: string) => (
        <Tag color="default" style={{ textTransform: 'uppercase', fontWeight: 500 }}>
          {entity || 'GENERAL'}
        </Tag>
      ),
    },
    {
      title: 'Target / Entity ID',
      dataIndex: 'entityId',
      key: 'entityId',
      width: 140,
      render: (id: string) => <Text code>{id || '-'}</Text>,
    },
    {
      title: 'Details',
      key: 'actions',
      width: 110,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Button
          type="primary"
          ghost
          size="small"
          icon={<EyeOutlined />}
          onClick={() => setSelectedRecord(record)}
        >
          View Details
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={2} style={{ margin: 0, color: '#1E2933' }}>
            <AuditOutlined style={{ marginRight: 8, color: '#17324D' }} />
            System Audit &amp; Security Logs
          </Title>
          <Text type="secondary">
            Live record of user activity, logins, timestamps, and physical access locations
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => fetchAuditLogs(1)}>
          Refresh Logs
        </Button>
      </div>

      <Card style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Search action, location, user ID..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => fetchAuditLogs(1, search, entityFilter)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="Filter by Entity"
            value={entityFilter || undefined}
            onChange={(val) => {
              setEntityFilter(val || '');
              fetchAuditLogs(1, search, val || '');
            }}
            style={{ width: 180 }}
            allowClear
          >
            <Select.Option value="users">Users &amp; Logins</Select.Option>
            <Select.Option value="enquiries">Enquiries</Select.Option>
            <Select.Option value="bills">Bills</Select.Option>
            <Select.Option value="settings">Settings</Select.Option>
            <Select.Option value="master">Master Data</Select.Option>
          </Select>
        </Space>

        <Table
          columns={columns}
          dataSource={data}
          rowKey={(r) => r.id || r.timestamp + Math.random()}
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          scroll={{ x: 1050 }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <AuditOutlined style={{ color: '#17324D' }} />
            <span>Audit Log Session Details ({selectedRecord?.action || ''})</span>
          </Space>
        }
        open={!!selectedRecord}
        onCancel={() => setSelectedRecord(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setSelectedRecord(null)}>
            Close
          </Button>,
        ]}
        width={750}
        destroyOnClose
      >
        {selectedRecord && (
          <div style={{ marginTop: 12 }}>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Action Performed">
                <Tag color={getActionTagColor(selectedRecord.action)} style={{ fontWeight: 700 }}>
                  {selectedRecord.action}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Target Entity">
                <Tag color="blue">{selectedRecord.entity?.toUpperCase() || 'GENERAL'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="User ID / Operator">
                <Tag color="purple" style={{ fontWeight: 600 }}>
                  <UserOutlined style={{ marginRight: 4 }} />
                  {selectedRecord.userId || 'USR-001'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Log Timestamp">
                <Text strong>{dayjs(selectedRecord.timestamp).format('DD-MM-YYYY HH:mm:ss')}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Physical Location" span={2}>
                <Space>
                  <EnvironmentOutlined style={{ color: '#eb2f96', fontSize: 16 }} />
                  <Text strong style={{ color: '#1f2937' }}>
                    {selectedRecord.location || 'Chennai, Tamil Nadu, India'}
                  </Text>
                  {selectedRecord.ipAddress && (
                    <Text type="secondary" code>
                      IP: {selectedRecord.ipAddress}
                    </Text>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Entity / Target ID" span={2}>
                <Text code>{selectedRecord.entityId || '-'}</Text>
              </Descriptions.Item>
            </Descriptions>

            {selectedRecord.oldValue && (
              <>
                <Title level={5} style={{ marginTop: 18, marginBottom: 6 }}>
                  Previous State (Old):
                </Title>
                <pre
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: 12,
                    borderRadius: 6,
                    maxHeight: 140,
                    overflow: 'auto',
                    fontSize: 12,
                  }}
                >
                  {formatJSON(selectedRecord.oldValue)}
                </pre>
              </>
            )}

            <Title level={5} style={{ marginTop: 18, marginBottom: 6 }}>
              {selectedRecord.oldValue ? 'Updated State / Details (New):' : 'Event Payload & Details:'}
            </Title>
            <pre
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                padding: 12,
                borderRadius: 6,
                maxHeight: 180,
                overflow: 'auto',
                fontSize: 12,
                color: '#166534',
              }}
            >
              {formatJSON(selectedRecord.newValue)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
}
