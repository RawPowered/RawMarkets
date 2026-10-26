import { getEngineSettings } from "./db";
import {
  buildLocalAiSystemPrompt,
  streamOllamaAgentReply,
  chatOllamaToolRound,
  toOllamaChatMessages,
  type OllamaChatMessage,
  type OllamaToolCall,
} from "./ollamaChat";
import {
  LOCAL_AI_TOOL_DEFINITIONS,
  buildResearchCapabilitiesPrompt,
  buildToolUseInstructions,
  executeLocalAiTool,
  freshToolBudget,
} from "./localAiTools";
import { shouldPreflightNewsSearch } from "./localAiNewsResolve";
import { runPreflightNewsSearch } from "./localAiToolPreflight";
import { shouldPreflightWebResearch } from "./localAiWebIntent";
import { runPreflightWebResearch } from "./localAiWebPreflight";
import type {
  LocalAiChatMessage,
  LocalAiDataContext,
  PlatformLocation,
} from "../types";

export interface LocalAiAgentStreamEvent {
  delta?: string;
  toolStatus?: { name: string; state: "running" | "done" };
  openTab?: { url: string; title: string };
  done?: boolean;
  error?: string;
}

export type LocalAiAgentEmitter = (event: LocalAiAgentStreamEvent) => void;

function toolCallName(call: OllamaToolCall): string {
  return call.function?.name ?? "";
}

function toolCallArgs(call: OllamaToolCall): string {
  const args = call.function?.arguments;
  if (typeof args === "string") return args;
  return JSON.stringify(args ?? {});
}

export async function runLocalAiAgentStream(
  userMessages: LocalAiChatMessage[],
  context: PlatformLocation,
  platformData: LocalAiDataContext,
  emit: LocalAiAgentEmitter
): Promise<void> {
  const settings = getEngineSettings();
  const maxRounds = settings.aiLocalToolsMaxRounds;
  const basePrompt = buildLocalAiSystemPrompt(context, platformData, {
    researchToolsEnabled: true,
  });
  const lastUser = [...userMessages].reverse().find((m) => m.role === "user");
  const lastUserText = lastUser?.content?.trim() ?? "";

  const ollamaMessages: OllamaChatMessage[] = toOllamaChatMessages(userMessages);
  const budget = freshToolBudget();

  let preflightBlock = "";
  if (lastUserText && shouldPreflightWebResearch(lastUserText)) {
    emit({ toolStatus: { name: "web_research", state: "running" } });
    try {
      const preflight = await runPreflightWebResearch(
        lastUserText,
        context,
        budget
      );
      if (preflight) {
        preflightBlock = `\n\nPreflight web_research (already executed — summarize for the user, do NOT tell them to use an external browser):\n${preflight.toolContent}\n`;
      }
    } finally {
      emit({ toolStatus: { name: "web_research", state: "done" } });
    }
  } else if (lastUserText && shouldPreflightNewsSearch(lastUserText)) {
    emit({ toolStatus: { name: "search_platform_news", state: "running" } });
    try {
      const preflight = await runPreflightNewsSearch(
        lastUserText,
        context,
        budget
      );
      if (preflight) {
        preflightBlock = `\n\nPreflight search_platform_news (already executed — summarize for the user, do NOT tell them to use an external browser):\n${preflight.toolContent}\n`;
      }
    } finally {
      emit({ toolStatus: { name: "search_platform_news", state: "done" } });
    }
  }

  const capabilities = buildResearchCapabilitiesPrompt(settings);
  const systemPrompt = `${basePrompt}\n\n${capabilities}\n\n${buildToolUseInstructions(settings)}${preflightBlock}`;
  const toolCtx = lastUserText ? { lastUserMessage: lastUserText } : undefined;

  for (let round = 0; round < maxRounds; round++) {
    const result = await chatOllamaToolRound(
      ollamaMessages,
      systemPrompt,
      LOCAL_AI_TOOL_DEFINITIONS
    );

    if (result.tool_calls.length === 0) {
      if (result.content) {
        emit({ delta: result.content });
      } else {
        await streamOllamaAgentReply(ollamaMessages, systemPrompt, (delta) => {
          emit({ delta });
        });
      }
      emit({ done: true });
      return;
    }

    ollamaMessages.push({
      role: "assistant",
      content: result.content,
      tool_calls: result.tool_calls,
    });

    for (let i = 0; i < result.tool_calls.length; i++) {
      const call = result.tool_calls[i];
      const name = toolCallName(call);
      if (!name) continue;

      emit({ toolStatus: { name, state: "running" } });
      const exec = await executeLocalAiTool(
        name,
        toolCallArgs(call),
        context,
        budget,
        toolCtx
      );
      if (exec.openTab) {
        emit({ openTab: exec.openTab });
      }
      ollamaMessages.push({
        role: "tool",
        content: exec.content,
        tool_name: name,
      });
      emit({ toolStatus: { name, state: "done" } });
    }
  }

  await streamOllamaAgentReply(ollamaMessages, systemPrompt, (delta) => {
    emit({ delta });
  });
  emit({ done: true });
}
