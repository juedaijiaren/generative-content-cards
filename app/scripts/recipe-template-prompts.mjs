const BASE_REQUIREMENTS = `# 食谱类静态模板生成任务

生成一份完整、独立、可直接打开的 HTML 文件。

固定要求：
- 画布为 1920×1080 横版。
- CSS 全部内联在 <style>。
- 不引入外部脚本、字体或远程图片。
- 使用给定的本地菜品图片路径作为主图。
- 必须包含菜名、主图、风味描述、份量、耗时、难度、食材、调料、明确用量、烹饪步骤、关键技巧。
- 文本不得遮挡、溢出或互相重叠。
- 直接输出 <!DOCTYPE html> 到 </html>，不要 Markdown 代码块。`;

const recipes = [
  {
    id: '01-xiaohongshu-tomato-egg',
    style: '小红书风',
    dish: '番茄炒蛋',
    image: 'assets/tomato-egg.png',
    direction:
      '温暖、明亮、生活感强。大主图、手账贴纸感标签、亲切短句，适合分享。',
    content:
      '2-3 人份；鸡蛋 4 个，番茄 3 个，小葱 1 根；盐 3g，白糖 4g，生抽 5ml，食用油 25ml；强调鸡蛋嫩、番茄出汁、最后合炒。',
  },
  {
    id: '02-michelin-cod',
    style: '米其林菜单风',
    dish: '香煎鳕鱼配柠檬黄油汁',
    image: 'assets/cod.png',
    direction:
      '高级、克制、留白充足。像餐厅菜单和精致摆盘说明，强调风味结构。',
    content:
      '2 人份；鳕鱼排 2 块，芦笋 6 根，柠檬半个，黄油 35g，白葡萄酒 30ml，刺山柑 10g；强调擦干鱼身、中火煎金黄、乳化酱汁。',
  },
  {
    id: '03-kitchen-red-braised-pork',
    style: '厨房操作台风',
    dish: '红烧肉',
    image: 'assets/red-braised-pork.png',
    direction:
      '实用、高密度、像厨房工作卡。食材调料和步骤清晰，强调火候、时间和状态。',
    content:
      '3-4 人份；五花肉 600g，姜 6 片，葱 2 段；冰糖 25g，生抽 25ml，老抽 8ml，料酒 30ml，八角 2 个，热水 700ml；强调焯水、炒糖色、小火慢炖 45 分钟、开盖收汁。',
  },
  {
    id: '04-bento-mapo-tofu',
    style: '苹果 Bento 风',
    dish: '麻婆豆腐',
    image: 'assets/mapo-tofu.png',
    direction:
      '现代、干净、发布会 Bento Grid。主图大卡，食材、火候、步骤、技巧拆成卫星卡。',
    content:
      '2-3 人份；嫩豆腐 450g，牛肉末 80g，蒜苗 1 根；郫县豆瓣 25g，豆豉 8g，花椒粉 2g，辣椒面 4g，水淀粉 30ml，高汤 220ml；强调煸香底料、轻推豆腐、分次勾芡、起锅撒花椒粉。',
  },
];

function buildPrompt(recipe) {
  return `${BASE_REQUIREMENTS}

## 风格
${recipe.style}

${recipe.direction}

## 菜品
${recipe.dish}

主图路径：${recipe.image}

## 内容设定
${recipe.content}

## 文件命名建议
${recipe.id}.html`;
}

const selected = process.argv[2];
const list = selected
  ? recipes.filter((recipe) => recipe.id === selected || recipe.dish === selected)
  : recipes;

if (list.length === 0) {
  console.error(`Unknown recipe template: ${selected}`);
  process.exit(1);
}

for (const recipe of list) {
  console.log(`\n\n===== ${recipe.id} · ${recipe.style} · ${recipe.dish} =====\n`);
  console.log(buildPrompt(recipe));
}
