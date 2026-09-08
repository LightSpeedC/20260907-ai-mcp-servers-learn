// ハンズオン② ビルド実行サーバー
//
// 決めておいたコマンドだけを実行し、進み具合を知らせ、終わったら画面にも出す。
// 07〜10 章で扱ったものを 1 つにまとめたもの。
//
//   BUILD_COMMANDS  実行してよいコマンドを書いた JSON（既定 ./commands.json）
//   BUILD_CWD       コマンドを動かす場所（既定 リポジトリの root）
//   BUILD_TOAST     1 なら終了時にトーストを出す（既定 0）

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));

const COMMANDS_FILE = process.env.BUILD_COMMANDS ?? join(HERE, 'commands.json');
const CWD = process.env.BUILD_CWD ?? resolve(HERE, '../../..');
const TOAST = process.env.BUILD_TOAST === '1';

// 名前で引ける形にしておく。ここに無いものは実行しない
const commands = JSON.parse(await readFile(COMMANDS_FILE, 'utf8'));

/**
 * コマンドを実行し、出力を溜めて返す。
 * 1 行出るたびに onLine を呼ぶので、進捗として流せる。
 */
function run(spec, onLine) {
	return new Promise((resolve) => {
		// シェルを通さない。文字列を組み立てて渡すと、
		// 引数に仕込まれた記号がそのまま命令になる
		const child = spawn(spec.command, spec.args, { cwd: CWD, shell: false });

		const out = [];
		let lines = 0;

		const pick = (chunk) => {
			const text = chunk.toString();
			out.push(text);
			for (const line of text.split('\n')) {
				if (line.trim()) onLine(++lines, line.trim());
			}
		};

		child.stdout.on('data', pick);
		child.stderr.on('data', pick);

		child.on('error', (err) => resolve({ code: -1, output: `起動できなかった: ${err.message}` }));
		child.on('close', (code) => resolve({ code, output: out.join('') }));
	});
}

async function toast(title, message) {
	if (!TOAST) return;
	try {
		await execFileAsync('powershell', [
			'-NoProfile', '-ExecutionPolicy', 'Bypass',
			'-File', join(HERE, '../08-notify/toast.ps1'),
			'-Title', title, '-Message', message,
		]);
	} catch {
		// 知らせられなくても本題は済んでいる。落とさない
	}
}

const server = new McpServer({ name: 'build', version: '1.0.0' });

server.registerResource(
	'commands',
	'build://commands',
	{
		title: '実行できるコマンド',
		description: '名前と説明の一覧',
		mimeType: 'text/plain',
	},
	async (uri) => ({
		contents: [{
			uri: uri.href,
			text: Object.entries(commands)
				.map(([name, c]) => `${name}: ${c.description}`)
				.join('\n'),
		}],
	}),
);

server.registerTool(
	'build_run',
	{
		title: 'コマンドを実行する',
		description: '決めておいたコマンドを名前で指定して実行する',
		inputSchema: {
			name: z.string().describe('commands.json に書いてある名前'),
		},
		annotations: {
			// 読むだけではないこと・元に戻せないことをホストに伝える
			readOnlyHint: false,
			destructiveHint: false,
		},
	},
	async ({ name }, extra) => {
		const spec = commands[name];
		if (!spec) {
			return {
				content: [{
					type: 'text',
					text: `${name} は実行できません。使えるのは ${Object.keys(commands).join(' / ')} です`,
				}],
				isError: true,
			};
		}

		const token = extra._meta?.progressToken;
		const started = Date.now();

		const { code, output } = await run(spec, (n, line) => {
			if (token === undefined) return;
			// 総数が分からないので total は付けない
			extra.sendNotification({
				method: 'notifications/progress',
				params: { progressToken: token, progress: n, message: line.slice(0, 80) },
			}).catch(() => { /* 送れなくても本題は続ける */ });
		});

		const seconds = ((Date.now() - started) / 1000).toFixed(1);
		const ok = code === 0;

		await toast(ok ? `${name} 成功` : `${name} 失敗`, `${seconds} 秒 / 終了コード ${code}`);

		// 出力が長いと会話を埋めてしまう。末尾だけ返す
		const tail = output.split('\n').slice(-30).join('\n');

		return {
			content: [{
				type: 'text',
				text: `${ok ? '成功' : '失敗'}（終了コード ${code}、${seconds} 秒）\n\n${tail}`,
			}],
			isError: !ok,
		};
	},
);

await server.connect(new StdioServerTransport());
