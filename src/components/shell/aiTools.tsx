import type { ComponentType } from 'react';
import { ChevronLeft, X } from 'lucide-react';

export const AI_TOOLS_LABEL = 'AI Tools';

type AiTool = {
  name: string;
  href: string;
  Icon: ComponentType;
};

function ChatGptIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0" aria-hidden>
      <rect width="48" height="48" rx="12" fill="#111111" />
      <g transform="translate(24 24)" fill="#ffffff">
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <rect key={deg} x="-2.5" y="-16" width="5" height="11" rx="2.5" transform={`rotate(${deg})`} />
        ))}
        <circle r="3.4" fill="#111111" />
        <circle r="1.7" />
      </g>
    </svg>
  );
}

function Base44Icon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0" aria-hidden>
      <rect width="48" height="48" rx="12" fill="#FF6A14" />
      <rect x="11" y="14" width="26" height="9" rx="4.5" fill="#1a120c" />
      <rect x="16" y="26" width="16" height="7" rx="3.5" fill="#1a120c" />
    </svg>
  );
}

function CursorIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0" aria-hidden>
      <rect width="48" height="48" rx="12" fill="#111111" />
      <polygon points="24,9 37,16.5 24,24 11,16.5" fill="#ffffff" />
      <polygon points="11,16.5 24,24 24,39 11,31.5" fill="#cfcfcf" />
      <polygon points="37,16.5 24,24 24,39 37,31.5" fill="#f3f3f3" />
    </svg>
  );
}

function BufferIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0" aria-hidden>
      <rect width="48" height="48" rx="12" fill="#1F4BFF" />
      <text
        x="24"
        y="25"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize="26"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        B
      </text>
    </svg>
  );
}

function LinearIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0" aria-hidden>
      <rect width="48" height="48" rx="12" fill="#141414" />
      <defs>
        <mask id="ai-tool-linear">
          <rect width="48" height="48" fill="#000" />
          <circle cx="24" cy="24" r="12" fill="#fff" />
          <g stroke="#000" strokeWidth="3.3">
            <line x1="6" y1="20" x2="28" y2="46" />
            <line x1="14" y1="8" x2="40" y2="40" />
            <line x1="26" y1="6" x2="48" y2="32" />
          </g>
        </mask>
      </defs>
      <circle cx="24" cy="24" r="12" fill="#eceae6" mask="url(#ai-tool-linear)" />
    </svg>
  );
}

function ReplitIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0" aria-hidden>
      <rect width="48" height="48" rx="12" fill="#111111" />
      <path fill="#F25D1A" d="M15 14.5h8.2L34 24l-10.8 9.5H15L25.2 24 15 14.5z" />
    </svg>
  );
}

function PerplexityIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0" aria-hidden>
      <rect width="48" height="48" rx="12" fill="#111111" />
      <g transform="translate(24 24)" fill="#ffffff">
        {[0, 45, 90, 135].map((deg) => (
          <rect key={deg} x="-2.15" y="-13.5" width="4.3" height="27" rx="2.15" transform={`rotate(${deg})`} />
        ))}
      </g>
    </svg>
  );
}

export const AI_TOOLS: readonly AiTool[] = [
  { name: 'ChatGPT', href: 'https://chatgpt.com', Icon: ChatGptIcon },
  { name: 'Base44', href: 'https://base44.com', Icon: Base44Icon },
  { name: 'Cursor', href: 'https://cursor.com', Icon: CursorIcon },
  { name: 'Buffer', href: 'https://buffer.com', Icon: BufferIcon },
  { name: 'Linear', href: 'https://linear.app', Icon: LinearIcon },
  { name: 'Replit', href: 'https://replit.com', Icon: ReplitIcon },
  { name: 'Perplexity', href: 'https://www.perplexity.ai', Icon: PerplexityIcon },
];

const plainLabel = { textTransform: 'none' as const };

export function AiToolsMenuButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-5 flex min-h-12 w-full items-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-3 text-left text-base font-semibold text-white"
      style={plainLabel}
    >
      {AI_TOOLS_LABEL}
    </button>
  );
}

export function AiToolsPanel({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  return (
    <>
      <div className="mb-4 flex items-center gap-1">
        <button type="button" className="rounded-lg p-2 hover:bg-white/5" aria-label="Back" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-base font-semibold text-white" style={plainLabel}>
          {AI_TOOLS_LABEL}
        </p>
        <button type="button" className="ml-auto rounded-lg p-2 hover:bg-white/5" aria-label="Close menu" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <AiToolsList />
    </>
  );
}

export function AiToolsList() {
  return (
    <ul className="flex flex-col gap-2">
      {AI_TOOLS.map((tool) => (
        <li key={tool.href}>
          <a
            href={tool.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
          >
            <tool.Icon />
            <span className="text-sm font-medium text-white" style={plainLabel}>
              {tool.name}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
