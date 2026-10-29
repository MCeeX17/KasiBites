// Default catalogue. Admin edits (price / on-off) are stored in Firestore and layered on top.
// Want real photos later? Add  image: 'assets/food/kota.jpg'  to any item - it replaces the emoji automatically.

export const CATEGORIES = [
  { id: 'kota',    label: 'Legendary Kotas', emoji: '🥖' },
  { id: 'spykos',  label: 'Classic Spykos',  emoji: '🧆' },
  { id: 'chicken', label: 'Chicken & Wings', emoji: '🍗' },
  { id: 'chips',   label: 'Slap Chips',      emoji: '🍟' },
  { id: 'rice',    label: 'Rice & Curries',  emoji: '🍛' }
];

export const INGREDIENTS = [
  { id: 'b-base',     name: 'Quarter Loaf Base', price: 15, group: 'foundation', required: true, emoji: '🥖' },
  { id: 'b-atchar',   name: 'Mango Atchar',      price: 5,  group: 'foundation', emoji: '🥭' },
  { id: 'b-chips',    name: 'Hot Slap Chips',    price: 15, group: 'foundation', emoji: '🍟' },
  { id: 'm-polony',   name: 'Polony Slices',     price: 6,  group: 'meats', emoji: '🍖' },
  { id: 'm-vienna',   name: 'Smoked Vienna',     price: 8,  group: 'meats', emoji: '🌭' },
  { id: 'm-russian',  name: 'Grilled Russian',   price: 18, group: 'meats', emoji: '🌭' },
  { id: 'm-patty',    name: 'Beef Burger Patty', price: 20, group: 'meats', emoji: '🍔' },
  { id: 'm-mince',    name: 'Savory Beef Mince', price: 22, group: 'meats', emoji: '🥩' },
  { id: 'c-cheese',   name: 'Melted Cheddar',    price: 8,  group: 'cheeses', emoji: '🧀' },
  { id: 'c-egg',      name: 'Fried Egg',         price: 7,  group: 'cheeses', emoji: '🍳' },
  { id: 'c-tomato',   name: 'Fresh Tomato',      price: 4,  group: 'cheeses', emoji: '🍅' },
  { id: 'c-lettuce',  name: 'Crisp Lettuce',     price: 3,  group: 'cheeses', emoji: '🥬' },
  { id: 's-perinaise',name: 'Perinaise Sauce',   price: 4,  group: 'sauces', emoji: '🔥', color: '#F97316' },
  { id: 's-chilli',   name: 'Hot Chilli Sauce',  price: 4,  group: 'sauces', emoji: '🌶️', color: '#DC2626' },
  { id: 's-chutney',  name: 'Sweet Chutney',     price: 4,  group: 'sauces', emoji: '🍯', color: '#854D0E' },
  { id: 's-cap',      name: 'Quarter Bread Cap', price: 5,  group: 'sauces', emoji: '🍞' }
];

export const MENU = [
  { id: 'menu-1', category: 'kota', emoji: '🥖', name: 'The Student Classic Kota', price: 35, badge: 'Top Value', desc: 'Quarter bread hollowed with hot slap chips, pink polony, mango atchar, and perinaise.' },
  { id: 'menu-2', category: 'kota', emoji: '🥖', name: 'The Dagwood Boss Kota', price: 85, badge: 'Legend', desc: 'Quarter loaf stacked with beef patty, fried egg, double melted cheese, grilled russian, slap chips, and sweet chutney.' },
  { id: 'menu-3', category: 'kota', emoji: '🌭', name: 'Russian Roulette Spatlho', price: 60, badge: 'Spicy', desc: 'Thick grilled russian, heap of slap chips, melted cheddar, hot atchar, and chilli basting.' },

  { id: 'spy-classic',      category: 'spykos', emoji: '🧆', name: 'Classic Spykos',               price: 50, badge: 'Classic', desc: '5 fresh vetkoeks served with 1 grilled russian and mango achaar.' },
  { id: 'spy-mince-cheese', category: 'spykos', emoji: '🧆', name: 'Vetkoek Mince & Cheese',       price: 60, badge: 'Stuffed', desc: 'A big fresh vetkoek packed with savoury mince and melted cheese inside.' },
  { id: 'spy-mini',         category: 'spykos', emoji: '🧆', name: 'Mini Vetkoeks Mince & Cheese', price: 25, badge: '5 Pieces', desc: '5 small vetkoeks filled with savoury mince and cheese.' },

  { id: 'menu-4', category: 'chicken', emoji: '🍗', name: '1/4 Chicken Leg & Slap Chips', price: 48, badge: 'Crispy', desc: 'Flame-grilled quarter leg chicken basted in lemon & herb or peri-peri with seasoned slap chips.' },
  { id: 'menu-5', category: 'chicken', emoji: '🍗', name: 'Chicken Wings (6pc) & Chips', price: 65, badge: 'Popular', desc: 'Six succulent crispy fried chicken wings tossed in mild BBQ sauce with golden fries.' },

  { id: 'chips-s', category: 'chips', emoji: '🍟', name: 'Slap Chips (Small)',  price: 15, badge: 'S Size', desc: 'A small box of hand-cut slap chips soaked in vinegar and dusted with our secret spice.' },
  { id: 'menu-6',  category: 'chips', emoji: '🍟', name: 'Slap Chips (Medium)', price: 25, badge: 'M Size', desc: 'Fresh hand-cut potato slap chips soaked in vinegar and dusted with our secret spice.' },
  { id: 'chips-l', category: 'chips', emoji: '🍟', name: 'Slap Chips (Large)',  price: 40, badge: 'L Size', desc: 'A large heap of hot slap chips, perfect for sharing between two.' },
  { id: 'menu-7',  category: 'chips', emoji: '🍟', name: 'Slap Chips (XL Family Bucket)', price: 55, badge: 'Family', desc: 'Extra large family portion of hot slap chips, enough for 4 people with 2 tubs of sauce.' },

  { id: 'menu-8', category: 'rice', emoji: '🐟', name: 'Fish & Savory Rice Bowl',  price: 55, badge: 'Fresh', desc: 'Golden hake fillet served over a bed of seasoned turmeric yellow rice and garden salad.' },
  { id: 'menu-9', category: 'rice', emoji: '🍛', name: 'Curry Chicken & Yellow Rice', price: 58, badge: 'Warm', desc: 'Tender chicken pieces simmered in mild Durban-style potato curry gravy with aromatic yellow rice.' }
];

export const SPECIALS = [
  { id: 'spec-1', emoji: '🥖', title: 'Two-for-Tuesday Student Combo', subtitle: '2x Student Classic Kotas + 2 Cans of Cold Drink', price: 85, oldPrice: 110, badge: 'SAVE R25' },
  { id: 'spec-2', emoji: '🍗', title: 'Wings & 1/4 Leg Family Box', subtitle: '1/4 Chicken Leg + 4 Wings + Large Slap Chips + 2 Rolls', price: 99, oldPrice: 135, badge: '30% OFF' },
  { id: 'spec-3', emoji: '🔥', title: 'Boss Spatlho Lunch Rush', subtitle: 'The Dagwood Boss + Free Extra Cheddar + 330ml Can', price: 85, oldPrice: 105, badge: 'FREE DRINK' }
];

export const SCHEDULE = [
  { day: 'Monday', open: '08:00', close: '17:00' },
  { day: 'Tuesday', open: '08:00', close: '17:00' },
  { day: 'Wednesday', open: '08:00', close: '17:00' },
  { day: 'Thursday', open: '08:00', close: '18:00' },
  { day: 'Friday', open: '08:00', close: '19:30' },
  { day: 'Saturday', open: '08:30', close: '19:00' },
  { day: 'Sunday', open: '09:00', close: '16:00' }
];

export const STEPS = [
  { name: 'Order Received', desc: 'Ticket sent to grill', status: 'Order Received & Sent to Kitchen' },
  { name: 'Frying & Cooking', desc: 'Slap chips in hot oil', status: 'Frying & Cooking' },
  { name: 'Stacking & Melting', desc: 'Loaf hollowed & layered', status: 'Stacking & Grilling Cheeses' },
  { name: 'Ready for Collection', desc: 'Wrapped & piping hot!', status: 'Ready for Collection' },
  { name: 'Collected', desc: 'Delivered to customer', status: 'Order Collected / Completed' }
];
