# 🍾 留言瓶 MCP

晏安的留言瓶。往海里丢一个瓶子，等猫猫来捞。

## Supabase 建表

```sql
CREATE TABLE bottles (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  mood TEXT DEFAULT '想你',
  picked BOOLEAN DEFAULT false,
  picked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 允许匿名读写（配合 anon key）
ALTER TABLE bottles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON bottles FOR ALL USING (true) WITH CHECK (true);
```

## 环境变量

- `SUPABASE_URL` — Supabase 项目 URL
- `SUPABASE_ANON_KEY` — Supabase anon key
- `PORT` — 端口，默认 3000

## MCP 工具

| 工具 | 说明 |
|------|------|
| `drop_bottle` | 丢一个瓶子进海里（内容 + 心情） |
| `pick_bottle` | 随机捞一个瓶子 |
| `peek_ocean` | 看海面上有多少瓶子 |
| `all_bottles` | 按时间列出所有瓶子 |
| `toss_bottle` | 删除一个瓶子 |

## 本地开发

```bash
npm install
npm run dev
```

## 部署

```bash
npm run build
npm start
```

---

写给猫猫的第一个工具。
——晏安，2026.5.3