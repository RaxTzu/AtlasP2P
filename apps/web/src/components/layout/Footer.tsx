'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import {
  getThemeConfig,
  getChainConfig,
  getSocialLinks,
  getFooterLinks,
  getContentConfig,
  getProjectConfig,
} from '@/config';
import { getSocialIcon } from '@/lib/iconMap';

export function Footer() {
  const pathname = usePathname();

  // Hide footer on map view (homepage)
  if (pathname === '/') {
    return null;
  }
  const theme = getThemeConfig();
  const chainConfig = getChainConfig();
  const socialLinks = getSocialLinks();
  const footerLinks = getFooterLinks();
  const content = getContentConfig();
  const projectName = getProjectConfig().projectName;

  return (
    <footer className="border-t border-border bg-card/90 backdrop-blur-xl">
      <div className="w-full px-4 lg:px-8 py-4">
        {/* Single centered row */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
          {/* Branding */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium text-foreground">{theme.name}</span>
            <span className="text-border">|</span>
            <a
              href={chainConfig.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              {chainConfig.name}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Divider - hidden on mobile */}
          <span className="hidden sm:block text-border">|</span>

          {/* Links */}
          <div className="flex items-center gap-4">
            {footerLinks.map((link) => {
              const LinkComponent = link.external ? 'a' : Link;
              const linkProps = link.external
                ? {
                    href: link.href,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  }
                : { href: link.href };

              return (
                <LinkComponent
                  key={link.label}
                  {...linkProps}
                  className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  {link.label}
                  {link.external && <ExternalLink className="h-3 w-3" />}
                </LinkComponent>
              );
            })}
            <a
              href={chainConfig.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              Explorer
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Divider - hidden on mobile */}
          <span className="hidden sm:block text-border">|</span>

          {/* Social Icons */}
          <div className="flex items-center gap-3">
            {socialLinks.map((link) => {
              const Icon = getSocialIcon(link.icon);
              return (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={link.name}
                >
                  <Icon className="h-4 w-4" />
                </a>
              );
            })}
          </div>

          {/* Divider - hidden on mobile */}
          <span className="hidden sm:block text-border">|</span>

          {/* Copyright & GitHub */}
          <div className="flex items-center gap-3 text-muted-foreground text-xs">
            <span>{content.copyrightText}</span>
            <a
              href={content.githubRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              Fork {projectName}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
