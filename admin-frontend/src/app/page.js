'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/auth';

export default function AdminHome() {
  const { admin, loading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.push(admin ? '/dashboard' : '/login');
    }
  }, [admin, loading, router]);

  return (
    <div className="loading-container">
      <div className="spinner" />
    </div>
  );
}
