import { create } from 'zustand';
import { chatAdapter, type ChatMessage } from '@/adapters/chat';
import { getBot } from '@/bots/roster';
import { uid } from '@/lib/ids';
import { readJson, writeJson } from '@/store/persist';
import { useActivityStore } from '@/store/activityStore';

const KEY = 'chat';

type Threads = Record<string, ChatMessage[]>;

function load(): Threads {
  return readJson<Threads>(KEY, {});
}

interface ChatState {
  threads: Threads;
  streaming: Record<string, boolean>;
  send: (botId: string, text: string) => Promise<void>;
}

function save(threads: Threads) {
  writeJson(KEY, threads);
}

export const useChatStore = create<ChatState>((set, get) => ({
  threads: load(),
  streaming: {},
  send: async (botId, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const bot = getBot(botId);
    const userMsg: ChatMessage = {
      id: uid('msg'),
      role: 'user',
      botId,
      text: trimmed,
      createdAt: Date.now(),
    };
    const assistantId = uid('msg');
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      botId,
      text: '',
      createdAt: Date.now(),
    };
    const prev = get().threads[botId] ?? [];
    let nextThreads: Threads = {
      ...get().threads,
      [botId]: [...prev, userMsg, assistantMsg],
    };
    save(nextThreads);
    set({ threads: nextThreads, streaming: { ...get().streaming, [botId]: true } });
    useActivityStore.getState().push({
      botId,
      kind: 'message',
      text: `${bot?.name ?? botId} received a command`,
    });

    try {
      let acc = '';
      for await (const token of chatAdapter.streamReply({
        botId,
        botName: bot?.name ?? botId,
        messages: prev.concat(userMsg),
        userText: trimmed,
      })) {
        acc += token;
        nextThreads = {
          ...get().threads,
          [botId]: (get().threads[botId] ?? []).map((m) =>
            m.id === assistantId ? { ...m, text: acc } : m,
          ),
        };
        set({ threads: nextThreads });
      }
      save(get().threads);
      useActivityStore.getState().push({
        botId,
        kind: 'message',
        text: `${bot?.name ?? botId} finished a mock stream`,
      });
    } finally {
      const streaming = { ...get().streaming };
      delete streaming[botId];
      set({ streaming });
    }
  },
}));
