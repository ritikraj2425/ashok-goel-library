import './globals.css';
import { AdminAuthProvider } from '@/lib/auth';

export const metadata = {
  title: 'Ashok Goel Library - Admin Portal',
  description: 'Admin portal for managing cabin bookings at Ashok Goel Library',
  icons: {
    icon: '/favicon.ico?v=2',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
