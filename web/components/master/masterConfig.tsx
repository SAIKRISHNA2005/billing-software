import React from 'react';
import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FormFieldConfig, MasterRecord } from './GenericMasterManager';
import { AsyncMasterSelect } from '../common/AsyncMasterSelect';

// --- 1. Companies ---
export interface CompanyRecord extends MasterRecord {
  name: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  pan?: string;
}

export const companyColumns: ColumnsType<CompanyRecord> = [
  {
    title: 'Company Name',
    dataIndex: 'name',
    key: 'name',
    render: (name: string) => <strong>{name}</strong>,
  },
  { title: 'GSTIN', dataIndex: 'gstin', key: 'gstin', width: 160 },
  { title: 'PAN', dataIndex: 'pan', key: 'pan', width: 120 },
  { title: 'Contact Person', dataIndex: 'contactPerson', key: 'contactPerson' },
  { title: 'Phone', dataIndex: 'phone', key: 'phone', width: 130 },
  { title: 'Email', dataIndex: 'email', key: 'email' },
];

export const companyFields: FormFieldConfig[] = [
  {
    name: 'name',
    label: 'Company Name',
    required: true,
    rules: [{ required: true, message: 'Company name is required' }],
    placeholder: 'e.g. FIRST SOLAR TRANSPORT LTD',
  },
  {
    name: 'address',
    label: 'Address',
    type: 'textarea',
    placeholder: 'Office / Billing Address',
  },
  { name: 'contactPerson', label: 'Contact Person', placeholder: 'Primary Contact' },
  { name: 'phone', label: 'Phone / Mobile', placeholder: '+91 98400 12345' },
  { name: 'email', label: 'Email Address', placeholder: 'billing@company.com' },
  { name: 'gstin', label: 'GSTIN', placeholder: '15-digit GSTIN (e.g. 33AAAAA0000A1Z5)' },
  { name: 'pan', label: 'PAN', placeholder: '10-character PAN' },
];

// --- 2. Clients ---
export interface ClientRecord extends MasterRecord {
  name: string;
  companyId?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
}

export const clientColumns: ColumnsType<ClientRecord> = [
  {
    title: 'Client Name',
    dataIndex: 'name',
    key: 'name',
    render: (name: string) => <strong>{name}</strong>,
  },
  { title: 'Company ID', dataIndex: 'companyId', key: 'companyId', width: 120 },
  { title: 'GSTIN', dataIndex: 'gstin', key: 'gstin', width: 160 },
  { title: 'Contact Person', dataIndex: 'contactPerson', key: 'contactPerson' },
  { title: 'Phone', dataIndex: 'phone', key: 'phone', width: 130 },
  { title: 'Email', dataIndex: 'email', key: 'email' },
];

export const clientFields: FormFieldConfig[] = [
  {
    name: 'name',
    label: 'Client Name',
    required: true,
    rules: [{ required: true, message: 'Client name is required' }],
    placeholder: 'e.g. DHL Global Forwarding',
  },
  {
    name: 'companyId',
    label: 'Associated Company',
    renderCustom: () => (
      <AsyncMasterSelect
        entity="companies"
        entityLabel="Company"
        placeholder="Select Company"
      />
    ),
  },
  { name: 'contactPerson', label: 'Contact Person', placeholder: 'Manager / Lead' },
  { name: 'phone', label: 'Phone', placeholder: '+91 98401 23456' },
  { name: 'email', label: 'Email', placeholder: 'client@dhl.com' },
  {
    name: 'address',
    label: 'Address',
    type: 'textarea',
    placeholder: 'Delivery / Billing Address',
  },
  { name: 'gstin', label: 'GSTIN', placeholder: 'Client GSTIN' },
];

// --- 3. Vendors ---
export interface VendorRecord extends MasterRecord {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  pan?: string;
  bankDetails?: string;
}

export const vendorColumns: ColumnsType<VendorRecord> = [
  {
    title: 'Vendor Name',
    dataIndex: 'name',
    key: 'name',
    render: (name: string) => <strong>{name}</strong>,
  },
  { title: 'Contact Person', dataIndex: 'contactPerson', key: 'contactPerson' },
  { title: 'Phone', dataIndex: 'phone', key: 'phone', width: 130 },
  { title: 'Email', dataIndex: 'email', key: 'email' },
  { title: 'PAN', dataIndex: 'pan', key: 'pan', width: 120 },
  { title: 'Bank Details', dataIndex: 'bankDetails', key: 'bankDetails', ellipsis: true },
];

export const vendorFields: FormFieldConfig[] = [
  {
    name: 'name',
    label: 'Vendor Name',
    required: true,
    rules: [{ required: true, message: 'Vendor name is required' }],
    placeholder: 'e.g. SPT TRANSPORTS',
  },
  { name: 'contactPerson', label: 'Contact Person', placeholder: 'Primary Contact' },
  { name: 'phone', label: 'Phone / Mobile', placeholder: 'Contact Number' },
  { name: 'email', label: 'Email', placeholder: 'vendor@logistics.com' },
  { name: 'address', label: 'Office Address', type: 'textarea', placeholder: 'Address' },
  { name: 'pan', label: 'PAN', placeholder: '10-character PAN' },
  {
    name: 'bankDetails',
    label: 'Bank Details',
    type: 'textarea',
    placeholder: 'Bank Name, Account No, IFSC Code, Branch',
  },
];

// --- 4. Vehicles ---
export interface VehicleRecord extends MasterRecord {
  vehicleNumber: string;
  vehicleType: string;
  vendorId?: string;
}

export const vehicleColumns: ColumnsType<VehicleRecord> = [
  {
    title: 'Vehicle Number',
    dataIndex: 'vehicleNumber',
    key: 'vehicleNumber',
    render: (num: string) => <Tag color="blue" style={{ fontSize: 13, fontWeight: 'bold' }}>{num}</Tag>,
  },
  { title: 'Vehicle Type', dataIndex: 'vehicleType', key: 'vehicleType' },
  { title: 'Vendor ID', dataIndex: 'vendorId', key: 'vendorId', width: 140 },
];

export const vehicleFields: FormFieldConfig[] = [
  {
    name: 'vehicleNumber',
    label: 'Vehicle Number',
    type: 'uppercase',
    required: true,
    rules: [
      { required: true, message: 'Vehicle number is required' },
      {
        pattern: /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/i,
        message: 'Format like TN04AB1234 (uppercase alphanumeric)',
      },
    ],
    placeholder: 'e.g. TN04AB1234',
  },
  {
    name: 'vehicleType',
    label: 'Vehicle Type',
    required: true,
    rules: [{ required: true, message: 'Vehicle type is required' }],
    placeholder: 'e.g. 40ft Flatbed Trailer, 20ft Container Truck',
  },
  {
    name: 'vendorId',
    label: 'Associated Vendor (Optional)',
    renderCustom: () => (
      <AsyncMasterSelect
        entity="vendors"
        entityLabel="Vendor"
        placeholder="Select Vendor (if third-party vehicle)"
      />
    ),
  },
];

// --- 5. Drivers ---
export interface DriverRecord extends MasterRecord {
  name: string;
  phone: string;
  licenseNumber?: string;
}

export const driverColumns: ColumnsType<DriverRecord> = [
  {
    title: 'Driver Name',
    dataIndex: 'name',
    key: 'name',
    render: (name: string) => <strong>{name}</strong>,
  },
  {
    title: 'Mobile Number',
    dataIndex: 'phone',
    key: 'phone',
    width: 150,
    render: (phone: string) => <Tag color="geekblue">{phone}</Tag>,
  },
  { title: 'Driving License', dataIndex: 'licenseNumber', key: 'licenseNumber' },
];

export const driverFields: FormFieldConfig[] = [
  {
    name: 'name',
    label: 'Driver Full Name',
    required: true,
    rules: [{ required: true, message: 'Driver name is required' }],
    placeholder: 'Full Name',
  },
  {
    name: 'phone',
    label: 'Mobile Number (10 Digits)',
    type: 'phone',
    required: true,
    rules: [
      { required: true, message: 'Mobile number is required' },
      { pattern: /^[6-9]\d{9}$/, message: 'Must be a 10-digit number starting with 6-9' },
    ],
    placeholder: 'e.g. 9840012345',
  },
  {
    name: 'licenseNumber',
    label: 'Driving License Number',
    placeholder: 'e.g. TN0120150001234',
  },
];
