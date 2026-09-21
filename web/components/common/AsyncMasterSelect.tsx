'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Select, Spin, Button, Modal, Form, Input, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/api/client';

export interface LookupItem {
  id: string;
  label: string;
  [key: string]: unknown;
}

interface AsyncMasterSelectProps {
  entity: 'companies' | 'clients' | 'vendors' | 'vehicles' | 'drivers' | 'containers';
  entityLabel?: string;
  value?: string;
  onChange?: (value: string, item?: LookupItem) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  extraParams?: Record<string, string | undefined>;
  showAddNew?: boolean;
  style?: React.CSSProperties;
}

export const AsyncMasterSelect: React.FC<AsyncMasterSelectProps> = ({
  entity,
  entityLabel,
  value,
  onChange,
  placeholder,
  disabled = false,
  allowClear = true,
  extraParams,
  showAddNew = true,
  style,
}) => {
  const [options, setOptions] = useState<LookupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form] = Form.useForm();

  const label = entityLabel || entity.slice(0, -1);

  const fetchOptions = useCallback(
    async (searchTerm: string = '') => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          lookup: 'true',
          search: searchTerm,
          limit: '30',
        });

        if (extraParams) {
          Object.entries(extraParams).forEach(([k, v]) => {
            if (v) queryParams.set(k, v);
          });
        }

        const res = await apiClient.get<{ success: boolean; data: LookupItem[] }>(
          `/master/${entity}?${queryParams.toString()}`
        );

        if (res.data.success && Array.isArray(res.data.data)) {
          setOptions(res.data.data);
        }
      } catch (err: unknown) {
        console.error(`Failed to fetch ${entity} lookups:`, err);
      } finally {
        setLoading(false);
      }
    },
    [entity, extraParams]
  );

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const handleSearch = (val: string) => {
    setSearch(val);
    fetchOptions(val);
  };

  const handleSelect = (selectedId: string) => {
    const selectedItem = options.find((item) => item.id === selectedId);
    onChange?.(selectedId, selectedItem);
  };

  const handleQuickCreate = async () => {
    try {
      const values = await form.validateFields();
      setIsCreating(true);

      const res = await apiClient.post<{ success: boolean; data: { id: string; name?: string; vehicleNumber?: string } }>(
        `/master/${entity}`,
        values
      );

      if (res.data.success && res.data.data?.id) {
        message.success(`${label} created successfully!`);
        setIsModalOpen(false);
        form.resetFields();

        // Refresh options and automatically select newly created item
        await fetchOptions();
        const createdId = res.data.data.id;
        const createdLabel = res.data.data.name || res.data.data.vehicleNumber || createdId;
        const newItem: LookupItem = { id: createdId, label: createdLabel };
        onChange?.(createdId, newItem);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axErr = err as { response?: { data?: { message?: string } } };
        message.error(axErr.response?.data?.message || `Failed to create ${label}`);
      } else if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ display: 'inline-block', width: '100%', ...style }}>
      <Select
        showSearch
        value={value}
        placeholder={placeholder || `Select ${label}`}
        disabled={disabled}
        allowClear={allowClear}
        filterOption={false}
        onSearch={handleSearch}
        onChange={(val) => {
          if (!val) {
            onChange?.('');
          } else {
            handleSelect(val);
          }
        }}
        notFoundContent={loading ? <Spin size="small" /> : 'No results found'}
        style={{ width: '100%' }}
        dropdownRender={(menu) => (
          <>
            {menu}
            {showAddNew && entity !== 'containers' && (
              <div
                style={{
                  padding: '8px 12px',
                  borderTop: '1px solid #f0f0f0',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <Button
                  type="link"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsModalOpen(true);
                    if (search) {
                      form.setFieldsValue({
                        name: search,
                        vehicleNumber: search.toUpperCase(),
                      });
                    }
                  }}
                  style={{ padding: 0 }}
                >
                  + Add New {label}
                </Button>
              </div>
            )}
          </>
        )}
      >
        {options.map((item) => (
          <Select.Option key={item.id} value={item.id}>
            {item.label}
          </Select.Option>
        ))}
      </Select>

      {/* Quick Add Modal */}
      {showAddNew && entity !== 'containers' && (
        <Modal
          title={`Add New ${label}`}
          open={isModalOpen}
          onOk={handleQuickCreate}
          onCancel={() => {
            setIsModalOpen(false);
            form.resetFields();
          }}
          confirmLoading={isCreating}
          okText="Create"
          destroyOnClose
        >
          <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 16 }}>
            {entity === 'vehicles' ? (
              <>
                <Form.Item
                  name="vehicleNumber"
                  label="Vehicle Number"
                  rules={[
                    { required: true, message: 'Vehicle number is required' },
                    {
                      pattern: /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/i,
                      message: 'Format like TN04AB1234',
                    },
                  ]}
                  normalize={(val: string) => (val ? val.replace(/[\s-]/g, '').toUpperCase() : '')}
                >
                  <Input placeholder="e.g. TN04AB1234" />
                </Form.Item>
                <Form.Item
                  name="vehicleType"
                  label="Vehicle Type"
                  rules={[{ required: true, message: 'Vehicle type is required' }]}
                >
                  <Input placeholder="e.g. 40ft Flatbed Trailer, 20ft Container Truck" />
                </Form.Item>
              </>
            ) : entity === 'drivers' ? (
              <>
                <Form.Item
                  name="name"
                  label="Driver Name"
                  rules={[{ required: true, message: 'Driver name is required' }]}
                >
                  <Input placeholder="Full Name" />
                </Form.Item>
                <Form.Item
                  name="phone"
                  label="Mobile Number (10 digits)"
                  rules={[
                    { required: true, message: 'Mobile number is required' },
                    { pattern: /^[6-9]\d{9}$/, message: 'Must be a 10-digit number starting with 6-9' },
                  ]}
                >
                  <Input placeholder="e.g. 9840012345" maxLength={10} />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item
                  name="name"
                  label={`${label} Name`}
                  rules={[{ required: true, message: `${label} name is required` }]}
                >
                  <Input placeholder={`Enter ${label} Name`} />
                </Form.Item>
                <Form.Item name="phone" label="Phone / Mobile">
                  <Input placeholder="Contact phone number" />
                </Form.Item>
                <Form.Item name="email" label="Email Address">
                  <Input placeholder="Contact email" />
                </Form.Item>
              </>
            )}
          </Form>
        </Modal>
      )}
    </div>
  );
};

export default AsyncMasterSelect;
