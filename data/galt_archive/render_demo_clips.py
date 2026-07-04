"""Headless Blender script: batch-renders a Galt archive full-mesh FBX's baked animation to a PNG
frame sequence, with two camera/framing presets — reuses the exact camera/lighting proven this
session for word signs (render_clip.py), and adds a tighter preset for fingerspelled letters (a
full-body shot makes a single handshape too small to read clearly).

Usage: blender --background --python render_demo_clips.py -- <source.fbx> <out_dir> <preset> [fps]
  preset: "word" (full body, proven framing) or "letter" (tighter chest+hand framing)
"""
import bpy
import sys

argv = sys.argv[sys.argv.index("--") + 1:]
src_fbx, out_dir, preset = argv[0], argv[1], argv[2]
fps = int(argv[3]) if len(argv) > 3 else 24
assert preset in ("word", "letter"), f"preset must be 'word' or 'letter', got {preset!r}"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src_fbx)

mesh_objs = [o for o in bpy.data.objects if o.type == "MESH"]
print(f"Found {len(mesh_objs)} mesh object(s): {[o.name for o in mesh_objs]}")
if not mesh_objs:
    print("FAIL: no mesh objects found in this FBX (skeleton-only?) — cannot render directly.")
    sys.exit(1)

action_ranges = [a.frame_range[:] for a in bpy.data.actions]
frame_end = int(max(r[1] for r in action_ranges)) if action_ranges else bpy.context.scene.frame_end
print(f"Animation frame range: 1 - {frame_end}")

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = frame_end
scene.render.fps = fps

cam_data = bpy.data.cameras.new("Cam")
cam_obj = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam_obj)
if preset == "word":
    # Proven framing from this session's COFFEE/HELLO renders: full body, hands clearly visible.
    cam_obj.location = (0, -2.2, 1.4)
    cam_obj.rotation_euler = (1.4835, 0, 0)
    cam_data.lens = 50
else:
    # Tighter chest-to-head framing for fingerspelling — a full-body shot makes one handshape
    # too small to read, but the hand also moves during a sign, so the frame needs headroom
    # around the hand rather than cropping tight to its rest position.
    cam_obj.location = (0, -1.9, 1.45)
    cam_obj.rotation_euler = (1.4835, 0, 0)
    cam_data.lens = 55
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
scene.render.filepath = out_dir + "/f"

bpy.ops.render.render(animation=True)
print(f"Rendered PNG sequence (frames 1-{frame_end} @ {fps}fps, preset={preset}) -> {out_dir}")
