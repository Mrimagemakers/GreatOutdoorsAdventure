# VR and AR

Open the game over HTTPS (the published site) or localhost. Choose **VR / AR** from the game toolbar or pause menu.

## VR lookout

Connect a headset and use a browser that supports immersive WebXR VR. Choose **Enter VR** and allow the browser's session request.

- Head tracking lets you look around the full-size landscape beside the parked vehicle.
- Point a tracked controller at the floating menu and press its trigger to select River Valley, Snowy Mountain, a snap turn, or Exit VR.
- The controller's horizontal stick snaps the view by 30 degrees. A controller grip/squeeze also exits. Your device's system exit control remains available.
- Driving and lap timing are paused. This is a stationary viewing mode; it does not add immersive driving, hunting or on-foot locomotion.

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

Browser checks covered support detection, unavailable-device messaging, tabletop rendering, rotation/size controls, and returning to the game. Immersive headset tracking, tracked-controller rays, camera passthrough and real-surface placement require testing on physical XR hardware and have not been hardware-certified.
