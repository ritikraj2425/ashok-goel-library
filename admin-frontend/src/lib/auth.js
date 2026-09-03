'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAdminMe, adminLogout as apiLogout, getToken } from './api';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) {
        setAdmin(null);
        setLoading(false);
        return;
      }
      const data = await getAdminMe();
      setAdmin(data.admin);
    } catch (error) {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = (adminData) => {
    setAdmin(adminData);
  };

  const logout = async () => {
    await apiLogout();
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, loading, login, logout, checkAuth }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
