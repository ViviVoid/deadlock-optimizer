# Deadlock Optimizer Modeling Notes

## Gun-Only Scope (Current Pass)

This MVP pass is intentionally gun-only. The primary outputs are:
- `FinalPerShotBase`
- `FinalPerShotBoon`
- `FinalDpsBase`
- `FinalDpsBoon`
- `FinalPerShotMaxBoon`
- `FinalDpsMaxBoon`

Bullet velocity is surfaced as `Not Available` until dataset support is added.

## Weapon Formula Buckets

`FinalPerShot = (((BulletDamage + FlatBaseDamage) * WeaponDamageMultiplier) + FlatWeaponDamage) * DamageAmplification * PelletCount`

`FinalDps = FinalPerShot * SustainedBulletsPerSecond`

Where:
- `WeaponDamageMultiplier = 1 + totalWeaponDamagePct`
- `SustainedBulletsPerSecond` uses base RoF and optionally includes reload cycle.
- Boons are resolved by soul-count breakpoints and clamped at each hero's `bulletDamageMaxBoon`.
- If soul mode is `autoFromItems`, soul count is derived from currently built items only.
- Conditional item effects are only applied when their UI toggle is active.

## Shop Modeling Notes

- Current shop UI is grouped by category (`gun`, `vitality`, `spirit`) and tier (`800`, `1600`, `3200`, `6400`).
- `legendary` bucket entries from cache are intentionally excluded in this pass.
- Upgrade replacement rule is enforced in build state: when upgrading, predecessor is removed from the build list.

## Item Attribution

- **Marginal**: remove item from full build.
- **Order-averaged**: sample many insertion orders to reduce interaction bias.

## Known Limitations and Next Ingestion Step

- Item dataset is representative and should be expanded with scripted sheet/wiki ingestion.
- Ammo/reload values are seeded placeholders for roster-wide UI continuity; replace with sheet-driven truth data.
- Ability and guardrail modeling is intentionally deferred from this gun-only pass.
- Cache ingestion is treated as an input source with normalization before app contracts; it is not a runtime dependency.
