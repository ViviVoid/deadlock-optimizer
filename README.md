# Deadlock Optimizer MVP

Static-exported Next.js app for Deadlock theorycrafting with:
- Gun-first calculator table across `Base`, `@Boon`, and `@MaxBoon` including `RoF`
- Searchable hero submenu with image placeholders
- 6x2 built item grid plus embedded shop menu (`Gun`, `Vitality`, `Spirit` with 800/1600/3200/6400 groups)
- Conditional item toggle cell for activation-dependent effects
- Souls mode switch (`Auto from items` or manual entry)
- Local import/export of builds

## Local dev

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run test
npm run build
```

## Sync item cache

Fetches Deadlock item metadata from the Assets API, filters to a local whitelist, and writes cache files for local computation:

```bash
npm run sync:items
```

Generated artifacts:
- `src/lib/data/cache/deadlock_items.csv`
- `src/lib/data/cache/deadlock_items.json`
- `src/lib/data/cache/deadlock_items_report.json`
- Whitelist source: `scripts/item_whitelist.json`

## Deploy (GitHub Pages)

- Ensure default branch is `main`
- Enable GitHub Pages in repository settings with GitHub Actions source
- Push to `main`; workflow publishes the static `out` directory

## Notes

See `docs/modeling.md` for formula assumptions and current gun-only scope.
