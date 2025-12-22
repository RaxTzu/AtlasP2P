# @atlasp2p/config

Comprehensive runtime configuration validation for AtlasP2P using Zod schemas.

## Features

- **Fail-fast validation** - Invalid config prevents server start in both dev and production
- **Clear error messages** - Field paths and validation rules clearly indicated
- **Type-safe** - Full TypeScript support with inferred types from schemas
- **Complete coverage** - Validates all fields in project.config.yaml
- **No hardcoding** - All validation rules derived from types

## Usage

### Server-side (Node.js runtime)

```typescript
import { autoLoadConfig } from '@atlasp2p/config/loader.server';

// Load and validate config (throws on validation error)
// Tries project.config.yaml first, falls back to .example if not found
const config = autoLoadConfig();
```

**Config File Resolution:**
1. Looks for `config/project.config.yaml` (primary - for forks and local dev)
2. Falls back to `config/project.config.yaml.example` (for CI/CD and upstream development)
3. Logs a warning when using `.example` file
4. Throws error if neither file exists

### Client-side (Browser/Edge runtime)

```typescript
import { getProjectConfig } from '@atlasp2p/config';

// Get validated config (already loaded by server)
const config = getProjectConfig();
```

### Manual validation

```typescript
import { ProjectConfigSchema } from '@atlasp2p/config';

const result = ProjectConfigSchema.safeParse(rawConfig);

if (!result.success) {
  console.error(result.error.errors);
}
```

## Validation Coverage

### Required Fields
- `projectName` - Non-empty string
- `chain` - Non-empty string
- `chainConfig.*` - All chain configuration fields
- `themeConfig.*` - All theme configuration fields

### Format Validation
- **Versions**: Must match `X.Y.Z` format (e.g., "1.18.0")
- **Hex colors**: Must match `#RRGGBB` format (e.g., "#155799")
- **URLs**: Must be valid HTTP/HTTPS URLs
- **Emails**: Must be valid email addresses
- **Ports**: Must be integers between 1-65535
- **IPs**: Seed nodes must be in `IP:PORT` format

### Range Validation
- **Ports**: 1-65535
- **Percentages**: 0-100
- **Zoom levels**: 0-22
- **Coordinates**:
  - Latitude: -90 to 90
  - Longitude: -180 to 180

### Enum Validation
- **Turnstile mode**: `visible` | `invisible` | `managed`
- **Email provider**: `resend` | `sendgrid` | `smtp` | `disabled`
- **Analytics provider**: `plausible` | `google` | `matomo` | `fathom` | `null`
- **Tile provider**: `openstreetmap` | `mapbox` | `carto-dark`
- **Social icons**: `github` | `twitter` | `discord` | etc.
- **Navigation icons**: `map` | `trophy` | `server` | etc.

### Array Validation
- **DNS seeds**: At least 1 required, all non-empty
- **User agent patterns**: At least 1 required
- **Tile styles**: At least 1 required
- **Navigation items**: At least 1 required
- **Protected actions**: Must be valid action names
- **Allowed avatar formats**: Must be valid image extensions

### Custom Validation
- **minZoom ≤ maxZoom** - Map zoom level consistency
- **defaultTileStyle exists** - Must match one of tileStyles IDs
- **Icon sizes**: Must be positive integers
- **Marker priorities**: Must be positive integers

## Error Messages

When validation fails, you'll get clear error messages:

```
Invalid configuration in /path/to/project.config.yaml:
  chainConfig.p2pPort: Port must be between 1 and 65535
  chainConfig.currentVersion: Version must be in format X.Y.Z (e.g., "1.18.0")
  features.turnstile.mode: Invalid enum value. Expected 'visible' | 'invisible' | 'managed'
  mapConfig.minZoom: Expected number, received string

Please check your project.config.yaml file against the schema.
```

## Schema Structure

```
ProjectConfigSchema
├── projectName: string (min 1)
├── chain: string (min 1)
├── chainConfig: ChainConfigSchema
│   ├── name: string
│   ├── ticker: string
│   ├── p2pPort: number (1-65535)
│   ├── rpcPort: number (1-65535)
│   ├── protocolVersion: number (positive int)
│   ├── currentVersion: version string (X.Y.Z)
│   ├── minimumVersion: version string
│   ├── criticalVersion: version string
│   ├── explorerUrl: URL
│   ├── websiteUrl: URL
│   ├── githubUrl: URL
│   ├── dnsSeeds: string[] (min 1)
│   ├── seedNodes: string[] (IP:PORT format)
│   ├── magicBytes: hex string (8 chars)
│   └── userAgentPatterns: string[] (min 1)
├── themeConfig: ThemeConfigSchema
│   ├── name: string
│   ├── primaryColor: hex color
│   ├── secondaryColor: hex color
│   ├── accentColor: hex color
│   ├── logo: string
│   └── favicon: string
├── content: ContentConfigSchema
│   ├── siteName: string
│   ├── siteDescription: string
│   ├── siteUrl: URL
│   ├── navigation: NavigationItem[]
│   └── social: SocialLink[]
├── mapConfig: MapConfigSchema
│   ├── defaultCenter: [lat, lng]
│   ├── defaultZoom: number (0-22)
│   ├── minZoom: number (0-22)
│   ├── maxZoom: number (0-22)
│   └── tileStyles: TileStyleConfig[]
├── crawlerConfig: CrawlerConfigSchema
│   ├── pruneAfterHours: number (positive)
│   ├── scanIntervalMinutes: number (positive)
│   ├── maxConcurrentConnections: number (1-1000)
│   └── connectionTimeoutSeconds: number (positive)
├── adminConfig: AdminConfigSchema
│   ├── adminEmails: email[] (min 1)
│   ├── semanticColors: SemanticColorsSchema
│   │   ├── success: hex color
│   │   ├── warning: hex color
│   │   ├── error: hex color
│   │   └── info: hex color
│   ├── email: EmailConfigSchema
│   │   ├── provider: enum
│   │   ├── fromEmail: email
│   │   ├── fromName: string
│   │   ├── alertsFromEmail?: email (optional)
│   │   ├── alertsFromName?: string (optional)
│   │   ├── autoConfirm: boolean
│   │   ├── verificationRequired: boolean
│   │   └── otp: EmailOTPConfigSchema
│   └── alerts: AlertsConfigSchema
├── features: FeatureFlagsSchema
│   ├── verification: VerificationFeaturesSchema
│   ├── tipping: TippingFeaturesSchema
│   ├── turnstile: TurnstileFeaturesSchema
│   └── ... (all feature flags)
└── assets: AssetsConfigSchema
    ├── logoPath: string
    ├── faviconPath: string
    └── ogImagePath?: string
```

## Development

### Running Tests

```bash
# Test basic validation
node test-validation-simple.js

# TypeScript typecheck
pnpm typecheck --filter @atlasp2p/config
```

### Adding New Validation Rules

1. Update the Zod schema in `src/schema.ts`
2. Run typecheck to ensure type compatibility
3. Test with malformed config to verify error messages
4. Update this README with new validation rules

## Production Deployment

Validation runs automatically on server startup via `instrumentation.ts`:

- ✅ Validates YAML structure and types
- ✅ Validates feature flag dependencies
- ✅ Validates environment variable requirements
- ✅ Prevents server start on validation failure

This ensures malformed config never reaches production.

### NODE_ENV-Aware Validation

The validation system adapts based on the environment:

**Development Mode (NODE_ENV=development)**:
- Email provider can be `disabled` for local testing
- SMTP credentials are optional (allows testing without email)
- Validation warnings logged but don't block startup
- More permissive for rapid development

**Production Mode (NODE_ENV=production)**:
- Email provider `disabled` triggers warning (alerts won't work)
- If email provider is `resend`: Requires `RESEND_API_KEY` in environment
- If email provider is `sendgrid`: Requires `SENDGRID_API_KEY` in environment
- If email provider is `smtp`: Requires `SMTP_HOST` (USER/PASSWORD optional for auth-less SMTP)
- Missing required env vars block server startup
- Stricter validation to prevent misconfigurations

**Environment Variable Requirements by Feature**:

| Feature | Config Path | Required ENV Vars | When Required |
|---------|-------------|-------------------|---------------|
| **Email (Resend)** | `adminConfig.email.provider: resend` | `RESEND_API_KEY` | Production only |
| **Email (SendGrid)** | `adminConfig.email.provider: sendgrid` | `SENDGRID_API_KEY` | Production only |
| **Email (SMTP)** | `adminConfig.email.provider: smtp` | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` | Always (USER/PASSWORD optional) |
| **Turnstile** | `features.turnstile.enabled: true` | `TURNSTILE_SECRET_KEY` | Always |
| **Error Tracking** | `features.errorTracking.enabled: true` | `SENTRY_DSN` | Production only |
| **Analytics** | `features.analytics.enabled: true` | Provider-specific key | Production only |

This design allows:
- Fast local development without external services
- Safe production deployments with proper validation
- Clear error messages when env vars are missing

## Common Errors

### "Version must be in format X.Y.Z"
- ❌ `currentVersion: "1.18"`
- ✅ `currentVersion: "1.18.0"`

### "Port must be between 1 and 65535"
- ❌ `p2pPort: 99999`
- ✅ `p2pPort: 34646`

### "Color must be a valid hex color"
- ❌ `primaryColor: "blue"`
- ✅ `primaryColor: "#155799"`

### "Must be a valid URL"
- ❌ `websiteUrl: "dingocoin.com"`
- ✅ `websiteUrl: "https://dingocoin.com"`

### "defaultTileStyle must match one of the tileStyles IDs"
- ❌ `defaultTileStyle: "mymap"` (when no tileStyle has id="mymap")
- ✅ `defaultTileStyle: "branded"` (matches tileStyles[0].id)

## License

MIT
