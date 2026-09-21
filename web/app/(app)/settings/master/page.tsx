'use client';

import React from 'react';
import { Tabs, Typography } from 'antd';
import {
  BankOutlined,
  UsergroupAddOutlined,
  TeamOutlined,
  CarOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { GenericMasterManager } from '@/components/master/GenericMasterManager';
import {
  CompanyRecord,
  companyColumns,
  companyFields,
  ClientRecord,
  clientColumns,
  clientFields,
  VendorRecord,
  vendorColumns,
  vendorFields,
  VehicleRecord,
  vehicleColumns,
  vehicleFields,
  DriverRecord,
  driverColumns,
  driverFields,
} from '@/components/master/masterConfig';

const { Title, Paragraph } = Typography;

export default function MasterDataPage() {
  const tabItems = [
    {
      key: 'companies',
      label: (
        <span>
          <BankOutlined /> Companies
        </span>
      ),
      children: (
        <GenericMasterManager<CompanyRecord>
          entity="companies"
          entitySingular="Company"
          columns={companyColumns}
          formFields={companyFields}
        />
      ),
    },
    {
      key: 'clients',
      label: (
        <span>
          <UsergroupAddOutlined /> Clients
        </span>
      ),
      children: (
        <GenericMasterManager<ClientRecord>
          entity="clients"
          entitySingular="Client"
          columns={clientColumns}
          formFields={clientFields}
        />
      ),
    },
    {
      key: 'vendors',
      label: (
        <span>
          <TeamOutlined /> Vendors
        </span>
      ),
      children: (
        <GenericMasterManager<VendorRecord>
          entity="vendors"
          entitySingular="Vendor"
          columns={vendorColumns}
          formFields={vendorFields}
        />
      ),
    },
    {
      key: 'vehicles',
      label: (
        <span>
          <CarOutlined /> Vehicles
        </span>
      ),
      children: (
        <GenericMasterManager<VehicleRecord>
          entity="vehicles"
          entitySingular="Vehicle"
          columns={vehicleColumns}
          formFields={vehicleFields}
          defaultSortField="vehicleNumber"
        />
      ),
    },
    {
      key: 'drivers',
      label: (
        <span>
          <IdcardOutlined /> Drivers
        </span>
      ),
      children: (
        <GenericMasterManager<DriverRecord>
          entity="drivers"
          entitySingular="Driver"
          columns={driverColumns}
          formFields={driverFields}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '4px' }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          Master Data Management
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Central repository for reusable operating entities: Companies, Clients, Vendors, Vehicles, and Drivers.
        </Paragraph>
      </div>

      <Tabs defaultActiveKey="companies" items={tabItems} size="large" />
    </div>
  );
}
