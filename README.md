# WFC Hex Crawl Generator

A React web app for running overland hex crawls in OSR-style tabletop RPGs. The overland map
is generated with Wave Function Collapse, so coasts, rivers and roads join up across hexes.
Clicking into a hex opens its terrain, danger, encounter rollers and generated sites
(dungeons, settlements, towers, keeps, camps, shrines and rifts), each with its own map.

**Status:** early development. This repo is currently a fork of the OSR Hex Crawl Generator
(the hex detail and site generators). The WFC overland map is being added. See
[`docs/PLAN.md`](docs/PLAN.md) for the design and milestones.

## Getting started

Requires Node 20.16.0 (see `.nvmrc`).

```bash
nvm use
npm install
npm run dev        # http://localhost:5173
```

Other commands:

```bash
npm run test       # run the Vitest suite
npm run build      # typecheck and build for production
npx tsc -b         # typecheck only
npm run sim -- --seeds 10   # generate worlds and report terrain statistics (for tuning)
```

## License

Copyright (c) 2026 Ryan David Hartman.

This project — its source code, generated content tables and documentation — is licensed under
the [Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/)
(CC BY-SA 4.0). The full legal text is in [`LICENSE`](LICENSE).

CC BY-SA 4.0 is the license of the *Basic Fantasy Role-Playing Game* 4th Edition, so material
adapted from Basic Fantasy RPG can be included here and this project's own material can be
reused in Basic Fantasy-compatible works, provided attribution is given and adaptations are
shared under the same license.

### Attribution

Portions of the equipment, services and tavern price tables are adapted from the *Basic Fantasy
RPG Equipment Emporium*, © Chris Gonnerman and contributors, Basic Fantasy Role-Playing Game
project (https://www.basicfantasy.org), used under CC BY-SA 4.0.

Portions of the monster encounter tables (dungeon and wilderness), encounter frequency and
purpose, treasure types and treasure tables, traps, tricks, dungeon dressing, castle encounters,
urban encounters and NPCs, settlement government and civic amenities, and monster treasure-type
assignments are adapted from the *Basic Fantasy Role-Playing Game Core Rules* and *The Basic
Fantasy Field Guide*, © Chris Gonnerman and contributors, Basic Fantasy Role-Playing Game
project (https://www.basicfantasy.org), used under CC BY-SA 4.0. Changes: tables were
transcribed into code, some were condensed or combined, a few selector dice were added where
the source gives none (noted in each file's header comment), and some sub-tables were omitted.

The procedural map generation is adapted from
[hex-map-wfc](https://github.com/felixturner/hex-map-wfc), © 2026 Felix Turner, used under
the MIT License. Files ported from it keep the MIT notice in their header.

The 3D map's renderer (`src/render3d/`) is also adapted from hex-map-wfc, under the same MIT
License. Its assets in `public/assets/` come from hex-map-wfc's repository:

- `models/hex-terrain.glb`: tile models from the
  [KayKit Medieval Hexagon Pack](https://kaylousberg.itch.io/kaykit-medieval-hexagon) by Kay
  Lousberg (CC0), with additional tiles (sloping rivers, river ends, river-to-coast and cliff
  variants) by Felix Turner (MIT).
- `textures/moody.png`, `textures/winter.png`: palette textures by Felix Turner (MIT).
- `hdr/venice_sunset_1k.hdr`: the "Venice Sunset" HDRI from [Poly Haven](https://polyhaven.com)
  (CC0).
