"""Headless Blender script (Phase 1 of the Galt-archive import plan): dumps bone names + rest-pose
transforms for ybot.glb and the two Galt Mixamo FBX files, so they can be diffed WITHOUT assuming
compatibility. Run via:
  blender --background --python data/galt_archive/inspect_rig.py
Writes data/galt_archive/inspect_report.json (repo root relative when run from E:/ASL_Game).
"""
import bpy
import json
import math
import os

REPO_ROOT = r"E:\ASL_Game"
YBOT_PATH = os.path.join(REPO_ROOT, "web", "public", "models", "avatar", "ybot.glb")
COFFEE_FBX = os.path.join(REPO_ROOT, "data", "galt_archive", "coffee_mixamo.fbx")
HELLO_FBX = os.path.join(REPO_ROOT, "data", "galt_archive", "hello_mixamo.fbx")
OUT_PATH = os.path.join(REPO_ROOT, "data", "galt_archive", "inspect_report.json")


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def find_armature():
    for obj in bpy.data.objects:
        if obj.type == "ARMATURE":
            return obj
    return None


def dump_armature(obj, label):
    """Bone names + rest (edit-bone) head/tail/matrix, in the armature's own local space."""
    bones = {}
    for bone in obj.data.bones:
        head = bone.head_local
        tail = bone.tail_local
        # matrix_local is the bone's rest transform relative to the ARMATURE object origin.
        m = bone.matrix_local
        bones[bone.name] = {
            "parent": bone.parent.name if bone.parent else None,
            "head": [round(head.x, 5), round(head.y, 5), round(head.z, 5)],
            "tail": [round(tail.x, 5), round(tail.y, 5), round(tail.z, 5)],
        }
    return {
        "label": label,
        "objectName": obj.name,
        "boneCount": len(obj.data.bones),
        "bones": bones,
    }


def iter_fcurves(action):
    """Blender 4.4+/5.x moved Action to a layered model (layers -> strips -> channelbags ->
    fcurves); older Blender exposed action.fcurves directly. Handle both, fail loudly if neither
    shape is found (never silently return zero animated bones)."""
    if hasattr(action, "fcurves"):
        yield from action.fcurves
        return
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                yield from channelbag.fcurves


def dump_animated_bones():
    """Which bones have ANY keyframed F-curve after an FBX import (finger data check)."""
    animated = set()
    for action in bpy.data.actions:
        for fcurve in iter_fcurves(action):
            # data_path looks like: pose.bones["mixamorig:RightHandThumb1"].rotation_quaternion
            dp = fcurve.data_path
            if 'pose.bones["' in dp:
                name = dp.split('pose.bones["')[1].split('"]')[0]
                animated.add(name)
    return sorted(animated)


def dump_action_frame_range():
    ranges = []
    for action in bpy.data.actions:
        ranges.append({"name": action.name, "frameStart": action.frame_range[0], "frameEnd": action.frame_range[1]})
    return ranges


report = {}

# --- ybot.glb ---
clear_scene()
bpy.ops.import_scene.gltf(filepath=YBOT_PATH)
arm = find_armature()
if arm is None:
    report["ybot"] = {"error": "no armature found after glTF import"}
else:
    report["ybot"] = dump_armature(arm, "ybot.glb (rest pose reference)")

# --- Coffee FBX ---
clear_scene()
bpy.ops.import_scene.fbx(filepath=COFFEE_FBX)
arm = find_armature()
if arm is None:
    report["coffee_fbx"] = {"error": "no armature found after FBX import"}
else:
    d = dump_armature(arm, "coffee_mixamo.fbx")
    d["animatedBones"] = dump_animated_bones()
    d["actions"] = dump_action_frame_range()
    report["coffee_fbx"] = d

# --- Hello FBX ---
clear_scene()
bpy.ops.import_scene.fbx(filepath=HELLO_FBX)
arm = find_armature()
if arm is None:
    report["hello_fbx"] = {"error": "no armature found after FBX import"}
else:
    d = dump_armature(arm, "hello_mixamo.fbx")
    d["animatedBones"] = dump_animated_bones()
    d["actions"] = dump_action_frame_range()
    report["hello_fbx"] = d

with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2)

print(f"\n=== INSPECT REPORT WRITTEN: {OUT_PATH} ===")
print(f"ybot bones: {report.get('ybot', {}).get('boneCount')}")
print(f"coffee_fbx bones: {report.get('coffee_fbx', {}).get('boneCount')}, animated: {len(report.get('coffee_fbx', {}).get('animatedBones', []))}")
print(f"hello_fbx bones: {report.get('hello_fbx', {}).get('boneCount')}, animated: {len(report.get('hello_fbx', {}).get('animatedBones', []))}")
