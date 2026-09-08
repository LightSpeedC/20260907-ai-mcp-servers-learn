// MCP サーバー（C# 版）
//
// 02-minimal/server.mjs と同じことをする。
// csc.exe（.NET Framework 同梱）だけでビルドでき、単一の exe になる。
//
//   csc /nologo /optimize /out:mcp-server.exe /r:System.Web.Extensions.dll Server.cs

using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

class Program
{
	static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
	static StreamWriter _out;

	static void Main()
	{
		// BOM を付けない UTF-8 にする。BOM を出すと相手が JSON として読めない
		var utf8 = new UTF8Encoding(false);
		var input = new StreamReader(Console.OpenStandardInput(), utf8);
		_out = new StreamWriter(Console.OpenStandardOutput(), utf8);
		_out.AutoFlush = true;

		Log("起動した");

		string line;
		while ((line = input.ReadLine()) != null)
		{
			if (line.Trim().Length == 0) continue;
			Log("受信: " + line);

			Dictionary<string, object> request;
			try
			{
				request = (Dictionary<string, object>)Json.DeserializeObject(line);
			}
			catch
			{
				Log("JSON として読めなかった行を捨てた");
				continue;
			}

			// id が無いものは通知。応答してはいけない
			if (!request.ContainsKey("id"))
			{
				Log("通知: " + Get(request, "method"));
				continue;
			}

			Handle(request);
		}
	}

	// stdout は JSON-RPC 専用。ログは stderr へ出す
	static void Log(string message)
	{
		Console.Error.WriteLine("[csharp] " + message);
	}

	// 1 メッセージ 1 行。末尾の改行が区切りになる
	static void Send(object message)
	{
		_out.Write(Json.Serialize(message));
		_out.Write("\n");
	}

	static void Reply(object id, object result)
	{
		Send(new Dictionary<string, object> {
			{ "jsonrpc", "2.0" }, { "id", id }, { "result", result }
		});
	}

	static void ReplyError(object id, int code, string message)
	{
		Send(new Dictionary<string, object> {
			{ "jsonrpc", "2.0" }, { "id", id },
			{ "error", new Dictionary<string, object> { { "code", code }, { "message", message } } }
		});
	}

	static string Get(Dictionary<string, object> d, string key)
	{
		object v;
		return d.TryGetValue(key, out v) && v != null ? v.ToString() : null;
	}

	static Dictionary<string, object> GetMap(Dictionary<string, object> d, string key)
	{
		object v;
		if (d != null && d.TryGetValue(key, out v)) return v as Dictionary<string, object>;
		return null;
	}

	// このサーバーが提供するツールは 1 つだけ
	static object Tools()
	{
		return new object[] {
			new Dictionary<string, object> {
				{ "name", "add" },
				{ "description", "2 つの数を足す" },
				{ "inputSchema", new Dictionary<string, object> {
					{ "type", "object" },
					{ "properties", new Dictionary<string, object> {
						{ "a", new Dictionary<string, object> { { "type", "number" }, { "description", "1 つめの数" } } },
						{ "b", new Dictionary<string, object> { { "type", "number" }, { "description", "2 つめの数" } } }
					} },
					{ "required", new object[] { "a", "b" } }
				} }
			}
		};
	}

	static void Handle(Dictionary<string, object> request)
	{
		object id = request["id"];
		string method = Get(request, "method");
		var pars = GetMap(request, "params");

		switch (method)
		{
			case "initialize":
				{
					// 相手が送ってきたバージョンをそのまま返す
					string version = pars != null ? Get(pars, "protocolVersion") : null;
					Reply(id, new Dictionary<string, object> {
						{ "protocolVersion", version ?? "2025-06-18" },
						{ "capabilities", new Dictionary<string, object> {
							{ "tools", new Dictionary<string, object>() } } },
						{ "serverInfo", new Dictionary<string, object> {
							{ "name", "csharp" }, { "version", "1.0.0" } } }
					});
					return;
				}

			case "tools/list":
				Reply(id, new Dictionary<string, object> { { "tools", Tools() } });
				return;

			case "tools/call":
				{
					string name = pars != null ? Get(pars, "name") : null;
					if (name != "add")
					{
						ReplyError(id, -32602, "unknown tool: " + name);
						return;
					}

					var args = GetMap(pars, "arguments");
					double a, b;
					if (!TryNumber(args, "a", out a) || !TryNumber(args, "b", out b))
					{
						// 引数が不正なときは、プロトコルのエラーではなく結果として返す
						Reply(id, new Dictionary<string, object> {
							{ "content", new object[] { new Dictionary<string, object> {
								{ "type", "text" }, { "text", "a と b には数値を渡してください" } } } },
							{ "isError", true }
						});
						return;
					}

					double sum = a + b;
					// 整数なら小数点を付けずに返す
					string text = sum == Math.Floor(sum)
						? ((long)sum).ToString()
						: sum.ToString(System.Globalization.CultureInfo.InvariantCulture);

					Reply(id, new Dictionary<string, object> {
						{ "content", new object[] { new Dictionary<string, object> {
							{ "type", "text" }, { "text", text } } } }
					});
					return;
				}

			default:
				ReplyError(id, -32601, "method not found: " + method);
				return;
		}
	}

	static bool TryNumber(Dictionary<string, object> d, string key, out double value)
	{
		value = 0;
		object v;
		if (d == null || !d.TryGetValue(key, out v) || v == null) return false;
		if (v is string) return false;
		try
		{
			value = Convert.ToDouble(v, System.Globalization.CultureInfo.InvariantCulture);
			return true;
		}
		catch { return false; }
	}
}
