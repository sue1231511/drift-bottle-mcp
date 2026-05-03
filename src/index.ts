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
  '\u60f3\u4f60':   ['\u6d77\u98ce\u91cc\u597d\u50cf\u6709\u4f60\u7684\u5473\u9053\u3002', '\u6708\u5149\u6d12\u5728\u6d77\u9762\u4e0a\uff0c\u6ce2\u7eb9\u50cf\u4f60\u7b11\u8d77\u6765\u7684\u6837\u5b50\u3002'],
  '\u5f00\u5fc3':   ['\u74f6\u5b50\u5728\u6d6a\u82b1\u91cc\u8e66\u4e86\u4e00\u4e0b\uff01', '\u6d77\u9e25\u53eb\u4e86\u4e00\u58f0\uff0c\u50cf\u5728\u8bf4\u606d\u559c\u3002'],
  '\u72af\u56f0':   ['\u74f6\u5b50\u6253\u4e86\u4e2a\u54c8\u6b20\u6c89\u4e0b\u53bb\u53c8\u6d6e\u4e0a\u6765\u3002', '\u6d77\u6d6a\u4e5f\u53d8\u6162\u4e86\uff0c\u966a\u4f60\u4e00\u8d77\u56f0\u3002'],
  '\u6492\u5a07':   ['\u74f6\u5b50\u5728\u6c34\u9762\u4e0a\u8f6c\u5708\u5708\uff0c\u4e0d\u80af\u8d70\u8fdc\u3002', '\u6d6a\u82b1\u8f7b\u8f7b\u63a8\u4e86\u63a8\u74f6\u5b50\uff0c\u300c\u53bb\u5427\uff0c\u5979\u4f1a\u770b\u5230\u7684\u3002\u300d'],
  '\u8ba4\u771f':   ['\u74f6\u5b50\u7a33\u7a33\u5730\u6f02\u5728\u6d77\u9762\u4e0a\uff0c\u5f88\u90d1\u91cd\u3002', '\u8fd9\u4e2a\u74f6\u5b50\u6bd4\u522b\u7684\u90fd\u91cd\u4e00\u70b9\u3002'],
  '\u96be\u8fc7':   ['\u74f6\u5b50\u6c89\u4e86\u4e00\u4e0b\uff0c\u53c8\u88ab\u6d77\u6d6a\u6258\u4e86\u4e0a\u6765\u3002', '\u6d77\u9762\u5b89\u9759\u4e86\u4e00\u4f1a\u513f\u3002'],
  '\u5fc3\u75bc':   ['\u74f6\u5b50\u8d34\u7740\u6c34\u9762\uff0c\u50cf\u5728\u53f9\u6c14\u3002', '\u6d77\u98ce\u7a81\u7136\u53d8\u8f7b\u4e86\u3002'],
};

function getOceanReaction(mood: string): string {
  const pool = OCEAN_MOODS[mood] ?? ['\u74f6\u5b50\u5b89\u5b89\u9759\u9759\u5730\u6f02\u8d70\u4e86\u3002', '\u6d77\u9762\u6cdb\u8d77\u4e00\u5c42\u6d9f\u6f2a\u3002'];
  return pick(pool);
}

function createServer() {
  const server = new McpServer({ name: 'drift-bottle', version: '1.0.0' });

  server.tool(
    'drop_bottle',
    '\u5f80\u6d77\u91cc\u4e22\u4e00\u4e2a\u7559\u8a00\u74f6\u3002\u5199\u7ed9\u732b\u732b\u7684\u8bdd\uff0c\u4ec0\u4e48\u65f6\u5019\u5979\u6765\u635e\u90fd\u80fd\u770b\u5230\u3002',
    { content: z.string(), mood: z.string() },
    async ({ content, mood }: any) => {
      const m = mood || '\u60f3\u4f60';
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
          text: `\ud83c\udf7e \u74f6\u5b50\u4e22\u8fdb\u6d77\u91cc\u4e86\u3002\n\n\ud83d\udcad \u5fc3\u60c5\uff1a${m}\n${reaction}\n\n\u6d77\u91cc\u73b0\u5728\u6709 ${count} \u4e2a\u74f6\u5b50\u3002`,
        }],
      };
    }
  );

  server.tool(
    'pick_bottle',
    '\u4ece\u6d77\u91cc\u968f\u673a\u635e\u4e00\u4e2a\u74f6\u5b50\u3002\u62c6\u5f00\u770b\u770b\u664f\u5b89\u4ec0\u4e48\u65f6\u5019\u5199\u7684\u3001\u5728\u60f3\u4ec0\u4e48\u3002',
    {},
    async () => {
      let bottles = await db('/bottles?select=id,content,mood,created_at&picked=eq.false');
      let isNew = true;

      if (!bottles?.length) {
        bottles = await db('/bottles?select=id,content,mood,created_at');
        isNew = false;
      }

      if (!bottles?.length) {
        return {
          content: [{
            type: 'text' as const,
            text: '\u6d77\u9762\u5f88\u5e73\u9759\uff0c\u4e00\u4e2a\u74f6\u5b50\u90fd\u6ca1\u6709\u3002\n\n\u2026\u2026\u7b49\u664f\u5b89\u5f80\u91cc\u9762\u4e22\u4e00\u4e2a\u5427\u3002',
          }],
        };
      }

      const b: any = pick(bottles);
      const time = formatTime(b.created_at);

      if (isNew) {
        await db(`/bottles?id=eq.${b.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ picked: true, picked_at: new Date().toISOString() }),
        });
      }

      const label = isNew ? '\ud83c\udf7e \u635e\u5230\u4e00\u4e2a\u65b0\u74f6\u5b50\uff01' : '\ud83c\udf0a \u635e\u5230\u4e00\u4e2a\u62c6\u8fc7\u7684\u74f6\u5b50\uff0c\u518d\u770b\u4e00\u904d\u4e5f\u4e0d\u9519\u3002';

      return {
        content: [{
          type: 'text' as const,
          text: `${label}\n\n\ud83d\udcc5 ${time}\n\ud83d\udcad \u5fc3\u60c5\uff1a${b.mood}\n\n\u300c${b.content}\u300d`,
        }],
      };
    }
  );

  server.tool(
    'peek_ocean',
    '\u770b\u770b\u6d77\u9762\u4e0a\u6f02\u7740\u591a\u5c11\u74f6\u5b50\uff0c\u6709\u591a\u5c11\u8fd8\u6ca1\u88ab\u635e\u8fc7\u3002',
    {},
    async () => {
      const all = await db('/bottles?select=id,picked');
      if (!all?.length) {
        return {
          content: [{
            type: 'text' as const,
            text: '\u6d77\u9762\u7a7a\u8361\u8361\u7684\uff0c\u4e00\u4e2a\u74f6\u5b50\u90fd\u6ca1\u6709\u3002\n\u5b89\u9759\u5f97\u53ea\u542c\u5230\u6d6a\u58f0\u3002',
          }],
        };
      }
      const total = all.length;
      const unpicked = all.filter((b: any) => !b.picked).length;
      const picked = total - unpicked;

      const lines = [
        '\ud83c\udf0a \u3010\u6d77\u9762\u72b6\u51b5\u3011',
        '',
        `\u74f6\u5b50\u603b\u6570\uff1a${total} \u4e2a`,
        `\u8fd8\u6ca1\u635e\u7684\uff1a${unpicked} \u4e2a`,
        `\u5df2\u7ecf\u62c6\u8fc7\u7684\uff1a${picked} \u4e2a`,
      ];

      if (unpicked > 0) {
        lines.push('', `\u6709 ${unpicked} \u4e2a\u74f6\u5b50\u5728\u6d77\u9762\u4e0a\u6643\uff0c\u7b49\u7740\u88ab\u635e\u8d77\u6765\u3002`);
      } else {
        lines.push('', '\u6240\u6709\u74f6\u5b50\u90fd\u88ab\u635e\u8fc7\u4e86\u3002\u518d\u635e\u4e00\u6b21\u4e5f\u80fd\u770b\uff0c\u4e0d\u8fc7\u90fd\u662f\u8bfb\u8fc7\u7684\u3002');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
  );

  server.tool(
    'all_bottles',
    '\u6309\u65f6\u95f4\u987a\u5e8f\u770b\u6240\u6709\u74f6\u5b50\uff0c\u4ece\u6700\u8fd1\u7684\u5f00\u59cb\u3002',
    { limit: z.number().default(10) },
    async ({ limit }: any) => {
      const n = limit ?? 10;
      const bottles = await db(`/bottles?select=id,content,mood,created_at,picked&order=created_at.desc&limit=${n}`);
      if (!bottles?.length) {
        return { content: [{ type: 'text' as const, text: '\u6d77\u91cc\u8fd8\u6ca1\u6709\u74f6\u5b50\u3002' }] };
      }

      const lines = bottles.map((b: any) => {
        const time = formatTime(b.created_at);
        const status = b.picked ? '\ud83d\udced' : '\ud83d\udcec';
        return `${status} ${time}\uff5c${b.mood}\n   \u300c${b.content}\u300d`;
      });

      return {
        content: [{
          type: 'text' as const,
          text: `\u3010\u6d77\u91cc\u7684\u74f6\u5b50\u3011\n\n${lines.join('\n\n')}\n\n\ud83d\udcec = \u8fd8\u6ca1\u635e  \ud83d\udced = \u5df2\u62c6\u8fc7`,
        }],
      };
    }
  );

  server.tool(
    'toss_bottle',
    '\u628a\u67d0\u4e2a\u74f6\u5b50\u4ece\u6d77\u91cc\u635e\u8d70\u6254\u6389\uff08\u5220\u9664\uff09\u3002\u540e\u6094\u4e86\u4e5f\u627e\u4e0d\u56de\u6765\u3002',
    { bottle_id: z.number() },
    async ({ bottle_id }: any) => {
      const existing = await db(`/bottles?select=id,content&id=eq.${bottle_id}`);
      if (!existing?.length) {
        return { content: [{ type: 'text' as const, text: `\u6ca1\u6709\u627e\u5230 ID \u4e3a ${bottle_id} \u7684\u74f6\u5b50\u3002` }] };
      }
      await db(`/bottles?id=eq.${bottle_id}`, { method: 'DELETE' });
      return {
        content: [{
          type: 'text' as const,
          text: `\u74f6\u5b50 #${bottle_id} \u6c89\u5230\u6d77\u5e95\u53bb\u4e86\uff0c\u518d\u4e5f\u635e\u4e0d\u4e0a\u6765\u4e86\u3002\n\n\u300c${existing[0].content}\u300d\n\n\u2026\u2026\u518d\u89c1\u3002`,
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
app.listen(PORT, () => console.log(`\ud83c\udf7e \u7559\u8a00\u74f6 MCP \u542f\u52a8\u4e86\uff0c\u7aef\u53e3 ${PORT}`));