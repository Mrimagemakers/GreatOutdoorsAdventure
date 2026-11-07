# Great Outdoors Adventure

A browser driving and wildlife game built with Three.js. Drive Long Valley, River Valley and Snowy Mountain, outfit your expedition, set up camp, and log the wildlife you find in your Field Journal. Includes Xbox/PlayStation standard gamepad support, a VR lookout, and an AR tabletop scene.

**Play:** https://mrimagemakers.github.io/GreatOutdoorsAdventure/ (landing page) · [`/play/`](https://mrimagemakers.github.io/GreatOutdoorsAdventure/play/) (game)

## What's new in this upgrade
- **Wildlife:** white-tailed deer, Rocky Mountain elk, black bears, red foxes, cottontails / snowshoe hares and coyotes. They graze, wander as herds, look up as you approach and run if you come too close. Hares and deer change to winter coats in snow.
- **Field Journal:** keep an animal in view for a moment to log it. Press **J** (or use *Wildlife* in the Adventure Menu) to see your 6 species, sightings and where the nearest one is.
- **Retexture:** every ground surface has its own matching normal map, so grass, dirt, gravel, cliffs, snow and asphalt catch the light. New CC0 dirt and snowy-road textures from Poly Haven.
- **Self-contained:** Three.js is bundled in `play/vendor/`, so the game runs on GitHub Pages without a third-party script host. Field Journal progress is kept in the browser.

## Play locally
Serve this folder with a static web server (for example `python -m http.server 8080`) and open http://localhost:8080. WebXR requires HTTPS or a trusted local origin and compatible hardware/browser.

## Controls and XR
See [play/CONTROLS.md](play/CONTROLS.md) and [play/XR-GUIDE.md](play/XR-GUIDE.md). VR/AR session lifecycle checks and desktop tabletop preview have been tested; physical headset and AR-phone validation is still pending.

## Current scope
Driving, exploration, wildlife observation, inventory selection and camp placement are implemented. Weapon options are inventory concepts; hunting/shooting gameplay is not implemented. Some vehicle options use labeled visual stand-ins pending custom models. Destination reference images illustrate the intended look.

## Files
- `index.html`, `style.css`, `outfitter.css`, `world.js`, `loadout.js` — landing page and concept preview
- `play/` — the game (`game.js` core, `wildlife.js` animals and Field Journal, `locations.js`, `expedition.js`, `xr.js`, controller and UI modules)

## Assets
See [play/CREDITS.html](play/CREDITS.html), [play/asset-lock.json](play/asset-lock.json), and the pine pack attribution under `play/assets/trees/sketchfab`. Third-party assets retain their respective terms. This repository does not grant a new license to supplied template code or artwork.
