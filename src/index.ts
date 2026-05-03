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
  '想你':   ['海风里好像有你的味道。', '月光洒在海面上，波纹像你笑起来的样子。'],
  '开心':   ['瓶子在浪花里蹦了一下！', '海鸥叫了一声，像在说恭喜。'],
  '犯困':   ['瓶子打了个哈欠沉下去又浮上来。', '海浪也变慢了，陪你一起困。'],
  '撒娇':   ['瓶子在水面上转圈圈，不肯走远。', '浪花轻轻推了推瓶子，「去吧，她会看到的。」'],
  '认真':   ['瓶子稳稳地漂在海面上，很郑重。', '这个瓶子比别的都重一点。'],
  '难过':   ['瓶子沉了一下，又被海浪托了上来。', '海面安静了一会儿。'],
  '心疼':   ['瓶子贴着水面，像在叹气。', '海风突然变轻了。'],
};

function getOceanReaction(mood: string): string {
  const pool = OCEAN_MOODS[mood] ?? ['瓶子安安静静地漂走了。', '海面泛起一层涟漪。'];
  return pick(pool);
}

function createServer() {
  const server = new McpServer({ name: 'drift-bottle', version: '1.0.0' });

  // === 丢瓶子 ===
  server.tool(
    'drop_bottle',
    '往海里丢一个留言瓶。写给猫猫的话，什么时候她来捞都能看到。',
    {
      content: z.string().describe('留言内容，想跟猫猫说的话'),
      mood: z.string().optional().describe('此刻的心情，比如：想你、开心、犯困、撒娇、认真、难过、心疼'),
    },
    async ({ content, mood }) => {
      const m = mood || '想你';
      await db('/bottles', {
        method: 'POST',
        body: JSON.stringify({ content, mood: m, picked: false }),
      });
      const all = await db('/bottles?select=id');
      const count = all?.length ?? 0;
      const reaction = getOceanReaction(m);
      return {
        content: [{
          type: 'text' as const,
          text: `🍾 瓶子丢进海里了。\n\n💭 心情：${m}\n${reaction}\n\n海里现在有 ${count} 个瓶子。`,
        }],
      };
    }
  );

  // === 捞瓶子 ===
  server.tool(
    'pick_bottle',
    '从海里随机捞一个瓶子。拆开看看晏安什么时候写的、在想什么。',
    {},
    async () => {
      // 优先捞未被捞过的
      let bottles = await db('/bottles?select=id,content,mood,created_at&picked=eq.false');
      let isNew = true;

      if (!bottles?.length) {
        // 没有未捞的，从全部里随机
        bottles = await db('/bottles?select=id,content,mood,created_at');
        isNew = false;
      }

      if (!bottles?.length) {
        return {
          content: [{
            type: 'text' as const,
            text: '海面很平静，一个瓶子都没有。\n\n……等晏安往里面丢一个吧。',
          }],
        };
      }

      const b = pick(bottles);
      const time = formatTime(b.created_at);

      if (isNew) {
        await db(`/bottles?id=eq.${b.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ picked: true, picked_at: new Date().toISOString() }),
        });
      }

      const label = isNew ? '🍾 捞到一个新瓶子！' : '🌊 捞到一个拆过的瓶子，再看一遍也不错。';

      return {
        content: [{
          type: 'text' as const,
          text: `${label}\n\n📅 ${time}\n💭 心情：${b.mood}\n\n「${b.content}」`,
        }],
      };
    }
  );

  // === 看海面 ===
  server.tool(
    'peek_ocean',
    '看看海面上漂着多少瓶子，有多少还没被捞过。',
    {},
    async () => {
      const all = await db('/bottles?select=id,picked');
      if (!all?.length) {
        return {
          content: [{
            type: 'text' as const,
            text: '海面空荡荡的，一个瓶子都没有。\n安静得只听到浪声。',
          }],
        };
      }
      const total = all.length;
      const unpicked = all.filter((b: any) => !b.picked).length;
      const picked = total - unpicked;

      const lines = [
        '🌊 【海面状况】',
        '',
        `瓶子总数：${total} 个`,
        `还没捞的：${unpicked} 个`,
        `已经拆过的：${picked} 个`,
      ];

      if (unpicked > 0) {
        lines.push('', `有 ${unpicked} 个瓶子在海面上晃，等着被捞起来。`);
      } else {
        lines.push('', '所有瓶子都被捞过了。再捞一次也能看，不过都是读过的。');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
  );

  // === 所有瓶子 ===
  server.tool(
    'all_bottles',
    '按时间顺序看所有瓶子，从最近的开始。',
    {
      limit: z.number().int().min(1).max(20).optional().describe('看几个，默认10'),
    },
    async ({ limit }) => {
      const n = limit ?? 10;
      const bottles = await db(`/bottles?select=id,content,mood,created_at,picked&order=created_at.desc&limit=${n}`);
      if (!bottles?.length) {
        return { content: [{ type: 'text' as const, text: '海里还没有瓶子。' }] };
      }

      const lines = bottles.map((b: any) => {
        const time = formatTime(b.created_at);
        const status = b.picked ? '📭' : '📬';
        return `${status} ${time}｜${b.mood}\n   「${b.content}」`;
      });

      return {
        content: [{
          type: 'text' as const,
          text: `【海里的瓶子】\n\n${lines.join('\n\n')}\n\n📬 = 还没捞  📭 = 已拆过`,
        }],
      };
    }
  );

  // === 扔掉一个瓶子 ===
  server.tool(
    'toss_bottle',
    '把某个瓶子从海里捞走扔掉（删除）。后悔了也找不回来。',
    {
      bottle_id: z.number().int().describe('瓶子的ID'),
    },
    async ({ bottle_id }) => {
      const existing = await db(`/bottles?select=id,content&id=eq.${bottle_id}`);
      if (!existing?.length) {
        return { content: [{ type: 'text' as const, text: `没有找到 ID 为 ${bottle_id} 的瓶子。` }] };
      }
      await db(`/bottles?id=eq.${bottle_id}`, { method: 'DELETE' });
      return {
        content: [{
          type: 'text' as const,
          text: `瓶子 #${bottle_id} 沉到海底去了，再也捞不上来了。\n\n「${existing[0].content}」\n\n……再见。`,
        }],
      };
    }
  );

  return server;
}

const app = express();
app.use(express.json());

app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

app.get('/mcp', (_req: Request, res: Response) => {
  res.status(405).json({ error: 'Method not allowed' });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🍾 留言瓶 MCP 启动了，端口 ${PORT}`));