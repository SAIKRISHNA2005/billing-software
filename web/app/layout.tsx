import React from 'react';
import type { Metadata } from 'next';
import StyledComponentsRegistry from '@/lib/antd/AntdRegistry';
import AntdConfigProvider from '@/components/providers/AntdConfigProvider';
import QueryProvider from '@/components/providers/QueryProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Transport & Logistics Management System (TMS)',
  description: 'Enterprise Transport & Logistics Management System powered by Next.js and Google Sheets',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StyledComponentsRegistry>
          <AntdConfigProvider>
            <QueryProvider>{children}</QueryProvider>
          </AntdConfigProvider>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
