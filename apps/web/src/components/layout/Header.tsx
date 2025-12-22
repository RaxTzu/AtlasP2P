'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Sun, Moon, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getThemeConfig, getNavigationItems, getAssetPaths, getChainConfig } from '@/config';
import { getNavigationIcon } from '@/lib/iconMap';
import { AuthButton } from './AuthButton';
import { getAccentColor } from '@/lib/theme-utils';

export function Header() {
  const theme = getThemeConfig();
  const navigation = getNavigationItems();
  const assets = getAssetPaths();
  const chain = getChainConfig();
  const pathname = usePathname();
  const { theme: currentTheme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile menu when pathname changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-[70] w-full border-b border-border bg-card/95 backdrop-blur-xl shadow-sm">
      <nav className="w-full flex h-16 items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <div className="relative h-10 w-10 sm:h-12 sm:w-12 transition-transform group-hover:scale-110">
            <img
              src={assets.logoPath}
              alt={`${chain.name} Logo`}
              className="h-full w-full object-contain drop-shadow-lg"
              style={{
                filter: `drop-shadow(0 4px 14px ${theme.primaryColor}50)`
              }}
            />
          </div>
          <span className="font-bold text-lg hidden sm:block text-foreground tracking-tight">
            {theme.name}
          </span>
        </Link>

        {/* Desktop Navigation - hidden on mobile/tablet, visible on lg+ */}
        <div className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          {navigation.map((item) => {
            const Icon = getNavigationIcon(item.icon);
            const LinkComponent = item.external ? 'a' : Link;
            const active = !item.external && isActive(item.href);
            const linkProps = item.external
              ? {
                  href: item.href,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                }
              : { href: item.href };

            return (
              <LinkComponent
                key={item.name}
                {...linkProps}
                className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-md group ${
                  active
                    ? 'text-foreground bg-muted/60'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
                {active && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                    style={{ backgroundColor: theme.primaryColor }}
                  />
                )}
                {!active && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: getAccentColor() }}
                  />
                )}
              </LinkComponent>
            );
          })}
        </div>

        {/* Right side - Auth + Theme Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Auth Button */}
          <AuthButton />

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
            className="relative w-9 h-9 rounded-md bg-transparent hover:bg-muted/60 transition-all duration-200 flex items-center justify-center group"
            aria-label="Toggle theme"
            title={mounted ? (currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode') : 'Toggle theme'}
          >
            <Sun className="theme-icon-sun absolute h-5 w-5 text-foreground transition-all duration-300 ease-in-out" />
            <Moon className="theme-icon-moon absolute h-5 w-5 text-foreground transition-all duration-300 ease-in-out" />
          </button>

          {/* Mobile/Tablet Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden rounded-md p-2 hover:bg-muted/60 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5 text-foreground" />
            ) : (
              <Menu className="h-5 w-5 text-foreground" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile/Tablet Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-card/98 backdrop-blur-xl">
          <div className="w-full px-4 py-4 space-y-1">
            {navigation.map((item) => {
              const Icon = getNavigationIcon(item.icon);
              const LinkComponent = item.external ? 'a' : Link;
              const active = !item.external && isActive(item.href);
              const linkProps = item.external
                ? {
                    href: item.href,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  }
                : { href: item.href };

              return (
                <LinkComponent
                  key={item.name}
                  {...linkProps}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-all ${
                    active
                      ? 'text-white shadow-lg'
                      : 'text-foreground hover:bg-muted/60'
                  }`}
                  style={active ? { backgroundColor: theme.primaryColor } : {}}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                  {item.external && (
                    <span className="ml-auto text-xs text-muted-foreground">↗</span>
                  )}
                </LinkComponent>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
