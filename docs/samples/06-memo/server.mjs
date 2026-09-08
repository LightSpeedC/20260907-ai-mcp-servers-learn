// ハンズオン① メモサーバー（stdio 版）
//
// 中身は memo-tools.mjs にある。ここはトランスポートに繋ぐだけ。

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMemoServer } from './memo-tools.mjs';

await createMemoServer().connect(new StdioServerTransport());
