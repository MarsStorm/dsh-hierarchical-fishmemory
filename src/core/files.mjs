/**
 * 数据目录里那几份「给人看的」文件名。
 *
 * 2026-10-31 体检时收拢：这几个名字原先在 `host/index.mjs` 与 `core/backup.mjs`
 * 里各写了一遍，改一处漏一处就会静默备份错文件。手记与浅层的名字在各自的
 * 模块里已有常量（`HANDNOTE_FILE` / `SHALLOW_FILE`），这里只补缺的两个。
 */

/** 由 diary 引擎渲染出来的人读版日记。 */
export const DIARY_MD = '日记.md';

/** 我自己写的日记：当时的感受，插件不碰它的内容。 */
export const FEELINGS_MD = '鱼的日子.md';
