# Ledgerly agent rules

## Internationalization

- All Ledgerly-owned user-facing copy belongs in `src/frontend/src/i18n/messages/en.json` and `it.json` and must be rendered through `next-intl`. When touching UI copy, update both catalogs in the same change.
- Keep English (`en`) as the default and fallback locale. Register future locales in `src/frontend/src/i18n/config.ts` and validate the same locale in the backend Settings schema.
- Never localize with component-level locale conditionals or duplicate translated JSX strings.
- Keep user-created and external free text unchanged, including account/category names, symbols, notes, and imported descriptions.
- Presentation formatting must follow the active application locale through `src/frontend/src/lib/format.ts`; API values, ISO dates, stored values, and currency semantics stay locale-independent.
- Any touched localization behavior must retain or add the smallest relevant test for catalog fallback, formatting, persistence, or onboarding.
