import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { framedBox } from './mockup';

/** A small photo studio: renderer, soft environment light, a key light with soft shadows, and a shadow-catching floor. */
export class Stage {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 2000);
  controls: OrbitControls | null = null;
  key: THREE.DirectionalLight;
  floor: THREE.Mesh;
  content = new THREE.Group();
  private raf = 0;
  private visible = true;
  private dirty = true;
  private settle = 0;
  autoRotate = 0;
  onFrame: ((dt: number) => void) | null = null;
  private last = performance.now();
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  view = { azimuth: -0.55, elevation: 0.42, distance: 1 };

  constructor(public host: HTMLElement, opts: { interactive?: boolean; preserve?: boolean } = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opts.preserve, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.AgXToneMapping; this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%'; this.renderer.domElement.style.display = 'block';
    host.appendChild(this.renderer.domElement);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    this.scene.environmentIntensity = 0.7;
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#d8d2c8', 0.35));
    this.key = new THREE.DirectionalLight('#fff6ea', 2.3);
    this.key.castShadow = true; this.key.shadow.mapSize.set(1024, 1024); this.key.shadow.radius = 14; this.key.shadow.blurSamples = 24; this.key.shadow.bias = -0.0006;
    this.scene.add(this.key, this.key.target);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.22 }));
    this.floor.rotation.x = -Math.PI / 2; this.floor.receiveShadow = true; this.scene.add(this.floor);
    this.scene.add(this.content);
    if (opts.interactive) {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minPolarAngle: 0.15, maxPolarAngle: Math.PI / 2 - 0.05, rotateSpeed: 0.7 });
      this.controls.addEventListener('change', () => (this.dirty = true));
      this.controls.addEventListener('start', () => (this.autoRotate = 0));
    }
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.loop(); }, { rootMargin: '120px' }); this.io.observe(host);
    this.resize(); this.loop();
  }

  /** Replace what is on stage and frame it. Uses the object's preferred angle unless a view was fixed. */
  fixedView = false;
  set(obj: THREE.Object3D, frame = true) {
    for (const c of [...this.content.children]) { this.content.remove(c); dispose(c); }
    this.content.add(obj);
    const v = obj.userData.view as { azimuth: number; elevation: number } | undefined;
    if (v && !this.fixedView) { this.view.azimuth = v.azimuth; this.view.elevation = v.elevation; }
    this.floor.visible = !obj.userData.noFloor && !obj.children.some((c) => c.userData.noFloor);
    if (frame) this.frame();
    this.dirty = true;
  }

  /** Fit the product's projected bounds into the frame (not a bounding sphere, so flat print fills the picture too). */
  frame(fill = 0.82) {
    const box = framedBox(this.content);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3()), r = Math.max(size.length() / 2, 0.5);
    const corners: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
    this.target = box.getCenter(new THREE.Vector3());
    this.view.distance = r * 3;
    const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
    for (let i = 0; i < 6; i++) {
      this.place(); this.camera.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of corners) { const p = c.clone().project(this.camera); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      const halfH = this.view.distance * Math.tan((this.camera.fov * Math.PI) / 360), halfW = halfH * this.camera.aspect;
      this.camera.matrixWorld.extractBasis(right, up, fwd);
      this.target.addScaledVector(right, ((x0 + x1) / 2) * halfW).addScaledVector(up, ((y0 + y1) / 2) * halfH);
      this.view.distance *= Math.max((x1 - x0) / 2, (y1 - y0) / 2) / fill;
    }
    this.place();
    this.floor.scale.set(r * 14, r * 14, 1);
    const k = this.key, c = box.getCenter(new THREE.Vector3());
    k.position.set(c.x + r * 1.4, c.y + r * 5, c.z + r * 2.6); k.target.position.copy(c);
    const sc = k.shadow.camera; sc.left = -r * 2.2; sc.right = r * 2.2; sc.top = r * 2.2; sc.bottom = -r * 2.2; sc.near = 0.1; sc.far = r * 14; sc.updateProjectionMatrix();
    if (this.controls) { this.controls.target.copy(this.target); this.controls.minDistance = this.view.distance * 0.55; this.controls.maxDistance = this.view.distance * 1.8; this.controls.update(); }
  }
  target = new THREE.Vector3();
  place() {
    const { azimuth: a, elevation: e, distance: d } = this.view;
    this.camera.position.set(this.target.x + d * Math.cos(e) * Math.sin(a), this.target.y + d * Math.sin(e), this.target.z + d * Math.cos(e) * Math.cos(a));
    this.camera.lookAt(this.target);
    this.dirty = true;
  }

  resize() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.dirty = true;
  }
  invalidate() { this.dirty = true; }
  private loop = () => {
    cancelAnimationFrame(this.raf);
    if (!this.visible) return;
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (this.autoRotate) { if (this.controls) { this.controls.autoRotate = true; this.controls.autoRotateSpeed = this.autoRotate; } else { this.view.azimuth += this.autoRotate * dt * 0.1; this.place(); } this.dirty = true; }
    else if (this.controls) this.controls.autoRotate = false;
    this.onFrame?.(dt);
    if (this.controls) this.controls.update();
    if (this.dirty) { this.settle = 30; this.dirty = !!this.autoRotate || !!this.controls?.autoRotate; }
    // keep drawing briefly after a change so the last frame always reaches the screen (layers may still be animating)
    if (this.settle > 0) { this.settle--; this.renderer.render(this.scene, this.camera); }
    this.raf = requestAnimationFrame(this.loop);
  };
  renderNow() { this.renderer.render(this.scene, this.camera); }
  destroy() {
    cancelAnimationFrame(this.raf); this.ro.disconnect(); this.io.disconnect(); this.controls?.dispose();
    dispose(this.content); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

export function dispose(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
      mat.dispose();
    }
  });
}

export const webglOk = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };
export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
