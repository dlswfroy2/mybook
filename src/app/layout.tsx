import type {Metadata} from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Footer } from '@/components/layout/Footer';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthProvider } from '@/context/AuthContext';
import { SchoolInfoProvider } from '@/context/SchoolInfoContext';
import { AcademicYearProvider } from '@/context/AcademicYearContext';
import { GlobalAiAssistant } from '@/components/GlobalAiAssistant';
import { GlobalCommandPalette } from '@/components/GlobalCommandPalette';

export const metadata: Metadata = {
  title: 'টপ গ্রেড টিউটোরিয়ালস',
  description: 'আধুনিক শিক্ষা সহায়ক প্ল্যাটফর্ম',
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/favicon.ico' }
    ],
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn">
      <head>
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="shortcut icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4338ca" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="টপ গ্রেড" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link href="https://fonts.maateen.me/kalpurush/font.css" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col bg-background">
        <FirebaseClientProvider>
          <AuthProvider>
            <SchoolInfoProvider>
              <AcademicYearProvider>
                <Navbar />
                <main className="flex-1 pt-20 pb-6 container mx-auto px-4">
                  {children}
                </main>
                <Footer />
                <BottomNav />
                <GlobalAiAssistant />
                <GlobalCommandPalette />
                <Toaster />
              </AcademicYearProvider>
            </SchoolInfoProvider>
          </AuthProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
