// 02-minimal と同じサーバーを SDK で書いたもの。
// JSON-RPC の組み立て・initialize の応答・エラー形式は SDK が受け持つ。

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
	name: 'sdk',
	version: '1.0.0',
});

server.registerTool(
	'add',
	{
		title: '足し算',
		description: '2 つの数を足す',
		// 入力の形は zod で書く。JSON Schema には SDK が変換して送る
		inputSchema: {
			a: z.number().describe('1 つめの数'),
			b: z.number().describe('2 つめの数'),
		},
	},
	async ({ a, b }) => ({
		content: [{ type: 'text', text: String(a + b) }],
	}),
);

// stdio に繋ぐ。ここで初めて標準入出力を読み書きし始める
await server.connect(new StdioServerTransport());
