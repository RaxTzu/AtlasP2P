# Logo Assets Directory

This directory contains logo files for the nodes map application.

## Template Files (FOR FORKING)

Replace these template files with your cryptocurrency's branding:

### Main Logo
- **File**: `TEMPLATE-logo.svg` or `logo.png`
- **Size**: 256x256px recommended
- **Format**: PNG or SVG (SVG preferred for scalability)
- **Background**: Transparent preferred
- **Usage**: Navigation header, footer, loading screens
- **Config**: Update `themeConfig.logo` in `config/project.config.yaml`

### OG Image (Social Sharing)
- **File**: `TEMPLATE-logo-512.svg` or `logo-512.png`
- **Size**: 512x512px or 1200x630px
- **Format**: PNG or SVG
- **Background**: Transparent or branded background
- **Usage**: Social media previews (Twitter, Facebook, Discord)
- **Config**: Update `seoConfig.ogImagePath` in `config/project.config.yaml`

### Favicon
- **File**: `TEMPLATE-favicon.svg` or `favicon.ico`
- **Size**: 32x32px or 64x64px
- **Format**: ICO, PNG, or SVG
- **Background**: Transparent or solid (depends on browser)
- **Usage**: Browser tab icon
- **Config**: Update `themeConfig.favicon` in `config/project.config.yaml`

## Size Variants (Optional)

You can provide multiple sizes for optimal rendering:

- `logo-32.png` - Small icons
- `logo-64.png` - Standard icons
- `logo-128.png` - Medium displays
- `logo-256.png` - High-resolution displays
- `logo-512.png` - Social media, OG images

## Template Files (AtlasP2P)

The following template files are provided as a starting point:

- `atlasp2p.jpg` - Example main logo
- `TEMPLATE-logo.svg` - SVG logo template
- `TEMPLATE-logo-512.svg` - OG image template
- `TEMPLATE-favicon.svg` - Favicon template
- `marker-icon.png` - Generic map marker (fallback for nodes without avatars)

**Replace these with your own cryptocurrency branding!**

## Quick Start for Forking

1. **Create your logos** (PNG or SVG format):
   ```
   your-coin-logo.png      (256x256px)
   your-coin-logo-512.png  (512x512px)
   favicon.ico             (32x32px)
   ```

2. **Replace template files** or **add new files**:
   ```bash
   cp your-coin-logo.png apps/web/public/logos/logo.png
   cp your-coin-logo-512.png apps/web/public/logos/logo-512.png
   cp your-favicon.ico apps/web/public/logos/favicon.ico
   ```

3. **Update config/project.config.yaml**:
   ```yaml
   themeConfig:
     logo: /logos/logo.png
     favicon: /logos/favicon.ico

   seoConfig:
     ogImagePath: /logos/logo-512.png
   ```

4. **Rebuild the application**:
   ```bash
   pnpm build
   ```

## Best Practices

- **Use SVG when possible** - Scalable, small file size, crisp at any resolution
- **Transparent backgrounds** - Works on both light and dark themes
- **Simple designs** - Favicons are small, keep designs recognizable
- **Test on mobile** - Check how your logo looks on small screens
- **Optimize file sizes** - Use tools like TinyPNG or SVGO to compress

## Tools for Logo Creation

- **Free**: [Figma](https://figma.com), [Inkscape](https://inkscape.org)
- **Paid**: Adobe Illustrator, Sketch
- **Online**: [Canva](https://canva.com), [Photopea](https://photopea.com)
- **Favicon Generator**: [RealFaviconGenerator](https://realfavicongenerator.net/)

## Need Help?

See full documentation:
- [Configuration Guide](../../../config/CONFIGURATION.md)
- [Forking Guide](../../../docs/FORKING.md)
- [README](../../../README.md)
