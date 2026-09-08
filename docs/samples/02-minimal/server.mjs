// 最小の MCP サーバー（SDK を使わず、JSON-RPC を手で組み立てる）
//
// ホストが何を送ってくるかを見るために、受け取った行をすべて stderr に出す。
// stdout には JSON-RPC のメッセージ以外を書いてはいけない。

import { createInterface } from 'node:readline';

// stdout は JSON-RPC 専用。ログは stderr へ出す
function log(...args) {
	console.error('[minimal]', ...args);
}

// 1 メッセージ 1 行。末尾の改行が区切りになる
function send(message) {
	process.stdout.write(JSON.stringify(message) + '\n');
}

function reply(id, result) {
	send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message) {
	send({ jsonrpc: '2.0', id, error: { code, message } });
}

// このサーバーが提供するツールは 1 つだけ
const TOOLS = [
	{
		name: 'add',
		description: '2 つの数を足す',
		inputSchema: {
			type: 'object',
			properties: {
				a: { type: 'number', description: '1 つめの数' },
				b: { type: 'number', description: '2 つめの数' },
			},
			required: ['a', 'b'],
		},
	},
];

function handle(request) {
	const { id, method, params } = request;

	switch (method) {
		// ホストが最初に送ってくる。名乗り合いをする
		case 'initialize':
			return reply(id, {
				// 相手が送ってきたバージョンをそのまま返す。合わせられない場合は自分の対応版を返す
				protocolVersion: params?.protocolVersion ?? '2025-06-18',
				capabilities: { tools: {} },
				serverInfo: { name: 'minimal', version: '1.0.0' },
			});

		// 提供するツールの一覧を返す
		case 'tools/list':
			return reply(id, { tools: TOOLS });

		// ツールを実行する
		case 'tools/call': {
			if (params?.name !== 'add') {
				return replyError(id, -32602, `unknown tool: ${params?.name}`);
			}
			const { a, b } = params.arguments ?? {};
			if (typeof a !== 'number' || typeof b !== 'number') {
				// 引数が不正なときは、プロトコルのエラーではなく結果として返す
				return reply(id, {
					content: [{ type: 'text', text: 'a と b には数値を渡してください' }],
					isError: true,
				});
			}
			return reply(id, {
				content: [{ type: 'text', text: String(a + b) }],
			});
		}

		default:
			return replyError(id, -32601, `method not found: ${method}`);
	}
}

const rl = createInterface({ input: process.stdin });

rl.on('line', (line) => {
	if (!line.trim()) return;

	log('受信:', line);

	let request;
	try {
		request = JSON.parse(line);
	} catch {
		log('JSON として読めなかった行を捨てた');
		return;
	}

	// id が無いものは通知。応答してはいけない
	if (request.id === undefined) {
		log('通知:', request.method);
		return;
	}

	try {
		handle(request);
	} catch (err) {
		replyError(request.id, -32603, String(err));
	}
});

log('起動した');
