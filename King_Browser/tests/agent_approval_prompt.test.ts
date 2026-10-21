import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describeAgentAction } from '../src/components/AgentApprovalPrompt';
import { orchestrator } from '../src/services/agentOrchestrator';

console.log('\n--- Agent Approval Prompt Suite ---');

async function run() {
  // 1. The card summary is short and names the target.
  assert.equal(describeAgentAction('browser_read_page', {}), 'read page');
  assert.equal(describeAgentAction('browser_click', { selector: '#buy' }), 'click: #buy');
  assert.equal(describeAgentAction('browser_navigate', { url: 'https://example.com' }), 'navigate: https://example.com');
  assert.equal(describeAgentAction('browser_type', 'not-an-object'), 'type');
  const long = describeAgentAction('browser_type', { selector: '', text: 'x'.repeat(500) });
  assert.ok(long.length <= 'type: '.length + 121, 'long details are capped');
  assert.ok(long.endsWith('…'), 'capped details show an ellipsis');
  console.log('[PASS] [ApprovalPrompt] action summaries are short and specific');

  // 2. Approving a pending action resolves its wait with true; denying with false.
  const approved = orchestrator.enqueueAction('browser_click', { selector: '#a' }, false, true);
  assert.equal(orchestrator.getQueue().find(a => a.id === approved.id)?.state, 'pending');
  orchestrator.approveAction(approved.id);
  assert.equal(await approved.done, true, 'approve resolves the pending action');
  const denied = orchestrator.enqueueAction('browser_click', { selector: '#b' }, false, true);
  orchestrator.denyAction(denied.id);
  assert.equal(await denied.done, false, 'deny resolves the pending action as false');
  console.log('[PASS] [ApprovalPrompt] approve/deny resolve pending actions');

  // 3. Regression: pending actions must be answerable from the UI. Before this
  // fix no component called approveAction(), so they always timed out.
  const component = fs.readFileSync('src/components/AgentApprovalPrompt.tsx', 'utf8');
  assert.match(component, /orchestrator\.approveAction\(/, 'the card approves through the orchestrator');
  assert.match(component, /orchestrator\.denyAction\(/, 'the card denies through the orchestrator');
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  assert.match(app, /<AgentApprovalPrompt\s*\/>/, 'App mounts the approval card');
  console.log('[PASS] [ApprovalPrompt] the approval card is wired into the app');
}

run().then(
  () => {},
  (error) => {
    console.error('[FAIL] Agent Approval Prompt suite:', error);
    process.exitCode = 1;
  }
);
