# Great Outdoors Adventure — controller controls

Connect an Xbox controller, DualShock 4 or DualSense using USB or Bluetooth, then press any button so the browser detects it. A message confirms whether it is an Xbox or PlayStation controller, and the on-screen prompts switch to that pad's buttons (A / ✕, Y / △ and so on). Chrome, Edge and Safari report these pads in the standard layout; when a browser reports a raw layout (Firefox, some Bluetooth PlayStation pads, Xbox pads on Linux), the game translates it so the same buttons do the same things. Pads that support it rumble when you fire or get hurt. Use HTTPS or localhost. Controller support in a browser does not make this a native Xbox or PlayStation console release.

| Action | Xbox | PlayStation |
| --- | --- | --- |
| Start / select menu item | A | Cross |
| Steer | Left stick | Left stick |
| Accelerate | RT | R2 |
| Brake / reverse | LT | L2 |
| Handbrake | A | Cross |
| Nitro | B | Circle |
| Reset to road | X | Square |
| Camera mode | D-pad Right | D-pad Right |
| Step out (when stopped) | Y | Triangle |
| Look around | Right stick | Right stick |
| Previous / next vehicle | LB / RB | L1 / R1 |
| Deploy / pack camp, while stopped | R3 | R3 |
| Build ramp | D-pad Up | D-pad Up |
| Change ramp kind | D-pad Down | D-pad Down |
| Pause / close current panel | Menu | Options |
| Open / close map | View | Share / Create |
| Menu navigation | D-pad / left stick | D-pad / left stick |
| Back from panel | B | Circle |
| Step out of / into the vehicle | Y or D-pad Left | Triangle or D-pad Left |

On the map, the left stick moves the marker cursor while the map canvas is focused; A / Cross sets a marker. Use the D-pad to reach the clear marker, go to marker and close buttons. In menus, left/right changes sliders and dropdowns; A / Cross activates buttons and camping checkboxes.

Release the triggers, steering and action buttons after closing a menu or reconnecting. A neutral-input gate prevents a held menu button or trigger from immediately affecting driving. Sticks use an 18% dead zone. Disconnecting the active controller or leaving the game window pauses driving.

Keyboard and touch controls remain available. E deploys or packs camp. Open Outfitter for vehicle, weapon, ammunition and camping choices. A controller can reach Outfitter through the pause menu's Expedition outfitter button.

This build adds selectable loadouts and simple campsite props. Named vehicles use the supplied truck or buggy as visual stand-ins, with inherited handling. Camper and trailer entries do not yet have custom interiors or articulated towing. Your outfitter weapon is what you carry on foot. See the on-foot, hunting, camping, fishing and Survival sections below.

Serve the folder using a static web host or local server. Three.js is bundled in vendor/, so the game itself no longer depends on mindblown.ai; the landing page preview still loads Three.js from jsDelivr. Physical controller and headset tests must be performed on the intended devices.

Locations: use the Locations button or press L. From a controller, open Menu / Options, choose Locations, then use the D-pad and A / Cross. River Valley and Snowy Mountain each offer Travel and Mark on map. Travel packs the deployed camp and restarts the current lap without leaderboard eligibility. These are destination areas in the existing valley, inspired by the supplied images. Cabins are exterior scenery.

Environment update: the nearby pine forest now uses two LOD2 variants from LOLIPOP’s Sketchfab Pine trees pack, licensed CC BY 4.0. See CREDITS.html for attribution and modifications. Existing distant forest billboards are retained to control rendering cost. Terrain uses multi-scale rotated texture blending, slope-based rock mapping and fine surface relief; snow and water shading and ambient lighting were adjusted. This is a visual upgrade to the prototype, not a reconstruction of the reference photographs.

Wildlife: deer, elk, black bears, red foxes, hares and coyotes live around Long Valley, River Valley and Snowy Mountain. They graze and wander, look up when a vehicle approaches and run if it comes close; the faster you drive, the earlier they bolt. Keep an animal in view for about a second to log it in the Field Journal. Open the journal with J, the Wildlife button in the Adventure Menu, or from a controller via Menu / Options → Adventure Menu; B / Circle closes it. Each species card shows sightings, closest distance and the direction of the nearest animal. The journal is saved in this browser only.

Retexture: ground and roads now use a matching normal map per surface (grass, dry grass, dirt, gravel, rock, snow, asphalt, snowy asphalt), blended with the same weights as the colours; cliffs use triplanar rock normals. Dirt and snowy-road textures are Poly Haven CC0 sets. See CREDITS.html.

## Phones and tablets

The touch buttons appear automatically on phones and tablets (Settings › Touch can force them on or off, and make them smaller or larger). Landscape works best.

**Driving.** Put your left thumb on the **steering pad** and slide it left or right: the further you slide, the harder you steer, and it centres when you let go. Hold the tall **GAS** pedal to drive and **BRAKE** to slow down (hold it when stopped to reverse). Tap **OUT** when stopped to walk. Settings › Touch › Touch steering switches to **arrow buttons** or **tilt** (hold the phone sideways like a wheel; tap **TILT** to centre it — iPhones ask for motion access on the first tap). Drift, Nitro and Ramp buttons can be turned on from the Menu.

**On foot.** Touch anywhere on the left side and drag: a thumbstick appears under your thumb. Push it to the edge to sprint. Drag anywhere on the right side to look around. **FIRE** fires, casts or swings (and you can slide your thumb on it to keep tracking an animal). **AIM** toggles aiming and the scope. **USE** appears when there is something to do (tag, cook, talk, gather, drive) and shows what it will do. **⟳** reloads, **⇄** switches item and **CAR** gets back in the vehicle.

## On foot

Stop and press **F** (controller: **Y / Triangle** or **D-pad Left**; phone: **OUT**) to step out as your chosen character. Press F again (or Y / Triangle, or A / Cross on the Drive prompt; phone: **CAR** or **USE**) beside the vehicle to drive.

| Action | Keyboard & mouse | Xbox | PlayStation |
| --- | --- | --- | --- |
| Move / sprint | WASD or arrows / Shift | Left stick / L3 | Left stick / L3 |
| Look | Mouse (click the game to capture it); arrows turn | Right stick | Right stick |
| Aim (scope on scoped weapons) | Right mouse, or Q to toggle | LT | L2 |
| Fire / cast / reel | Left mouse or Space (hold to reel) | RT | R2 |
| Reload | R | X | Square |
| Interact (tag, cook, talk, open, gather, fill…) | E | A | Cross |
| Switch weapon / rod / hatchet / knife | Tab, mouse wheel or 1–6 | LB / RB | L1 / R1 |
| Quick knife or hatchet swing | — | B | Circle |
| Adventure panel | G | D-pad Up | D-pad Up |
| Eat or drink | H | — | — |
| Back to the vehicle | F | Y or D-pad Left | Triangle or D-pad Left |

## Hunting
Walk slowly and animals let you close; running or driving gives you away. A gunshot sends everything nearby running. Chest and head hits count as vital. A downed animal lies on its side: walk up and press E to tag it. Tagging logs the harvest (with weight) in the Field Journal and gives meat for camp; a new animal appears out of sight later. A wounded bear may charge, so shoot or use your knife (left click) to drive it off. Weapons differ in range, spread, magazine, reload and zoom; shotgun slugs reach further than shot. Restock ammunition at your camp's supply box.

## Camping
Deploy camp with E (from the vehicle, or on foot with E where nothing else is nearby). Camp now has a campfire: cook meat or fish there (E), then eat (E or H) for health and a sprint boost. Rest in the tent until morning or golden hour, restock ammunition at the supply box, and talk to your companions. Choose your character and up to two camp companions in **Adventure** (G).

## Fishing
Switch to the rod, face a river or lake and click to cast. When the bobber dips, click within a second to set the hook, then hold to reel. Watch the tension bar: let go when it turns red or the line snaps. River, lake and alpine water hold different species. Catches go to your creel (cook them at a fire) and the journal's catch log. **Fishing mode** (Adventure → Fishing) starts you on the River Valley bank with the rod ready.

## Survival mode
Adventure → Survival. Your truck has broken down; rescue arrives after the third night (a day lasts 10 minutes). You start with a knife and a trail map: the map (M) and the compass strip mark six supply caches with a compass and canteen, fire kit and hatchet, tent, rifle, shotgun and rod, revolver and food. Keep hunger, thirst and warmth up: fill the canteen at water (E) and drink with H, gather deadfall (E, more with the hatchet), build a fire with three wood and the fire kit, add wood to keep it burning, cook game and fish, pick berries, pitch your tent and sleep in it at golden hour or night. Bears will charge you, and coyotes hunt after dark. If health runs out you can try again; your longest survival is kept in the journal.
