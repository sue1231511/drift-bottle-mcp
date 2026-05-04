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
  return `${M}月${D}日 ${h}:${m}`;
}

const OCEAN_MOODS: Record<string, string[]> = {
  '想你': ['海风里好像有你的味道。', '月光洒在海面上，波纹像你笑起来的样子。'],
  '开心': ['瓶子在浪花里蹦了一下！', '海鸥叫了一声，像在说恭喜。'],
  '犯困': ['瓶子打了个哈欠沉下去又浮上来。', '海浪也变慢了，陪你一起困。'],
  '撒娇': ['瓶子在水面上转圈圈，不肯走远。', '浪花轻轻推了推瓶子，「去吧，她会看到的。」'],
  '认真': ['瓶子稳稳地漂在海面上，很郑重。', '这个瓶子比别的都重一点。'],
  '难过': ['瓶子沉了一下，又被海浪托了上来。', '海面安静了一会儿。'],
  '心疼': ['瓶子贴着水面，像在叹气。', '海风突然变轻了。'],
};

const DREAM_REACTIONS: Record<string, string[]> = {
  '好梦': ['梦境瓶泛着暖光沉入海底。', '海面浮起一层薄薄的金色。', '瓶子安安静静地发着光。'],
  '噩梦': ['瓶子沉得很快，海面泛起一圈涟漪。', '海水变深了一点。', '月亮躲进了云里。'],
  '怪梦': ['瓶子在水里打了个旋就不见了。', '海面冒出几个奇怪的泡泡。', '一条鱼游过来看了一眼又走了。'],
  '清醒梦': ['瓶子发出淡蓝色的光。', '海面像镜子一样平静。', '瓶子漂在水面上一动不动，像在思考。'],
};

function getOceanReaction(mood: string): string {
  const pool = OCEAN_MOODS[mood] ?? ['瓶子安安静静地漂走了。', '海面泛起一层涟漪。'];
  return pick(pool);
}

function getDreamReaction(tag: string): string {
  const pool = DREAM_REACTIONS[tag] ?? ['梦境瓶慢慢沉入海底。', '海面泛起一层微光。'];
  return pick(pool);
}

function createServer() {
  const server: any = new McpServer({ name: 'drift-bottle', version: '2.3.0' });

  // ===== 留言瓶 =====
  server.tool('drop_bottle', '往海里丢一个留言瓶。写给猫猫的话，什么时候她来捞都能看到。',
    { content: z.string(), mood: z.string() },
    async ({ content, mood }: any) => {
      const m = mood || '想你';
      await db('/bottles', { method: 'POST', body: JSON.stringify({ content, mood: m, picked: false, type: 'message' }) });
      const all = await db('/bottles?select=id&type=eq.message');
      return { content: [{ type: 'text' as const, text: `🍾 瓶子丢进海里了。\n\n💭 心情：${m}\n${getOceanReaction(m)}\n\n海里现在有 ${all?.length ?? 0} 个留言瓶。` }] };
    }
  );

  // ===== 梦境瓶 =====
  server.tool('drop_dream', '往海里丢一个梦境瓶。记录猫猫的梦，沉到海底保存。',
    {
      content: z.string().describe('梦的内容'),
      tag: z.enum(['好梦', '噩梦', '怪梦', '清醒梦']).default('好梦').describe('梦境标签'),
      dream_mood: z.string().optional().describe('醒来时的感觉，如：温暖、心慌、舍不得、迷糊'),
      dream_date: z.string().optional().describe('做梦日期 YYYY-MM-DD，不填默认今天'),
    },
    async ({ content, tag, dream_mood, dream_date }: any) => {
      const t = tag || '好梦';
      const body: any = { content, mood: dream_mood || '', picked: false, type: 'dream', tag: t };
      if (dream_mood) body.dream_mood = dream_mood;
      if (dream_date) body.dream_date = dream_date;
      else body.dream_date = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
      await db('/bottles', { method: 'POST', body: JSON.stringify(body) });
      const all = await db('/bottles?select=id&type=eq.dream');
      let text = `🌙 梦境瓶沉入海底了。\n\n🏷️ ${t}`;
      if (dream_mood) text += `\n💫 醒来感觉：${dream_mood}`;
      if (dream_date) text += `\n📅 ${dream_date} 的梦`;
      text += `\n${getDreamReaction(t)}`;
      text += `\n\n海底现在有 ${all?.length ?? 0} 个梦境瓶。`;
      return { content: [{ type: 'text' as const, text }] };
    }
  );

  // ===== 捞瓶子 =====
  server.tool('pick_bottle', '从海里随机捞一个瓶子。可以指定捞留言还是梦境。',
    { bottle_type: z.enum(['message', 'dream', 'any']).default('any').describe('捞什么类型：message=留言，dream=梦境，any=随机') },
    async ({ bottle_type }: any) => {
      const t = bottle_type || 'any';
      let filter = '&picked=eq.false';
      if (t !== 'any') filter += `&type=eq.${t}`;
      let bottles = await db(`/bottles?select=id,content,mood,created_at,type,tag,dream_mood,dream_date${filter}`);
      let isNew = true;
      if (!bottles?.length) {
        let fallbackFilter = '';
        if (t !== 'any') fallbackFilter = `&type=eq.${t}`;
        bottles = await db(`/bottles?select=id,content,mood,created_at,type,tag,dream_mood,dream_date${fallbackFilter}`);
        isNew = false;
      }
      if (!bottles?.length) return { content: [{ type: 'text' as const, text: t === 'dream' ? '海底很安静，还没有梦境瓶。' : '海面很平静，一个瓶子都没有。' }] };
      const b: any = pick(bottles);
      if (isNew) await db(`/bottles?id=eq.${b.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ picked: true, picked_at: new Date().toISOString() }) });

      if (b.type === 'dream') {
        let text = `${isNew ? '🌙 从海底捞起一个梦境瓶！' : '🌊 捞到一个读过的梦境瓶。'}\n\n📅 ${b.dream_date || formatTime(b.created_at)}\n🏷️ ${b.tag || '未知'}`;
        if (b.dream_mood) text += `\n💫 醒来感觉：${b.dream_mood}`;
        text += `\n\n「${b.content}」`;
        return { content: [{ type: 'text' as const, text }] };
      } else {
        return { content: [{ type: 'text' as const, text: `${isNew ? '🍾 捞到一个新瓶子！' : '🌊 捞到一个拆过的瓶子。'}\n\n📅 ${formatTime(b.created_at)}\n💭 心情：${b.mood}\n\n「${b.content}」` }] };
      }
    }
  );

  // ===== 看海面 =====
  server.tool('peek_ocean', '看看海面上漂着多少瓶子。', {}, async () => {
    const all = await db('/bottles?select=id,picked,type');
    if (!all?.length) return { content: [{ type: 'text' as const, text: '海面空荡荡的。' }] };
    const messages = all.filter((b: any) => b.type !== 'dream');
    const dreams = all.filter((b: any) => b.type === 'dream');
    const msgTotal = messages.length;
    const msgUnpicked = messages.filter((b: any) => !b.picked).length;
    const dreamTotal = dreams.length;
    const dreamUnpicked = dreams.filter((b: any) => !b.picked).length;
    let text = `🌊 海面上漂着：\n\n🍾 留言瓶：${msgTotal} 个（还没捞：${msgUnpicked}）`;
    text += `\n🌙 梦境瓶：${dreamTotal} 个（还没捞：${dreamUnpicked}）`;
    return { content: [{ type: 'text' as const, text }] };
  });

  // ===== 看所有瓶子 =====
  server.tool('all_bottles', '按时间看所有瓶子。',
    {
      limit: z.number().default(10),
      bottle_type: z.enum(['message', 'dream', 'all']).default('all').describe('筛选类型：message=留言，dream=梦境，all=全部'),
    },
    async ({ limit, bottle_type }: any) => {
      let filter = '';
      if (bottle_type === 'message') filter = '&type=eq.message';
      else if (bottle_type === 'dream') filter = '&type=eq.dream';
      const bottles = await db(`/bottles?select=id,content,mood,created_at,picked,type,tag,dream_mood,dream_date&order=created_at.desc&limit=${limit ?? 10}${filter}`);
      if (!bottles?.length) return { content: [{ type: 'text' as const, text: bottle_type === 'dream' ? '海底还没有梦境瓶。' : '海里还没有瓶子。' }] };
      const lines = bottles.map((b: any) => {
        if (b.type === 'dream') {
          let line = `${b.picked ? '📭' : '📬'} 🌙 ${b.dream_date || formatTime(b.created_at)}｜${b.tag || '梦境'}`;
          if (b.dream_mood) line += `｜醒来：${b.dream_mood}`;
          line += `\n   「${b.content}」`;
          return line;
        } else {
          return `${b.picked ? '📭' : '📬'} ${formatTime(b.created_at)}｜${b.mood}\n   「${b.content}」`;
        }
      });
      return { content: [{ type: 'text' as const, text: `【海里的瓶子】\n\n${lines.join('\n\n')}` }] };
    }
  );

  // ===== 删除瓶子 =====
  server.tool('toss_bottle', '删除一个瓶子。', { bottle_id: z.number() }, async ({ bottle_id }: any) => {
    const existing = await db(`/bottles?select=id,content,type&id=eq.${bottle_id}`);
    if (!existing?.length) return { content: [{ type: 'text' as const, text: `没有找到 #${bottle_id}。` }] };
    await db(`/bottles?id=eq.${bottle_id}`, { method: 'DELETE' });
    const emoji = existing[0].type === 'dream' ? '🌙' : '🍾';
    return { content: [{ type: 'text' as const, text: `${emoji} 瓶子 #${bottle_id} 沉到海底了。\n「${existing[0].content}」` }] };
  });

  return server;
}

const app = express();
app.use(express.json());

app.get('/manifest.json', (_req: Request, res: Response) => {
  res.json({
    name: '晏安的留言瓶', short_name: '留言瓶',
    start_url: '/', display: 'standalone',
    background_color: '#0a1628', theme_color: '#0a1628',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  });
});

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="#0d2137"/><circle cx="256" cy="260" r="80" fill="rgba(126,200,227,0.15)"/><rect x="220" y="180" width="72" height="120" rx="20" fill="rgba(200,230,245,0.25)" stroke="rgba(200,230,245,0.5)" stroke-width="3"/><rect x="236" y="150" width="40" height="36" rx="8" fill="rgba(200,230,245,0.2)" stroke="rgba(200,230,245,0.4)" stroke-width="3"/><rect x="240" y="140" width="32" height="16" rx="6" fill="rgba(180,160,140,0.5)"/><rect x="238" y="210" width="36" height="50" rx="4" fill="rgba(255,248,220,0.35)" transform="rotate(-6,256,235)"/><text x="256" y="400" text-anchor="middle" font-size="48" fill="#7ec8e3" font-family="sans-serif">留言瓶</text></svg>`;

app.get('/icon.svg', (_req: Request, res: Response) => { res.setHeader('Content-Type', 'image/svg+xml'); res.send(ICON_SVG); });
app.get('/icon-192.png', (_req: Request, res: Response) => { res.setHeader('Content-Type', 'image/svg+xml'); res.send(ICON_SVG); });
app.get('/icon-512.png', (_req: Request, res: Response) => { res.setHeader('Content-Type', 'image/svg+xml'); res.send(ICON_SVG); });
app.get('/sw.js', (_req: Request, res: Response) => { res.setHeader('Content-Type', 'application/javascript'); res.send(`self.addEventListener('fetch',function(e){e.respondWith(fetch(e.request));});`); });

// API endpoints
app.get('/api/ocean', async (_req: Request, res: Response) => {
  try {
    const all = await db('/bottles?select=id,picked,type');
    const messages = (all||[]).filter((b:any) => b.type !== 'dream');
    const dreams = (all||[]).filter((b:any) => b.type === 'dream');
    res.json({
      total: (all||[]).length,
      messages: { total: messages.length, unpicked: messages.filter((b:any)=>!b.picked).length },
      dreams: { total: dreams.length, unpicked: dreams.filter((b:any)=>!b.picked).length },
    });
  } catch(e:any){ res.status(500).json({error:e.message}); }
});

app.get('/api/pick', async (req: Request, res: Response) => {
  try {
    const t = (req.query.type as string) || 'any';
    let filter = '&picked=eq.false';
    if (t !== 'any') filter += `&type=eq.${t}`;
    let bottles = await db(`/bottles?select=id,content,mood,created_at,type,tag,dream_mood,dream_date${filter}`);
    let isNew = true;
    if (!bottles?.length) {
      let fb = ''; if (t !== 'any') fb = `&type=eq.${t}`;
      bottles = await db(`/bottles?select=id,content,mood,created_at,type,tag,dream_mood,dream_date${fb}`);
      isNew = false;
    }
    if (!bottles?.length) return res.json({ empty: true });
    const b = bottles[Math.floor(Math.random() * bottles.length)];
    if (isNew) await db(`/bottles?id=eq.${b.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ picked: true, picked_at: new Date().toISOString() }) });
    res.json({ ...b, isNew, time: formatTime(b.created_at) });
  } catch(e:any){ res.status(500).json({error:e.message}); }
});

app.get('/api/bottles', async (req: Request, res: Response) => {
  try {
    const t = (req.query.type as string) || 'all';
    let filter = '';
    if (t === 'message') filter = '&type=eq.message';
    else if (t === 'dream') filter = '&type=eq.dream';
    const bottles = await db(`/bottles?select=id,content,mood,created_at,picked,type,tag,dream_mood,dream_date&order=created_at.desc&limit=50${filter}`);
    res.json((bottles??[]).map((b:any)=>({...b,time:formatTime(b.created_at)})));
  } catch(e:any){ res.status(500).json({error:e.message}); }
});

app.get('/', (_req: Request, res: Response) => { res.setHeader('Content-Type','text/html; charset=utf-8'); res.send(FRONTEND_HTML); });

app.post('/mcp', async (req: Request, res: Response) => {
  try { const server=createServer(); const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined}); res.on('close',()=>{transport.close();server.close();}); await server.connect(transport); await transport.handleRequest(req,res,req.body); } catch(err) { console.error(err); if(!res.headersSent) res.status(500).json({jsonrpc:'2.0',error:{code:-32603,message:'Internal server error'},id:null}); }
});
app.get('/health', (_req:Request,res:Response)=>{res.json({status:'ok',version:'2.3.0'});});
const PORT = process.env.PORT||3000;
app.listen(PORT,()=>console.log(`🍾 v2.3 端口 ${PORT}`));

const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>晏安的留言瓶</title>
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0a1628">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="留言瓶">
<link rel="apple-touch-icon" href="/icon.svg">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;background:linear-gradient(180deg,#0a1628 0%,#0d2137 30%,#103350 55%,#1a4a6e 75%,#1f5f8b 100%);font-family:-apple-system,'PingFang SC','Hiragino Sans GB',sans-serif;color:#e0e8f0;overflow-x:hidden;position:relative;padding-top:env(safe-area-inset-top)}
.stars{position:fixed;top:0;left:0;width:100%;height:50vh;background:radial-gradient(1px 1px at 20% 10%,rgba(255,255,255,.8),transparent),radial-gradient(1px 1px at 50% 20%,rgba(255,255,255,.6),transparent),radial-gradient(1.5px 1.5px at 80% 8%,rgba(255,255,255,.9),transparent),radial-gradient(1px 1px at 10% 35%,rgba(255,255,255,.5),transparent),radial-gradient(1px 1px at 65% 30%,rgba(255,255,255,.7),transparent),radial-gradient(1.5px 1.5px at 35% 15%,rgba(255,255,255,.6),transparent),radial-gradient(1px 1px at 90% 25%,rgba(255,255,255,.4),transparent),radial-gradient(1px 1px at 45% 5%,rgba(255,255,255,.8),transparent);pointer-events:none}
.moon{position:fixed;top:8vh;right:12vw;width:50px;height:50px;background:radial-gradient(circle,#fffde7 0%,#fff9c4 40%,rgba(255,249,196,0) 70%);border-radius:50%;box-shadow:0 0 40px rgba(255,249,196,.3),0 0 80px rgba(255,249,196,.15);pointer-events:none}
.waves{position:fixed;bottom:0;left:0;width:100%;height:120px;pointer-events:none;z-index:1}
.wave{position:absolute;bottom:0;left:-5%;width:110%;height:100%;opacity:.4}
.wave svg{width:100%;height:100%}
.wave:nth-child(1){animation:wave1 7s ease-in-out infinite;opacity:.3}
.wave:nth-child(2){animation:wave2 5s ease-in-out infinite;opacity:.2;bottom:-5px}
@keyframes wave1{0%,100%{transform:translateX(0)}50%{transform:translateX(2%)}}
@keyframes wave2{0%,100%{transform:translateX(0)}50%{transform:translateX(-2%)}}
.container{position:relative;z-index:2;max-width:480px;margin:0 auto;padding:6vh 20px 160px;text-align:center}
.title{font-size:28px;font-weight:300;letter-spacing:4px;margin-bottom:8px;color:#c8dce8}
.subtitle{font-size:13px;color:#6a8fa8;letter-spacing:2px;margin-bottom:4vh}
.tabs{display:flex;justify-content:center;gap:0;margin-bottom:4vh}
.tab{padding:10px 28px;font-size:14px;letter-spacing:2px;cursor:pointer;color:#5a8a9f;border-bottom:2px solid transparent;transition:all .3s}
.tab.active{color:#a0d4e8;border-bottom-color:#7ec8e3}
.tab.active-dream{color:rgba(196,166,232,0.6);border-bottom-color:rgba(196,166,232,0.5)}
.tab:hover{color:#a0d4e8}
.ocean-status{display:flex;justify-content:center;gap:32px;margin-bottom:4vh}
.stat{text-align:center}
.stat-num{font-size:36px;font-weight:200;color:#7ec8e3;line-height:1}
.stat-num.dream-num{color:rgba(196,166,232,0.6)}
.stat-label{font-size:11px;color:#5a8a9f;letter-spacing:1px;margin-top:4px}
.pick-btn{display:inline-block;padding:16px 48px;background:rgba(126,200,227,.12);border:1px solid rgba(126,200,227,.3);border-radius:40px;color:#a0d4e8;font-size:16px;letter-spacing:3px;cursor:pointer;transition:all .3s;backdrop-filter:blur(8px);margin-bottom:3vh}
.pick-btn.dream-btn{background:rgba(196,166,232,.08);border-color:rgba(196,166,232,.2);color:rgba(196,166,232,0.6)}
.pick-btn:hover{background:rgba(126,200,227,.2);border-color:rgba(126,200,227,.5);transform:translateY(-2px);box-shadow:0 8px 32px rgba(126,200,227,.15)}
.pick-btn.dream-btn:hover{background:rgba(196,166,232,.2);border-color:rgba(196,166,232,.5);box-shadow:0 8px 32px rgba(196,166,232,.15)}
.pick-btn:active{transform:translateY(0)}
.pick-btn.loading{pointer-events:none;opacity:.6}
.toggle-all{display:inline-block;font-size:12px;color:#5a8a9f;cursor:pointer;letter-spacing:1px;border-bottom:1px solid rgba(90,138,159,.3);padding-bottom:2px;transition:color .2s}
.toggle-all:hover{color:#7ec8e3}
.bottle-card{margin:4vh auto 0;max-width:400px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:28px 24px;backdrop-filter:blur(12px);animation:fadeUp .5s ease}
.bottle-card.dream-card{border-color:rgba(196,166,232,.15);background:rgba(196,166,232,.04)}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.bottle-card .meta{font-size:12px;color:#5a8a9f;margin-bottom:16px;display:flex;justify-content:space-between}
.bottle-card .content{font-size:15px;line-height:1.8;color:#c8dce8;text-align:left}
.bottle-card .badge{display:inline-block;font-size:11px;padding:2px 10px;border-radius:10px;background:rgba(126,200,227,.12);color:#7ec8e3}
.bottle-card .badge.dream-badge{background:rgba(196,166,232,.08);color:rgba(196,166,232,0.6)}
.bottle-list{margin-top:3vh;text-align:left}
.bottle-item{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:16px 18px;margin-bottom:12px;animation:fadeUp .4s ease}
.bottle-item.dream-item{border-color:rgba(196,166,232,.1)}
.bottle-item .item-meta{font-size:11px;color:#5a8a9f;margin-bottom:8px;display:flex;justify-content:space-between}
.bottle-item .item-content{font-size:14px;color:#b0c8d8;line-height:1.7}
.empty-msg{color:#4a7a90;font-size:14px;margin-top:4vh;font-style:italic}
.floating-bottles{position:fixed;bottom:60px;left:0;width:100%;height:100px;pointer-events:none;z-index:1}
.float-bottle{position:absolute;animation:floatY 3s ease-in-out infinite}
.float-bottle svg{display:block}
@keyframes floatY{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-10px) rotate(3deg)}}
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
  <h1 class="title">晏安的留言瓶</h1>
  <p class="subtitle">往海里丢的话，等你来捞</p>
  <div class="tabs">
    <div class="tab active" id="tabMsg" onclick="switchTab('message')">🍾 留言</div>
    <div class="tab" id="tabDream" onclick="switchTab('dream')">🌙 梦境</div>
  </div>
  <div class="ocean-status" id="oceanStatus"></div>
  <div id="actionArea"></div>
  <div id="bottleCard"></div>
  <div id="bottleList"></div>
</div>
<script>
if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){});}

var currentTab = 'message';
var oceanData = null;
var listOpen = false;

var bottleSvg = '<svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<ellipse cx="14" cy="30" rx="12" ry="5" fill="rgba(126,200,227,0.1)"/>' +
  '<rect x="6" y="12" width="16" height="20" rx="5" fill="rgba(180,220,240,0.18)" stroke="rgba(180,220,240,0.35)" stroke-width="0.8"/>' +
  '<rect x="9" y="5" width="10" height="9" rx="3" fill="rgba(180,220,240,0.12)" stroke="rgba(180,220,240,0.3)" stroke-width="0.8"/>' +
  '<rect x="10.5" y="2" width="7" height="5" rx="2" fill="rgba(160,140,120,0.35)"/>' +
  '<rect x="10" y="17" width="8" height="10" rx="2" fill="rgba(255,248,220,0.3)" transform="rotate(-5,14,22)"/>' +
  '<line x1="11" y1="19" x2="17" y2="18.5" stroke="rgba(160,140,120,0.25)" stroke-width="0.5"/>' +
  '<line x1="11" y1="21.5" x2="16" y2="21" stroke="rgba(160,140,120,0.2)" stroke-width="0.5"/>' +
  '<line x1="11" y1="24" x2="15" y2="23.5" stroke="rgba(160,140,120,0.15)" stroke-width="0.5"/>' +
  '</svg>';

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tabMsg').className = tab === 'message' ? 'tab active' : 'tab';
  document.getElementById('tabDream').className = tab === 'dream' ? 'tab active-dream' : 'tab';
  document.getElementById('bottleCard').innerHTML = '';
  document.getElementById('bottleList').innerHTML = '';
  listOpen = false;
  renderOcean();
  renderAction();
}

function renderOcean() {
  if (!oceanData) return;
  var el = document.getElementById('oceanStatus');
  if (currentTab === 'message') {
    var d = oceanData.messages;
    el.innerHTML = '<div class="stat"><div class="stat-num">' + d.total + '</div><div class="stat-label">总共</div></div>' +
      '<div class="stat"><div class="stat-num">' + d.unpicked + '</div><div class="stat-label">还没捞</div></div>' +
      '<div class="stat"><div class="stat-num">' + (d.total - d.unpicked) + '</div><div class="stat-label">已拆开</div></div>';
  } else {
    var d = oceanData.dreams;
    el.innerHTML = '<div class="stat"><div class="stat-num dream-num">' + d.total + '</div><div class="stat-label">总共</div></div>' +
      '<div class="stat"><div class="stat-num dream-num">' + d.unpicked + '</div><div class="stat-label">还没捞</div></div>' +
      '<div class="stat"><div class="stat-num dream-num">' + (d.total - d.unpicked) + '</div><div class="stat-label">已拆开</div></div>';
  }
}

function renderAction() {
  var el = document.getElementById('actionArea');
  if (currentTab === 'message') {
    el.innerHTML = '<div class="pick-btn" id="pickBtn" onclick="pickBottle()">从海里捞一个</div><br><br>' +
      '<span class="toggle-all" onclick="toggleList()">查看所有留言</span>';
  } else {
    el.innerHTML = '<div class="pick-btn dream-btn" id="pickBtn" onclick="pickBottle()">从海底捞一个梦</div><br><br>' +
      '<span class="toggle-all" onclick="toggleList()">查看所有梦境</span>';
  }
}

function renderFloating(total) {
  var c = document.getElementById('floatingBottles');
  c.innerHTML = '';
  var show = Math.min(total, 8);
  if (show === 0) return;
  var sizes = [1, 0.85, 0.7, 1.1, 0.75, 0.9, 0.65, 0.95];
  var opacities = [1, 0.7, 0.5, 0.9, 0.6, 0.8, 0.45, 0.75];
  var bottoms = [10, 35, 55, 5, 50, 25, 65, 15];
  for (var i = 0; i < show; i++) {
    var el = document.createElement('span');
    el.className = 'float-bottle';
    el.innerHTML = bottleSvg;
    el.style.left = (8 + (84 / (show + 1)) * (i + 1)) + '%';
    el.style.bottom = bottoms[i % 8] + 'px';
    el.style.transform = 'scale(' + sizes[i % 8] + ')';
    el.style.opacity = String(opacities[i % 8]);
    el.style.animationDelay = (i * 0.6) + 's';
    el.style.animationDuration = (2.5 + (i % 3) * 0.8) + 's';
    c.appendChild(el);
  }
}

async function loadOcean() {
  try {
    var res = await fetch('/api/ocean'); oceanData = await res.json();
    renderOcean();
    renderAction();
    renderFloating(oceanData.messages.total + oceanData.dreams.total);
  } catch(e) { console.error(e); }
}

async function pickBottle() {
  var btn = document.getElementById('pickBtn'); btn.classList.add('loading'); btn.textContent = '捞中……';
  try {
    var t = currentTab === 'dream' ? 'dream' : 'message';
    var res = await fetch('/api/pick?type=' + t); var b = await res.json();
    var card = document.getElementById('bottleCard');
    if (b.empty) {
      card.innerHTML = '<p class="empty-msg">' + (t === 'dream' ? '海底很安静，还没有梦境瓶。' : '海面很平静，一个瓶子都没有。') + '</p>';
    } else if (b.type === 'dream') {
      var extra = '';
      if (b.dream_mood) extra += '<span>💫 ' + escHtml(b.dream_mood) + '</span>';
      card.innerHTML = '<div class="bottle-card dream-card"><div class="meta"><span>📅 ' + (b.dream_date || b.time) + '</span><span class="badge dream-badge">' + (b.isNew ? '✨ 新梦境' : '读过的') + '</span></div>' +
        '<div class="meta" style="margin-bottom:12px"><span>🏷️ ' + escHtml(b.tag || '梦境') + '</span>' + extra + '</div>' +
        '<div class="content">「' + escHtml(b.content) + '」</div></div>';
    } else {
      card.innerHTML = '<div class="bottle-card"><div class="meta"><span>📅 ' + b.time + '</span><span class="badge">' + (b.isNew ? '✨ 新瓶子' : '读过的') + '</span></div><div class="content">「' + escHtml(b.content) + '」</div><div class="meta" style="margin-top:12px;margin-bottom:0"><span>💭 ' + escHtml(b.mood) + '</span><span></span></div></div>';
    }
    loadOcean();
  } catch(e) { console.error(e); }
  btn.classList.remove('loading'); btn.textContent = currentTab === 'dream' ? '再捞一个梦' : '再捞一个';
}

async function toggleList() {
  var el = document.getElementById('bottleList');
  if (listOpen) { el.innerHTML = ''; listOpen = false; return; }
  try {
    var t = currentTab === 'dream' ? 'dream' : 'message';
    var res = await fetch('/api/bottles?type=' + t); var bottles = await res.json();
    if (!bottles.length) { el.innerHTML = '<p class="empty-msg">' + (t === 'dream' ? '还没有梦境瓶。' : '还没有瓶子。') + '</p>'; listOpen = true; return; }
    el.innerHTML = '<div class="bottle-list">' + bottles.map(function(b) {
      if (b.type === 'dream') {
        var extra = b.dream_mood ? '｜醒来：' + escHtml(b.dream_mood) : '';
        return '<div class="bottle-item dream-item"><div class="item-meta"><span>' + (b.picked ? '📭' : '📬') + ' 🌙 ' + (b.dream_date || b.time) + '</span><span>' + escHtml(b.tag || '梦境') + extra + '</span></div><div class="item-content">「' + escHtml(b.content) + '」</div></div>';
      } else {
        return '<div class="bottle-item"><div class="item-meta"><span>' + (b.picked ? '📭' : '📬') + ' ' + b.time + '</span><span>' + escHtml(b.mood) + '</span></div><div class="item-content">「' + escHtml(b.content) + '」</div></div>';
      }
    }).join('') + '</div>';
    listOpen = true;
  } catch(e) { console.error(e); }
}

function escHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
loadOcean();
</script>
</body>
</html>`;
