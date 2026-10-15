// The projects sky: every project is a glowing star, clustered by category and
// linked to related projects, or placed on a zodiac constellation. Built entirely from content/projects, so a new
// project from Project Launcher shows up here with no code change.
import * as THREE from 'three';
import type { Project } from '../data/types';
import { layoutConstellation, type Cluster, type Layout } from './layout';

export interface ConstellationOptions {
  onSelect: (p: Project) => void;
  tooltip: (p: Project) => string;
  clusterLabel: (c: Cluster) => string;
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function glowTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.16, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.32, 'rgba(255,255,255,0.3)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Constellation {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  private sky = new THREE.Group();
  private sprites: THREE.Sprite[] = [];
  /** Free stars of zodiac figures: small, dim, not clickable. */
  private ghosts: THREE.Sprite[] = [];
  /** One group per zodiac figure, turned every frame to face the camera. */
  private figureGroups: THREE.Group[] = [];
  private layout: Layout;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(9, 9); // off-screen until the mouse moves
  private parallax = new THREE.Vector2();
  private hovered: number | null = null;
  private labels: HTMLElement[] = [];
  private tooltipEl: HTMLElement;
  private overlay: HTMLElement;
  private running = false;
  private visible = true;
  private raf = 0;
  private clock = new THREE.Clock();
  private elapsed = 0;
  private spin = 0;
  private drag: { x: number; y: number; moved: boolean; spin: number; tilt: number } | null = null;
  private tilt = 0.18;
  /** World size of a star, scaled with camera distance so stars look the same size on any screen. */
  private starScale = 1;
  /** Stars hidden by the page's filters: faded out and not clickable. */
  private dimmed = new Set<number>();
  private lines!: THREE.LineSegments;
  private cleanup: (() => void)[] = [];

  /** Throws if WebGL is unavailable; the caller shows the fallback. */
  constructor(private container: HTMLElement, projects: Project[], private opts: ConstellationOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.append(this.renderer.domElement);

    this.overlay = document.createElement('div');
    this.overlay.className = 'sky-overlay';
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'sky-tooltip';
    this.overlay.append(this.tooltipEl);
    container.append(this.overlay);

    this.layout = layoutConstellation(projects);
    this.scene.add(this.sky);
    this.buildStars();
    this.buildBackground();
    this.buildLabels();
    this.bindEvents();
    this.resize();
  }

  private buildStars() {
    const tex = glowTexture();
    for (const node of this.layout.nodes) {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color: node.color,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      });
      const s = new THREE.Sprite(mat);
      s.position.set(...node.position);
      s.userData.base = node.size;
      s.userData.phase = (node.position[0] * 13.7 + node.position[2] * 7.1) % (Math.PI * 2);
      this.sprites.push(s);
      this.sky.add(s);
    }

    const pos: number[] = [];
    const col: number[] = [];
    const ca = new THREE.Color(), cb = new THREE.Color();
    for (const [i, j] of this.layout.edges) {
      const a = this.layout.nodes[i], b = this.layout.nodes[j];
      pos.push(...a.position, ...b.position);
      ca.set(a.color);
      cb.set(b.color);
      col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const lines = (this.lines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }),
    ));
    this.sky.add(lines);
    this.buildFigures(tex);
  }

  /**
   * Zodiac figures: solid lines between taken stars, dashed lines to free ones.
   * Each figure is a group that always faces the camera, so its shape stays
   * readable however the sky is turned; its project stars move into it.
   */
  private buildFigures(tex: THREE.Texture) {
    const common = { color: 0xc8d6f0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    const solidMat = new THREE.LineBasicMaterial({ ...common, opacity: 0.6 });
    const dashedMat = new THREE.LineDashedMaterial({ ...common, opacity: 0.32, dashSize: 0.25, gapSize: 0.18 });
    const ghostMat = new THREE.SpriteMaterial({ map: tex, color: 0xaab8d8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 });

    for (const fig of this.layout.figures) {
      const group = new THREE.Group();
      group.position.set(...fig.center);
      this.figureGroups.push(group);
      this.sky.add(group);

      const solid: number[] = [];
      const dashed: number[] = [];
      for (const [a, b] of fig.zodiac.lines) {
        const taken = fig.occupant[a] >= 0 && fig.occupant[b] >= 0;
        (taken ? solid : dashed).push(...fig.offsets[a], ...fig.offsets[b]);
      }
      for (const [pts, mat] of [[solid, solidMat], [dashed, dashedMat]] as const) {
        if (!pts.length) continue;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        const l = new THREE.LineSegments(geo, mat);
        l.computeLineDistances();
        group.add(l);
      }

      fig.offsets.forEach((offset, i) => {
        const node = fig.occupant[i];
        const sprite = node >= 0 ? this.sprites[node] : new THREE.Sprite(ghostMat);
        sprite.position.set(...offset);
        group.add(sprite);
        if (node < 0) this.ghosts.push(sprite);
      });
    }
  }

  private buildBackground() {
    const n = 1400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, phi = Math.random() * Math.PI * 2, r = 60 + Math.random() * 80;
      const s = Math.sqrt(1 - u * u);
      pos.set([r * s * Math.cos(phi), r * u, r * s * Math.sin(phi)], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x8090b0, size: 0.35, transparent: true, opacity: 0.55, depthWrite: false }));
    this.scene.add(dust);
  }

  private buildLabels() {
    for (const c of this.layout.clusters) {
      const el = document.createElement('div');
      el.className = `sky-label sky-label-${c.kind}`;
      this.labels.push(el);
      this.overlay.append(el);
    }
    this.refreshText();
  }

  /** Re-render texts after a language switch. */
  refreshText() {
    this.layout.clusters.forEach((c, i) => (this.labels[i].textContent = this.opts.clusterLabel(c)));
    if (this.hovered !== null) this.tooltipEl.innerHTML = this.opts.tooltip(this.layout.nodes[this.hovered].project);
  }

  private bindEvents() {
    const canvas = this.renderer.domElement;
    const on = <K extends keyof DocumentEventMap>(el: HTMLElement | Window | Document, type: K, fn: (e: DocumentEventMap[K]) => void) => {
      el.addEventListener(type, fn as EventListener);
      this.cleanup.push(() => el.removeEventListener(type, fn as EventListener));
    };

    const setPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.parallax.copy(this.pointer);
    };

    on(canvas, 'pointermove', (e) => {
      setPointer(e);
      if (this.drag) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        if (Math.hypot(dx, dy) > 5) this.drag.moved = true;
        this.spin = this.drag.spin + dx * 0.005;
        this.tilt = THREE.MathUtils.clamp(this.drag.tilt + dy * 0.003, -0.6, 0.8);
      }
    });
    on(canvas, 'pointerdown', (e) => {
      setPointer(e);
      this.drag = { x: e.clientX, y: e.clientY, moved: false, spin: this.spin, tilt: this.tilt };
      canvas.setPointerCapture(e.pointerId);
    });
    on(canvas, 'pointerup', (e) => {
      setPointer(e);
      const wasDrag = this.drag?.moved;
      this.drag = null;
      if (wasDrag) return;
      const hit = this.pick();
      if (hit !== null) this.opts.onSelect(this.layout.nodes[hit].project);
    });
    on(canvas, 'pointerleave', () => {
      this.pointer.set(9, 9);
      this.parallax.set(0, 0);
    });

    on(window, 'resize', () => this.resize());
    on(document, 'visibilitychange', () => this.updateLoop());
    const io = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.updateLoop();
    });
    io.observe(this.container);
    this.cleanup.push(() => io.disconnect());
  }

  private pick(): number | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = this.sprites.filter((_, i) => !this.dimmed.has(i));
    const hits = this.raycaster.intersectObjects(targets, false);
    return hits.length ? this.sprites.indexOf(hits[0].object as THREE.Sprite) : null;
  }

  /** Fade out the projects that don't pass `match` (null shows all). */
  setFilter(match: ((p: Project) => boolean) | null) {
    this.dimmed.clear();
    this.layout.nodes.forEach((n, i) => match && !match(n.project) && this.dimmed.add(i));
    (this.lines.material as THREE.LineBasicMaterial).opacity = this.dimmed.size ? 0.08 : 0.28;
    this.layout.clusters.forEach((c, i) => {
      const anyShown = c.members.some((j) => !this.dimmed.has(j));
      this.labels[i].style.opacity = anyShown ? '' : '0.25';
    });
    if (!this.running) this.frame(0);
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Fit the whole sky, using whichever field of view is narrower.
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    // 0.85: the sky is never edge-on in every direction at once, so a slightly closer camera still fits.
    const distance = (this.layout.extent / Math.sin(Math.min(vfov, hfov) / 2)) * 0.85;
    this.camera.position.set(0, 0, distance);
    this.starScale = distance * 0.06 * (h / Math.max(h, 700));
    this.camera.updateProjectionMatrix();
    if (!this.running) this.render();
  }

  start() {
    this.running = true;
    this.updateLoop();
  }

  stop() {
    this.running = false;
    this.updateLoop();
  }

  private updateLoop() {
    const go = this.running && this.visible && !document.hidden;
    if (go && !this.raf) {
      this.clock.getDelta();
      const tick = () => {
        this.raf = requestAnimationFrame(tick);
        this.frame(Math.min(this.clock.getDelta(), 0.1));
      };
      tick();
    } else if (!go && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private frame(dt: number) {
    const still = reducedMotion();
    this.elapsed += dt;
    if (!still && !this.drag) this.spin += dt * 0.04;

    this.sky.rotation.set(this.tilt + this.parallax.y * -0.08, this.spin + this.parallax.x * 0.15, 0);
    // undo the sky's rotation so zodiac figures face the camera (which looks straight down -z)
    const facing = this.sky.quaternion.clone().invert();
    for (const g of this.figureGroups) g.quaternion.copy(facing);
    this.sky.updateMatrixWorld();

    const hit = this.drag?.moved ? null : this.pick();
    if (hit !== this.hovered) {
      this.hovered = hit;
      this.renderer.domElement.style.cursor = hit === null ? '' : 'pointer';
      this.tooltipEl.classList.toggle('show', hit !== null);
      if (hit !== null) this.tooltipEl.innerHTML = this.opts.tooltip(this.layout.nodes[hit].project);
    }

    this.sprites.forEach((s, i) => {
      // fade in one by one on first load
      const appear = still ? 1 : THREE.MathUtils.smoothstep(this.elapsed, i * 0.08, i * 0.08 + 0.8);
      const pulse = still ? 1 : 1 + Math.sin(this.elapsed * 1.6 + s.userData.phase) * 0.08;
      const dim = this.dimmed.has(i);
      const focus = i === this.hovered ? 1.45 : dim ? 0.7 : 1;
      s.scale.setScalar(this.starScale * s.userData.base * appear * pulse * focus);
      (s.material as THREE.SpriteMaterial).opacity = dim ? 0.12 : this.hovered === null || i === this.hovered ? 1 : 0.45;
    });

    for (const g of this.ghosts) g.scale.setScalar(this.starScale * 0.45);

    this.render();
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
    this.sky.updateMatrixWorld();
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const v = new THREE.Vector3();
    /** Screen position of a point given in `parent`'s local space. */
    const toScreen = (p: THREE.Vector3, parent: THREE.Object3D = this.sky) => {
      v.copy(p).applyMatrix4(parent.matrixWorld).project(this.camera);
      return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, front: v.z < 1 };
    };
    this.layout.clusters.forEach((c, i) => {
      const s =
        c.figure === undefined
          ? toScreen(new THREE.Vector3(...c.label))
          : toScreen(new THREE.Vector3(0, c.label[1] - this.layout.figures[c.figure].center[1], 0), this.figureGroups[c.figure]);
      this.labels[i].style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    });
    if (this.hovered !== null) {
      const sprite = this.sprites[this.hovered];
      const s = toScreen(sprite.position, sprite.parent!);
      const left = s.x > w * 0.65;
      this.tooltipEl.style.transform = `translate(${s.x}px, ${s.y}px) translate(${left ? 'calc(-100% - 18px)' : '18px'}, -50%)`;
    }
  }

  dispose() {
    this.stop();
    this.cleanup.forEach((f) => f());
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.LineSegments || o instanceof THREE.Sprite) {
        o.geometry.dispose();
        const m = o.material as THREE.Material & { map?: THREE.Texture };
        m.map?.dispose();
        m.dispose();
      }
    });
    this.renderer.dispose();
    this.container.replaceChildren();
  }
}
