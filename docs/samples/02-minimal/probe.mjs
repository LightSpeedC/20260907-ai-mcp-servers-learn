// ホストが何を送ってくるかを観測するサーバー
//
// 受け取った行と返した行をそのままファイルに書き出す。
// 中身は 02-minimal/server.mjs と同じで、記録が増えているだけ。
//
// 記録先は環境変数 MCP_PROBE_LOG で指定する（既定はこのファイルと同じ場所の probe.log）。

import { createInterface } from 'node:readline';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const LOG = process.env.MCP_PROBE_LOG
	?? join(dirname(fileURLToPath(import.meta.url)), 'probe.log');

function record(direction, text) {
	const stamp = new Date().toISOString();
	appendFileSync(LOG, `${stamp} ${direction} ${text}\n`, 'utf8');
}

function send(message) {
	const text = JSON.stringify(message);
	record('<--', text);
	process.stdout.write(text + '\n');
}

const TOOLS = [
	{
		name: 'add',
		description: '2 つの数を足す',
		inputSchema: {
			type: 'object',
			properties: {
				a: { type: 'number' },
				b: { type: 'number' },
			},
			required: ['a', 'b'],
		},
	},
];

function handle(request) {
	const { id, method, params } = request;

	// initialize と server/discover は、仕様のリビジョンによって名前が違う。
	// どちらで来ても答えられるようにしておくと、相手が何を喋るか分かる
	if (method === 'initialize' || method === 'server/discover') {
		return send({
			jsonrpc: '2.0',
			id,
			result: {
				protocolVersion: params?.protocolVersion ?? '2025-06-18',
				capabilities: { tools: {} },
				serverInfo: { name: 'probe', version: '1.0.0' },
			},
		});
	}

	if (method === 'tools/list') {
		return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
	}

	if (method === 'tools/call') {
		const { a, b } = params?.arguments ?? {};
		return send({
			jsonrpc: '2.0',
			id,
			result: { content: [{ type: 'text', text: String(Number(a) + Number(b)) }] },
		});
	}

	// 知らないメソッドはエラーで返す。何を訊かれたかは記録に残る
	send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
}

const rl = createInterface({ input: process.stdin });

record('***', `起動 pid=${process.pid}`);

rl.on('line', (line) => {
	if (!line.trim()) return;
	record('-->', line);

	let request;
	try {
		request = JSON.parse(line);
	} catch {
		record('!!!', 'JSON として読めなかった');
		return;
	}

	if (request.id === undefined) return;
	handle(request);
});

rl.on('close', () => record('***', '入力が閉じた'));
