# Leaf simulation artwork — replacement tracker

Current placement: Plan My C-Day → Plan a New C-Day → Choose a C-Day.
These are decorative menu illustrations only. Replacing artwork must not change event IDs, planning behavior, educational content, saved plans, or other modules.

| Simulation | Current illustration | Asset |
| --- | --- | --- |
| Dinner With Friends | Leaf and two buddies raising water/juice glasses | leaf-dinner-v1.png |
| School Trip / School Event | Backpack; cleaned stem and removed extra protrusion | leaf-school-v1.png |
| Travel | Rolling suitcase | leaf-travel-v1.png |
| Party / Celebration | Party hat, raised arms | leaf-party-v1.png |
| Friend’s House | Welcoming wave and house keyring | leaf-friends-house-v1.png |
| Sports / Team Event | Soccer ball | leaf-sports-v1.png |

Assets: assets/images/simulations/. Central mapping: src/lib/simulation-artwork.ts.
Original character reference: assets/images/leaf.png. Custom C-Day keeps the original Leaf.

## Prompts Nora can use later

- “Replace only the Dinner With Friends Leaf illustration with Leaf and two buddies toasting. Keep the original character style and the menu layout.”
- “Refine the School Leaf backpack/stem area. Keep the face and pose the same.”
- “Change Travel Leaf to [describe the new pose or prop]. Keep the other five images.”
- “Change Party Leaf to [describe the new pose].”
- “Change Friend’s House Leaf to [describe the shared moment].”
- “Change Sports Leaf from soccer to [sport or prop].”
- “Use this attached image for [simulation] and preserve the previous version so we can switch back.”
- “Make all six Leaf illustrations slightly [larger/smaller] without reducing label text size.”
- “Restore the previous version of [simulation] Leaf.”

## Instructions for future updates

Add each requested change and its date to this file. Save new artwork as v2, v3, etc.; update the central mapping rather than overwrite earlier versions. Preserve true alpha transparency and verify no checkerboard is baked in. Check the entire silhouette and props at menu size. Keep labels readable and the full card tappable. Reload the development app and inspect all six cards; a native rebuild is not needed for image-only changes.

## Change log

- 2026-09-13: Initial six poses approved for menu integration; Dinner changed to buddies toasting; School stem refined. Background extraction performed for opaque preview exports. Phone layout review pending.

Generation: built-in image generation/editing tool. Initial prompt direction: preserve original Leaf identity, green leaf body, diagonal vein, highlighted black eyes, pink cheeks and smile; simple friendly pose with the listed prop, full silhouette, no text, transparent background. Dinner refinement: three leaf buddies raising water/juice tumblers. School refinement: smooth one lower-left stem and remove spurious right-side green protrusion. Export cleanup: remove checkerboard only and preserve character artwork.

Export note: Dinner uses a solid card-matched #E8F0DF background after transparent exports repeatedly introduced checkerboard/glow artifacts. Other five use alpha transparency. If changing the menu background, re-export Dinner to match or supply a clean transparent replacement. The approved original dinner preview remains in the generation archive; the final background-only edit used the original preview as reference.
