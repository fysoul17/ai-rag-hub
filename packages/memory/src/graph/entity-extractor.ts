import type { EntityExtractionResult } from './types.ts';

export type LLMEntityExtractor = (text: string) => Promise<EntityExtractionResult>;

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_RE = /https?:\/\/[^\s,)>"']+/g;
const CAPITALIZED_RE = /\b[A-Z][a-zA-Z]{1,}(?:\s[A-Z][a-zA-Z]{1,})*\b/g;
const RELATION_RE = /\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)\s+(?:is|has|uses|owns|manages|creates|runs|depends on)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)\b/g;

const STOP_WORDS = new Set([
  'The', 'This', 'That', 'These', 'Those', 'Here', 'There',
  'When', 'Where', 'What', 'Which', 'Who', 'How',
  'But', 'And', 'For', 'Not', 'You', 'All', 'Can',
  'Her', 'Was', 'One', 'Our', 'Out', 'Are', 'Has',
  'His', 'Its', 'Let', 'May', 'New', 'Now', 'Old',
  'See', 'Way', 'Day', 'Did', 'Get', 'Got', 'Had',
  'Him', 'How', 'Man', 'Say', 'She', 'Too', 'Use',
]);

export function extractEntities(text: string): EntityExtractionResult {
  const entities: Array<{ name: string; type: string }> = [];
  const relations: Array<{ source: string; target: string; type: string }> = [];
  const seen = new Set<string>();

  // Extract emails
  for (const match of text.matchAll(EMAIL_RE)) {
    const email = match[0];
    if (!seen.has(email)) {
      seen.add(email);
      entities.push({ name: email, type: 'EMAIL' });
    }
  }

  // Extract URLs
  for (const match of text.matchAll(URL_RE)) {
    const url = match[0];
    if (!seen.has(url)) {
      seen.add(url);
      entities.push({ name: url, type: 'URL' });
    }
  }

  // Extract capitalized phrases (potential named entities)
  for (const match of text.matchAll(CAPITALIZED_RE)) {
    const name = match[0];
    if (!seen.has(name) && !STOP_WORDS.has(name)) {
      seen.add(name);
      entities.push({ name, type: 'ENTITY' });
    }
  }

  // Extract relations from "X is/has/uses Y" patterns
  for (const match of text.matchAll(RELATION_RE)) {
    const source = match[1];
    const target = match[2];
    if (source && target && !STOP_WORDS.has(source) && !STOP_WORDS.has(target)) {
      // Determine relation type from the verb
      const fullMatch = match[0];
      let relType = 'RELATED_TO';
      if (fullMatch.includes(' is ')) relType = 'IS';
      else if (fullMatch.includes(' has ')) relType = 'HAS';
      else if (fullMatch.includes(' uses ')) relType = 'USES';
      else if (fullMatch.includes(' owns ')) relType = 'OWNS';
      else if (fullMatch.includes(' manages ')) relType = 'MANAGES';
      else if (fullMatch.includes(' creates ')) relType = 'CREATES';
      else if (fullMatch.includes(' runs ')) relType = 'RUNS';
      else if (fullMatch.includes(' depends on ')) relType = 'DEPENDS_ON';

      relations.push({ source, target, type: relType });
    }
  }

  return { entities, relations };
}

export function createEntityExtractor(llmCallback?: LLMEntityExtractor) {
  return async (text: string): Promise<EntityExtractionResult> => {
    if (llmCallback) {
      return llmCallback(text);
    }
    return extractEntities(text);
  };
}
