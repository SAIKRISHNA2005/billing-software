'use client';

import React from 'react';
import { ConfigProvider, App, theme } from 'antd';

export default function AntdConfigProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          colorBgLayout: '#f5f7fa',
        },
        components: {
          Card: {
            headerFontSize: 16,
            boxShadowTertiary: '0 1px 3px rgba(0,0,0,0.05)',
          },
          Table: {
            headerBg: '#fafafa',
            headerColor: '#262626',
            rowHoverBg: '#f0f7ff',
          },
          Button: {
            fontWeight: 500,
          },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
