'use me';
'use client';

import React, { useState, useEffect } from 'react';
import { Table, Card, Input, Select, Tag, Modal, Typography, Space, Button } from 'antd';
import { AuditOutlined, SearchOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
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
          entity: entityVal
        }
      });

      if (res.data && res.data.success) {
        const result = res.data.data;
        setData(result.items || []);
        setPagination({
          current: result.page || page,
          pageSize: result.limit || 20,
          total: result.total || 0
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

  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (ts: string) => (ts ? dayjs(ts).format('DD-MM-YYYY HH:mm:ss') : '-')
    },
    {
      title: 'Entity',
      dataIndex: 'entity',
      key: 'entity',
      render: (entity: string) => <Tag color="blue">{entity?.toUpperCase() || 'GENERAL'}</Tag>
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => <Text strong>{action}</Text>
    },
    {
      title: 'Entity ID',
      dataIndex: 'entityId',
      key: 'entityId',
      render: (id: string) => <Text code>{id || '-'}</Text>
    },
    {
      title: 'Details',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => setSelectedRecord(record)}
        >
          View Changes
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <AuditOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          System Audit Logs
        </Title>
        <Button icon={<ReloadOutlined />} onClick={() => fetchAuditLogs(1)}>
          Refresh Logs
        </Button>
      </div>

      <Card style={{ borderRadius: 8 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Search action or ID..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => fetchAuditLogs(1, search, entityFilter)}
            style={{ width: 250 }}
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
            <Select.Option value="enquiries">Enquiries</Select.Option>
            <Select.Option value="bills">Bills</Select.Option>
            <Select.Option value="settings">Settings</Select.Option>
            <Select.Option value="master">Master Data</Select.Option>
            <Select.Option value="auth">Auth / Session</Select.Option>
          </Select>
        </Space>

        <Table
          columns={columns}
          dataSource={data}
          rowKey={(r) => r.id || r.timestamp + Math.random()}
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
        />
      </Card>

      <Modal
        title={`Audit Record Details (${selectedRecord?.action || ''})`}
        open={!!selectedRecord}
        onCancel={() => setSelectedRecord(null)}
        footer={null}
        width={700}
      >
        {selectedRecord && (
          <div>
            <p><strong>Entity:</strong> {selectedRecord.entity} | <strong>ID:</strong> {selectedRecord.entityId}</p>
            <p><strong>Timestamp:</strong> {dayjs(selectedRecord.timestamp).format('DD-MM-YYYY HH:mm:ss')}</p>
            
            <Title level={5} style={{ marginTop: 16 }}>Previous Value (Old):</Title>
            <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, maxHeight: 150, overflow: 'auto' }}>
              {formatJSON(selectedRecord.oldValue)}
            </pre>

            <Title level={5} style={{ marginTop: 16 }}>Updated Value (New):</Title>
            <pre style={{ background: '#e6f7ff', padding: 12, borderRadius: 4, maxHeight: 150, overflow: 'auto' }}>
              {formatJSON(selectedRecord.newValue)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
}
