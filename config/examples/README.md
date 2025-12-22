# Example Configurations

This directory contains example configurations for different cryptocurrencies to demonstrate how easy it is to fork and customize the Nodes Map for your chain.

## Available Examples

- **dogecoin.config.ts** - Dogecoin Nodes Map configuration
- **bitcoin.config.ts** - Bitcoin Nodes Map configuration
- **litecoin.config.ts** - Litecoin Nodes Map configuration

## How to Use These Examples

### Option 1: Replace the Main Config (Recommended)

1. Choose an example config that matches your chain
2. Copy it to replace the main config:
   ```bash
   cp config/examples/dogecoin.config.ts config/project.config.ts
   ```
3. Edit `config/project.config.ts` to customize further
4. Add your logos to `apps/web/public/logos/`
5. Deploy!

### Option 2: Start from Scratch

1. Copy the example that's closest to your chain
2. Modify all the values:
   - Chain configuration (ports, versions)
   - Theme colors
   - Social links
   - Navigation items
   - Feature flags
3. Test locally with `make dev`
4. Deploy when ready

## Key Customization Points

### 1. Chain Configuration
Update these for your blockchain:
- `p2pPort` - P2P network port
- `rpcPort` - RPC port
- `protocolVersion` - P2P protocol version
- `currentVersion` - Latest node software version
- `explorerUrl` - Block explorer URL
- `websiteUrl` - Official website
- `githubUrl` - GitHub repository

### 2. Theme & Branding
Customize the look and feel:
- `primaryColor` - Main brand color (hex)
- `secondaryColor` - Secondary color
- `accentColor` - Accent color for highlights
- `logo` - Path to logo image
- `favicon` - Path to favicon

### 3. Content
Control all text and links:
- `siteName` - Name shown in header
- `siteDescription` - Meta description for SEO
- `navigation` - Menu items
- `social` - Social media links
- `footerLinks` - Additional footer links
- `copyrightText` - Footer copyright message

### 4. Map Configuration
Customize the map appearance:
- `tileStyles` - Available map tile styles
- `defaultTileStyle` - Which style to show by default
- `defaultCenter` - Starting map position
- `defaultZoom` - Starting zoom level

### 5. Feature Flags
Enable/disable features:
- `features.map.clustering` - Cluster nearby nodes
- `features.verification.enabled` - Allow node verification
- `features.tipping.enabled` - Enable node tipping
- `features.community.leaderboard` - Show leaderboard
- And many more...

## Logo Assets Required

Place these files in `apps/web/public/logos/`:

- `{chain}.png` - Main logo (recommended: 256x256px)
- `{chain}-favicon.ico` - Favicon (16x16, 32x32, 48x48)
- `{chain}-og.png` - Open Graph image for social sharing (1200x630px)

## Testing Your Configuration

```bash
# 1. Start the development server
make dev

# 2. Check the following:
# - Logo appears in header
# - Colors match your theme
# - Social links work
# - Map tiles load correctly
# - Navigation items are correct

# 3. Build to verify everything compiles
pnpm build
```

## Need Help?

- See `/docs/CONFIGURATION.md` for detailed configuration reference
- See `/docs/FORKING.md` for complete forking guide
- Check the main README for development setup
