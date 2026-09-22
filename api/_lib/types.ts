export type BridgeRole = 'user' | 'assistant' | 'system';
export type BridgeStatus = 'queued' | 'sent' | 'partial' | 'final' | 'error';

export interface BridgeMessage {
  id: string;
  role: BridgeRole;
  botId: string;
  text: string;
  clientMsgId?: string;
  createdAt: number;
  status: BridgeStatus;
}

export type Req = {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

export type Res = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => Res;
  json: (body: unknown) => void;
  end: () => void;
};
