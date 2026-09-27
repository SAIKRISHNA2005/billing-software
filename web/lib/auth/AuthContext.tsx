'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api/client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface LocationData {
  location?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, locationData?: LocationData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await apiClient.get<{ success: boolean; data: { user: AuthUser } }>('/auth/me');
      if (response.data.success && response.data.data?.user) {
        setUser(response.data.data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email: string, password: string, locationData?: LocationData) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post<{ success: boolean; data: { user: AuthUser } }>('/auth/login', {
        email,
        password,
        location: locationData?.location,
        latitude: locationData?.latitude,
        longitude: locationData?.longitude,
        accuracy: locationData?.accuracy,
      });

      if (response.data.success && response.data.data?.user) {
        setUser(response.data.data.user);
      } else {
        throw new Error(response.data ? (response.data as unknown as { message: string }).message : 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Continue cleanup on failure
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
