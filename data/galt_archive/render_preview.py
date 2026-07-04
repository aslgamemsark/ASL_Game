"""Headless Blender script: imports the Galt archive's full-mesh FBX (character with body/hands,
not the cloaked documentation-render character) and renders a single still frame from a front-facing
camera angle that shows the hands, as a quick quality check before committing to a full video render.

Usage: blender --background --python render_preview.py -- <source.fbx> <out.png> [frame]
"""
import bpy
import sys

argv = sys.argv[sys.argv.index("--") + 1:]
src_fbx = argv[0]
out_png = argv[1]
frame = int(argv[2]) if len(argv) > 2 else 60

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src_fbx)

# Frame all mesh objects to find scene bounds for camera placement.
mesh_objs = [o for o in bpy.data.objects if o.type == "MESH"]
print(f"Found {len(mesh_objs)} mesh object(s): {[o.name for o in mesh_objs]}")

armature = None
for obj in bpy.data.objects:
    if obj.type == "ARMATURE":
        armature = obj
        break
if armature is None:
    print("FAIL: no armature found")
    sys.exit(1)

scene = bpy.context.scene
scene.frame_set(frame)

# Simple front-facing camera + light, framing roughly chest-to-head height where hands/signs happen.
cam_data = bpy.data.cameras.new("PreviewCam")
cam_obj = bpy.data.objects.new("PreviewCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
cam_obj.location = (0, -2.2, 1.4)
cam_obj.rotation_euler = (1.4835, 0, 0)  # ~85 degrees, looking slightly down
cam_data.lens = 50
scene.camera = cam_obj

key_data = bpy.data.lights.new("KeyLight", type="SUN")
key_data.energy = 4.0
key_obj = bpy.data.objects.new("KeyLight", key_data)
key_obj.location = (0, -3, 3)
key_obj.rotation_euler = (0.9, 0, 0.5)
bpy.context.collection.objects.link(key_obj)

fill_data = bpy.data.lights.new("FillLight", type="SUN")
fill_data.energy = 2.0
fill_obj = bpy.data.objects.new("FillLight", fill_data)
fill_obj.location = (2, -1, 1.5)
fill_obj.rotation_euler = (1.2, 0, -0.8)
bpy.context.collection.objects.link(fill_obj)

rim_data = bpy.data.lights.new("RimLight", type="SUN")
rim_data.energy = 2.0
rim_obj = bpy.data.objects.new("RimLight", rim_data)
rim_obj.location = (-2, 1, 2)
rim_obj.rotation_euler = (1.0, 0, 2.5)
bpy.context.collection.objects.link(rim_obj)

# Light grey background instead of pure black, so a dark-clothed character doesn't disappear.
world = bpy.data.worlds.new("PreviewWorld")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.55, 0.55, 0.58, 1.0)
bg.inputs[1].default_value = 1.0
scene.world = world

scene.render.engine = "BLENDER_EEVEE"
scene.view_settings.view_transform = "Standard"
scene.render.resolution_x = 800
scene.render.resolution_y = 800
scene.render.filepath = out_png
bpy.ops.render.render(write_still=True)
print(f"Rendered frame {frame} -> {out_png}")
