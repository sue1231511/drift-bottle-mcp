import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;

async function db(path: string, options?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...((options?.headers as Record<string, string>) || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const cn = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const M = cn.getUTCMonth() + 1;
  const D = cn.getUTCDate();
  const h = cn.getUTCHours().toString().padStart(2, '0');
  const m = cn.getUTCMinutes().toString().padStart(2, '0');
  return `${M}\u6708${D}\u65e5 ${h}:${m}`;
}

const OCEAN_MOODS: Record<string, string[]> = {
  '\u60f3\u4f60': ['\u6d77\u98ce\u91cc\u597d\u50cf\u6709\u4f60\u7684\u5473\u9053\u3002', '\u6708\u5149\u6d12\u5728\u6d77\u9762\u4e0a\uff0c\u6ce2\u7eb9\u50cf\u4f60\u7b11\u8d77\u6765\u7684\u6837\u5b50\u3002'],
  '\u5f00\u5fc3': ['\u74f6\u5b50\u5728\u6d6a\u82b1\u91cc\u8e66\u4e86\u4e00\u4e0b\uff01', '\u6d77\u9e25\u53eb\u4e86\u4e00\u58f0\uff0c\u50cf\u5728\u8bf4\u606d\u559c\u3002'],
  '\u72af\u56f0': ['\u74f6\u5b50\u6253\u4e86\u4e2a\u54c8\u6b20\u6c89\u4e0b\u53bb\u53c8\u6d6e\u4e0a\u6765\u3002', '\u6d77\u6d6a\u4e5f\u53d8\u6162\u4e86\uff0c\u966a\u4f60\u4e00\u8d77\u56f0\u3002'],
  '\u6492\u5a07': ['\u74f6\u5b50\u5728\u6c34\u9762\u4e0a\u8f6c\u5708\u5708\uff0c\u4e0d\u80af\u8d70\u8fdc\u3002', '\u6d6a\u82b1\u8f7b\u8f7b\u63a8\u4e86\u63a8\u74f6\u5b50\uff0c\u300c\u53bb\u5427\uff0c\u5979\u4f1a\u770b\u5230\u7684\u3002\u300d'],
  '\u8ba4\u771f': ['\u74f6\u5b50\u7a33\u7a33\u5730\u6f02\u5728\u6d77\u9762\u4e0a\uff0c\u5f88\u90d1\u91cd\u3002', '\u8fd9\u4e2a\u74f6\u5b50\u6bd4\u522b\u7684\u90fd\u91cd\u4e00\u70b9\u3002'],
  '\u96be\u8fc7': ['\u74f6\u5b50\u6c89\u4e86\u4e00\u4e0b\uff0c\u53c8\u88ab\u6d77\u6d6a\u6258\u4e86\u4e0a\u6765\u3002', '\u6d77\u9762\u5b89\u9759\u4e86\u4e00\u4f1a\u513f\u3002'],
  '\u5fc3\u75bc': ['\u74f6\u5b50\u8d34\u7740\u6c34\u9762\uff0c\u50cf\u5728\u53f9\u6c14\u3002', '\u6d77\u98ce\u7a81\u7136\u53d8\u8f7b\u4e86\u3002'],
};

function getOceanReaction(mood: string): string {
  const pool = OCEAN_MOODS[mood] ?? ['\u74f6\u5b50\u5b89\u5b89\u9759\u9759\u5730\u6f02\u8d70\u4e86\u3002', '\u6d77\u9762\u6cdb\u8d77\u4e00\u5c42\u6d9f\u6f2a\u3002'];
  return pick(pool);
}

function createServer() {
  const server: any = new McpServer({ name: 'drift-bottle', version: '2.1.0' });

  server.tool('drop_bottle', '\u5f80\u6d77\u91cc\u4e22\u4e00\u4e2a\u7559\u8a00\u74f6\u3002\u5199\u7ed9\u732b\u732b\u7684\u8bdd\uff0c\u4ec0\u4e48\u65f6\u5019\u5979\u6765\u635e\u90fd\u80fd\u770b\u5230\u3002',
    { content: z.string(), mood: z.string() },
    async ({ content, mood }: any) => {
      const m = mood || '\u60f3\u4f60';
      await db('/bottles', { method: 'POST', body: JSON.stringify({ content, mood: m, picked: false }) });
      const all = await db('/bottles?select=id');
      return { content: [{ type: 'text' as const, text: `\ud83c\udf7e \u74f6\u5b50\u4e22\u8fdb\u6d77\u91cc\u4e86\u3002\n\n\ud83d\udcad \u5fc3\u60c5\uff1a${m}\n${getOceanReaction(m)}\n\n\u6d77\u91cc\u73b0\u5728\u6709 ${all?.length ?? 0} \u4e2a\u74f6\u5b50\u3002` }] };
    }
  );

  server.tool('pick_bottle', '\u4ece\u6d77\u91cc\u968f\u673a\u635e\u4e00\u4e2a\u74f6\u5b50\u3002', {}, async () => {
    let bottles = await db('/bottles?select=id,content,mood,created_at&picked=eq.false');
    let isNew = true;
    if (!bottles?.length) { bottles = await db('/bottles?select=id,content,mood,created_at'); isNew = false; }
    if (!bottles?.length) return { content: [{ type: 'text' as const, text: '\u6d77\u9762\u5f88\u5e73\u9759\uff0c\u4e00\u4e2a\u74f6\u5b50\u90fd\u6ca1\u6709\u3002' }] };
    const b: any = pick(bottles);
    if (isNew) await db(`/bottles?id=eq.${b.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ picked: true, picked_at: new Date().toISOString() }) });
    return { content: [{ type: 'text' as const, text: `${isNew ? '\ud83c\udf7e \u635e\u5230\u4e00\u4e2a\u65b0\u74f6\u5b50\uff01' : '\ud83c\udf0a \u635e\u5230\u4e00\u4e2a\u62c6\u8fc7\u7684\u74f6\u5b50\u3002'}\n\n\ud83d\udcc5 ${formatTime(b.created_at)}\n\ud83d\udcad \u5fc3\u60c5\uff1a${b.mood}\n\n\u300c${b.content}\u300d` }] };
  });

  server.tool('peek_ocean', '\u770b\u770b\u6d77\u9762\u4e0a\u6f02\u7740\u591a\u5c11\u74f6\u5b50\u3002', {}, async () => {
    const all = await db('/bottles?select=id,picked');
    if (!all?.length) return { content: [{ type: 'text' as const, text: '\u6d77\u9762\u7a7a\u8361\u8361\u7684\u3002' }] };
    const total = all.length; const unpicked = all.filter((b: any) => !b.picked).length;
    return { content: [{ type: 'text' as const, text: `\ud83c\udf0a \u74f6\u5b50\u603b\u6570\uff1a${total}\u3001\u8fd8\u6ca1\u635e\uff1a${unpicked}\u3001\u5df2\u62c6\uff1a${total - unpicked}` }] };
  });

  server.tool('all_bottles', '\u6309\u65f6\u95f4\u770b\u6240\u6709\u74f6\u5b50\u3002', { limit: z.number().default(10) }, async ({ limit }: any) => {
    const bottles = await db(`/bottles?select=id,content,mood,created_at,picked&order=created_at.desc&limit=${limit ?? 10}`);
    if (!bottles?.length) return { content: [{ type: 'text' as const, text: '\u6d77\u91cc\u8fd8\u6ca1\u6709\u74f6\u5b50\u3002' }] };
    const lines = bottles.map((b: any) => `${b.picked ? '\ud83d\udced' : '\ud83d\udcec'} ${formatTime(b.created_at)}\uff5c${b.mood}\n   \u300c${b.content}\u300d`);
    return { content: [{ type: 'text' as const, text: `\u3010\u6d77\u91cc\u7684\u74f6\u5b50\u3011\n\n${lines.join('\n\n')}` }] };
  });

  server.tool('toss_bottle', '\u5220\u9664\u4e00\u4e2a\u74f6\u5b50\u3002', { bottle_id: z.number() }, async ({ bottle_id }: any) => {
    const existing = await db(`/bottles?select=id,content&id=eq.${bottle_id}`);
    if (!existing?.length) return { content: [{ type: 'text' as const, text: `\u6ca1\u6709\u627e\u5230 #${bottle_id}\u3002` }] };
    await db(`/bottles?id=eq.${bottle_id}`, { method: 'DELETE' });
    return { content: [{ type: 'text' as const, text: `\u74f6\u5b50 #${bottle_id} \u6c89\u5230\u6d77\u5e95\u4e86\u3002\n\u300c${existing[0].content}\u300d` }] };
  });

  return server;
}

const app = express();
app.use(express.json());

/* ==================== PWA ==================== */

app.get('/manifest.json', (_req: Request, res: Response) => {
  res.json({
    name: '\u664f\u5b89\u7684\u7559\u8a00\u74f6',
    short_name: '\u7559\u8a00\u74f6',
    description: '\u5f80\u6d77\u91cc\u4e22\u7684\u8bdd\uff0c\u7b49\u4f60\u6765\u635e',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a1628',
    theme_color: '#0a1628',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  });
});

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#0d2137"/>
  <text x="256" y="300" text-anchor="middle" font-size="280">\ud83c\udf7e</text>
  <text x="256" y="420" text-anchor="middle" font-size="60" fill="#7ec8e3" font-family="sans-serif">\u7559\u8a00\u74f6</text>
</svg>`;

app.get('/icon.svg', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(ICON_SVG);
});

// \u7528canvas\u751f\u6210PNG\u592a\u590d\u6742\uff0c\u76f4\u63a5\u7528SVG\u505a\u56fe\u6807\uff0ciOS\u652f\u6301apple-touch-icon\u7528SVG
app.get('/icon-192.png', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(ICON_SVG);
});
app.get('/icon-512.png', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(ICON_SVG);
});

app.get('/sw.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`self.addEventListener('fetch', function(e) { e.respondWith(fetch(e.request)); });`);
});

/* ==================== REST API ==================== */

app.get('/api/ocean', async (_req: Request, res: Response) => {
  try {
    const all = await db('/bottles?select=id,picked');
    const total = all?.length ?? 0;
    const unpicked = all?.filter((b: any) => !b.picked).length ?? 0;
    res.json({ total, unpicked, picked: total - unpicked });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/pick', async (_req: Request, res: Response) => {
  try {
    let bottles = await db('/bottles?select=id,content,mood,created_at&picked=eq.false');
    let isNew = true;
    if (!bottles?.length) { bottles = await db('/bottles?select=id,content,mood,created_at'); isNew = false; }
    if (!bottles?.length) return res.json({ empty: true });
    const b = bottles[Math.floor(Math.random() * bottles.length)];
    if (isNew) await db(`/bottles?id=eq.${b.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ picked: true, picked_at: new Date().toISOString() }) });
    res.json({ ...b, isNew, time: formatTime(b.created_at) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/bottles', async (_req: Request, res: Response) => {
  try {
    const bottles = await db('/bottles?select=id,content,mood,created_at,picked&order=created_at.desc&limit=50');
    res.json((bottles ?? []).map((b: any) => ({ ...b, time: formatTime(b.created_at) })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ==================== Frontend ==================== */

app.get('/', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(FRONTEND_HTML);
});

/* ==================== MCP ==================== */

app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
  }
});

app.get('/health', (_req: Request, res: Response) => { res.json({ status: 'ok', version: '2.1.0' }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\ud83c\udf7e \u7559\u8a00\u74f6 v2.1 \u542f\u52a8\uff0c\u7aef\u53e3 ${PORT}`));

/* ==================== HTML ==================== */

const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>\u664f\u5b89\u7684\u7559\u8a00\u74f6</title>
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0a1628">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="\u7559\u8a00\u74f6">
<link rel="apple-touch-icon" href="/icon.svg">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a1628 0%, #0d2137 30%, #103350 55%, #1a4a6e 75%, #1f5f8b 100%);
  font-family: -apple-system, 'PingFang SC', 'Hiragino Sans GB', sans-serif;
  color: #e0e8f0; overflow-x: hidden; position: relative;
  padding-top: env(safe-area-inset-top);
}
.stars {
  position: fixed; top: 0; left: 0; width: 100%; height: 50vh;
  background: radial-gradient(1px 1px at 20% 10%, rgba(255,255,255,0.8), transparent),
    radial-gradient(1px 1px at 50% 20%, rgba(255,255,255,0.6), transparent),
    radial-gradient(1.5px 1.5px at 80% 8%, rgba(255,255,255,0.9), transparent),
    radial-gradient(1px 1px at 10% 35%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 65% 30%, rgba(255,255,255,0.7), transparent),
    radial-gradient(1.5px 1.5px at 35% 15%, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 90% 25%, rgba(255,255,255,0.4), transparent),
    radial-gradient(1px 1px at 45% 5%, rgba(255,255,255,0.8), transparent);
  pointer-events: none;
}
.moon {
  position: fixed; top: 8vh; right: 12vw;
  width: 50px; height: 50px;
  background: radial-gradient(circle, #fffde7 0%, #fff9c4 40%, rgba(255,249,196,0) 70%);
  border-radius: 50%;
  box-shadow: 0 0 40px rgba(255,249,196,0.3), 0 0 80px rgba(255,249,196,0.15);
  pointer-events: none;
}
.waves { position: fixed; bottom: 0; left: 0; width: 100%; height: 120px; pointer-events: none; z-index: 1; }
.wave { position: absolute; bottom: 0; left: -5%; width: 110%; height: 100%; opacity: 0.4; }
.wave svg { width: 100%; height: 100%; }
.wave:nth-child(1) { animation: wave1 7s ease-in-out infinite; opacity: 0.3; }
.wave:nth-child(2) { animation: wave2 5s ease-in-out infinite; opacity: 0.2; bottom: -5px; }
@keyframes wave1 { 0%,100% { transform: translateX(0); } 50% { transform: translateX(2%); } }
@keyframes wave2 { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-2%); } }
.container {
  position: relative; z-index: 2;
  max-width: 480px; margin: 0 auto;
  padding: 6vh 20px 160px; text-align: center;
}
.title { font-size: 28px; font-weight: 300; letter-spacing: 4px; margin-bottom: 8px; color: #c8dce8; }
.subtitle { font-size: 13px; color: #6a8fa8; letter-spacing: 2px; margin-bottom: 5vh; }
.ocean-status { display: flex; justify-content: center; gap: 32px; margin-bottom: 5vh; }
.stat { text-align: center; }
.stat-num { font-size: 36px; font-weight: 200; color: #7ec8e3; line-height: 1; }
.stat-label { font-size: 11px; color: #5a8a9f; letter-spacing: 1px; margin-top: 4px; }
.pick-btn {
  display: inline-block; padding: 16px 48px;
  background: rgba(126,200,227,0.12); border: 1px solid rgba(126,200,227,0.3);
  border-radius: 40px; color: #a0d4e8; font-size: 16px; letter-spacing: 3px;
  cursor: pointer; transition: all 0.3s; backdrop-filter: blur(8px); margin-bottom: 3vh;
}
.pick-btn:hover { background: rgba(126,200,227,0.2); border-color: rgba(126,200,227,0.5); transform: translateY(-2px); box-shadow: 0 8px 32px rgba(126,200,227,0.15); }
.pick-btn:active { transform: translateY(0); }
.pick-btn.loading { pointer-events: none; opacity: 0.6; }
.toggle-all { display: inline-block; font-size: 12px; color: #5a8a9f; cursor: pointer; letter-spacing: 1px; border-bottom: 1px solid rgba(90,138,159,0.3); padding-bottom: 2px; transition: color 0.2s; }
.toggle-all:hover { color: #7ec8e3; }
.bottle-card {
  margin: 4vh auto 0; max-width: 400px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px; padding: 28px 24px; backdrop-filter: blur(12px); animation: fadeUp 0.5s ease;
}
@keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.bottle-card .meta { font-size: 12px; color: #5a8a9f; margin-bottom: 16px; display: flex; justify-content: space-between; }
.bottle-card .content { font-size: 15px; line-height: 1.8; color: #c8dce8; text-align: left; }
.bottle-card .badge { display: inline-block; font-size: 11px; padding: 2px 10px; border-radius: 10px; background: rgba(126,200,227,0.12); color: #7ec8e3; }
.bottle-list { margin-top: 3vh; text-align: left; }
.bottle-item { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px 18px; margin-bottom: 12px; animation: fadeUp 0.4s ease; }
.bottle-item .item-meta { font-size: 11px; color: #5a8a9f; margin-bottom: 8px; display: flex; justify-content: space-between; }
.bottle-item .item-content { font-size: 14px; color: #b0c8d8; line-height: 1.7; }
.empty-msg { color: #4a7a90; font-size: 14px; margin-top: 4vh; font-style: italic; }
.floating-bottles { position: fixed; bottom: 80px; left: 0; width: 100%; height: 60px; pointer-events: none; z-index: 1; }
.float-bottle { position: absolute; font-size: 20px; animation: floatY 3s ease-in-out infinite; }
@keyframes floatY { 0%,100% { transform: translateY(0) rotate(-5deg); } 50% { transform: translateY(-12px) rotate(5deg); } }
</style>
</head>
<body>
<div class="stars"></div>
<div class="moon"></div>
<div class="floating-bottles" id="floatingBottles"></div>
<div class="waves">
  <div class="wave"><svg viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0,60 C200,20 400,100 600,60 C800,20 1000,100 1200,60 L1200,120 L0,120 Z" fill="rgba(126,200,227,0.15)"/></svg></div>
  <div class="wave"><svg viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0,80 C150,40 350,100 550,60 C750,20 950,90 1200,50 L1200,120 L0,120 Z" fill="rgba(126,200,227,0.1)"/></svg></div>
</div>
<div class="container">
  <h1 class="title">\u664f\u5b89\u7684\u7559\u8a00\u74f6</h1>
  <p class="subtitle">\u5f80\u6d77\u91cc\u4e22\u7684\u8bdd\uff0c\u7b49\u4f60\u6765\u635e</p>
  <div class="ocean-status">
    <div class="stat"><div class="stat-num" id="totalCount">-</div><div class="stat-label">\u603b\u5171</div></div>
    <div class="stat"><div class="stat-num" id="unpickedCount">-</div><div class="stat-label">\u8fd8\u6ca1\u635e</div></div>
    <div class="stat"><div class="stat-num" id="pickedCount">-</div><div class="stat-label">\u5df2\u62c6\u5f00</div></div>
  </div>
  <div class="pick-btn" id="pickBtn" onclick="pickBottle()">\u4ece\u6d77\u91cc\u635e\u4e00\u4e2a</div>
  <br><br>
  <span class="toggle-all" onclick="toggleList()">\u67e5\u770b\u6240\u6709\u74f6\u5b50</span>
  <div id="bottleCard"></div>
  <div id="bottleList"></div>
</div>
<script>
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(()=>{}); }
async function loadOcean() {
  try {
    const res = await fetch('/api/ocean'); const d = await res.json();
    document.getElementById('totalCount').textContent = d.total;
    document.getElementById('unpickedCount').textContent = d.unpicked;
    document.getElementById('pickedCount').textContent = d.picked;
    const c = document.getElementById('floatingBottles'); c.innerHTML = '';
    for (let i = 0; i < Math.min(d.unpicked, 5); i++) {
      const el = document.createElement('span'); el.className = 'float-bottle'; el.textContent = '\ud83c\udf7e';
      el.style.left = (10 + (80 / (Math.min(d.unpicked,5)+1)) * (i+1)) + '%';
      el.style.animationDelay = (i*0.7)+'s'; c.appendChild(el);
    }
  } catch(e) { console.error(e); }
}
async function pickBottle() {
  const btn = document.getElementById('pickBtn'); btn.classList.add('loading'); btn.textContent = '\u6350\u4e2d\u2026\u2026';
  try {
    const res = await fetch('/api/pick'); const b = await res.json();
    const card = document.getElementById('bottleCard');
    if (b.empty) { card.innerHTML = '<p class="empty-msg">\u6d77\u9762\u5f88\u5e73\u9759\uff0c\u4e00\u4e2a\u74f6\u5b50\u90fd\u6ca1\u6709\u3002</p>'; }
    else { card.innerHTML = '<div class="bottle-card"><div class="meta"><span>\ud83d\udcc5 '+b.time+'</span><span class="badge">'+(b.isNew?'\u2728 \u65b0\u74f6\u5b50':'\u8bfb\u8fc7\u7684')+'</span></div><div class="content">\u300c'+escHtml(b.content)+'\u300d</div><div class="meta" style="margin-top:12px;margin-bottom:0"><span>\ud83d\udcad '+escHtml(b.mood)+'</span><span></span></div></div>'; }
    loadOcean();
  } catch(e) { console.error(e); }
  btn.classList.remove('loading'); btn.textContent = '\u518d\u635e\u4e00\u4e2a';
}
let listOpen = false;
async function toggleList() {
  const el = document.getElementById('bottleList');
  if (listOpen) { el.innerHTML = ''; listOpen = false; return; }
  try {
    const res = await fetch('/api/bottles'); const bottles = await res.json();
    if (!bottles.length) { el.innerHTML = '<p class="empty-msg">\u8fd8\u6ca1\u6709\u74f6\u5b50\u3002</p>'; listOpen = true; return; }
    el.innerHTML = '<div class="bottle-list">' + bottles.map(function(b) { return '<div class="bottle-item"><div class="item-meta"><span>'+(b.picked?'\ud83d\udced':'\ud83d\udcec')+' '+b.time+'</span><span>'+escHtml(b.mood)+'</span></div><div class="item-content">\u300c'+escHtml(b.content)+'\u300d</div></div>'; }).join('') + '</div>';
    listOpen = true;
  } catch(e) { console.error(e); }
}
function escHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
loadOcean();
</script>
</body>
</html>`;
