// メモサーバーの中身。トランスポートには触れない。
//
// 保存先は環境変数 MEMO_FILE で差し替えられる
// （既定はこのファイルと同じ場所の memo.jsonl）。

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { appendFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FILE = process.env.MEMO_FILE
	?? join(dirname(fileURLToPath(import.meta.url)), 'memo.jsonl');

// 1 行 1 件の JSON。壊れた行は読み飛ばす
async function load() {
	try {
		const text = await readFile(FILE, 'utf8');
		return text.split('\n')
			.filter((line) => line.trim())
			.map((line) => { try { return JSON.parse(line); } catch { return null; } })
			.filter(Boolean);
	} catch (err) {
		if (err.code === 'ENOENT') return [];
		throw err;
	}
}

export function createMemoServer() {
	const server = new McpServer({ name: 'memo', version: '1.0.0' });

	server.registerTool(
		'memo_add',
		{
			title: 'メモを足す',
			description: 'メモを 1 件記録する',
			inputSchema: {
				text: z.string().min(1).describe('記録する内容'),
				tags: z.array(z.string()).optional().describe('分類のための札'),
			},
		},
		async ({ text, tags }) => {
			const entry = { at: new Date().toISOString(), text, tags: tags ?? [] };
			await appendFile(FILE, JSON.stringify(entry) + '\n', 'utf8');
			return { content: [{ type: 'text', text: `記録した: ${entry.at}` }] };
		},
	);

	server.registerTool(
		'memo_search',
		{
			title: 'メモを探す',
			description: '本文か札に語を含むメモを探す',
			inputSchema: {
				query: z.string().describe('探す語'),
				limit: z.number().int().min(1).max(50).default(10).describe('返す件数の上限'),
			},
		},
		async ({ query, limit }) => {
			const all = await load();
			const q = query.toLowerCase();
			const hit = all.filter((m) =>
				m.text.toLowerCase().includes(q) || m.tags.some((t) => t.toLowerCase().includes(q)));

			if (hit.length === 0) {
				return { content: [{ type: 'text', text: `「${query}」を含むメモはありません` }] };
			}

			// 新しいものから返す
			const lines = hit.slice(-limit).reverse()
				.map((m) => `${m.at} ${m.text}${m.tags.length ? ` [${m.tags.join(' ')}]` : ''}`);
			return {
				content: [{ type: 'text', text: `${hit.length} 件のうち ${lines.length} 件\n${lines.join('\n')}` }],
			};
		},
	);

	server.registerResource(
		'memo-all',
		'memo://all',
		{
			title: 'すべてのメモ',
			description: '記録してあるメモをすべて読む',
			mimeType: 'text/plain',
		},
		async (uri) => {
			const all = await load();
			return {
				contents: [{
					uri: uri.href,
					text: all.length === 0
						? 'まだメモはありません'
						: all.map((m) => `${m.at} ${m.text}`).join('\n'),
				}],
			};
		},
	);

	return server;
}
