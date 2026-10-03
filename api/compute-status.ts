/**
 * Vercel serverless function — returns the agent's Virtuals compute balance.
 * Runs `acp compute status --json` server-side and returns the result.
 * Falls back to a static JSON file if acp is not available.
 */
export default async function handler(req: any, res: any) {
  // CORS — allow the command-center frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    // Try to run acp compute status --json
    const { execSync } = require('child_process');
    const raw = execSync('acp compute status --json', {
      timeout: 10000,
      encoding: 'utf-8',
      cwd: '/tmp',
    });
    const d = JSON.parse(raw);
    res.status(200).json({
      limit: d.limit ?? 0,
      remaining: d.limitRemaining ?? d.limit ?? 0,
      totalUsage: d.usage ?? 0,
      updated: new Date().toISOString(),
    });
  } catch {
    // Fallback: return a static placeholder if acp is not available on Vercel
    res.status(200).json({
      limit: 0,
      remaining: 0,
      totalUsage: 0,
      updated: new Date().toISOString(),
      note: 'acp not available on this server. Use the static JSON file updated by the cron job.',
    });
  }
}
