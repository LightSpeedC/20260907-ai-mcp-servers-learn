// メモサーバーの Streamable HTTP 版
//
// 中身（memo-tools.mjs）は stdio 版とまったく同じ。繋ぎ先だけが違う。
// 待ち受けポートは環境変数 PORT で変えられる（既定 3333）。

import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMemoServer } from '../06-memo/memo-tools.mjs';

const PORT = Number(process.env.PORT ?? 3333);

const http = createServer(async (req, res) => {
	// MCP のエンドポイントは 1 つ。ここに POST が来る
	if (!req.url?.startsWith('/mcp')) {
		res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
		res.end('/mcp へ POST してください\n');
		return;
	}

	// セッションを持たない形（sessionIdGenerator を undefined にする）。
	// リクエストごとに使い捨てるので、状態はファイル側に持たせる
	const server = createMemoServer();
	const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

	// 応答が終わったら片付ける。閉じ忘れると接続が溜まる
	res.on('close', () => {
		transport.close();
		server.close();
	});

	try {
		await server.connect(transport);
		await transport.handleRequest(req, res);
	} catch (err) {
		console.error('[http] 失敗:', err);
		if (!res.headersSent) {
			res.writeHead(500, { 'content-type': 'application/json' });
			res.end(JSON.stringify({
				jsonrpc: '2.0',
				error: { code: -32603, message: 'Internal server error' },
				id: null,
			}));
		}
	}
});

http.listen(PORT, () => {
	// stdio 版と違い、標準出力に書いても壊れない
	console.log(`メモサーバー（HTTP）: http://localhost:${PORT}/mcp`);
});
