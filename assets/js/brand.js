/* ============================================================
   brand.js — الشعار وألوان الهوية والمشهد الطبي
   ============================================================ */
(function (root) {
'use strict';
const CFG = root.SONO_CONFIG || {};

/* ---------- تطبيق ألوان الهوية على المتغيّرات ---------- */
function applyTheme() {
  const t = CFG.theme || {};
  const r = document.documentElement.style;
  if (t.primary) { r.setProperty('--petrol', t.primary); r.setProperty('--petrol-soft', tint(t.primary, .86)); }
  if (t.dark)    r.setProperty('--ink', t.dark);
  if (t.accent)  r.setProperty('--amber', t.accent);
  if (t.good)    r.setProperty('--moss', t.good);
  if (t.bad)     r.setProperty('--clay', t.bad);
}
/* يخلط اللون مع الأبيض بنسبة amount */
function tint(hex, amount) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const mix = i => Math.round(parseInt(m[i], 16) + (255 - parseInt(m[i], 16)) * amount);
  return `rgb(${mix(1)},${mix(2)},${mix(3)})`;
}

/* ---------- الشعار ----------
   kind = 'full' الشعار الكامل (نص + رمز) · 'mark' الرمز المربّع وحده  */
function logo(kind) {
  const url = kind === 'mark' ? (CFG.markUrl || CFG.logoUrl) : (CFG.logoUrl || CFG.markUrl);
  /* لو تعذّر تحميل ملف الشعار لأي سبب نرجع للشعار المرسوم بدل مربّع فاضي */
  if (url) return `<img src="${url}" alt="${esc(CFG.clinicName || '')}" class="logoimg"
    onerror="this.parentNode.innerHTML=window.SonoBrand.builtinMark()">`;
  return builtinMark();
}

/* شعار افتراضي: نبضة داخل حرف «س» مع حلقة السونار */
function builtinMark() {
  return `<svg viewBox="0 0 64 64" role="img" aria-label="شعار المركز" class="logosvg">
    <defs>
      <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="var(--petrol)"/>
        <stop offset="1" stop-color="var(--ink)"/>
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="17" fill="url(#lg1)"/>
    <g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 34h8l4-9 6 18 5-11 3 5h12" stroke-width="3.2" opacity=".97"/>
      <path d="M46 20a15 15 0 0 1 0 24" stroke-width="2.1" opacity=".5"/>
      <path d="M50 15a21 21 0 0 1 0 34" stroke-width="1.7" opacity=".28"/>
    </g>
  </svg>`;
}

/* ---------- المشهد الطبي لصفحة الهبوط ---------- */
function heroArt() {
  if (CFG.heroImage) return `<img src="${CFG.heroImage}" alt="${esc(CFG.clinicName || '')}" class="heroimg">`;
  return `<svg viewBox="0 0 520 240" role="img" aria-label="مشهد طبي" class="herosvg">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="rgba(255,255,255,.16)"/>
        <stop offset="1" stop-color="rgba(255,255,255,.04)"/>
      </linearGradient>
      <linearGradient id="pulse" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0"  stop-color="rgba(255,255,255,.25)"/>
        <stop offset=".5" stop-color="rgba(255,255,255,.95)"/>
        <stop offset="1"  stop-color="rgba(255,255,255,.25)"/>
      </linearGradient>
    </defs>

    <!-- مبنى العيادة -->
    <g opacity=".9">
      <rect x="36" y="74" width="150" height="126" rx="9" fill="url(#sky)" stroke="rgba(255,255,255,.34)"/>
      <rect x="52" y="92"  width="30" height="24" rx="4" fill="rgba(255,255,255,.20)"/>
      <rect x="94" y="92"  width="30" height="24" rx="4" fill="rgba(255,255,255,.20)"/>
      <rect x="136" y="92" width="30" height="24" rx="4" fill="rgba(255,255,255,.20)"/>
      <rect x="52" y="128" width="30" height="24" rx="4" fill="rgba(255,255,255,.20)"/>
      <rect x="94" y="128" width="30" height="24" rx="4" fill="rgba(255,255,255,.20)"/>
      <rect x="136" y="128" width="30" height="24" rx="4" fill="rgba(255,255,255,.20)"/>
      <rect x="92"  y="162" width="38" height="38" rx="5" fill="rgba(255,255,255,.26)"/>
      <!-- الصليب الطبي -->
      <g fill="#fff" opacity=".95">
        <rect x="103" y="52" width="16" height="44" rx="4"/>
        <rect x="89" y="66" width="44" height="16" rx="4"/>
      </g>
    </g>

    <!-- سماعة الطبيب -->
    <g fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3.4" stroke-linecap="round">
      <path d="M232 62v34a30 30 0 0 0 60 0V62"/>
      <path d="M226 60h12M286 60h12"/>
      <path d="M262 126v22a26 26 0 0 0 52 0v-10"/>
      <circle cx="314" cy="128" r="11" fill="rgba(255,255,255,.20)"/>
    </g>

    <!-- خط النبض -->
    <path d="M206 196h48l14-30 22 62 18-46 12 24 16-10h158"
          fill="none" stroke="url(#pulse)" stroke-width="3.6"
          stroke-linecap="round" stroke-linejoin="round"/>

    <!-- حلقات السونار -->
    <g fill="none" stroke="rgba(255,255,255,.30)" stroke-linecap="round">
      <path d="M400 74a34 34 0 0 1 0 52" stroke-width="3"/>
      <path d="M414 60a54 54 0 0 1 0 80" stroke-width="2.4" opacity=".72"/>
      <path d="M428 46a74 74 0 0 1 0 108" stroke-width="1.9" opacity=".46"/>
      <circle cx="386" cy="100" r="8" fill="rgba(255,255,255,.55)" stroke="none"/>
    </g>
  </svg>`;
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* يملأ كل عناصر الشعار في الصفحة */
function mount() {
  applyTheme();
  /* الشعار الكامل في الهبوط وكارت الدخول، والرمز وحده في شريط اللوحة */
  [['logoBig', 'full'], ['logoSm', 'full'], ['logoTop', 'mark']].forEach(([id, kind]) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = logo(kind);
  });
  const art = document.getElementById('lart');
  if (art) art.innerHTML = heroArt();
  const set = (id, v) => { const e = document.getElementById(id); if (e && v) e.textContent = v; };
  set('lTitle', CFG.clinicName); set('lTag', CFG.tagline);
  set('hName', CFG.clinicName);  set('hBranch', CFG.branchName);
  document.title = (CFG.clinicName || 'لوحة المؤشرات') + ' — لوحة المؤشرات';
}

root.SonoBrand = { mount, logo, builtinMark, heroArt, applyTheme };
})(window);
