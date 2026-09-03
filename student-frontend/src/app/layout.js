import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata = {
  title: 'Ashok Goel Library - Cabin Booking Portal',
  description: 'Book study cabins at Ashok Goel Library, Rishihood University',
  icons: {
    icon: '/favicon.ico?v=2',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
