/* mw-ha-led-line-element — custom:mw-led-line-element
 * Elemento de picture-elements: a FITA LED na planta.
 *
 * Duas formas, o mesmo elemento:
 *  · shape: box  → o retângulo brilhante do YAML original (borda + halo +
 *    tinta interna), pixel a pixel igual ao button-card que ele substitui;
 *  · shape: line → a fita de verdade: um traço que segue N pontos e contorna
 *    quantas paredes forem precisas (segmentos soltos também).
 *
 * Regras herdadas do mw-light-element (armadilhas já pagas):
 *  · DOM montado UMA vez; atualizar = escrever custom property (zero innerHTML);
 *  · folha de estilo única compartilhada por adoptedStyleSheets;
 *  · `set hass` sai em O(1) quando a mudança é de outra entidade;
 *  · nada de `border: N%` (CSS inválido) — espessura em % vira `cqmin`;
 *  · ponteiro puro, sem `click` (nada de tap comido depois do hold);
 *  · animação só em opacity/filter/dashoffset (composição na GPU).
 *
 * JS puro, arquivo único, sem build.
 * Repo: https://github.com/visaodeempresa/mw-ha-led-line-element
 */
(() => {
  "use strict";

  const VERSION = "0.1.0";

  const DEFAULTS = {
    // --- entidade ---
    entity: "",
    name: "",                    // tooltip; vazio = friendly_name
    invert: false,

    // --- forma ---
    shape: "auto",               // auto · line · box  (auto = line se houver pontos)
    points: null,                // "79 88, 95 88, 95 70"  ou  [[79,88],[95,88]]
    segments: null,              // [ pontos, ... ] ou [ {points, color, thickness, closed} ]
    closed: false,               // fecha o traço (fita em volta da cama inteira)

    // --- geometria ---
    left: "", top: "", width: "", height: "",   // só no box (o `style:` do YAML vence)
    border_radius: "16px",
    thickness: "3px",            // espessura da fita ligada ("0.8%" = % da planta)
    thickness_off: "2px",
    cap: "round",                // round · butt · square
    hit_width: "18px",           // largura da área de toque no modo line

    // --- cor ---
    use_light_color: true,       // rgb_color / rgbw / hs / kelvin da própria luz
    color_fallback: "255, 200, 120",  // o mesmo default do YAML original
    color_on: "",                // força uma cor (fita branca ou RGB fixa)
    color_off: "rgba(255, 255, 255, 0.18)",
    color_unavailable: "rgba(255, 60, 60, 0.9)",
    color_unknown: "rgba(255, 60, 60, 0.9)",

    // --- brilho ---
    glow: true,
    glow_scale: 1,               // multiplica os raios (8px/20px do original)
    glow_opacity: 1,             // multiplica os alfas (0.9 / 0.55 / 0.5)
    inner_glow: true,            // o `inset` do box-shadow original
    fill: true,                  // tinta interna do box
    fill_opacity: 0.15,          // o rgba(...,0.15) do original
    soft_edge: 0,                // 0..1 — traço largo e translúcido sob a fita (line)
    dim_by_brightness: false,    // halo obedece o brightness da luz
    opacity: 1,

    // --- traço tracejado ---
    dash_on: "",                 // ex.: "4 3" (unidades = % do comprimento)
    dash_off: "",
    dash_unavailable: "3 3",     // o `dashed` do YAML

    // --- efeitos ---
    animation: "auto",           // auto (segue o effect da luz) · none · breathe ·
                                 // pulse · flicker · fire · strobe · rainbow ·
                                 // chase · comet · scan · twinkle · wave
    animation_speed: 1,
    animation_idle: "none",      // luz sem efeito ativo (fita de cor fixa)
    animation_other: "breathe",  // efeito que o mapa não reconheceu
    animate_when_off: false,
    effect_map: null,            // { "Meu efeito": "chase" }
    spark_color: "rgba(255, 255, 255, 0.92)",

    // --- visibilidade ---
    hide_on: false, hide_off: false,
    hide_unavailable: false, hide_unknown: false,

    // --- ações ---
    tap_action: "toggle",
    hold_action: "more-info",
    double_tap_action: "none",
    lock_when_broken: true,
    optimistic: true,
    haptic: true,
    navigation_path: "", url_path: "", service: "", service_data: null,
  };

  const ON_STATES = new Set(["on", "playing", "home", "open", "active"]);
  const OFF_STATES = new Set(["off", "idle", "standby", "not_home", "closed", "paused"]);

  // efeito da luz (texto livre do driver) → animação do desenho
  const EFFECT_RULES = [
    [/rainbow|arco|colorloop|color.?loop|spectrum|prisma/i, "rainbow"],
    [/comet|meteor|larson|knight/i, "comet"],
    [/scan|bounce|ping.?pong|vaiv/i, "scan"],
    [/chase|run|marquee|theater|sweep|corrid|persegu/i, "chase"],
    [/twinkle|sparkle|glitter|star|snow|estrel|cintil/i, "twinkle"],
    [/strobe|flash|blink|police|pisca/i, "strobe"],
    [/fire|flame|candle|lava|vela|fogo/i, "fire"],
    [/flicker|tremul/i, "flicker"],
    [/wave|ocean|water|sea|aurora|onda/i, "wave"],
    [/music|sound|rhythm|beat|pulse|batid|pulso/i, "pulse"],
    [/breath|fade|smooth|gradual|respir|suave/i, "breathe"],
  ];
  const NO_EFFECT = /^(none|off|solid|static|nenhum|desligad|fixo)/i;

  // duração base de cada animação (segundos)
  const ANIM_DUR = {
    breathe: 3.4, pulse: 1.2, flicker: 0.9, fire: 1.4, strobe: 0.7,
    rainbow: 6, chase: 2.2, comet: 2.6, scan: 3, twinkle: 1.6, wave: 4,
  };

  const CSS = `
:host{position:absolute;box-sizing:border-box;display:block;
  container-type:size;contain:layout style;
  opacity:var(--mw-op,1);cursor:var(--mw-cursor,pointer);
  touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;}
:host([mw-hidden]){display:none;}
:host([mw-shape="line"]){left:0;top:0;width:100%;height:100%;
  transform:none;pointer-events:none;}
svg{position:absolute;inset:0;width:100%;height:100%;display:block;overflow:visible;}
path{fill:none;vector-effect:non-scaling-stroke;
  stroke-linecap:var(--mw-cap,round);stroke-linejoin:round;}
.fill{fill:var(--mw-fill,transparent);stroke:none;transition:fill .26s ease;}
.soft{stroke:var(--mw-color,transparent);stroke-width:calc(var(--mw-w,3px) * 3);
  opacity:var(--mw-soft,0);transition:stroke .26s ease,opacity .26s ease;}
.core{stroke:var(--mw-color,transparent);stroke-width:var(--mw-w,3px);
  stroke-dasharray:var(--mw-dash,none);filter:var(--mw-glow,none);
  transition:stroke .26s ease,stroke-width .26s ease;}
.spark{stroke:var(--mw-spark,transparent);stroke-width:calc(var(--mw-w,3px) * .8);
  stroke-dasharray:12 88;opacity:0;}
.hit{stroke:transparent;stroke-width:var(--mw-hit,18px);pointer-events:stroke;}
.box{position:absolute;inset:0;overflow:hidden;
  border-radius:var(--mw-radius,16px);
  background:var(--mw-fill,transparent);
  border:var(--mw-border,none);
  box-shadow:var(--mw-shadow,none);
  transition:background .26s ease,border-color .26s ease,box-shadow .26s ease;}
.sweep{position:absolute;inset:-20%;opacity:0;pointer-events:none;
  background:linear-gradient(100deg,transparent 38%,var(--mw-spark,#fff) 50%,transparent 62%);}

/* ---- animações (opacity/filter/dashoffset: tudo composto na GPU) ---- */
:host([anim="breathe"]) .fx,:host([anim="breathe"]) .box{
  animation:mw-breathe var(--mw-dur,3.4s) ease-in-out infinite;}
:host([anim="wave"]) .fx,:host([anim="wave"]) .box{
  animation:mw-breathe var(--mw-dur,4s) cubic-bezier(.4,0,.6,1) infinite;}
:host([anim="pulse"]) .fx,:host([anim="pulse"]) .box{
  animation:mw-pulse var(--mw-dur,1.2s) ease-in-out infinite;}
:host([anim="flicker"]) .fx,:host([anim="flicker"]) .box{
  animation:mw-flicker var(--mw-dur,.9s) steps(1,end) infinite;}
:host([anim="fire"]) .fx,:host([anim="fire"]) .box{
  animation:mw-fire var(--mw-dur,1.4s) steps(1,end) infinite;}
:host([anim="strobe"]) .fx,:host([anim="strobe"]) .box{
  animation:mw-strobe var(--mw-dur,.7s) steps(1,end) infinite;}
:host([anim="rainbow"]) .fx,:host([anim="rainbow"]) .box{
  animation:mw-rainbow var(--mw-dur,6s) linear infinite;}
:host([anim="chase"]) .spark,:host([anim="comet"]) .spark,
:host([anim="twinkle"]) .spark{opacity:1;
  animation:mw-run var(--mw-dur,2.2s) linear infinite;}
:host([anim="scan"]) .spark{opacity:1;
  animation:mw-run var(--mw-dur,3s) ease-in-out infinite alternate;}
:host([anim="comet"]) .spark{stroke-dasharray:26 74;}
:host([anim="twinkle"]) .spark{stroke-dasharray:1.5 6;stroke-linecap:round;}
:host([anim="chase"]) .sweep,:host([anim="comet"]) .sweep,
:host([anim="scan"]) .sweep,:host([anim="twinkle"]) .sweep{
  animation:mw-sweep var(--mw-dur,2.2s) linear infinite;}
@keyframes mw-breathe{0%,100%{opacity:1}50%{opacity:.38}}
@keyframes mw-pulse{0%,100%{opacity:1}45%{opacity:.62}}
@keyframes mw-flicker{0%{opacity:1}12%{opacity:.55}24%{opacity:.95}
  38%{opacity:.3}52%{opacity:1}66%{opacity:.7}80%{opacity:1}92%{opacity:.45}}
@keyframes mw-fire{0%{opacity:1;filter:hue-rotate(0deg)}
  20%{opacity:.72;filter:hue-rotate(-8deg)}40%{opacity:1;filter:hue-rotate(6deg)}
  60%{opacity:.6;filter:hue-rotate(-4deg)}80%{opacity:.9;filter:hue-rotate(8deg)}
  100%{opacity:1;filter:hue-rotate(0deg)}}
@keyframes mw-strobe{0%,45%{opacity:1}50%,100%{opacity:.06}}
@keyframes mw-rainbow{0%{filter:hue-rotate(0deg)}100%{filter:hue-rotate(360deg)}}
@keyframes mw-run{0%{stroke-dashoffset:100}100%{stroke-dashoffset:0}}
@keyframes mw-sweep{0%{opacity:0;transform:translateX(-120%)}
  15%{opacity:.75}85%{opacity:.75}100%{opacity:0;transform:translateX(120%)}}
@media (prefers-reduced-motion:reduce){
  .fx,.box,.spark,.sweep{animation:none!important;}
  .fill,.soft,.core{transition:none;}}`;

  let SHEET;
  const sharedSheet = () => {
    if (SHEET !== undefined) return SHEET;
    try {
      const s = new CSSStyleSheet();
      s.replaceSync(CSS);
      SHEET = s;
    } catch (e) { SHEET = null; }
    return SHEET;
  };

  const resolveMode = (raw, invert) => {
    if (raw === undefined || raw === null || raw === "unavailable") return "unavailable";
    if (raw === "unknown" || raw === "") return "unknown";
    let on = ON_STATES.has(raw) ? true : OFF_STATES.has(raw) ? false : null;
    if (on === null) return "unknown";
    if (invert) on = !on;
    return on ? "on" : "off";
  };

  /* ------------------------------------------------------------ cores */
  // "255,200,120" · "#ffcc88" · "rgb(...)" · nome CSS → [r,g,b] quando dá
  const toRgb = (v) => {
    if (Array.isArray(v)) return v.slice(0, 3).map(Number);
    const s = String(v || "").trim();
    let m = s.match(/^rgba?\(([^)]+)\)$/i) || s.match(/^([\d.\s,]+)$/);
    if (m) {
      const p = m[1].split(",").map((x) => parseFloat(x.trim()));
      if (p.length >= 3 && p.every((n) => !isNaN(n))) return p.slice(0, 3);
    }
    m = s.match(/^#([0-9a-fA-F]{3,8})$/);
    if (m) {
      let h = m[1];
      if (h.length === 3 || h.length === 4) h = h.split("").map((x) => x + x).join("");
      const n = parseInt(h.slice(0, 6), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return null;
  };

  const rgba = (rgb, a) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
  const rgbs = (rgb) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

  // aproximação de Tanner Helland — fita em branco quente/frio vira cor de verdade
  const kelvinRgb = (k) => {
    const t = Math.max(1000, Math.min(12000, Number(k) || 2700)) / 100;
    const cl = (n) => Math.max(0, Math.min(255, Math.round(n)));
    const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
    const g = t <= 66 ? 99.47 * Math.log(t) - 161.12
      : 288.12 * Math.pow(t - 60, -0.0755);
    const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
    return [cl(r), cl(g), cl(b)];
  };

  const hsRgb = (h, s) => {
    const S = (Number(s) || 0) / 100, H = ((Number(h) || 0) % 360) / 60;
    const c = S, x = c * (1 - Math.abs((H % 2) - 1));
    const t = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(H) % 6];
    const m = 1 - c;
    return t.map((v) => Math.round((v + m) * 255));
  };

  // a cor que a fita está mostrando agora, direto dos atributos da luz
  const lightRgb = (a) => {
    if (!a) return null;
    if (Array.isArray(a.rgb_color)) return a.rgb_color.slice(0, 3).map(Number);
    const w = a.rgbww_color || a.rgbw_color;
    if (Array.isArray(w)) {
      const c = w.slice(0, 3).map(Number);
      if (c.some((n) => n > 0)) return c;
      return kelvinRgb(a.color_temp_kelvin || 2700);
    }
    if (Array.isArray(a.hs_color)) return hsRgb(a.hs_color[0], a.hs_color[1]);
    if (a.color_temp_kelvin) return kelvinRgb(a.color_temp_kelvin);
    if (a.color_temp) return kelvinRgb(1e6 / Number(a.color_temp));
    return null;
  };

  /* --------------------------------------------------------- geometria */
  // aceita "79 88, 95 88", [[79,88],...], [{x,y},...], ["79,88", ...]
  const parsePoints = (v) => {
    if (!v) return [];
    if (typeof v === "string") {
      const n = v.match(/-?\d+(?:\.\d+)?/g) || [];
      const out = [];
      for (let i = 0; i + 1 < n.length; i += 2) out.push([+n[i], +n[i + 1]]);
      return out;
    }
    if (!Array.isArray(v)) return [];
    // [79,88,95,88] achatado
    if (v.every((p) => typeof p === "number")) return parsePoints(v.join(" "));
    return v.map((p) => {
      if (Array.isArray(p)) return [parseFloat(p[0]), parseFloat(p[1])];
      if (p && typeof p === "object") return [parseFloat(p.x), parseFloat(p.y)];
      const n = String(p).match(/-?\d+(?:\.\d+)?/g) || [];
      return [parseFloat(n[0]), parseFloat(n[1])];
    }).filter((p) => !isNaN(p[0]) && !isNaN(p[1]));
  };

  const pathOf = (pts, closed) => {
    if (pts.length < 2) return "";
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
    return closed ? d + " Z" : d;
  };

  // "%" acompanha a planta (cqmin); número puro vira px; resto passa direto
  const len = (v, fb) => {
    const s = String(v === null || v === undefined || v === "" ? fb : v).trim();
    if (/%$/.test(s)) return `${parseFloat(s)}cqmin`;
    if (/^-?[\d.]+$/.test(s)) return `${s}px`;
    return s;
  };

  const fire = (node, type, detail) => {
    node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  };

  /* ------------------------------------------------------------ element */
  class MwLedLineElement extends HTMLElement {
    static getStubConfig() {
      return {
        type: "custom:mw-led-line-element", entity: "",
        points: "30 70, 70 70, 70 40",
      };
    }

    static getConfigElement() {
      return document.createElement("mw-led-line-element-editor");
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._props = {};
      this._bindPointer();
    }

    _bindPointer() {
      let t0 = 0, x0 = 0, y0 = 0, held = false, timer = null, tapTimer = null, taps = 0;
      const clear = () => { clearTimeout(timer); timer = null; };

      this.addEventListener("pointerdown", (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        held = false; t0 = e.timeStamp; x0 = e.clientX; y0 = e.clientY;
        clear();
        timer = setTimeout(() => {
          held = true;
          this._haptic("medium");
          this._run(this._cfg && this._cfg.hold_action, false);
        }, 480);
      });

      const end = (e) => {
        clear();
        if (held) { held = false; return; }
        const moved = Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) > 12;
        if (moved || e.timeStamp - t0 > 900) return;
        e.stopPropagation();
        const dbl = this._cfg && this._cfg.double_tap_action;
        const hasDbl = String(typeof dbl === "string" ? dbl : (dbl || {}).action) !== "none";
        if (!hasDbl) { this._tap(); return; }
        taps += 1;
        if (taps === 1) tapTimer = setTimeout(() => { taps = 0; this._tap(); }, 230);
        else { clearTimeout(tapTimer); taps = 0; this._run(dbl, true); }
      };
      this.addEventListener("pointerup", end);
      this.addEventListener("pointercancel", () => { clear(); held = false; });
      this.addEventListener("pointerleave", () => { clear(); });
      this.addEventListener("click", (e) => e.stopPropagation());
    }

    _tap() {
      this._haptic("light");
      this._run(this._cfg && this._cfg.tap_action, true);
    }

    _haptic(kind) { if (this._cfg && this._cfg.haptic) fire(this, "haptic", kind); }

    setConfig(config) {
      if (!config || !config.entity) throw new Error("mw-led-line-element: informe 'entity'");
      const c = { ...DEFAULTS, ...config };
      this._cfg = c;

      // segmentos: `points` é o atalho de um segmento só
      let segs = [];
      if (Array.isArray(c.segments) && c.segments.length) {
        segs = c.segments.map((s) => {
          const o = (s && !Array.isArray(s) && typeof s === "object") ? s : { points: s };
          return {
            pts: parsePoints(o.points),
            closed: o.closed === undefined ? !!c.closed : !!o.closed,
            color: o.color || "",
            thickness: o.thickness || "",
          };
        }).filter((s) => s.pts.length >= 2);
      }
      const p = parsePoints(c.points);
      if (p.length >= 2) segs.unshift({ pts: p, closed: !!c.closed, color: "", thickness: "" });
      this._segs = segs;

      this._shape = c.shape === "auto" ? (segs.length ? "line" : "box") : c.shape;
      this.setAttribute("mw-shape", this._shape);

      this._props = {};
      this._st = undefined;
      this._mode = null;
      this._built = false;
      this.shadowRoot.innerHTML = "";
      this._applyGeometry();
      this._update();
    }

    getCardSize() { return 1; }

    set hass(hass) {
      const first = !this._hass;
      this._hass = hass;
      if (!this._cfg) return;
      const st = hass && hass.states[this._cfg.entity];
      // o HA empurra `hass` a cada mudança de QUALQUER entidade
      if (!first && st === this._st) return;
      this._st = st;
      if (this._opt) this._clearOptimistic();
      this._update();
    }

    get hass() { return this._hass; }

    connectedCallback() { if (this._cfg) { this._applyGeometry(); this._update(); } }

    disconnectedCallback() { clearTimeout(this._optTimer); }

    // o picture-elements escreve o `style:` do YAML no host depois de criar o
    // elemento; no modo line a planta inteira é a tela, então cravamos.
    _applyGeometry() {
      const c = this._cfg;
      if (this._shape === "line") {
        [["left", "0"], ["top", "0"], ["width", "100%"], ["height", "100%"],
         ["transform", "none"]].forEach(([k, v]) => this.style.setProperty(k, v, "important"));
        return;
      }
      const set = (p, v) => {
        if (v === "" || v === null || v === undefined) return;
        this.style.setProperty(p, String(v));
      };
      set("left", c.left); set("top", c.top);
      set("width", c.width); set("height", c.height);
      if (c.left !== "" || c.top !== "") set("transform", "translate(-50%, -50%)");
    }

    _build() {
      const root = this.shadowRoot;
      const sheet = sharedSheet();
      if (sheet && "adoptedStyleSheets" in root) root.adoptedStyleSheets = [sheet];
      else {
        const st = document.createElement("style");
        st.textContent = CSS;
        root.appendChild(st);
      }
      if (this._shape === "line") this._buildLine(root);
      else this._buildBox(root);
      this._built = true;
    }

    _buildBox(root) {
      const box = document.createElement("div");
      box.className = "box";
      const sweep = document.createElement("div");
      sweep.className = "sweep";
      box.appendChild(sweep);
      root.appendChild(box);
    }

    _buildLine(root) {
      const NS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("preserveAspectRatio", "none");
      const fx = document.createElementNS(NS, "g");
      fx.setAttribute("class", "fx");
      const hits = document.createElementNS(NS, "g");

      this._segs.forEach((s) => {
        const d = pathOf(s.pts, s.closed);
        if (!d) return;
        const mk = (cls, parent) => {
          const p = document.createElementNS(NS, "path");
          p.setAttribute("class", cls);
          p.setAttribute("d", d);
          p.setAttribute("pathLength", "100");
          if (s.color) p.style.setProperty("--mw-color", s.color);
          if (s.thickness) p.style.setProperty("--mw-w", len(s.thickness, "3px"));
          parent.appendChild(p);
          return p;
        };
        if (s.closed) mk("fill", fx);
        mk("soft", fx);
        mk("core", fx);
        mk("spark", fx);
        mk("hit", hits);
      });

      svg.appendChild(fx);
      svg.appendChild(hits);
      root.appendChild(svg);
    }

    _set(prop, val) {
      const v = val === null || val === undefined ? "" : String(val);
      if (this._props[prop] === v) return;
      this._props[prop] = v;
      if (v === "") this.style.removeProperty(prop);
      else this.style.setProperty(prop, v);
    }

    _optimisticToggle() {
      if (!this._cfg.optimistic) return;
      this._opt = this._mode === "on" ? "off" : "on";
      clearTimeout(this._optTimer);
      this._optTimer = setTimeout(() => { this._opt = null; this._update(); }, 2500);
      this._update();
    }

    _clearOptimistic() { this._opt = null; clearTimeout(this._optTimer); }

    _run(spec, guarded) {
      const c = this._cfg;
      if (!c || !this._hass) return;
      if (guarded && c.lock_when_broken
        && (this._mode === "unavailable" || this._mode === "unknown")) return;
      const a = typeof spec === "string" ? { action: spec } : (spec || { action: "none" });
      switch (a.action) {
        case "none": return;
        case "toggle":
          this._optimisticToggle();
          this._hass.callService("homeassistant", "toggle",
            { entity_id: a.entity_id || c.entity });
          return;
        case "call-service":
        case "perform-action": {
          const svc = a.perform_action || a.service || c.service;
          if (!svc || svc.indexOf(".") < 0) return;
          const [dom, srv] = svc.split(".");
          this._hass.callService(dom, srv,
            a.data || a.service_data || c.service_data || {}, a.target);
          return;
        }
        case "navigate": {
          const path = a.navigation_path || c.navigation_path;
          if (!path) return;
          history.pushState(null, "", path);
          fire(window, "location-changed", { replace: false });
          return;
        }
        case "url": {
          const url = a.url_path || c.url_path;
          if (url) window.open(url, a.new_tab === false ? "_self" : "_blank");
          return;
        }
        default:
          fire(this, "hass-more-info", { entityId: a.entity || c.entity });
      }
    }

    // efeito ativo da luz → animação (auto), respeitando o mapa do usuário
    _animOf(attrs, mode) {
      const c = this._cfg;
      if (c.animation !== "auto") return c.animation || "none";
      if (mode !== "on" && !c.animate_when_off) return "none";
      const eff = attrs && attrs.effect;
      if (!eff || NO_EFFECT.test(String(eff))) return c.animation_idle;
      const map = c.effect_map || {};
      if (map[eff]) return map[eff];
      const hit = EFFECT_RULES.find(([re]) => re.test(String(eff)));
      return hit ? hit[1] : c.animation_other;
    }

    _update() {
      const c = this._cfg;
      if (!c || !this._hass) return;
      if (!this._built) this._build();

      const st = this._st;
      const attrs = (st && st.attributes) || {};
      const real = resolveMode(st && st.state, c.invert);
      const mode = this._opt && (real === "on" || real === "off") ? this._opt : real;
      if (this._opt && this._opt === real) this._clearOptimistic();
      this._mode = mode;

      if (mode !== this.getAttribute("mode")) this.setAttribute("mode", mode);
      if (c[`hide_${mode}`]) this.setAttribute("mw-hidden", "");
      else this.removeAttribute("mw-hidden");

      const on = mode === "on";
      const bad = mode === "unavailable" || mode === "unknown";
      const fb = toRgb(c.color_fallback) || [255, 200, 120];
      const forced = c.color_on ? toRgb(c.color_on) : null;
      const rgb = on
        ? (forced || (c.use_light_color ? (lightRgb(attrs) || fb) : fb))
        : null;

      // brilho da luz: só mexe no halo, nunca some com a fita
      const bri = c.dim_by_brightness && on && attrs.brightness != null
        ? Math.max(0, Math.min(255, Number(attrs.brightness))) : null;
      const dim = bri === null ? 1 : 0.45 + 0.55 * (bri / 255);
      const ga = (a) => Math.max(0, Math.min(1, a * c.glow_opacity * dim));
      const gs = (px) => `${(px * c.glow_scale).toFixed(1)}px`;

      const stroke = on ? (rgb ? rgbs(rgb) : c.color_on)
        : bad ? c[`color_${mode}`] : c.color_off;

      this._set("--mw-op", c.opacity);
      this._set("--mw-cap", c.cap);
      this._set("--mw-color", stroke);
      this._set("--mw-w", len(on ? c.thickness : c.thickness_off, "2px"));
      this._set("--mw-radius", c.border_radius);
      this._set("--mw-hit", len(c.hit_width, "18px"));
      this._set("--mw-spark", c.spark_color);
      this._set("--mw-dash", on ? (c.dash_on || "none")
        : bad ? (c.dash_unavailable || "none") : (c.dash_off || "none"));
      this._set("--mw-soft", on && rgb ? c.soft_edge * dim : 0);
      this._set("--mw-fill", on && rgb && c.fill ? rgba(rgb, c.fill_opacity) : "transparent");

      // ---- o box, idêntico ao YAML original ----
      if (this._shape === "box") {
        const border = on && rgb ? `${len(c.thickness, "3px")} solid ${rgbs(rgb)}`
          : bad ? `${len(c.thickness_off, "2px")} dashed ${c[`color_${mode}`]}`
            : `${len(c.thickness_off, "2px")} solid ${c.color_off}`;
        let shadow = "none";
        if (c.glow && on && rgb) {
          shadow = `0 0 ${gs(8)} ${gs(2)} ${rgba(rgb, ga(0.9))},`
            + `0 0 ${gs(20)} ${gs(6)} ${rgba(rgb, ga(0.55))}`
            + (c.inner_glow ? `,inset 0 0 ${gs(12)} ${gs(2)} ${rgba(rgb, ga(0.5))}` : "");
        } else if (c.glow && bad) {
          const r = toRgb(c[`color_${mode}`]) || [255, 60, 60];
          shadow = `0 0 ${gs(8)} ${gs(2)} ${rgba(r, 0.5)}`;
        }
        this._set("--mw-border", border);
        this._set("--mw-shadow", shadow);
      } else {
        // ---- a fita: o mesmo halo, agora em volta do traço ----
        let glow = "none";
        if (c.glow && on && rgb) {
          glow = `drop-shadow(0 0 ${gs(6)} ${rgba(rgb, ga(0.9))})`
            + ` drop-shadow(0 0 ${gs(16)} ${rgba(rgb, ga(0.55))})`;
        } else if (c.glow && bad) {
          const r = toRgb(c[`color_${mode}`]) || [255, 60, 60];
          glow = `drop-shadow(0 0 ${gs(6)} ${rgba(r, 0.5)})`;
        }
        this._set("--mw-glow", glow);
      }

      // ---- efeitos ----
      const anim = this._animOf(attrs, mode);
      const use = anim && anim !== "none" && (on || c.animate_when_off) ? anim : "none";
      if (this.getAttribute("anim") !== use) this.setAttribute("anim", use);
      const base = ANIM_DUR[use];
      this._set("--mw-dur", base ? `${(base / (c.animation_speed || 1)).toFixed(2)}s` : "");

      const tap = typeof c.tap_action === "string" ? c.tap_action : (c.tap_action || {}).action;
      const locked = c.lock_when_broken && bad;
      this._set("--mw-cursor", String(tap) !== "none" && !locked ? "pointer" : "default");

      const title = c.name || attrs.friendly_name || c.entity;
      if (this.title !== title) this.title = title;
    }
  }

  /* ---------------------------------------------------------------- editor */
  const LABELS = {
    entity: "Entidade", name: "Nome (tooltip)", shape: "Forma",
    points: "Pontos (x y, x y, …)", segments: "Segmentos (avançado)",
    closed: "Fechar o traço", left: "Esquerda", top: "Topo",
    width: "Largura", height: "Altura", border_radius: "Canto (box)",
    thickness: "Espessura ligada", thickness_off: "Espessura apagada",
    cap: "Ponta do traço", hit_width: "Área de toque",
    use_light_color: "Usar a cor da luz", color_fallback: "Cor de reserva",
    color_on: "Cor fixa (RGB/branco)", color_off: "Cor apagada",
    color_unavailable: "Cor indisponível", color_unknown: "Cor desconhecida",
    glow: "Halo", glow_scale: "Tamanho do halo", glow_opacity: "Força do halo",
    inner_glow: "Halo interno (box)", fill: "Tinta interna",
    fill_opacity: "Opacidade da tinta", soft_edge: "Borda difusa (fita)",
    dim_by_brightness: "Halo pelo brilho", opacity: "Opacidade",
    dash_on: "Tracejado ligada", dash_off: "Tracejado apagada",
    dash_unavailable: "Tracejado indisponível",
    animation: "Efeito", animation_speed: "Velocidade",
    animation_idle: "Sem efeito ativo", animation_other: "Efeito desconhecido",
    animate_when_off: "Animar apagada", effect_map: "Mapa de efeitos",
    spark_color: "Cor do brilho corrido", invert: "Inverter estado",
    hide_off: "Esconder apagada", hide_unavailable: "Esconder indisponível",
    lock_when_broken: "Travar toque se indisponível", optimistic: "Resposta otimista",
    haptic: "Vibração", tap_action: "Toque", hold_action: "Toque longo",
    double_tap_action: "Toque duplo",
  };

  const ANIM_OPTIONS = [
    { value: "auto", label: "Automático (segue o efeito da luz)" },
    { value: "none", label: "Nenhum (cor fixa)" },
    { value: "breathe", label: "Respiração" },
    { value: "pulse", label: "Pulso" },
    { value: "wave", label: "Onda" },
    { value: "flicker", label: "Tremulação" },
    { value: "fire", label: "Fogo" },
    { value: "strobe", label: "Estrobo" },
    { value: "rainbow", label: "Arco-íris" },
    { value: "chase", label: "Corrida" },
    { value: "comet", label: "Cometa" },
    { value: "scan", label: "Vaivém" },
    { value: "twinkle", label: "Cintilar" },
  ];
  const IDLE_OPTIONS = ANIM_OPTIONS.filter((o) => o.value !== "auto");

  const SCHEMA = [
    { name: "entity", required: true, selector: { entity: { domain: ["light", "switch", "input_boolean", "fan"] } } },
    { name: "name", selector: { text: {} } },
    {
      type: "grid", name: "", schema: [
        {
          name: "shape", selector: {
            select: {
              mode: "dropdown", options: [
                { value: "auto", label: "Automático" },
                { value: "line", label: "Fita (pontos)" },
                { value: "box", label: "Caixa (retângulo)" },
              ],
            },
          },
        },
        { name: "closed", selector: { boolean: {} } },
      ],
    },
    { name: "points", selector: { text: {} } },
    {
      type: "grid", name: "", schema: [
        { name: "thickness", selector: { text: {} } },
        { name: "thickness_off", selector: { text: {} } },
      ],
    },
    {
      type: "grid", name: "", schema: [
        { name: "animation", selector: { select: { mode: "dropdown", options: ANIM_OPTIONS } } },
        { name: "animation_speed", selector: { number: { min: 0.1, max: 5, step: 0.1, mode: "box" } } },
      ],
    },
    {
      type: "grid", name: "", schema: [
        { name: "use_light_color", selector: { boolean: {} } },
        { name: "glow", selector: { boolean: {} } },
        { name: "fill", selector: { boolean: {} } },
        { name: "dim_by_brightness", selector: { boolean: {} } },
      ],
    },
    {
      type: "expandable", name: "", title: "Cores", schema: [
        {
          type: "grid", name: "", schema: [
            { name: "color_on", selector: { text: {} } },
            { name: "color_fallback", selector: { text: {} } },
            { name: "color_off", selector: { text: {} } },
            { name: "color_unavailable", selector: { text: {} } },
            { name: "spark_color", selector: { text: {} } },
            { name: "opacity", selector: { number: { min: 0, max: 1, step: 0.05, mode: "box" } } },
          ],
        },
      ],
    },
    {
      type: "expandable", name: "", title: "Halo e ajuste fino", schema: [
        {
          type: "grid", name: "", schema: [
            { name: "glow_scale", selector: { number: { min: 0, max: 4, step: 0.05, mode: "box" } } },
            { name: "glow_opacity", selector: { number: { min: 0, max: 2, step: 0.05, mode: "box" } } },
            { name: "fill_opacity", selector: { number: { min: 0, max: 1, step: 0.01, mode: "box" } } },
            { name: "soft_edge", selector: { number: { min: 0, max: 1, step: 0.05, mode: "box" } } },
            { name: "inner_glow", selector: { boolean: {} } },
            { name: "invert", selector: { boolean: {} } },
          ],
        },
        {
          type: "grid", name: "", schema: [
            { name: "border_radius", selector: { text: {} } },
            { name: "cap", selector: { select: { mode: "dropdown", options: [
              { value: "round", label: "Arredondada" },
              { value: "butt", label: "Reta" },
              { value: "square", label: "Quadrada" },
            ] } } },
            { name: "dash_on", selector: { text: {} } },
            { name: "hit_width", selector: { text: {} } },
          ],
        },
      ],
    },
    {
      type: "expandable", name: "", title: "Efeitos (avançado)", schema: [
        {
          type: "grid", name: "", schema: [
            { name: "animation_idle", selector: { select: { mode: "dropdown", options: IDLE_OPTIONS } } },
            { name: "animation_other", selector: { select: { mode: "dropdown", options: IDLE_OPTIONS } } },
            { name: "animate_when_off", selector: { boolean: {} } },
            { name: "hide_off", selector: { boolean: {} } },
          ],
        },
        { name: "effect_map", selector: { object: {} } },
      ],
    },
    {
      type: "expandable", name: "", title: "Geometria da caixa / segmentos", schema: [
        {
          type: "grid", name: "", schema: [
            { name: "left", selector: { text: {} } },
            { name: "top", selector: { text: {} } },
            { name: "width", selector: { text: {} } },
            { name: "height", selector: { text: {} } },
          ],
        },
        { name: "segments", selector: { object: {} } },
      ],
    },
    {
      type: "expandable", name: "", title: "Ações", schema: [
        { name: "tap_action", selector: { ui_action: {} } },
        { name: "hold_action", selector: { ui_action: {} } },
        { name: "double_tap_action", selector: { ui_action: {} } },
        {
          type: "grid", name: "", schema: [
            { name: "lock_when_broken", selector: { boolean: {} } },
            { name: "optimistic", selector: { boolean: {} } },
            { name: "haptic", selector: { boolean: {} } },
          ],
        },
      ],
    },
  ];

  // pontos viram texto no formulário e voltam para lista na config —
  // digitar "30 70, 70 70" é mais rápido do que qualquer YAML
  const pointsToText = (v) => {
    const p = parsePoints(v);
    return p.length ? p.map((q) => `${q[0]} ${q[1]}`).join(", ") : "";
  };

  class MwLedLineElementEditor extends HTMLElement {
    setConfig(config) { this._config = config || {}; this._render(); }
    set hass(hass) { this._hass = hass; this._render(); }

    _render() {
      if (!this._config || !this._hass) return;
      if (!this._form) {
        const f = document.createElement("ha-form");
        f.computeLabel = (s) => LABELS[s.name] || s.name;
        f.addEventListener("value-changed", (ev) => {
          ev.stopPropagation();
          const v = { ...ev.detail.value };
          if (typeof v.points === "string") {
            const p = parsePoints(v.points);
            if (p.length >= 2) v.points = p.map((q) => `${q[0]} ${q[1]}`).join(", ");
            else delete v.points;
          }
          const next = { type: "custom:mw-led-line-element", ...v };
          Object.keys(next).forEach((k) => {
            if (next[k] === "" || next[k] === null || next[k] === undefined) delete next[k];
          });
          fire(this, "config-changed", { config: next });
        });
        this.appendChild(f);
        this._form = f;
      }
      this._form.hass = this._hass;
      this._form.schema = SCHEMA;
      const data = { ...this._config };
      data.points = pointsToText(data.points);
      ["shape", "thickness", "thickness_off", "animation", "animation_speed",
        "use_light_color", "glow", "fill", "tap_action", "hold_action"].forEach((k) => {
          if (data[k] === undefined) data[k] = DEFAULTS[k];
        });
      this._form.data = data;
    }
  }

  if (!customElements.get("mw-led-line-element")) {
    customElements.define("mw-led-line-element", MwLedLineElement);
  }
  if (!customElements.get("mw-led-line-element-editor")) {
    customElements.define("mw-led-line-element-editor", MwLedLineElementEditor);
  }

  console.info(
    `%c MW-LED-LINE-ELEMENT %c ${VERSION} `,
    "color:#0b1021;background:#7cf",
    "color:#7cf;background:#0b1021"
  );
})();
