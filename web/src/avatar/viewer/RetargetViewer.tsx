/**
 * AvatarLab: Retarget Viewer (Milestone 5 gate demo). Drives the REAL Three.js GLB skeleton using
 * the arm-IK quaternions computed by ArmRetargeter.ts — the same numbers the CLI/Vitest verify
 * numerically. Playing the clip and watching the hand actually reach the target is the visual half
 * of the M5 acceptance criteria (numeric-only checks previously hid bugs in this project — see
 * CLAUDE.md's non-negotiable rule about single-frame verification).
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { buildCalibration } from '../calibration/CalibrationEngine.ts';
import { computeBodyFrame } from '../animation/BodyFrame.ts';
import { resolveAnimationForSign, type AnimationSourceResult } from '../animation/AnimationSource.ts';
import { SIGN_PATHS } from '../animation/signPaths.ts';
import type { AvatarHierarchy, CalibrationProfile } from '../calibration/types.ts';
import type { ReferencePoseIndex, ReferencePoseMetadata } from '../reference/types.ts';

const AVATAR_URL = '/models/avatar/ybot.glb';
const PROCEDURAL_SIGNS = Object.keys(SIGN_PATHS);

function stripName(n: string) {
  return n.replace(/^mixamorig:?/i, '');
}

export function RetargetViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hierarchy, setHierarchy] = useState<AvatarHierarchy | null>(null);
  const [calibration, setCalibration] = useState<CalibrationProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const boneMeshesRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const [availablePoses, setAvailablePoses] = useState<ReferencePoseMetadata[]>([]);

  // Any sign with a signPaths.ts entry, PLUS any sign that has 2+ reference poses (keyframe-driven-
  // only signs, no procedural fallback needed) — the dropdown reflects whichever sources can
  // actually produce something, not just the procedural set.
  const poseCountBySign = new Map<string, number>();
  for (const p of availablePoses) poseCountBySign.set(p.signName, (poseCountBySign.get(p.signName) ?? 0) + 1);
  const keyframeOnlySigns = [...poseCountBySign.entries()].filter(([name, count]) => count >= 2 && !(name in SIGN_PATHS)).map(([name]) => name);
  const availableSigns = [...PROCEDURAL_SIGNS, ...keyframeOnlySigns];

  const [sign, setSign] = useState<string>('COFFEE');
  const [result, setResult] = useState<AnimationSourceResult | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [showDebug, setShowDebug] = useState(true);
  const targetMarkersRef = useRef<{ right: THREE.Mesh; left: THREE.Mesh } | null>(null);
  // Debug-visualization markers requested during the M5 bug investigation: shoulder origins, elbow
  // solutions, and ACHIEVED wrist positions (computed independently of the rendered bone chain), so a
  // mismatch between "what the math says" and "what's actually rendered" is visible directly.
  const debugMarkersRef = useRef<{
    shoulderR: THREE.Mesh; shoulderL: THREE.Mesh;
    elbowR: THREE.Mesh; elbowL: THREE.Mesh;
    achievedR: THREE.Mesh; achievedL: THREE.Mesh;
  } | null>(null);
  const bodyFrameGroupRef = useRef<THREE.Group | null>(null);

  // Load once: pure-data hierarchy+calibration (drives the math) and the Three.js scene (drives the render).
  useEffect(() => {
    fetch(AVATAR_URL)
      .then((r) => r.arrayBuffer())
      .then((buffer) => {
        const { json } = parseGlb(buffer);
        const h = buildHierarchy(json, AVATAR_URL);
        setHierarchy(h);
        setCalibration(buildCalibration(h, buffer));
      })
      .catch((e) => setError(`Load failed: ${(e as Error).message}`));

    // Reference poses feed AnimationSource's keyframe resolver — loaded once, same as ReferencePoseViewer.
    fetch('/reference_poses/metadata/index.json')
      .then((r) => (r.ok ? r.json() : { poses: [] }))
      .then((idx: ReferencePoseIndex) => Promise.all((idx.poses ?? []).map((id) => fetch(`/reference_poses/metadata/${id}.json`).then((r) => r.json()))))
      .then((poses: ReferencePoseMetadata[]) => setAvailablePoses(poses))
      .catch(() => setAvailablePoses([]));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x151a23);
    scene.add(new THREE.GridHelper(2, 20, 0x333844, 0x22262f));
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(1, 2, 1);
    scene.add(dirLight);

    const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.01, 100);
    camera.position.set(0.9, 1.5, 1.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.0, 0);
    controls.enableDamping = true;

    const loader = new GLTFLoader();
    loader.load(
      AVATAR_URL,
      (gltf) => {
        scene.add(gltf.scene);
        gltf.scene.traverse((obj) => {
          if (obj.name) boneMeshesRef.current.set(stripName(obj.name), obj);
        });
      },
      undefined,
      (err) => setError(`GLB render load failed: ${String(err)}`)
    );

    // Small spheres marking the intended (target) hand positions, so a gap vs the actual hand mesh
    // is visible at a glance if IK ever fails to converge.
    const rightMarker = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff6b6b, wireframe: true }));
    const leftMarker = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 12), new THREE.MeshBasicMaterial({ color: 0x4dd0e1, wireframe: true }));
    scene.add(rightMarker, leftMarker);
    targetMarkersRef.current = { right: rightMarker, left: leftMarker };

    // Debug markers: shoulder origins (white), elbow solutions (yellow), achieved wrist (green solid
    // — should sit exactly inside the red/cyan target wireframe spheres above; a visible gap between
    // green and the wireframe means the math and the render have diverged).
    const mkSphere = (color: number, radius: number, wireframe = false) =>
      new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 10), new THREE.MeshBasicMaterial({ color, wireframe }));
    const shoulderR = mkSphere(0xffffff, 0.015);
    const shoulderL = mkSphere(0xffffff, 0.015);
    const elbowR = mkSphere(0xffe066, 0.015);
    const elbowL = mkSphere(0xffe066, 0.015);
    const achievedR = mkSphere(0x69db7c, 0.008);
    const achievedL = mkSphere(0x69db7c, 0.008);
    scene.add(shoulderR, shoulderL, elbowR, elbowL, achievedR, achievedL);
    debugMarkersRef.current = { shoulderR, shoulderL, elbowR, elbowL, achievedR, achievedL };

    const bodyFrameGroup = new THREE.Group();
    scene.add(bodyFrameGroup);
    bodyFrameGroupRef.current = bodyFrameGroup;

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (container.clientWidth === 0 || container.clientHeight === 0) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);
    // This viewer mounts fresh each time its tab is selected (unlike a page loaded from scratch),
    // so `container.clientWidth/Height` can still be 0 at the instant this effect runs (layout not
    // yet settled) — the WebGLRenderer would then be created at 0x0 and never recover, since nothing
    // ever fires a `window resize` event on a tab switch. A ResizeObserver catches that first real
    // layout pass (and any later container resizes) directly, instead of only re-acting to the browser
    // window itself changing size.
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // Draw the BodyFrame axes (right=red, up=green, forward=blue) as arrows anchored at the midpoint
  // between the shoulders, so the coordinate frame the whole IK pipeline is built on is directly
  // inspectable rather than trusted blindly.
  useEffect(() => {
    if (!hierarchy) return;
    const group = bodyFrameGroupRef.current;
    if (!group) return;
    group.clear();
    const frame = computeBodyFrame(hierarchy);
    const rightArmName = hierarchy.arms.right.upperArm!;
    const leftArmName = hierarchy.arms.left.upperArm!;
    const sR = hierarchy.bones[rightArmName].worldPosition;
    const sL = hierarchy.bones[leftArmName].worldPosition;
    const origin = new THREE.Vector3((sR.x + sL.x) / 2, (sR.y + sL.y) / 2, (sR.z + sL.z) / 2);
    const len = frame.shoulderWidth * 0.8;
    const toVec3 = (v: { x: number; y: number; z: number }) => new THREE.Vector3(v.x, v.y, v.z);
    group.add(new THREE.ArrowHelper(toVec3(frame.right), origin, len, 0xff4d4d, len * 0.25, len * 0.15));
    group.add(new THREE.ArrowHelper(toVec3(frame.up), origin, len, 0x4dff88, len * 0.25, len * 0.15));
    group.add(new THREE.ArrowHelper(toVec3(frame.forward), origin, len, 0x4d9fff, len * 0.25, len * 0.15));
  }, [hierarchy]);

  // Resolve the animation via the AnimationSource priority chain (keyframe-driven preferred,
  // procedural IK fallback) whenever the sign, avatar data, or available reference poses change.
  useEffect(() => {
    if (!hierarchy || !calibration) return;
    setFrameIdx(0);
    try {
      setResult(resolveAnimationForSign(hierarchy, calibration, sign, availablePoses));
    } catch (e) {
      setError(`Animation resolution failed: ${(e as Error).message}`);
    }
  }, [hierarchy, calibration, sign, availablePoses]);

  // Playback clock.
  useEffect(() => {
    if (!playing || !result) return;
    const id = setInterval(() => {
      setFrameIdx((i) => (i + 1) % result.frameCount);
    }, 1000 / result.fps);
    return () => clearInterval(id);
  }, [playing, result]);

  // Apply the current frame's bone rotations to the live Three.js bones — generic over source: both
  // the keyframe animator and the procedural IK resolver emit the same `Record<boneName, Quat>`
  // shape, so this loop doesn't need to know which one produced it.
  useEffect(() => {
    if (!result) return;
    const frameBones = result.frames[frameIdx];
    const bones = boneMeshesRef.current;
    for (const [boneName, q] of Object.entries(frameBones)) {
      const obj = bones.get(stripName(boneName));
      if (obj) obj.quaternion.set(q.x, q.y, q.z, q.w);
    }

    // The IK-specific debug markers (target/achieved/elbow/shoulder) only exist for the procedural
    // path — a keyframe-driven pose has no "target to solve for," the human already posed it.
    const markers = targetMarkersRef.current;
    const dbg = debugMarkersRef.current;
    const setPos = (obj: THREE.Object3D, p: { x: number; y: number; z: number }) => obj.position.set(p.x, p.y, p.z);
    const ikFrame = result.proceduralDetail?.frames[frameIdx];
    const showIkDebug = showDebug && !!ikFrame;

    if (markers && dbg) {
      markers.right.visible = showIkDebug;
      markers.left.visible = showIkDebug && !!ikFrame?.left;
      dbg.shoulderR.visible = showIkDebug;
      dbg.elbowR.visible = showIkDebug;
      dbg.achievedR.visible = showIkDebug;
      dbg.shoulderL.visible = showIkDebug && !!ikFrame?.left;
      dbg.elbowL.visible = showIkDebug && !!ikFrame?.left;
      dbg.achievedL.visible = showIkDebug && !!ikFrame?.left;
      if (ikFrame) {
        setPos(markers.right, ikFrame.right.targetHandWorld);
        setPos(dbg.shoulderR, ikFrame.right.shoulderWorld);
        setPos(dbg.elbowR, ikFrame.right.elbowWorld);
        setPos(dbg.achievedR, ikFrame.right.achievedHandWorld);
        if (ikFrame.left) {
          setPos(markers.left, ikFrame.left.targetHandWorld);
          setPos(dbg.shoulderL, ikFrame.left.shoulderWorld);
          setPos(dbg.elbowL, ikFrame.left.elbowWorld);
          setPos(dbg.achievedL, ikFrame.left.achievedHandWorld);
        }
      }
    }
    if (bodyFrameGroupRef.current) bodyFrameGroupRef.current.visible = showDebug;
  }, [result, frameIdx, showDebug]);

  const ikFrame = result?.proceduralDetail?.frames[frameIdx];

  return (
    <div style={{ display: 'flex', height: '100%', color: '#d7dde8', fontFamily: 'monospace', fontSize: 13 }}>
      <div ref={containerRef} style={{ flex: 1, minWidth: 0 }} />
      <div style={{ width: 340, overflowY: 'auto', padding: 12, background: '#0f131a', borderLeft: '1px solid #2a2f3a' }}>
        {error && <div style={{ color: '#ff6b6b', marginBottom: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <select value={sign} onChange={(e) => setSign(e.target.value)}>
            {availableSigns.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</button>
        </div>
        {result && (
          <div
            style={{
              marginBottom: 8,
              padding: '4px 8px',
              borderRadius: 4,
              display: 'inline-block',
              background: result.source === 'keyframe' ? '#1b3a24' : '#1b212c',
              color: result.source === 'keyframe' ? '#69db7c' : '#ffb84d',
            }}
          >
            Source: {result.source === 'keyframe' ? 'KEYFRAME-DRIVEN (reference poses)' : 'PROCEDURAL IK (fallback — no/1 reference pose yet)'}
          </div>
        )}
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} />
          show debug (shoulders / elbows / achieved wrist / body-frame axes)
        </label>
        {showDebug && (
          <div style={{ marginBottom: 8, fontSize: 11, color: '#8b93a3' }}>
            <div>⚪ white = shoulder origin (per-side, independent)</div>
            <div>🟡 yellow = solved elbow</div>
            <div>🟢 green = achieved wrist (from the IK math)</div>
            <div style={{ color: '#ff4d4d' }}>red arrow = body-frame RIGHT</div>
            <div style={{ color: '#4dff88' }}>green arrow = body-frame UP</div>
            <div style={{ color: '#4d9fff' }}>blue arrow = body-frame FORWARD</div>
            {result?.source === 'keyframe' && <div>(IK debug spheres are hidden — keyframe-driven poses have no IK target to solve for.)</div>}
          </div>
        )}
        {result && (
          <>
            <input
              type="range"
              min={0}
              max={result.frameCount - 1}
              value={frameIdx}
              onChange={(e) => setFrameIdx(Number(e.target.value))}
              style={{ width: '100%', marginBottom: 8 }}
            />
            <div style={{ marginBottom: 8 }}>
              frame {frameIdx + 1}/{result.frameCount} · {result.fps}fps
            </div>
            {result.proceduralDetail && (
              <div style={{ marginBottom: 8, padding: 8, background: '#1b212c', borderRadius: 4 }}>
                <div>
                  <strong>Milestone 5 acceptance (procedural IK)</strong>
                </div>
                <div>max position error: {(result.proceduralDetail.maxPositionErrorMeters * 1000).toFixed(2)}mm</div>
                <div>mean position error: {(result.proceduralDetail.meanPositionErrorMeters * 1000).toFixed(2)}mm</div>
                <div style={{ color: result.proceduralDetail.maxPositionErrorMeters < 0.005 ? '#69db7c' : '#ff6b6b' }}>
                  {result.proceduralDetail.maxPositionErrorMeters < 0.005 ? 'PASS (< 5mm)' : 'FAIL (>= 5mm)'}
                </div>
              </div>
            )}
            {ikFrame && (
              <div style={{ fontSize: 11 }}>
                <div style={{ color: '#ff6b6b' }}>right err: {(ikFrame.right.positionErrorMeters * 1000).toFixed(3)}mm</div>
                {ikFrame.left && <div style={{ color: '#4dd0e1' }}>left err: {(ikFrame.left.positionErrorMeters * 1000).toFixed(3)}mm</div>}
                <div style={{ marginTop: 8, color: '#8b93a3' }}>
                  wireframe spheres = intended target · solid hand mesh = achieved IK pose. They should visually coincide every frame.
                </div>
              </div>
            )}
            {result.source === 'keyframe' && (
              <div style={{ fontSize: 11, color: '#8b93a3' }}>{Object.keys(result.frames[frameIdx]).length} bone(s) animated this frame, interpolated between this sign's reference poses (each pose's notes say whether it was Blender-exported or code-authored).</div>
            )}
          </>
        )}
        {!result && !error && <div>Computing animation…</div>}
      </div>
    </div>
  );
}
