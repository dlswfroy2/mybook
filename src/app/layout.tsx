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

export const metadata: Metadata = {
  title: 'টপ গ্রেড টিউটোরিয়ালস',
  description: 'আধুনিক শিক্ষা সহায়ক প্ল্যাটফর্ম',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn">
      <head>
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
                <Toaster />
              </AcademicYearProvider>
            </SchoolInfoProvider>
          </AuthProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
