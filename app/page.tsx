"use client";

import { useEffect, useMemo, useState } from "react";
import normalizedFoodData from "../data/food-spots.normalized.json";
import FoodSubmissionSection from "./FoodSubmissionSection";

type VoteVerdict = "underrated" | "fair" | "overrated";
type VoteState = Record<string, {
  counts: Record<VoteVerdict, number>;
  current: VoteVerdict | null;
}>;

type FoodProvenance = {
  type: "government" | "university" | "merchant" | "community";
  name: string;
  url: string;
  checkedAt: string;
  notes: string;
};

type FoodSpot = {
  id: string;
  name: string;
  type: string;
  campus: "明伦" | "金明" | "龙子湖";
  price: string;
  distance: string;
  address: string;
  hours: string;
  review: string;
  tags: string[];
  image: string;
  imageAlt: string;
  mapKeyword: string;
  map: string;
  verified: boolean;
  tier: "夯" | "顶级" | "人上人" | "NPC" | "拉完了";
  provenance?: FoodProvenance;
  recommendReasons?: string[];
  recommendedDishes?: Array<{ name: string; note: string; image: string }>;
  environmentPhotos?: Array<{ label: string; image: string }>;
  importedFields?: string[];
};

const normalizedSpotById = new Map(
  normalizedFoodData.spots.map((spot) => [spot.id, spot]),
);

const foodTiers = [
  { name: "夯", note: "必须吃", className: "hang" },
  { name: "顶级", note: "稳稳推荐", className: "top" },
  { name: "人上人", note: "预算足再冲", className: "elite" },
  { name: "NPC", note: "日常不出错", className: "npc" },
  { name: "拉完了", note: "先别急着去", className: "done" },
] as const;

const defaultFoodSpots: FoodSpot[] = [
  {
    id: "gulou",
    name: "鼓楼夜市",
    type: "夜市 · 开封小吃",
    campus: "明伦",
    price: "人均 ¥25–50",
    distance: "约 15 分钟骑行",
    address: "开封市鼓楼区鼓楼街",
    hours: "傍晚至夜间，出发前建议查地图",
    review: "第一次来开封很适合从这里开始：选择多、烟火气足。周末人流大，建议结伴并保管好随身物品。",
    tags: ["灌汤包", "杏仁茶", "夜宵"],
    image: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "热气腾腾的中式蒸饺，菜品示意图",
    mapKeyword: "开封鼓楼夜市",
    map: "https://www.openstreetmap.org/export/embed.html?bbox=114.343%2C34.787%2C114.358%2C34.798&layer=mapnik&marker=34.793%2C114.351",
    verified: true,
    tier: "夯",
  },
  {
    id: "xisi",
    name: "西司夜市",
    type: "夜市 · 本地风味",
    campus: "明伦",
    price: "人均 ¥20–45",
    distance: "约 20 分钟骑行",
    address: "开封市鼓楼区丁角街一带",
    hours: "傍晚至夜间，摊位营业随季节变化",
    review: "比热门景点型夜市更生活化，适合多人分着点、一次尝几样。价格和卫生情况以现场公示为准。",
    tags: ["夜市", "烧烤", "朋友聚餐"],
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "色彩丰富的中式小吃，菜品示意图",
    mapKeyword: "开封西司夜市",
    map: "https://www.openstreetmap.org/export/embed.html?bbox=114.328%2C34.785%2C114.344%2C34.798&layer=mapnik&marker=34.791%2C114.336",
    verified: true,
    tier: "顶级",
  },
  {
    id: "diyilou",
    name: "第一楼",
    type: "老字号 · 灌汤包",
    campus: "明伦",
    price: "人均 ¥50–90",
    distance: "鼓楼片区",
    address: "开封市鼓楼商圈，具体门店以地图为准",
    hours: "各门店不同，建议提前电话确认",
    review: "适合把灌汤包当作一顿正式的开封初体验。学生预算有限时，建议先看菜单与团购，再决定是否到店。",
    tags: ["灌汤包", "老字号", "聚餐"],
    image: "https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "装盘的中式面点，菜品示意图",
    mapKeyword: "开封第一楼灌汤包",
    map: "https://www.openstreetmap.org/export/embed.html?bbox=114.342%2C34.786%2C114.358%2C34.799&layer=mapnik&marker=34.793%2C114.350",
    verified: true,
    tier: "人上人",
  },
  {
    id: "minglun-canteen",
    name: "明伦校区学苑食堂",
    type: "校内 · 日常正餐",
    campus: "明伦",
    price: "学生餐价",
    distance: "校内步行",
    address: "河南大学明伦校区内",
    hours: "按学校当期安排开放",
    review: "最省心的日常选择。刚到校先把离宿舍、教学楼最近的窗口摸清，比盲目点外卖更省时间。",
    tags: ["校内", "省钱", "日常"],
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "一碗热食，菜品示意图",
    mapKeyword: "河南大学明伦校区学苑食堂",
    map: "https://www.openstreetmap.org/export/embed.html?bbox=114.348%2C34.814%2C114.365%2C34.827&layer=mapnik&marker=34.821%2C114.356",
    verified: true,
    tier: "NPC",
  },
  {
    id: "jinming-canteen",
    name: "金明校区南苑餐厅",
    type: "校内 · 特色窗口",
    campus: "金明",
    price: "学生餐价",
    distance: "校内步行",
    address: "河南大学金明校区南苑",
    hours: "按学校当期安排开放",
    review: "适合先建立自己的固定食堂路线：早餐、赶课快餐、晚饭分别收藏一个顺手窗口。",
    tags: ["校内", "早餐", "赶课"],
    image: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "搭配丰富的餐食，菜品示意图",
    mapKeyword: "河南大学金明校区南苑餐厅",
    map: "https://www.openstreetmap.org/export/embed.html?bbox=114.296%2C34.806%2C114.318%2C34.823&layer=mapnik&marker=34.815%2C114.307",
    verified: true,
    tier: "NPC",
  },
  {
    id: "longzihu",
    name: "龙子湖高校园区餐饮圈",
    type: "商圈 · 多品类",
    campus: "龙子湖",
    price: "人均 ¥20–60",
    distance: "地铁/骑行可达",
    address: "郑州市郑东新区龙子湖高校园区",
    hours: "各商家不同",
    review: "这个条目范围太大，还不是一家能直接去吃的具体店。先别盲冲，等学生补充实地核验过的门店后再升级。",
    tags: ["商圈", "聚餐", "地铁"],
    image: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "多人分享的亚洲餐食，菜品示意图",
    mapKeyword: "郑州龙子湖高校园区美食",
    map: "https://www.openstreetmap.org/export/embed.html?bbox=113.790%2C34.794%2C113.825%2C34.817&layer=mapnik&marker=34.805%2C113.807",
    verified: false,
    tier: "拉完了",
  },
].map((spot) => {
  const normalized = normalizedSpotById.get(spot.id);
  return {
    ...spot,
    provenance: normalized?.provenance as FoodProvenance | undefined,
    recommendReasons: normalized?.recommendReasons,
    recommendedDishes: normalized?.recommendedDishes,
    environmentPhotos: normalized?.environmentPhotos,
  };
});

const tools = [
  { name: "HENU Assistant", desc: "课表、空教室、图书馆、请假与选课等校园服务入口", href: "https://github.com/jry21223/HENU_Assistant", label: "核心项目" },
  { name: "期末复习站", desc: "课程资料、刷题、模拟卷与答案解析的集中索引", href: "https://github.com/jry21223/HENU-Final-Review", label: "学习" },
  { name: "校园网自动登录", desc: "路由器自动登录校园网脚本，减少重复认证；使用前请阅读安全与合规说明", href: "https://github.com/jry21223/HENU-Autologin", label: "效率" },
  { name: "图书馆座位预约", desc: "自动化预约工具，按仓库说明配置并合理使用", href: "https://github.com/jry21223/Henu_library_auto_seat_book", label: "学习" },
  { name: "HENU 生存手册", desc: "校园生活、学习发展、升学与出路经验合集", href: "https://github.com/HENU-CS/SurvivalHandbook", label: "攻略" },
  { name: "宿舍改善计划", desc: "宿舍生活与改造经验，当前内容以顺河公寓为主", href: "https://github.com/ESP-8266-offical/henu-dormitory-improve-project", label: "生活" },
];

const guides = [
  { n: "01", title: "到校当天", items: ["确认校区与宿舍楼", "完成报到与校园卡", "保存辅导员和舍友联系方式"], tone: "green" },
  { n: "02", title: "第一周", items: ["走一遍上课路线", "连接校园网", "熟悉食堂、快递点与校医院"], tone: "yellow" },
  { n: "03", title: "第一个月", items: ["整理课表与考试节点", "加入可信的学院群", "建立自己的预算和作息"], tone: "blue" },
];

export default function Home() {
  const [foodSpots, setFoodSpots] = useState<FoodSpot[]>(defaultFoodSpots);
  const [campus, setCampus] = useState<"全部" | FoodSpot["campus"]>("全部");
  const [activeSpot, setActiveSpot] = useState(defaultFoodSpots[0]);
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [rankings, setRankings] = useState<Record<string, FoodSpot["tier"]>>(
    Object.fromEntries(defaultFoodSpots.map((spot) => [spot.id, spot.tier])),
  );
  const [canEditRankings, setCanEditRankings] = useState(false);
  const [rankingUser, setRankingUser] = useState<string | null>(null);
  const [rankingMessage, setRankingMessage] = useState("正在确认榜单权限…");
  const [votes, setVotes] = useState<VoteState>({});
  const [canVote, setCanVote] = useState(false);
  const [voteMessage, setVoteMessage] = useState("正在加载大家的看法…");
  const [detailTab, setDetailTab] = useState<"details" | "votes">("details");

  useEffect(() => {
    fetch("/api/food-spots")
      .then(async (response) => {
        if (!response.ok) throw new Error("导入商家加载失败");
        return response.json() as Promise<{ spots: FoodSpot[] }>;
      })
      .then((data) => {
        if (!data.spots.length) return;
        setFoodSpots((current) => {
          const merged = new Map(current.map((spot) => [spot.id, spot]));
          for (const spot of data.spots) {
            const existing = merged.get(spot.id);
            if (!existing) {
              merged.set(spot.id, spot);
              continue;
            }
            const presentation = Object.fromEntries(
              (spot.importedFields ?? []).map((field) => [field, spot[field as keyof FoodSpot]]),
            );
            merged.set(spot.id, {
              ...existing,
              ...presentation,
              name: spot.name,
              campus: spot.campus,
              tier: spot.tier,
              provenance: spot.provenance,
              recommendReasons: spot.recommendReasons,
              recommendedDishes: spot.recommendedDishes,
              environmentPhotos: spot.environmentPhotos,
              importedFields: spot.importedFields,
            });
          }
          return [...merged.values()];
        });
        setRankings((current) => ({
          ...Object.fromEntries(data.spots.map((spot) => [spot.id, spot.tier])),
          ...current,
        }));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/food-rankings")
      .then(async (response) => {
        if (!response.ok) throw new Error("榜单加载失败");
        return response.json() as Promise<{ rankings: Record<string, FoodSpot["tier"]>; canEdit: boolean; user: { displayName: string } | null }>;
      })
      .then((data) => {
        setRankings((current) => ({ ...current, ...data.rankings }));
        setCanEditRankings(data.canEdit);
        setRankingUser(data.user?.displayName ?? null);
        setRankingMessage(data.canEdit ? "管理员编辑模式：拖动商家卡片即可调整档位" : "游客只读模式：可以查看商家详情、评价与地点");
      })
      .catch(() => setRankingMessage("榜单暂时按默认顺序展示"));
  }, []);

  useEffect(() => {
    setDetailTab("details");
  }, [activeSpot.id]);

  useEffect(() => {
    fetch("/api/food-votes")
      .then(async (response) => {
        if (!response.ok) throw new Error("投票加载失败");
        return response.json() as Promise<{ votes: VoteState; canVote: boolean }>;
      })
      .then((data) => {
        setVotes(data.votes);
        setCanVote(data.canVote);
        setVoteMessage(data.canVote ? "每人每个地点一票，随时可以改票" : "登录后可以参与投票");
      })
      .catch(() => setVoteMessage("暂时无法加载投票"));
  }, []);

  const visibleSpots = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foodSpots.filter((spot) => {
      const campusMatch = campus === "全部" || spot.campus === campus;
      const text = [spot.name, spot.type, spot.address, ...spot.tags].join(" ").toLowerCase();
      return campusMatch && (!q || text.includes(q));
    });
  }, [campus, query]);

  function spotTier(spot: FoodSpot) {
    return rankings[spot.id] ?? spot.tier;
  }

  async function moveSpot(spotId: string, nextTier: FoodSpot["tier"]) {
    if (!canEditRankings) return;
    const previousTier = rankings[spotId];
    setRankings((current) => ({ ...current, [spotId]: nextTier }));
    setRankingMessage("正在保存调整…");

    try {
      const response = await fetch("/api/food-rankings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spotId, tier: nextTier, position: 0 }),
      });
      if (!response.ok) throw new Error("保存失败");
      setRankingMessage(`已保存：${foodSpots.find((spot) => spot.id === spotId)?.name ?? "商家"} → ${nextTier}`);
    } catch {
      setRankings((current) => ({ ...current, [spotId]: previousTier }));
      setRankingMessage("调整没有保存，请确认管理员权限后重试");
    }
  }

  async function castVote(spotId: string, verdict: VoteVerdict) {
    if (!canVote) return;
    setVoteMessage("正在提交你的看法…");
    try {
      const response = await fetch("/api/food-votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spotId, verdict }),
      });
      if (!response.ok) throw new Error("投票失败");
      const data = await response.json() as { votes: VoteState };
      setVotes(data.votes);
      setVoteMessage("已记录，你可以随时改票");
    } catch {
      setVoteMessage("投票没有提交成功，请稍后重试");
    }
  }

  const activeVote = votes[activeSpot.id] ?? {
    counts: { underrated: 0, fair: 0, overrated: 0 },
    current: null,
  };
  const activeVoteTotal = activeVote.counts.underrated + activeVote.counts.fair + activeVote.counts.overrated;

  function toggleSaved(id: string) {
    setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="河大新生手册首页">
          <span className="brand-mark">河</span>
          <span><strong>HENU Kit</strong><small>河大新生手册</small></span>
        </a>
        <nav aria-label="主导航">
          <a href="#guide">新生攻略</a>
          <a href="#food">美食地图</a>
          <a href="#food-submit">投稿美食</a>
          <a href="#tools">校园工具</a>
        </nav>
        <a className="header-action" href="https://github.com/jry21223/HENU-Kit" target="_blank" rel="noreferrer">一起共建 ↗</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span /> 2026 新生友好版</div>
          <h1>在河大，<br /><em>把日子过明白。</em></h1>
          <p>从报到第一天，到找到你的深夜食堂。这里收好校园生活的关键入口、避坑经验和真实地图。</p>
          <div className="hero-actions">
            <a className="button primary" href="#guide">从第一周开始 <span>→</span></a>
            <a className="button ghost" href="#food">看看附近吃什么</a>
          </div>
          <div className="hero-proof">
            <div><strong>3</strong><span>校区视角</span></div>
            <div><strong>6</strong><span>开源工具</span></div>
            <div><strong>持续</strong><span>由学生共建</span></div>
          </div>
        </div>
        <div className="hero-art" aria-label="校园生活信息卡片组合">
          <div className="arch-card">
            <span className="arch-sun" />
            <div className="arch-lines" />
            <p>明德 · 新民<br />止于至善</p>
          </div>
          <div className="float-card food-note"><span>今日灵感</span><strong>灌汤包 + 杏仁茶</strong><small>开封味道从这里开始</small></div>
          <div className="float-card weather-note"><span>新生提示</span><strong>先认路，再赶课</strong><small>收藏教学楼与宿舍定位</small></div>
        </div>
      </section>

      <section className="ticker" aria-label="网站特色">
        <span>校园生活攻略</span><i>✦</i><span>真实地图导航</span><i>✦</i><span>学生视角点评</span><i>✦</i><span>开源工具入口</span><i>✦</i><span>持续更新</span>
      </section>

      <section className="section guide-section" id="guide">
        <div className="section-heading">
          <div><span className="kicker">FRESHMAN 101</span><h2>新生第一周，<br />照着做就好。</h2></div>
          <p>把最容易手忙脚乱的事，压缩成三个阶段。完成一个就划掉一个，别试图一天搞定所有校园生活。</p>
        </div>
        <div className="guide-grid">
          {guides.map((guide) => (
            <article className={`guide-card ${guide.tone}`} key={guide.n}>
              <span className="step">STEP {guide.n}</span>
              <h3>{guide.title}</h3>
              <ul>{guide.items.map((item) => <li key={item}><span>✓</span>{item}</li>)}</ul>
            </article>
          ))}
        </div>
        <div className="tip-strip"><strong>学长姐提醒</strong><p>任何要求你提供校园账号密码、验证码或付费“代操作”的陌生人，都先停一下。官方通知以学校和学院渠道为准。</p><span>安全第一</span></div>
      </section>

      <section className="section food-section" id="food">
        <div className="section-heading food-heading">
          <div><span className="kicker">HENU FOOD MAP</span><h2>下课以后，<br />去吃点真的。</h2></div>
          <p>校内食堂、河大周边、开封老字号与夜市，用真实地图串起来。首版资料以公开信息为底稿，欢迎学生实地校正。</p>
        </div>

        <div className="food-toolbar">
          <div className="campus-tabs" role="group" aria-label="按校区筛选">
            {(["全部", "明伦", "金明", "龙子湖"] as const).map((item) => (
              <button className={campus === item ? "active" : ""} onClick={() => setCampus(item)} key={item}>{item}{item !== "全部" && "校区"}</button>
            ))}
          </div>
          <label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜夜市、食堂或口味" /></label>
        </div>

        <div className="ranking-status">
          <span className={canEditRankings ? "admin-dot" : "visitor-dot"} />
          <strong>{canEditRankings ? "管理员" : "普通游客"}</strong>
          <p>{rankingMessage}</p>
          {rankingUser && <small>{rankingUser}</small>}
        </div>

        <div className={`tier-board ${canEditRankings ? "editable" : "readonly"}`} aria-label="五档美食排行榜">
          {foodTiers.map((item) => {
            const tierSpots = foodSpots.filter((spot) => spotTier(spot) === item.name);
            return (
              <section
                className={`tier-row ${item.className}`}
                key={item.name}
                onDragOver={(event) => { if (canEditRankings) event.preventDefault(); }}
                onDrop={(event) => {
                  if (!canEditRankings) return;
                  event.preventDefault();
                  const spotId = event.dataTransfer.getData("text/plain");
                  if (spotId) void moveSpot(spotId, item.name);
                }}
              >
                <div className="tier-label"><strong>{item.name}</strong><span>{item.note}</span></div>
                <div className="tier-dropzone">
                  {tierSpots.map((spot) => (
                    <button
                      className="ranking-card"
                      key={spot.id}
                      draggable={canEditRankings}
                      onDragStart={(event) => {
                        if (!canEditRankings) return;
                        event.dataTransfer.setData("text/plain", spot.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => setActiveSpot(spot)}
                      aria-label={`${spot.name}，${item.name}档，查看详情`}
                    >
                      <img src={spot.image} alt="" />
                      <span><strong>{spot.name}</strong><small>{spot.campus} · {spot.price}</small></span>
                      {canEditRankings && <i aria-hidden="true">⠿</i>}
                    </button>
                  ))}
                  {!tierSpots.length && <span className="empty-tier">拖到这里</span>}
                </div>
              </section>
            );
          })}
        </div>
        <p className="tier-note">五档整活榜 · 普通游客只读；管理员的拖动调整会保存到榜单。分档仅代表攻略编辑视角，欢迎实地吃过以后来“抬杠”。</p>

        <div className="map-layout" id="food-map">
          <div className="map-panel">
            <iframe title={`${activeSpot.name}真实地图`} src={activeSpot.map} loading="lazy" referrerPolicy="no-referrer" />
            <div className="map-overlay">
              <span>当前查看</span><strong>{activeSpot.name}</strong><small>{activeSpot.address}</small>
              <a href={`https://uri.amap.com/search?keyword=${encodeURIComponent(activeSpot.mapKeyword)}&src=henu-kit`} target="_blank" rel="noreferrer">在高德地图打开 ↗</a>
            </div>
            <div className="map-key"><span><i className="dot campus-dot" />校内</span><span><i className="dot food-dot" />美食目的地</span></div>
          </div>
          <div className="spot-list" aria-live="polite">
            {visibleSpots.length ? visibleSpots.map((spot) => (
              <article className={`spot-card ${activeSpot.id === spot.id ? "selected" : ""}`} key={spot.id}>
                <button className="spot-main" onClick={() => setActiveSpot(spot)} aria-label={`在地图查看${spot.name}`}>
                  <img src={spot.image} alt={spot.imageAlt} />
                  <span className="spot-copy">
                    <span className="spot-meta">{spot.type} · {spot.campus}</span>
                    <strong>{spot.name}</strong>
                    <small>{spot.price} · {spot.distance}</small>
                    <span className="tags">{spot.tags.map((tag) => <i key={tag}>{tag}</i>)}</span>
                  </span>
                </button>
                <span className={`tier-badge ${foodTiers.find((item) => item.name === spotTier(spot))?.className}`}>{spotTier(spot)}</span>
                <button className={`save ${saved.includes(spot.id) ? "saved" : ""}`} onClick={() => toggleSaved(spot.id)} aria-label={saved.includes(spot.id) ? `取消收藏${spot.name}` : `收藏${spot.name}`}>{saved.includes(spot.id) ? "♥" : "♡"}</button>
              </article>
            )) : <div className="empty-state"><strong>没找到对应地点</strong><p>换一个校区或关键词试试。</p></div>}
          </div>
        </div>

        <div className="detail-subnav" role="tablist" aria-label="商家二级菜单">
          <div><strong>{activeSpot.name}</strong><small>{spotTier(activeSpot)}档</small></div>
          <button role="tab" aria-selected={detailTab === "details"} className={detailTab === "details" ? "active" : ""} onClick={() => setDetailTab("details")}>商家详情</button>
          <button role="tab" aria-selected={detailTab === "votes"} className={detailTab === "votes" ? "active" : ""} onClick={() => setDetailTab("votes")}>学生评分 <span>{activeVoteTotal}</span></button>
        </div>

        {detailTab === "details" ? (
          <div className="detail-panel" role="tabpanel">
            <div className="spot-detail">
              <div><span className="detail-label">{spotTier(activeSpot)}档 · 攻略点评</span><p>{activeSpot.review}</p></div>
              <dl><div><dt>地址</dt><dd>{activeSpot.address}</dd></div><div><dt>营业参考</dt><dd>{activeSpot.hours}</dd></div><div><dt>资料状态</dt><dd>{activeSpot.verified ? "公开信息已核对" : "等待学生实地核验"}</dd></div><div><dt>数据来源</dt><dd>{activeSpot.provenance ? <><a href={activeSpot.provenance.url} target="_blank" rel="noreferrer">{activeSpot.provenance.name} ↗</a><small>核验于 {activeSpot.provenance.checkedAt}</small></> : "等待补充"}</dd></div></dl>
            </div>
            <div className="recommendation-detail">
              <section className="reason-list">
                <span className="detail-label">WHY WE PICKED IT</span>
                <h3>为什么推荐</h3>
                <ol>{activeSpot.recommendReasons?.map((reason, index) => <li key={reason}><span>0{index + 1}</span>{reason}</li>)}</ol>
              </section>
              <section className="dish-gallery">
                <div><span className="detail-label">WHAT TO ORDER</span><h3>推荐菜品</h3></div>
                <div className="media-cards">{activeSpot.recommendedDishes?.map((dish) => <article key={dish.name}><img src={dish.image} alt={`${activeSpot.name}的${dish.name}参考图`} /><div><strong>{dish.name}</strong><p>{dish.note}</p></div></article>)}</div>
              </section>
              <section className="environment-gallery">
                <div><span className="detail-label">THE VIBE</span><h3>店里环境</h3></div>
                <div className="environment-media">{activeSpot.environmentPhotos?.map((photo) => <figure key={photo.label}><img src={photo.image} alt={photo.label} /><figcaption>{photo.label}</figcaption></figure>)}</div>
              </section>
            </div>
          </div>
        ) : (
          <div className="community-vote" role="tabpanel">
            <div className="vote-copy">
              <span className="detail-label">COMMUNITY CHECK</span>
              <h3>这个档位，大家服不服？</h3>
              <p>{activeVoteTotal ? `已有 ${activeVoteTotal} 人参与纠偏。管理员负责排榜，大家负责指出它被低估了，还是有点虚高。` : "还没有人投票，你可以成为第一个给出判断的人。"}</p>
              <small>{voteMessage}</small>
            </div>
            <div className="vote-options">
              {([
                { value: "underrated", label: "被低估了", hint: "应该往上抬" },
                { value: "fair", label: "基本合理", hint: "这个档位合适" },
                { value: "overrated", label: "有点虚高", hint: "应该往下放" },
              ] as const).map((option) => (
                <button
                  className={`${option.value} ${activeVote.current === option.value ? "selected" : ""}`}
                  key={option.value}
                  disabled={!canVote}
                  onClick={() => void castVote(activeSpot.id, option.value)}
                >
                  <span><strong>{option.label}</strong><small>{option.hint}</small></span>
                  <b>{activeVote.counts[option.value]}</b>
                </button>
              ))}
              {!canVote && <a className="vote-signin" href="/signin-with-chatgpt?return_to=%2F%23food">登录后参与投票 →</a>}
            </div>
          </div>
        )}
        <p className="photo-note">图片为真实菜品氛围图，不代表具体商家出品；营业时间、价格与门店状态可能变化，请以地图和现场信息为准。</p>
      </section>

      <FoodSubmissionSection />

      <section className="section tools-section" id="tools">
        <div className="section-heading">
          <div><span className="kicker">CAMPUS TOOLBOX</span><h2>可以看看这些，<br />也许正好对你有用。</h2></div>
          <p>这里收集了学长姐维护的校园工具和资料。需要的时候点开看看，不需要也没关系，先知道它们在这里就好。</p>
        </div>
        <div className="tools-grid">
          {tools.map((tool, index) => (
            <a className="tool-card" href={tool.href} target="_blank" rel="noreferrer" key={tool.name}>
              <span className="tool-index">0{index + 1}</span><span className="tool-label">{tool.label}</span><h3>{tool.name}</h3><p>{tool.desc}</p><span className="tool-link">查看项目 ↗</span>
            </a>
          ))}
        </div>
      </section>

      <section className="contribute">
        <div><span className="kicker">BUILT BY STUDENTS</span><h2>你踩过的坑，<br />可以成为别人的路标。</h2></div>
        <div><p>发现信息过期？有真正值得推荐的窗口、店铺或校园经验？美食可以直接在站内投稿，其他攻略也可以通过 GitHub 表单告诉我们。</p><div className="contribute-actions"><a className="button light" href="#food-submit">投稿一家好店 <span>→</span></a><a className="contribute-link" href="https://github.com/jry21223/HENU-Kit/issues/new" target="_blank" rel="noreferrer">提交其他攻略 ↗</a></div></div>
      </section>

      <footer>
        <div className="footer-brand"><span className="brand-mark">河</span><div><strong>HENU Kit</strong><small>非河南大学官方项目 · 由学生维护</small></div></div>
        <div className="footer-links"><a href="https://kfxq.henu.edu.cn/xqgkl/xqgk/mlxq.htm" target="_blank" rel="noreferrer">校区资料</a><a href="https://www.gulou.gov.cn/kfsglqwz/c00173/pc/content/content_1889528282980225024.html" target="_blank" rel="noreferrer">鼓楼夜市资料</a><a href="https://hq.henu.edu.cn/info/1021/19801.htm" target="_blank" rel="noreferrer">食堂资料</a></div>
        <p>Keep in touch. Keep it useful.</p>
      </footer>
    </main>
  );
}
