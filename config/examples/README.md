# Example Configurations

This directory contains example configurations for different cryptocurrencies to demonstrate how easy it is to fork and customize AtlasP2P for your chain.

## Available Examples

- **dingocoin.config.yaml** - Dingocoin Nodes Map configuration (complete example)
- **dogecoin.config.yaml** - Dogecoin Nodes Map configuration (minimal example)

## How to Use These Examples

### Option 1: Replace the Main Config (Recommended)

1. Choose an example config that matches your chain
2. Copy it to replace the main config:
   ```bash
   cp config/examples/dingocoin.config.yaml config/project.config.yaml
   ```
3. Edit `config/project.config.yaml` to customize:
   - Chain configuration (name, ports, DNS seeds)
   - Theme colors and branding
   - Social links
   - Feature flags
   - **Deployment settings** (registry type, Caddy mode, secrets source)
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

### 6. Deployment Configuration
Configure automated production deployment:

**Registry Choice:**
- `deployment.registry.type: ghcr` - Free, unlimited public images (recommended)
- `deployment.registry.type: ecr` - AWS private images (for enterprise)

**Caddy Mode:**
- `deployment.caddy.mode: auto` - Auto-detect (recommended)
- `deployment.caddy.mode: container` - Use container Caddy
- `deployment.caddy.mode: host` - Use host Caddy
- `deployment.caddy.mode: none` - No Caddy (behind load balancer)

**Secrets Management:**
- `deployment.secrets.source: auto` - Auto-detect (recommended)
- `deployment.secrets.source: aws-ssm` - AWS Parameter Store
- `deployment.secrets.source: github-secrets` - GitHub Secrets
- `deployment.secrets.source: manual` - Manual .env on server

See [CI/CD Documentation](../../docs/CICD.md) for complete deployment setup guide.

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
