'use client';

import React, { useState } from 'react';
import {
  Table,
  Button,
  Input,
  Radio,
  Space,
  Card,
  Drawer,
  Form,
  Tag,
  Popconfirm,
  message,
  Typography,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  StopOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/api/client';
import { formatDate } from '@/lib/utils/format';

const { Text } = Typography;

export interface FormFieldConfig {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'select' | 'phone' | 'uppercase';
  required?: boolean;
  rules?: object[];
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  renderCustom?: (form: ReturnType<typeof Form.useForm>[0]) => React.ReactNode;
}

export interface MasterRecord {
  id: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface GenericMasterManagerProps<T extends MasterRecord = MasterRecord> {
  entity: 'companies' | 'clients' | 'vendors' | 'vehicles' | 'drivers';
  entitySingular: string;
  columns: ColumnsType<T>;
  formFields: FormFieldConfig[];
  defaultSortField?: string;
  extraHeaderActions?: React.ReactNode;
}

export function GenericMasterManager<T extends MasterRecord = MasterRecord>({
  entity,
  entitySingular,
  columns,
  formFields,
  defaultSortField = 'name',
  extraHeaderActions,
}: GenericMasterManagerProps<T>) {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('true');

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<T | null>(null);

  // Fetch list with TanStack Query
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['master', entity, { page, pageSize, search, activeFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        sortField: defaultSortField,
      });

      if (search.trim()) params.set('search', search.trim());
      if (activeFilter !== 'all') params.set('active', activeFilter);

      const res = await apiClient.get<{
        success: boolean;
        data: { items: T[]; total: number; page: number; limit: number };
      }>(`/master/${entity}?${params.toString()}`);

      return res.data.data;
    },
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await apiClient.post<{ success: boolean; data: T; message: string }>(
        `/master/${entity}`,
        payload
      );
      return res.data;
    },
    onSuccess: () => {
      message.success(`${entitySingular} created successfully!`);
      setIsDrawerOpen(false);
      form.resetFields();
      setEditingRecord(null);
      queryClient.invalidateQueries({ queryKey: ['master', entity] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : `Failed to create ${entitySingular}`);
      message.error(msg);
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const res = await apiClient.put<{ success: boolean; data: T; message: string }>(
        `/master/${entity}/${id}`,
        payload
      );
      return res.data;
    },
    onSuccess: () => {
      message.success(`${entitySingular} updated successfully!`);
      setIsDrawerOpen(false);
      form.resetFields();
      setEditingRecord(null);
      queryClient.invalidateQueries({ queryKey: ['master', entity] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : `Failed to update ${entitySingular}`);
      message.error(msg);
    },
  });

  // Deactivate Mutation (Soft deactivation)
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<{ success: boolean; message: string }>(
        `/master/${entity}/${id}`
      );
      return res.data;
    },
    onSuccess: () => {
      message.success(`${entitySingular} deactivated successfully!`);
      queryClient.invalidateQueries({ queryKey: ['master', entity] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : `Failed to deactivate ${entitySingular}`);
      message.error(msg);
    },
  });

  // Reactivate Mutation
  const reactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<{ success: boolean; message: string }>(
        `/master/${entity}/${id}`,
        { action: 'reactivate' }
      );
      return res.data;
    },
    onSuccess: () => {
      message.success(`${entitySingular} reactivated successfully!`);
      queryClient.invalidateQueries({ queryKey: ['master', entity] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : `Failed to reactivate ${entitySingular}`);
      message.error(msg);
    },
  });

  const handleOpenCreate = () => {
    setEditingRecord(null);
    form.resetFields();
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (record: T) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setIsDrawerOpen(true);
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        updateMutation.mutate({ id: editingRecord.id, payload: values });
      } else {
        createMutation.mutate(values);
      }
    } catch {
      // Form validation failed
    }
  };

  // Build standard actions column
  const actionColumn: ColumnsType<T>[0] = {
    title: 'Actions',
    key: 'actions',
    width: 140,
    fixed: 'right',
    render: (_: unknown, record: T) => {
      const isActive = record.active !== false;
      return (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleOpenEdit(record)}
            title="Edit"
          />
          {isActive ? (
            <Popconfirm
              title={`Deactivate ${entitySingular}?`}
              description="Historical records will retain this reference, but it will be hidden from future dropdowns."
              onConfirm={() => deactivateMutation.mutate(record.id)}
              okText="Deactivate"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="text"
                danger
                icon={<StopOutlined />}
                size="small"
                title="Deactivate"
                loading={deactivateMutation.isPending}
              />
            </Popconfirm>
          ) : (
            <Popconfirm
              title={`Reactivate ${entitySingular}?`}
              description="This will restore the item to active dropdowns and lookups."
              onConfirm={() => reactivateMutation.mutate(record.id)}
              okText="Reactivate"
              cancelText="Cancel"
            >
              <Button
                type="text"
                icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                size="small"
                title="Reactivate"
                loading={reactivateMutation.isPending}
              />
            </Popconfirm>
          )}
        </Space>
      );
    },
  };

  // Append status column if not present
  const fullColumns: ColumnsType<T> = [
    ...columns,
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (active: boolean) =>
        active !== false ? (
          <Tag color="success">Active</Tag>
        ) : (
          <Tag color="default">Inactive</Tag>
        ),
    },
    actionColumn,
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} md={12} lg={10}>
            <Space style={{ width: '100%' }}>
              <Input
                placeholder={`Search ${entity}...`}
                prefix={<SearchOutlined />}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                allowClear
                style={{ width: 260 }}
              />
              <Radio.Group
                value={activeFilter}
                onChange={(e) => {
                  setActiveFilter(e.target.value);
                  setPage(1);
                }}
                buttonStyle="solid"
              >
                <Radio.Button value="true">Active</Radio.Button>
                <Radio.Button value="false">Inactive</Radio.Button>
                <Radio.Button value="all">All</Radio.Button>
              </Radio.Group>
            </Space>
          </Col>

          <Col xs={24} md={12} lg={14} style={{ textAlign: 'right' }}>
            <Space>
              {extraHeaderActions}
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetch()}
                loading={isFetching}
              >
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenCreate}
              >
                Add {entitySingular}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table<T>
          columns={fullColumns}
          dataSource={data?.items || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total: data?.total || 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `Total ${total} ${entity}`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* Create / Edit Drawer */}
      <Drawer
        title={editingRecord ? `Edit ${entitySingular}` : `Add New ${entitySingular}`}
        width={480}
        open={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingRecord(null);
          form.resetFields();
        }}
        extra={
          <Space>
            <Button
              onClick={() => {
                setIsDrawerOpen(false);
                setEditingRecord(null);
                form.resetFields();
              }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              onClick={handleFormSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingRecord ? 'Save Changes' : 'Create'}
            </Button>
          </Space>
        }
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          {editingRecord && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ID: <strong>{editingRecord.id}</strong> | Created: {formatDate(editingRecord.createdAt as string)}
              </Text>
            </div>
          )}

          {formFields.map((field) => {
            if (field.renderCustom) {
              return (
                <Form.Item
                  key={field.name}
                  name={field.name}
                  label={field.label}
                  rules={field.rules as never}
                >
                  {field.renderCustom(form)}
                </Form.Item>
              );
            }

            if (field.type === 'textarea') {
              return (
                <Form.Item
                  key={field.name}
                  name={field.name}
                  label={field.label}
                  rules={field.rules as never}
                >
                  <Input.TextArea rows={3} placeholder={field.placeholder} />
                </Form.Item>
              );
            }

            if (field.type === 'uppercase') {
              return (
                <Form.Item
                  key={field.name}
                  name={field.name}
                  label={field.label}
                  rules={field.rules as never}
                  normalize={(val: string) => (val ? val.replace(/[\s-]/g, '').toUpperCase() : '')}
                >
                  <Input placeholder={field.placeholder} />
                </Form.Item>
              );
            }

            if (field.type === 'phone') {
              return (
                <Form.Item
                  key={field.name}
                  name={field.name}
                  label={field.label}
                  rules={field.rules as never}
                >
                  <Input placeholder={field.placeholder} maxLength={10} />
                </Form.Item>
              );
            }

            return (
              <Form.Item
                key={field.name}
                name={field.name}
                label={field.label}
                rules={field.rules as never}
              >
                <Input placeholder={field.placeholder} />
              </Form.Item>
            );
          })}
        </Form>
      </Drawer>
    </div>
  );
}

export default GenericMasterManager;
