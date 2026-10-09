// 08 章「通知で結果を伝える」。
// 進捗通知が届くこと、elicitation で答えを受け取れること、
// 相手が能力を名乗っていなければ尋ねられないことを確かめる。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { connect, sample, textOf } from './helpers/client.ts';

test('progressToken を渡すと進捗が届く', async () => {
	const client = await connect(sample('08-notify/server.mjs'));
	const seen = [];

	try {
		const result = await client.callTool(
			{ name: 'countdown', arguments: { seconds: 2 } },
			undefined,
			// onprogress を渡すと SDK が progressToken を付けてくれる
			{ onprogress: (p) => seen.push(p) },
		);

		assert.equal(seen.length, 2);
		assert.equal(seen[0].progress, 1);
		assert.equal(seen[0].total, 2);
		assert.match(textOf(result), /進捗を 2 回送った/);
	} finally {
		await client.close();
	}
});

test('progressToken が無ければ進捗は送られない', async () => {
	const client = await connect(sample('08-notify/server.mjs'));

	try {
		// onprogress を渡さないので progressToken が付かない
		const result = await client.callTool({ name: 'countdown', arguments: { seconds: 1 } });
		assert.match(textOf(result), /progressToken が無いので/);
	} finally {
		await client.close();
	}
});

test('elicitation に答えると、その内容がサーバーへ渡る', async () => {
	const client = await connect(sample('08-notify/server.mjs'), {
		// 尋ねられる用意があることを名乗る
		capabilities: { elicitation: {} },
	});

	// サーバーからの問いかけに答える役
	client.setRequestHandler(ElicitRequestSchema, async (request) => {
		assert.match(request.params.message, /お名前/);
		return { action: 'accept', content: { name: '山田' } };
	});

	try {
		const result = await client.callTool({ name: 'ask_name', arguments: {} });
		assert.equal(textOf(result), 'こんにちは、山田 さん');
	} finally {
		await client.close();
	}
});

test('断られたときは、断られたと分かる', async () => {
	const client = await connect(sample('08-notify/server.mjs'), {
		capabilities: { elicitation: {} },
	});

	client.setRequestHandler(ElicitRequestSchema, async () => ({ action: 'decline' }));

	try {
		const result = await client.callTool({ name: 'ask_name', arguments: {} });
		assert.match(textOf(result), /decline/);
	} finally {
		await client.close();
	}
});

test('elicitation を名乗っていない相手には尋ねられない', async () => {
	// capabilities を空にする
	const client = await connect(sample('08-notify/server.mjs'));

	try {
		const result = await client.callTool({ name: 'ask_name', arguments: {} });
		assert.equal(result.isError, true);
		assert.match(textOf(result), /尋ねられなかった/);
	} finally {
		await client.close();
	}
});
