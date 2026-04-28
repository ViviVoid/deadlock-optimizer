# Deadlock Optimizer Modeling Notes

## Guardrailed Outputs

The app exposes both:
- `RawDPS`: high-theory output under lighter constraints.
- `GuardrailedDPS`: practical sustained output that models animation, LOS, and observed DoT behavior.

## Weapon Formula Buckets

`FinalDamage = ((BaseDamage * WeaponDamageMultiplier) + FlatBonus) * Falloff * Resistances * CritMultiplier * DamageAmplification`

- `FlatBonus` is intentionally applied after weapon multiplier.
- `DamageAmplification` is an experimental terminal bucket in MVP.

## Economy Search

- Optimizer searches the active item catalog, not inventory pieces.
- Costs are adjusted by upgrade lineage (`upgradesFrom`) to represent in-match discounting.
- Objective can target sustained DPS, burst, or EHP.

## Item Attribution

- **Marginal**: remove item from full build.
- **Order-averaged**: sample many insertion orders to reduce interaction bias.

## Known Limitations

- Item dataset is representative and should be expanded via script + manual patch overlays.
- Hero ability metadata for uptime/DoT cadence is incomplete and designed for iterative refinement.
