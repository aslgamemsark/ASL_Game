import bpy, sys
argv = sys.argv[sys.argv.index("--") + 1:]
src_fbx = argv[0]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src_fbx)
print(f"frame_start={bpy.context.scene.frame_start} frame_end={bpy.context.scene.frame_end}")
for a in bpy.data.actions:
    print(f"action {a.name}: frame_range={a.frame_range[:]}")
