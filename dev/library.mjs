// Builds public/library.json: everyday foods and recipes, each tagged with the diets it fits.
// Run: node dev/library.mjs
// Nutrition is per 100 g, from USDA FoodData Central values (rounded). Recipe macros are added up from their ingredients.
import fs from 'node:fs';

// flags: B beef/lamb, K pork, P poultry, F fish/seafood, D dairy, E egg, G gluten, H honey
// [name, cal, protein, carbs, fat, flags, [serving grams, serving label], group]
const I = {
  chicken_breast: ['Chicken breast, cooked', 165, 31, 0, 3.6, 'P', [112, '4 oz cooked'], 'Protein'],
  chicken_thigh: ['Chicken thigh, cooked, skinless', 179, 24.8, 0, 8.2, 'P', [112, '4 oz cooked'], 'Protein'],
  ground_turkey: ['Ground turkey 93% lean, cooked', 176, 23, 0, 9.5, 'P', [112, '4 oz cooked'], 'Protein'],
  ground_beef: ['Ground beef 90% lean, cooked', 217, 26.1, 0, 11.7, 'B', [112, '4 oz cooked'], 'Protein'],
  sirloin: ['Sirloin steak, cooked', 206, 30, 0, 8.7, 'B', [112, '4 oz cooked'], 'Protein'],
  beef_chuck: ['Beef chuck, braised', 230, 30, 0, 12, 'B', [112, '4 oz cooked'], 'Protein'],
  pork_shoulder: ['Pork shoulder, braised', 250, 26, 0, 16, 'K', [112, '4 oz cooked'], 'Protein'],
  linguica: ['Linguiça / chouriço', 300, 15, 2, 26, 'K', [56, '2 oz'], 'Protein'],
  bacon: ['Bacon, cooked', 541, 37, 1.4, 42, 'K', [16, '2 slices'], 'Protein'],
  deli_turkey: ['Deli turkey breast', 104, 17, 4, 1.7, 'P', [56, '2 oz'], 'Protein'],
  salmon: ['Salmon, cooked', 206, 22, 0, 12.4, 'F', [112, '4 oz cooked'], 'Protein'],
  tuna_can: ['Tuna, canned in water', 116, 25.5, 0, 0.8, 'F', [113, '1 can, drained'], 'Protein'],
  shrimp: ['Shrimp, cooked', 99, 24, 0.2, 0.3, 'F', [112, '4 oz cooked'], 'Protein'],
  tilapia: ['Tilapia, cooked', 128, 26, 0, 2.7, 'F', [112, '4 oz cooked'], 'Protein'],
  cod: ['Cod, cooked', 105, 23, 0, 0.9, 'F', [112, '4 oz cooked'], 'Protein'],
  egg: ['Egg, whole', 143, 12.6, 0.7, 9.5, 'E', [50, '1 large'], 'Protein'],
  egg_white: ['Egg whites', 52, 10.9, 0.7, 0.2, 'E', [122, '1/2 cup'], 'Protein'],
  tofu: ['Tofu, firm', 144, 17.3, 2.8, 8.7, '', [126, '1/2 cup'], 'Protein'],
  tempeh: ['Tempeh', 192, 20.3, 7.6, 10.8, '', [84, '3 oz'], 'Protein'],
  seitan: ['Seitan', 370, 75, 14, 1.9, 'G', [28, '1 oz'], 'Protein'],
  edamame: ['Edamame, shelled', 121, 11.9, 8.9, 5.2, '', [75, '1/2 cup'], 'Protein'],
  whey: ['Whey protein powder', 400, 80, 8, 6, 'D', [30, '1 scoop'], 'Protein'],
  pea_protein: ['Pea protein powder', 380, 80, 4, 6, '', [30, '1 scoop'], 'Protein'],
  greek_yogurt: ['Greek yogurt, plain nonfat', 59, 10.2, 3.6, 0.4, 'D', [170, '1 container (6 oz)'], 'Dairy'],
  cottage: ['Cottage cheese, 2%', 84, 11, 4.3, 2.3, 'D', [113, '1/2 cup'], 'Dairy'],
  milk: ['Milk, 2%', 50, 3.3, 4.8, 2, 'D', [244, '1 cup'], 'Dairy'],
  soy_milk: ['Soy milk, unsweetened', 33, 2.9, 1.7, 1.6, '', [243, '1 cup'], 'Dairy & alternatives'],
  almond_milk: ['Almond milk, unsweetened', 15, 0.6, 0.3, 1.2, '', [240, '1 cup'], 'Dairy & alternatives'],
  cheddar: ['Cheddar cheese', 403, 25, 1.3, 33, 'D', [28, '1 oz'], 'Dairy'],
  mozzarella: ['Mozzarella, part-skim', 254, 24, 2.8, 16, 'D', [28, '1 oz / 1 string cheese'], 'Dairy'],
  feta: ['Feta cheese', 264, 14, 4, 21, 'D', [28, '1 oz'], 'Dairy'],
  parmesan: ['Parmesan', 392, 35.8, 3.2, 25.8, 'D', [10, '2 tbsp grated'], 'Dairy'],
  white_rice: ['White rice, cooked', 130, 2.7, 28, 0.3, '', [158, '1 cup'], 'Carbs'],
  brown_rice: ['Brown rice, cooked', 123, 2.7, 25.6, 1, '', [195, '1 cup'], 'Carbs'],
  quinoa: ['Quinoa, cooked', 120, 4.4, 21.3, 1.9, '', [185, '1 cup'], 'Carbs'],
  oats: ['Oats, dry', 379, 13.2, 67.7, 6.5, '', [40, '1/2 cup dry'], 'Carbs'],
  pasta: ['Pasta, cooked', 158, 5.8, 31, 0.9, 'G', [140, '1 cup'], 'Carbs'],
  wheat_bread: ['Whole wheat bread', 252, 12.4, 42.7, 3.5, 'G', [32, '1 slice'], 'Carbs'],
  flour_tortilla: ['Flour tortilla', 306, 8, 50, 8, 'G', [45, '1 medium (8")'], 'Carbs'],
  corn_tortilla: ['Corn tortilla', 218, 5.7, 44.6, 2.9, '', [26, '1 small (6")'], 'Carbs'],
  pita: ['Pita bread', 275, 9, 56, 1.2, 'G', [60, '1 pita'], 'Carbs'],
  bagel: ['Bagel, plain', 257, 10, 50.5, 1.6, 'G', [105, '1 medium'], 'Carbs'],
  potato: ['Potato, baked with skin', 93, 2.5, 21, 0.1, '', [173, '1 medium'], 'Carbs'],
  sweet_potato: ['Sweet potato, baked', 90, 2, 20.7, 0.2, '', [114, '1 medium'], 'Carbs'],
  cassava: ['Cassava (mandioca), boiled', 125, 1, 30, 0.3, '', [150, '1 cup'], 'Carbs'],
  hominy: ['Hominy (dried corn), cooked', 72, 1.5, 14.3, 0.9, '', [165, '1 cup'], 'Carbs'],
  cornmeal: ['Cornmeal, dry', 362, 8.1, 76.9, 3.6, '', [30, '1/4 cup'], 'Carbs'],
  rice_noodles: ['Rice noodles, cooked', 108, 1.8, 24, 0.2, '', [176, '1 cup'], 'Carbs'],
  rice_cake: ['Rice cake', 387, 8, 81, 2.8, '', [9, '1 cake'], 'Carbs'],
  granola: ['Granola', 471, 10, 64, 20, '', [55, '1/2 cup'], 'Carbs'],
  lentils: ['Lentils, cooked', 116, 9, 20, 0.4, '', [198, '1 cup'], 'Beans'],
  black_beans: ['Black beans, cooked', 132, 8.9, 23.7, 0.5, '', [172, '1 cup'], 'Beans'],
  kidney_beans: ['Kidney beans, cooked', 127, 8.7, 22.8, 0.5, '', [177, '1 cup'], 'Beans'],
  chickpeas: ['Chickpeas, cooked', 164, 8.9, 27.4, 2.6, '', [164, '1 cup'], 'Beans'],
  hummus: ['Hummus', 166, 7.9, 14.3, 9.6, '', [60, '1/4 cup'], 'Beans'],
  banana: ['Banana', 89, 1.1, 22.8, 0.3, '', [118, '1 medium'], 'Fruit'],
  apple: ['Apple', 52, 0.3, 13.8, 0.2, '', [182, '1 medium'], 'Fruit'],
  orange: ['Orange', 47, 0.9, 11.8, 0.1, '', [131, '1 medium'], 'Fruit'],
  blueberries: ['Blueberries', 57, 0.7, 14.5, 0.3, '', [148, '1 cup'], 'Fruit'],
  strawberries: ['Strawberries', 32, 0.7, 7.7, 0.3, '', [152, '1 cup'], 'Fruit'],
  mango: ['Mango', 60, 0.8, 15, 0.4, '', [165, '1 cup'], 'Fruit'],
  papaya: ['Papaya', 43, 0.5, 10.8, 0.3, '', [145, '1 cup'], 'Fruit'],
  broccoli: ['Broccoli, cooked', 35, 2.4, 7.2, 0.4, '', [156, '1 cup'], 'Vegetables'],
  green_beans: ['Green beans, cooked', 35, 1.9, 7.9, 0.3, '', [125, '1 cup'], 'Vegetables'],
  spinach: ['Spinach, raw', 23, 2.9, 3.6, 0.4, '', [30, '1 cup'], 'Vegetables'],
  greens: ['Mixed greens', 20, 1.5, 3.5, 0.2, '', [85, '3 cups'], 'Vegetables'],
  bell_pepper: ['Bell pepper', 31, 1, 6, 0.3, '', [119, '1 medium'], 'Vegetables'],
  onion: ['Onion', 40, 1.1, 9.3, 0.1, '', [110, '1 medium'], 'Vegetables'],
  tomato: ['Tomato', 18, 0.9, 3.9, 0.2, '', [123, '1 medium'], 'Vegetables'],
  cucumber: ['Cucumber', 15, 0.7, 3.6, 0.1, '', [104, '1 cup sliced'], 'Vegetables'],
  zucchini: ['Zucchini', 17, 1.2, 3.1, 0.3, '', [124, '1 cup'], 'Vegetables'],
  mushrooms: ['Mushrooms', 22, 3.1, 3.3, 0.3, '', [70, '1 cup'], 'Vegetables'],
  carrot: ['Carrot', 41, 0.9, 9.6, 0.2, '', [61, '1 medium'], 'Vegetables'],
  cabbage: ['Cabbage', 25, 1.3, 5.8, 0.1, '', [89, '1 cup chopped'], 'Vegetables'],
  pumpkin: ['Pumpkin / squash', 26, 1, 6.5, 0.1, '', [116, '1 cup'], 'Vegetables'],
  cauli_rice: ['Cauliflower rice', 25, 2, 5, 0.3, '', [107, '1 cup'], 'Vegetables'],
  corn: ['Corn kernels, cooked', 96, 3.4, 21, 1.5, '', [145, '1 cup'], 'Vegetables'],
  mixed_veg: ['Frozen mixed vegetables', 65, 2.9, 13, 0.5, '', [91, '2/3 cup'], 'Vegetables'],
  avocado: ['Avocado', 160, 2, 8.5, 14.7, '', [50, '1/3 avocado'], 'Fats'],
  olive_oil: ['Olive oil', 884, 0, 0, 100, '', [13.5, '1 tbsp'], 'Fats'],
  butter: ['Butter', 717, 0.9, 0.1, 81, 'D', [14, '1 tbsp'], 'Fats'],
  peanut_butter: ['Peanut butter', 588, 25, 20, 50, '', [32, '2 tbsp'], 'Fats'],
  almonds: ['Almonds', 579, 21, 21.6, 49.9, '', [28, '1 oz (23 almonds)'], 'Fats'],
  chia: ['Chia seeds', 486, 16.5, 42, 30.7, '', [12, '1 tbsp'], 'Fats'],
  honey: ['Honey', 304, 0.3, 82.4, 0, 'H', [21, '1 tbsp'], 'Extras'],
  maple: ['Maple syrup', 260, 0, 67, 0.1, '', [20, '1 tbsp'], 'Extras'],
  salsa: ['Salsa', 36, 1.5, 7, 0.2, '', [32, '2 tbsp'], 'Extras'],
  marinara: ['Marinara sauce', 50, 1.4, 8, 1.5, '', [125, '1/2 cup'], 'Extras'],
  soy_sauce: ['Soy sauce', 53, 8, 4.9, 0.6, 'G', [16, '1 tbsp'], 'Extras'],
  tamari: ['Tamari (gluten-free soy sauce)', 60, 10.5, 5.6, 0.1, '', [18, '1 tbsp'], 'Extras'],
  sriracha: ['Hot sauce', 93, 1.9, 19, 0.9, '', [5, '1 tsp'], 'Extras'],
  tomato_paste: ['Tomato paste', 82, 4.3, 18.9, 0.5, '', [16, '1 tbsp'], 'Extras'],
  cocoa: ['Cocoa powder', 228, 19.6, 57.9, 13.7, '', [5, '1 tbsp'], 'Extras'],
  dark_choc: ['Dark chocolate, 70%', 598, 7.8, 45.9, 42.6, 'D', [28, '1 oz'], 'Extras'],
  jerky: ['Beef jerky', 410, 33, 11, 26, 'B', [28, '1 oz'], 'Protein'],
  spices: ['Garlic, herbs and spices', 0, 0, 0, 0, '', [1, 'to taste'], 'Extras']
};

const DIETS = [
  ['general', 'General'], ['high_protein', 'High protein'], ['vegetarian', 'Vegetarian'], ['vegan', 'Vegan'],
  ['pescatarian', 'Pescatarian'], ['low_carb', 'Low carb'], ['gluten_free', 'Gluten-free'], ['dairy_free', 'Dairy-free'], ['no_pork', 'No pork']
];

function dietsFor(flags, per) {
  const has = c => flags.includes(c);
  const meat = has('B') || has('K') || has('P');
  const out = ['general'];
  if (per.cal > 0 && per.p * 4 / per.cal >= 0.3 && per.p >= 10) out.push('high_protein');
  if (!meat && !has('F')) out.push('vegetarian');
  if (!meat && !has('F') && !has('D') && !has('E') && !has('H')) out.push('vegan');
  if (!meat) out.push('pescatarian');
  if (per.c <= 15) out.push('low_carb');
  if (!has('G')) out.push('gluten_free');
  if (!has('D')) out.push('dairy_free');
  if (!has('K')) out.push('no_pork');
  return out;
}
const r1 = n => Math.round(n * 10) / 10;

// ---- foods: everything above except the cooking-only items ----
const SKIP = new Set(['spices', 'tomato_paste', 'cocoa', 'sriracha', 'olive_oil', 'butter', 'soy_sauce', 'tamari']);
const foods = Object.entries(I).filter(([k]) => !SKIP.has(k)).map(([id, [name, cal, p, c, f, flags, [g, label], group]]) => {
  const per = { cal: Math.round(cal * g / 100), p: r1(p * g / 100), c: r1(c * g / 100), f: r1(f * g / 100) };
  return { id, name, group, g, serving: label, ...per, per100: { cal, p, c, f }, diets: dietsFor(flags, per) };
});
// cooking fats and sauces are still useful to log on their own
for (const id of ['olive_oil', 'butter', 'soy_sauce']) {
  const [name, cal, p, c, f, flags, [g, label]] = I[id];
  const per = { cal: Math.round(cal * g / 100), p: r1(p * g / 100), c: r1(c * g / 100), f: r1(f * g / 100) };
  foods.push({ id, name, group: 'Fats', g, serving: label, ...per, per100: { cal, p, c, f }, diets: dietsFor(flags, per).filter(d => d !== 'high_protein') });
}

// ---- recipes: [ingredient, grams for the whole recipe, how much in kitchen terms] ----
const R = [
  { id: 'chicken-rice-bowls', name: 'Meal-prep chicken & rice bowls', time: 35, serves: 4, tags: ['meal prep'],
    ing: [['chicken_breast', 600, '1¾ lb raw chicken breast'], ['white_rice', 632, '1⅓ cups dry rice (about 4 cups cooked)'], ['broccoli', 500, '2 heads broccoli'], ['olive_oil', 20, '1½ tbsp olive oil'], ['spices', 0, 'garlic powder, paprika, salt, pepper']],
    steps: ['Season the chicken with garlic powder, paprika, salt and pepper.', 'Bake at 425°F for 18–22 minutes until 165°F inside, then slice.', 'Cook the rice and steam the broccoli while the chicken bakes.', 'Split into 4 containers. Keeps 4 days in the fridge.'] },
  { id: 'protein-parfait', name: 'Greek yogurt protein parfait', time: 5, serves: 1,
    ing: [['greek_yogurt', 225, '1 cup plain Greek yogurt'], ['blueberries', 75, '½ cup blueberries'], ['granola', 25, '¼ cup granola'], ['honey', 7, '1 tsp honey']],
    steps: ['Layer yogurt, berries and granola in a cup or jar.', 'Drizzle with honey. Add the granola right before eating so it stays crunchy.'] },
  { id: 'overnight-oats', name: 'Overnight protein oats', time: 5, serves: 1, tags: ['make ahead'],
    ing: [['oats', 40, '½ cup oats'], ['whey', 30, '1 scoop vanilla whey'], ['milk', 180, '¾ cup 2% milk'], ['chia', 6, '½ tbsp chia seeds'], ['banana', 60, '½ banana, sliced']],
    steps: ['Stir oats, protein powder, chia and milk together in a jar.', 'Refrigerate overnight (at least 4 hours).', 'Top with banana in the morning. Eat cold or microwave 1 minute.'] },
  { id: 'egg-white-scramble', name: 'Egg white veggie scramble', time: 10, serves: 1,
    ing: [['egg', 50, '1 whole egg'], ['egg_white', 245, '1 cup egg whites'], ['spinach', 30, '1 cup spinach'], ['bell_pepper', 60, '½ bell pepper, diced'], ['feta', 14, '2 tbsp feta'], ['olive_oil', 4, '1 tsp olive oil']],
    steps: ['Soften the pepper in the oil for 2–3 minutes.', 'Add spinach until it wilts.', 'Pour in the egg and egg whites; stir gently until just set.', 'Top with feta.'] },
  { id: 'turkey-lettuce-tacos', name: 'Turkey taco lettuce wraps', time: 20, serves: 3, tags: ['low carb'],
    ing: [['ground_turkey', 340, '1 lb raw ground turkey (93% lean)'], ['onion', 80, '½ onion, diced'], ['salsa', 120, '½ cup salsa'], ['cheddar', 56, '½ cup shredded cheddar'], ['greens', 150, '1 head romaine or butter lettuce'], ['spices', 0, 'chili powder, cumin, garlic, salt']],
    steps: ['Brown the turkey with the onion, breaking it up.', 'Add the spices and 2 tbsp water; simmer 3 minutes.', 'Spoon into lettuce leaves and top with salsa and cheese.'] },
  { id: 'salmon-sheet-pan', name: 'Sheet-pan salmon, sweet potato & broccoli', time: 30, serves: 2,
    ing: [['salmon', 255, '2 salmon fillets (about 12 oz raw)'], ['sweet_potato', 300, '2 small sweet potatoes, cubed'], ['broccoli', 300, '1 large head broccoli'], ['olive_oil', 20, '1½ tbsp olive oil'], ['spices', 0, 'lemon, garlic, salt, pepper']],
    steps: ['Toss sweet potato with half the oil; roast at 425°F for 10 minutes.', 'Add broccoli and salmon to the pan, brush with the rest of the oil, season.', 'Roast 12–15 more minutes until the salmon flakes.'] },
  { id: 'shrimp-stir-fry', name: 'Shrimp stir-fry with rice', time: 20, serves: 2,
    ing: [['shrimp', 300, '¾ lb shrimp, peeled'], ['mixed_veg', 300, '3 cups stir-fry vegetables'], ['white_rice', 316, '2 cups cooked rice'], ['soy_sauce', 32, '2 tbsp soy sauce'], ['olive_oil', 14, '1 tbsp oil'], ['spices', 0, 'garlic, ginger, chili flakes']],
    steps: ['Stir-fry the vegetables in the oil over high heat for 4 minutes.', 'Add shrimp, garlic and ginger; cook 2–3 minutes until pink.', 'Add soy sauce and toss. Serve over rice.'] },
  { id: 'tofu-stir-fry', name: 'Crispy tofu stir-fry', time: 25, serves: 2,
    ing: [['tofu', 400, '1 block extra-firm tofu, pressed and cubed'], ['broccoli', 200, '2 cups broccoli'], ['bell_pepper', 120, '1 bell pepper'], ['brown_rice', 300, '1½ cups cooked brown rice'], ['tamari', 36, '2 tbsp tamari'], ['olive_oil', 14, '1 tbsp oil'], ['maple', 10, '½ tbsp maple syrup']],
    steps: ['Pan-fry the tofu in the oil until golden on all sides, about 10 minutes.', 'Add the vegetables and cook 4–5 minutes.', 'Stir in tamari and maple syrup. Serve over rice.'] },
  { id: 'lentil-chili', name: 'Big-batch lentil chili', time: 45, serves: 5, tags: ['meal prep'],
    ing: [['lentils', 600, '1½ cups dry lentils'], ['kidney_beans', 430, '1 can kidney beans, drained'], ['tomato', 800, '1 large can crushed tomatoes'], ['onion', 150, '1 onion'], ['bell_pepper', 120, '1 bell pepper'], ['olive_oil', 14, '1 tbsp oil'], ['spices', 0, 'chili powder, cumin, smoked paprika, garlic']],
    steps: ['Cook onion and pepper in the oil for 5 minutes.', 'Add spices, tomatoes, rinsed lentils and 3 cups water.', 'Simmer 30 minutes, stirring now and then.', 'Stir in the beans and heat through. Freezes well.'] },
  { id: 'black-bean-quinoa', name: 'Black bean & quinoa bowl', time: 20, serves: 2,
    ing: [['quinoa', 370, '2 cups cooked quinoa'], ['black_beans', 260, '1 can black beans, drained'], ['corn', 120, '¾ cup corn'], ['avocado', 100, '⅔ avocado'], ['salsa', 120, '½ cup salsa'], ['spices', 0, 'lime, cilantro, cumin']],
    steps: ['Warm the beans and corn with cumin.', 'Split quinoa between two bowls; top with beans, corn, avocado and salsa.', 'Finish with lime and cilantro.'] },
  { id: 'tuna-salad-sandwich', name: 'Greek yogurt tuna sandwich', time: 5, serves: 1,
    ing: [['tuna_can', 113, '1 can tuna, drained'], ['greek_yogurt', 40, '2½ tbsp Greek yogurt'], ['wheat_bread', 64, '2 slices whole wheat bread'], ['spinach', 15, 'handful of spinach'], ['spices', 0, 'mustard, pepper, lemon']],
    steps: ['Mix tuna with yogurt, mustard, lemon and pepper.', 'Pile onto bread with spinach.'] },
  { id: 'chickpea-wrap', name: 'Smashed chickpea hummus wrap', time: 10, serves: 2,
    ing: [['chickpeas', 260, '1 can chickpeas, drained'], ['hummus', 60, '¼ cup hummus'], ['flour_tortilla', 90, '2 tortillas'], ['cucumber', 100, '1 cup cucumber'], ['tomato', 120, '1 tomato'], ['spices', 0, 'lemon, salt, pepper']],
    steps: ['Mash the chickpeas with a fork, then stir in hummus and lemon.', 'Spread on tortillas, add cucumber and tomato, and roll up.'] },
  { id: 'beef-broccoli', name: 'Beef & broccoli', time: 25, serves: 3,
    ing: [['sirloin', 340, '1 lb raw sirloin, thinly sliced'], ['broccoli', 400, '4 cups broccoli'], ['white_rice', 474, '3 cups cooked rice'], ['soy_sauce', 48, '3 tbsp soy sauce'], ['honey', 14, '2 tsp honey'], ['olive_oil', 14, '1 tbsp oil'], ['spices', 0, 'garlic, ginger, 1 tsp cornstarch']],
    steps: ['Sear the beef in the oil over high heat, 2 minutes per side; set aside.', 'Cook broccoli with a splash of water until bright green.', 'Whisk soy sauce, honey, garlic, ginger and cornstarch; add with the beef and toss until glossy.', 'Serve over rice.'] },
  { id: 'chicken-pasta', name: 'Chicken marinara pasta', time: 25, serves: 3,
    ing: [['chicken_breast', 255, '¾ lb raw chicken breast'], ['pasta', 420, '6 oz dry pasta (3 cups cooked)'], ['marinara', 375, '1½ cups marinara'], ['spinach', 60, '2 cups spinach'], ['parmesan', 20, '¼ cup grated parmesan'], ['olive_oil', 7, '½ tbsp oil']],
    steps: ['Boil the pasta.', 'Cook bite-size chicken in the oil until done, about 7 minutes.', 'Add marinara and spinach; simmer 3 minutes.', 'Toss with pasta and top with parmesan.'] },
  { id: 'oat-pancakes', name: 'Cottage cheese oat pancakes', time: 15, serves: 2,
    ing: [['oats', 80, '1 cup oats'], ['cottage', 225, '1 cup cottage cheese'], ['egg', 100, '2 eggs'], ['banana', 60, '½ banana'], ['maple', 20, '1 tbsp maple syrup'], ['butter', 5, '1 tsp butter for the pan']],
    steps: ['Blend oats, cottage cheese, eggs and banana until smooth.', 'Cook ¼-cup scoops in a buttered pan, 2 minutes per side.', 'Top with maple syrup.'] },
  { id: 'protein-smoothie', name: 'Berry banana protein smoothie', time: 5, serves: 1,
    ing: [['whey', 30, '1 scoop whey'], ['milk', 244, '1 cup 2% milk'], ['banana', 118, '1 banana'], ['strawberries', 100, '⅔ cup frozen berries']],
    steps: ['Blend everything with a few ice cubes until smooth.'] },
  { id: 'vegan-pb-smoothie', name: 'Peanut butter banana smoothie (vegan)', time: 5, serves: 1,
    ing: [['pea_protein', 30, '1 scoop pea protein'], ['soy_milk', 243, '1 cup soy milk'], ['banana', 118, '1 banana'], ['peanut_butter', 16, '1 tbsp peanut butter'], ['oats', 20, '¼ cup oats']],
    steps: ['Blend everything with ice until smooth.'] },
  { id: 'breakfast-burritos', name: 'Freezer breakfast burritos', time: 30, serves: 4, tags: ['make ahead'],
    ing: [['egg', 300, '6 eggs'], ['egg_white', 245, '1 cup egg whites'], ['ground_turkey', 170, '½ lb raw ground turkey'], ['black_beans', 172, '1 cup black beans'], ['cheddar', 56, '½ cup cheddar'], ['flour_tortilla', 180, '4 large tortillas'], ['salsa', 64, '¼ cup salsa']],
    steps: ['Brown the turkey; scramble in the eggs and egg whites.', 'Fill tortillas with eggs, beans, cheese and salsa, and roll tightly.', 'Wrap in foil and freeze. Reheat 2 minutes in the microwave (remove foil).'] },
  { id: 'cauli-burrito-bowl', name: 'Cauliflower rice chicken burrito bowl', time: 20, serves: 2, tags: ['low carb'],
    ing: [['chicken_thigh', 210, '10 oz raw boneless chicken thighs'], ['cauli_rice', 300, '3 cups cauliflower rice'], ['black_beans', 86, '½ cup black beans'], ['salsa', 96, '6 tbsp salsa'], ['avocado', 70, '½ avocado'], ['olive_oil', 7, '½ tbsp oil'], ['spices', 0, 'cumin, chili powder, lime']],
    steps: ['Season and pan-cook the chicken, 6 minutes per side; slice.', 'Cook the cauliflower rice in the same pan for 5 minutes.', 'Build bowls with beans, salsa and avocado.'] },
  { id: 'tempeh-peanut-bowl', name: 'Tempeh peanut noodle bowl', time: 20, serves: 2,
    ing: [['tempeh', 226, '8 oz tempeh, cubed'], ['rice_noodles', 264, '1½ cups cooked rice noodles'], ['carrot', 60, '1 carrot, shredded'], ['cabbage', 90, '1 cup shredded cabbage'], ['peanut_butter', 32, '2 tbsp peanut butter'], ['tamari', 18, '1 tbsp tamari'], ['olive_oil', 7, '½ tbsp oil']],
    steps: ['Brown the tempeh in the oil, about 8 minutes.', 'Whisk peanut butter, tamari, lime and hot water into a sauce.', 'Toss noodles, vegetables, tempeh and sauce together.'] },
  { id: 'baked-cod', name: 'Lemon baked cod with potatoes & green beans', time: 30, serves: 2,
    ing: [['cod', 270, '2 cod fillets (about 12 oz raw)'], ['potato', 350, '2 medium potatoes'], ['green_beans', 250, '2 cups green beans'], ['olive_oil', 20, '1½ tbsp olive oil'], ['spices', 0, 'lemon, garlic, parsley']],
    steps: ['Roast cubed potatoes with half the oil at 425°F for 15 minutes.', 'Add cod and green beans, drizzle with the rest of the oil and lemon.', 'Bake 12 more minutes until the fish flakes.'] },
  { id: 'spinach-feta-omelet', name: 'Spinach & feta omelet', time: 10, serves: 1, tags: ['low carb'],
    ing: [['egg', 150, '3 eggs'], ['spinach', 30, '1 cup spinach'], ['feta', 28, '¼ cup feta'], ['mushrooms', 50, '½ cup mushrooms'], ['butter', 5, '1 tsp butter']],
    steps: ['Cook mushrooms and spinach in the butter.', 'Pour in beaten eggs; cook until almost set.', 'Add feta, fold, and cook 1 more minute.'] },
  { id: 'edamame-rice-bowl', name: 'Edamame brown rice bowl', time: 15, serves: 1,
    ing: [['edamame', 150, '1 cup shelled edamame'], ['brown_rice', 150, '¾ cup cooked brown rice'], ['carrot', 60, '1 carrot'], ['cucumber', 80, '¾ cup cucumber'], ['tamari', 18, '1 tbsp tamari'], ['avocado', 50, '⅓ avocado']],
    steps: ['Warm the edamame and rice.', 'Top with sliced carrot, cucumber and avocado.', 'Drizzle with tamari (and sriracha if you like).'] },
  { id: 'chicken-fajitas', name: 'Chicken fajitas on corn tortillas', time: 25, serves: 3,
    ing: [['chicken_breast', 340, '1 lb raw chicken breast, sliced'], ['bell_pepper', 240, '2 bell peppers'], ['onion', 110, '1 onion'], ['corn_tortilla', 156, '6 corn tortillas'], ['olive_oil', 14, '1 tbsp oil'], ['salsa', 96, '6 tbsp salsa'], ['spices', 0, 'fajita seasoning, lime']],
    steps: ['Sear the chicken with seasoning in half the oil; set aside.', 'Cook peppers and onion in the rest of the oil until charred at the edges.', 'Add chicken back with lime. Serve in warm tortillas with salsa.'] },
  { id: 'pb-banana-toast', name: 'Peanut butter banana toast', time: 5, serves: 1,
    ing: [['wheat_bread', 64, '2 slices whole wheat bread'], ['peanut_butter', 32, '2 tbsp peanut butter'], ['banana', 118, '1 banana'], ['chia', 6, '½ tbsp chia (optional)']],
    steps: ['Toast the bread, spread with peanut butter, top with sliced banana and chia.'] },
  { id: 'hummus-plate', name: 'Hummus snack plate', time: 5, serves: 1,
    ing: [['hummus', 60, '¼ cup hummus'], ['pita', 30, '½ pita'], ['cucumber', 100, '1 cup cucumber'], ['carrot', 61, '1 carrot'], ['feta', 14, '2 tbsp feta']],
    steps: ['Slice the vegetables and pita; serve with hummus and feta.'] },
  // ---- Cape Verdean ----
  { id: 'cachupa-rica', name: 'Cachupa rica', cuisine: 'cv', time: 180, serves: 8, tags: ['Cape Verdean', 'big pot'],
    ing: [['hominy', 1300, '1 lb dried hominy (milho), soaked overnight'], ['kidney_beans', 450, '1 cup dried beans (feijão), soaked'], ['pork_shoulder', 320, '1 lb raw pork shoulder, cubed'], ['linguica', 225, '½ lb linguiça, sliced'], ['beef_chuck', 240, '¾ lb raw beef chuck'], ['cabbage', 300, '¼ head cabbage'], ['sweet_potato', 250, '1 sweet potato'], ['pumpkin', 250, '1 wedge squash'], ['cassava', 250, '1 small mandioca'], ['onion', 150, '1 onion'], ['olive_oil', 40, '3 tbsp oil'], ['spices', 0, 'garlic, bay leaf, salt']],
    steps: ['Simmer the soaked hominy and beans in plenty of water for about 1½ hours until tender.', 'Brown the meats with onion, garlic and bay leaf in the oil, then add them to the pot.', 'Add cabbage, sweet potato, squash and mandioca; simmer 45 more minutes.', 'Season to taste. One serving is about 1½ cups. Leftovers make cachupa guisada.'],
    note: 'Every family makes it differently. Change the meats or portion size in the log after you tap Log.' },
  { id: 'cachupa-pobre', name: 'Cachupa pobre (no meat)', cuisine: 'cv', time: 150, serves: 6, tags: ['Cape Verdean', 'big pot'],
    ing: [['hominy', 1100, '¾ lb dried hominy, soaked'], ['kidney_beans', 400, '¾ cup dried beans, soaked'], ['cabbage', 250, '¼ head cabbage'], ['sweet_potato', 200, '1 sweet potato'], ['pumpkin', 200, '1 wedge squash'], ['onion', 120, '1 onion'], ['tomato', 120, '1 tomato'], ['olive_oil', 40, '3 tbsp oil'], ['spices', 0, 'garlic, bay leaf, salt']],
    steps: ['Simmer hominy and beans about 1½ hours until tender.', 'Make a refogado: cook onion, tomato, garlic and bay leaf in the oil, and stir it into the pot.', 'Add the vegetables and simmer 40 more minutes. Season.'] },
  { id: 'cachupa-guisada', name: 'Cachupa guisada with eggs', cuisine: 'cv', time: 15, serves: 1, tags: ['Cape Verdean', 'breakfast'],
    ing: [['hominy', 200, '1¼ cups leftover cachupa (hominy & beans)'], ['kidney_beans', 70, ''], ['linguica', 40, 'a few slices linguiça'], ['egg', 100, '2 eggs'], ['olive_oil', 10, '2 tsp oil']],
    steps: ['Fry the leftover cachupa and linguiça in the oil until crispy at the edges.', 'Fry two eggs alongside and serve on top.'] },
  { id: 'jagacida', name: 'Jagacida (rice & beans)', cuisine: 'cv', time: 40, serves: 4, tags: ['Cape Verdean'],
    ing: [['white_rice', 632, '1½ cups dry rice'], ['kidney_beans', 344, '2 cups cooked beans'], ['onion', 110, '1 onion'], ['tomato', 120, '1 tomato'], ['olive_oil', 27, '2 tbsp oil'], ['spices', 0, 'garlic, bay leaf, salt']],
    steps: ['Cook onion, garlic, tomato and bay leaf in the oil.', 'Add the beans, rice and 3 cups water; bring to a boil.', 'Cover and simmer on low 18–20 minutes until the rice is done.'],
    note: 'Many families add linguiça; log it separately if you do.' },
  { id: 'canja', name: 'Canja (chicken & rice soup)', cuisine: 'cv', time: 50, serves: 6, tags: ['Cape Verdean'],
    ing: [['chicken_thigh', 450, '1½ lb raw boneless chicken thighs'], ['white_rice', 474, '¾ cup dry rice'], ['onion', 150, '1 onion'], ['carrot', 120, '2 carrots'], ['tomato', 120, '1 tomato'], ['olive_oil', 14, '1 tbsp oil'], ['spices', 0, 'garlic, bay leaf, salt']],
    steps: ['Cook onion, garlic and tomato in the oil, add chicken and 8 cups water.', 'Simmer 30 minutes, take out the chicken and shred it.', 'Add rice and carrots; simmer 15–20 minutes.', 'Return the chicken and season.'] },
  { id: 'caldo-de-peixe', name: 'Caldo de peixe (fish stew)', cuisine: 'cv', time: 45, serves: 4, tags: ['Cape Verdean'],
    ing: [['cod', 480, '1⅓ lb raw firm white fish (or tuna steaks)'], ['potato', 350, '2 potatoes'], ['cassava', 250, '1 small mandioca'], ['sweet_potato', 200, '1 sweet potato'], ['onion', 150, '1 onion'], ['tomato', 240, '2 tomatoes'], ['olive_oil', 27, '2 tbsp oil'], ['spices', 0, 'garlic, bay leaf, parsley, salt']],
    steps: ['Make a refogado with oil, onion, garlic, tomato and bay leaf.', 'Add 6 cups water and the root vegetables; simmer 20 minutes.', 'Lay the fish on top, cover and simmer 10 minutes until it flakes.', 'Serve the fish and vegetables with the broth (often with rice or pirão).'] },
  { id: 'pastel-de-atum', name: 'Pastel de atum (tuna pastéis)', cuisine: 'cv', time: 60, serves: 6, tags: ['Cape Verdean', 'fried'],
    ing: [['cornmeal', 200, '1⅔ cups fine cornmeal'], ['sweet_potato', 200, '1 sweet potato, mashed (for the dough)'], ['tuna_can', 226, '2 cans tuna'], ['onion', 110, '1 onion'], ['tomato', 60, '½ tomato'], ['olive_oil', 60, 'oil absorbed while frying (about 4 tbsp)'], ['spices', 0, 'garlic, malagueta pepper, parsley']],
    steps: ['Mix cornmeal, mashed sweet potato, salt and warm water into a soft dough.', 'Cook tuna with onion, tomato, garlic and malagueta for the filling.', 'Roll out small rounds, fill, fold into half-moons and seal.', 'Fry until golden. One serving is about 2 pastéis.'] },
  { id: 'xerem', name: 'Xerém (corn grits with linguiça)', cuisine: 'cv', time: 40, serves: 4, tags: ['Cape Verdean'],
    ing: [['cornmeal', 240, '1¼ cups coarse cornmeal / xerém'], ['linguica', 170, '6 oz linguiça'], ['onion', 110, '1 onion'], ['olive_oil', 14, '1 tbsp oil'], ['spices', 0, 'garlic, bay leaf, salt']],
    steps: ['Brown the linguiça and onion in the oil.', 'Add 5 cups water and bring to a boil.', 'Whisk in the cornmeal slowly and cook on low, stirring, about 25 minutes until thick.'] },
  { id: 'pudim', name: 'Pudim de leite (milk flan)', cuisine: 'cv', time: 70, serves: 8, tags: ['Cape Verdean', 'dessert'],
    ing: [['milk', 732, '3 cups milk'], ['egg', 300, '6 eggs'], ['spices', 0, 'vanilla, lemon peel']],
    extra: { cal: 1160, p: 0, c: 300, f: 0, label: '1½ cups sugar (caramel and custard)' },
    steps: ['Melt ½ cup sugar into a caramel and pour it into a flan pan.', 'Whisk milk, eggs, the rest of the sugar and vanilla; pour over the caramel.', 'Bake in a water bath at 350°F for about 50 minutes until set. Chill, then flip out.'] }
];

const recipes = R.map(r => {
  let tot = { cal: 0, p: 0, c: 0, f: 0 }, flags = '';
  const ingredients = [];
  for (const [k, g, label] of r.ing) {
    const x = I[k]; if (!x) throw new Error('unknown ingredient ' + k);
    tot.cal += x[1] * g / 100; tot.p += x[2] * g / 100; tot.c += x[3] * g / 100; tot.f += x[4] * g / 100;
    if (g > 0) flags += x[5];
    if (label) ingredients.push(label);
  }
  if (r.extra) { tot.cal += r.extra.cal; tot.c += r.extra.c; ingredients.push(r.extra.label); }
  const per = { cal: Math.round(tot.cal / r.serves), p: r1(tot.p / r.serves), c: r1(tot.c / r.serves), f: r1(tot.f / r.serves) };
  return { id: r.id, name: r.name, cuisine: r.cuisine || 'general', time: r.time, serves: r.serves, tags: r.tags || [], ingredients, steps: r.steps, note: r.note || '', ...per, diets: dietsFor(flags, per) };
});

const out = { version: 1, diets: DIETS, foods, recipes };
fs.writeFileSync(new URL('../public/library.json', import.meta.url), JSON.stringify(out));
console.log(foods.length, 'foods,', recipes.length, 'recipes');
for (const r of recipes) console.log(String(r.cal).padStart(4), String(r.p).padStart(5), String(r.c).padStart(5), String(r.f).padStart(5), r.name, '|', r.diets.filter(d => d !== 'general').join(' '));
