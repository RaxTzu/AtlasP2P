import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { loadProjectConfig } from '@/lib/config.server';
import { ConfigProvider } from '@/providers/ConfigProvider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

// Load config server-side
const config = loadProjectConfig();
const theme = config.themeConfig;
const chainConfig = config.chainConfig;
const content = config.content;
const assets = config.assets;

export const metadata: Metadata = {
  title: {
    template: `%s | ${content.siteName}`,
    default: content.siteName,
  },
  description: content.siteDescription,
  keywords: [chainConfig.name, chainConfig.ticker, 'nodes', 'network', 'blockchain', 'map'],
  metadataBase: new URL(content.siteUrl),
  openGraph: {
    title: content.siteName,
    description: content.siteDescription,
    url: content.siteUrl,
    siteName: content.siteName,
    images: [
      {
        url: assets.ogImagePath,
        width: 1200,
        height: 630,
        alt: `${content.siteName} - ${content.siteDescription}`,
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: content.siteName,
    description: content.siteDescription,
    images: [assets.ogImagePath],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href={theme.favicon} />
        <meta name="theme-color" content={theme.primaryColor} />
      </head>
      <body className="min-h-screen flex flex-col">
        <ConfigProvider config={config}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Header />
            <main className="flex-1 scrollbar-thin">{children}</main>
            <Footer />
          </ThemeProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
