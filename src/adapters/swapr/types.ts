export type SwaprTemplate = {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  duration_s?: number;
  video_url?: string;
  video_path?: string;
  video?: string;
};

export type SwaprJobPhase = 'queued' | 'running' | 'done' | 'error';

export type SwaprGenerateResult = {
  job_id?: string;
  phase?: SwaprJobPhase | string;
  video?: string;
  url?: string;
  status?: string;
  error?: string;
  session_id?: string | null;
};
