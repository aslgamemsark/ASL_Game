/**
 * AvatarLab: Skeleton Viewer (spec Ch.3 "Validation Tool" — rotate camera, select bone, highlight
 * hierarchy, display axes/quaternion/parent/children). Debug-only, per Rule 18 ("debug inside
 * AvatarLab, not inside the game").
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import type { AvatarHierarchy } from '../calibration/types.ts';

const AVATAR_URL = '/models/avatar/ybot.glb';
const AXIS_LENGTH = 0.06;

export function SkeletonViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hierarchy, setHierarchy] = useState<AvatarHierarchy | null>(null);
  const [selectedBone, setSelectedBone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const boneMeshesRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const highlightRef = useRef<THREE.Object3D | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Load + parse the raw GLB ourselves (reusing the exact same discovery logic as the CLI tool —
  // one source of truth) purely for the hierarchy data/list; Three.js's GLTFLoader loads the SAME
  // file separately for rendering, since it needs the actual mesh/skeleton objects.
  useEffect(() => {
    fetch(AVATAR_URL)
      .then((r) => r.arrayBuffer())
      .then((buffer) => {
        const { json } = parseGlb(buffer);
        setHierarchy(buildHierarchy(json, AVATAR_URL));
      })
      .catch((e) => setError(`Hierarchy parse failed: ${(e as Error).message}`));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
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
          if (obj.name) boneMeshesRef.current.set(obj.name.replace(/^mixamorig:?/i, ''), obj);
        });
      },
      undefined,
      (err) => setError(`GLB render load failed: ${String(err)}`)
    );

    const highlight = new THREE.AxesHelper(AXIS_LENGTH);
    highlight.visible = false;
    scene.add(highlight);
    highlightRef.current = highlight;

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
    // Catches the container's first real layout pass even when this component mounts after a tab
    // switch (not the page's initial load), when `window resize` never fires — see RetargetViewer.tsx.
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

  useEffect(() => {
    const highlight = highlightRef.current;
    if (!highlight) return;
    if (!selectedBone) {
      highlight.visible = false;
      return;
    }
    const target = boneMeshesRef.current.get(selectedBone.replace(/^mixamorig:?/i, ''));
    if (target) {
      target.add(highlight);
      highlight.position.set(0, 0, 0);
      highlight.visible = true;
    }
  }, [selectedBone]);

  const boneNames = hierarchy ? Object.keys(hierarchy.bones).sort() : [];
  const selected = selectedBone && hierarchy ? hierarchy.bones[selectedBone] : null;

  return (
    <div style={{ display: 'flex', height: '100%', color: '#d7dde8', fontFamily: 'monospace', fontSize: 13 }}>
      <div ref={containerRef} style={{ flex: 1, minWidth: 0 }} />
      <div style={{ width: 320, overflowY: 'auto', padding: 12, background: '#0f131a', borderLeft: '1px solid #2a2f3a' }}>
        {error && <div style={{ color: '#ff6b6b', marginBottom: 8 }}>{error}</div>}
        {!hierarchy && !error && <div>Loading skeleton…</div>}
        {hierarchy && (
          <>
            <div style={{ marginBottom: 8 }}>
              <strong>{hierarchy.totalBones}</strong> bones · root: {hierarchy.root ?? 'none'}
            </div>
            {hierarchy.warnings.length > 0 && (
              <div style={{ color: '#ffb84d', marginBottom: 8, fontSize: 11 }}>
                {hierarchy.warnings.length} warning(s) — see console for the CLI report.
              </div>
            )}
            {selected && (
              <div style={{ marginBottom: 12, padding: 8, background: '#1b212c', borderRadius: 4 }}>
                <div>
                  <strong>{selected.name}</strong>
                </div>
                <div>parent: {selected.parent ?? 'none (root)'}</div>
                <div>children: {selected.children.length}</div>
                <div>
                  world: ({selected.worldPosition.x.toFixed(3)}, {selected.worldPosition.y.toFixed(3)}, {selected.worldPosition.z.toFixed(3)})
                </div>
                {selected.length !== null && <div>length: {(selected.length * 100).toFixed(1)}cm</div>}
              </div>
            )}
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {boneNames.map((name) => (
                <div
                  key={name}
                  onClick={() => setSelectedBone(name)}
                  style={{
                    cursor: 'pointer',
                    padding: '2px 4px',
                    background: selectedBone === name ? '#2d6bff33' : 'transparent',
                    borderRadius: 3,
                  }}
                >
                  {name.replace(/^mixamorig:?/i, '')}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
