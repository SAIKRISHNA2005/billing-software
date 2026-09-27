'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Form, Input, Button, Typography, Alert, Space } from 'antd';
import { MailOutlined, LockOutlined, CarOutlined, EnvironmentOutlined, CheckCircleOutlined, CompassOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth/AuthContext';

const { Title, Text } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { user, login, isAuthenticated } = useAuth();
  const [form] = Form.useForm<LoginFormValues>();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [gpsStatus, setGpsStatus] = useState<'prompt' | 'requesting' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [gpsData, setGpsData] = useState<{
    address?: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  } | null>(null);

  const acquireLocation = useCallback(async (): Promise<{ address?: string; latitude?: number; longitude?: number; accuracy?: number } | null> => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsStatus('unsupported');
      return null;
    }

    setGpsStatus('requesting');
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;

          let address = `Lat ${lat.toFixed(6)}, Lon ${lng.toFixed(6)}`;

          // Attempt OpenStreetMap reverse-geocoding for exact street / area address
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
              { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            if (res.ok) {
              const data = await res.json();
              if (data && data.display_name) {
                const parts = [];
                const addr = data.address || {};
                if (addr.road || addr.pedestrian) parts.push(addr.road || addr.pedestrian);
                if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
                if (addr.city || addr.town || addr.municipality) parts.push(addr.city || addr.town || addr.municipality);
                if (addr.postcode) parts.push(addr.postcode);
                if (addr.state) parts.push(addr.state);
                address = parts.length > 0 ? parts.join(', ') : data.display_name;
              }
            }
          } catch {
            // Keep coordinates if reverse geocoding is rate-limited or fails
          }

          const resolved = { address, latitude: lat, longitude: lng, accuracy };
          setGpsData(resolved);
          setGpsStatus('granted');
          resolve(resolved);
        },
        (error) => {
          console.warn('[Geolocation] Permission denied or failed:', error.message);
          setGpsStatus('denied');
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }, []);

  useEffect(() => {
    acquireLocation();
  }, [acquireLocation]);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      let loc = gpsData;
      if (!loc && gpsStatus !== 'denied') {
        loc = await acquireLocation();
      }

      await login(values.email, values.password, {
        location: loc?.address,
        latitude: loc?.latitude,
        longitude: loc?.longitude,
        accuracy: loc?.accuracy,
      });
      router.replace('/dashboard');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axErr = err as { response?: { data?: { message?: string } } };
        setErrorMessage(axErr.response?.data?.message || 'Login failed. Please verify your credentials.');
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0b192c 0%, #1e3e62 50%, #000000 100%)',
        padding: '24px',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        bodyStyle={{ padding: '36px 32px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: '#e6f4ff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <CarOutlined style={{ fontSize: 28, color: '#1677ff' }} />
          </div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
            TMS Portal
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Transport & Logistics Management System
          </Text>
        </div>

        {errorMessage && (
          <Alert
            type="error"
            message={errorMessage}
            showIcon
            style={{ marginBottom: 20, borderRadius: 6 }}
          />
        )}

        {/* GPS Audit Location Verification Banner */}
        <div
          style={{
            marginBottom: 20,
            padding: '10px 14px',
            borderRadius: 8,
            background: gpsStatus === 'granted' ? '#f6ffed' : gpsStatus === 'denied' ? '#fffbe6' : '#f0f5ff',
            border: `1px solid ${gpsStatus === 'granted' ? '#b7eb8f' : gpsStatus === 'denied' ? '#ffe58f' : '#adc6ff'}`,
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#1f1f1f' }}>
              <EnvironmentOutlined style={{ color: gpsStatus === 'granted' ? '#52c41a' : '#1677ff', fontSize: 14 }} />
              Audit Security Location
            </span>
            {gpsStatus === 'granted' && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#389e0d', background: '#d9f7be', padding: '1px 7px', borderRadius: 10 }}>
                Verified
              </span>
            )}
            {gpsStatus === 'requesting' && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#1677ff', background: '#bae0ff', padding: '1px 7px', borderRadius: 10 }}>
                Acquiring GPS...
              </span>
            )}
            {gpsStatus === 'denied' && (
              <Button size="small" type="link" onClick={() => acquireLocation()} style={{ padding: 0, height: 'auto', fontSize: 11 }}>
                Allow Access
              </Button>
            )}
          </div>
          <div style={{ color: '#595959', fontSize: 11.5, wordBreak: 'break-word', lineHeight: 1.4 }}>
            {gpsStatus === 'granted' && gpsData?.address ? (
              <span>
                📍 {gpsData.address} <Text type="secondary" style={{ fontSize: 10.5 }}>(Accuracy: ±{Math.round(gpsData.accuracy || 0)}m)</Text>
              </span>
            ) : gpsStatus === 'requesting' ? (
              <span>Acquiring exact GPS satellite coordinates for audit verification...</span>
            ) : gpsStatus === 'denied' ? (
              <span>GPS permission not granted. Please allow location access in your browser to record exact audit coordinates.</span>
            ) : (
              <span>Requesting browser location permission...</span>
            )}
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
          initialValues={{ email: '', password: '' }}
        >
          <Form.Item
            name="email"
            label="Email Address"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="e.g. admin@tms.local"
              size="large"
              autoComplete="email"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Enter your password"
              size="large"
              autoComplete="current-password"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 28, marginBottom: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              style={{ height: 44, fontSize: 16, fontWeight: 600 }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Space direction="vertical" size={4}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Single-Operator Secure Access
            </Text>
            <Text type="secondary" style={{ fontSize: 11, color: '#8c8c8c' }}>
              Protected by server-side session authentication
            </Text>
          </Space>
        </div>
      </Card>
    </div>
  );
}
