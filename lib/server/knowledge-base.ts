import { supabaseRequest } from '@/lib/supabase/rest';

import type { KnowledgeBaseEntry } from './types';

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ''))
    .filter((word) => word.length > 2);
}

export async function searchKnowledgeBase(query: string) {
  const queryWords = tokenize(query);
  if (queryWords.length === 0) return null;

  const entries = await supabaseRequest<KnowledgeBaseEntry[]>('knowledge_base_entries', {
    query: {
      select: 'id,title,body',
      is_active: 'eq.true',
      limit: 50,
    },
  });

  const match = entries.find((entry) => {
    const entryWords = tokenize(`${entry.title} ${entry.body}`);
    const matches = queryWords.filter((word) =>
      entryWords.some((entryWord) => entryWord.includes(word) || word.includes(entryWord))
    );

    return matches.length >= Math.min(2, queryWords.length);
  });

  if (!match) return null;

  return {
    id: match.id,
    title: match.title,
    answer: match.body.length > 150 ? `${match.body.slice(0, 150)}...` : match.body,
  };
}
