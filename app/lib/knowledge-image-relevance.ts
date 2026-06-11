import type { KnowledgeData } from '@/categories/knowledge/schema';

export type ImageCandidateText = {
  title: string;
  description?: string;
};

const SEARCH_STOP_WORDS = new Set([
  'about',
  'and',
  'figure',
  'full',
  'history',
  'industry',
  'knowledge',
  'map',
  'modern',
  'overview',
  'the',
]);

const CONFLICT_TERMS = [
  'antiquity',
  'archaeological',
  'artifact',
  'bottle',
  'ceramic',
  'manuscript',
  'museum',
  'painting',
  'pottery',
  'sculpture',
  'statue',
  'vase',
];

function cleanQuery(value: string) {
  return value.replace(/[·｜|:：—\-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function searchTerms(value: string) {
  const latin =
    value
      .toLowerCase()
      .match(/[a-z0-9][a-z0-9+.-]*/g)
      ?.filter((term) => term.length >= 3 && !SEARCH_STOP_WORDS.has(term)) ?? [];
  const cjk = value.match(/[\u3400-\u9fff]{2,}/g) ?? [];
  return Array.from(new Set([...latin, ...cjk]));
}

export function knowledgeImageAnchors(data: KnowledgeData) {
  const text = [
    data.title,
    data.subtitle,
    data.keyMessage,
    ...data.sections.map((section) => `${section.heading} ${section.body}`),
  ]
    .join(' ')
    .toLowerCase();
  const anchors = new Set<string>();
  const add = (...items: string[]) => items.forEach((item) => anchors.add(item));

  if (/具身|人形机器人|机器人|robot|humanoid/.test(text)) {
    add('robot', 'robotics', 'humanoid');
  }
  if (/显卡|图形处理器|gpu|graphics card/.test(text)) {
    add('gpu', 'graphics', 'geforce', 'radeon');
  }
  if (/处理器|芯片|半导体|cpu|processor|semiconductor/.test(text)) {
    add('processor', 'chip', 'semiconductor');
  }
  if (/人工智能|大模型|机器学习|神经网络|\bai\b|machine learning/.test(text)) {
    add('artificial intelligence', 'machine learning');
  }
  if (/汽车|电动车|automotive|electric vehicle/.test(text)) {
    add('automotive', 'vehicle');
  }
  if (/航天|火箭|卫星|spaceflight|rocket|satellite/.test(text)) {
    add('spaceflight', 'rocket', 'satellite');
  }

  return Array.from(anchors);
}

export function knowledgeImageQueries(data: KnowledgeData, anchors: string[]) {
  const anchorText = anchors.slice(0, 3).join(' ');
  const namedSubjects = [
    ...(data.entities ?? []).map((entity) => entity.name),
    ...(data.horizontal?.peers ?? []),
  ].filter((item) => searchTerms(item).length > 0);
  const subjects = [...namedSubjects, data.title];
  return Array.from(
    new Set(
      subjects
        .filter(Boolean)
        .map((item) => cleanQuery(`${String(item)} ${anchorText}`))
    )
  ).slice(0, 10);
}

export function knowledgeImageCandidateScore(
  candidate: ImageCandidateText,
  query: string,
  anchors: string[]
) {
  const title = candidate.title.toLowerCase();
  const description = (candidate.description ?? '').toLowerCase();
  const searchable = `${title} ${description}`;
  const anchorMatch = anchors.some((anchor) => searchable.includes(anchor));
  if (anchors.length && !anchorMatch) return -1;
  if (/\.(?:djvu|pdf|tiff?)$/i.test(candidate.title)) return -1;

  const conflictingTerm = CONFLICT_TERMS.find((term) => searchable.includes(term));
  if (anchors.length && conflictingTerm && !searchTerms(query).includes(conflictingTerm)) {
    return -1;
  }

  let score = anchorMatch ? 8 : 0;
  for (const term of searchTerms(query)) {
    if (title.includes(term)) score += 5;
    else if (description.includes(term)) score += 2;
  }
  return score;
}
