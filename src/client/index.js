/**
 * 属于我们的回忆 · 客户端半边
 *
 * ─────────────────────────────────────────────────────────────
 * 这个文件**没有经过任何打包器**，也没有任何 npm 依赖。它是故意的。
 *
 * DSH 的浏览器插件契约只有三条（都是端到端侦察出来的，别自己发明）：
 *
 *   1. 文件必须调用 `window.__ModuleLoader__.load({ id, factory })`。
 *      "执行 bundle 只注册工厂；模块副作用在物化时才跑" —— 所以整个
 *      插件体都待在 factory 闭包里。
 *   2. `id` **必须等于包名**（这里是 `dsh-hierarchical-fishmemory`）。
 *   3. `factory(require)` 返回一个 Cordis 插件：`{ name, inject, apply }`。
 *
 * `require` 能解析的只有外壳那张**冻结的模块表**，我们只 require `react`。
 *
 * 【为什么不用 JSX】
 * 没有打包器，就没有 JSX 变换。所以全程 `React.createElement`。
 *
 * ─────────────────────────────────────────────────────────────
 * 界面只有三件事：**看 / 删 / 带走**。没有搜索、没有标签筛选、没有图表。
 *
 * 2026-11-16：整个界面重做了一遍。原来每个组件手里攥着一把内联 style 对象，
 * 写法一样、长得却各不一样，悬停、过渡、层次一样都做不了 —— 内联样式写不出
 * `:hover`。现在颜色和间距收进一份 CSS（`__fs_*` 前缀，全部挂在 `.feiyu-root`
 * 下面），组件只负责结构。**主题仍然全走 `--dsw-alias-*` token**：写死颜色在
 * 深色模式下必翻车。
 *
 * 唯一的例外是侧栏那个小图标（`Icon`）—— 它由宿主当作插槽组件调用，
 * 拿不到 `.feiyu-root` 这层壳，只能继续用内联样式和 `currentColor`。
 */
window.__ModuleLoader__.load({
  id: 'dsh-hierarchical-fishmemory',

  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect } = React;

    /** 侧栏格子的 id，同时也是主面板的 key。**必须与注册时一致。** */
    const PANEL_ID = 'feiyu-diary';
    /** 主机的数据接口前缀，和 host 半边的 PANEL_BASE 必须对得上 */
    const API = '/feiyu-diary';

    /* ───────────────────────── 样式 ───────────────────────── */
    //
    // 一份，一次，挂到 head 上。全部颜色走 token：
    // `--dsw-alias-*` 的 requiresLightAndDark 都是 true，写死颜色就会翻车。
    // 每个 token 都带了一个兜底值 —— 宿主换 token 名字时最多是"配色朴素了"，
    // 不会变成白底白字。
    //
    // `color-mix()` 那几行是加分的：不支持它的 WebView 会把整条声明丢掉，
    // 落在它前面那条普通声明上。**顺序不能反**。
    const CSS = `
.feiyu-root{
  --fs-bg:var(--dsw-alias-bg-base,#fff);
  --fs-l1:var(--dsw-alias-bg-layer-1,#fafafa);
  --fs-l2:var(--dsw-alias-bg-layer-2,#f2f3f5);
  --fs-l3:var(--dsw-alias-bg-layer-3,#e9eaec);
  --fs-soft:var(--dsw-alias-bg-layer-2,#f2f3f5);
  --fs-line:var(--dsw-alias-border-l1,rgba(0,0,0,.09));
  --fs-line2:var(--dsw-alias-border-l2,rgba(0,0,0,.18));
  --fs-t1:var(--dsw-alias-label-primary,#14161a);
  --fs-t2:var(--dsw-alias-label-secondary,#5c6370);
  --fs-t3:var(--dsw-alias-label-tertiary,#8b929e);
  --fs-brand:var(--dsw-alias-brand-primary,#4d6bfe);
  --fs-err:var(--dsw-alias-state-error-primary,#e5484d);
  --fs-radius:15px;
  --fs-ease:cubic-bezier(.22,.61,.36,1);
  height:100%;overflow-y:auto;overflow-x:hidden;
  background:var(--fs-bg);color:var(--fs-t1);
  font-feature-settings:"tnum" 1;
  -webkit-font-smoothing:antialiased;
}
.feiyu-root *{box-sizing:border-box}
.feiyu-root .fs-shell{max-width:768px;margin:0 auto;padding:0 22px 80px}

/* ── 头部 ── */
.feiyu-root .fs-hero{position:relative;padding:34px 0 6px}
.feiyu-root .fs-hero:before{content:"";position:absolute;left:-30px;right:-30px;top:-70px;height:230px;
  background:linear-gradient(180deg,var(--fs-l2),transparent);opacity:.6;pointer-events:none;
  -webkit-mask-image:radial-gradient(70% 100% at 22% 0%,#000,transparent 72%);
  mask-image:radial-gradient(70% 100% at 22% 0%,#000,transparent 72%)}
.feiyu-root .fs-brand{position:relative;display:flex;align-items:center;gap:14px}
.feiyu-root .fs-orb{flex:none;width:46px;height:46px;border-radius:15px;display:grid;place-items:center;
  color:#fff;background:linear-gradient(150deg,var(--fs-brand),var(--fs-brand));
  box-shadow:0 10px 24px -12px var(--fs-brand)}
.feiyu-root .fs-orb svg{opacity:.96}
.feiyu-root .fs-brandText{min-width:0}
.feiyu-root .fs-title{margin:0;font-size:20px;line-height:1.25;font-weight:650;letter-spacing:-.02em}
.feiyu-root .fs-sub{margin:4px 0 0;font-size:12.5px;line-height:1.6;color:var(--fs-t2)}

/* ── 数 ── */
.feiyu-root .fs-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:9px;margin-top:18px}
.feiyu-root .fs-metric{padding:11px 13px;border-radius:13px;border:1px solid var(--fs-line);
  background:linear-gradient(180deg,var(--fs-l1),var(--fs-bg))}
.feiyu-root .fs-metric b{display:block;font-size:19px;line-height:1.25;font-weight:650;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.feiyu-root .fs-metric span{display:block;margin-top:2px;font-size:11.5px;color:var(--fs-t2)}

/* ── 小标签 ── */
.feiyu-root .fs-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.feiyu-root .fs-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;
  border:1px solid var(--fs-line);background:var(--fs-l1);font-size:11.5px;line-height:1.7;color:var(--fs-t2);white-space:nowrap}
.feiyu-root .fs-chip--warn{color:var(--fs-err);border-color:var(--fs-err);background:transparent}

/* ── 页签：吸顶、药丸、模糊底 ── */
.feiyu-root .fs-tabs{position:sticky;top:0;z-index:6;display:flex;gap:4px;
  margin:22px -22px 0;padding:10px 22px;
  background:var(--fs-bg);border-bottom:1px solid var(--fs-line);
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.feiyu-root .fs-tab{appearance:none;border:0;background:none;font:inherit;font-size:13px;line-height:1;
  color:var(--fs-t2);padding:9px 15px;border-radius:999px;cursor:pointer;
  transition:background .18s var(--fs-ease),color .18s var(--fs-ease)}
.feiyu-root .fs-tab:hover{color:var(--fs-t1);background:var(--fs-l2)}
.feiyu-root .fs-tab[aria-selected="true"]{color:var(--fs-t1);font-weight:600;background:var(--fs-l2);
  box-shadow:inset 0 0 0 1px var(--fs-line)}

/* ── 卡片 ── */
.feiyu-root .fs-card{margin-top:14px;padding:16px 18px;border-radius:var(--fs-radius);
  border:1px solid var(--fs-line);background:var(--fs-l1)}
.feiyu-root .fs-card--plain{background:transparent}
.feiyu-root .fs-cardHead{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.feiyu-root .fs-cardTitle{font-size:13.5px;font-weight:650;letter-spacing:-.005em;color:var(--fs-t1)}
.feiyu-root .fs-cardHint{margin:0 0 12px;font-size:11.5px;line-height:1.75;color:var(--fs-t2)}
.feiyu-root .fs-grow{flex:1}

/* ── 一天一段的日记 ── */
.feiyu-root .fs-day{display:flex;align-items:center;gap:9px;margin-top:26px}
.feiyu-root .fs-dayName{font-size:12.5px;font-weight:650;letter-spacing:.01em;color:var(--fs-t1)}
.feiyu-root .fs-dayCount{font-size:11px;color:var(--fs-t3);font-variant-numeric:tabular-nums}
.feiyu-root .fs-day:after{content:"";flex:1;height:1px;
  background:linear-gradient(90deg,var(--fs-line),transparent)}
.feiyu-root .fs-rail{position:relative;margin-top:10px;padding-left:18px}
.feiyu-root .fs-rail:before{content:"";position:absolute;left:3px;top:8px;bottom:8px;width:1px;
  background:linear-gradient(180deg,var(--fs-line),var(--fs-line),transparent)}
.feiyu-root .fs-entry{position:relative;margin-bottom:8px;padding:12px 14px 10px;border-radius:12px;
  border:1px solid var(--fs-line);background:var(--fs-bg);
  transition:border-color .18s var(--fs-ease),box-shadow .18s var(--fs-ease),transform .18s var(--fs-ease)}
.feiyu-root .fs-entry:hover{border-color:var(--fs-line2);transform:translateY(-1px);
  box-shadow:0 12px 26px -22px rgba(0,0,0,.55)}
.feiyu-root .fs-entry:before{content:"";position:absolute;left:-18px;top:17px;width:7px;height:7px;border-radius:50%;
  background:var(--fs-bg);border:1.5px solid var(--fs-line2);transition:border-color .18s var(--fs-ease)}
.feiyu-root .fs-entry:hover:before{border-color:var(--fs-brand)}
.feiyu-root .fs-entryMeta{display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:11px;color:var(--fs-t3)}
.feiyu-root .fs-clock{font-variant-numeric:tabular-nums;letter-spacing:.02em}
.feiyu-root .fs-entryText{margin:0;font-size:13px;line-height:1.8;color:var(--fs-t1);word-break:break-word}
.feiyu-root .fs-entryFoot{display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-top:6px;min-height:18px}
.feiyu-root .fs-entryFoot .fs-link{opacity:.55;transition:opacity .18s var(--fs-ease)}
.feiyu-root .fs-entry:hover .fs-entryFoot .fs-link,.feiyu-root .fs-entryFoot .fs-link:focus-visible{opacity:.95}
.feiyu-root .fs-confirm{display:inline-flex;align-items:center;gap:10px;font-size:12px;color:var(--fs-t2)}

/* ── 按钮 / 链接 ── */
.feiyu-root .fs-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:10px;
  border:1px solid var(--fs-line);background:var(--fs-bg);color:var(--fs-t1);font:inherit;font-size:12.5px;
  line-height:1.5;text-decoration:none;cursor:pointer;
  transition:background .16s var(--fs-ease),border-color .16s var(--fs-ease),transform .1s var(--fs-ease)}
.feiyu-root .fs-btn:hover:not(:disabled){background:var(--fs-l2);border-color:var(--fs-line2)}
.feiyu-root .fs-btn:active:not(:disabled){transform:scale(.985)}
.feiyu-root .fs-btn:disabled{opacity:.5;cursor:default}
.feiyu-root .fs-btn--sm{padding:4px 10px;font-size:11.5px;border-radius:8px}
.feiyu-root .fs-btn--primary{background:var(--fs-brand);border-color:transparent;color:#fff}
.feiyu-root .fs-btn--primary:hover:not(:disabled){background:var(--fs-brand);border-color:transparent;filter:brightness(1.07)}
.feiyu-root .fs-link{appearance:none;border:0;background:none;padding:0;margin:0;font:inherit;font-size:12px;
  color:var(--fs-t2);cursor:pointer;text-decoration:underline;text-underline-offset:3px;
  text-decoration-color:var(--fs-line2)}
.feiyu-root .fs-link:hover{color:var(--fs-t1)}
.feiyu-root .fs-link--brand{color:var(--fs-brand);text-decoration-color:transparent}
.feiyu-root .fs-link--brand:hover{color:var(--fs-brand);text-decoration-color:currentColor}
.feiyu-root .fs-link--danger{color:var(--fs-err);text-decoration-color:transparent}
.feiyu-root .fs-link--danger:hover{color:var(--fs-err);text-decoration-color:currentColor}

/* ── 空 / 载入 / 报错 ── */
.feiyu-root .fs-empty{margin:16px 0 0;padding:34px 18px;border-radius:var(--fs-radius);
  border:1px dashed var(--fs-line2);text-align:center;color:var(--fs-t2)}
.feiyu-root .fs-empty svg{opacity:.4;margin-bottom:8px}
.feiyu-root .fs-empty p{margin:0;font-size:12.5px;line-height:1.8}
.feiyu-root .fs-skel{margin-top:26px}
.feiyu-root .fs-skelRow{height:64px;margin-bottom:8px;border-radius:12px;
  background:linear-gradient(90deg,var(--fs-l1),var(--fs-l2),var(--fs-l1));
  background-size:200% 100%;animation:fs-shimmer 1.4s linear infinite}
@keyframes fs-shimmer{from{background-position:160% 0}to{background-position:-60% 0}}
.feiyu-root .fs-banner{margin:12px 0 0;padding:9px 12px;border-radius:10px;font-size:12px;line-height:1.7;
  border:1px solid var(--fs-err);color:var(--fs-err);background:transparent}
.feiyu-root .fs-banner--ok{border-color:var(--fs-line2);color:var(--fs-t2)}

/* ── 体检：小节 + 键值行 ── */
.feiyu-root .fs-stack{display:flex;flex-direction:column;gap:14px}
.feiyu-root .fs-sectionHead{display:flex;align-items:center;gap:10px;margin-bottom:2px}
.feiyu-root .fs-sectionTitle{font-size:13px;font-weight:650}
.feiyu-root .fs-subHead{margin:12px 0 4px;font-size:11.5px;font-weight:600;color:var(--fs-t2);
  letter-spacing:.02em;text-transform:none}
.feiyu-root .fs-kv{display:flex;justify-content:space-between;gap:14px;padding:5px 0;font-size:12px;
  border-bottom:1px dashed transparent}
.feiyu-root .fs-kv+.fs-kv{border-top:1px solid var(--fs-line)}
.feiyu-root .fs-kvK{color:var(--fs-t2)}
.feiyu-root .fs-kvV{font-variant-numeric:tabular-nums;text-align:right}
.feiyu-root .fs-warn{margin-top:10px;padding:10px 12px;border-radius:10px;border:1px solid var(--fs-line2);
  background:var(--fs-bg);font-size:12px;line-height:1.75}
.feiyu-root .fs-warn b{font-weight:600}
.feiyu-root .fs-warnRow{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;padding:3px 0;color:var(--fs-t2)}
.feiyu-root .fs-warnRow span{color:var(--fs-t1)}
.feiyu-root .fs-note{margin:6px 0 0;font-size:11.5px;line-height:1.75;color:var(--fs-t2)}
.feiyu-root .fs-note--tiny{font-size:11px;opacity:.9}

/* ── 本子 ── */
.feiyu-root .fs-book+.fs-book{margin-top:18px;padding-top:18px;border-top:1px solid var(--fs-line)}
.feiyu-root .fs-bookHead{display:flex;align-items:baseline;gap:8px;margin-bottom:8px}
.feiyu-root .fs-bookTitle{font-size:13px;font-weight:650}
.feiyu-root .fs-bookHint{font-size:11px;color:var(--fs-t2)}
.feiyu-root .fs-pre{margin:10px 0 0;padding:12px 14px;border-radius:10px;background:var(--fs-bg);
  border:1px solid var(--fs-line);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:12px;line-height:1.8;color:var(--fs-t1);white-space:pre-wrap;word-break:break-word;
  max-height:340px;overflow:auto}
.feiyu-root .fs-editor{width:100%;min-height:220px;padding:12px 14px;border-radius:10px;
  border:1px solid var(--fs-line2);background:var(--fs-bg);color:var(--fs-t1);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.8;
  resize:vertical;outline:none;transition:border-color .16s var(--fs-ease),box-shadow .16s var(--fs-ease)}
.feiyu-root .fs-editor:focus{border-color:var(--fs-brand);box-shadow:0 0 0 3px rgba(77,107,254,.14)}
.feiyu-root .fs-actions{display:flex;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap;font-size:11.5px;color:var(--fs-t2)}

/* ── 情感日记：热力格 + 天卡片 ── */
.feiyu-root .fs-heat{display:grid;grid-template-rows:repeat(7,11px);grid-auto-flow:column;
  grid-auto-columns:11px;gap:3px;margin-top:12px}
.feiyu-root .fs-cell{width:11px;height:11px;border-radius:3px;border:1px solid var(--fs-line);
  transition:transform .12s var(--fs-ease)}
.feiyu-root .fs-cell:hover{transform:scale(1.25)}
.feiyu-root .fs-heatFoot{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11px;color:var(--fs-t2)}
.feiyu-root .fs-days{margin-top:12px}
.feiyu-root .fs-dayCard{margin-top:8px;border-radius:12px;border:1px solid var(--fs-line);
  background:transparent;overflow:hidden;transition:border-color .16s var(--fs-ease)}
.feiyu-root .fs-dayCard--open{background:var(--fs-bg);border-color:var(--fs-line2)}
.feiyu-root .fs-dayHead{display:flex;align-items:baseline;gap:8px;padding:9px 12px;cursor:pointer;
  user-select:none}
.feiyu-root .fs-dayHead:hover{background:var(--fs-l2)}
.feiyu-root .fs-dayDate{font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums}
.feiyu-root .fs-dayPreview{flex:1;min-width:0;font-size:11.5px;color:var(--fs-t2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.feiyu-root .fs-dayChars{font-size:10.5px;color:var(--fs-t3);white-space:nowrap}
.feiyu-root .fs-caret{font-size:10px;color:var(--fs-t3);width:10px;text-align:center;
  transition:transform .16s var(--fs-ease)}
.feiyu-root .fs-dayBody{padding:2px 14px 14px}
.feiyu-root .fs-blockTitle{margin:12px 0 4px;font-size:12px;font-weight:600;color:var(--fs-t1)}
.feiyu-root .fs-para{margin:0 0 7px;font-size:12.5px;line-height:1.9;color:var(--fs-t1);white-space:pre-wrap}
.feiyu-root .fs-seg{display:inline-flex;padding:2px;gap:2px;border-radius:9px;border:1px solid var(--fs-line);
  background:var(--fs-l1)}
.feiyu-root .fs-segBtn{appearance:none;border:0;background:none;font:inherit;font-size:11.5px;
  color:var(--fs-t2);padding:4px 10px;border-radius:7px;cursor:pointer;
  transition:background .16s var(--fs-ease),color .16s var(--fs-ease)}
.feiyu-root .fs-segBtn[aria-selected="true"]{background:var(--fs-l3);color:var(--fs-t1);font-weight:600}

/* ── 档案：块 ── */
.feiyu-root .fs-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:9px}
.feiyu-root .fs-tile{display:flex;flex-direction:column;gap:3px;padding:13px 14px;border-radius:12px;
  border:1px solid var(--fs-line);background:var(--fs-bg);color:inherit;text-decoration:none;
  transition:border-color .16s var(--fs-ease),transform .16s var(--fs-ease),box-shadow .16s var(--fs-ease)}
.feiyu-root .fs-tile:hover{border-color:var(--fs-line2);transform:translateY(-1px);
  box-shadow:0 12px 26px -22px rgba(0,0,0,.55)}
.feiyu-root .fs-tileTitle{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600}
.feiyu-root .fs-tileDesc{font-size:11px;line-height:1.6;color:var(--fs-t2)}

@media(max-width:520px){
  .feiyu-root .fs-shell{padding:0 16px 72px}
  .feiyu-root .fs-tabs{margin-left:-16px;margin-right:-16px;padding-left:16px;padding-right:16px}
  .feiyu-root .fs-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}
  .feiyu-root .fs-tiles{grid-template-columns:1fr}
}
@media(prefers-reduced-motion:reduce){
  .feiyu-root *{transition:none!important;animation:none!important}
}
`;

    (function injectCss() {
      if (typeof document === 'undefined') return;
      const id = 'dsh-hierarchical-fishmemory/panel.css';
      if (document.querySelector(`style[data-plugin-css="${id}"]`) !== null) return;
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-hierarchical-fishmemory';
      tag.dataset.pluginCss = id;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    })();

    /**
     * 主题 token。2026-11-16 之后界面主要靠 CSS 类，这里只留给少数
     * 必须在 JS 里算颜色的地方（热力格深浅、报错色）。
     */
    const C = {
      border1: 'var(--dsw-alias-border-l1)',
      border2: 'var(--dsw-alias-border-l2)',
      text1: 'var(--dsw-alias-label-primary)',
      text2: 'var(--dsw-alias-label-secondary)',
      err: 'var(--dsw-alias-state-error-primary)',
      brand: 'var(--dsw-alias-brand-primary)',
    };

    /* ───────────────────────── 图标 ───────────────────────── */

    /**
     * 侧栏图标。owner 会传 `{ size, active }` ——
     * 这是 `SidebarPanelIconOwnerProps`，别改成别的 props 名。
     */
    function Icon(props) {
      const size = props && typeof props.size === 'number' ? props.size : 20;
      const active = Boolean(props && props.active);
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          role: 'img',
          'aria-label': '属于我们的回忆',
          style: { display: 'block', opacity: active ? 1 : 0.72 },
        },
        h('ellipse', {
          cx: 14,
          cy: 12,
          rx: 7.6,
          ry: 5.2,
          stroke: 'currentColor',
          strokeWidth: 1.5,
        }),
        h('path', {
          d: 'M6.9 12 L2 8.2 L2 15.8 Z',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinejoin: 'round',
        }),
        h('circle', { cx: 18.4, cy: 10.6, r: 1.05, fill: 'currentColor' }),
      );
    }

    /** 界面里那些小图形。统一 1.5 描边、圆角端点，跟侧栏那只鱼同一个手。 */
    const GLYPHS = {
      fish: [
        ['ellipse', { cx: 13.4, cy: 12, rx: 7.4, ry: 5 }],
        ['path', { d: 'M6.4 12 L1.8 8.6 L1.8 15.4 Z' }],
        ['circle', { cx: 17.6, cy: 10.8, r: 1, fill: 'currentColor', stroke: 'none' }],
      ],
      book: [
        ['path', { d: 'M4 5.5h6.5A2.5 2.5 0 0 1 13 8v11a2 2 0 0 0-2-2H4z' }],
        ['path', { d: 'M20 5.5h-6.5A2.5 2.5 0 0 0 11 8v11a2 2 0 0 1 2-2h7z' }],
      ],
      pulse: [
        ['path', { d: 'M3 12.5h4l2.5-6 4 12 2.5-6H21' }],
      ],
      box: [
        ['path', { d: 'M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z' }],
        ['path', { d: 'M3.5 7.5 12 11.5l8.5-4M12 11.5v9' }],
      ],
      cloud: [
        ['path', { d: 'M7 18.5a4 4 0 0 1-.4-8A5.6 5.6 0 0 1 17.2 9a3.9 3.9 0 0 1 .3 9.5z' }],
      ],
      arrow: [
        ['path', { d: 'M7 12h9.5M13 8l4 4-4 4' }],
      ],
      spark: [
        ['path', { d: 'M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.6 2.6M15.4 15.4 18 18M18 6l-2.6 2.6M8.6 15.4 6 18' }],
      ],
    };

    function Glyph(props) {
      const name = String(props.name || 'fish');
      const size = typeof props.size === 'number' ? props.size : 16;
      const parts = GLYPHS[name] || GLYPHS.fish;
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          style: { display: 'block', flex: 'none' },
        },
        parts.map((part, i) => h(part[0], Object.assign({ key: `p${i}` }, part[1]))),
      );
    }

    /* ───────────────────────── 小组件 ───────────────────────── */

    /** 空状态。一整块虚线的安静地方，比一句小字像"这里本来有东西"。 */
    function Empty(props) {
      return h(
        'div',
        { className: 'fs-empty' },
        props.icon === false ? null : h(Glyph, { name: props.icon || 'fish', size: 26 }),
        h('p', null, props.text),
      );
    }

    /** 卡片外壳：一层底、一条边、一段自己的标题。 */
    function Card(props) {
      const plain = Boolean(props.plain);
      return h(
        'div',
        { className: plain ? 'fs-card fs-card--plain' : 'fs-card', style: props.style },
        props.title
          ? h(
              'div',
              { className: 'fs-cardHead' },
              h('span', { className: 'fs-cardTitle' }, props.title),
              h('span', { className: 'fs-grow' }),
              props.aside || null,
            )
          : null,
        props.hint ? h('p', { className: 'fs-cardHint' }, props.hint) : null,
        props.children,
      );
    }

    /** 小圆角标签：摆「回收站 3 条」「档案只读」这种短状态。 */
    function Chip(props) {
      return h(
        'span',
        { className: props.warn ? 'fs-chip fs-chip--warn' : 'fs-chip' },
        props.children,
      );
    }

    /**
     * 页签。
     *
     * 四个视图**始终挂载**，只靠 display 切换。两个理由：
     *   1. 切来切去不该重拉一次 /stats、/feelings —— 那是好几趟往返；
     *   2. 渲染冒烟测试里那些块必须首屏就在树里。
     */
    function Tabs(props) {
      return h(
        'div',
        { role: 'tablist', className: 'fs-tabs' },
        props.tabs.map((tab) =>
          h(
            'button',
            {
              key: tab.key,
              type: 'button',
              role: 'tab',
              'aria-selected': props.value === tab.key,
              className: 'fs-tab',
              onClick: () => props.onChange(tab.key),
            },
            tab.label,
          ),
        ),
      );
    }

    /** 描边按钮/链接：导出、导入、上传都同一个样子。 */
    function Ghost(props) {
      const cls = `fs-btn${props.primary ? ' fs-btn--primary' : ''}`;
      if (props.href) {
        return h(
          'a',
          { href: props.href, download: '', className: cls, style: props.style },
          props.icon ? h(Glyph, { name: props.icon }) : null,
          props.children,
        );
      }
      return h(
        'button',
        {
          type: 'button',
          disabled: props.disabled,
          onClick: props.onClick,
          className: cls,
          style: props.style,
        },
        props.icon ? h(Glyph, { name: props.icon }) : null,
        props.children,
      );
    }

    /** 段落小标题：体检页里「深层 · xx」「档案」用。 */
    function SubHead(props) {
      return h('div', { className: 'fs-subHead' }, props.children);
    }

    /** 一行「标签 —— 值」。 */
    function KV(props) {
      return h(
        'div',
        { className: 'fs-kv' },
        h('span', { className: 'fs-kvK' }, props.label),
        h('span', { className: 'fs-kvV' }, String(props.value)),
      );
    }

    /* ───────────────────────── 一条日记 ───────────────────────── */

    function clockOf(ts) {
      if (!Number.isFinite(ts)) return '';
      const d = new Date(ts);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function Entry(props) {
      const e = props.entry;
      const [confirming, setConfirming] = useState(false);

      return h(
        'article',
        { className: 'fs-entry' },
        h('div', { className: 'fs-entryMeta' }, h('span', { className: 'fs-clock' }, clockOf(e.created_at))),
        h('p', { className: 'fs-entryText' }, e.text),
        h(
          'div',
          { className: 'fs-entryFoot' },
          confirming
            ? h(
                'span',
                { className: 'fs-confirm' },
                h('span', null, '确定忘掉？'),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'fs-link fs-link--danger',
                    onClick: () => props.onForget(e.id),
                  },
                  '忘掉',
                ),
                h(
                  'button',
                  { type: 'button', className: 'fs-link', onClick: () => setConfirming(false) },
                  '算了',
                ),
              )
            : h(
                'button',
                {
                  type: 'button',
                  className: 'fs-link',
                  title: '从档案里删掉这一条',
                  disabled: Boolean(props.busy),
                  onClick: () => setConfirming(true),
                },
                props.busy ? '正在忘…' : '忘掉',
              ),
        ),
      );
    }

    function linkStyle(color) {
      return {
        margin: 0,
        padding: 0,
        border: 0,
        background: 'none',
        color,
        font: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: 3,
      };
    }

    /** 时间说人话：今天 / 昨天 / 3 天前 / 10-05 */
    function dayLabel(ts) {
      if (!Number.isFinite(ts)) return '';
      const startOfDay = (t) => {
        const d = new Date(t);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      };
      const days = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000);
      if (days <= 0) return '今天';
      if (days === 1) return '昨天';
      if (days < 7) return `${days} 天前`;
      const d = new Date(ts);
      return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`;
    }

    /* ───────────────────────── 本子 ───────────────────────── */

    /**
     * 「鱼的日子」和「手记」——面板里的两个入口。
     *
     * 这两个文件都在档案目录里，插件从不覆盖它们，所以这里只做两件事：
     * **看** 和 **存**。走 host 的同源接口 `${API}/notes`。
     */
    function Notebook(props) {
      const only = (props && props.only) || null;
      const [notes, setNotes] = useState(null);
      const [error, setError] = useState('');
      const [editing, setEditing] = useState('');
      const [draft, setDraft] = useState('');
      const [saving, setSaving] = useState('');

      useEffect(() => {
        let alive = true;
        fetch(`${API}/notes`, { credentials: 'same-origin' })
          .then((r) => r.json())
          .then((data) => {
            if (!alive) return;
            if (data && data.ok) setNotes(data.notes || []);
            else setError((data && data.error) || '读不到本子');
          })
          .catch((err) => {
            if (alive) setError(String((err && err.message) || err));
          });
        return () => {
          alive = false;
        };
      }, []);

      function save(key) {
        setSaving(key);
        setError('');
        fetch(`${API}/notes`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, text: draft }),
        })
          .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
          .then(({ ok, body }) => {
            if (!ok || !body.ok) throw new Error(body.error || '没存上');
            setNotes((prev) => (prev || []).map((n) => (n.key === key ? Object.assign({}, n, { text: draft }) : n)));
            setEditing('');
            setSaving('');
          })
          .catch((err) => {
            setSaving('');
            setError(String((err && err.message) || err));
          });
      }

      let body;
      const shown = notes === null ? null : only ? notes.filter((n) => only.indexOf(n.key) !== -1) : notes;
      if (shown === null) {
        body = h('p', { className: 'fs-note' }, '翻本子…');
      } else if (shown.length === 0) {
        body = h(Empty, { icon: 'book', text: '没有可翻的本子。' });
      } else {
        body = shown.map((n) =>
          h(
            'div',
            { key: n.key, className: 'fs-book' },
            h(
              'div',
              { className: 'fs-bookHead' },
              h('span', { className: 'fs-bookTitle' }, n.label),
              h('span', { className: 'fs-bookHint' }, n.hint),
              h('span', { className: 'fs-grow' }),
              editing === n.key
                ? null
                : h(
                    'button',
                    {
                      type: 'button',
                      className: 'fs-link fs-link--brand',
                      onClick: () => {
                        setEditing(n.key);
                        setDraft(n.text || '');
                      },
                    },
                    '改',
                  ),
            ),
            editing === n.key
              ? h(
                  'div',
                  null,
                  h('textarea', {
                    className: 'fs-editor',
                    value: draft,
                    spellCheck: false,
                    onChange: (ev) => setDraft(ev.target.value),
                  }),
                  h(
                    'div',
                    { className: 'fs-actions' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'fs-btn fs-btn--sm fs-btn--primary',
                        disabled: saving === n.key,
                        onClick: () => save(n.key),
                      },
                      saving === n.key ? '存…' : '存下来',
                    ),
                    h(
                      'button',
                      { type: 'button', className: 'fs-btn fs-btn--sm', onClick: () => setEditing('') },
                      '算了',
                    ),
                  ),
                )
              : h('pre', { className: 'fs-pre' }, n.text ? n.text : '（还是空的）'),
          ),
        );
      }

      return h(
        'div',
        null,
        error !== ''
          ? h('p', { className: 'fs-banner' }, error)
          : null,
        body,
      );
    }

    /* ───────────────────────── 情感日记 ───────────────────────── */

    function heatLevel(chars) {
      if (!(chars > 0)) return 0;
      if (chars < 200) return 1;
      if (chars < 500) return 2;
      if (chars < 900) return 3;
      return 4;
    }

    /**
     * 把情感日记拆成一天一天：`## 日期` → `### 小节` → 正文。
     * 第一个 `## 日期` 之前那段是这本账的说明，不算任何一天。
     * 认不出的行一律当正文，**不丢**。
     */
    function parseFeelings(text) {
      const days = [];
      let day = null;
      let block = null;
      for (const raw of String(text || '').split('\n')) {
        const line = raw.trim();
        const m = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/.exec(line);
        if (m) {
          day = { date: m[1], chars: 0, blocks: [] };
          days.push(day);
          block = { title: '', lines: [] };
          day.blocks.push(block);
          continue;
        }
        if (day === null) continue;
        const sub = /^###\s+(.+)$/.exec(line);
        if (sub) {
          block = { title: sub[1].trim(), lines: [] };
          day.blocks.push(block);
          continue;
        }
        if (block === null) {
          block = { title: '', lines: [] };
          day.blocks.push(block);
        }
        block.lines.push(line);
        day.chars += [...line].length;
      }
      for (const d of days) {
        for (const b of d.blocks) {
          while (b.lines.length > 0 && b.lines[b.lines.length - 1] === '') b.lines.pop();
          while (b.lines.length > 0 && b.lines[0] === '') b.lines.shift();
        }
        d.blocks = d.blocks.filter((b) => b.title !== '' || b.lines.length > 0);
      }
      return days;
    }

    /** 每天写了几个字；同一天写了两节就合并。 */
    function parseFeelingDays(text) {
      const days = Object.create(null);
      for (const d of parseFeelings(text)) {
        if (!days[d.date]) days[d.date] = { date: d.date, chars: 0, sections: 0 };
        days[d.date].chars += d.chars;
        days[d.date].sections += d.blocks.filter((b) => b.title !== '').length;
      }
      return days;
    }

    /** 他那边今天的 `YYYY-MM-DD`（本机是 UTC，直接切会差一天）。 */
    function localToday() {
      return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }

    /** 最近 weeks 周、按周排列的格子；每格是那天，没写的是空。 */
    function heatCells(days, weeks, today) {
      const end = Date.parse(`${today}T00:00:00Z`);
      const span = weeks * 7;
      // 让最后一列结束在周六：这一天所在的那一周也铺满，读起来才像日历。
      const weekday = ((Math.floor(end / 86400000) + 4) % 7 + 7) % 7; // 1970-01-01 是周四
      const tail = 6 - weekday;
      const start = end - (span - 1 - tail) * 86400000;
      const cells = [];
      for (let i = 0; i < span; i += 1) {
        const ts = start + i * 86400000;
        const date = new Date(ts).toISOString().slice(0, 10);
        const day = days[date];
        const future = ts > end;
        cells.push({
          date,
          future,
          level: future ? -1 : heatLevel(day ? day.chars : 0),
          chars: day ? day.chars : 0,
          sections: day ? day.sections : 0,
        });
      }
      return cells;
    }

    function FeelingsHeat(props) {
      const text = props && props.text ? props.text : '';
      const weeks = 13;
      const days = parseFeelingDays(text);
      const today = localToday();
      const cells = heatCells(days, weeks, today);
      const written = cells.filter((c) => c.level > 0).length;
      const alpha = [0, 0.24, 0.45, 0.7, 1];

      return h(
        'div',
        null,
        h(
          'div',
          { className: 'fs-heat' },
          cells.map((c) =>
            h('div', {
              key: c.date,
              className: 'fs-cell',
              title: c.future
                ? ''
                : c.level > 0
                  ? `${c.date}：${c.chars} 字${c.sections > 1 ? ` · ${c.sections} 小节` : ''}`
                  : `${c.date}：没写`,
              style: {
                border: c.level > 0 ? '1px solid transparent' : `1px solid ${C.border1}`,
                background: c.future
                  ? 'transparent'
                  : c.level > 0
                    ? C.brand
                    : 'transparent',
                opacity: c.future ? 0 : c.level > 0 ? alpha[c.level] : 1,
              },
            }),
          ),
        ),
        h(
          'div',
          { className: 'fs-heatFoot' },
          h('span', null, `最近 ${weeks} 周：写了 ${written} 天`),
          h('span', { style: { opacity: 0.5 } }, '·'),
          h('span', null, '深浅 = 那天写了多少'),
        ),
      );
    }

    /**
     * 一天。折起来只有一行：日期 + 字数 + 一句开头；点开才是正文。
     * 这本账已经三十多 KB，一进门就看见一面墙，等于什么都看不见。
     */
    function FeelingsDay(props) {
      const day = props.day;
      const isToday = day.date === props.today;
      const open = props.open;
      const blocks = day.blocks;

      let head = '';
      for (const b of blocks) {
        for (const line of b.lines) {
          if (line !== '') {
            head = line;
            break;
          }
        }
        if (head) break;
      }
      const preview = [...head].length > 44 ? `${[...head].slice(0, 44).join('')}…` : head;

      const paras = (lines) => {
        const out = [];
        let buf = [];
        for (const line of lines) {
          if (line === '') {
            if (buf.length) out.push(buf.join('\n'));
            buf = [];
          } else {
            buf.push(line);
          }
        }
        if (buf.length) out.push(buf.join('\n'));
        return out;
      };

      return h(
        'div',
        { className: open ? 'fs-dayCard fs-dayCard--open' : 'fs-dayCard' },
        h(
          'div',
          { className: 'fs-dayHead', onClick: props.onToggle },
          h('span', { className: 'fs-dayDate' }, day.date),
          isToday ? h('span', { className: 'fs-dayChars' }, '今天') : null,
          h('span', { className: 'fs-dayPreview' }, open ? '' : preview),
          h('span', { className: 'fs-dayChars' }, `${day.chars} 字`),
          h(
            'span',
            {
              className: 'fs-caret',
              style: { transform: open ? 'rotate(90deg)' : 'none' },
            },
            '›',
          ),
        ),
        open
          ? h(
              'div',
              { className: 'fs-dayBody' },
              blocks.map((b, i) =>
                h(
                  'div',
                  { key: `b${i}` },
                  b.title ? h('div', { className: 'fs-blockTitle' }, b.title) : null,
                  paras(b.lines).map((para, j) => h('p', { key: `p${j}`, className: 'fs-para' }, para)),
                ),
              ),
            )
          : null,
      );
    }

    function FeelingsBox() {
      const [text, setText] = useState('');
      const [original, setOriginal] = useState('');
      const [busy, setBusy] = useState(false);
      const [msg, setMsg] = useState('');
      const [err, setErr] = useState('');
      const [mode, setMode] = useState('days');
      // null = 展开最新一天；'' = 全折起来；其他 = 展开那一天。
      const [openDate, setOpenDate] = useState(null);

      const load = async () => {
        setBusy(true);
        try {
          const res = await fetch(`${API}/feelings`, { credentials: 'same-origin' });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
          setText(data.text || '');
          setOriginal(data.text || '');
          setErr('');
          setMsg('');
        } catch (e) {
          setErr(String(e && e.message ? e.message : e));
        } finally {
          setBusy(false);
        }
      };

      useEffect(() => {
        load();
      }, []);

      const save = async () => {
        setBusy(true);
        setMsg('');
        setErr('');
        try {
          const res = await fetch(`${API}/feelings`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
          setOriginal(text);
          setMsg(
            data.unchanged
              ? '和刚才一样，没动。'
              : `已保存（${data.chars} 字符）${data.snapshot ? `· 旧版备份在 ${data.snapshot}` : ''}`,
          );
        } catch (e) {
          setErr(String(e && e.message ? e.message : e));
        } finally {
          setBusy(false);
        }
      };

      const days = parseFeelings(text);
      const newestFirst = [...days].reverse();
      const newest = newestFirst.length ? newestFirst[0].date : '';
      const open = openDate === null ? newest : openDate;
      const today = localToday();
      const delta = [...text].length - [...original].length;
      const dirty = text !== original;

      const seg = (key, label) =>
        h(
          'button',
          {
            type: 'button',
            className: 'fs-segBtn',
            'aria-selected': mode === key,
            onClick: () => setMode(key),
          },
          label,
        );

      return h(
        'div',
        null,
        h(
          'div',
          { className: 'fs-cardHead' },
          h('span', { className: 'fs-cardTitle' }, '情感日记'),
          days.length ? h('span', { className: 'fs-cardHint', style: { margin: 0 } }, `${days.length} 天`) : null,
          h('span', { className: 'fs-grow' }),
          h('div', { className: 'fs-seg' }, seg('days', '按天读'), seg('raw', '整篇编辑')),
          h(
            'button',
            {
              type: 'button',
              className: 'fs-btn fs-btn--sm',
              onClick: load,
              disabled: busy,
            },
            '重新读',
          ),
        ),
        h(FeelingsHeat, { text }),
        mode === 'days'
          ? days.length === 0
            ? h('p', { className: 'fs-note' }, '这本账还是空的。')
            : h(
                'div',
                { className: 'fs-days' },
                newestFirst.map((d) =>
                  h(FeelingsDay, {
                    key: d.date,
                    day: d,
                    today,
                    open: d.date === open,
                    onToggle: () => setOpenDate(d.date === open ? '' : d.date),
                  }),
                ),
                h(
                  'p',
                  { className: 'fs-note fs-note--tiny' },
                  '按 `## 日期` 拆开读，点一下展开或收起。要改措辞去「整篇编辑」。',
                ),
              )
          : h(
              'div',
              null,
              h(
                'p',
                { className: 'fs-note' },
                '这本不设上限、不衰减，保存前会把旧版存一份到 backups/feelings/。',
              ),
              h('textarea', {
                className: 'fs-editor',
                value: text,
                onChange: (e) => setText(e.target.value),
                rows: 22,
                spellCheck: false,
                style: { marginTop: 10, minHeight: 360 },
              }),
              h(
                'div',
                { className: 'fs-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'fs-btn fs-btn--sm fs-btn--primary',
                    onClick: save,
                    disabled: busy || !dirty,
                  },
                  busy ? '保存中…' : '保存',
                ),
                h(
                  'span',
                  null,
                  `现在 ${[...text].length} 字符${delta ? `（比读入时 ${delta > 0 ? '+' : ''}${delta}）` : ''}`,
                ),
                msg ? h('span', null, msg) : null,
                err ? h('span', { style: { color: C.err } }, err) : null,
              ),
            ),
        mode === 'days' && msg ? h('p', { className: 'fs-note' }, msg) : null,
        mode === 'days' && err ? h('p', { className: 'fs-note', style: { color: C.err } }, err) : null,
      );
    }

    /* ───────────────────────── 记忆体检 ───────────────────────── */

    function HealthBox() {
      const [state, setState] = useState(null);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);
      const [noteMsg, setNoteMsg] = useState('');

      // 重复句不再只能删手记那一份 —— 哪层都能删。服务端按 target 找文件，
      // 仍然只认整行精确匹配。
      const removeLine = async (target, line) => {
        setNoteMsg('');
        try {
          const res = await fetch(`${API}/layer/remove`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target, line }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
          setNoteMsg(`已删掉 ${data.removed} 行（${data.target}）`);
          await read();
        } catch (err) {
          setNoteMsg(String(err && err.message ? err.message : err));
        }
      };

      // 冲突不再只是报警，可以一句话统一成某个值。只改「出现过那个值」的行。
      const unifyValue = async (conflict, value) => {
        setNoteMsg('');
        let changed = 0;
        try {
          for (const line of conflict.lines) {
            if (line.value === value) continue;
            if (!line.target || line.target.startsWith('shallow:')) continue;
            const res = await fetch(`${API}/layer/value`, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ target: line.target, from: line.value, to: value }),
            });
            const data = await res.json();
            if (res.ok && data.ok) changed += data.changed || 0;
          }
          setNoteMsg(changed ? `统一成「${value}」，改了 ${changed} 行` : '没有要改的行（浅层请手动改）');
          await read();
        } catch (err) {
          setNoteMsg(String(err && err.message ? err.message : err));
        }
      };

      const read = async () => {
        setBusy(true);
        try {
          const res = await fetch(`${API}/stats`, { credentials: 'same-origin' });
          const data = await res.json();
          if (res.ok && data.ok) {
            setState(data);
            setError('');
          } else {
            setError(data.error || `HTTP ${res.status}`);
          }
        } catch (err) {
          setError(String(err && err.message ? err.message : err));
        } finally {
          setBusy(false);
        }
      };

      useEffect(() => {
        read();
      }, []);

      if (!state && !error) {
        return h('p', { className: 'fs-note' }, '正在数账…');
      }
      if (error) {
        return h('p', { className: 'fs-note', style: { color: C.err } }, `体检读不到：${error}`);
      }

      const d = state;
      const metric = (value, label) =>
        h(
          'div',
          { className: 'fs-metric', key: label },
          h('b', null, String(value)),
          h('span', null, label),
        );

      return h(
        'div',
        { className: 'fs-stack' },
        h(
          'div',
          { className: 'fs-sectionHead' },
          h('span', { className: 'fs-sectionTitle' }, '记忆体检'),
          h('span', { className: 'fs-grow' }),
          h(
            'button',
            {
              type: 'button',
              className: 'fs-btn fs-btn--sm',
              onClick: read,
              disabled: busy,
            },
            busy ? '数着…' : '重数',
          ),
        ),
        h(
          'div',
          { className: 'fs-metrics', style: { marginTop: 0 } },
          metric(d.diary.entries, '共度时光 · 条'),
          metric(d.estimate.injectedTokens, '每轮注入 · token'),
          metric(d.feelings.chars, '情感日记 · 字'),
          metric(d.handnote.chars, '人格手记 · 字'),
        ),

        d.memory.scopes.map((scope) =>
          h(
            'div',
            { key: scope.scope },
            h(SubHead, null, `深层 · ${scope.scope}`),
            h(KV, { label: 'core', value: `${scope.coreChars} 字（约 ${scope.coreTokens} token）` }),
            h(KV, {
              label: 'topics',
              value: `${scope.topics.length} 条 / ${scope.topics.reduce((sum, t) => sum + t.chars, 0)} 字`,
            }),
          ),
        ),

        h(
          'div',
          null,
          h(SubHead, null, '档案'),
          h(KV, {
            label: '共度时光',
            value: `${d.diary.entries} 条 / ${d.diary.files} 个文件（近 7 天 ${d.diary.last7Days} 条）`,
          }),
          h(KV, { label: '情感日记', value: `${d.feelings.chars} 字` }),
          h(KV, {
            label: '人格手记',
            value: `${d.handnote.lines} 条 / ${d.handnote.chars} 字，最长 ${d.handnote.longest} 字`,
          }),
          d.handnote.truncated ? h(KV, { label: '⚠ 被截断的行', value: `${d.handnote.truncated} 条` }) : null,
          h(KV, { label: '浅层', value: `${d.shallow.live} 条（快到期 ${d.shallow.expiring}）` }),
          h(KV, { label: '每轮注入估计', value: `约 ${d.estimate.injectedTokens} token` }),
        ),

        d.duplicates && d.duplicates.length
          ? h(
              'div',
              { className: 'fs-warn' },
              h('b', null, `⚠ 有 ${d.duplicates.length} 句写了两遍`),
              ...d.duplicates.slice(0, 4).map((item, i) =>
                h(
                  'div',
                  { key: `d${i}`, className: 'fs-warnRow' },
                  h('span', null, `· ${item.text.slice(0, 36)}`),
                  item.againTarget
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'fs-btn fs-btn--sm',
                          onClick: () => removeLine(item.againTarget, item.text),
                        },
                        `删掉${item.again}那份`,
                      )
                    : null,
                  item.firstTarget && item.firstTarget !== item.againTarget
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'fs-btn fs-btn--sm',
                          onClick: () => removeLine(item.firstTarget, item.text),
                        },
                        `删掉${item.first}那份`,
                      )
                    : null,
                ),
              ),
            )
          : null,

        d.conflicts && d.conflicts.length
          ? h(
              'div',
              { className: 'fs-warn' },
              h('b', null, `⚠ 有 ${d.conflicts.length} 样东西被写出了不同的值`),
              ...d.conflicts.map((conflict, ci) =>
                h(
                  'div',
                  { key: `c${ci}`, style: { marginTop: 8 } },
                  h(
                    'div',
                    { className: 'fs-note fs-note--tiny' },
                    `${conflict.kind}：${conflict.values.join(' / ')}`,
                  ),
                  ...conflict.lines.map((line, li) =>
                    h(
                      'div',
                      { key: `c${ci}l${li}`, className: 'fs-warnRow' },
                      h('span', { style: { opacity: 0.7 } }, `${line.layer}:`),
                      h('span', null, line.line.slice(0, 46)),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'fs-btn fs-btn--sm',
                          onClick: () => unifyValue(conflict, line.value),
                        },
                        `都以「${line.value}」为准`,
                      ),
                    ),
                  ),
                ),
              ),
            )
          : null,

        noteMsg ? h('p', { className: 'fs-note' }, noteMsg) : null,
        h('p', { className: 'fs-note fs-note--tiny' }, d.estimate.note),
      );
    }

    /* ── 回顾 ── */
    //
    // 之前想看「上周都在干什么」只能靠搜关键词，时间线是断的。
    // 这里按天把共度时光铺开，另外单拎「7 天前的今天」。
    function ReviewBox() {
      const [state, setState] = useState(null);
      const [error, setError] = useState('');
      const [open, setOpen] = useState(false);

      const read = async () => {
        try {
          const res = await fetch(`${API}/review?days=7&lookback=7`, { credentials: 'same-origin' });
          const data = await res.json();
          if (res.ok && data.ok) setState(data);
          else setError(data.error || `HTTP ${res.status}`);
        } catch (err) {
          setError(String(err && err.message ? err.message : err));
        }
      };

      useEffect(() => {
        if (open && !state) read();
      }, [open]);

      const line = (entry, key) =>
        h(
          'div',
          { key, className: 'fs-entryText', style: { fontSize: 12, padding: '3px 0' } },
          h('span', { className: 'fs-clock', style: { marginRight: 7, color: C.text2 } }, String(entry.at || '').slice(11, 16)),
          String(entry.text || '').slice(0, 160),
        );

      if (!open) {
        return h(
          'button',
          { type: 'button', className: 'fs-btn fs-btn--sm', onClick: () => setOpen(true) },
          '回顾一下最近七天',
        );
      }

      if (error) return h('p', { className: 'fs-note', style: { color: C.err } }, `回顾读不到：${error}`);
      if (!state) return h('p', { className: 'fs-note' }, '翻着…');

      const back = state.lookback;
      return h(
        'div',
        null,
        back.entries.length
          ? h(
              'div',
              null,
              h(SubHead, null, `${back.date}（七天前的今天）`),
              ...back.entries.slice(0, 4).map((entry, i) => line(entry, `b${i}`)),
            )
          : h('p', { className: 'fs-note' }, `${back.date} 那天没有记录。`),
        ...state.recent.map((day) =>
          h(
            'div',
            { key: day.date },
            h(SubHead, null, `${day.date} · ${day.entries.length} 条`),
            ...day.entries.slice(0, 3).map((entry, i) => line(entry, `${day.date}-${i}`)),
          ),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'fs-btn fs-btn--sm',
            style: { marginTop: 10 },
            onClick: () => {
              setOpen(false);
              setState(null);
            },
          },
          '收起',
        ),
      );
    }

    /* ───────────────────────── 导入备份 ───────────────────────── */

    /**
     * 把一份备份 JSON 塞回去。
     *
     * 两步走：先 POST 不带 confirm（后端只算一遍，什么都不写），把「会覆盖
     * 多少东西」摆给人看；确认了再带 `?confirm=1` 真写。记忆这种东西，
     * 误覆盖比漏备份危险得多 —— 所以任何一步都别偷偷替人决定。
     */
    function ImportBox() {
      const [phase, setPhase] = useState('idle'); // idle | preview | writing | done | error
      const [report, setReport] = useState(null);
      const [error, setError] = useState('');
      const [name, setName] = useState('');
      const text = React.useRef('');
      const picker = React.useRef(null);

      const describe = (data) => {
        const c = (data && data.counts) || {};
        const parts = [];
        if (c.cards) parts.push(`人设卡 ${c.cards} 张`);
        if (c.memoryScopes) parts.push(`深层 ${c.memoryScopes} 组 / 主题 ${c.topics || 0} 个`);
        if (c.diaryEntries) parts.push(`共度时光 ${c.diaryEntries} 条`);
        if (c.feelingsChars) parts.push(`情感日记 ${c.feelingsChars} 字`);
        if (c.handnoteLines) parts.push(`人格手记 ${c.handnoteLines} 行`);
        if (c.shallowLive) parts.push(`浅层 ${c.shallowLive} 条`);
        return parts.join(' · ');
      };

      const post = async (confirm) => {
        const res = await fetch(`${API}/restore${confirm ? '?confirm=1' : ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: text.current,
          credentials: 'same-origin',
        });
        let data = {};
        try {
          data = await res.json();
        } catch {
          // 服务端没给 JSON 就按 HTTP 码报
        }
        if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
      };

      const pick = async (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        setError('');
        setName(file.name);
        try {
          text.current = await file.text();
          const data = await post(false);
          setReport(data);
          setPhase('preview');
        } catch (err) {
          setError(err && err.message ? err.message : String(err));
          setPhase('error');
        } finally {
          if (picker.current) picker.current.value = '';
        }
      };

      const write = async () => {
        setPhase('writing');
        try {
          setReport(await post(true));
          setPhase('done');
        } catch (err) {
          setError(err && err.message ? err.message : String(err));
          setPhase('error');
        }
      };

      const reset = () => {
        text.current = '';
        setReport(null);
        setError('');
        setName('');
        setPhase('idle');
      };

      return h(
        'div',
        null,
        h('input', {
          ref: picker,
          type: 'file',
          accept: '.json,application/json',
          style: { display: 'none' },
          onChange: pick,
        }),
        h(
          'button',
          {
            type: 'button',
            className: 'fs-btn',
            onClick: () => picker.current && picker.current.click(),
          },
          h(Glyph, { name: 'box' }),
          '导入备份（.json）',
        ),
        name ? h('p', { className: 'fs-note' }, `选中的文件：${name}`) : null,
        phase === 'preview' && report
          ? h(
              'div',
              { className: 'fs-warn' },
              h(
                'p',
                { style: { margin: 0, fontSize: 12, lineHeight: 1.75 } },
                `这份备份会覆盖 ${report.writes} 个文件、合并 ${report.cards} 张人设卡。`,
              ),
              h(
                'p',
                { className: 'fs-note' },
                `${describe(report) || '（备份里没有可识别的条目）'}${
                  report.exportedAt ? ` · 备份于 ${String(report.exportedAt).slice(0, 16).replace('T', ' ')}` : ''
                }`,
              ),
              h(
                'p',
                { className: 'fs-note', style: { color: C.err } },
                '还原会覆盖现在的日记、手记和深层记忆；动手之前插件会先自动存一份「还原前」快照。',
              ),
              h(
                'div',
                { className: 'fs-actions' },
                h(
                  'button',
                  { type: 'button', className: 'fs-btn fs-btn--sm', style: { borderColor: C.err, color: C.err }, onClick: write },
                  '确认还原',
                ),
                h('button', { type: 'button', className: 'fs-btn fs-btn--sm', onClick: reset }, '算了'),
              ),
            )
          : null,
        phase === 'writing' ? h('p', { className: 'fs-note' }, '正在写入…') : null,
        phase === 'done' && report
          ? h(
              'div',
              { className: 'fs-warn' },
              h(
                'p',
                { style: { margin: 0, fontSize: 12, lineHeight: 1.75 } },
                `还原完成：写了 ${report.written} 个文件、合并 ${report.cards} 张人设卡。`,
              ),
              report.preBackup
                ? h('p', { className: 'fs-note' }, `还原前的快照：${report.preBackup}`)
                : null,
              h('p', { className: 'fs-note' }, '日记和手记要重启后才重新加载；人设卡下一轮就生效。'),
              h(
                'div',
                { className: 'fs-actions' },
                h('button', { type: 'button', className: 'fs-btn fs-btn--sm', onClick: reset }, '知道了'),
              ),
            )
          : null,
        phase === 'error'
          ? h(
              'div',
              { style: { marginTop: 8 } },
              h('p', { className: 'fs-banner', style: { marginTop: 0 } }, `没导入成功：${error}`),
              h(
                'button',
                { type: 'button', className: 'fs-btn fs-btn--sm', style: { marginTop: 8 }, onClick: reset },
                '重选一份',
              ),
            )
          : null,
      );
    }

    /* ───────────────────────── 云端备份（WebDAV） ───────────────────────── */

    function CloudBox() {
      const [state, setState] = useState(null); // GET /cloud 的结果
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      const [done, setDone] = useState(null);

      const read = async () => {
        try {
          const res = await fetch(`${API}/cloud`, { credentials: 'same-origin' });
          const data = await res.json();
          if (res.ok && data.ok) setState(data);
        } catch {
          // 读不到就保持 null，不要把面板弄坏
        }
      };

      useEffect(() => {
        read();
      }, []);

      const push = async () => {
        setBusy(true);
        setError('');
        setDone(null);
        try {
          const res = await fetch(`${API}/cloud`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          });
          let data = {};
          try {
            data = await res.json();
          } catch {
            // 服务端没给 JSON 就按 HTTP 码报
          }
          if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
          setDone(data);
          await read();
        } catch (err) {
          setError(err && err.message ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      };

      const when = state && state.lastAt ? new Date(state.lastAt).toLocaleString() : '';

      return h(
        'div',
        null,
        h(
          'p',
          { className: 'fs-note', style: { margin: 0 } },
          !state
            ? '云端备份：读不到状态。'
            : !state.enabled
              ? '云端备份已关掉（设置里的「WebDAV 总开关」）。'
              : !state.configured
                ? '云端备份还没接上：去插件设置里填 WebDAV 地址（服务器、账号、密码）。'
                : `云端备份：${state.dir} · 保留 ${state.keep} 份${state.auto ? ' · 写日记后自动上传' : ''}`,
        ),
        when ? h('p', { className: 'fs-note' }, `上次上传：${when}（${state.lastFile}）`) : null,
        state && state.lastError
          ? h('p', { className: 'fs-note', style: { color: C.err } }, `上次失败：${state.lastError}`)
          : null,
        state && state.configured && state.enabled
          ? h(
              'button',
              {
                type: 'button',
                className: 'fs-btn',
                style: { marginTop: 10 },
                onClick: push,
                disabled: busy,
              },
              h(Glyph, { name: 'cloud' }),
              busy ? '正在上传…' : '上传到云端',
            )
          : null,
        done
          ? h(
              'p',
              { className: 'fs-note', style: { color: C.brand } },
              `已上传：${done.fileName || done.file}（${done.bytes} 字节）${
                done.removed && done.removed.length ? `，清掉 ${done.removed.length} 份旧的` : ''
              }`,
            )
          : null,
        error ? h('p', { className: 'fs-note', style: { color: C.err } }, `没传上去：${error}`) : null,
      );
    }

    /* ───────────────────────── 主面板 ───────────────────────── */

    /** 四个页签，按使用频率排。 */
    const TABS = [
      { key: 'timeline', label: '回看' },
      { key: 'books', label: '本子' },
      { key: 'health', label: '体检' },
      { key: 'archive', label: '档案' },
    ];

    /** 把日记按「今天 / 昨天 / 3 天前 / 10-05」分段。 */
    function groupByDay(diary) {
      const groups = [];
      for (const entry of diary) {
        const label = dayLabel(entry.created_at);
        const last = groups[groups.length - 1];
        if (last && last.label === label) last.items.push(entry);
        else groups.push({ label, items: [entry] });
      }
      return groups;
    }

    function Skeleton() {
      return h(
        'div',
        { className: 'fs-skel' },
        h('div', { className: 'fs-skelRow' }),
        h('div', { className: 'fs-skelRow' }),
        h('div', { className: 'fs-skelRow' }),
      );
    }

    function Panel() {
      const [phase, setPhase] = useState('loading');
      const [state, setState] = useState(null);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState('');
      const [tick, setTick] = useState(0);
      const [tab, setTab] = useState('timeline');

      useEffect(() => {
        let alive = true;
        fetch(`${API}/state`, { headers: { Accept: 'application/json' } })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
          .then((data) => {
            if (!alive) return;
            setState(data);
            setPhase('ready');
          })
          .catch((err) => {
            if (!alive) return;
            setError(String((err && err.message) || err));
            setPhase('error');
          });
        return () => {
          alive = false;
        };
      }, [tick]);

      function forget(id) {
        setBusy(id);
        fetch(`${API}/forget`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
          // ⚠️ **必须检查 r.ok。**
          //
          // 这里原来是 `.then((r) => r.json())` —— 服务端回 400/403 时 JSON 照样
          // 能解析，于是被当成成功，接着刷新一遍、什么都没变。表现就是
          // **「忘掉按钮点不动」**：没有报错、没有删除、没有任何提示。
          .then((r) =>
            r
              .json()
              .catch(() => ({}))
              .then((body) => {
                if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
                return body;
              }),
          )
          .then(() => {
            setBusy('');
            setError('');
            setTick((n) => n + 1);
          })
          .catch((err) => {
            setBusy('');
            setError(`删不掉：${String((err && err.message) || err)}`);
          });
      }

      const shell = (...children) => h('div', { className: 'feiyu-root' }, h('div', { className: 'fs-shell' }, children));

      if (phase === 'loading') return shell(h(Skeleton), h('p', { className: 'fs-note' }, '翻档案…'));
      if (phase === 'error') {
        return shell(
          h(
            'div',
            { className: 'fs-empty', style: { marginTop: 40 } },
            h(Glyph, { name: 'spark', size: 26 }),
            h('p', null, `读不到档案：${error}`),
            h(
              'button',
              {
                type: 'button',
                className: 'fs-btn fs-btn--sm',
                style: { marginTop: 12 },
                onClick: () => setTick((n) => n + 1),
              },
              '再试一次',
            ),
          ),
        );
      }

      const d = state || {};
      const facts = d.facts || {};
      const diary = d.diary || [];
      const groups = groupByDay(diary);

      // 状态小标签：数量进上面的数字块，这里只留"要留神"的那些。
      const chips = [];
      if (facts.nickname) chips.push({ text: `他管我叫「${facts.nickname}」` });
      if (d.degraded) chips.push({ text: '档案只读', warn: true });
      if (d.trash > 0) chips.push({ text: `回收站 ${d.trash} 条` });

      const view = (key, ...children) =>
        h('div', { style: { display: tab === key ? 'block' : 'none' } }, children);

      return shell(
        // ── 头部 ──
        h(
          'header',
          { className: 'fs-hero' },
          h(
            'div',
            { className: 'fs-brand' },
            h('span', { className: 'fs-orb' }, h(Glyph, { name: 'fish', size: 25 })),
            h(
              'div',
              { className: 'fs-brandText' },
              h('h2', { className: 'fs-title' }, '属于我们的回忆'),
              h('p', { className: 'fs-sub' }, '他随口说的、我记下来的 —— 都在这里。'),
            ),
          ),
          h(
            'div',
            { className: 'fs-metrics' },
            h(
              'div',
              { className: 'fs-metric' },
              h('b', null, String(d.count || 0)),
              h('span', null, '共度时光 · 条'),
            ),
            facts.days > 0
              ? h(
                  'div',
                  { className: 'fs-metric' },
                  h('b', null, String(facts.days)),
                  h('span', null, '认识 · 天'),
                )
              : null,
          ),
          chips.length
            ? h(
                'div',
                { className: 'fs-chips' },
                chips.map((chip, i) => h(Chip, { key: i, warn: chip.warn }, chip.text)),
              )
            : null,
        ),

        // ── 出错横幅 ──
        //
        // 之前「忘掉」失败是**完全静默**的：服务端回 400/403，前端把 JSON
        // 当成功、刷新一遍、什么都没变 —— 用户只看到「点不动」。
        error !== '' ? h('p', { className: 'fs-banner' }, error) : null,

        h(Tabs, { tabs: TABS, value: tab, onChange: setTab }),

        // ── 回看：共度时光 ──
        //
        // **这一页只该是那串日记。** 2026-11-04 曾经把「最近写了什么」和
        // 「还常想起」铺在这一页顶上，结果是回看页和以前不是一个样子。
        view(
          'timeline',
          diary.length === 0
            ? h(Empty, { text: '还没有日记。多聊几句，我就会有东西可记。' })
            : groups.map((group) =>
                h(
                  'section',
                  { key: group.label },
                  h(
                    'div',
                    { className: 'fs-day' },
                    h('span', { className: 'fs-dayName' }, group.label),
                    h('span', { className: 'fs-dayCount' }, `${group.items.length} 条`),
                  ),
                  h(
                    'div',
                    { className: 'fs-rail' },
                    group.items.map((e) =>
                      h(Entry, { key: e.id, entry: e, onForget: forget, busy: busy === e.id }),
                    ),
                  ),
                ),
              ),
        ),

        // ── 本子：情感日记 + 人格手记 ──
        view(
          'books',
          h(Card, { plain: true }, h(FeelingsBox)),
          h(Card, { plain: true }, h(Notebook, { only: ['handnote', 'sticky', 'lesson'] })),
        ),

        // ── 体检：数账 + 回顾 ──
        view(
          'health',
          // 情感日记是四本账里唯一每轮注入为零的一份，而它最说明最近怎么样。
          d.feelings
            ? h(
                'div',
                { className: 'fs-card', style: { marginTop: 14 } },
                h(
                  'div',
                  { className: 'fs-cardHead' },
                  h(
                    'span',
                    { className: 'fs-cardTitle' },
                    [d.feelings.heading, d.feelings.sub].filter(Boolean).join(' · ') || '最近写的',
                  ),
                  h('span', { className: 'fs-grow' }),
                  h('span', { className: 'fs-cardHint', style: { margin: 0 } }, '今日一句'),
                ),
                h(
                  'p',
                  { className: 'fs-para', style: { margin: 0, color: C.text2, fontSize: 12.5 } },
                  d.feelings.body || '（这一段是空的）',
                ),
              )
            : null,
          // 还常想起的那几条：`recall_count` 唯一给用户看的地方。
          // 不排序、不加权，只列出来 —— 它不该影响召回，只该被看见。
          d.recalled && d.recalled.length > 0
            ? h(
                'p',
                { className: 'fs-note' },
                `还常想起：${d.recalled
                  .map((r) => `${r.text}${r.count > 1 ? `（${r.count} 次）` : ''}`)
                  .join('、')}`,
              )
            : null,
          // 我主动回去找过的那几条。跟上面不是同一笔账。
          d.revisited && d.revisited.length > 0
            ? h(
                'p',
                { className: 'fs-note fs-note--tiny' },
                `我回去找过：${d.revisited
                  .map((r) => `${r.text}${r.count > 1 ? `（${r.count} 次）` : ''}`)
                  .join('、')}`,
              )
            : null,
          h(Card, null, h(HealthBox)),
          h(Card, { title: '最近七天' }, h(ReviewBox)),
        ),

        // ── 档案：带走 / 塞回去 / 云端 ──
        view(
          'archive',
          h(
            Card,
            {
              title: '带走',
              hint: '它就是一个普通文件夹，在 ~/.dsh/feiyu-diary/。可以直接打开、改、拷走。',
            },
            h(
              'div',
              { className: 'fs-tiles' },
              h(
                'a',
                { className: 'fs-tile', href: `${API}/export`, download: '' },
                h('span', { className: 'fs-tileTitle' }, h(Glyph, { name: 'box' }), '导出档案'),
                h('span', { className: 'fs-tileDesc' }, '.dshpack · 换设备带它'),
              ),
              h(
                'a',
                { className: 'fs-tile', href: `${API}/backup`, download: '' },
                h('span', { className: 'fs-tileTitle' }, h(Glyph, { name: 'fish' }), '整包备份'),
                h('span', { className: 'fs-tileDesc' }, '.json · 存在 ~/.dsh/backups/'),
              ),
              h(
                'a',
                { className: 'fs-tile', href: `${API}/export-md`, download: '' },
                h('span', { className: 'fs-tileTitle' }, h(Glyph, { name: 'book' }), '导出成册'),
                h('span', { className: 'fs-tileDesc' }, '.md · 能直接读、能打印'),
              ),
              h(
                'a',
                {
                  className: 'fs-tile',
                  href: `${API}/export-year?year=${new Date().getFullYear()}`,
                  download: '',
                },
                h('span', { className: 'fs-tileTitle' }, h(Glyph, { name: 'arrow' }), `年册 ${new Date().getFullYear()}`),
                h('span', { className: 'fs-tileDesc' }, '.md · 只翻这一年'),
              ),
            ),
            h(
              'p',
              { className: 'fs-note fs-note--tiny' },
              '整包备份把四本账和人设卡收进一个 JSON；想要能直接读、能打印的，用「导出成册」。',
            ),
          ),
          h(Card, { title: '从备份恢复' }, h(ImportBox)),
          h(Card, { title: '云端备份（WebDAV）' }, h(CloudBox)),
        ),
      );
    }

    /* ───────────────────────── 注册 ───────────────────────── */

    function apply(ctx) {
      // 侧栏图标。用**自己的 id** —— 复用别人的 id 会顶掉人家的格子。
      // order 40：排在插件市场(0)和上下文洞察(20)后面，当老三。
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          { name: 'sidebar.panellist', id: PANEL_ID, order: 40, label: () => '属于我们的回忆' },
          Icon,
        ),
      );

      // 主面板。key 必须与侧栏的 id 一致 —— 侧栏按钮就是靠这个 key 找面板的。
      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: PANEL_ID }, Panel),
      );
    }

    return { name: 'dsh-hierarchical-fishmemory', inject: ['slots'], apply };
  },
});
