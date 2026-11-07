# Great Outdoors Adventure — controller controls

Connect an Xbox controller, DualShock 4 or DualSense using USB or Bluetooth. Open the game in a browser that exposes it using the standard Gamepad API mapping. Focus the game and press a button to let the browser detect it. Use HTTPS or localhost. Controller support in a browser does not make this a native Xbox or PlayStation console release.

| Action | Xbox | PlayStation |
| --- | --- | --- |
| Start / select menu item | A | Cross |
| Steer | Left stick | Left stick |
| Accelerate | RT | R2 |
| Brake / reverse | LT | L2 |
| Handbrake | A | Cross |
| Nitro | B | Circle |
| Reset to road | X | Square |
| Camera mode | Y | Triangle |
| Look around | Right stick | Right stick |
| Previous / next vehicle | LB / RB | L1 / R1 |
| Deploy / pack camp, while stopped | R3 | R3 |
| Build ramp | D-pad Up | D-pad Up |
| Change ramp kind | D-pad Down | D-pad Down |
| Pause / close current panel | Menu | Options |
| Open / close map | View | Share / Create |
| Menu navigation | D-pad / left stick | D-pad / left stick |
| Back from panel | B | Circle |

On the map, the left stick moves the marker cursor while the map canvas is focused; A / Cross sets a marker. Use the D-pad to reach the clear marker, go to marker and close buttons. In menus, left/right changes sliders and dropdowns; A / Cross activates buttons and camping checkboxes.

Release the triggers, steering and action buttons after closing a menu or reconnecting. A neutral-input gate prevents a held menu button or trigger from immediately affecting driving. Sticks use an 18% dead zone. Disconnecting the active controller or leaving the game window pauses driving.

Keyboard and touch controls remain available. E deploys or packs camp. Open Outfitter for vehicle, weapon, ammunition and camping choices. A controller can reach Outfitter through the pause menu's Expedition outfitter button.

This build adds selectable loadouts and simple campsite props. Named vehicles use the supplied truck or buggy as visual stand-ins, with inherited handling. Camper and trailer entries do not yet have custom interiors or articulated towing. Weapon options are inventory only: shooting, on-foot hunting, animal AI and kill scoring are not present.

Serve the folder using a static web host or local server. The supplied Three.js runtime still loads from mindblown.ai; internet access is required. Physical controller and headset tests must be performed on the intended devices.

Locations: use the Locations button or press L. From a controller, open Menu / Options, choose Locations, then use the D-pad and A / Cross. River Valley and Snowy Mountain each offer Travel and Mark on map. Travel packs the deployed camp and restarts the current lap without leaderboard eligibility. These are destination areas in the existing valley, inspired by the supplied images. Cabins are exterior scenery.

Environment update: the nearby pine forest now uses two LOD2 variants from LOLIPOP’s Sketchfab Pine trees pack, licensed CC BY 4.0. See CREDITS.html for attribution and modifications. Existing distant forest billboards are retained to control rendering cost. Terrain uses multi-scale rotated texture blending, slope-based rock mapping and fine surface relief; snow and water shading and ambient lighting were adjusted. This is a visual upgrade to the prototype, not a reconstruction of the reference photographs.
