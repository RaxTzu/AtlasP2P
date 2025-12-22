# CountryTable - Quick Start Guide

## 1-Minute Integration

### Step 1: Import
```tsx
import { CountryTable } from '@/components/tables/CountryTable';
```

### Step 2: Use
```tsx
export default function MyPage() {
  return <CountryTable />;
}
```

### Done!
The component is now live with all features enabled.

---

## 3 Most Common Uses

### Use Case 1: Stats Page
```tsx
// /apps/web/src/app/stats/page.tsx
'use client';

import { CountryTable } from '@/components/tables/CountryTable';

export default function StatsPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Network Statistics</h1>
      <CountryTable initialLimit={10} />
    </div>
  );
}
```

### Use Case 2: Homepage Below Map
```tsx
// /apps/web/src/app/page.tsx
export default function HomePage() {
  return (
    <>
      {/* Existing map view */}
      <div className="map-container">
        <MapLibreMap />
      </div>

      {/* New: Stats section */}
      <div className="container mx-auto px-4 py-12">
        <CountryTable initialLimit={10} />
      </div>
    </>
  );
}
```

### Use Case 3: Dashboard Grid
```tsx
export default function DashboardPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CountryTable initialLimit={15} />
      {/* Other charts/stats */}
    </div>
  );
}
```

---

## Props Cheat Sheet

| Prop | Type | Default | Example |
|------|------|---------|---------|
| `initialLimit` | `number` | `10` | `initialLimit={5}` |
| `showPercentage` | `boolean` | `true` | `showPercentage={false}` |
| `className` | `string` | `''` | `className="max-w-4xl"` |

---

## Key Features (What You Get)

✅ **All countries** (not just top 8)
✅ **Flag emojis** (automatic)
✅ **Sortable** (name or count)
✅ **Map filtering** (click country)
✅ **Expandable** (Show All button)
✅ **Responsive** (mobile-friendly)
✅ **Top 3 badges** (automatic)
✅ **Percentage bars** (visual)

---

## Customization Examples

### Show Top 5 Only
```tsx
<CountryTable initialLimit={5} />
```

### Hide Percentage (Mobile)
```tsx
<CountryTable showPercentage={false} />
```

### Custom Width
```tsx
<CountryTable className="max-w-2xl mx-auto" />
```

### Compact Mobile View
```tsx
const isMobile = window.innerWidth < 640;

<CountryTable
  initialLimit={isMobile ? 5 : 10}
  showPercentage={!isMobile}
/>
```

---

## User Interactions

### Click Country → Filter Map
```
User clicks "🇺🇸 United States"
→ Map shows only US nodes
→ Row highlighted
→ "Clear filter" button appears
```

### Click Header → Sort
```
User clicks "Country ⬍"
→ Sorts alphabetically (A-Z)
Click again → Reverses (Z-A)

User clicks "Nodes ⬍"
→ Sorts by count (High-Low)
Click again → Reverses (Low-High)
```

### Click "Show All" → Expand
```
User clicks "Show All (42 more)"
→ Table expands to show all countries
→ Button changes to "Show Less"
```

---

## Troubleshooting

### Problem: Component not showing
**Solution**: Add `'use client';` at top of file

### Problem: No data
**Solution**: Check Supabase connection and verify nodes exist

### Problem: Flags not showing
**Solution**: Ensure modern browser with emoji support

### Problem: Map not filtering
**Solution**: Verify `useFilterStore()` is set up correctly

---

## Files Created

All in `/apps/web/src/components/tables/`:

1. **CountryTable.tsx** - Main component (12KB)
2. **CountryTable.md** - Full API docs (9KB)
3. **CountryTable.example.tsx** - 8 examples (6KB)
4. **INTEGRATION.md** - Integration guide (9KB)
5. **FEATURES.md** - Feature showcase (12KB)
6. **QUICKSTART.md** - This file (3KB)

---

## Next Steps

1. Choose where to add the component
2. Import and place it
3. Test on mobile
4. Customize as needed

---

## Need More Help?

- **Full docs**: `CountryTable.md`
- **Examples**: `CountryTable.example.tsx`
- **Integration**: `INTEGRATION.md`
- **Features**: `FEATURES.md`

---

**That's it!** The component is production-ready and fully documented.
