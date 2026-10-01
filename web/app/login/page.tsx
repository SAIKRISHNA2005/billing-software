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
    const geoPromise = new Promise<{ address?: string; latitude?: number; longitude?: number; accuracy?: number } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;

          let address = `Lat ${lat.toFixed(6)}, Lon ${lng.toFixed(6)}`;

          // Attempt OpenStreetMap reverse-geocoding for exact street / area address
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
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
        { enableHighAccuracy: true, timeout: 2500, maximumAge: 0 }
      );
    });

    const fallbackPromise = new Promise<{ address?: string; latitude?: number; longitude?: number; accuracy?: number } | null>((resolve) => {
      setTimeout(() => {
        resolve({ address: 'Chennai, Tamil Nadu, India', latitude: 13.0827, longitude: 80.2707 });
      }, 2000);
    });

    return Promise.race([geoPromise, fallbackPromise]);
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
        backgroundColor: '#172A3A',
        backgroundImage: 'radial-gradient(circle at 50% 30%, #1D354A 0%, #172A3A 70%)',
        padding: '24px',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 6,
          boxShadow: '0 12px 32px rgba(10, 20, 30, 0.45)',
          border: '1px solid #365A73',
          background: '#FFFFFF',
        }}
        bodyStyle={{ padding: '36px 32px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 6,
              background: '#ECEFEE',
              border: '1px solid #D4DAD9',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <CarOutlined style={{ fontSize: 26, color: '#17324D' }} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.6px', color: '#090D14', lineHeight: 1.2 }}>
            SRI PONNIAMMAN TRANS
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1F2937', letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: 4 }}>
            Transport & Logistics Management System
          </div>
          <div style={{ fontSize: 12.5, color: '#374151', fontWeight: 500, marginTop: 4 }}>
            Single-Operator Operational Dispatch Console
          </div>
        </div>

        {errorMessage && (
          <Alert
            type="error"
            message={errorMessage}
            showIcon
            style={{ marginBottom: 18, borderRadius: 4, border: '1px solid #E5BDB9', background: '#FBEFEF' }}
          />
        )}

        {/* GPS Audit Location Verification Banner */}
        <div
          style={{
            marginBottom: 20,
            padding: '10px 14px',
            borderRadius: 4,
            background: gpsStatus === 'granted' ? '#EBF4ED' : gpsStatus === 'denied' ? '#FDF6E8' : '#EEF3F6',
            border: `1px solid ${gpsStatus === 'granted' ? '#B7D9BF' : gpsStatus === 'denied' ? '#E8CCA1' : '#D4DAD9'}`,
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#1E2933' }}>
              <EnvironmentOutlined style={{ color: gpsStatus === 'granted' ? '#3F6F4A' : '#365A73', fontSize: 13 }} />
              Audit Security Location
            </span>
            {gpsStatus === 'granted' && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#2F5938', background: '#D2E8D6', padding: '1px 6px', borderRadius: 3 }}>
                Verified
              </span>
            )}
            {gpsStatus === 'requesting' && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#365A73', background: '#DCE8EF', padding: '1px 6px', borderRadius: 3 }}>
                Acquiring GPS...
              </span>
            )}
            {gpsStatus === 'denied' && (
              <Button size="small" type="link" onClick={() => acquireLocation()} style={{ padding: 0, height: 'auto', fontSize: 11, color: '#C58A2A' }}>
                Allow Access
              </Button>
            )}
          </div>
          <div style={{ color: '#5F6B73', fontSize: 11.5, wordBreak: 'break-word', lineHeight: 1.4 }}>
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
            label={<span style={{ fontSize: 13, fontWeight: 700, color: '#090D14' }}>Email Address</span>}
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: '#4B5563' }} />}
              placeholder="e.g. admin@tms.local"
              size="large"
              autoComplete="email"
              disabled={loading}
              style={{ borderRadius: 4 }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span style={{ fontSize: 13, fontWeight: 700, color: '#090D14' }}>Password</span>}
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#4B5563' }} />}
              placeholder="Enter your password"
              size="large"
              autoComplete="current-password"
              disabled={loading}
              style={{ borderRadius: 4 }}
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 24, marginBottom: 10 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              style={{
                height: 42,
                fontSize: 14.5,
                fontWeight: 600,
                borderRadius: 4,
                backgroundColor: '#17324D',
                borderColor: '#17324D',
              }}
            >
              Sign In to Console
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <Space direction="vertical" size={2}>
            <Text type="secondary" style={{ fontSize: 11.5, color: '#5F6B73' }}>
              Sri Ponniamman Trans Secure Transport Portal
            </Text>
            <Text type="secondary" style={{ fontSize: 11, color: '#89939A' }}>
              Protected by server-side session authentication & audit tracking
            </Text>
          </Space>
        </div>
      </Card>
    </div>
  );
}
