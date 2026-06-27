const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'recommendations.json');
const rawData = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(rawData);

const productsList = data.products || [];
const modelMap = {};

productsList.forEach(p => {
  if (p.showInHKBuyPage !== true) return;

  const modelName = p.model || '';
  const image = p.image || '';
  const storage = p.storage || '';
  const colorName = p.colorEn || '';
  const sku = p.sku || '';
  const price = parseInt(p.rrp) || 0;

  if (!modelName || !storage || !colorName || !sku) return;

  if (!modelMap[modelName]) {
    modelMap[modelName] = {
      name: modelName,
      image: image,
      storageOptions: []
    };
  } else if (!modelMap[modelName].image && image) {
    modelMap[modelName].image = image;
  }

  let storageTier = modelMap[modelName].storageOptions.find(s => s.storage === storage);
  if (!storageTier) {
    storageTier = { storage, price, colors: [] };
    modelMap[modelName].storageOptions.push(storageTier);
  }

  const existingColor = storageTier.colors.find(c => c.sku === sku);
  if (!existingColor) {
    storageTier.colors.push({ name: colorName, sku });
  }
});

Object.values(modelMap).forEach(m => {
  m.storageOptions.sort((a, b) => {
    const order = { '256GB+12GB': 1, '512GB+12GB': 2, '1TB+16GB': 3 };
    return (order[a.storage] || 99) - (order[b.storage] || 99);
  });
});

const step1models = Object.values(modelMap);

fs.writeFileSync(
  path.join(__dirname, 'step1models.json'),
  JSON.stringify(step1models, null, 2),
  'utf8'
);

console.log(`Generated step1models.json with ${step1models.length} models`);