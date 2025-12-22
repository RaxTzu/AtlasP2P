# CountryTable Integration Guide

This guide shows you how to integrate the CountryTable component into your application.

## Quick Start

### Option 1: Add to Stats Page

Create or update `/apps/web/src/app/stats/page.tsx`:

```tsx
'use client';

import { CountryTable } from '@/components/tables/CountryTable';
import { StatsPanel } from '@/components/stats/StatsPanel';
import { CountryDistributionChart } from '@/components/charts/CountryDistributionChart';
import { VersionDistributionChart } from '@/components/charts/VersionDistributionChart';

export default function StatsPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Hero Section */}
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">Network Statistics</h1>
        <p className="text-muted-foreground">
          Real-time insights into the blockchain node network
        </p>
      </div>

      {/* Hero Stats */}
      <StatsPanel />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Country Table (Left) */}
        <CountryTable initialLimit={10} />

        {/* Version Chart (Right) */}
        <VersionDistributionChart />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Country Chart */}
        <CountryDistributionChart />

        {/* Other charts... */}
      </div>
    </div>
  );
}
```

### Option 2: Add to Homepage (Below Map)

Update `/apps/web/src/app/page.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';
import { Suspense, useState } from 'react';
import { CountryTable } from '@/components/tables/CountryTable';
import { StatsPanel } from '@/components/stats/StatsPanel';
// ... other imports

const MapLibreMap = dynamic(() => import('@/components/map/MapLibreMap'), {
  ssr: false,
});

export default function HomePage() {
  // ... existing code

  return (
    <>
      {/* Existing Map View */}
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        {/* ... existing map code ... */}
      </div>

      {/* New: Below-fold Stats Section */}
      <div className="relative z-[999] bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CountryTable initialLimit={10} />
            {/* Add other stats/charts here */}
          </div>
        </div>
      </div>
    </>
  );
}
```

### Option 3: Add as Sidebar Widget

Create a sidebar layout with the CountryTable:

```tsx
'use client';

import { CountryTable } from '@/components/tables/CountryTable';
import { MapLibreMap } from '@/components/map/MapLibreMap';

export default function MapWithSidebarPage() {
  return (
    <div className="flex h-screen">
      {/* Map (Left) */}
      <div className="flex-1 relative">
        <MapLibreMap viewMode="map" />
      </div>

      {/* Sidebar (Right) */}
      <aside className="w-96 overflow-y-auto bg-card border-l border-border">
        <div className="p-4 space-y-6">
          <CountryTable
            initialLimit={15}
            showPercentage={true}
          />
        </div>
      </aside>
    </div>
  );
}
```

### Option 4: Mobile-Optimized Bottom Sheet

For mobile-friendly integration:

```tsx
'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { CountryTable } from '@/components/tables/CountryTable';

export function MobileCountrySheet() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`
      fixed bottom-0 left-0 right-0 z-[2000]
      bg-card border-t border-border rounded-t-2xl
      transition-transform duration-300
      ${isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-3rem)]'}
      md:hidden
    `}>
      {/* Handle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium"
      >
        {isOpen ? (
          <>
            <ChevronDown className="h-4 w-4" />
            Hide Countries
          </>
        ) : (
          <>
            <ChevronUp className="h-4 w-4" />
            Show Countries
          </>
        )}
      </button>

      {/* Content */}
      <div className="max-h-[70vh] overflow-y-auto">
        <CountryTable
          initialLimit={5}
          showPercentage={false}
          className="border-0"
        />
      </div>
    </div>
  );
}
```

## Step-by-Step Integration

### 1. Import the Component

```tsx
import { CountryTable } from '@/components/tables/CountryTable';
```

### 2. Add to Your Page

```tsx
<CountryTable />
```

### 3. Customize as Needed

```tsx
<CountryTable
  initialLimit={10}      // Show top 10 initially
  showPercentage={true}  // Display percentage column
  className="custom-class" // Add custom styling
/>
```

### 4. Verify Data Flow

Ensure your page has access to:
- `useCountryStats()` hook (for data)
- `useFilterStore()` hook (for filtering)
- Supabase client configured

## Common Patterns

### Pattern 1: Dashboard Grid

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
  <CountryTable initialLimit={8} />
  <VersionChart />
  <TierChart />
</div>
```

### Pattern 2: Two-Column Layout

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
  {/* Left: Table */}
  <div className="space-y-6">
    <CountryTable initialLimit={15} />
  </div>

  {/* Right: Charts */}
  <div className="space-y-6">
    <CountryDistributionChart />
    <VersionDistributionChart />
  </div>
</div>
```

### Pattern 3: Tab View

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

<Tabs defaultValue="countries">
  <TabsList>
    <TabsTrigger value="countries">Countries</TabsTrigger>
    <TabsTrigger value="versions">Versions</TabsTrigger>
  </TabsList>

  <TabsContent value="countries">
    <CountryTable initialLimit={20} />
  </TabsContent>

  <TabsContent value="versions">
    {/* Version stats here */}
  </TabsContent>
</Tabs>
```

## Troubleshooting

### Issue: Component Not Rendering

**Solution**: Ensure you're using it in a client component:

```tsx
'use client';  // Add this at the top

import { CountryTable } from '@/components/tables/CountryTable';
```

### Issue: No Data Showing

**Solution**: Check Supabase connection and database:

```bash
# Check if nodes exist
make db-studio
# Navigate to nodes_public table
```

### Issue: Filters Not Working

**Solution**: Verify filter store is properly set up:

```tsx
// In your root layout or provider
import { FilterStoreProvider } from '@/hooks/useFilters';

export default function RootLayout({ children }) {
  return (
    <FilterStoreProvider>
      {children}
    </FilterStoreProvider>
  );
}
```

### Issue: Flags Not Displaying

**Solution**: Ensure proper emoji font support:

```css
/* Add to your global CSS */
body {
  font-family: system-ui, -apple-system, "Segoe UI", "Segoe UI Emoji", sans-serif;
}
```

## Styling Customization

### Custom Theme Colors

The component respects your theme configuration:

```tsx
// In your theme config
export const theme = {
  primaryColor: '#FF6B00',  // Used for bars, selected state
  // ... other colors
};
```

### Custom CSS Classes

```tsx
<CountryTable
  className="
    shadow-2xl
    max-w-4xl
    mx-auto
    hover:shadow-3xl
    transition-shadow
  "
/>
```

### Conditional Styling

```tsx
const isMobile = useMediaQuery('(max-width: 768px)');

<CountryTable
  showPercentage={!isMobile}
  initialLimit={isMobile ? 5 : 10}
  className={isMobile ? 'shadow-none' : 'shadow-lg'}
/>
```

## Performance Tips

### 1. Lazy Loading

```tsx
import dynamic from 'next/dynamic';

const CountryTable = dynamic(
  () => import('@/components/tables/CountryTable').then(mod => mod.CountryTable),
  { ssr: false }
);
```

### 2. Conditional Rendering

```tsx
{showStats && <CountryTable initialLimit={10} />}
```

### 3. Memoization

```tsx
import { memo } from 'react';

const MemoizedCountryTable = memo(CountryTable);
```

## Accessibility Checklist

- [ ] Keyboard navigation works
- [ ] Screen reader announces country changes
- [ ] Focus visible on interactive elements
- [ ] Color contrast meets WCAG AA
- [ ] Table semantics are correct

## Next Steps

1. Choose your integration pattern
2. Add the component to your page
3. Test on mobile and desktop
4. Verify filter interaction with map
5. Customize styling to match your brand

## Support

If you encounter issues:
1. Check the component's TypeScript types
2. Review the example usage files
3. Inspect browser console for errors
4. Verify Supabase data is available
5. Check network requests in DevTools

## Related Documentation

- [CountryTable.md](./CountryTable.md) - Full API documentation
- [CountryTable.example.tsx](./CountryTable.example.tsx) - Usage examples
- [useCountryStats.ts](../../hooks/useCountryStats.ts) - Data hook
- [useFilters.ts](../../hooks/useFilters.ts) - Filter store
