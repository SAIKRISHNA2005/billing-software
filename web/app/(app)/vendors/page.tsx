'use client';

import React from 'react';
import { Typography } from 'antd';
import { GenericMasterManager } from '@/components/master/GenericMasterManager';
import { vendorColumns, vendorFields, VendorRecord } from '@/components/master/masterConfig';

const { Title, Paragraph } = Typography;

export default function VendorListPage() {
  return (
    <div style={{ padding: '4px' }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          Vendor Directory
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Manage external fleet providers, transporters, bank accounts, and contact details.
        </Paragraph>
      </div>

      <GenericMasterManager<VendorRecord>
        entity="vendors"
        entitySingular="Vendor"
        columns={vendorColumns}
        formFields={vendorFields}
      />
    </div>
  );
}
