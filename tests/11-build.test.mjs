// 11 章「ビルド実行サーバー」。
// 決めたコマンドだけを実行し、それ以外は断ることを確かめる。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connect, sample, textOf } from './helpers/client.mjs';

test('実行できるコマンドの一覧を読める', async () => {
	const client = await connect(sample('11-build/server.mjs'));

	try {
		const res = await client.readResource({ uri: 'build://commands' });
		assert.match(res.contents[0].text, /version: Node\.js の版を表示する/);
	} finally {
		await client.close();
	}
});

test('決めたコマンドは実行でき、終了コードが 0 なら成功と返る', async () => {
	const client = await connect(sample('11-build/server.mjs'));

	try {
		const result = await client.callTool({ name: 'build_run', arguments: { name: 'version' } });
		assert.equal(result.isError, false);
		assert.match(textOf(result), /成功（終了コード 0/);
		// node --version の出力が入っている
		assert.match(textOf(result), /v\d+\.\d+\.\d+/);
	} finally {
		await client.close();
	}
});

test('一覧に無いものは実行せずに断る', async () => {
	const client = await connect(sample('11-build/server.mjs'));

	try {
		// 名前として渡されても、そのまま起動したりはしない
		const result = await client.callTool({
			name: 'build_run',
			arguments: { name: 'rm -rf /' },
		});
		assert.equal(result.isError, true);
		assert.match(textOf(result), /実行できません/);
	} finally {
		await client.close();
	}
});

test('進捗通知が出力の行ごとに届く', async () => {
	const client = await connect(sample('11-build/server.mjs'));
	const progress = [];

	try {
		await client.callTool(
			{ name: 'build_run', arguments: { name: 'slow' } },
			undefined,
			{ onprogress: (p) => progress.push(p) },
		);

		// 1 秒ごとに 1 行出るコマンドなので 3 回来る
		assert.equal(progress.length, 3);
		assert.equal(progress[0].message, '1');
		assert.equal(progress[2].message, '3');
	} finally {
		await client.close();
	}
});
