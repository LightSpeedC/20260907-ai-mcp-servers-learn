// 09 章「Tasks」。長い処理を投げて、あとから結果を取りに行く道筋を確かめる。
// この機能は 2025-11-25 で入ったもので、SDK では experimental 扱い。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { connect, sample } from './helpers/client.mjs';

const TASK_CAPS = {
	tasks: { list: {}, cancel: {}, requests: { tools: { call: {} } } },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** タスクを作って taskId を受け取る */
async function createTask(client, args) {
	const stream = client.experimental.tasks.callToolStream({
		name: 'long_job',
		arguments: args,
		task: { ttl: 60000 },
	});

	for await (const message of stream) {
		if (message.type === 'result') return message.result.task;
	}
	throw new Error('タスクが作られなかった');
}

test('ツールがタスク対応を名乗る（execution.taskSupport）', async () => {
	const client = await connect(sample('09-tasks/server.mjs'), { capabilities: TASK_CAPS });

	try {
		const { tools } = await client.listTools();
		const tool = tools.find((t) => t.name === 'long_job');
		// optional なので、タスクとしても普通の呼び出しとしても使える
		assert.equal(tool.execution?.taskSupport, 'optional');
	} finally {
		await client.close();
	}
});

test('タスクは working で返り、待たずに次へ進める', async () => {
	const client = await connect(sample('09-tasks/server.mjs'), { capabilities: TASK_CAPS });

	try {
		const started = Date.now();
		const task = await createTask(client, { seconds: 3 });

		assert.ok(task.taskId, 'taskId が返ること');
		assert.equal(task.status, 'working');
		// 3 秒の処理なのに、すぐ返ってきている
		assert.ok(Date.now() - started < 2000, '処理の終了を待たずに返ること');
	} finally {
		await client.close();
	}
});

test('tasks/get で状態を見て、completed になったら tasks/result で取る', async () => {
	const client = await connect(sample('09-tasks/server.mjs'), { capabilities: TASK_CAPS });

	try {
		const task = await createTask(client, { seconds: 2 });

		// 仕様どおり、pollInterval に従って状態を見に行く
		let state;
		for (let i = 0; i < 20; i++) {
			state = await client.experimental.tasks.getTask(task.taskId);
			if (state.status !== 'working') break;
			await sleep(state.pollInterval ?? 500);
		}
		assert.equal(state.status, 'completed');

		// 終わってから結果を取りに行く
		const result = await client.request(
			{ method: 'tasks/result', params: { taskId: task.taskId } },
			CallToolResultSchema,
		);
		assert.match(result.content[0].text, /2 秒の処理が終わった/);
	} finally {
		await client.close();
	}
});

test('タスクにしないで呼ぶこともできる（optional のため）', async () => {
	const client = await connect(sample('09-tasks/server.mjs'), { capabilities: TASK_CAPS });

	try {
		const result = await client.callTool({ name: 'long_job', arguments: { seconds: 1 } });
		assert.match(result.content[0].text, /1 秒の処理が終わった/);
	} finally {
		await client.close();
	}
});
