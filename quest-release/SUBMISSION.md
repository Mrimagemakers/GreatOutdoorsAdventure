# Great Outdoors Adventure — Meta Horizon Store working draft

## Listing copy

Drive into the backcountry and look for wildlife as you explore a 3D wilderness.

Publisher: PenGame Publishing. Proposed Android package: `com.pengamepublishing.greatoutdoors`. Check for an existing dashboard record or signing identity before assigning this identifier.

## Device testing record

PenGame Publishing confirms this game was tested on a Meta Quest 3. The tested build identifier, launch method, and individual test results were not supplied. Record those details when available so the release team can carry applicable results forward.

## Headset acceptance and capture

Launch directly into play, choose a vehicle, steer on a trail, and pause. Capture driving and wildlife. Inventory hunting content for the rating questionnaire. Record the build, Quest model, controller type, observed frame rate and any comfort issues. Test system-menu suspend/resume, controller reconnection, loss of network and relaunch. Verify all interactions without a keyboard. Set supported headsets and comfort rating from device results.

## Build and distribution

After merging and verifying the published manifest, run:

```sh
bubblewrap init --manifest=https://mrimagemakers.github.io/GreatOutdoorsAdventure/manifest.webmanifest --metaquest
bubblewrap build
```

Verify the start URL opens play/index.html. Select immersive mode only if the installed package starts an immersive WebXR session. Confirm the release signing certificate and configure Digital Asset Links at the host root, https://mrimagemakers.github.io/.well-known/assetlinks.json, preserving entries for other packages. Keep signing credentials outside Git. Sideload the signed APK and run the acceptance checks. Capture original gameplay for the listing. Confirm asset and audio licenses, privacy disclosures, target ages, content rating and data use before upload. For a Game Pass release, verify the first-level boundary and decide the approved Horizon purchase and entitlement flow before advertising paid levels. Website Stripe integration alone does not establish Quest billing support.

Upload the tested package to an internal release channel before store review. Release signing, verification of the signed package, dashboard declarations and submission are pending.

[Meta packaging guide](https://developers.meta.com/vr/documentation/web/pwa-overview/) · [Meta submission](https://developers.meta.com/vr/resources/publish-submit/)
