import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { loadProjectConfig } from '@/lib/config.server';
import { ConfigProvider } from '@/providers/ConfigProvider';
import { PostHogProvider } from '@/providers/PostHogProvider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

// Load config server-side
const config = loadProjectConfig();
const theme = config.themeConfig;
const chainConfig = config.chainConfig;
const content = config.content;
const assets = config.assets;
const seo = content.seo;

// Build SEO metadata with config overrides
const seoTitle = seo?.title || content.siteName;
const seoDescription = seo?.description || content.siteDescription;
const seoKeywords = seo?.keywords || [chainConfig.name, chainConfig.ticker, 'nodes', 'network', 'blockchain', 'map', 'decentralized', 'p2p'];
const seoOgImage = seo?.ogImage || assets.ogImagePath;

export const metadata: Metadata = {
  title: {
    template: seo?.titleTemplate || `%s | ${content.siteName}`,
    default: seoTitle,
  },
  description: seoDescription,
  keywords: seoKeywords,
  metadataBase: new URL(content.siteUrl),
  robots: seo?.robots || 'index, follow',
  openGraph: {
    title: seoTitle,
    description: seoDescription,
    url: seo?.canonicalUrl || content.siteUrl,
    siteName: content.siteName,
    images: [
      {
        url: seoOgImage,
        width: 1200,
        height: 630,
        alt: `${content.siteName} - ${seoDescription}`,
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: seoTitle,
    description: seoDescription,
    images: [seoOgImage],
    creator: seo?.twitterHandle,
    site: seo?.twitterHandle,
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
        <PostHogProvider>
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
        </PostHogProvider>
      </body>
    </html>
  );
}
