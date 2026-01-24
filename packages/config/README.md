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

### Adding New Config Fields (Developer Guide)

This comprehensive guide explains how to add or modify config validation while maintaining backward compatibility and fork friendliness.

#### Step 1: Decide Required vs Optional

**Make a field REQUIRED when:**
- ✅ The app **cannot function** without it (e.g., `chainConfig.name`, `chainConfig.p2pPort`)
- ✅ There's **no sensible default** (e.g., chain-specific magic bytes)
- ✅ It's **critical for security** (e.g., admin emails for alerts)

**Make a field OPTIONAL when:**
- ✅ It's a **nice-to-have feature** (e.g., custom marker icons, analytics)
- ✅ There's a **sensible default** (e.g., `overrideAvatarWhenOutdated: false`)
- ✅ It only affects **specific features** that might not be used
- ✅ **Backward compatibility** - existing forks shouldn't break

**Example:**
```typescript
// ❌ BAD - Makes all existing forks break if they don't have this field
newFeature: z.boolean(),

// ✅ GOOD - Optional with default, backward compatible
newFeature: z.boolean().optional().default(false),

// ✅ ALSO GOOD - Optional, no default (truly optional)
customIcon: z.string().optional(),
```

#### Step 2: Choose the Right Schema Pattern

**Pattern A: Required field**
```typescript
// Use when: Field is critical, no sensible default
fieldName: z.string().min(1, 'Field name is required'),
```

**Pattern B: Optional with default**
```typescript
// Use when: Has sensible default, backward compatible
fieldName: z.boolean().optional().default(false),
fieldName: z.number().optional().default(100),
fieldName: z.string().optional().default('default-value'),
```

**Pattern C: Optional without default (nullable)**
```typescript
// Use when: Truly optional, null/undefined is valid
fieldName: z.string().optional(),
fieldName: z.string().nullable(),
```

**Pattern D: Optional with fallback logic**
```typescript
// Use when: Default depends on other fields
// Set as optional, handle fallback in code
markerIconPath: z.string().optional(),  // Falls back to logoPath in code
```

#### Step 3: Update the Schema

**Location:** `packages/config/src/schema.ts`

**Example: Adding a new optional field to assets config**
```typescript
export const AssetsConfigSchema = z.object({
  logoPath: z.string().min(1, 'Logo path is required'),
  faviconPath: z.string().min(1, 'Favicon path is required'),
  ogImagePath: z.string().min(1, 'OG image path is required'),

  // Optional fields with defaults
  markerIconPath: z.string().optional(),
  markerIconOutdatedPath: z.string().optional(),
  markerIconCriticalPath: z.string().optional(),
  markerIconOfflinePath: z.string().optional(),

  // NEW: Add your field here
  myNewFeature: z.boolean().optional().default(true),
});
```

#### Step 4: Update TypeScript Types

The types are automatically inferred from the schema via:
```typescript
// packages/types/src/config.ts
import type { ProjectConfigSchema } from '@atlasp2p/config/schema';
import type { z } from 'zod';

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
```

**No manual type updates needed!** Zod automatically generates the types.

#### Step 5: Add Error Messages

**Good error messages are critical:**

```typescript
// ❌ BAD - Generic error
port: z.number(),

// ✅ GOOD - Specific, actionable error
port: z.number().int().min(1).max(65535, 'Port must be between 1 and 65535'),

// ✅ BETTER - Include example
version: z.string().regex(
  /^\d+\.\d+\.\d+$/,
  'Version must be in format X.Y.Z (e.g., "1.18.0")'
),
```

#### Step 6: Test Your Schema

**Create a test config:**
```yaml
# test-invalid.yaml
assets:
  logoPath: /logos/logo.png
  faviconPath: /logos/favicon.ico
  ogImagePath: /logos/og.png
  myNewFeature: "not-a-boolean"  # Should fail
```

**Test validation:**
```typescript
import { ProjectConfigSchema } from '@atlasp2p/config/schema';
import * as yaml from 'js-yaml';
import * as fs from 'fs';

const rawConfig = yaml.load(fs.readFileSync('test-invalid.yaml', 'utf8'));
const result = ProjectConfigSchema.safeParse(rawConfig);

if (!result.success) {
  console.log(result.error.errors);
  // Should show: assets.myNewFeature: Expected boolean, received string
}
```

#### Step 7: Update Example Configs

**Add the new field to all example configs:**
```bash
# Update these files:
config/examples/dingocoin.config.yaml
config/examples/dogecoin.config.yaml
# ... any other example configs
```

**Use sensible defaults for examples:**
```yaml
assets:
  logoPath: /logos/atlasp2p.svg
  faviconPath: /logos/atlasp2p-favicon.ico
  ogImagePath: /logos/atlasp2p-og.png
  # Optional fields - show as commented examples
  # markerIconPath: /icons/marker.png
  # myNewFeature: true
```

#### Step 8: Update Documentation

1. **Update this README:**
   - Add field to validation coverage section
   - Add common error example if applicable

2. **Update config docs:**
   - `docs/config/CONFIGURATION.md` - Document the new field
   - Include purpose, valid values, and examples

3. **Update changelog/release notes:**
   - Mention new optional field
   - Note that it's backward compatible (or breaking change if required)

#### Breaking Changes (Required Fields)

**If you MUST add a required field:**

1. **Announce it in advance** - Give forks time to update
2. **Provide migration guide** - Show exact YAML to add
3. **Version bump** - Indicate breaking change (major version)
4. **Consider transition period** - Make optional first, required later

**Example migration guide:**
```markdown
## Breaking Change: New Required Field

**Action Required:** Add this to your `project.config.yaml`:

```yaml
newSection:
  requiredField: "value"  # Replace with your chain's value
```

**Why:** This field is required for [feature/security reason].
**Impact:** Server won't start without this field.
```

#### Best Practices Summary

**DO:**
- ✅ Use `.optional().default(value)` for backward compatibility
- ✅ Provide clear, actionable error messages with examples
- ✅ Test with both valid and invalid configs
- ✅ Document all new fields thoroughly
- ✅ Keep example configs up to date

**DON'T:**
- ❌ Add required fields without migration plan
- ❌ Use generic error messages ("Invalid value")
- ❌ Forget to update TypeScript types (Zod does this automatically)
- ❌ Skip testing with malformed config
- ❌ Break existing forks unnecessarily

#### Quick Checklist

Before committing schema changes:

- [ ] Field is optional with default (unless truly required)
- [ ] Error messages are clear and include examples
- [ ] Tested with both valid and invalid values
- [ ] All example configs updated
- [ ] Documentation updated (README, CONFIGURATION.md)
- [ ] TypeScript compilation passes (`pnpm typecheck`)
- [ ] No breaking changes for existing forks (or migration guide provided)

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
