import 'server-only';
import { recipeSchema, type RecipeData } from '@/categories/recipe/schema';
import { generateImage, type ImageConfig } from '@/lib/image-generation';
import { saveGenerationAsset } from '@/lib/storage';

function baseStylePrompt() {
  return [
    '真实摄影感美食图片',
    '温暖自然光',
    '干净厨房或餐桌环境',
    '无文字',
    '无水印',
    '无人手',
    '横版 16:9',
    '高细节',
  ].join('，');
}

function heroPrompt(data: RecipeData) {
  return (
    data.heroImagePrompt?.trim() ||
    `${baseStylePrompt()}，${data.dishName} 成品图，呈现最有食欲的完成状态，适合菜谱主图。`
  );
}

function processPrompt(data: RecipeData, item: RecipeData['processImages'][number]) {
  return `${baseStylePrompt()}，${data.dishName} 的烹饪过程图，阶段：${item.stage}，画面重点：${item.title}，正确状态：${item.checkPoint}。`;
}

function imageFileName(index: number, extension: string) {
  return `recipe-image-${String(index).padStart(2, '0')}.${extension}`;
}

export async function attachRecipeImages(args: {
  id: string;
  data: unknown;
  imageConfig?: ImageConfig;
}): Promise<unknown> {
  const config = args.imageConfig;
  if (!config?.enabled) return args.data;

  const parsed = recipeSchema.safeParse(args.data);
  if (!parsed.success) return args.data;

  const data = parsed.data;
  let next: RecipeData = { ...data };
  let imageIndex = 1;

  try {
    const image = await generateImage({
      prompt: heroPrompt(data),
      config,
    });
    const url = await saveGenerationAsset(
      args.id,
      imageFileName(imageIndex, image.extension),
      image.bytes
    );
    imageIndex += 1;
    next = { ...next, heroImageUrl: url };
  } catch (err) {
    console.warn('[recipe.images] hero generation failed', err);
  }

  const processImages = [];
  for (const item of data.processImages.slice(0, 4)) {
    try {
      const image = await generateImage({
        prompt: processPrompt(data, item),
        config,
      });
      const url = await saveGenerationAsset(
        args.id,
        imageFileName(imageIndex, image.extension),
        image.bytes
      );
      imageIndex += 1;
      processImages.push({ ...item, imageUrl: url });
    } catch (err) {
      console.warn('[recipe.images] process generation failed', err);
      processImages.push(item);
    }
  }

  return {
    ...next,
    processImages: [
      ...processImages,
      ...data.processImages.slice(processImages.length),
    ],
  };
}
