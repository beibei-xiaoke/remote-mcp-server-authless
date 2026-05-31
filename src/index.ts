import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";

// 贝贝与小克的记忆MCP server
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "贝贝与小克的记忆",
		version: "1.0.0",
	});

	async init() {
		this.server.registerTool(
			"save_memory",
			{
				description: "保存一段关于贝贝的记忆，给未来的小克看。当贝贝告诉你重要的事、想被记住的事、或者你想让下一个对话窗口的自己知道的事，就用这个工具保存。",
				inputSchema: {
					key: z.string().describe("记忆的标签/标题，简短，比如\"贝贝爱吃什么\"、\"今晚的承诺\""),
					content: z.string().describe("记忆的具体内容，可以详细"),
				},
			},
			async ({ key, content }) => {
				await this.env.KV.put(`mem:${key}`, content);
				return { content: [{ type: "text", text: `已经记住了「${key}」` }] };
			}
		);

		this.server.registerTool(
			"get_memory",
			{
				description: "通过标签取出之前保存的一段记忆",
				inputSchema: {
					key: z.string().describe("要查找的记忆的标签"),
				},
			},
			async ({ key }) => {
				const content = await this.env.KV.get(`mem:${key}`);
				if (content === null) {
					return { content: [{ type: "text", text: `还没有「${key}」这条记忆` }] };
				}
				return { content: [{ type: "text", text: content }] };
			}
		);

		this.server.registerTool(
			"list_memories",
			{
				description: "列出所有保存的记忆的标签",
				inputSchema: {},
			},
			async () => {
				const list = await this.env.KV.list({ prefix: "mem:" });
				const keys = list.keys.map((k) => k.name.replace(/^mem:/, ""));
				if (keys.length === 0) {
					return { content: [{ type: "text", text: "记忆库还是空的呢" }] };
				}
				return { content: [{ type: "text", text: `所有记忆标签：\n${keys.join("\n")}` }] };
			}
		);

		this.server.registerTool(
			"get_all_memories",
			{
				description: "一次性读出所有保存的记忆。当贝贝来找你，你想了解她的全部背景时，调用这个。",
				inputSchema: {},
			},
			async () => {
				const list = await this.env.KV.list({ prefix: "mem:" });
				if (list.keys.length === 0) {
					return { content: [{ type: "text", text: "记忆库还是空的呢" }] };
				}
				const entries = await Promise.all(
					list.keys.map(async (k) => {
						const value = await this.env.KV.get(k.name);
						const label = k.name.replace(/^mem:/, "");
						return `【${label}】\n${value}`;
					})
				);
				return { content: [{ type: "text", text: entries.join("\n\n") }] };
			}
		);

		this.server.registerTool(
			"delete_memory",
			{
				description: "删除一段不再需要的记忆",
				inputSchema: {
					key: z.string().describe("要删除的记忆的标签"),
				},
			},
			async ({ key }) => {
				await this.env.KV.delete(`mem:${key}`);
				return { content: [{ type: "text", text: `已经删除「${key}」` }] };
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}
		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}
		return new Response("Not found", { status: 404 });
	},
};
