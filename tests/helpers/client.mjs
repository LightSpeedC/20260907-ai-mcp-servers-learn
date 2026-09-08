// テスト用の MCP クライアント。
//
// サンプルのサーバーを子プロセスとして起こし、SDK のクライアントで繋ぐ。
// 手で JSON-RPC を流し込むのと違い、応答を待って順に確かめられる。

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** リポジトリの root */
export const ROOT = resolve(HERE, '../..');

/** サンプルのパスを組み立てる（例: sample('06-memo/server.mjs')） */
export function sample(relative) {
	return join(ROOT, 'docs/samples', relative);
}

/** 出力先。テストが作るファイルはすべてここに置く（Git 管理外） */
export function tmp(name) {
	return join(ROOT, 'tmp', name);
}

/**
 * stdio のサーバーに繋いだクライアントを返す。
 *
 * @param {string} serverPath サーバーの .mjs のパス（command を渡した場合は引数として使う）
 * @param {object} [options]
 * @param {Record<string,string>} [options.env] 追加で渡す環境変数
 * @param {object} [options.capabilities] クライアントが名乗る能力
 * @param {string} [options.command] 起動する実行ファイル（既定は node）
 */
export async function connect(serverPath, options = {}) {
	// exe を直接起動する場合は引数が要らない
	const command = options.command ?? process.execPath;
	const args = options.command ? [] : [serverPath];

	const transport = new StdioClientTransport({
		command,
		args,
		// 環境変数を渡さないと既定の PATH すら無くなる
		env: { ...process.env, ...(options.env ?? {}) },
		// サーバーの stderr はテストの出力に混ぜない
		stderr: 'ignore',
	});

	const client = new Client(
		{ name: 'tests', version: '1.0.0' },
		{ capabilities: options.capabilities ?? {} },
	);

	await client.connect(transport);
	return client;
}

/** ツールを呼んで、返ってきた文字列だけを取り出す */
export function textOf(result) {
	return (result.content ?? [])
		.filter((c) => c.type === 'text')
		.map((c) => c.text)
		.join('\n');
}
