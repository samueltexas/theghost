# Approved theghost visual — implementation notes

The public landing and Command Center reproduce the **approved cinematic concept** as responsive React/CSS layouts. The hooded logo, hero illustration and Earth art are derived from the two user-approved reference renders (not generic library icon substitutions).

Brand: `theghost`, SEE THE UNSEEN. Palette: Ghost Black `#050B13`, Midnight Navy `#0B1828`, Spectral Cyan `#00D5F5`, Phantom Gold `#E6B65A`, Ice White `#F2F7FC`.

Files: `apps/web/public/theghost-mark.png` (hooded mark), `favicon.png`, `favicon.ico`, `apple-touch-icon.png`, `cinematic-hero.webp`, `command-earth.webp`. App: `apps/web/src/App.tsx`, styles: `apps/web/src/style.css`.

The visual mockup included illustrative numerical KPIs. This implementation deliberately uses engine-backed synthetic counts, or displays `Not computed`/`Not rated` rather than making unsupported risk claims. Remaining modules retain their previous functional/prototype status.

No existing project data, databases, or Git repositories should be overwritten. Deploy this version in a separate directory for comparison.
