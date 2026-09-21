'use client';

import React from 'react';
import { Result, Button, Card, Tag, Typography } from 'antd';
import { CompassOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { Paragraph } = Typography;

interface ComingSoonProps {
  title: string;
  phase: number;
  phaseName: string;
  description: string;
}

export default function ComingSoon({ title, phase, phaseName, description }: ComingSoonProps) {
  return (
    <Card style={{ borderRadius: 8, minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Result
        icon={<CompassOutlined style={{ color: '#1677ff', fontSize: 64 }} />}
        title={title}
        subTitle={
          <div style={{ maxWidth: 500, margin: '16px auto 0' }}>
            <Tag color="processing" style={{ marginBottom: 12, padding: '4px 10px', fontSize: 13 }}>
              Coming in Phase {phase}: {phaseName}
            </Tag>
            <Paragraph type="secondary" style={{ fontSize: 15 }}>
              {description}
            </Paragraph>
          </div>
        }
        extra={
          <Link href="/dashboard">
            <Button type="primary" size="large">
              Return to Dashboard
            </Button>
          </Link>
        }
      />
    </Card>
  );
}
