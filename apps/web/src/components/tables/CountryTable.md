# CountryTable Component

A comprehensive, Bitnodes.io-style country ranking table component that displays node distribution across countries with interactive filtering, sorting, and visual enhancements.

## Features

### Core Functionality

- **Full Country List**: Displays ALL countries with active nodes (not just top N)
- **Country Flags**: Automatic emoji flag display using ISO 3166-1 alpha-2 codes
- **Node Counts**: Shows total number of nodes per country
- **Percentage Share**: Visual percentage bars and numerical percentages
- **Interactive Map Filter**: Click any country to filter the map view
- **Sortable Columns**: Sort by country name or node count
- **Expandable View**: Show top N initially, expand to view all

### Visual Enhancements

- **Top 3 Highlighting**: Special styling and ranking badges for top 3 countries
- **Percentage Bars**: Visual progress bars for quick comparison
- **Hover Effects**: Smooth transitions and interactive feedback
- **Selected State**: Visual indicator for currently filtered country
- **Semantic Colors**: Consistent color scheme with theme configuration

### Responsive Design

- **Mobile-Optimized**: Responsive table layout with horizontal scroll
- **Conditional Columns**: Percentage column hidden on small screens
- **Compact Mode**: Support for mobile-friendly layouts
- **Touch-Friendly**: Large click targets for mobile devices

### Accessibility

- **ARIA Labels**: Proper labeling for screen readers
- **Keyboard Navigation**: Full keyboard support
- **Semantic HTML**: Proper table structure
- **Color Contrast**: Meets WCAG AA standards

## Usage

### Basic Usage

```tsx
import { CountryTable } from '@/components/tables/CountryTable';

export function StatsPage() {
  return (
    <div className="container mx-auto p-4">
      <CountryTable />
    </div>
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialLimit` | `number` | `10` | Number of countries to show initially |
| `showPercentage` | `boolean` | `true` | Whether to show percentage column |
| `className` | `string` | `''` | Additional CSS classes |

### Examples

#### Show Top 5 Countries

```tsx
<CountryTable initialLimit={5} />
```

#### Hide Percentage Column (Mobile)

```tsx
<CountryTable showPercentage={false} />
```

#### Custom Styling

```tsx
<CountryTable
  initialLimit={15}
  className="max-w-2xl mx-auto"
/>
```

#### Sidebar Layout

```tsx
<aside className="w-96">
  <CountryTable
    initialLimit={10}
    className="sticky top-4"
  />
</aside>
```

## How It Works

### Data Flow

1. **Data Fetching**: Uses `useCountryStats()` hook to fetch country distribution
2. **Filtering**: Integrates with `useFilterStore()` for map filtering
3. **Sorting**: Client-side sorting by name or count
4. **Display**: Renders top N countries, expandable to full list

### Sorting Logic

- **By Count**: Numerical sorting (descending by default)
- **By Name**: Alphabetical sorting (ascending by default)
- **Toggle**: Click same column header to reverse order

### Filter Integration

- **Click Country**: Sets country filter in global store
- **Map Updates**: Map automatically filters to show only that country's nodes
- **Click Again**: Clears the filter
- **Visual Feedback**: Selected country highlighted

### Flag Emoji Generation

```typescript
const getCountryFlag = (countryCode: string): string => {
  if (!countryCode || countryCode === 'Unknown') return '🌍';

  // Convert ISO 3166-1 alpha-2 to flag emoji
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
};
```

**Examples**:
- `US` → 🇺🇸
- `GB` → 🇬🇧
- `CN` → 🇨🇳
- `Unknown` → 🌍

## Component Structure

```
CountryTable
├── Header
│   ├── Title with Globe icon
│   └── Total country count
├── Table
│   ├── Sortable Headers
│   │   ├── Country (with flag)
│   │   ├── Node count
│   │   └── Percentage share (optional)
│   └── Rows
│       ├── Flag emoji
│       ├── Country name & code
│       ├── Top 3 badge (if applicable)
│       ├── Node count
│       └── Percentage bar & text
├── Show All Button (if > initialLimit)
└── Footer
    ├── Count display
    └── Clear filter button (if active)
```

## Styling

### CSS Classes

The component uses Tailwind CSS with semantic color variables:

```css
/* Card styling */
bg-card rounded-xl shadow-lg border-border

/* Interactive elements */
hover:bg-muted/50 cursor-pointer transition-all

/* Selected state */
bg-primary/10 text-primary font-semibold

/* Top 3 highlighting */
font-semibold text-success

/* Percentage bars */
bg-primary rounded-full
```

### Color Variables

- `--color-card`: Background color
- `--color-border`: Border color
- `--color-primary`: Brand color (for bars, selected state)
- `--color-muted`: Subtle backgrounds
- `--color-foreground`: Text color
- `--color-muted-foreground`: Secondary text
- `--color-success`: Top 3 ranking color
- `--color-destructive`: Error states

## State Management

### Local State

```typescript
const [sortField, setSortField] = useState<'count' | 'name'>('count');
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
const [isExpanded, setIsExpanded] = useState(false);
```

### Global State (via Zustand)

```typescript
const { filters, setCountry } = useFilterStore();
```

## Performance Optimizations

### Memoization

```typescript
// Sorted countries - only recomputes when data/sort changes
const sortedCountries = useMemo(() => {
  // ... sorting logic
}, [countries, sortField, sortOrder]);

// Displayed countries - only recomputes when sort/expansion changes
const displayedCountries = useMemo(() => {
  // ... slicing logic
}, [sortedCountries, isExpanded, initialLimit]);
```

### Efficient Updates

- Only fetches country stats every 5 minutes
- Client-side sorting (no API calls)
- Minimal re-renders with proper memoization

## Integration Points

### Required Hooks

- `useCountryStats()` - Fetches and aggregates country data
- `useFilterStore()` - Global filter state management

### Required Components

- Lucide React icons: `ChevronDown`, `ChevronUp`, `ChevronsUpDown`, `MapPin`, `TrendingUp`, `Globe`

### Data Requirements

Country data from `useCountryStats()`:

```typescript
interface CountryDistribution {
  countryCode: string;
  countryName: string;
  count: number;
  percentage: number;
}
```

## Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| `< 640px` | Percentage column hidden, compact padding |
| `640px - 1024px` | Full table visible, moderate padding |
| `> 1024px` | Optimal spacing, all features visible |

## Accessibility Features

### Screen Reader Support

```html
<span aria-label="United States flag">🇺🇸</span>
```

### Keyboard Navigation

- `Tab`: Navigate between rows
- `Enter`: Activate filter
- `Arrow keys`: Navigate table cells

### Semantic HTML

- Proper `<table>` structure
- `<thead>` and `<tbody>` sections
- `<th>` headers with scope attributes

## Error Handling

### Loading State

Shows animated spinner while fetching data.

### Error State

Displays user-friendly error message if fetch fails.

### Empty State

Shows "No country data available" if no data returned.

### Unknown Countries

Falls back to globe emoji (🌍) for missing country codes.

## Testing

### Manual Testing Checklist

- [ ] Click country to filter map
- [ ] Click again to clear filter
- [ ] Sort by name (ascending/descending)
- [ ] Sort by count (ascending/descending)
- [ ] Expand to show all countries
- [ ] Collapse to show top N
- [ ] Verify top 3 badges appear
- [ ] Check percentage bars align correctly
- [ ] Test on mobile (< 640px)
- [ ] Verify flags display correctly

### Edge Cases

- No data available
- Single country
- All countries have same count
- Very long country names
- Unknown country codes
- Network error during fetch

## Future Enhancements

- [ ] CSV export functionality
- [ ] Search/filter by country name
- [ ] Historical trend indicators (↑↓)
- [ ] Continent grouping
- [ ] Custom sort by other metrics (uptime, latency)
- [ ] Dark mode optimizations
- [ ] Print-friendly styles

## Dependencies

```json
{
  "react": "^19.2.0",
  "lucide-react": "latest",
  "tailwindcss": "^4.0.0",
  "zustand": "^5.0.0"
}
```

## Related Components

- `CountryDistributionChart` - Bar chart visualization
- `FilterPanel` - Global filter controls
- `MapLibreMap` - Interactive map view
- `StatsPanel` - Network statistics overview

## License

MIT - Part of the AtlasP2P project (Built by RaxTzu Team)
