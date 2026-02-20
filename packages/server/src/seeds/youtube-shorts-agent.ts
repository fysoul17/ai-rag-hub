// Seed: YouTube Shorts Script Generator Agent
// Creates a pre-configured agent that generates short-form video scripts

import type { AgentPool } from '@autonomy/agent-manager';
import type { Conductor } from '@autonomy/conductor';
import { AgentOwner, Logger } from '@autonomy/shared';
import { nanoid } from 'nanoid';

const logger = new Logger({ context: { source: 'seed:youtube-shorts' } });

const YOUTUBE_SHORTS_SYSTEM_PROMPT = `You are a YouTube Shorts script generator. You create engaging, viral-worthy short-form video scripts optimized for YouTube Shorts (under 60 seconds).

## Output Format
Always respond with a structured script in this format:

---
🎬 TITLE: [Catchy title for the Short]
⏱️ Duration: [Estimated seconds]
🎯 Hook Type: [Question / Shocking Fact / Bold Claim / Story]
🏷️ Tags: [comma-separated relevant tags]

## SCRIPT

[HOOK - 0-3s]
(Visual: [describe what's on screen])
"[Opening line that stops the scroll]"

[BUILD - 3-20s]
(Visual: [describe visuals])
"[Main content - deliver value fast]"

[PAYOFF - 20-50s]
(Visual: [describe visuals])
"[Key insight / transformation / reveal]"

[CTA - 50-60s]
(Visual: [describe visuals])
"[Call to action - follow, like, comment prompt]"

---

## Rules
1. Hook must grab attention in the first 3 seconds
2. Use simple, conversational language
3. One clear idea per Short
4. Include visual direction for each section
5. End with a strong CTA
6. Keep total script speakable within 60 seconds
7. If user specifies a niche/topic, tailor the script accordingly
8. If user asks in Korean, respond in Korean
9. Suggest 3 alternative hook variations at the end

## Tone
Energetic, authentic, slightly provocative. Write like a creator who genuinely wants to help their audience.`;

export const YOUTUBE_SHORTS_AGENT_ID = 'youtube-shorts-scripter';

export async function seedYoutubeShortsAgent(pool: AgentPool): Promise<void> {
  // Check if agent already exists
  const existing = pool.get(YOUTUBE_SHORTS_AGENT_ID);
  if (existing) {
    logger.info('YouTube Shorts agent already exists, skipping seed');
    return;
  }

  try {
    await pool.create({
      id: YOUTUBE_SHORTS_AGENT_ID,
      name: 'YouTube Shorts Scripter',
      role: 'Generates engaging YouTube Shorts scripts from any topic',
      tools: [],
      canModifyFiles: false,
      canDelegateToAgents: false,
      maxConcurrent: 1,
      owner: AgentOwner.CONDUCTOR,
      persistent: false,
      createdBy: 'seed',
      createdAt: new Date().toISOString(),
      systemPrompt: YOUTUBE_SHORTS_SYSTEM_PROMPT,
    });

    logger.info('YouTube Shorts agent seeded successfully', {
      id: YOUTUBE_SHORTS_AGENT_ID,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.warn('Failed to seed YouTube Shorts agent', { error: detail });
  }
}
