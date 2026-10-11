'use client';

import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Button, Card, Row, Col, Table, DatePicker, Typography, Tag, Modal, Space, message, Divider } from 'antd';
import { FileAddOutlined, SaveOutlined, CheckOutlined, PlusOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import dayjs from 'dayjs';
import { formatCurrencyINR } from '@/lib/utils/format';
import { ActionConfirmPopover } from '@/components/common/ActionConfirmPopover';

const { Title, Text, Paragraph } = Typography;

export default function CreateBillPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form] = Form.useForm();

  const enquiryIdsStr = searchParams.get('enquiryIds') || '';
  const companyIdParam = searchParams.get('companyId') || '';
  const clientIdParam = searchParams.get('clientId') || '';
  const draftIdParam = searchParams.get('draftId') || '';

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nextNumberPreview, setNextNumberPreview] = useState('Will be assigned on Process');
  const [companyName, setCompanyName] = useState('');
  const [clientName, setClientName] = useState('');

  const [items, setItems] = useState<Array<{ id: string; description: string; amount: number; enquiryId?: string }>>([]);

  const fetchBillPreviewAndDetails = async () => {
    setLoading(true);
    try {
      // 1. Fetch preview number
      const prevRes = await axios.get('/api/billing/preview-number');
      if (prevRes.data && prevRes.data.success) {
        setNextNumberPreview(prevRes.data.data.nextBillNumber);
      }

      // If opening an existing draft
      if (draftIdParam) {
        const res = await axios.get(`/api/billing/bills/${draftIdParam}`);
        if (res.data && res.data.success) {
          const bill = res.data.data;
          setCompanyName(bill.companyName);
          setClientName(bill.clientName);
          form.setFieldsValue({
            billingDate: bill.billingDate ? dayjs(bill.billingDate, 'YYYY-MM-DD') : dayjs(),
            remarks: bill.remarks
          });
          setItems(bill.items || []);
        }
      } else if (enquiryIdsStr) {
        // Fetch full enquiry details for each selected ID to guarantee all charges and advances are loaded
        const ids = enquiryIdsStr.split(',').filter(Boolean);
        const fullEnquiries: any[] = [];

        // 1. Fetch each enquiry via /api/enquiries/${id} to ensure 100% full detail (advanceAmount, extraAdvance, otherCharges, customCharges)
        for (const id of ids) {
          try {
            const enqRes = await axios.get(`/api/enquiries/${id}`);
            if (enqRes.data && enqRes.data.success && enqRes.data.data) {
              const d = enqRes.data.data;
              const e = d.enquiry || d;
              fullEnquiries.push({
                ...e,
                enquiryId: e.id || id,
                enquiryNumber: e.enquiryNumber || id,
                companyId: e.companyId || d.company?.id,
                companyName: d.company?.name || e.companyName || companyIdParam,
                clientId: e.clientId || d.client?.id,
                clientName: d.client?.name || e.clientName || clientIdParam,
                vehicleNo: d.vehicle?.vehicleNumber || e.vehicleNumber || e.vehicleNo || '',
                containerNo: d.container?.containerNumber || e.containerNumber || e.containerNo || '',
                freightAmount: Number(e.freightAmount) || 0,
                haltingAmount: Number(e.haltingAmount) || 0,
                haltingDays: Number(e.haltingDays) || 0,
                otherCharges: Number(e.otherCharges) || 0,
                advanceAmount: Number(e.advanceAmount) || 0,
                extraAdvance: Number(e.extraAdvance) || 0,
                dieselAmount: Number(e.dieselAmount) || 0,
                bonus: Number(e.bonus) || 0,
                customCharges: e.customCharges || [],
              });
            }
          } catch (eErr) {
            console.warn(`Could not load enquiry ${id} directly:`, eErr);
          }
        }

        // 2. If any enquiry was not loaded directly, fallback to /api/billing/pending
        if (fullEnquiries.length < ids.length) {
          try {
            const pendRes = await axios.get('/api/billing/pending');
            if (pendRes.data && pendRes.data.success) {
              const pendingItems = pendRes.data.data.items || [];
              const loadedIds = new Set(fullEnquiries.map((fe) => fe.enquiryId || fe.id));
              const missing = pendingItems.filter((it: any) => ids.includes(it.enquiryId) && !loadedIds.has(it.enquiryId));
              fullEnquiries.push(...missing);
            }
          } catch {}
        }

        if (fullEnquiries.length > 0) {
          setCompanyName(fullEnquiries[0].companyName || companyIdParam);
          setClientName(fullEnquiries[0].clientName || clientIdParam);
        }

        const defaultItems: any[] = [];
        fullEnquiries.forEach((e: any, index: number) => {
          const enqLabel = e.enquiryNumber || e.enquiryId || e.id;
          const vehDesc = e.vehicleNo ? ` (Veh: ${e.vehicleNo})` : '';

          // 1. Base Freight / Transportation Charges
          if (Number(e.freightAmount) > 0) {
            defaultItems.push({
              id: 'item-' + index + '-f',
              description: `Transportation Charges - Enquiry #${enqLabel}${vehDesc}`,
              amount: Number(e.freightAmount),
              enquiryId: e.enquiryId || e.id
            });
          }

          // 2. Halting Charges (with days)
          if (Number(e.haltingAmount) > 0) {
            const hDays = Number(e.haltingDays) || 0;
            const haltingDesc = hDays > 0
              ? `Halting Charges (${hDays} Day${hDays > 1 ? 's' : ''}) - Enquiry #${enqLabel}`
              : `Halting Charges - Enquiry #${enqLabel}`;
            defaultItems.push({
              id: 'item-' + index + '-h',
              description: haltingDesc,
              amount: Number(e.haltingAmount),
              enquiryId: e.enquiryId || e.id
            });
          }

          // 3. Other Charges
          if (Number(e.otherCharges) > 0) {
            defaultItems.push({
              id: 'item-' + index + '-o',
              description: `Other Charges - Enquiry #${enqLabel}`,
              amount: Number(e.otherCharges),
              enquiryId: e.enquiryId || e.id
            });
          }

          // 4. Dynamic Custom Charges
          let customList: any[] = [];
          if (Array.isArray(e.customCharges)) {
            customList = e.customCharges;
          } else if (typeof e.customCharges === 'string' && e.customCharges.trim().startsWith('[')) {
            try { customList = JSON.parse(e.customCharges); } catch {}
          }
          customList.forEach((cc: any, ccIdx: number) => {
            const ccAmt = Number(cc.amount || cc.chargeAmount) || 0;
            if (ccAmt > 0) {
              defaultItems.push({
                id: 'item-' + index + '-c-' + ccIdx,
                description: `${cc.name || 'Custom Charge'} - Enquiry #${enqLabel}`,
                amount: ccAmt,
                enquiryId: e.enquiryId || e.id
              });
            }
          });

          // 5. Advance Cash Deduction
          const advAmt = Number(e.advanceAmount) || 0;
          if (advAmt > 0) {
            defaultItems.push({
              id: 'item-' + index + '-adv',
              description: `Less: Advance Amount Paid - Enquiry #${enqLabel}`,
              amount: -advAmt,
              enquiryId: e.enquiryId || e.id
            });
          }

          // 6. Extra Advance Deduction
          const extraAdv = Number(e.extraAdvance) || 0;
          if (extraAdv > 0) {
            defaultItems.push({
              id: 'item-' + index + '-extra-adv',
              description: `Less: Extra Advance Paid - Enquiry #${enqLabel}`,
              amount: -extraAdv,
              enquiryId: e.enquiryId || e.id
            });
          }
        });

        if (defaultItems.length === 0) {
          defaultItems.push({
            id: 'item-0',
            description: 'Transportation Charges',
            amount: 0
          });
        }

        setItems(defaultItems);
        form.setFieldsValue({ billingDate: dayjs() });
      }
    } catch (err: any) {
      message.error('Failed to load bill setup data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillPreviewAndDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: 'item-' + Date.now(), description: 'Additional Services / Charges', amount: 0 }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((it) => it.id !== id));
  };

  const handleItemChange = (id: string, field: string, value: any) => {
    setItems(
      items.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const totalAmount = items.reduce((sum, it) => sum + (parseFloat(it.amount as any) || 0), 0);

  const handleSaveDraft = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      const payload = {
        companyId: companyIdParam,
        clientId: clientIdParam,
        enquiryIds: enquiryIdsStr ? enquiryIdsStr.split(',') : [],
        billingDate: values.billingDate.format('YYYY-MM-DD'),
        remarks: values.remarks,
        items
      };

      const res = await axios.post('/api/billing/bills', payload);
      if (res.data && res.data.success) {
        message.success('Draft bill saved successfully!');
        router.push('/billing/pending');
      } else {
        message.error(res.data?.message || 'Failed to save draft bill');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Validation error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessBill = async () => {
    Modal.confirm({
      title: 'Process Bill Confirmation',
      content: `Are you sure you want to process this bill for ${formatCurrencyINR(totalAmount)}? An official Bill Number will be permanently assigned and cannot be deleted.`,
      okText: 'Process & Generate Bill Number',
      okType: 'primary',
      onOk: async () => {
        setSubmitting(true);
        try {
          const values = await form.validateFields();
          // First create draft or ensure bill exists
          let billId = draftIdParam;
          if (!billId) {
            const createRes = await axios.post('/api/billing/bills', {
              companyId: companyIdParam,
              clientId: clientIdParam,
              enquiryIds: enquiryIdsStr ? enquiryIdsStr.split(',') : [],
              billingDate: values.billingDate.format('YYYY-MM-DD'),
              remarks: values.remarks,
              items
            });
            if (!createRes.data || !createRes.data.success) {
              throw new Error(createRes.data?.message || 'Failed to create bill draft prior to processing.');
            }
            billId = createRes.data.data.id;
          }

          // Process the bill
          const procRes = await axios.post(`/api/billing/bills/${billId}/process`, {
            billingDate: values.billingDate.format('YYYY-MM-DD'),
            remarks: values.remarks,
            items
          });

          if (procRes.data && procRes.data.success) {
            message.success(`Bill Processed! Assigned Bill Number: ${procRes.data.data.billNumber}`);
            router.push('/billing/processed');
          } else {
            message.error(procRes.data?.message || 'Failed to process bill');
          }
        } catch (err: any) {
          message.error(err.message || 'Error processing bill');
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const columns = [
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string, record: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Input
            value={text}
            onChange={(e) => handleItemChange(record.id, 'description', e.target.value)}
            placeholder="Item description"
            style={{ flex: 1 }}
          />
          {Number(record.amount) < 0 && (
            <Tag color="error" style={{ fontWeight: 600, flexShrink: 0 }}>Deduction</Tag>
          )}
        </div>
      )
    },
    {
      title: 'Amount (₹)',
      dataIndex: 'amount',
      key: 'amount',
      width: 220,
      render: (val: number, record: any) => (
        <InputNumber
          style={{
            width: '100%',
            color: Number(val) < 0 ? '#DC2626' : undefined,
            fontWeight: Number(val) < 0 ? 700 : undefined
          }}
          value={val}
          onChange={(v) => handleItemChange(record.id, 'amount', v || 0)}
        />
      )
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      render: (_: any, record: any) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveItem(record.id)}
        />
      )
    }
  ];

  return (
    <div style={{ padding: '4px 0 24px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            Back
          </Button>
          <Title level={2} style={{ margin: 0, color: '#1E2933', fontSize: 22, fontWeight: 600 }}>
            <FileAddOutlined style={{ marginRight: 8, color: '#17324D' }} />
            Create Bill Invoice
          </Title>
        </Space>
        <Tag style={{ fontSize: 12.5, padding: '3px 10px', color: '#9E6B1D', background: '#FDF6E8', border: '1px solid #E8CCA1', fontWeight: 600 }}>
          Next Bill No: {nextNumberPreview}
        </Tag>
      </div>

      <Form form={form} layout="vertical" disabled={loading || submitting}>
        <Card title="Invoice Header Information" style={{ borderRadius: 4, marginBottom: 20 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Company">
                <Input value={companyName || companyIdParam} disabled style={{ fontWeight: 600, color: '#1E2933' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Client Party">
                <Input value={clientName || clientIdParam} disabled style={{ fontWeight: 600, color: '#1E2933' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="billingDate"
                label="Billing Date"
                rules={[{ required: true, message: 'Please select billing date' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="remarks" label="Invoice Remarks / Payment Terms">
                <Input placeholder="e.g. Payment due within 15 days of invoice date" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card
          title="Itemized Invoice Charges"
          style={{ borderRadius: 4, marginBottom: 20 }}
          extra={
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddItem} style={{ borderColor: '#B9C3C4', color: '#17324D' }}>
              Add Line Item
            </Button>
          }
        >
          <Table
            columns={columns}
            dataSource={items}
            rowKey="id"
            pagination={false}
            footer={() => {
              const gross = items.filter(it => (Number(it.amount) || 0) > 0).reduce((s, it) => s + (Number(it.amount) || 0), 0);
              const advDed = items.filter(it => (Number(it.amount) || 0) < 0).reduce((s, it) => s + Math.abs(Number(it.amount) || 0), 0);
              const netTot = gross - advDed;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>Gross Charges Subtotal:</Text>
                    <Text strong style={{ fontSize: 14 }}>{formatCurrencyINR(gross)}</Text>
                  </div>
                  {advDed > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>Less: Advance Deductions:</Text>
                      <Text style={{ fontSize: 14, color: '#DC2626', fontWeight: 700 }}>- {formatCurrencyINR(advDed)}</Text>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: 8 }}>
                    <Text strong style={{ fontSize: 15, color: '#1E2933' }}>Total Invoice Amount (Gross - Advance):</Text>
                    <Title level={3} style={{ margin: 0, color: '#16A34A', fontWeight: 800 }}>
                      {formatCurrencyINR(netTot)}
                    </Title>
                  </div>
                </div>
              );
            }}
          />
        </Card>

        <Card style={{ borderRadius: 8, textAlign: 'right' }}>
          <Space size="middle">
            <Button size="large" onClick={() => router.push('/billing/pending')}>
              Cancel
            </Button>
            <ActionConfirmPopover
              title="Save Bill Draft?"
              description="Save current invoice selections and charges as a draft to edit or process later."
              okText="Yes, Save Draft"
              cancelText="No, Cancel"
              onConfirm={handleSaveDraft}
              loading={submitting}
              placement="top"
            >
              <Button
                size="large"
                icon={<SaveOutlined />}
                loading={submitting}
              >
                Save Draft
              </Button>
            </ActionConfirmPopover>

            <ActionConfirmPopover
              title="Process & Issue Official Bill?"
              description="Are you sure you want to process and allocate the next sequential bill number? This creates the permanent invoice and live synchronized report."
              okText="Yes, Process Bill"
              cancelText="No, Review"
              onConfirm={handleProcessBill}
              loading={submitting}
              placement="topRight"
            >
              <Button
                type="primary"
                size="large"
                icon={<CheckOutlined />}
                loading={submitting}
              >
                Process & Allocate Bill Number
              </Button>
            </ActionConfirmPopover>
          </Space>
        </Card>
      </Form>
    </div>
  );
}
