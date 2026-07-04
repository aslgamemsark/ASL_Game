"""Headless Blender script (Phase 2A, revised): imports a Galt-archive Mixamo FBX, fixes the bone
namespace only ("mixamorig1:" -> "mixamorig:" where needed), and exports a baked-animation GLB —
WITHOUT touching the rig hierarchy. Two earlier attempts to delete/reparent "Locator_Root" (the
archive's 90deg corrective root bone) in Blender produced identical wrong output both times,
regardless of the edit — traced to the fact that Blender's glTF exporter writes each bone's
animated rotation channel as a delta relative to THAT BONE'S OWN REST, and rest-pose edits in Edit
Mode don't retroactively change what gets exported for existing animation data the way a naive
"fix the hierarchy" approach assumes. The correct fix is a per-bone rest-to-rest retarget done in
TypeScript (retargetGaltClip.ts), not a Blender-side hierarchy edit — so this script now keeps
Locator_Root and the original hierarchy completely intact; the TS side reads its rest transform
directly from this GLB's node data and corrects for it mathematically.

Usage: blender --background --python data/galt_archive/convert_to_glb.py -- <source.fbx> <out.glb>
"""
import bpy
import sys

argv = sys.argv[sys.argv.index("--") + 1:]
if len(argv) != 2:
    print("Usage: blender --background --python convert_to_glb.py -- <source.fbx> <out.glb>")
    sys.exit(1)
src_fbx, out_glb = argv

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src_fbx)

armature = None
for obj in bpy.data.objects:
    if obj.type == "ARMATURE":
        armature = obj
        break
if armature is None:
    print(f"FAIL: no armature found in {src_fbx}")
    sys.exit(1)

renamed = 0
for bone in armature.data.bones:
    if bone.name.startswith("mixamorig1:"):
        bone.name = bone.name.replace("mixamorig1:", "mixamorig:", 1)
        renamed += 1
print(f"Renamed {renamed} bones (mixamorig1: -> mixamorig:)")

bpy.ops.export_scene.gltf(
    filepath=out_glb,
    export_format="GLB",
    export_animations=True,
    export_frame_range=True,
    use_selection=False,
)
print(f"Exported: {out_glb}")
