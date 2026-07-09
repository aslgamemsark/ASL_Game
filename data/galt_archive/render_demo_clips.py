"""Headless Blender script: batch-renders a Galt archive full-mesh FBX/GLB's baked animation to a
PNG frame sequence, with two camera/framing presets — reuses the exact camera/lighting proven this
session for word signs (render_clip.py), and adds a tighter preset for fingerspelled letters (a
full-body shot makes a single handshape too small to read clearly).

GLB inputs are expected to be pre-converted from FBX via the `fbx2gltf` tool (not Blender's own
FBX importer, and not glTF exports straight from the source) — that tool correctly handles a
transform-inheritance mode ('eInheritRrSs') some Unreal-exported rigs use that Blender's FBX
importer silently mishandles, garbling mesh deformation with no warning. Blender's native FBX
import path is kept for StudioGalt's files, which don't have this problem.

Usage: blender --background --python render_demo_clips.py -- <source.fbx|source.glb> <out_dir> <preset> [fps]
  preset: "word" (full body, proven framing) or "letter" (tighter chest+hand framing)
"""
import bpy
import sys
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
src_fbx, out_dir, preset = argv[0], argv[1], argv[2]
fps = int(argv[3]) if len(argv) > 3 else 24
assert preset in ("word", "letter"), f"preset must be 'word' or 'letter', got {preset!r}"

bpy.ops.wm.read_factory_settings(use_empty=True)
if src_fbx.lower().endswith(".glb") or src_fbx.lower().endswith(".gltf"):
    bpy.ops.import_scene.gltf(filepath=src_fbx)
else:
    bpy.ops.import_scene.fbx(filepath=src_fbx)

all_mesh_objs = [o for o in bpy.data.objects if o.type == "MESH"]
print(f"Found {len(all_mesh_objs)} mesh object(s): {[o.name for o in all_mesh_objs]}")
if not all_mesh_objs:
    print("FAIL: no mesh objects found in this file (skeleton-only?) — cannot render directly.")
    sys.exit(1)

# fbx2gltf-converted GLBs (used for 3D-LEX sources — see module docstring) can carry a stray
# placeholder mesh alongside the real character (observed: a 42-vert "Icosphere" sitting at the
# origin, roughly bounding-box-sized to the character itself) — probably a leftover camera/light
# gizmo from the source scene. Including it in bbox math inflates the measured character height
# and throws off camera framing. The real character mesh is always armature-deformed; anything
# that isn't gets excluded from framing math and hidden from the render.
mesh_objs = [o for o in all_mesh_objs if any(m.type == "ARMATURE" for m in o.modifiers)]
if not mesh_objs:
    mesh_objs = all_mesh_objs
for o in all_mesh_objs:
    if o not in mesh_objs:
        print(f"Excluding non-deforming mesh from framing/render: {o.name}")
        o.hide_render = True

# On some sources (confirmed on 3D-LEX) the mesh object's own matrix_world carries a
# DIFFERENT rotation than its parent armature's, despite being parented to it — e.g. actorBP's
# world rotation swapped Y/Z one way, the Armature's was near-identity, and the mesh's flipped
# Y and Z again, three different orientations in one parent chain. The Armature modifier
# deforms vertices in the armature's frame, then the deformed result gets placed using the
# MESH's own (differently rotated) matrix_world — garbling nearly the whole body into a
# collapsed clump, while only a few extremities land somewhere plausible by coincidence. A
# properly rigged mesh shouldn't carry its own transform at all; resetting it to identity so it
# purely inherits the armature's orientation fixes deformation without touching StudioGalt
# files (where mesh and armature were already aligned, so this is a no-op there).
for o in mesh_objs:
    for m in o.modifiers:
        if m.type == "ARMATURE" and m.object is not None:
            o.location = (0, 0, 0)
            o.rotation_euler = (0, 0, 0)
            o.scale = (1, 1, 1)
            o.matrix_parent_inverse.identity()
            break

# Some sources (3D-LEX) reference external texture images not embedded in the FBX — Blender's
# fallback for a broken/missing Image Texture node is solid magenta, not the material's base
# color, so the whole character renders as a magenta silhouette. A single flat fallback color
# for the whole body (tried first) rendered as a uniformly pale "white on white" blob with no
# skin/clothing contrast — these 3D-LEX GLBs are Ready Player Me avatars with exactly ONE
# material for the entire body (no separate skin/clothing materials to begin with, unlike
# StudioGalt's painted textures), so once that one material breaks, everything goes flat.
# Rebuild the contrast StudioGalt gets for free (pale skin, dark clothing) procedurally: split
# faces into skin (head/hands/forearms) vs clothing (everything else) by each vertex's
# dominant rig bone — Ready Player Me/Mixamo-style bone names, StudioGalt's own materials have
# no broken-texture nodes so this whole branch is a no-op there.
def has_broken_texture(mat):
    if not mat or not mat.use_nodes:
        return False
    for n in mat.node_tree.nodes:
        if n.type == "TEX_IMAGE" and (n.image is None or n.image.size[0] <= 1 or n.image.size[1] <= 1):
            return True
    return False

SKIN_BONES = {
    "Head", "HeadTop_End", "Neck",
    "LeftForeArm", "LeftHand", "RightForeArm", "RightHand",
}
for _side in ("Left", "Right"):
    for _finger in ("Thumb", "Index", "Middle", "Ring", "Pinky"):
        for _i in (1, 2, 3, 4):
            SKIN_BONES.add(f"{_side}Hand{_finger}{_i}")

clothing_mat, skin_mat, eye_white_mat = None, None, None
for o in mesh_objs:
    broken_slots = {i for i, slot in enumerate(o.material_slots) if has_broken_texture(slot.material)}
    if not broken_slots:
        continue
    if clothing_mat is None:
        clothing_mat = bpy.data.materials.new("ClothingFallback")
        clothing_mat.use_nodes = True
        bsdf = clothing_mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (0.04, 0.04, 0.045, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.65
    if skin_mat is None:
        skin_mat = bpy.data.materials.new("SkinFallback")
        skin_mat.use_nodes = True
        bsdf = skin_mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (0.82, 0.67, 0.55, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.5
    # Ready Player Me characters have real, separate eyeball geometry (confirmed by probing:
    # ~120 verts each with >0.9 weight to the LeftEye/RightEye bones, in a tight ~4cm bbox —
    # not just eyelid skin lightly influenced by an eye-look blendshape bone), it's just
    # rendered in the same flat skin tone as the rest of the face by the fallback above, so
    # the eyes disappear. Give them a visible sclera like any painted texture would. A pupil
    # dot was attempted and dropped: on this rig the eyeball's true camera-facing pole is
    # occluded by the eyelid/socket rim (verified by rendering the selection directly — every
    # normal-direction metric tried, including the exact 3D camera-facing vector, only ever
    # exposed an off-center sliver near the top of the aperture, never a centered dot), so
    # there's no reliable geometric signal here for where a pupil should go. Forcing one in
    # would mean guessing at rig detail the source doesn't give us — the same mistake flagged
    # in docs/AVATAR_AUTHORING_HANDOFF.md for code-authored poses on this project before.
    if eye_white_mat is None:
        eye_white_mat = bpy.data.materials.new("EyeWhiteFallback")
        eye_white_mat.use_nodes = True
        bsdf = eye_white_mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (0.95, 0.95, 0.93, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.25

    mesh = o.data
    group_names = [vg.name for vg in o.vertex_groups]

    # Per-vertex "how skin-like is this vertex" as a continuous 0..1 score (weight share
    # going to skin bones vs all bones) rather than a hard dominant-bone pick, then relax it
    # by averaging with mesh neighbors for a few passes. A hard per-vertex/per-face pick at
    # the shoulder/elbow blend zone flips somewhat unevenly across the ring of vertices
    # there (ordinary weight-painting noise), which a majority vote turns into a jagged
    # sawtooth sleeve hem instead of a clean line — smoothing removes that noise while
    # leaving the boundary in the same anatomical place.
    n_verts = len(mesh.vertices)
    skin_score = [0.0] * n_verts
    for v in mesh.vertices:
        skin_w = sum(g.weight for g in v.groups if group_names[g.group] in SKIN_BONES)
        total_w = sum(g.weight for g in v.groups)
        skin_score[v.index] = (skin_w / total_w) if total_w > 0 else 0.0

    neighbors = [[] for _ in range(n_verts)]
    for e in mesh.edges:
        a, b = e.vertices[0], e.vertices[1]
        neighbors[a].append(b)
        neighbors[b].append(a)
    for _ in range(12):
        smoothed = skin_score[:]
        for i, nbrs in enumerate(neighbors):
            if nbrs:
                smoothed[i] = 0.4 * skin_score[i] + 0.6 * (sum(skin_score[j] for j in nbrs) / len(nbrs))
        skin_score = smoothed
    vertex_is_skin = [s > 0.5 for s in skin_score]

    eye_all_verts = set()
    for eye_name in ("LeftEye", "RightEye"):
        if eye_name not in group_names:
            continue
        gidx = group_names.index(eye_name)
        eye_all_verts.update(v.index for v in mesh.vertices for g in v.groups if g.group == gidx and g.weight > 0.5)

    clothing_idx = len(o.material_slots)
    mesh.materials.append(clothing_mat)
    skin_idx = len(o.material_slots)
    mesh.materials.append(skin_mat)
    eye_white_idx = len(o.material_slots)
    mesh.materials.append(eye_white_mat)

    for poly in mesh.polygons:
        if poly.material_index not in broken_slots:
            continue
        verts = poly.vertices
        if eye_all_verts and any(vi in eye_all_verts for vi in verts):
            poly.material_index = eye_white_idx
            continue
        skin_votes = sum(1 for vi in verts if vertex_is_skin[vi])
        poly.material_index = skin_idx if skin_votes * 2 > len(verts) else clothing_idx

# action.frame_range / curve_frame_range are unreliable on some sources (3D-LEX's
# Unreal-exported FBXs report garbage ranges like (1309791, 1048574) — backwards, in the
# millions, apparently an exporter overflow artifact). Scan actual keyframe points instead.
# Blender 5's layered Action API nests fcurves under layers -> strips -> channelbags, not
# action.fcurves directly (that only exists on legacy actions) — support both.
def iter_fcurves(action):
    if getattr(action, "is_action_legacy", False):
        yield from action.fcurves
        return
    for layer in action.layers:
        for strip in layer.strips:
            if strip.type != "KEYFRAME":
                continue
            for channelbag in strip.channelbags:
                yield from channelbag.fcurves

real_start, real_end = None, None
for action in bpy.data.actions:
    for fcurve in iter_fcurves(action):
        for kp in fcurve.keyframe_points:
            x = kp.co[0]
            real_start = x if real_start is None else min(real_start, x)
            real_end = x if real_end is None else max(real_end, x)

if real_start is not None:
    offset = real_start - 1
    if offset != 0:
        for action in bpy.data.actions:
            for fcurve in iter_fcurves(action):
                for kp in fcurve.keyframe_points:
                    kp.co.x -= offset
                    kp.handle_left.x -= offset
                    kp.handle_right.x -= offset
                fcurve.update()
    frame_end = int(round(real_end - offset))
else:
    action_ranges = [a.frame_range[:] for a in bpy.data.actions]
    frame_end = int(max(r[1] for r in action_ranges)) if action_ranges else bpy.context.scene.frame_end
print(f"Animation frame range: 1 - {frame_end}")

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = frame_end
scene.render.fps = fps

# The camera presets below assume a character standing at x=0,y=0 with feet at z=0
# (StudioGalt's export convention). Not every source honors that. Two independent issues found
# on 3D-LEX sources:
#  1. The root object's "location" is itself keyframed (root motion), so directly editing
#     object.location silently loses to fcurve re-evaluation: a bbox check right after the edit
#     shows the corrected position, but bpy.ops.render.render() re-evaluates every animated
#     fcurve on every frame it renders, resetting location back to the keyframed value each
#     time. Fix: parent the root under a new, un-animated empty and offset THAT — a parent
#     transform survives fcurve re-evaluation on the child.
scene.frame_set(1)
offset_empty = bpy.data.objects.new("RecenterOffset", None)
bpy.context.collection.objects.link(offset_empty)
for o in list(bpy.data.objects):
    if o.parent is None and o is not offset_empty:
        o.parent = offset_empty
        o.matrix_parent_inverse.identity()

depsgraph = bpy.context.evaluated_depsgraph_get()
xs, ys, zs = [], [], []
for o in mesh_objs:
    o_eval = o.evaluated_get(depsgraph)
    mesh_eval = o_eval.to_mesh()
    mat = o_eval.matrix_world
    for v in mesh_eval.vertices:
        p = mat @ v.co
        xs.append(p.x)
        ys.append(p.y)
        zs.append(p.z)
    o_eval.to_mesh_clear()
delta = mathutils.Vector((
    -(min(xs) + max(xs)) / 2,
    -(min(ys) + max(ys)) / 2,
    -min(zs),
))
print(f"Recentering: posed bbox x[{min(xs):.3f},{max(xs):.3f}] "
      f"y[{min(ys):.3f},{max(ys):.3f}] z[{min(zs):.3f},{max(zs):.3f}] -> applying delta {delta[:]}")
offset_empty.location = delta

# fbx2gltf-converted 3D-LEX characters face -Y at rest (confirmed empirically on water.glb —
# the StudioGalt-proven camera at y=-2.2 looking toward +Y saw the character's back). StudioGalt
# sources face +Y, so this needs to be per-source, not a single fixed camera.
facing_away = src_fbx.lower().endswith((".glb", ".gltf"))
y_sign = 1 if facing_away else -1
z_rot = 3.14159265 if facing_away else 0.0

cam_data = bpy.data.cameras.new("Cam")
cam_obj = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam_obj)
if preset == "word":
    # Proven framing from this session's COFFEE/HELLO renders: full body, hands clearly visible.
    cam_obj.location = (0, y_sign * 2.2, 1.4)
    cam_obj.rotation_euler = (1.4835, 0, z_rot)
    cam_data.lens = 50
else:
    # Tighter chest-to-head framing for fingerspelling — a full-body shot makes one handshape
    # too small to read, but the hand also moves during a sign, so the frame needs headroom
    # around the hand rather than cropping tight to its rest position.
    cam_obj.location = (0, y_sign * 1.9, 1.45)
    cam_obj.rotation_euler = (1.4835, 0, z_rot)
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
