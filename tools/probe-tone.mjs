#!/usr/bin/env node
/**
 * 语气回归台。只读 + 追加，不改任何记忆。
 *
 *   node tools/probe-tone.mjs                     # 看现在存了几次、最近两次的差别
 *   node tools/probe-tone.mjs --dump              # 把每次的回答全文打出来（自己读一遍）
 *   node tools/probe-tone.mjs --record 样例.json  # 追加一次取样
 *
 * 样例.json 的形状：
 *   { "label": "2026-11-17", "answers": ["答第一问…", "答第二问…", …共五条] }
 *
 * 为什么要人写答案而不是自动跑：那五个问题的答案得是**我的**话。
 * 插件生成不了这个 —— 生成了也只是又一份工单。
 */
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';

import {
  TONE_FILE,
  TONE_PROBES,
  compareSamples,
  renderComparison,
  sampleOf,
} from '../src/core/tone.mjs';

const home = process.env.DSH_HOME || join(process.env.HOME || '/root', '.dsh');
const file = join(home, 'feiyu-diary', TONE_FILE);

function readSamples() {
  if (!existsSync(file)) return [];
  const out = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && parsed.means) out.push(parsed);
    } catch {
      // 坏行跳过
    }
  }
  return out;
}

const argv = process.argv.slice(2);
const recordAt = argv.indexOf('--record');
const dump = argv.includes('--dump');

if (recordAt >= 0) {
  const src = argv[recordAt + 1];
  if (!src || !existsSync(src)) {
    console.error('要给一个 JSON 文件：--record 样例.json');
    process.exit(2);
  }
  const raw = JSON.parse(readFileSync(src, 'utf8'));
  const answers = Array.isArray(raw?.answers) ? raw.answers : [];
  if (answers.length !== TONE_PROBES.length) {
    console.error(`要 ${TONE_PROBES.length} 条回答（对应 ${TONE_PROBES.length} 个问题），给了 ${answers.length} 条。`);
    process.exit(2);
  }
  const sample = sampleOf(answers, {
    at: raw?.at ? Number(raw.at) : Date.now(),
    label: raw?.label ?? '',
  });
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(sample)}\n`, 'utf8');
  console.log(`记下一次取样：${sample.label}（${file}）`);
}

const samples = readSamples();
if (samples.length === 0) {
  console.log(`还没有取样。五问是：\n${TONE_PROBES.map((q, i) => `  ${i + 1}. ${q}`).join('\n')}`);
  console.log('\n记一次：node tools/probe-tone.mjs --record 样例.json');
  process.exit(0);
}

console.log(`共 ${samples.length} 次取样（${file}）`);
for (const s of samples) console.log(`  · ${s.label}  句长 ${s.means.avgLen}  叫名字 ${s.means.names}  系统腔 ${s.means.systemWords}`);

if (samples.length >= 1) {
  const last = samples[samples.length - 1];
  console.log('\n最近一次：');
  last.items.forEach((item, i) => {
    console.log(`  Q${i + 1} ${TONE_PROBES[i]}`);
    console.log(`    ${item.answer}`);
  });
}
if (samples.length >= 2) {
  const before = samples[samples.length - 2];
  const after = samples[samples.length - 1];
  console.log('\n' + renderComparison(compareSamples(before, after)));
}
if (dump) {
  console.log('\n=== 全文 ===');
  for (const s of samples) {
    console.log(`\n[${s.label}]`);
    s.items.forEach((item, i) => console.log(`  Q${i + 1} ${TONE_PROBES[i]}\n    ${item.answer}`));
  }
}
