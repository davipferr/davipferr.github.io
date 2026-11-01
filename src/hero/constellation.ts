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
  /** Called after every rendered frame, e.g. to draw things that follow a star. */
  onFrame?: () => void;
  /** Boxes (viewport px) that sky labels must not sit on, e.g. the page's text; a label over one fades out. */
  avoid?: () => Iterable<DOMRect>;
}

interface Pulse { sprite: THREE.Sprite; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; wait: number }
/** A line a pulse can run along, in `parent`'s space, between project stars `ends`. */
interface Route { parent: THREE.Object3D; a: THREE.Vector3; b: THREE.Vector3; ends: [number, number]; color: THREE.Color }

/** Where the camera should be: the page sets this as you scroll. */
export interface SkyView {
  /** Moves the sky sideways / up, as a fraction of the screen (+x right, +y up). */
  shiftX: number;
  shiftY: number;
  /** Camera distance relative to the one that fits the whole sky. */
  zoom: number;
}

const ORIGIN = new THREE.Vector2();

/** Hover radius around a star's centre, in CSS pixels. */
const PICK_RADIUS = 22;
/** Seconds between two stars appearing in the opening fade-in. */
const STAGGER = 0.07;

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
  private pointer = new THREE.Vector2(9, 9); // off-screen until the mouse moves
  private parallax = new THREE.Vector2();
  /** `parallax`, eased: what actually tilts the sky. */
  private lean = new THREE.Vector2();
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
  private bySlug = new Map<string, number>();
  /** Star lit from outside the canvas (the project list). */
  private highlighted: number | null = null;
  /** Star the camera flies to (the open project page). */
  private focused: number | null = null;
  private view: SkyView = { shiftX: 0, shiftY: 0, zoom: 1 };
  private shown: SkyView = { shiftX: 0, shiftY: 0, zoom: 1 };
  /** Camera distance that fits the whole sky. */
  private fitDistance = 1;
  private camGoal = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private dust!: THREE.ShaderMaterial;
  private routes: Route[] = [];
  private pulses: Pulse[] = [];
  private meteor = { mesh: null as THREE.Mesh | null, t: -1, wait: 5, from: new THREE.Vector3(), dir: new THREE.Vector3(), dist: 0, len: 0 };

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
    this.layout.nodes.forEach((n, i) => this.bySlug.set(n.project.slug, i));
    this.scene.add(this.sky);
    this.buildStars();
    this.buildBackground();
    this.buildNebulae();
    this.buildMeteor();
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
    this.buildPulses(tex);
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

  /**
   * Faint background stars: round, of different sizes and colours, each
   * twinkling at its own pace. Drawn by a shader so 1400 of them cost one draw call.
   */
  private buildBackground() {
    const n = 1400;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const tint = new Float32Array(n * 3);
    const phase = new Float32Array(n);
    // mostly cool white, some blue, a few warm and violet ones
    const palette = [0xc8d6f0, 0xc8d6f0, 0x9fb6ff, 0x8fd3ff, 0xffe2b8, 0xc7b4ff].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, phi = Math.random() * Math.PI * 2, r = 60 + Math.random() * 80;
      const s = Math.sqrt(1 - u * u);
      pos.set([r * s * Math.cos(phi), r * u, r * s * Math.sin(phi)], i * 3);
      // most are specks, a handful are noticeably bright
      size[i] = 0.55 + Math.pow(Math.random(), 6) * 1.6;
      const c = palette[Math.floor(Math.random() * palette.length)];
      tint.set([c.r, c.g, c.b], i * 3);
      phase[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.dust = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uScale;
        attribute float aSize;
        attribute vec3 aTint;
        attribute float aPhase;
        varying vec3 vTint;
        varying float vAlpha;

        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // two sines at unrelated rates, so the twinkle never looks like a loop
          float rate = 0.5 + fract(aPhase * 3.17) * 1.6;
          float twinkle = 0.6 + 0.4 * sin(uTime * rate + aPhase) * sin(uTime * 0.31 + aPhase * 1.7);
          float px = aSize * uScale / -mv.z;
          // a point under ~1.5px flickers as it moves: keep it that big and dim it instead
          vAlpha = twinkle * min(1.0, px / 1.5);
          gl_PointSize = max(px, 1.5);
          vTint = aTint;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vTint;
        varying float vAlpha;

        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float halo = smoothstep(1.0, 0.0, d);
          halo *= halo;
          float core = smoothstep(0.3, 0.0, d);
          gl_FragColor = vec4(vTint * (halo * 0.7 + core), halo * vAlpha * 0.8);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.scene.add(new THREE.Points(geo, this.dust));
  }

  /**
   * Little sparks that run along the lines between stars now and then, so the
   * sky reads as connected. Only lines between project stars, never to ghosts.
   */
  private buildPulses(tex: THREE.Texture) {
    const v = (p: readonly number[]) => new THREE.Vector3(p[0], p[1], p[2]);
    for (const [i, j] of this.layout.edges) {
      const a = this.layout.nodes[i], b = this.layout.nodes[j];
      this.routes.push({ parent: this.sky, a: v(a.position), b: v(b.position), ends: [i, j], color: new THREE.Color(a.color).lerp(new THREE.Color(b.color), 0.5) });
    }
    this.layout.figures.forEach((fig, f) => {
      for (const [a, b] of fig.zodiac.lines) {
        const i = fig.occupant[a], j = fig.occupant[b];
        if (i < 0 || j < 0) continue;
        this.routes.push({ parent: this.figureGroups[f], a: v(fig.offsets[a]), b: v(fig.offsets[b]), ends: [i, j], color: new THREE.Color(0xe8eeff) });
      }
    });
    if (!this.routes.length) return;
    for (let k = 0; k < 5; k++) {
      const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      this.sky.add(sprite);
      // staggered so they don't all set off together
      this.pulses.push({ sprite, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1, dur: 1, wait: 1.5 + k * 1.3 });
    }
  }

  private launchPulse(p: Pulse) {
    const open = this.routes.filter((r) => !this.dimmed.has(r.ends[0]) && !this.dimmed.has(r.ends[1]));
    if (!open.length) {
      p.wait = 2;
      return;
    }
    const r = open[Math.floor(Math.random() * open.length)];
    const flip = Math.random() < 0.5;
    p.from.copy(flip ? r.b : r.a);
    p.to.copy(flip ? r.a : r.b);
    r.parent.add(p.sprite);
    (p.sprite.material as THREE.SpriteMaterial).color.copy(r.color);
    p.t = 0;
    p.dur = 0.9 + p.from.distanceTo(p.to) * 0.18;
  }

  private updatePulses(dt: number, size: number, calm: boolean) {
    for (const p of this.pulses) {
      if (calm) {
        p.sprite.visible = false;
        continue;
      }
      if (p.t >= 1) {
        p.sprite.visible = false;
        p.wait -= dt;
        if (p.wait > 0) continue;
        this.launchPulse(p);
        if (p.t >= 1) continue;
      }
      p.t = Math.min(1, p.t + dt / p.dur);
      if (p.t >= 1) p.wait = 1.5 + Math.random() * 4;
      const e = p.t * p.t * (3 - 2 * p.t);
      p.sprite.position.lerpVectors(p.from, p.to, e);
      p.sprite.scale.setScalar(size);
      (p.sprite.material as THREE.SpriteMaterial).opacity = Math.sin(Math.PI * p.t) * 0.9;
      p.sprite.visible = true;
    }
  }

  /** A streak of light: the bright head at the origin, the tail fading off along -x. */
  private buildMeteor() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 16;
    const g = c.getContext('2d')!;
    const along = g.createLinearGradient(0, 0, 256, 0);
    along.addColorStop(0, 'rgba(255,255,255,0)');
    along.addColorStop(0.85, 'rgba(255,255,255,0.55)');
    along.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = along;
    g.fillRect(0, 0, 256, 16);
    // thin it towards the edges
    g.globalCompositeOperation = 'destination-in';
    const across = g.createLinearGradient(0, 0, 0, 16);
    across.addColorStop(0, 'rgba(0,0,0,0)');
    across.addColorStop(0.5, 'rgba(0,0,0,1)');
    across.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = across;
    g.fillRect(0, 0, 256, 16);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(1, 1).translate(-0.5, 0, 0);
    this.meteor.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ map: tex, color: 0xe4ecff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.meteor.mesh.visible = false;
    this.meteor.mesh.frustumCulled = false;
    this.scene.add(this.meteor.mesh);
  }

  /** Now and then a shooting star crosses the visible part of the sky, behind the stars. */
  private updateMeteor(dt: number, calm: boolean) {
    const m = this.meteor;
    const mesh = m.mesh!;
    if (m.t < 0) {
      mesh.visible = false;
      m.wait -= dt;
      if (m.wait > 0 || calm) return;
      // what the camera sees at the meteor's depth, with the page's sideways shift
      const z = -45;
      const halfH = (this.camera.position.z - z) * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const halfW = halfH * this.camera.aspect;
      const cx = this.camera.position.x - this.shown.shiftX * 2 * halfW;
      const cy = this.camera.position.y - this.shown.shiftY * 2 * halfH;
      const right = Math.random() < 0.5 ? 1 : -1;
      const angle = 0.25 + Math.random() * 0.35;
      m.dir.set(right * Math.cos(angle), -Math.sin(angle), 0);
      // keep to the right half, away from the hero copy: rightward ones start mid-screen, leftward ones near the right edge
      m.from.set(cx + (right > 0 ? -0.2 + Math.random() * 0.4 : 0.5 + Math.random() * 0.4) * halfW, cy + (0.2 + Math.random() * 0.6) * halfH, z);
      m.dist = halfW * (0.4 + Math.random() * 0.2);
      m.len = halfW * 0.28;
      mesh.rotation.z = Math.atan2(m.dir.y, m.dir.x);
      m.t = 0;
    }
    m.t += dt / 1.1;
    if (m.t >= 1 || calm) {
      m.t = -1;
      m.wait = 8 + Math.random() * 10;
      mesh.visible = false;
      return;
    }
    const e = 1 - (1 - m.t) * (1 - m.t); // fast start, slowing as it burns out
    mesh.position.copy(m.from).addScaledVector(m.dir, m.dist * e);
    mesh.scale.set(m.len * Math.min(1, m.t * 4), m.len * 0.035, 1);
    (mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.PI * Math.min(1, m.t * 1.15)) * 0.85;
    mesh.visible = true;
  }

  /** A few faint coloured clouds far behind the stars, for depth when the camera moves. */
  private buildNebulae() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    // a soft lumpy cloud: overlapping radial blobs, not one perfect disc
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      const x = size * (0.25 + rand() * 0.5), y = size * (0.25 + rand() * 0.5), r = size * (0.12 + rand() * 0.22);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.16)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const clouds: [number, number, number, number, string, number][] = [
      [-38, 14, -70, 90, '#5b6cff', 0.3],
      [42, -10, -80, 110, '#b14fd6', 0.24],
      [6, 30, -95, 120, '#2fb8d8', 0.2],
      [-20, -32, -60, 80, '#d6794f', 0.14],
      [60, 28, -110, 130, '#4f7bd6', 0.2],
    ];
    for (const [x, y, z, scale, color, opacity] of clouds) {
      const m = new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
      const sp = new THREE.Sprite(m);
      sp.position.set(x, y, z);
      sp.scale.setScalar(scale);
      this.scene.add(sp);
    }
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
      // while a project is open the sky holds still; a press only counts as a click
      if (this.drag && this.focused !== null) {
        if (Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 5) this.drag.moved = true;
      } else if (this.drag) {
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
    on(canvas, 'pointerleave', () => this.pointAt(null));

    on(window, 'resize', () => this.resize());
    on(document, 'visibilitychange', () => this.updateLoop());
    const io = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.updateLoop();
    });
    io.observe(this.container);
    this.cleanup.push(() => io.disconnect());
  }

  /**
   * The star nearest the pointer on screen, within PICK_RADIUS. Done in screen
   * space rather than by raycasting the sprites: a sprite's quad is much bigger
   * than the star you see, so in tight figures (Leo) the quads overlapped and the
   * hover jumped between neighbours. The star already hovered gets a head start
   * so two stars at about the same distance don't take turns.
   */
  private pick(): number | null {
    if (Math.abs(this.pointer.x) > 1 || Math.abs(this.pointer.y) > 1) return null;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const px = ((this.pointer.x + 1) / 2) * w, py = ((1 - this.pointer.y) / 2) * h;
    let best: number | null = null;
    let bestD = PICK_RADIUS;
    this.sprites.forEach((s, i) => {
      if (this.dimmed.has(i)) return;
      const v = this.tmp.setFromMatrixPosition(s.matrixWorld).project(this.camera);
      if (v.z > 1) return;
      let d = Math.hypot(((v.x + 1) / 2) * w - px, ((1 - v.y) / 2) * h - py);
      if (i === this.hovered) d *= 0.6;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  /**
   * Tell the sky where the mouse is (viewport px), or null when it isn't over
   * the sky. Needed because scrolling slides the page over a still mouse
   * without any pointer event reaching the canvas.
   */
  pointAt(p: { x: number; y: number } | null) {
    if (!p) {
      this.pointer.set(9, 9);
      this.parallax.set(0, 0);
      return;
    }
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((p.x - r.left) / r.width) * 2 - 1, -((p.y - r.top) / r.height) * 2 + 1);
    this.parallax.copy(this.pointer);
  }

  /** Light a project's star from outside, e.g. while its row in the list is hovered. */
  highlight(slug: string | null) {
    this.highlighted = slug === null ? null : (this.bySlug.get(slug) ?? null);
    if (!this.running) this.frame(0);
  }

  /** Fly the camera to a project's star (null flies back out). */
  focus(slug: string | null) {
    this.focused = slug === null ? null : (this.bySlug.get(slug) ?? null);
  }

  setView(v: SkyView) {
    this.view = v;
  }

  /** Where a project's star is on screen, in px relative to the sky's box. */
  screenPosition(slug: string) {
    const i = this.bySlug.get(slug);
    if (i === undefined) return null;
    const v = this.tmp.setFromMatrixPosition(this.sprites[i].matrixWorld).project(this.camera);
    if (v.z > 1) return null;
    return { x: ((v.x + 1) / 2) * this.container.clientWidth, y: ((1 - v.y) / 2) * this.container.clientHeight };
  }

  /** How many stars have appeared so far in the opening fade-in. */
  appearedCount() {
    if (reducedMotion()) return this.sprites.length;
    return THREE.MathUtils.clamp(Math.floor((this.elapsed - 0.3) / STAGGER) + 1, 0, this.sprites.length);
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
    // gl_PointSize is in device pixels: the same scale PointsMaterial uses for size attenuation
    this.dust.uniforms.uScale.value = (h * this.renderer.getPixelRatio()) / 2;
    this.camera.aspect = w / h;
    // Fit the whole sky, using whichever field of view is narrower.
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    // 0.85: the sky is never edge-on in every direction at once, so a slightly closer camera still fits.
    const distance = (this.fitDistance = (this.layout.extent / Math.sin(Math.min(vfov, hfov) / 2)) * 0.85);
    // smaller stars on narrow screens, where the sky is packed tighter
    this.starScale = distance * 0.06 * (h / Math.max(h, 700)) * Math.min(1, Math.max(w, 450) / 900);
    this.moveCamera(1);
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

  /**
   * Ease the camera towards where the page wants it: shifted and zoomed by the
   * scroll position, or right in front of the focused star. `k` = 1 snaps.
   */
  private moveCamera(k: number) {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    const s = this.shown, v = this.view;
    s.shiftX += (v.shiftX - s.shiftX) * k;
    s.shiftY += (v.shiftY - s.shiftY) * k;
    s.zoom += (v.zoom - s.zoom) * k;
    this.camera.setViewOffset(w, h, -s.shiftX * w, s.shiftY * h, w, h);

    if (this.focused !== null) {
      this.sprites[this.focused].getWorldPosition(this.camGoal);
      this.camGoal.z += this.fitDistance * 0.34;
    } else this.camGoal.set(0, 0, this.fitDistance * s.zoom);
    this.camera.position.lerp(this.camGoal, k);
    this.camera.updateProjectionMatrix();
  }

  private frame(dt: number) {
    const still = reducedMotion();
    this.elapsed += dt;
    // hold still while a star is pointed at or open, so it doesn't drift away
    if (!still && !this.drag && this.hovered === null && this.focused === null) this.spin += dt * 0.04;
    this.moveCamera(still ? 1 : 1 - Math.exp(-dt * 2.6));
    // the sky leans toward the mouse, eased; with a project open it settles and stays put
    this.lean.lerp(this.focused === null ? this.parallax : ORIGIN, still ? 1 : 1 - Math.exp(-dt * 5));

    this.sky.rotation.set(this.tilt + this.lean.y * -0.08, this.spin + this.lean.x * 0.15, 0);
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

    // Closer camera, smaller sprites: zoomed in, stars still grow, just not as fast as the distance shrinks.
    const near = Math.sqrt(this.camera.position.z / this.fitDistance);
    const lit = this.hovered ?? this.highlighted ?? this.focused;
    this.sprites.forEach((s, i) => {
      // fade in one by one on first load
      const appear = still ? 1 : THREE.MathUtils.smoothstep(this.elapsed, 0.3 + i * STAGGER, 0.3 + i * STAGGER + 0.8);
      const pulse = still ? 1 : 1 + Math.sin(this.elapsed * 1.6 + s.userData.phase) * 0.08;
      const dim = this.dimmed.has(i);
      const focus = i === lit ? 1.6 : dim ? 0.7 : 1;
      s.scale.setScalar(this.starScale * near * s.userData.base * appear * pulse * focus);
      (s.material as THREE.SpriteMaterial).opacity = dim ? 0.12 : lit === null || i === lit ? 1 : 0.4;
    });

    for (const g of this.ghosts) g.scale.setScalar(this.starScale * near * 0.45);

    if (!still) this.dust.uniforms.uTime.value = this.elapsed;
    // the extras rest while a project is open, and wait for the opening fade-in
    const calm = still || this.focused !== null || this.appearedCount() < this.sprites.length;
    this.updatePulses(dt, this.starScale * near * 0.32, calm);
    this.updateMeteor(dt, calm);

    this.render();
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
    this.sky.updateMatrixWorld();
    this.opts.onFrame?.();
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const v = new THREE.Vector3();
    /** Screen position of a point given in `parent`'s local space. */
    const toScreen = (p: THREE.Vector3, parent: THREE.Object3D = this.sky) => {
      v.copy(p).applyMatrix4(parent.matrixWorld).project(this.camera);
      return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, front: v.z < 1 };
    };
    // the page's text and header, in the overlay's coordinates
    const box = this.container.getBoundingClientRect();
    const blocks: DOMRect[] = [];
    for (const r of this.opts.avoid?.() ?? []) {
      if (r.width && r.bottom > box.top && r.top < box.bottom) blocks.push(new DOMRect(r.x - box.x, r.y - box.y, r.width, r.height));
    }
    const PAD = 10;
    this.layout.clusters.forEach((c, i) => {
      const s =
        c.figure === undefined
          ? toScreen(new THREE.Vector3(...c.label))
          : toScreen(new THREE.Vector3(0, c.label[1] - this.layout.figures[c.figure].center[1], 0), this.figureGroups[c.figure]);
      const el = this.labels[i];
      el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      const half = el.offsetWidth / 2, top = s.y - el.offsetHeight;
      const covered = blocks.some((b) => s.x + half > b.left - PAD && s.x - half < b.right + PAD && s.y > b.top - PAD && top < b.bottom + PAD);
      el.classList.toggle('covered', covered);
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
