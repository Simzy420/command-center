/**
 * Wan Animate submit helpers: pad driving clips and pick frame size from the
 * motion video so portrait templates are not crushed into 832×480.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import {
  DEFAULT_ANIMATE_ENDPOINT_ID,
  runpodApiKey,
  runpodEndpointId,
} from './account.ts';

function ffmpegBin() {
  return (typeof ffmpegStatic === 'string' && ffmpegStatic) || 'ffmpeg';
}

function ffprobeBin() {
  const path = (ffprobeStatic as { path?: string } | string | null) &&
    typeof ffprobeStatic === 'object' &&
    ffprobeStatic &&
    'path' in ffprobeStatic
    ? ffprobeStatic.path
    : null;
  return path || 'ffprobe';
}

export const DEFAULT_NEGATIVE =
  'blurry, low quality, distorted, random prop, wrong object, microphone, bottle, cup, dark cylinder near face, handheld object unless described in the prompt';

type EnvMap = Record<string, string | undefined>;
type FetchLike = typeof fetch;

function even(n: number) {
  const v = Math.max(2, Math.round(n));
  return v % 2 === 0 ? v : v + 1;
}

function mult16(n: number) {
  return Math.max(16, Math.round(n / 16) * 16);
}

export function chooseAnimateSize(videoWidth: number, videoHeight: number) {
  const w = Math.max(2, videoWidth || 832);
  const h = Math.max(2, videoHeight || 480);
  const portrait = h >= w;
  if (portrait) {
    // Keep portrait. Cap long edge near 832 so VRAM stays reasonable.
    const long = Math.min(832, mult16(h));
    const short = mult16(Math.round((long * w) / h));
    return { width: short, height: long, portrait: true };
  }
  const long = Math.min(832, mult16(w));
  const short = mult16(Math.round((long * h) / w));
  return { width: long, height: short, portrait: false };
}

export function headroomPadFilter(
  videoWidth: number,
  videoHeight: number,
  topFrac = 0.28,
  /** ffmpeg color, e.g. 0x66BB6A for Mixkit green-screen templates */
  color = '0x66BB6A',
) {
  const w = even(videoWidth);
  const h = even(videoHeight);
  const padTop = even(Math.round(h * topFrac));
  const outH = h + padTop;
  return `pad=${w}:${outH}:0:${padTop}:color=${color}`;
}

async function runCmd(bin: string, args: string[], timeoutMs = 120000) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${bin} timed out`));
    }, timeoutMs);
    child.stderr.on('data', (chunk) => {
      err += String(chunk);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(err.trim().split('\n').slice(-4).join(' ') || `${bin} exited ${code}`));
    });
  });
}

export async function probeVideoSize(filePath: string) {
  const args = [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-of',
    'json',
    filePath,
  ];
  const out = await new Promise<string>((resolve, reject) => {
    const child = spawn(ffprobeBin(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => {
      stdout += String(c);
    });
    child.stderr.on('data', (c) => {
      stderr += String(c);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || 'ffprobe failed'));
    });
  });
  const json = JSON.parse(out) as { streams?: { width?: number; height?: number }[] };
  const stream = json.streams?.[0];
  const width = Number(stream?.width || 0);
  const height = Number(stream?.height || 0);
  if (width < 2 || height < 2) throw new Error('Could not read motion video size.');
  return { width, height };
}

/** Download a public template clip, add top headroom, return mp4 bytes + size. */
export async function prepareMotionVideo(
  videoUrl: string,
  deps: { fetch?: FetchLike; ffmpegBin?: string; topFrac?: number } = {},
) {
  const fetchImpl = deps.fetch || fetch;
  const res = await fetchImpl(videoUrl);
  if (!res.ok) throw new Error(`Could not download motion clip (HTTP ${res.status}).`);
  const inputBytes = Buffer.from(await res.arrayBuffer());
  if (!inputBytes.length) throw new Error('Motion clip was empty.');

  const dir = await mkdtemp(join(tmpdir(), 'swapr-motion-'));
  const inputPath = join(dir, 'in.bin');
  const paddedPath = join(dir, 'padded.mp4');
  try {
    await writeFile(inputPath, inputBytes);
    const size = await probeVideoSize(inputPath);
    const filter = headroomPadFilter(size.width, size.height, deps.topFrac ?? 0.28);
    const ffmpeg = deps.ffmpegBin || ffmpegBin();
    await runCmd(ffmpeg, [
      '-y',
      '-i',
      inputPath,
      '-vf',
      filter,
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      paddedPath,
    ]);
    const padded = await readFile(paddedPath);
    const paddedSize = await probeVideoSize(paddedPath);
    return { bytes: padded, ...paddedSize, source: size };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export function buildAnimateInput(fields: {
  image_base64: string;
  video_base64: string;
  prompt?: string;
  negative?: string;
  seed?: number;
  width: number;
  height: number;
}) {
  if (!fields.image_base64) throw new Error('The still photo was empty.');
  if (!fields.video_base64) throw new Error('The motion clip was empty.');
  const seed = Number.isFinite(Number(fields.seed))
    ? Math.max(0, Math.floor(Number(fields.seed)))
    : Math.floor(Math.random() * 1_000_000_000);
  return {
    image_base64: fields.image_base64,
    video_base64: fields.video_base64,
    prompt: String(fields.prompt || 'a person, natural motion, cinematic, high quality').slice(0, 2000),
    negative_prompt: String(fields.negative || DEFAULT_NEGATIVE).slice(0, 1000),
    seed,
    width: mult16(fields.width),
    height: mult16(fields.height),
    fps: 16,
    cfg: 1,
    steps: 6,
    mode: 'replace',
  };
}

export async function startAnimateJob(
  env: EnvMap,
  input: Record<string, unknown>,
  deps: { fetch?: FetchLike } = {},
) {
  const apiKey = runpodApiKey(env);
  const endpointId = runpodEndpointId(env) || DEFAULT_ANIMATE_ENDPOINT_ID;
  if (!apiKey) {
    throw Object.assign(new Error('RUNPOD_API_KEY is not set on this host.'), { statusCode: 500 });
  }
  const fetchImpl = deps.fetch || fetch;
  const res = await fetchImpl(`https://api.runpod.ai/v2/${encodeURIComponent(endpointId)}/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
  });
  const text = await res.text();
  let json: { id?: string; status?: string; error?: string } | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    throw Object.assign(new Error(json?.error || text || `Runpod HTTP ${res.status}`), {
      statusCode: res.status,
    });
  }
  if (!json?.id) throw new Error('Runpod did not return a job id.');
  return { job_id: json.id, phase: 'queued' as const, endpointId };
}
