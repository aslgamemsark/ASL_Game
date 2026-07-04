"""Headless Blender experiment: retarget a Galt-archive mocap FBX onto ybot.glb using the FREE
Rokoko Studio Live add-on's retargeting operators (rsl.build_bone_list / rsl.retarget_animation),
then render the result as a PNG frame sequence with the same camera/lighting as render_clip.py so
the two characters can be compared side by side.

The Rokoko retargeting operators are registered in `classes_always_enable` (verified by reading the
add-on source) — no Rokoko account/login is required for retargeting.

Usage: blender --background --python rokoko_retarget_test.py -- <addon_zip> <galt_fbx> <ybot_glb> <out_dir>
"""
import bpy
import sys
import os

argv = sys.argv[sys.argv.index("--") + 1:]
addon_zip, galt_fbx, ybot_glb, out_dir = [os.path.abspath(a) for a in argv]

bpy.ops.wm.read_factory_settings(use_empty=True)

# --- Install + enable the Rokoko add-on for this session ---
# overwrite=False: NEVER clobber an existing install — it may carry the Blender-5.x compat patch
# applied by patch_rokoko_blender51.py (re-installing from the pristine zip would undo it).
import addon_utils as _au
already_installed = any("rokoko" in m.__name__.lower() for m in _au.modules())
if not already_installed:
    bpy.ops.preferences.addon_install(filepath=addon_zip, overwrite=False)
try:
    bpy.ops.preferences.addon_enable(module="rokoko-studio-live-blender-1-4-3")
except Exception as e:
    print(f"addon_enable raised: {e}")
import addon_utils
enabled = [m.__name__ for m in addon_utils.modules() if "rokoko" in m.__name__.lower()]
print(f"Rokoko modules found: {enabled}")
if not hasattr(bpy.ops, "rsl") or not hasattr(bpy.context.scene, "rsl_retargeting_armature_source"):
    print("FAIL: Rokoko retargeting operators/properties not available after enable.")
    sys.exit(1)
print("Rokoko add-on enabled, retargeting API available.")

# --- Import source (Galt mocap, carries the animation) ---
before = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=galt_fbx)
src_arm = next(o for o in set(bpy.data.objects) - before if o.type == "ARMATURE")
print(f"Source armature: {src_arm.name}, animated: {bool(src_arm.animation_data and src_arm.animation_data.action)}")

# --- Import target (ybot, has the mesh we want to see) ---
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=ybot_glb)
new_objs = set(bpy.data.objects) - before
tgt_arm = next(o for o in new_objs if o.type == "ARMATURE")
print(f"Target armature: {tgt_arm.name}, meshes: {[o.name for o in new_objs if o.type == 'MESH']}")

# --- Run Rokoko retargeting ---
scene = bpy.context.scene
scene.rsl_retargeting_armature_source = src_arm
scene.rsl_retargeting_armature_target = tgt_arm
scene.rsl_retargeting_auto_scaling = True
scene.rsl_retargeting_use_pose = "REST"

result = bpy.ops.rsl.build_bone_list()
print(f"build_bone_list -> {result}")

# The fuzzy auto-detector mis-maps on this rig pair (it sent both LeftArm and LeftShoulder to the
# same target). Our two rigs share bone names 1:1 modulo the "mixamorig1:" vs "mixamorig:" prefix,
# so override with the exact prefix-swapped mapping — no fuzzy matching needed at all.
for item in scene.rsl_retargeting_bone_list:
    exact = item.bone_name_source.replace("mixamorig1:", "mixamorig:")
    item.bone_name_target = exact if exact in tgt_arm.pose.bones else ""

mapped = [(i.bone_name_source, i.bone_name_target) for i in scene.rsl_retargeting_bone_list if i.bone_name_target]
unmapped = [i.bone_name_source for i in scene.rsl_retargeting_bone_list if not i.bone_name_target]
print(f"Mapped {len(mapped)} bones, unmapped: {len(unmapped)}")
for s, t in mapped[:10]:
    print(f"  {s} -> {t}")
if unmapped:
    print(f"  UNMAPPED: {unmapped[:15]}")

result = bpy.ops.rsl.retarget_animation()
print(f"retarget_animation -> {result}")
if not (tgt_arm.animation_data and tgt_arm.animation_data.action):
    print("FAIL: target armature has no animation after retargeting.")
    sys.exit(1)
rng = tgt_arm.animation_data.action.frame_range
print(f"Target action frame range: {rng[0]:.0f} - {rng[1]:.0f}")

# --- Hide the source skeleton, render the ybot result ---
src_arm.hide_render = True
for o in bpy.data.objects:
    if o.type == "MESH" and o.name.startswith("Strand"):
        pass  # (Galt hair strands only exist on mesh FBX imports, not this no-mesh one)

scene.frame_start = int(rng[0])
scene.frame_end = int(rng[1])
scene.render.fps = 24

cam_data = bpy.data.cameras.new("Cam")
cam_obj = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam_obj)
cam_obj.location = (0, -2.2, 1.4)
cam_obj.rotation_euler = (1.4835, 0, 0)
cam_data.lens = 50
scene.camera = cam_obj

for name, energy, loc, rot in [
    ("KeyLight", 4.0, (0, -3, 3), (0.9, 0, 0.5)),
    ("FillLight", 2.0, (2, -1, 1.5), (1.2, 0, -0.8)),
    ("RimLight", 2.0, (-2, 1, 2), (1.0, 0, 2.5)),
]:
    ld = bpy.data.lights.new(name, type="SUN")
    ld.energy = energy
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    lo.rotation_euler = rot
    bpy.context.collection.objects.link(lo)

world = bpy.data.worlds.new("World")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.55, 0.55, 0.58, 1.0)
bg.inputs[1].default_value = 1.0
scene.world = world

scene.render.engine = "BLENDER_EEVEE"
scene.view_settings.view_transform = "Standard"
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = os.path.join(out_dir, "f")

bpy.ops.render.render(animation=True)
print(f"Rendered ybot retarget test frames {scene.frame_start}-{scene.frame_end} -> {out_dir}")
