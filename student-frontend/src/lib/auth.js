'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe, logout as apiLogout, getToken, removeToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const data = await getMe();
      setUser(data.user);
    } catch (error) {
      if (error.status === 401) {
        setUser(null);
        removeToken();
      }
      // If it's a 500 or network error, we don't log them out, just leave user as is.
      // Wait, if it's the first load and user is null, they will stay null... 
      // But we shouldn't wipe a valid token.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = (userData) => {
    setUser(userData);
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
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
