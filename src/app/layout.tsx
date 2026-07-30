import type { Metadata } from "next";
import "react-datepicker/dist/react-datepicker.css";
import "./globals.css";
import { GlobalSecurity } from './components/GlobalSecurity';
import { ToastProvider } from "./context/ToastContext";
import { UserProvider } from "./context/UserContext";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "EDMS Media",
  description: "Browse documents and analyze images from the EDMS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('theme') === 'dark') {
                  document.documentElement.classList.add('dark');
                } else if (localStorage.getItem('theme') === 'light') {
                  document.documentElement.classList.remove('dark');
                }
                
                const savedLang = localStorage.getItem('lang');
                if (savedLang) {
                    document.documentElement.lang = savedLang;
                }
                document.documentElement.dir = 'ltr';
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="font-sans">
        <GlobalSecurity />
        <ToastProvider>
          <Providers>
            <UserProvider>
              {children}
            </UserProvider>
          </Providers>
        </ToastProvider>
      </body>
    </html>
  );
}