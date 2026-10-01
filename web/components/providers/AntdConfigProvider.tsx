'use client';

import React from 'react';
import { ConfigProvider, App, theme } from 'antd';
import { ThemeProvider, useTheme } from './ThemeContext';

function InnerAntdConfigProvider({ children }: { children: React.ReactNode }) {
  const { themeMode } = useTheme();
  const isDark = themeMode === 'dark';

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? [theme.darkAlgorithm] : [theme.defaultAlgorithm],
        token: isDark
          ? {
              /* Dark Mode Theme Tokens - High Contrast Crisp White Text */
              colorPrimary: '#3B82F6',
              colorPrimaryHover: '#60A5FA',
              colorPrimaryActive: '#2563EB',

              colorSuccess: '#22C55E',
              colorWarning: '#F59E0B',
              colorError: '#EF4444',
              colorInfo: '#38BDF8',

              colorTextBase: '#FFFFFF',
              colorText: '#FFFFFF',
              colorTextHeading: '#FFFFFF',
              colorTextSecondary: '#E4E4E7',
              colorTextTertiary: '#A1A1AA',
              colorTextDescription: '#D4D4D8',
              colorBgBase: '#09090B',
              colorBgContainer: '#18181B',
              colorBgElevated: '#202024',
              colorBgLayout: '#09090B',

              colorBorder: '#2E2E33',
              colorBorderSecondary: '#27272A',
              borderRadius: 4,
              borderRadiusSM: 3,
              borderRadiusLG: 6,
              fontFamily:
                "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
              boxShadowTertiary: '0 2px 8px rgba(0, 0, 0, 0.6)',
            }
          : {
              /* Light Mode - High Contrast Deep Dark Text */
              colorPrimary: '#17324D',
              colorPrimaryHover: '#24445D',
              colorPrimaryActive: '#0F2234',

              colorSuccess: '#166534',
              colorWarning: '#B45309',
              colorError: '#B91C1C',
              colorInfo: '#0284C7',

              colorTextBase: '#090D14',
              colorText: '#090D14',
              colorTextHeading: '#000000',
              colorTextSecondary: '#1F2937',
              colorTextTertiary: '#374151',
              colorTextDescription: '#1F2937',
              colorBgBase: '#FFFFFF',
              colorBgContainer: '#FFFFFF',
              colorBgLayout: '#F1F5F9',

              colorBorder: '#CBD5E1',
              colorBorderSecondary: '#E2E8F0',
              borderRadius: 4,
              borderRadiusSM: 3,
              borderRadiusLG: 6,
              fontFamily:
                "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
              boxShadowTertiary: '0 1px 3px rgba(15, 23, 42, 0.08)',
            },
        components: {
          Layout: isDark
            ? {
                siderBg: '#121214',
                headerBg: '#18181B',
                bodyBg: '#09090B',
              }
            : {
                siderBg: '#172A3A',
                headerBg: '#FFFFFF',
                bodyBg: '#F1F5F9',
              },
          Menu: isDark
            ? {
                darkItemBg: '#121214',
                darkSubMenuItemBg: '#09090B',
                darkItemSelectedBg: '#2563EB',
                darkItemColor: '#D4D4D8',
                darkItemSelectedColor: '#FFFFFF',
                darkItemHoverBg: '#27272A',
                darkItemHoverColor: '#FFFFFF',
                itemBorderRadius: 4,
                itemMarginInline: 8,
              }
            : {
                darkItemBg: '#172A3A',
                darkSubMenuItemBg: '#11202D',
                darkItemSelectedBg: '#24445D',
                darkItemColor: '#E2E8F0',
                darkItemSelectedColor: '#FFFFFF',
                darkItemHoverBg: '#1D354A',
                darkItemHoverColor: '#FFFFFF',
                itemBorderRadius: 4,
                itemMarginInline: 8,
              },
          Card: isDark
            ? {
                headerFontSize: 15,
                headerHeight: 46,
                colorBgContainer: '#18181B',
                colorBorderSecondary: '#2E2E33',
              }
            : {
                headerFontSize: 15,
                headerHeight: 46,
                colorBorderSecondary: '#CBD5E1',
                boxShadowTertiary: '0 1px 3px rgba(15, 23, 42, 0.06)',
              },
          Table: isDark
            ? {
                headerBg: '#121214',
                headerColor: '#FFFFFF',
                colorText: '#FFFFFF',
                colorTextHeading: '#FFFFFF',
                colorTextDescription: '#A1A1AA',
                rowHoverBg: '#222226',
                borderColor: '#2E2E33',
                headerSplitColor: '#2E2E33',
                headerBorderRadius: 4,
                fontSize: 12.5,
              }
            : {
                headerBg: '#E2E8F0',
                headerColor: '#000000',
                colorText: '#090D14',
                colorTextHeading: '#000000',
                colorTextDescription: '#1F2937',
                rowHoverBg: '#F1F5F9',
                borderColor: '#CBD5E1',
                headerSplitColor: '#CBD5E1',
                headerBorderRadius: 4,
                fontSize: 12.5,
              },
          Typography: isDark
            ? {
                colorText: '#FFFFFF',
                colorTextHeading: '#FFFFFF',
                colorTextDescription: '#CBD5E1',
              }
            : {
                colorText: '#090D14',
                colorTextHeading: '#000000',
                colorTextDescription: '#1F2937',
              },
          Statistic: isDark
            ? {
                titleFontSize: 12,
                contentFontSize: 24,
              }
            : {
                titleFontSize: 12,
                contentFontSize: 24,
              },
          Button: {
            fontWeight: 500,
            borderRadius: 4,
            controlHeight: 34,
            defaultColor: isDark ? '#FFFFFF' : '#090D14',
            defaultBg: isDark ? '#222226' : '#FFFFFF',
            defaultBorderColor: isDark ? '#3F3F46' : '#CBD5E1',
          },
          Input: {
            borderRadius: 4,
            colorBgContainer: isDark ? '#121214' : '#FFFFFF',
            colorText: isDark ? '#FFFFFF' : '#090D14',
            colorBorder: isDark ? '#2E2E33' : '#CBD5E1',
          },
          InputNumber: {
            borderRadius: 4,
            colorBgContainer: isDark ? '#121214' : '#FFFFFF',
            colorText: isDark ? '#FFFFFF' : '#090D14',
            colorBorder: isDark ? '#2E2E33' : '#CBD5E1',
          },
          Select: {
            borderRadius: 4,
            colorBgContainer: isDark ? '#121214' : '#FFFFFF',
            colorBgElevated: isDark ? '#18181B' : '#FFFFFF',
            colorText: isDark ? '#FFFFFF' : '#090D14',
            colorBorder: isDark ? '#2E2E33' : '#CBD5E1',
            controlItemBgHover: isDark ? '#27272A' : '#F1F5F9',
          },
          DatePicker: {
            borderRadius: 4,
            colorBgContainer: isDark ? '#121214' : '#FFFFFF',
            colorBgElevated: isDark ? '#18181B' : '#FFFFFF',
            colorText: isDark ? '#FFFFFF' : '#090D14',
            colorBorder: isDark ? '#2E2E33' : '#CBD5E1',
          },
          Popover: {
            colorBgElevated: isDark ? '#18181B' : '#FFFFFF',
            colorText: isDark ? '#FFFFFF' : '#090D14',
            colorTextHeading: isDark ? '#FFFFFF' : '#090D14',
          },
          Dropdown: {
            colorBgElevated: isDark ? '#18181B' : '#FFFFFF',
            colorText: isDark ? '#FFFFFF' : '#090D14',
            controlItemBgHover: isDark ? '#27272A' : '#F1F5F9',
          },
          Tag: {
            borderRadius: 3,
          },
          Modal: {
            borderRadiusLG: 6,
            headerBg: isDark ? '#18181B' : '#FFFFFF',
            contentBg: isDark ? '#18181B' : '#FFFFFF',
            titleColor: isDark ? '#FFFFFF' : '#090D14',
          },
          Drawer: {
            borderRadiusLG: 6,
            colorBgElevated: isDark ? '#18181B' : '#FFFFFF',
            colorText: isDark ? '#FFFFFF' : '#090D14',
          },
          Alert: {
            colorText: isDark ? '#FFFFFF' : '#090D14',
          },
          Steps: {
            colorPrimary: isDark ? '#4A7594' : '#17324D',
          },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}

export default function AntdConfigProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <InnerAntdConfigProvider>{children}</InnerAntdConfigProvider>
    </ThemeProvider>
  );
}

