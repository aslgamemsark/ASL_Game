"""Headless Blender script: 3D-LEX counterpart to extract_rest_rig.py. Strips the baked animation
off an already fbx2gltf-converted 3D-LEX GLB (data/3dlex/ANIM_GLB_converted/*.glb — a Ready Player
Me avatar), leaving just the character + skeleton in rest pose, saved as a fresh .blend project
plus a companion rest-pose GLB.

Two 3D-LEX-specific fixups carried over from render_demo_clips.py (see that file's comments for the
full reasoning): excluding a stray non-deforming placeholder mesh some fbx2gltf conversions carry,
and resetting the deforming mesh's own transform to identity (its matrix_world can disagree with the
armature's, garbling deformation otherwise). Not needed for StudioGalt FBX sources — see
extract_rest_rig.py for that one.

Usage:
    blender --background --python data/galt_archive/extract_rest_rig_3dlex.py -- \
        data/3dlex/ANIM_GLB_converted/water.glb reference_clips/blender/3dlex_rig
(source defaults to ANIM_GLB_converted/water.glb if omitted)
"""
import bpy
import sys
import os

argv = sys.argv[sys.argv.index("--") + 1:]
if len(argv) not in (1, 2):
    print("Usage: blender --background --python extract_rest_rig_3dlex.py -- [source.glb] <out_prefix>")
    sys.exit(1)
if len(argv) == 2:
    src_glb, out_prefix = argv
else:
    src_glb = os.path.join("data", "3dlex", "ANIM_GLB_converted", "water.glb")
    out_prefix = argv[0]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src_glb)

armature = None
for obj in bpy.data.objects:
    if obj.type == "ARMATURE":
        armature = obj
        break
if armature is None:
    print(f"FAIL: no armature found in {src_glb}")
    sys.exit(1)

all_mesh_objs = [o for o in bpy.data.objects if o.type == "MESH"]
print(f"Found {len(all_mesh_objs)} mesh object(s): {[o.name for o in all_mesh_objs]}")

# Exclude stray non-deforming placeholder meshes (e.g. a leftover "Icosphere") from the file
# entirely — they're not part of the character.
mesh_objs = [o for o in all_mesh_objs if any(m.type == "ARMATURE" for m in o.modifiers)]
if not mesh_objs:
    mesh_objs = all_mesh_objs
for o in all_mesh_objs:
    if o not in mesh_objs:
        print(f"Removing non-deforming stray mesh: {o.name}")
        bpy.data.objects.remove(o, do_unlink=True)

# Reset each deforming mesh's own transform to identity so it purely inherits the armature's
# orientation (see render_demo_clips.py for why this matters on 3D-LEX sources specifically).
for o in mesh_objs:
    for m in o.modifiers:
        if m.type == "ARMATURE" and m.object is not None:
            o.location = (0, 0, 0)
            o.rotation_euler = (0, 0, 0)
            o.scale = (1, 1, 1)
            o.matrix_parent_inverse.identity()
            break

# Flat visible fallback color for the broken/unresolved texture (3D-LEX GLBs reference external
# images not embedded in the file) — just enough to see the character clearly while posing, not
# the full skin/clothing/eye split render_demo_clips.py does for final production renders.
def has_broken_texture(mat):
    if not mat or not mat.use_nodes:
        return False
    for n in mat.node_tree.nodes:
        if n.type == "TEX_IMAGE" and (n.image is None or n.image.size[0] <= 1 or n.image.size[1] <= 1):
            return True
    return False

fallback_mat = None
for o in mesh_objs:
    for slot in o.material_slots:
        if has_broken_texture(slot.material):
            if fallback_mat is None:
                fallback_mat = bpy.data.materials.new("BrokenTextureFallback")
                fallback_mat.use_nodes = True
                bsdf = fallback_mat.node_tree.nodes.get("Principled BSDF")
                bsdf.inputs["Base Color"].default_value = (0.65, 0.55, 0.5, 1.0)
                bsdf.inputs["Roughness"].default_value = 0.6
            slot.material = fallback_mat

# Strip animation from every object, then explicitly clear every pose bone's transform — clearing
# animation_data alone leaves whatever pose the last-evaluated frame baked in place.
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

for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)

# Measured (not assumed) via a zoomed-out multi-angle diagnostic render: this rig's true "up" is
# world Y, not Z — a "top" camera (looking down -Z) showed a perfectly upright standing character,
# while a normal Z-up "front" camera showed it lying on its back. That's fine for the skin data
# itself, but means opening this file in a normal Blender viewport (Z-up, ground = XY plane) would
# show the character lying down. Wrap armature+mesh under a fresh empty and rotate ONLY the empty
# +90 deg about X (old_y -> new_z, old_z -> new_-y) so it stands upright in a standard viewport,
# without touching any bone rest data, vertex weights, or the mesh's own transform at all.
orient_fix = bpy.data.objects.new("OrientationFix", None)
bpy.context.collection.objects.link(orient_fix)
orient_fix.rotation_euler = (1.5707963, 0, 0)
for obj in list(bpy.data.objects):
    if obj is not orient_fix and obj.parent is None:
        obj.parent = orient_fix

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
