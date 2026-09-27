import "./style.css";
import {
  catalog,
  species,
  ammoNames,
  ammoOrder,
  missionById,
  mapOrder,
  type MapId,
  type Mission,
} from "./data/content";
import { Session, ballisticOffset } from "./game/rules";
import {
  ProgressStore,
  canPlay,
  freeUnlocked,
  completeSet,
} from "./game/progress";
import { Input } from "./game/input";
import { GameView } from "./render/view";
import { GameAudio } from "./ui/audio";
import { DialogueView } from "./ui/dialogue";
import { PageLocalizer, localeChoices, translateText, type Locale } from "./ui/locale";
import * as T from "three";
import { rangeMarks } from "./render/reticle";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const specialty = {
  scout: "偵察標記",
  bait: "引誘聚集",
  disrupt: "短暫干擾",
  collector: "頭飾回收",
};
const areaNotes: Record<MapId, string> = {
  park: "樹影、長椅與北側步道。從這裡開始第一份勤務。",
  city: "樓宇之間的陰影，藏著短暫出現的目標。",
  residential: "安靜的庭院。辨識徽章，比扣下扳機更重要。",
  shopping_street: "招牌與棚架交錯，等待視線打開的瞬間。",
  factory: "鐵皮與輸送帶，留意設備後方的群聚。",
  rural: "越過梯田與草叢，判讀高低不同的地面。",
  joint: "六區聯合勤務。精準與安全，缺一不可。",
};
export class App {
  root = document.querySelector<HTMLDivElement>("#app")!;
  canvas!: HTMLCanvasElement;
  ui!: HTMLDivElement;
  hud!: HTMLDivElement;
  notice!: HTMLDivElement;
  view!: GameView;
  input!: Input;
  store: ProgressStore;
  audio = new GameAudio();
  dialogue!: DialogueView;
  localizer!: PageLocalizer;
  session?: Session;
  screen = "home";
  selectedMap: MapId = "park";
  paused = true;
  last = 0;
  accumulator = 0;
  uiElapsed = 0;
  galleryHelper = false;
  private resultSaved = false;
  private soundedResult?: string;
  private soundControls!: HTMLDivElement;
  private preview?: Session;
  constructor() {
    let storage: Storage;
    try {
      storage = localStorage;
    } catch {
      storage = {
        getItem() {
          throw Error("storage");
        },
        setItem() {
          throw Error("storage");
        },
      } as unknown as Storage;
    }
    this.store = new ProgressStore(storage);
    this.root.innerHTML =
      '<canvas id="world" aria-label="三維遊戲場景"></canvas><div id="vignette"></div><main id="ui"></main><div id="hud"></div><div id="notice" role="status"></div>';
    this.canvas = document.querySelector("#world")!;
    this.ui = document.querySelector("#ui")!;
    this.hud = document.querySelector("#hud")!;
    this.notice = document.querySelector("#notice")!;
    this.soundControls = document.createElement("div");
    this.soundControls.className = "sound-controls";
    this.soundControls.innerHTML = `<button type="button" aria-label="切換靜音"></button><label>音效 <input aria-label="音效音量" type="range" min="0" max="100" value="${Math.round(this.audio.volume * 100)}"></label>`;
    const muteButton = this.soundControls.querySelector("button")!;
    const updateMute = () => {
      muteButton.textContent = this.audio.muted ? "音效：關" : "音效：開";
      muteButton.setAttribute("aria-pressed", String(this.audio.muted));
    };
    updateMute();
    muteButton.onclick = () => {
      this.audio.enable();
      this.audio.settings(undefined, !this.audio.muted);
      updateMute();
      this.audio.play("click");
    };
    this.soundControls.querySelector("input")!.oninput = (e) => {
      this.audio.enable();
      this.audio.settings(
        Number((e.target as HTMLInputElement).value) / 100,
        false,
      );
      updateMute();
    };
    this.root.append(this.soundControls);
    this.dialogue = new DialogueView(this.root);
    this.localizer = new PageLocalizer([this.ui, this.hud, this.notice, this.soundControls, this.dialogue.root]);
    document.documentElement.lang = this.localizer.locale;
    document.title = translateText("加工所：制高點", this.localizer.locale);
    try {
      this.view = new GameView(this.canvas);
    } catch (e) {
      this.ui.innerHTML = `<section class="fatal"><h1>無法建立 3D 畫面</h1><p>請在支援 WebGL 2 的 Chrome 或 Edge 開啟硬體加速，再重新載入。</p><p>${escape(String(e))}</p></section>`;
      return;
    }
    this.input = new Input(this.canvas, {
      fire: () => this.fire(),
      scope: () => {
        this.view.scope = !this.view.scope;
        this.audio.play("scope");
        this.updateHud();
      },
      zoom: (d) => {
        const before = this.view.zoom;
        this.view.zoom = Math.max(0, Math.min(2, this.view.zoom + d));
        if (before !== this.view.zoom) this.audio.play("zoom");
        this.updateHud();
      },
      reload: () => {
        if (!this.session?.reload()) this.audio.play("empty");
        if (this.session) this.audio.flush(this.session, this.view.camera);
        this.updateHud();
      },
      ammo: (i) => {
        const id = ammoOrder[i];
        if (this.session?.availableAmmo.includes(id)) {
          if (this.session.ammo !== id) this.audio.play("ammo");
          this.session.ammo = id;
        } else this.audio.play("warning");
      },
      collect: () => {
        if (!this.session?.collect()) this.audio.play("empty");
        if (this.session) this.audio.flush(this.session, this.view.camera);
        this.updateHud();
      },
      pause: () => this.pause(),
      aim: (x, y) => this.view.aim(x, y),
    });
    this.ui.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (b && !b.hasAttribute("disabled")) {
        this.audio.enable();
        void this.action(b.dataset.action!, b.dataset.id);
        this.audio.play("click");
      }
    });
    window.addEventListener("resize", () => this.view.resize());
    this.canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.pause();
      this.toast("顯示裝置中斷，請重新載入頁面；已結算進度仍保留。");
    });
    this.homePreview();
    this.renderMenu();
    if (this.store.warning) this.toast(this.store.warning);
    requestAnimationFrame((t) => this.frame(t));
  }
  toast(text: string) {
    this.audio.play(
      /無法|不足|沒有|最多|失敗|中斷/.test(text) ? "warning" : "collect",
    );
    this.notice.textContent = text;
    this.notice.classList.add("show");
    setTimeout(() => this.notice.classList.remove("show"), 6000);
  }
  private homePreview() {
    this.view.setMap("park");
    this.preview = new Session(
      missionById("park_01"),
      "free",
      this.store.value,
      5,
    );
    this.view.camera.position.set(28, 19, 27);
    this.view.camera.lookAt(0, 0, -15);
    this.view.gun.visible = false;
  }
  private header() {
    return `<header><button class="brand" data-action="home"><span class="brand-mark">加</span><span>加工所<small>FIELD OPERATIONS / 青葉支所</small></span></button><nav>${[
      ["campaign", "任務板"],
      ["free", "地圖冊"],
      ["workshop", "軍械櫃"],
      ["community", "社區聯絡簿"],
      ["gallery", "模型展示"],
    ]
      .map(
        ([id, label]) =>
          `<button class="nav ${this.screen === id ? "selected" : ""}" data-action="${id}">${label}</button>`,
      )
      .join(
        "",
      )}</nav><div class="balances"><span>加工所 <b>${this.store.value.workshop}</b></span><span>社區 <b>${this.store.value.community}</b></span></div></header>`;
  }
  renderMenu() {
    this.root.classList.toggle("playing", this.screen === "play");
    this.root.classList.toggle("gallery", this.screen === "gallery");
    this.hud.innerHTML = "";
    if (this.screen === "home") {
      this.ui.innerHTML =
        this.header() +
        `<section class="hero"><div class="eyebrow"><span class="status-dot"></span> AOBA DISTRICT · OBSERVATION POST 01</div><h1>每一次瞄準，<br>都為了明天的<span>平靜。</span></h1><p class="hero-sub">加工所：制高點</p><p class="intro">登上觀測台，守望熟悉的街區。<br>觀察路徑、辨識目標，完成你的下一份勤務。</p><div class="hero-actions"><button class="primary" data-action="campaign">前往任務板 <span>↗</span></button><button class="text-button" data-action="gallery">認識六種油庫里 <span>→</span></button></div><div class="language-switch" role="group" aria-label="語言">${localeChoices.map(({ id, label }) => `<button type="button" data-action="locale" data-id="${id}" aria-pressed="${this.localizer.locale === id}" class="${this.localizer.locale === id ? "selected" : ""}">${label}</button>`).join("")}</div><div class="hero-stats"><div><b>06</b><span>巡守地區</span></div><div><b>18</b><span>驅逐任務</span></div><div><b>05</b><span>戰術彈種</span></div></div></section><aside class="post-label"><span>01 / 青葉公園</span><b>管理所屋頂</b><small>固定觀測台 · 第一人稱狙擊</small></aside><footer><span>勤務須知：綠色圓形徽章代表社區協力者，請勿誤傷。</span><span>THREE.JS EDITION / 01</span></footer>`;
      return;
    }
    if (this.screen === "gallery") {
      this.ui.innerHTML =
        this.header() +
        `<section class="gallery-title"><div class="eyebrow">SPECIMEN ARCHIVE / 通常種六種</div><h1>小小的身影，各有不同。</h1><p>以 Three.js 幾何建立頭型、髮束與頭飾；眼口為程式繪製表情。</p></section><div class="gallery-tools"><button data-action="rotate" data-id="-1">← 左轉</button><button data-action="rotate" data-id="1">右轉 →</button><button data-action="helper-preview">${this.galleryHelper ? "一般個體" : "查看協力者徽章"}</button></div><div class="species-list">${species.map((s, i) => `<div><small>0${i + 1}</small><b>${s.name}</b><span>${s.detail}</span></div>`).join("")}</div>`;
      return;
    }
    const title =
      {
        campaign: "今日的勤務，從這裡開始。",
        free: "回到熟悉的街區。",
        workshop: "為下一次出勤做好準備。",
        community: "一起守望這個社區。",
      }[this.screen] ?? "";
    const p = this.store.value;
    let body = "";
    if (this.screen === "campaign" || this.screen === "free") {
      const free = this.screen === "free";
      const maps = catalog.maps.filter((m) => !free || m.id !== "joint");
      const missions = catalog.missions
        .filter((m) => m.map === this.selectedMap)
        .sort((a, b) => a.sequence_in_map - b.sequence_in_map);
      body = `<div class="mission-layout"><aside class="regions"><span class="section-label">巡守地區</span>${maps.map((m, i) => `<button class="region ${m.id === this.selectedMap ? "active" : ""}" data-action="map" data-id="${m.id}"><small>${String(i + 1).padStart(2, "0")}</small><span>${m.display_name}</span><em>${m.id === this.selectedMap ? "↗" : "→"}</em></button>`).join("")}</aside><section class="area-content"><div class="area-heading"><div><div class="eyebrow">${free ? "FREE PATROL" : "DISPATCH BOARD"} / ${String(mapOrder.indexOf(this.selectedMap) + 1).padStart(2, "0")}</div><h2>${catalog.maps.find((m) => m.id === this.selectedMap)?.display_name}</h2><p>${areaNotes[this.selectedMap]}</p></div><span class="area-stamp">青葉<br>巡守</span></div>${free ? `<article class="free-card"><span class="tag">無限時 · 隨時回報</span><h3>自由巡守</h3><p>處置目標取得社區點數，按 E 回收頭飾保留收藏。<br>普通彈可免費無限裝填；每種特殊彈每場限 3 發，升級後限 5 發。<br>已選協力者：${(p.loadouts[this.selectedMap] ?? []).map((id) => catalog.helpers.find((h) => h.id === id)?.display_name).join("、") || "尚未選擇"}</p><button class="primary" data-action="start-free" data-id="${this.selectedMap}" ${freeUnlocked(p, this.selectedMap) ? "" : "disabled"}>${freeUnlocked(p, this.selectedMap) ? "開始自由巡守 →" : "完成本區首關後開放"}</button></article>` : `<div class="mission-cards">${missions.map((m) => `<article class="mission-card ${p.completed.includes(m.id) ? "completed" : ""}"><div class="card-top"><span class="tag">${m.mission_kind}</span><span class="rating">${p.ratings[m.id] ? ["", "D", "C", "B", "A", "S"][p.ratings[m.id]] : "—"}</span></div><h3>${m.display_name.replace(/^\d+\s+/, "")}</h3><p>${m.story_lines?.[0] ?? "守住觀測台，完成本區勤務。"}</p><div class="mission-facts"><span>${m.max_enemy_count} 個目標</span><span>${Math.round(m.time_limit_seconds / 60)} 分鐘</span><span>基礎 ${m.base_reward} 點</span></div><button class="${canPlay(p, m.id) ? "primary" : "locked"}" data-action="brief" data-id="${m.id}" ${canPlay(p, m.id) ? "" : "disabled"}>${canPlay(p, m.id) ? (p.completed.includes(m.id) ? "再次出勤 ↗" : "查看簡報 ↗") : "前置勤務尚未完成"}</button></article>`).join("")}</div>`}</section></div>`;
    } else if (this.screen === "workshop")
      body = `<div class="upgrade-grid">${catalog.upgrades.map((u) => `<article class="upgrade-card"><div class="card-top"><span class="tag">${u.ammo_license ? "彈藥許可" : "裝備升級"}</span><b>${p.upgrades[u.id] ? "已裝備" : `${u.cost} 點`}</b></div><h3>${u.display_name}</h3><p>${escape(u.description.replace("Tab", "數字鍵 1–5"))}</p><button data-action="purchase" data-id="${u.id}" ${p.upgrades[u.id] || p.workshop < u.cost || (u.prerequisite_mission && !p.completed.includes(u.prerequisite_mission)) ? "disabled" : ""}>${p.upgrades[u.id] ? "已達最高等級" : u.prerequisite_mission && !p.completed.includes(u.prerequisite_mission) ? "完成公園初次勤務開放" : "購買升級 →"}</button></article>`).join("")}</div>`;
    else if (this.screen === "community")
      body = `<div class="community-layout"><section><div class="map-tabs">${catalog.maps
        .filter((m) => m.id !== "joint")
        .map(
          (m) =>
            `<button class="${this.selectedMap === m.id ? "active" : ""}" data-action="map" data-id="${m.id}">${m.display_name}</button>`,
        )
        .join(
          "",
        )}</div><p class="muted">每區三名協力者，每次最多帶兩名。勾選後於下次自由巡守出勤。</p><div class="helper-grid">${catalog.helpers
        .filter((h) => h.map_id === this.selectedMap)
        .map((h) => {
          const level = p.helpers[h.id] ?? 0;
          return `<article class="upgrade-card"><span class="tag green">${specialty[h.specialty]}</span><h3>${h.display_name}</h3><p>支援範圍 ${h.effect_radius} m · 每 ${h.support_interval} 秒支援<br>${level ? `等級 ${level} / ${h.upgrade_costs.length + 1}` : `招募費用 ${h.recruit_cost} 社區點數`}</p>${level ? `<button data-action="select-helper" data-id="${h.id}">${p.loadouts[this.selectedMap]?.includes(h.id) ? "✓ 已選擇出勤" : "選擇出勤"}</button><button data-action="upgrade-helper" data-id="${h.id}" ${h.upgrade_costs[level - 1] === undefined || p.community < h.upgrade_costs[level - 1] ? "disabled" : ""}>${h.upgrade_costs[level - 1] !== undefined ? `升級 · ${h.upgrade_costs[level - 1]} 點` : "已達最高等級"}</button>` : `<button data-action="recruit" data-id="${h.id}" ${!freeUnlocked(p, this.selectedMap) || p.community < h.recruit_cost ? "disabled" : ""}>招募協力者 →</button>`}</article>`;
        })
        .join(
          "",
        )}</div></section><aside class="collection"><span class="section-label">頭飾收藏</span><h3>帶回街區的紀念。</h3><p>手動回收保留收藏；回收專長協力者拾取的頭飾自動折算點數。</p>${catalog.headwear.map((h) => `<div class="hat-row"><b>${h.rarity === "rare" ? "✦" : "◇"} ${h.display_name}</b><span>${p.hats[h.id] ?? 0} 件</span><button data-action="exchange" data-id="${h.id}" ${p.hats[h.id] ? "" : "disabled"}>兌換 ${h.community_value} 點</button></div>`).join("")}<p class="set-note">${completeSet(p) ? "✓ 收藏套裝生效：處置點數 ×1.5" : "集齊普通與稀有頭飾，處置點數 ×1.5。"}</p></aside></div>`;
    this.ui.innerHTML =
      this.header() +
      `<section class="workspace"><div class="workspace-title"><div><div class="eyebrow">AOBA FIELD OFFICE / 勤務管理</div><h1>${title}</h1></div><span class="save-hint">進度儲存在此瀏覽器</span></div>${body}</section>`;
  }
  async action(action: string, id?: string) {
    if (action === "locale" && localeChoices.some((choice) => choice.id === id)) {
      this.localizer.set(id as Locale);
      this.renderMenu();
      return;
    }
    if (action === "discard-result") {
      this.session = undefined;
      await this.action(id ?? "campaign");
      return;
    }
    if (
      ["home", "campaign", "free", "workshop", "community", "gallery"].includes(
        action,
      )
    ) {
      if (this.session?.result && !this.resultSaved) {
        this.toast("結果尚未保存，請重試儲存或明確選擇放棄。");
        return;
      }
      this.input.unlock();
      this.audio.stop();
      this.session = undefined;
      this.paused = true;
      this.screen = action;
      if (
        this.selectedMap === "joint" &&
        (action === "free" || action === "community")
      )
        this.selectedMap = "park";
      if (action === "gallery") this.view.showGallery(this.galleryHelper);
      else this.homePreview();
      this.renderMenu();
      return;
    }
    if (action === "map") {
      this.selectedMap = id as MapId;
      this.renderMenu();
      return;
    }
    if (action === "rotate") {
      this.view.galleryAngle += (Number(id) * Math.PI) / 4;
      return;
    }
    if (action === "helper-preview") {
      this.galleryHelper = !this.galleryHelper;
      this.view.showGallery(this.galleryHelper);
      this.renderMenu();
      return;
    }
    if (action === "brief") {
      const m = missionById(id!);
      if (!canPlay(this.store.value, m.id)) return;
      this.brief(m, "campaign");
      return;
    }
    if (action === "start-free") {
      if (!freeUnlocked(this.store.value, id as MapId)) return;
      this.brief(
        catalog.missions.find((m) => m.map === id && m.sequence_in_map === 1)!,
        "free",
      );
      return;
    }
    if (action === "deploy") {
      const [mission, mode] = id!.split("|");
      await this.start(missionById(mission), mode as "campaign" | "free");
      return;
    }
    if (action === "resume") {
      await this.resume();
      return;
    }
    if (action === "leave") {
      this.session?.finish();
      this.showResult();
      return;
    }
    if (action === "retry-save") {
      if (this.session?.result)
        this.resultSaved = this.store.settle(this.session.result);
      this.showResult();
      return;
    }
    if (action === "collect") {
      this.session?.collect();
      this.pause();
      if (this.session) this.audio.flush(this.session, this.view.camera);
      return;
    }
    if (action === "purchase")
      this.toast(
        this.store.purchase(id!)
          ? "升級完成，下次出勤套用。"
          : this.store.warning || "目前無法購買。",
      );
    if (action === "recruit")
      this.toast(
        this.store.recruit(id!)
          ? "協力者已加入聯絡簿。"
          : this.store.warning || "目前無法招募。",
      );
    if (action === "upgrade-helper")
      this.toast(
        this.store.upgradeHelper(id!)
          ? "協力者已升級。"
          : this.store.warning || "目前無法升級。",
      );
    if (action === "select-helper")
      this.toast(
        this.store.selectHelper(this.selectedMap, id!)
          ? "出勤名單已保存。"
          : this.store.warning || "每次最多兩名協力者。",
      );
    if (action === "exchange")
      this.toast(
        this.store.exchange(id!)
          ? "頭飾已兌換社區點數。"
          : this.store.warning || "沒有可兌換的頭飾。",
      );
    this.renderMenu();
  }
  brief(m: Mission, mode: "campaign" | "free") {
    this.ui.innerHTML =
      this.header() +
      `<div class="modal-backdrop"><section class="brief modal"><div class="eyebrow">RADIO DISPATCH / 無線電簡報</div><h2>${mode === "free" ? "自由巡守 · " + catalog.maps.find((x) => x.id === m.map)?.display_name : m.display_name}</h2><p class="brief-story">${(m.story_lines ?? []).map(escape).join("<br>")}</p><div class="brief-facts"><div><small>目標</small><b>${mode === "free" ? "持續出現" : `${m.max_enemy_count} 隻`}</b></div><div><small>時間</small><b>${mode === "free" ? "無時間限制" : `${m.time_limit_seconds / 60} 分鐘`}</b></div><div><small>安全規範</small><b>辨識綠色徽章</b></div></div><p>${mode === "free" ? "按 E 回收頭飾。普通彈可免費無限裝填；每種特殊彈每場限 3 發，擴充彈匣後限 5 發。" : `全數處置才推進戰役。${m.max_collateral_damage >= 0 ? `附帶損害不得超過 ${m.max_collateral_damage} 次。` : ""}${m.minimum_accuracy ? `命中率至少 ${Math.round(m.minimum_accuracy * 100)}%。` : ""}`}</p><div class="controls"><span><kbd>滑鼠</kbd> 轉向</span><span><kbd>左鍵</kbd> 射擊</span><span><kbd>右鍵</kbd> 瞄準鏡</span><span><kbd>滾輪</kbd> 倍率</span><span><kbd>R</kbd> 換彈</span><span><kbd>1–5</kbd> 彈種</span><span><kbd>Esc</kbd> 暫停</span></div><div class="modal-actions"><button data-action="${mode === "free" ? "free" : "campaign"}">返回</button><button class="primary" data-action="deploy" data-id="${m.id}|${mode}">接受勤務，進入觀測台 ↗</button></div></section></div>`;
  }
  async start(m: Mission, mode: "campaign" | "free") {
    if (
      mode === "campaign"
        ? !canPlay(this.store.value, m.id)
        : !freeUnlocked(this.store.value, m.map)
    )
      return;
    this.session = new Session(
      m,
      mode,
      structuredClone(this.store.value),
      Math.floor(Math.random() * 1e9),
    );
    this.resultSaved = false;
    this.audio.stop();
    this.preview = undefined;
    this.screen = "play";
    this.view.setMap(m.map);
    this.view.sync(this.session, 0);
    this.audio.enable();
    this.root.classList.add("playing");
    this.root.classList.remove("gallery");
    this.accumulator = 0;
    await this.resume();
  }
  async resume() {
    if (!this.session || this.session.finished) return;
    this.audio.enable();
    const locked = await this.input.lock();
    if (!locked) {
      this.paused = true;
      this.input.active = false;
      this.pause();
      this.toast("尚未取得滑鼠控制，請點「繼續勤務」重試。");
      return;
    }
    this.paused = false;
    this.audio.play("deploy");
    this.input.active = true;
    this.ui.innerHTML = "";
    this.accumulator = 0;
    this.updateHud();
  }
  pause() {
    if (!this.session || this.session.finished) return;
    this.paused = true;
    this.audio.stop();
    this.input.unlock();
    this.ui.innerHTML = `<div class="modal-backdrop"><section class="modal pause"><div class="eyebrow">OBSERVATION PAUSED</div><h2>暫停勤務</h2><p>時間與現場狀態已暫停。點擊下方按鈕繼續。</p><button class="primary" data-action="resume">繼續勤務 →</button>${this.session.mode === "free" ? `<button data-action="collect" ${this.session.drops.length ? "" : "disabled"}>回收完整頭飾（${this.session.drops.length}）</button>` : ""}<button data-action="leave">${this.session.mode === "free" ? "離開並結算" : "提前回報並結算"}</button><small>滑鼠解鎖、切換分頁或視窗失焦時，遊戲會自動暫停。</small></section></div>`;
  }
  fire() {
    if (!this.session || this.paused) return;
    if (this.view.shoot(this.session)) {
      this.audio.flush(this.session, this.view.camera);
      this.canvas.classList.add("shot");
      setTimeout(() => this.canvas.classList.remove("shot"), 70);
    } else if ((this.session.ammo === "standard" ? this.session.rounds === 0 : this.session.specialRounds[this.session.ammo] === 0) && !this.session.reloadLeft)
      this.audio.play("empty");
    if (this.session.finished) this.showResult();
    else this.updateHud();
  }
  showResult() {
    const s = this.session;
    if (!s?.result) return;
    if (this.soundedResult !== s.runId) {
      this.soundedResult = s.runId;
      this.audio.stopAmbience();
      this.audio.play(
        s.result.completed || s.mode === "free" ? "success" : "failure",
      );
    }
    this.paused = true;
    this.input.unlock();
    if (!this.resultSaved) this.resultSaved = this.store.settle(s.result);
    const r = s.result;
    this.hud.innerHTML = "";
    this.ui.innerHTML = `<div class="modal-backdrop"><section class="modal result"><div class="eyebrow">FIELD REPORT / 勤務回報</div><div class="result-grade">${r.mode === "free" ? "✓" : r.grade}</div><h2>${r.mode === "free" ? "巡守結束，辛苦了。" : r.completed ? "勤務完成。" : "本次勤務已回報。"}</h2><p>${r.mode === "campaign" && !r.completed ? "全數處置並達成特殊條件後，才能開放後續勤務。" : "社區的平靜，來自每一次細心觀察。"}</p><div class="result-stats"><div><small>處置</small><b>${r.stats.kills}</b></div><div><small>命中率</small><b>${Math.round((r.stats.hits / Math.max(1, r.stats.shots)) * 100)}%</b></div><div><small>最佳連續命中</small><b>${r.stats.bestStreak}</b></div><div><small>誤傷 / 附帶損害</small><b>${r.stats.helperHarm} / ${r.stats.collateral}</b></div></div><p class="reward">${r.mode === "campaign" ? `加工所點數 +${r.workshop}` : `社區點數 ${r.community >= 0 ? "+" : ""}${r.community} · 收藏頭飾 ${Object.values(r.hats).reduce((a, b) => a + b, 0)} 件`}</p><p class="save-status">${this.resultSaved ? "✓ 進度已保存" : escape(this.store.warning)}</p><div class="modal-actions">${!this.resultSaved ? '<button data-action="retry-save">重試儲存</button>' : ""}${this.resultSaved ? `<button class="primary" data-action="${r.mode === "free" ? "free" : "campaign"}">返回辦公桌 →</button>` : `<button data-action="discard-result" data-id="${r.mode === "free" ? "free" : "campaign"}">放棄未保存結果並返回</button>`}</div></section></div>`;
  }
  updateHud() {
    const s = this.session;
    if (!s || s.finished) return;
    const info = this.view.targetInfo(s),
      r = Math.round(info.range),
      time = Math.max(0, s.mission.time_limit_seconds - s.elapsed);
    const scoped = this.view.scope;
    const a = info.actor;
    const name = a ? species.find((x) => x.id === a.species)?.name : "";
    const target = a
      ? `${a.helper ? "◉ 協力者 · " : ""}${name}${s.equip.identify && a.special ? " · " + a.special : ""}${s.equip.hatThreshold && a.hat === "rare_hat" ? " · 高價頭飾" : ""}`
      : "觀察地面動向";
    this.hud.innerHTML = `<div class="hud-top"><div><small>${s.mode === "free" ? "FREE PATROL" : "ACTIVE DISPATCH"}</small><b>${catalog.maps.find((m) => m.id === s.mission.map)?.display_name}</b></div><div class="mission-counter"><b>${s.stats.kills.toString().padStart(2, "0")}</b><span>${s.mode === "free" ? "已處置" : `/ ${s.mission.max_enemy_count}`}</span></div><div><small>${s.mode === "free" ? "社區點數（本局淨額）" : "剩餘勤務時間"}</small><b>${
      s.mode === "free"
        ? s.pendingPoints + s.collectorPoints
        : `${Math.floor(time / 60)
            .toString()
            .padStart(2, "0")}:${Math.floor(time % 60)
            .toString()
            .padStart(2, "0")}`
    }</b></div></div><div class="${scoped ? "scope-mask" : "crosshair"}">${scoped ? '<div class="scope-ring"><div class="scope-axis h"></div><div class="scope-axis v"></div><span class="scope-center">＋</span></div>' : ""}</div>${scoped ? `<div class="scope-readout"><span>${[2.5, 4, 7][this.view.zoom]}×${s.equip.scope < 1 ? " +" : ""}</span><span>${r} m</span><span>風 ${s.mission.wind[0] >= 0 ? "→" : "←"} ${s.equip.wind ? Math.abs(s.mission.wind[0]).toFixed(1) + " m/s" : "觀察旗向"}</span></div>` : ""}<div class="target-info ${a?.helper ? "helper" : ""}">${escape(target)}</div><div class="feedback">${escape(s.feedback.replace(s.ammo, ammoNames[s.ammo]))}</div><div class="hud-bottom"><div class="ammo-bar">${ammoOrder.map((id, i) => `<div class="ammo-slot ${s.ammo === id ? "active" : ""} ${s.availableAmmo.includes(id) ? "" : "unavailable"}"><kbd>${i + 1}</kbd><span>${ammoNames[id]}${id === "standard" ? "" : ` ${s.specialRounds[id]}`}</span></div>`).join("")}</div><div class="rounds"><b>${s.ammo === "standard" && s.reloadLeft > 0 ? "⋯" : (s.ammo === "standard" ? s.rounds : s.specialRounds[s.ammo]).toString().padStart(2, "0")}</b><span>/ ${(s.ammo === "standard" ? s.equip.capacity : s.equip.specialCapacity).toString().padStart(2, "0")}<small>${s.ammo !== "standard" ? "每場限量" : s.reloadLeft > 0 ? "裝填中" : "R 免費換彈"}</small></span></div></div><div class="hud-hints">右鍵 瞄準鏡　滾輪 倍率　${s.mode === "free" ? "E 回收　" : ""}Esc 暫停 <span>${Math.round(this.view.fps)} FPS</span></div>`;
    if (scoped) {
      const marks = rangeMarks(
        this.view.camera,
        500 * s.equip.velocity,
        s.mission.wind,
        s.equip.ticks > 0,
      );
      let lastLabel = -100;
      for (const mark of marks) {
        const pixels = (mark.y * innerHeight) / 100;
        const label = pixels - lastLabel > 15;
        if (label) lastLabel = pixels;
        this.hud.insertAdjacentHTML(
          "beforeend",
          `<span class="range-mark" data-range="${mark.range}" style="left:${mark.x}%;top:${mark.y}%">─${label ? mark.range + " m" : ""}</span>`,
        );
      }
    }
    if (scoped && s.equip.ticks) {
      const p = this.view.camera.position
        .clone()
        .addScaledVector(
          this.view.camera.getWorldDirection(new T.Vector3()),
          info.range,
        )
        .add(
          new T.Vector3(
            ...ballisticOffset(
              info.range,
              500 * s.equip.velocity,
              s.mission.wind,
            ),
          ),
        )
        .project(this.view.camera);
      this.hud.insertAdjacentHTML(
        "beforeend",
        `<span class="impact-reticle" style="left:${(p.x + 1) * 50}%;top:${(1 - p.y) * 50}%">＋</span>`,
      );
    }
  }
  frame(t: number) {
    this.soundControls.hidden =
      !!this.session && !this.paused && !this.session.finished;
    const dt = Math.min((t - (this.last || t)) / 1000, 0.1);
    this.last = t;
    if (this.session) {
      if (!this.paused && !this.session.finished) {
        this.accumulator += dt;
        while (this.accumulator >= 1 / 60) {
          this.session.tick(1 / 60);
          this.accumulator -= 1 / 60;
        }
        this.audio.update(this.session, this.view.camera);
        if (this.session.finished) this.showResult();
      }
      this.view.sync(this.session, dt, !this.paused);
      this.uiElapsed += dt;
      if (this.uiElapsed > 0.15 && !this.paused) {
        this.uiElapsed = 0;
        this.updateHud();
      }
    } else if (this.preview && this.screen !== "gallery") {
      this.preview.tick(dt);
      this.view.sync(this.preview, dt, false);
    }
    this.view.render(dt);
    this.dialogue.update(
      this.session,
      this.view.camera,
      !!this.session && !this.paused && !this.session.finished,
    );
    requestAnimationFrame((t) => this.frame(t));
  }
}
export const app = new App();
