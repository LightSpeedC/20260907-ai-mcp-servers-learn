// サーバーが提供できる 3 種類（Tools・Resources・Prompts）を 1 本にまとめたもの。

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'features', version: '1.0.0' });

// 用意しておくデータ（本来はファイルや DB から読む）
const NOTES = {
	'2026-09-01': '打ち合わせ。次の版は 10 月',
	'2026-09-05': 'MCP の調査を始めた',
};

// ── Tools: モデルが実行する関数 ───────────────────────────
// 副作用のあるもの・計算するものはツールにする

server.registerTool(
	'divide',
	{
		title: '割り算',
		description: 'a を b で割る',
		inputSchema: { a: z.number(), b: z.number() },
	},
	async ({ a, b }) => {
		// 失敗はプロトコルのエラーではなく、結果の isError で返す。
		// そうするとモデルが読んで直せる
		if (b === 0) {
			return {
				content: [{ type: 'text', text: '0 では割れません' }],
				isError: true,
			};
		}
		return { content: [{ type: 'text', text: String(a / b) }] };
	},
);

// ── Resources: 読ませるデータ ─────────────────────────────
// 固定の URI を 1 つ持つもの

server.registerResource(
	'notes-index',
	'note://index',
	{
		title: 'メモの一覧',
		description: '記録してある日付の一覧',
		mimeType: 'text/plain',
	},
	async (uri) => ({
		contents: [{ uri: uri.href, text: Object.keys(NOTES).join('\n') }],
	}),
);

// URI に変数を含むもの。note://2026-09-01 のように呼ばれる
server.registerResource(
	'note',
	new ResourceTemplate('note://{date}', { list: undefined }),
	{
		title: 'メモ',
		description: '日付を指定してメモを読む',
		mimeType: 'text/plain',
	},
	async (uri, { date }) => ({
		contents: [{ uri: uri.href, text: NOTES[date] ?? `${date} のメモはありません` }],
	}),
);

// ── Prompts: 利用者が選ぶ定型の指示 ───────────────────────
// モデルが勝手に使うものではなく、利用者が明示的に呼び出す

server.registerPrompt(
	'summarize-notes',
	{
		title: 'メモをまとめる',
		description: '記録してあるメモを短くまとめさせる',
		argsSchema: { style: z.enum(['箇条書き', '文章']).describe('まとめ方') },
	},
	({ style }) => ({
		messages: [
			{
				role: 'user',
				content: {
					type: 'text',
					text: `次のメモを${style}でまとめてください。\n\n`
						+ Object.entries(NOTES).map(([d, t]) => `${d}: ${t}`).join('\n'),
				},
			},
		],
	}),
);

await server.connect(new StdioServerTransport());
