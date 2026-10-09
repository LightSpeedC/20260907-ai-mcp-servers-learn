// テスト用の MCP クライアント。
//
// サンプルのサーバーを子プロセスとして起こし、SDK のクライアントで繋ぐ。
// 手で JSON-RPC を流し込むのと違い、応答を待って順に確かめられる。

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ClientCapabilities } from '@modelcontextprotocol/sdk/types.js';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** リポジトリの root */
export const ROOT = resolve(HERE, '../..');

/** サンプルのパスを組み立てる（例: sample('06-memo/server.mjs')） */
export function sample(relative: string): string {
	return join(ROOT, 'docs/samples', relative);
}

/** 出力先。テストが作るファイルはすべてここに置く（Git 管理外） */
export function tmp(name: string): string {
	return join(ROOT, 'tmp', name);
}

export interface ConnectOptions {
	/** 追加で渡す環境変数 */
	env?: Record<string, string>;
	/** サーバーに渡す起動引数（--port 等） */
	args?: string[];
	/** クライアントが名乗る能力 */
	capabilities?: ClientCapabilities;
	/** 起動する実行ファイル（既定は node） */
	command?: string;
}

/**
 * stdio のサーバーに繋いだクライアントを返す。
 *
 * @param serverPath サーバーの .mjs のパス（command を渡した場合は使わない）
 */
export async function connect(serverPath: string, options: ConnectOptions = {}): Promise<Client> {
	// exe を直接起動する場合はスクリプトのパスが要らない
	const command = options.command ?? process.execPath;
	const args = [...(options.command ? [] : [serverPath]), ...(options.args ?? [])];

	const transport = new StdioClientTransport({
		command,
		args,
		// 環境変数を渡さないと既定の PATH すら無くなる
		env: { ...process.env, ...(options.env ?? {}) } as Record<string, string>,
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

/**
 * HTTP のメモサーバー（07 章）を起こし、応答できるようになるまで待つ。
 * ポートは環境変数ではなく --port で渡す（tasklist で見分けられるように）
 */
export async function startHttpMemo(port: number, memoFile: string): Promise<ChildProcess> {
	const child = spawn(process.execPath, [sample('07-http/server.mjs'), '--port', String(port)], {
		env: { ...process.env, MEMO_FILE: memoFile },
		stdio: 'ignore',
	});

	for (let i = 0; i < 40; i++) {
		try {
			await fetch(`http://localhost:${port}/mcp`, { method: 'POST' });
			return child;
		} catch {
			await new Promise((r) => setTimeout(r, 250));
		}
	}
	child.kill();
	throw new Error('HTTP のサーバーが起動しなかった');
}

/** ツールを呼んで、返ってきた文字列だけを取り出す */
export function textOf(result: { content?: unknown }): string {
	return ((result.content ?? []) as { type: string; text?: string }[])
		.filter((c) => c.type === 'text')
		.map((c) => c.text ?? '')
		.join('\n');
}
