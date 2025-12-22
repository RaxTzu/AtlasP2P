/**
 * COUNTRY TABLE COMPONENT - USAGE EXAMPLES
 *
 * This file demonstrates how to use the CountryTable component
 * in various scenarios throughout the application.
 */

'use client';

import { CountryTable } from './CountryTable';

// ============================================
// EXAMPLE 1: Basic Usage (Homepage/Stats Page)
// ============================================

export function CountryTableBasicExample() {
  return (
    <div className="container mx-auto p-4">
      <CountryTable />
    </div>
  );
}

// ============================================
// EXAMPLE 2: Custom Initial Limit
// ============================================

export function CountryTableTop5Example() {
  return (
    <div className="container mx-auto p-4">
      {/* Show only top 5 countries initially */}
      <CountryTable initialLimit={5} />
    </div>
  );
}

// ============================================
// EXAMPLE 3: Without Percentage Column
// ============================================

export function CountryTableNoPercentageExample() {
  return (
    <div className="container mx-auto p-4">
      {/* Hide percentage column (useful for mobile or compact layouts) */}
      <CountryTable showPercentage={false} />
    </div>
  );
}

// ============================================
// EXAMPLE 4: Custom Styling
// ============================================

export function CountryTableCustomStyleExample() {
  return (
    <div className="container mx-auto p-4">
      {/* Add custom classes for spacing, width, etc. */}
      <CountryTable
        className="max-w-2xl mx-auto"
        initialLimit={15}
      />
    </div>
  );
}

// ============================================
// EXAMPLE 5: Grid Layout with Other Components
// ============================================

export function CountryTableGridExample() {
  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column - Country Table */}
        <CountryTable initialLimit={10} />

        {/* Right column - Other charts/stats */}
        <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
          <h3 className="text-lg font-semibold mb-4">Other Statistics</h3>
          {/* Add version chart, tier chart, etc. */}
        </div>
      </div>
    </div>
  );
}

// ============================================
// EXAMPLE 6: Full-Width Layout (Stats Page)
// ============================================

export function CountryTableStatsPageExample() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Hero Section */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Network Statistics</h1>
        <p className="text-muted-foreground">
          Real-time distribution of nodes across the globe
        </p>
      </div>

      {/* Country Table - Full width */}
      <CountryTable
        initialLimit={10}
        showPercentage={true}
      />
    </div>
  );
}

// ============================================
// EXAMPLE 7: Responsive Sidebar Layout
// ============================================

export function CountryTableSidebarExample() {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main Content */}
      <div className="flex-1">
        <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
          <h2 className="text-2xl font-bold mb-4">Network Map</h2>
          {/* Map component goes here */}
        </div>
      </div>

      {/* Sidebar with Country Table */}
      <aside className="w-full lg:w-96">
        <CountryTable
          initialLimit={10}
          className="sticky top-4"
        />
      </aside>
    </div>
  );
}

// ============================================
// EXAMPLE 8: Mobile-Optimized Compact View
// ============================================

export function CountryTableMobileExample() {
  return (
    <div className="container mx-auto p-2 sm:p-4">
      {/* Compact view for mobile - no percentage, fewer initial items */}
      <CountryTable
        initialLimit={5}
        showPercentage={false}
        className="shadow-none sm:shadow-lg"
      />
    </div>
  );
}

// ============================================
// KEY FEATURES:
// ============================================
/**
 * 1. Country Flag Emoji Display
 *    - Automatic conversion from ISO country codes
 *    - Fallback to globe emoji for unknown countries
 *
 * 2. Sortable Columns
 *    - Sort by country name (alphabetical)
 *    - Sort by node count (numerical)
 *    - Toggle ascending/descending order
 *
 * 3. Interactive Map Filter
 *    - Click any country to filter the map
 *    - Click again to clear filter
 *    - Visual feedback for selected country
 *
 * 4. Expandable List
 *    - Show top N countries initially
 *    - "Show All" button to expand
 *    - "Show Less" to collapse back
 *
 * 5. Responsive Design
 *    - Mobile-friendly table layout
 *    - Percentage column hidden on small screens
 *    - Horizontal scroll for very narrow screens
 *
 * 6. Visual Enhancements
 *    - Top 3 countries highlighted with ranking badge
 *    - Percentage bars for visual comparison
 *    - Hover effects for better UX
 *    - Semantic colors throughout
 *
 * 7. Loading & Error States
 *    - Skeleton loading animation
 *    - Error message display
 *    - Empty state handling
 *
 * 8. Accessibility
 *    - ARIA labels for flag emojis
 *    - Keyboard navigation support
 *    - Screen reader friendly
 */
