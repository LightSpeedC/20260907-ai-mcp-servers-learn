// 長い処理をタスクとして受け、あとから結果を取りに来てもらう
//
// 2025-11-25 で入った仕組み。SDK では experimental 扱い。
// ホスト側が tasks に対応していないと、この道は使われない（普通の呼び出しになる）。

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { InMemoryTaskStore } from '@modelcontextprotocol/sdk/experimental/tasks/stores/in-memory.js';
import { z } from 'zod';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// タスクの状態をどこに置くか。ここでは記憶の中（再起動で消える）
const taskStore = new InMemoryTaskStore();

const server = new McpServer(
	{ name: 'tasks', version: '1.0.0' },
	{
		taskStore,
		// タスクに対応していることを名乗る。これを書かないとホストは task を付けてこない
		capabilities: {
			tasks: {
				list: {},
				cancel: {},
				requests: { tools: { call: {} } },
			},
		},
	},
);

server.experimental.tasks.registerToolTask(
	'long_job',
	{
		title: '長い処理',
		description: '指定した秒数だけかかる処理。タスクとして実行できる',
		inputSchema: { seconds: z.number().int().min(1).max(60).default(5) },
		// optional: ホストが選べる。required にすると必ずタスクになる
		execution: { taskSupport: 'optional' },
	},
	{
		// 受け付けた時点で呼ばれる。すぐ返し、処理は裏で進める
		createTask: async ({ seconds }, extra) => {
			const task = await extra.taskStore.createTask({ ttl: 300000 });

			(async () => {
				await sleep(seconds * 1000);
				await extra.taskStore.storeTaskResult(task.taskId, 'completed', {
					content: [{ type: 'text', text: `${seconds} 秒の処理が終わった` }],
				});
			})();

			return { task };
		},

		// tasks/get で呼ばれる。今どうなっているかを返す
		getTask: async (_args, extra) => extra.taskStore.getTask(extra.taskId),

		// tasks/result で呼ばれる。終わっていなければ SDK が待たせる
		getTaskResult: async (_args, extra) => extra.taskStore.getTaskResult(extra.taskId),
	},
);

const transport = new StdioServerTransport();

// タスクの控えは TTL のタイマーを抱えている。
// 片付けないと、ホストが切れてもプロセスが終わらない
transport.onclose = () => {
	taskStore.cleanup();
	process.exit(0);
};

await server.connect(transport);
