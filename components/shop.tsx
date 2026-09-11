'use client';
import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { Product } from '@/lib/types';
import { money, unitPrice } from '@/lib/types';
import { ProductCard } from './product-card';
type Filters = {
  sizes: string[];
  colors: string[];
  categories: string[];
  available: boolean;
  maxPrice: number;
};
export function Shop({
  products,
  initialSort = 'featured',
  initialSearch = '',
  focusSearch = false,
}: {
  products: Product[];
  initialSort?: string;
  initialSearch?: string;
  focusSearch?: boolean;
}) {
  const highest = Math.max(25000, ...products.map((p) => p.price_cents));
  const [filters, setFilters] = useState<Filters>({
    sizes: [],
    colors: [],
    categories: [],
    available: false,
    maxPrice: highest,
  });
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState(initialSort);
  const [open, setOpen] = useState(false);
  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'].filter((s) =>
    products.some((p) => p.product_variants.some((v) => v.size === s)),
  );
  const colors = [
    ...new Set(products.flatMap((p) => p.product_variants.map((v) => v.color))),
  ].sort();
  const categories = [...new Set(products.map((p) => p.category))].sort();
  const filtered = useMemo(
    () =>
      products
        .filter((p) => {
          const matchesVariant = p.product_variants.some(
            (v) =>
              v.active &&
              (!filters.sizes.length || filters.sizes.includes(v.size)) &&
              (!filters.colors.length || filters.colors.includes(v.color)) &&
              (!filters.available || v.inventory_quantity > 0) &&
              unitPrice(p, v) <= filters.maxPrice,
          );
          return (
            matchesVariant &&
            (!filters.categories.length || filters.categories.includes(p.category)) &&
            `${p.name} ${p.description} ${p.category}`
              .toLowerCase()
              .includes(search.toLowerCase().trim())
          );
        })
        .sort((a, b) =>
          sort === 'price-asc'
            ? unitPrice(a) - unitPrice(b)
            : sort === 'price-desc'
              ? unitPrice(b) - unitPrice(a)
              : sort === 'newest'
                ? b.created_at.localeCompare(a.created_at)
                : Number(b.featured) - Number(a.featured) ||
                  b.created_at.localeCompare(a.created_at),
        ),
    [products, filters, search, sort],
  );
  const toggle = (key: 'sizes' | 'colors' | 'categories', value: string) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));
  const reset = () => {
    setFilters({ sizes: [], colors: [], categories: [], available: false, maxPrice: highest });
    setSearch('');
  };
  return (
    <div className="shop-layout">
      <aside>
        <button
          className="button button-secondary desktop-hide w-full"
          aria-expanded={open}
          aria-controls="shop-filters"
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal size={15} />
          Filters
        </button>
        <div id="shop-filters" className={`filters ${open ? 'mobile-open' : ''}`}>
          <div className="shop-search mt-6">
            <Search size={16} />
            <label htmlFor="search" className="sr-only">
              Search the collection
            </label>
            <input
              id="search"
              autoFocus={focusSearch}
              placeholder="Find your favorite…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={100}
            />
            {search && (
              <button
                className="icon-button"
                aria-label="Clear search"
                onClick={() => setSearch('')}
              >
                <X size={13} />
              </button>
            )}
          </div>
          {(
            [
              { label: 'Category', key: 'categories', values: categories },
              { label: 'Size', key: 'sizes', values: sizes },
              { label: 'Color', key: 'colors', values: colors },
            ] as const
          ).map((group) => (
            <fieldset className="filter-group border-x-0 border-t-0" key={group.key}>
              <legend className="text-xs font-semibold pt-5">{group.label}</legend>
              {group.values.map((value) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={filters[group.key].includes(value)}
                    onChange={() => toggle(group.key, value)}
                  />
                  {value}
                </label>
              ))}
            </fieldset>
          ))}
          <fieldset className="filter-group border-x-0 border-t-0">
            <legend className="text-xs font-semibold pt-5">Availability</legend>
            <label>
              <input
                type="checkbox"
                checked={filters.available}
                onChange={(e) => setFilters((f) => ({ ...f, available: e.target.checked }))}
              />
              In stock only
            </label>
          </fieldset>
          <div className="filter-group">
            <label htmlFor="price-range">Price · up to {money(filters.maxPrice)}</label>
            <input
              className="w-full accent-[#5d6752]"
              id="price-range"
              type="range"
              min="0"
              max={highest}
              step="100"
              value={filters.maxPrice}
              onChange={(e) => setFilters((f) => ({ ...f, maxPrice: Number(e.target.value) }))}
            />
          </div>
          <button className="text-xs underline mt-5" onClick={reset}>
            Clear all filters
          </button>
        </div>
      </aside>
      <div>
        <div className="shop-toolbar">
          <span aria-live="polite">
            {filtered.length} considered {filtered.length === 1 ? 'essential' : 'essentials'}
          </span>
          <label>
            Sort by{' '}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort products"
            >
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </label>
        </div>
        <div className="product-grid">
          {filtered.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 2} />
          ))}
          {!filtered.length && (
            <div className="empty-state">
              <h2>A fresh start?</h2>
              <p className="muted text-sm">No knits match these filters just yet.</p>
              <button className="button button-secondary" onClick={reset}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
