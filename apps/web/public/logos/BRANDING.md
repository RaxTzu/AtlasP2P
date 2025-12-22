# AtlasP2P Branding Assets

## Current Files

### Core Logos
- **`atlasp2p.jpg`** (760KB) - High-quality main logo for documentation
- **`atlasp2p.svg`** (529KB) - Scalable vector logo (used in web app)
- **`atlasp2p-og.png`** (104KB) - Social media preview (512x512, OG image)

### Favicons
- **`atlasp2p-favicon.ico`** (15KB) - Classic browser tab icon
- **`atlasp2p-favicon.svg`** (127KB) - Modern scalable favicon
- **`atlasp2p-apple-touch.png`** (18KB) - iOS home screen icon

### PWA
- **`atlasp2p.webmanifest`** (349B) - Progressive Web App manifest

### Map Assets
- **`marker-icon.png`** (936B) - Generic fallback for node markers without custom avatars

### Documentation
- **`README.md`** - Fork instructions
- **`BRANDING.md`** - This file

---

## File Purpose Breakdown

### For AtlasP2P Project
These files provide **working defaults** with AtlasP2P branding:
- Platform logo in header/footer
- Browser favicons
- Social media previews
- Documentation images

### For Forks
These files serve as **placeholders and examples**:
- Fork sees AtlasP2P branding → knows what to replace
- `marker-icon.png` is **generic** (not branded) → works for any fork
- All files follow consistent naming pattern

---

## Configuration

All assets configured in `config/project.config.yaml`:

```yaml
themeConfig:
  logo: /logos/atlasp2p.svg
  favicon: /logos/atlasp2p-favicon.ico

assets:
  logoPath: /logos/atlasp2p.svg
  faviconPath: /logos/atlasp2p-favicon.ico
  ogImagePath: /logos/atlasp2p-og.png
```

---

## For Forks: How to Replace

### 1. Create Your Branding
- Main logo (SVG preferred, or PNG 256x256+)
- Favicon (use [RealFaviconGenerator](https://realfavicongenerator.net/))
- OG image (512x512 PNG for social media)

### 2. Replace Files
```bash
# Replace AtlasP2P files with your branding
cp yourcoin-logo.svg apps/web/public/logos/yourcoin.svg
cp yourcoin-favicon.ico apps/web/public/logos/yourcoin-favicon.ico
cp yourcoin-og.png apps/web/public/logos/yourcoin-og.png
```

### 3. Update Config
Edit `config/project.config.yaml`:
```yaml
themeConfig:
  logo: /logos/yourcoin.svg
  favicon: /logos/yourcoin-favicon.ico

assets:
  logoPath: /logos/yourcoin.svg
  ogImagePath: /logos/yourcoin-og.png
```

### 4. Update Webmanifest
Edit `apps/web/public/logos/yourcoin.webmanifest`:
```json
{
  "name": "YourCoin Network",
  "short_name": "YourCoin",
  "icons": [{"src": "/logos/yourcoin-og.png", "sizes": "512x512"}],
  "theme_color": "#your-color"
}
```

### 5. (Optional) Keep Generic Marker
`marker-icon.png` is **generic** (not branded). You can:
- ✅ Keep it as-is (works for any coin)
- ✅ Replace with your coin's micro-logo (32x32)

---

## Design Guidelines

### Logo Best Practices
- **Format**: SVG preferred (scalable), PNG fallback
- **Size**: 256x256 minimum for PNG
- **Background**: Transparent preferred
- **Colors**: Match your brand's primary colors

### Favicon Requirements
- **Format**: ICO (classic) + SVG (modern)
- **Sizes**: 16x16, 32x32, 48x48 in ICO
- **Design**: Simple, recognizable at small sizes

### OG Image (Social Sharing)
- **Size**: 512x512 or 1200x630
- **Format**: PNG
- **Content**: Logo + text/tagline
- **Test**: Preview on Twitter, Discord, Facebook

---

## Current Theme

AtlasP2P uses this color scheme:
- **Primary**: `#155799` (Deep blue)
- **Secondary**: `#00d4ff` (Cyan)
- **Accent**: `#58a6ff` (Light blue)
- **Background**: `#062845` (Dark blue)

---

## Troubleshooting

### Favicon not updating?
- Clear browser cache (Ctrl+Shift+R)
- Check file path in `layout.tsx`
- Verify `favicon` in config points to correct file

### OG image not showing on social media?
- Image must be publicly accessible
- Use absolute URLs in production
- Test with [Facebook Debugger](https://developers.facebook.com/tools/debug/)

### Marker icon not appearing on map?
- Check file exists: `/logos/marker-icon.png`
- Verify references in `ClusterMarker.tsx` and `MapLibreMap.tsx`
- Check browser console for 404 errors
