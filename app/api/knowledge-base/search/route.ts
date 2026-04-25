import { searchKnowledgeBase } from '@/lib/server/knowledge-base';
import { jsonError, jsonOk, readJson } from '@/lib/server/http';
import { knowledgeBaseSearchSchema } from '@/lib/server/schemas';

export async function POST(request: Request) {
  try {
    const body = await readJson(request, knowledgeBaseSearchSchema);
    const match = await searchKnowledgeBase(body.query);

    return jsonOk({
      match,
    });
  } catch (error) {
    return jsonError(error);
  }
}
