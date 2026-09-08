// 処理の結果を伝える 3 つの手立て
//
//   1. 進捗通知   処理している間だけ送れる
//   2. elicitation  利用者に尋ねて答えを受け取る
//   3. OS の通知   MCP の外側。人に確実に気づかせる

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = new McpServer({ name: 'notify', version: '1.0.0' });

// ── 1. 進捗通知 ───────────────────────────────────────────
// ホストが _meta.progressToken を付けてきたときだけ送れる。
// 付いていないのに送ると、宛先の無い通知になる

server.registerTool(
	'countdown',
	{
		title: '数える',
		description: '指定した秒数を数え、その間に進捗を知らせる',
		inputSchema: { seconds: z.number().int().min(1).max(10).default(3) },
	},
	async ({ seconds }, extra) => {
		const token = extra._meta?.progressToken;

		for (let i = 1; i <= seconds; i++) {
			await sleep(1000);
			if (token === undefined) continue;
			await extra.sendNotification({
				method: 'notifications/progress',
				params: { progressToken: token, progress: i, total: seconds, message: `${i}/${seconds} 秒` },
			});
		}

		return {
			content: [{
				type: 'text',
				text: token === undefined
					? `${seconds} 秒数えた（progressToken が無いので進捗は送っていない）`
					: `${seconds} 秒数えた（進捗を ${seconds} 回送った）`,
			}],
		};
	},
);

// ── 2. elicitation ────────────────────────────────────────
// サーバーからクライアントへリクエストを送る。
// クライアントが elicitation の能力を宣言しているときだけ使える

server.registerTool(
	'ask_name',
	{
		title: '名前を尋ねる',
		description: '利用者に名前を尋ね、その名前で挨拶する',
		inputSchema: {},
	},
	async (_args, extra) => {
		try {
			const answer = await extra.sendRequest(
				{
					method: 'elicitation/create',
					params: {
						mode: 'form',
						message: 'お名前を教えてください',
						requestedSchema: {
							type: 'object',
							properties: { name: { type: 'string', title: '名前' } },
							required: ['name'],
						},
					},
				},
				z.object({ action: z.string(), content: z.record(z.string(), z.unknown()).optional() }),
			);

			if (answer.action !== 'accept') {
				return { content: [{ type: 'text', text: `尋ねたが ${answer.action} だった` }] };
			}
			return { content: [{ type: 'text', text: `こんにちは、${answer.content?.name} さん` }] };
		} catch (err) {
			// 能力が無いクライアントではここに来る
			return {
				content: [{ type: 'text', text: `尋ねられなかった: ${err.message}` }],
				isError: true,
			};
		}
	},
);

// ── 3. OS の通知 ──────────────────────────────────────────
// MCP の枠の外。会話に出るかどうかはホスト任せだが、これは人に必ず届く

server.registerTool(
	'toast',
	{
		title: '画面に知らせる',
		description: 'Windows のトースト通知を出す',
		inputSchema: {
			title: z.string().default('MCP'),
			message: z.string().describe('知らせる内容'),
		},
	},
	async ({ title, message }) => {
		try {
			// WinRT の型を使うため Windows PowerShell 5.1 を呼ぶ（pwsh 7 では動かない）
			const { stdout } = await execFileAsync('powershell', [
				'-NoProfile', '-ExecutionPolicy', 'Bypass',
				'-File', join(HERE, 'toast.ps1'),
				'-Title', title, '-Message', message,
			]);
			return { content: [{ type: 'text', text: stdout.trim() }] };
		} catch (err) {
			return { content: [{ type: 'text', text: `通知を出せなかった: ${err.message}` }], isError: true };
		}
	},
);

await server.connect(new StdioServerTransport());
