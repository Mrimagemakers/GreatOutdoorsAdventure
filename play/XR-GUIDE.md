# VR and AR

Open the game over HTTPS (the published site) or localhost. Choose **VR / AR** from the game toolbar or pause menu.

## VR with an Xbox or PlayStation controller

Pair an Xbox or PlayStation controller with your headset (Quest: Settings › Devices › Bluetooth) or your VR PC, then press any button once you're in VR. A message confirms it. You can keep using the headset controllers as well.

- **Menu:** Menu / Options opens and closes the VR menu. Look at a button (a small dot marks the centre of your view) and press A / ✕.
- **Driving:** RT / R2 is gas and LT / L2 is brake. The left stick steers. A / ✕ is the handbrake and B / ○ is nitro. X / □ puts the vehicle back on the road, and Y / △ steps out when you're stopped. D-pad Right switches between the driver seat and the chase view, and View / Share recentres the seat.
- **On foot:** the left stick walks (click it to sprint) and the right stick turns. You aim where you look, and RT / R2 fires. A / ✕ interacts, X / □ reloads, LB / RB switches items, B / ○ swings the knife or hatchet, and Y / △ gets into the truck.
- **Display:** your item is held in front of you, and the speed and ammo display moves to the bottom of your view. The controller rumbles when you fire.

## VR: drive, walk and hunt

**Comfort.** The VR menu (B) has two switches, remembered on your headset: **Turning** (snap 30° or smooth) and **Comfort vignette**, which darkens the edges of your view while you walk, turn or swerve to reduce motion sickness. It is on by default.

Connect a headset and use a browser that supports immersive WebXR VR. Choose **Enter VR**. Point a controller at the floating menu and pull the trigger to choose a mode; **B / Y** shows or hides the menu.

- **Drive · chase view** follows behind the vehicle. **Drive · driver seat** puts you in the cab; click the right stick to recentre. Right trigger gas, left trigger brake (or push the right stick forward and back), either stick steers, right grip handbrake, A nitro, X reset to the road, **Y steps out** when stopped. A wrist display on the left controller shows speed and controls.
- **Walk & hunt on foot**: left stick walks where you look (click it to sprint), right stick turns (snap 30° by default, or smooth), right trigger fires (or casts and reels with the rod), A interacts (tag, cook, open caches, fill canteen…) and **gets in the truck** at the Drive prompt, X reloads, Y switches weapon / rod / hatchet / knife, B opens the menu. Your weapon is held in your right hand; the wrist display shows ammunition, health, Survival needs and the current prompt.
- **Lookout (paused)** is the original stationary viewpoint; River Valley and Snowy Mountain jump there.

## Hunt in augmented reality

Choose **Hunt in AR** on a phone or headset that supports immersive AR. Move slowly until the gold ring appears on the floor and tap (or pull the trigger) to release a deer, elk, fox, hare, coyote and bear around that spot. Tap the screen to fire at the crosshair (headsets fire along the controller). Animals wander, notice you when you get close, scatter at a shot and lie down when harvested, and new ones replace them. **Smaller / Larger / Life size** change their scale. Uses your outfitter weapon. Squeeze or Exit to finish.

## AR tabletop

Use a device and browser that support immersive WebXR AR. Choose **Enter AR** and allow the browser's session request. Camera passthrough is supplied by the XR browser; the game does not record or upload camera footage.

- Move the device slowly until a gold placement ring appears on a detected surface, then tap to place the miniature.
- The miniature contains a 128-metre section around the current location, roads, trees, the selected vehicle, and your packed camping items. Terrain height is compressed for tabletop readability.
- Use Rotate and Size where screen overlays are supported. Tap another surface to reposition. **Place ahead** provides manual placement when surface detection is unavailable or cannot find a surface.
- Use Exit, a controller grip, or the device's native XR exit control to leave AR. When a browser lacks DOM overlay support, its system controls remain the way to exit.

## Desktop tabletop preview

Choose **Preview tabletop** even if VR and AR are unavailable. Drag to rotate, or use the rotation and size controls. Exit returns to the paused game. Escape also exits. Xbox/PlayStation controller menu navigation can select the preview controls; B/Circle or Menu/Options returns from the preview.

## Compatibility and validation

VR and AR entry buttons are enabled only after the browser reports support for the corresponding session type. Secure contexts, device capabilities, browser implementation and permissions determine availability. This is WebXR support, not a native console or app-store build.

Browser checks covered support detection, unavailable-device messaging, tabletop rendering, rotation/size controls, and returning to the game. VR driving, VR walking and firing, and AR hunting (placement, spawning and controller shots) were exercised in the Immersive Web Emulation Runtime with an emulated Meta Quest 3. Physical headset comfort, real controller feel, phone camera passthrough and real-surface hit testing still need checking on actual hardware.
