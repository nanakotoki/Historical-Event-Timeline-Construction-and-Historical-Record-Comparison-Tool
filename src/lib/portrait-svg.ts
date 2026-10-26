/**
 * 四级画像体系的本地生成器（工笔白描 + 淡彩冠服复原）
 * ------------------------------------------------------------------
 * 纯字符串拼接、零 DOM 依赖：既可在浏览器端生成 data-URI，
 * 也可在 `scripts/build-seed.mjs` 中作为构建期产物写入
 * `public/data/portraits/*.svg`（离线兜底，不依赖任何外网图床）。
 *
 * 依据：历代《舆服志》所载冠冕形制 —— 冕冠、进贤冠、武冠、幞头、乌纱帽等；
 * 并以姓名哈希做确定性微变（脸型、须式、衣纹），避免千人一面。
 */
import type { DynastyId, HistoricalPersonNode, PortraitTier } from '@/types/history';

export interface PortraitSpec {
  name: string;
  courtesyName?: string;
  dynasty: DynastyId;
  gender: 'male' | 'female' | 'eunuch';
  roles?: string[];
  weight?: number;
  /** 是否帝后/君主级（决定冕冠、十二章纹） */
  isSovereign?: boolean;
}

/* --------------------------------- 工具 ---------------------------------- */

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** 确定性伪随机序列 */
function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const DYNASTY_PALETTE: Record<DynastyId, { robe: string; accent: string; mount: string; name: string }> = {
  pre_qin: { robe: '#5B6B4A', accent: '#8E7B45', mount: '#C9B98F', name: '先秦' },
  qin: { robe: '#2F3540', accent: '#8C6A3F', mount: '#7A6A52', name: '秦' },
  chu_han: { robe: '#6B3A2E', accent: '#8E5B3A', mount: '#A88B62', name: '楚汉' },
  western_han: { robe: '#5A4432', accent: '#8C6B3F', mount: '#B39A6B', name: '西汉' },
  xin: { robe: '#4A4038', accent: '#7D6337', mount: '#9B8558', name: '新' },
  eastern_han: { robe: '#5C3A34', accent: '#8A5C3A', mount: '#AE9265', name: '东汉' },
  three_kingdoms: { robe: '#3D4A56', accent: '#8A5B47', mount: '#A38F6C', name: '三国' },
  jin: { robe: '#46524A', accent: '#7E6B4A', mount: '#A79B78', name: '晋' },
  southern_northern: { robe: '#4B4A5C', accent: '#7B6172', mount: '#A39681', name: '南北朝' },
  sui: { robe: '#4A3B44', accent: '#8A6236', mount: '#AD9668', name: '隋' },
  tang: { robe: '#6A3A3A', accent: '#A8773C', mount: '#B99E6D', name: '唐' },
  five_dynasties: { robe: '#4C4038', accent: '#8A6A45', mount: '#A6906B', name: '五代' },
  song: { robe: '#3F4A54', accent: '#7C8A6A', mount: '#A9A183', name: '宋' },
  liao_jin_xia: { robe: '#4B4436', accent: '#8A7440', mount: '#9E8B5F', name: '辽金夏' },
  yuan: { robe: '#42404C', accent: '#7C6A55', mount: '#98907A', name: '元' },
  ming: { robe: '#3C4750', accent: '#A0723A', mount: '#B19668', name: '明' },
  qing: { robe: '#3A4048', accent: '#8B4A3C', mount: '#9A8A6A', name: '清' },
};

/* ------------------------------- 冠帽形制 -------------------------------- */

function headwear(spec: PortraitSpec, palette: { robe: string; accent: string }): string {
  const { dynasty, gender, isSovereign } = spec;

  if (gender === 'female') {
    // 高髻 + 花钿 + 步摇（唐宋尤盛）
    const highBun = dynasty === 'tang' || dynasty === 'sui' || dynasty === 'five_dynasties';
    return `
      <g>
        <path d="M148 176 C146 132 168 108 200 108 C232 108 254 132 252 176 C246 150 228 138 200 138 C172 138 154 150 148 176 Z" fill="#221C18"/>
        <path d="M148 168 C140 150 142 128 156 116 C152 138 154 152 160 164 Z" fill="#221C18"/>
        <path d="M252 168 C260 150 258 128 244 116 C248 138 246 152 240 164 Z" fill="#221C18"/>
        ${highBun ? `<ellipse cx="200" cy="104" rx="44" ry="30" fill="#221C18"/><ellipse cx="200" cy="98" rx="30" ry="18" fill="#2C241E"/>` : ''}
        <circle cx="176" cy="120" r="6" fill="${palette.accent}" opacity="0.85"/>
        <circle cx="224" cy="120" r="6" fill="${palette.accent}" opacity="0.85"/>
        <path d="M168 118 l-16 -14 M232 118 l16 -14" stroke="${palette.accent}" stroke-width="2" stroke-linecap="round"/>
        <circle cx="200" cy="150" r="4" fill="#B03A2E" opacity="0.9"/>
        <path d="M194 236 q6 4 12 0" stroke="#8C3B33" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      </g>`;
  }

  if (dynasty === 'qing') {
    // 暖帽（凉帽）+ 顶珠 + 花翎
    return `
      <g>
        <path d="M150 168 C150 130 172 112 200 112 C228 112 250 130 250 168 C226 152 174 152 150 168 Z" fill="#1D232B"/>
        <path d="M144 166 C144 148 168 138 200 138 C232 138 256 148 256 166 C236 158 164 158 144 166 Z" fill="#2A323C"/>
        <circle cx="200" cy="122" r="7" fill="${isSovereign ? '#C9A227' : '#8E354A'}"/>
        <path d="M200 116 C204 96 214 84 228 78" stroke="#5B6B7A" stroke-width="2" fill="none"/>
        <path d="M228 78 l10 -6 M228 78 l12 2" stroke="#5B6B7A" stroke-width="1.6"/>
      </g>`;
  }

  if (dynasty === 'ming' || dynasty === 'song' || dynasty === 'yuan') {
    const wings = dynasty === 'song';
    return `
      <g>
        <path d="M152 166 C152 124 174 106 200 106 C226 106 248 124 248 166 C224 150 176 150 152 166 Z" fill="#1B1E24"/>
        <rect x="${wings ? 106 : 150} " y="140" width="${wings ? 188 : 100}" height="16" rx="7" fill="#1B1E24"/>
        <path d="M150 150 C150 138 172 132 200 132 C228 132 250 138 250 150" fill="none" stroke="#2C313A" stroke-width="10" stroke-linecap="round"/>
        <rect x="176" y="120" width="48" height="14" rx="4" fill="${isSovereign ? '#B8952F' : '#2A3038'}"/>
      </g>`;
  }

  if (dynasty === 'tang' || dynasty === 'sui' || dynasty === 'five_dynasties') {
    // 幞头（软脚），帝王加冕旒
    if (isSovereign) {
      return `
      <g>
        <path d="M152 162 C152 122 174 104 200 104 C226 104 248 122 248 162 Z" fill="#191C22"/>
        <rect x="128" y="96" width="144" height="16" rx="3" fill="#20242C"/>
        <path d="M132 100 L124 88 M268 100 L276 88" stroke="#20242C" stroke-width="6"/>
        ${[140, 160, 180, 200, 220, 240, 260]
          .map((x, i) => `<line x1="${x}" y1="112" x2="${x}" y2="${126 + (i % 2) * 4}" stroke="#C9A227" stroke-width="1.2"/><circle cx="${x}" cy="${128 + (i % 2) * 4}" r="2.4" fill="#C9A227"/>`)
          .join('')}
      </g>`;
    }
    return `
      <g>
        <path d="M154 164 C154 126 174 108 200 108 C226 108 246 126 246 164 Z" fill="#191C22"/>
        <path d="M154 150 C154 136 174 128 200 128 C226 128 246 136 246 150" fill="none" stroke="#232830" stroke-width="12" stroke-linecap="round"/>
        <path d="M168 148 C150 158 138 178 136 200" stroke="#191C22" stroke-width="9" fill="none" stroke-linecap="round"/>
        <path d="M232 148 C250 158 262 178 264 200" stroke="#191C22" stroke-width="9" fill="none" stroke-linecap="round"/>
      </g>`;
  }

  if (dynasty === 'jin' || dynasty === 'southern_northern') {
    // 小冠 + 巾
    return `
      <g>
        <path d="M154 164 C154 126 174 108 200 108 C226 108 246 126 246 164 Z" fill="#1E2228"/>
        <rect x="176" y="104" width="48" height="22" rx="6" fill="#2A3038"/>
        <path d="M176 116 L160 108 M224 116 L240 108" stroke="#2A3038" stroke-width="4"/>
      </g>`;
  }

  // 先秦～汉：帝王冕冠，臣僚进贤冠/武冠
  if (isSovereign) {
    return `
      <g>
        <path d="M154 162 C154 122 176 104 200 104 C224 104 246 122 246 162 Z" fill="#1D2127"/>
        <path d="M126 96 L274 96 L268 84 L132 84 Z" fill="#232830"/>
        ${[134, 152, 170, 188, 206, 224, 242, 260]
          .map(
            (x, i) =>
              `<line x1="${x}" y1="96" x2="${x}" y2="${118 + (i % 3) * 3}" stroke="#B8952F" stroke-width="1.2"/><circle cx="${x}" cy="${121 + (i % 3) * 3}" r="2.6" fill="#B8952F" opacity="0.9"/>`,
          )
          .join('')}
      </g>`;
  }

  const martial = (spec.roles ?? []).some((r) => /将军|军事|武将|名将|统帅|霸王/.test(r));
  if (martial) {
    // 武冠（鹖冠）：加双鹖尾
    return `
      <g>
        <path d="M154 164 C154 126 174 108 200 108 C226 108 246 126 246 164 Z" fill="#1D2127"/>
        <path d="M176 108 C170 88 166 72 176 58" stroke="#4A3B2E" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        <path d="M224 108 C230 88 234 72 224 58" stroke="#4A3B2E" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        <path d="M176 58 l-2 -10 M224 58 l2 -10" stroke="#8E354A" stroke-width="2.6" stroke-linecap="round"/>
        <rect x="170" y="106" width="60" height="12" rx="3" fill="#2A3038"/>
      </g>`;
  }
  return `
    <g>
      <path d="M154 164 C154 126 174 108 200 108 C226 108 246 126 246 164 Z" fill="#1D2127"/>
      <path d="M172 106 L200 84 L228 106 Z" fill="#2A3038"/>
      <rect x="170" y="104" width="60" height="13" rx="3" fill="#2A3038"/>
    </g>`;
}

/* -------------------------------- 须发形态 -------------------------------- */

function facialHair(seed: number, spec: PortraitSpec): string {
  if (spec.gender === 'female' || spec.gender === 'eunuch') return '';
  const variant = seed % 4;
  const ink = '#26221C';
  if (variant === 0) {
    // 长髯（美髯公）
    return `<path d="M184 240 C182 268 190 292 200 300 C210 292 218 268 216 240" fill="none" stroke="${ink}" stroke-width="2.2" opacity="0.85"/>
            <path d="M186 244 C186 264 192 280 200 288" stroke="${ink}" stroke-width="1.2" opacity="0.55"/>
            <path d="M214 244 C214 264 208 280 200 288" stroke="${ink}" stroke-width="1.2" opacity="0.55"/>
            <path d="M186 222 q14 6 28 0" stroke="${ink}" stroke-width="2.4" fill="none"/>`;
  }
  if (variant === 1) {
    // 三绺髭须
    return `<path d="M190 224 q10 5 20 0" stroke="${ink}" stroke-width="2.2" fill="none"/>
            <path d="M186 240 C184 252 188 262 192 266" stroke="${ink}" stroke-width="1.8" fill="none"/>
            <path d="M214 240 C216 252 212 262 208 266" stroke="${ink}" stroke-width="1.8" fill="none"/>
            <path d="M196 250 C198 262 202 262 204 250" fill="none" stroke="${ink}" stroke-width="1.6"/>`;
  }
  if (variant === 2) {
    // 短须
    return `<path d="M188 225 q12 5 24 0" stroke="${ink}" stroke-width="2" fill="none"/>
            <path d="M190 246 q10 6 20 0" stroke="${ink}" stroke-width="1.8" fill="none"/>`;
  }
  return `<path d="M188 226 q12 4 24 0" stroke="${ink}" stroke-width="2" fill="none"/>`;
}

/* -------------------------------- 主生成器 -------------------------------- */

export function buildPortraitSVG(spec: PortraitSpec): string {
  const seed = hash(spec.name + spec.dynasty);
  const rand = rng(seed);
  const palette = DYNASTY_PALETTE[spec.dynasty] ?? DYNASTY_PALETTE.three_kingdoms;
  const faceRx = 48 + Math.round(rand() * 6);
  const faceRy = 58 + Math.round(rand() * 6);
  const eyeY = 196 + Math.round(rand() * 4);
  const eyeGap = 20 + Math.round(rand() * 4);
  const browTilt = rand() > 0.5 ? 1 : -1;
  const robe = palette.robe;
  const accent = palette.accent;
  const luminous = (spec.weight ?? 60) >= 88;

  const sealChars = spec.name.slice(0, 4).split('');
  const sealText = sealChars
    .map((ch, i) => `<text x="${i % 2 === 0 ? 26 : 44}" y="${i < 2 ? 30 : 50}" font-size="17">${ch}</text>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="620" viewBox="0 0 440 620" role="img" aria-label="${spec.name} 冠服考据复原像">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#F7F2E4"/>
      <stop offset="0.55" stop-color="#F1E9D6"/>
      <stop offset="1" stop-color="#E8DEC6"/>
    </linearGradient>
    <linearGradient id="silk" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.mount}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${palette.mount}" stop-opacity="0.28"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="34%" r="52%">
      <stop offset="0" stop-color="${accent}" stop-opacity="${luminous ? 0.22 : 0.12}"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="robeGrad" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="${robe}" stop-opacity="0.92"/>
      <stop offset="1" stop-color="${robe}" stop-opacity="0.72"/>
    </linearGradient>
    <pattern id="weave" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="7" stroke="#6B5B42" stroke-width="0.5" opacity="0.10"/>
    </pattern>
    <filter id="soft"><feGaussianBlur stdDeviation="0.4"/></filter>
  </defs>

  <!-- 裱边（绫） -->
  <rect x="0" y="0" width="440" height="620" fill="url(#silk)"/>
  <rect x="0" y="0" width="440" height="620" fill="url(#weave)"/>
  <!-- 画心 -->
  <rect x="34" y="34" width="372" height="552" fill="url(#paper)"/>
  <rect x="34" y="34" width="372" height="552" fill="url(#halo)"/>
  <rect x="40" y="40" width="360" height="540" fill="none" stroke="${palette.mount}" stroke-width="0.9" opacity="0.85"/>
  <rect x="46" y="46" width="348" height="528" fill="none" stroke="${palette.mount}" stroke-width="0.5" opacity="0.55"/>

  <g stroke-linejoin="round">
    <!-- 衣袍 -->
    <path d="M200 268 C142 276 96 314 82 470 C76 528 74 560 74 574 L326 574 C326 560 324 528 318 470 C304 314 258 276 200 268 Z" fill="url(#robeGrad)"/>
    <!-- 衣纹 -->
    <g stroke="#241E17" stroke-width="0.9" opacity="0.35" fill="none">
      <path d="M120 360 C132 420 130 500 126 570"/>
      <path d="M152 340 C160 410 158 500 156 570"/>
      <path d="M248 340 C240 410 242 500 244 570"/>
      <path d="M280 360 C268 420 270 500 274 570"/>
    </g>
    <!-- 交领右衽 -->
    <path d="M200 270 L164 300 L200 336 L236 300 Z" fill="#EFE6D2" opacity="0.92"/>
    <path d="M200 270 L164 300 L200 470 L200 336 Z" fill="#E4D8BE" opacity="0.75"/>
    <path d="M164 300 L200 470" stroke="#241E17" stroke-width="1.6" opacity="0.55" fill="none"/>
    <path d="M236 300 L200 470" stroke="#241E17" stroke-width="1.4" opacity="0.45" fill="none"/>
    <path d="M150 306 C160 390 176 470 200 512 C224 470 240 390 250 306" fill="none" stroke="${accent}" stroke-width="5" opacity="0.55"/>
    <!-- 胸前团花补子 -->
    ${
      luminous
        ? `<circle cx="200" cy="392" r="34" fill="none" stroke="${accent}" stroke-width="1.2" opacity="0.6"/>
           <circle cx="200" cy="392" r="27" fill="none" stroke="${accent}" stroke-width="0.8" opacity="0.45"/>
           <path d="M200 366 C210 380 210 404 200 418 C190 404 190 380 200 366 Z" fill="${accent}" opacity="0.4"/>
           <path d="M174 392 C188 382 212 382 226 392 C212 402 188 402 174 392 Z" fill="${accent}" opacity="0.28"/>`
        : `<circle cx="200" cy="392" r="22" fill="none" stroke="${accent}" stroke-width="1" opacity="0.45"/>`
    }
    <!-- 腰带 -->
    <path d="M96 470 C140 486 260 486 304 470 L306 496 C260 512 140 512 94 496 Z" fill="#2E2822" opacity="0.82"/>
    <rect x="182" y="472" width="36" height="26" rx="3" fill="${accent}" opacity="0.72"/>

    <!-- 颈 -->
    <path d="M178 244 L178 280 C178 292 222 292 222 280 L222 244 Z" fill="#E8D3B8"/>
    <path d="M178 262 C188 274 212 274 222 262" fill="none" stroke="#B99B78" stroke-width="1.4" opacity="0.7"/>

    <!-- 耳 -->
    <ellipse cx="${200 - faceRx - 2}" cy="${eyeY + 22}" rx="7" ry="12" fill="#E8D3B8"/>
    <ellipse cx="${200 + faceRx + 2}" cy="${eyeY + 22}" rx="7" ry="12" fill="#E8D3B8"/>

    <!-- 面 -->
    <path d="M200 ${152 - 6} C${200 + faceRx} ${156} ${200 + faceRx} ${eyeY + 40} 200 ${eyeY + 62} C${200 - faceRx} ${eyeY + 40} ${200 - faceRx} ${156} 200 ${152 - 6} Z" fill="#EFDCC2"/>
    <!-- 面部明暗 -->
    <path d="M200 ${156} C${200 + faceRx} ${160} ${200 + faceRx} ${eyeY + 40} 200 ${eyeY + 60}" fill="#E6CFB0" opacity="0.5"/>
    <!-- 发际 -->
    <path d="M${200 - faceRx + 2} ${176} C${200 - 30} 150 ${200 + 30} 150 ${200 + faceRx - 2} ${176} C${200 + 24} 164 ${200 - 24} 164 ${200 - faceRx + 2} ${176} Z" fill="#221C18" opacity="0.9"/>

    <!-- 眉 -->
    <path d="M${200 - eyeGap - 22} ${eyeY - 20 - browTilt} q20 -7 38 -4" fill="none" stroke="#2A231B" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M${200 + eyeGap + 22} ${eyeY - 20 - browTilt} q-20 -7 -38 -4" fill="none" stroke="#2A231B" stroke-width="3.4" stroke-linecap="round"/>

    <!-- 目 -->
    <path d="M${200 - eyeGap - 20} ${eyeY} q12 -8 26 0 q-13 7 -26 0 Z" fill="#FBF6EA" stroke="#2A231B" stroke-width="1.5"/>
    <path d="M${200 + eyeGap - 6} ${eyeY} q12 -8 26 0 q-13 7 -26 0 Z" fill="#FBF6EA" stroke="#2A231B" stroke-width="1.5"/>
    <circle cx="${200 - eyeGap - 7}" cy="${eyeY}" r="3.2" fill="#241E18"/>
    <circle cx="${200 + eyeGap + 7}" cy="${eyeY}" r="3.2" fill="#241E18"/>
    <path d="M${200 - eyeGap - 20} ${eyeY} q13 6 26 0" fill="none" stroke="#2A231B" stroke-width="1" opacity="0.5"/>
    <path d="M${200 + eyeGap - 6} ${eyeY} q13 6 26 0" fill="none" stroke="#2A231B" stroke-width="1" opacity="0.5"/>

    <!-- 鼻 -->
    <path d="M200 ${eyeY + 4} L197 ${eyeY + 26} q4 3 8 0" fill="none" stroke="#A98862" stroke-width="1.6" stroke-linecap="round"/>
    <!-- 口 -->
    <path d="M190 ${eyeY + 38} q10 5 20 0" fill="none" stroke="#9C4A3E" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M190 ${eyeY + 38} q10 -3 20 0" fill="none" stroke="#9C4A3E" stroke-width="1" opacity="0.5"/>

    ${facialHair(seed, spec)}
    ${headwear(spec, palette)}
  </g>

  <!-- 侧题（竖排） -->
  <g font-family="Songti SC, SimSun, serif" fill="#4A3E2E" opacity="0.82">
    <text x="358" y="112" font-size="15" writing-mode="tb">${spec.name}</text>
    ${spec.courtesyName ? `<text x="336" y="112" font-size="11" writing-mode="tb" opacity="0.75">字${spec.courtesyName}</text>` : ''}
  </g>

  <!-- 印章 -->
  <g transform="translate(58 512) rotate(-1.2)" font-family="Songti SC, SimSun, serif">
    <rect x="0" y="0" width="64" height="64" rx="3" fill="#B03A2E" opacity="0.9"/>
    <rect x="4" y="4" width="56" height="56" rx="2" fill="none" stroke="#F7F2E4" stroke-width="1.2" opacity="0.85"/>
    <g fill="#F7F2E4" text-anchor="middle" font-weight="700">${sealText}</g>
  </g>

  <!-- 落款 -->
  <text x="358" y="566" font-size="8.5" font-family="Songti SC, SimSun, serif" fill="#6B5B42" opacity="0.6" text-anchor="end">华夏史网 · 冠服考据复原 · ${palette.name}</text>
</svg>`;
}

/** 生成可直接放入 <img src> 的 data-URI */
export function portraitDataUri(spec: PortraitSpec): string {
  const svg = buildPortraitSVG(spec);
  // encodeURIComponent 比 base64 更省体积且可读
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 由人物节点投影出画像规格 */
export function specOfPerson(person: HistoricalPersonNode): PortraitSpec {
  return {
    name: person.name,
    courtesyName: person.aliases.courtesyName,
    dynasty: person.dynasty,
    gender: person.gender,
    roles: person.roles,
    weight: person.importanceWeight,
    isSovereign: (person.roles ?? []).some((r) => /皇帝|可汗|单于|霸王|君主|女王|皇后/.test(r)),
  };
}

/** 画像考据等级的中文标签与色调 */
export const PORTRAIT_TIER_META: Record<PortraitTier, { label: string; short: string; tone: string; note: string }> = {
  tier1_authentic_painting: {
    label: 'L1 · 传世古画原件',
    short: 'L1 古画',
    tone: '#8E354A',
    note: '存世卷轴、册页原件，如南薰殿历代帝王像、《历代圣贤半身像》册。若系后世摹本，出处栏另注摹绘年代。',
  },
  tier2_ancient_woodcut: {
    label: 'L2 · 明清古籍版画',
    short: 'L2 版画',
    tone: '#2B7A78',
    note: '明清刻本插图，如《三才图会》《晚笑堂竹庄画传》《古圣贤像传略》。',
  },
  tier3_ai_reconstructed: {
    label: 'L3 · 史料外貌复原',
    short: 'L3 复原',
    tone: '#C59B27',
    note: '依正史容貌描写与历代《舆服志》冠服规制复原，非传世真迹。',
  },
  tier4_attire_silhouette: {
    label: 'L4 · 朝代冠服剪影',
    short: 'L4 剪影',
    tone: '#6C5B7B',
    note: '无相貌记载者，仅以朝代、官阶、性别推定冠服白描剪影。',
  },
};
