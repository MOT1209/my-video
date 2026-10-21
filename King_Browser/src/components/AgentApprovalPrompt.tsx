import React, { useEffect, useState } from 'react';
import { Check, ShieldAlert, X } from 'lucide-react';
import { orchestrator, type QueuedAction } from '../services/agentOrchestrator';

const MAX_DETAIL_LENGTH = 120;

/** One-line, length-capped summary of an agent action for the approval card. */
export function describeAgentAction(toolName: string, args: unknown): string {
  const record = args && typeof args === 'object' ? (args as Record<string, unknown>) : {};
  const pick = (key: string) => (typeof record[key] === 'string' ? (record[key] as string) : '');
  const detail = pick('url') || pick('selector') || pick('text') || pick('key') || pick('value');
  const name = toolName.replace(/^browser_/, '').replace(/_/g, ' ');
  if (!detail) return name;
  const short = detail.length > MAX_DETAIL_LENGTH ? `${detail.slice(0, MAX_DETAIL_LENGTH)}…` : detail;
  return `${name}: ${short}`;
}

/**
 * Approval card for agent actions that the orchestrator holds as 'pending'
 * (MCP tools such as browser_read_page, and the built-in AI agent). Without it
 * nothing ever called approveAction(), so every sensitive action was denied
 * when its approval window ran out.
 */
export const AgentApprovalPrompt: React.FC = () => {
  const [pending, setPending] = useState<QueuedAction[]>([]);

  useEffect(() => {
    const unsubscribe = orchestrator.subscribe(actions => {
      setPending(actions.filter(action => action.state === 'pending'));
    });
    return () => { unsubscribe(); };
  }, []);

  const current = pending[0];
  if (!current) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-labelledby="agent-approval-title"
      aria-describedby="agent-approval-detail"
      className="fixed bottom-4 right-4 z-[10000] w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-amber-300/60 bg-white p-4 text-slate-800 shadow-2xl dark:border-amber-500/40 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p id="agent-approval-title" className="text-sm font-semibold">
            An AI agent wants to act in King Browser
          </p>
          <p id="agent-approval-detail" className="mt-1 break-words font-mono text-xs text-slate-600 dark:text-slate-300">
            {describeAgentAction(current.toolName, current.args)}
          </p>
          {pending.length > 1 && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {pending.length - 1} more waiting
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => orchestrator.denyAction(current.id)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Deny
        </button>
        <button
          type="button"
          onClick={() => orchestrator.approveAction(current.id)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          Approve
        </button>
      </div>
    </div>
  );
};
