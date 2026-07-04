"""Patches the installed Rokoko Studio Live add-on (v1.4.3) for Blender 5.x compatibility.

Blender 5.x removed the legacy `action.fcurves` API in favor of layered actions
(action.layers[].strips[].channelbags[].fcurves) with explicit slots. The add-on's retargeting
path touches the legacy API in two files; this script:
  1. drops a small `core/compat51.py` helper into the add-on,
  2. rewrites the legacy call sites in `core/detection_manager.py` and `operators/retargeting.py`
     to go through the helper (no behavior change on Blender <= 4.x, where the helper falls back
     to the legacy API).

Run with plain Python (not Blender): python patch_rokoko_blender51.py <addon_dir>
Idempotent: re-running detects the marker comment and skips already-patched files.
"""
import sys
from pathlib import Path

addon_dir = Path(sys.argv[1])
assert (addon_dir / "operators" / "retargeting.py").exists(), f"not an addon dir: {addon_dir}"

MARKER = "# PATCHED-BLENDER51"

COMPAT = '''\
"""Blender 5.x layered-action compatibility helpers for the retargeting path. # PATCHED-BLENDER51

Blender 5.x removed the legacy `action.fcurves` flat API; fcurves now live in
action.layers[].strips[].channelbags[] and evaluation requires an action *slot* assigned on the
user's AnimData. These helpers work on both old (legacy attr present) and new Blender versions.
"""
import bpy


def _channelbags(action):
    for layer in action.layers:
        for strip in layer.strips:
            for cb in strip.channelbags:
                yield cb


def fcurves_all(action):
    """All fcurves of an action, regardless of Blender version. Returns a list (safe to mutate the action while iterating)."""
    if hasattr(action, "fcurves"):
        return list(action.fcurves)
    out = []
    for cb in _channelbags(action):
        out.extend(cb.fcurves)
    return out


def fcurves_remove(action, fcurve):
    if hasattr(action, "fcurves"):
        action.fcurves.remove(fcurve)
        return
    for cb in _channelbags(action):
        try:
            cb.fcurves.remove(fcurve)
            return
        except RuntimeError:
            continue


def fcurves_find(action, data_path, index):
    if hasattr(action, "fcurves"):
        return action.fcurves.find(data_path=data_path, index=index)
    for cb in _channelbags(action):
        fc = cb.fcurves.find(data_path, index=index)
        if fc:
            return fc
    return None


def action_ensure_container(action, for_id):
    """Returns an object with a legacy-like `.fcurves.new(data_path=..., index=...)` surface.

    On legacy Blender: the action itself. On 5.x: creates slot+layer+strip and returns the
    channelbag; also returns the slot so the caller can assign it to the user's AnimData.
    """
    if hasattr(action, "fcurves"):
        return action, None
    slot = action.slots.new(id_type='OBJECT', name=(for_id.name if for_id else "Slot"))
    layer = action.layers.new("Layer")
    strip = layer.strips.new(type='KEYFRAME')
    cb = strip.channelbag(slot, ensure=True)
    return cb, slot


def container_new_fcurve(container, data_path, index, group_name=None):
    """fcurves.new that tolerates both the legacy (kw-only, action_group) and 5.x channelbag signatures."""
    try:
        return container.fcurves.new(data_path=data_path, index=index, action_group=group_name or "")
    except TypeError:
        return container.fcurves.new(data_path, index=index)


def assign_action_with_slot(id_obj, action, slot):
    ad = id_obj.animation_data if id_obj.animation_data else id_obj.animation_data_create()
    ad.action = action
    if slot is not None:
        ad.action_slot = slot
'''

(addon_dir / "core" / "compat51.py").write_text(COMPAT, encoding="utf-8")
print("wrote core/compat51.py")


def patch(path: Path, replacements: list[tuple[str, str]]):
    text = path.read_text(encoding="utf-8")
    if MARKER in text:
        print(f"already patched: {path.name}")
        return
    for old, new in replacements:
        assert old in text, f"pattern not found in {path.name}:\n{old}"
        text = text.replace(old, new)
    text = f"{MARKER}\n" + text
    path.write_text(text, encoding="utf-8")
    print(f"patched: {path.name} ({len(replacements)} site(s))")


# --- core/detection_manager.py: read of source action fcurves ---
patch(addon_dir / "core" / "detection_manager.py", [
    (
        "    for fc in armature_source.animation_data.action.fcurves:",
        "    from . import compat51\n    for fc in compat51.fcurves_all(armature_source.animation_data.action):",
    ),
])

# --- operators/retargeting.py ---
patch(addon_dir / "operators" / "retargeting.py", [
    # clean_animation: read + remove
    (
        """        deletable_fcurves = ['location', 'rotation_euler', 'rotation_quaternion', 'scale']
        for fcurve in armature_source.animation_data.action.fcurves:
            if fcurve.data_path in deletable_fcurves:
                armature_source.animation_data.action.fcurves.remove(fcurve)""",
        """        from ..core import compat51
        deletable_fcurves = ['location', 'rotation_euler', 'rotation_quaternion', 'scale']
        action = armature_source.animation_data.action
        for fcurve in compat51.fcurves_all(action):
            if fcurve.data_path in deletable_fcurves:
                compat51.fcurves_remove(action, fcurve)""",
    ),
    # read_anim_start_end: read
    (
        """        for fcurve in armature.animation_data.action.fcurves:
            for key in fcurve.keyframe_points:""",
        """        from ..core import compat51
        for fcurve in compat51.fcurves_all(armature.animation_data.action):
            for key in fcurve.keyframe_points:""",
    ),
    # bake merge: key counting read
    (
        """        key_counts = {}
        for action in actions_all:
            for fcurve in action.fcurves:""",
        """        from ..core import compat51
        key_counts = {}
        for action in actions_all:
            for fcurve in compat51.fcurves_all(action):""",
    ),
    # final action creation + slot assignment
    (
        """        action_final = bpy.data.actions.new(name='RSL_RETARGETING_FINAL')
        action_final.use_fake_user = True
        armature_target.animation_data_create().action = action_final""",
        """        action_final = bpy.data.actions.new(name='RSL_RETARGETING_FINAL')
        action_final.use_fake_user = True
        final_container, final_slot = compat51.action_ensure_container(action_final, armature_target)
        compat51.assign_action_with_slot(armature_target, action_final, final_slot)""",
    ),
    # iterate first baked action's fcurves
    (
        "        for fcurve in actions_all[0].fcurves:",
        "        for fcurve in compat51.fcurves_all(actions_all[0]):",
    ),
    # create merged fcurve (group may be None on 5.x baked curves)
    (
        "            curve_final = action_final.fcurves.new(data_path=fcurve.data_path, index=fcurve.array_index, action_group=fcurve.group.name)",
        "            curve_final = compat51.container_new_fcurve(final_container, fcurve.data_path, fcurve.array_index, fcurve.group.name if fcurve.group else None)",
    ),
    # find per-part fcurve
    (
        "                fcruve_to_add = action.fcurves.find(data_path=fcurve.data_path, index=fcurve.array_index)",
        "                fcruve_to_add = compat51.fcurves_find(action, fcurve.data_path, fcurve.array_index)",
    ),
    # final cleanup iteration
    (
        "        for fcurve in action_final.fcurves:",
        "        for fcurve in compat51.fcurves_all(action_final):",
    ),
])

print("done")
