"""Headless Blender script: renders a Galt archive full-mesh FBX's baked animation to an MP4 clip,
using the front-facing hand-visible camera framing validated in render_preview.py (not the studio's
own cloaked documentation-render style, which hides the hands).

Usage: blender --background --python render_clip.py -- <source.fbx> <out.mp4> [fps]
"""
import bpy
import sys

argv = sys.argv[sys.argv.index("--") + 1:]
src_fbx = argv[0]
out_mp4 = argv[1]
fps = int(argv[2]) if len(argv) > 2 else 24

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src_fbx)

mesh_objs = [o for o in bpy.data.objects if o.type == "MESH"]
print(f"Found {len(mesh_objs)} mesh object(s): {[o.name for o in mesh_objs]}")

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
cam_obj.location = (0, -2.2, 1.4)
cam_obj.rotation_euler = (1.4835, 0, 0)
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
scene.render.filepath = out_mp4  # out_mp4 arg is actually a frame-sequence path prefix here

bpy.ops.render.render(animation=True)
print(f"Rendered PNG sequence (frames 1-{frame_end} @ {fps}fps) -> {out_mp4}####.png")
