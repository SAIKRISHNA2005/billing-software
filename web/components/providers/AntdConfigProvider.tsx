'use client';

import React from 'react';
import { ConfigProvider, App, theme } from 'antd';

export default function AntdConfigProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          /* Primary Brand: Deep Maritime Navy */
          colorPrimary: '#17324D',
          colorPrimaryHover: '#24445D',
          colorPrimaryActive: '#0F2234',

          /* Semantic Status Colors */
          colorSuccess: '#3F6F4A',
          colorWarning: '#C58A2A',
          colorError: '#A8473C',
          colorInfo: '#365A73',

          /* Typography & Neutrals */
          colorTextBase: '#1E2933',
          colorTextSecondary: '#5F6B73',
          colorTextTertiary: '#89939A',
          colorBgBase: '#FFFFFF',
          colorBgLayout: '#F3F4F2',

          /* Borders & Geometry */
          colorBorder: '#D4DAD9',
          colorBorderSecondary: '#E5E9E8',
          borderRadius: 4,
          borderRadiusSM: 3,
          borderRadiusLG: 6,
          fontFamily:
            "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
          boxShadowTertiary: '0 1px 3px rgba(23, 42, 58, 0.05)',
        },
        components: {
          Layout: {
            siderBg: '#172A3A',
            headerBg: '#FFFFFF',
            bodyBg: '#F3F4F2',
          },
          Menu: {
            darkItemBg: '#172A3A',
            darkSubMenuItemBg: '#11202D',
            darkItemSelectedBg: '#24445D',
            darkItemColor: '#C2CCD4',
            darkItemSelectedColor: '#FFFFFF',
            darkItemHoverBg: '#1D354A',
            darkItemHoverColor: '#FFFFFF',
            itemBorderRadius: 4,
            itemMarginInline: 8,
          },
          Card: {
            headerFontSize: 15,
            headerHeight: 46,
            colorBorderSecondary: '#D4DAD9',
            boxShadowTertiary: '0 1px 3px rgba(23, 42, 58, 0.05)',
          },
          Table: {
            headerBg: '#E5E9E8',
            headerColor: '#34424C',
            rowHoverBg: '#EEF3F2',
            borderColor: '#D4DAD9',
            headerSplitColor: '#D4DAD9',
            headerBorderRadius: 4,
            fontSize: 12.5,
          },
          Button: {
            fontWeight: 500,
            borderRadius: 4,
            controlHeight: 34,
          },
          Input: {
            borderRadius: 4,
            activeBorderColor: '#17324D',
            hoverBorderColor: '#365A73',
          },
          InputNumber: {
            borderRadius: 4,
            activeBorderColor: '#17324D',
            hoverBorderColor: '#365A73',
          },
          Select: {
            borderRadius: 4,
            optionSelectedBg: '#EEF3F2',
          },
          DatePicker: {
            borderRadius: 4,
          },
          Tag: {
            borderRadius: 3,
          },
          Modal: {
            borderRadiusLG: 6,
          },
          Drawer: {
            borderRadiusLG: 6,
          },
          Steps: {
            colorPrimary: '#17324D',
          },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}

