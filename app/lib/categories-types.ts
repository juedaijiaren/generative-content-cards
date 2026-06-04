export type CategoryKey = 'knowledge' | 'travel' | 'recipe';

export type CategoryMeta = {
  key: CategoryKey;
  name: string;
  icon: string;
  keywords: string[];
};
