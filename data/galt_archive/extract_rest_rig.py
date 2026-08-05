"""Headless Blender script: strips the baked animation off a StudioGalt mesh_fbx export, leaving
just the character + skeleton in its rest pose, saved as a fresh .blend project (ready to keyframe
in the Blender GUI) plus a companion rest-pose GLB for pipeline use.

The StudioGalt archive ships as per-word mocap clips on one shared skeleton (see
docs/AVATAR_AUTHORING_HANDOFF.md / 3DLEX_ANIMATION_PIPELINE_HANDOFF.md) — there's no separate
"blank" character file in the archive itself, so this carves one out of an existing export
(HELLO.fbx by default, since it's the known-clean reference) by deleting its Action and clearing
every pose bone's transform back to identity.

Usage:
    blender --background --python data/galt_archive/extract_rest_rig.py -- \
        data/galt_archive/mesh_fbx/HELLO.fbx reference_clips/blender/studiogalt_rig
(writes <out>.blend and <out>.glb; source defaults to mesh_fbx/HELLO.fbx if omitted)
"""
import bpy
import sys
import os

argv = sys.argv[sys.argv.index("--") + 1:]
if len(argv) not in (1, 2):
    print("Usage: blender --background --python extract_rest_rig.py -- [source.fbx] <out_prefix>")
    sys.exit(1)
if len(argv) == 2:
    src_fbx, out_prefix = argv
else:
    src_fbx = os.path.join("data", "galt_archive", "mesh_fbx", "HELLO.fbx")
    out_prefix = argv[0]

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

# Strip animation from every object (armature + any animated mesh) so nothing drives the rig away
# from rest, then explicitly zero every pose bone's transform — clearing animation_data alone
# leaves whatever pose the last-evaluated frame baked into pose_bone.matrix_basis in place.
cleared = 0
for obj in bpy.data.objects:
    if obj.animation_data:
        obj.animation_data_clear()
        cleared += 1
print(f"Cleared animation_data on {cleared} object(s)")

bpy.context.view_layer.objects.active = armature
bpy.ops.object.mode_set(mode="POSE")
bpy.ops.pose.select_all(action="SELECT")
bpy.ops.pose.transforms_clear()
bpy.ops.object.mode_set(mode="OBJECT")

# Drop every orphaned Action so re-opening the file doesn't offer HELLO's old motion by accident.
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)

blend_path = os.path.abspath(out_prefix + ".blend")
glb_path = os.path.abspath(out_prefix + ".glb")

bpy.ops.wm.save_as_mainfile(filepath=blend_path)
bpy.ops.export_scene.gltf(
    filepath=glb_path,
    export_format="GLB",
    export_animations=False,
    use_selection=False,
)
print(f"Saved rest-pose rig: {blend_path}")
print(f"Saved rest-pose GLB: {glb_path}")
