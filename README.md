# Deadlock Optimizer MVP

Static-exported Next.js app for Deadlock theorycrafting with:
- Gun damage calculator (`per bullet`, `raw DPS`, `guardrailed DPS`)
- Budget-constrained shop optimizer (800/1600/3200/6400 + upgrade discounts)
- Item contribution isolation (`marginal` + `order-averaged`)
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

## Deploy (GitHub Pages)

- Ensure default branch is `main`
- Enable GitHub Pages in repository settings with GitHub Actions source
- Push to `main`; workflow publishes the static `out` directory

## Notes

See `docs/modeling.md` for formula assumptions and guardrails.
