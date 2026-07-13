# DinoMaker Version History

## v1.7.0 - Rigid skull and isolated tail motion

- Snapshot: `versions/DinoMaker_v1.7.0.zip`
- Lengthened the torso by 1.35 times.
- Replaced the layered tail-root fillers with one continuous tapered base and
  revised the root weights to remove both surface clutter and motion pinching.
- Prioritized leg and jaw spatial regions before tail weighting so tail swing
  cannot pull the legs and an open jaw cannot inherit foot motion.
- Applied rigid head and jaw bone weights so both boxes preserve their shapes
  during Roar while their teeth remain attached to the corresponding bones.
- Increased upper-head side thickness by 1.2 times while preserving exact
  head-to-neck top alignment.

## v1.6.0 - Expressive roar and close inspection

- Snapshot: `versions/DinoMaker_v1.6.0.zip`
- Increased upper-head height by 1.2 times and reduced lower-jaw thickness to
  0.8 times its v1.5.0 value.
- Expanded Roar with an upward upper-head rotation and a stronger opposing jaw
  rotation while keeping both tooth rows attached to their bones.
- Filled the torso-to-tail transition with overlapping organic volumes to
  remove concave pinching.
- Removed voxel-only center mouth and gum bridges that produced a flat plate
  between the two head boxes.
- Enabled close camera zoom while retaining the expanded clipping range.

## v1.5.0 - Rigid jaw rotation and roar motion

- Snapshot: `versions/DinoMaker_v1.5.0.zip`
- Added tapered ankle-to-instep bridges that inherit both leg and foot mass,
  preventing thin connections across mismatched slider values.
- Matched the lower jaw length to the complete upper head box.
- Replaced the jaw's approximate downward projection with rigid rotation around
  its anatomical hinge.
- Added a mutually exclusive Roar animation beside Play Walk, with jaw, head,
  neck, chest, arm, and tail movement.
- Extended geometry validation to cover both ankle bridges and jaw length.

## v1.4.0 - Balanced limbs and two-box skull

- Snapshot: `versions/DinoMaker_v1.4.0.zip`
- Set hind-leg and foot mass to 1.2 times the v1.2.0 proportions.
- Set arm thickness to 0.8 times the v1.2.0 proportions.
- Rebuilt the skull as two rounded boxes: one upper head and one substantial,
  articulated lower jaw.
- Aligned the upper head surface with the generated top of the neck.
- Restored a clearly visible inset upper tooth row.
- Added an Auto Rotate on/off button while preserving manual camera control.

## v1.3.0 - Three-volume head and refined proportions

- Snapshot: `versions/DinoMaker_v1.3.0.zip`
- Lengthened the head by 1.5 times while keeping its rear transition attached
  to the neck.
- Rebuilt the head from a rounded rear cranium, upper snout, and lower jaw.
- Increased the full hind-leg thickness by 1.5 times and reduced arm thickness
  to 0.6 times its previous size.
- Replaced the black nostril dots with genuine subtractive nostril recesses.
- Moved both tooth rows inward so their roots sit inside the jaws.
- Added geometry validation for the head front, eye sockets, and nostril
  recesses across the editable parameter range.

## v1.2.0 - Extended tail and recessed eyes

- Snapshot: `versions/DinoMaker_v1.2.0.zip`
- Lengthened the tail by about 1.6 times and sharpened its terminal taper.
- Increased neck thickness by 1.5 times while preserving its body transitions.
- Added genuine subtractive eye recesses to the generated body surface.
- Positioned the eyes at one quarter of the head-box length from its rear edge.
- Added axis-aware smooth remeshing so the longer tail does not reduce the
  resolution of the legs, neck, or eye sockets.
- Kept voxel box size independent of the extended tail length.
- Extended runtime validation to check both eye recesses and the pointed tail.

## v1.1.0 - Connected anatomy and stable framing

- Snapshot: `versions/DinoMaker_v1.1.0.zip`
- Added deep hip sockets and thicker upper-leg bridges for the smooth mesh.
- Rebuilt the tail root as two overlapping cone volumes for a gradual taper.
- Lengthened the cube-based head and extended the jaw details with it.
- Replaced stretched eyes with true spherical eyes and spherical pupils.
- Added stable, rotation-independent camera framing and extra head-field margin.
- Lengthened toe and finger claws so their tips remain visible.
- Added runtime connection checks for both hips, tail, neck, and head front.

## v1.0.0 - Preserved baseline

- Snapshot: `versions/DinoMaker_v1.0.0.zip`
- This archive contains the complete web source and public assets immediately
  before the v1.1.0 anatomy and camera changes.

## Versioning rule

Before each future modification, archive the complete current web project in
`versions/DinoMaker_vX.Y.Z.zip`, then increase the package version for the new
working version and add a short entry here.
