/* Seed data — taken from what the FINAL wireframes show, so a fresh app looks
   exactly like Figma before anyone does anything. */
const SEED = (function () {
  const CAT = {
    SPICE: 'Spices — Whole & Ground', OLEO: 'Spice Oleoresins', BLEND: 'Spice Blends & Seasonings',
    DEHY: 'Dehydrated Vegetables', COL: 'Natural Food Colours', OIL: 'Spice & Herb Essential Oils',
    DAIRY: 'Dairy Ingredients', ACID: 'Acidulants', FRESH: 'Fresh Vegetables — Bulk', SAUCE: 'Sauces, Pickles & Condiments (B2B Bulk)'
  };
  /* Product catalogue used by search suggestions (post a requirement, enquiry
     form, seller registration). */
  const PRODUCTS = [
    ['Turmeric Powder', CAT.SPICE], ['Turmeric Powder, Curcumin ≥5%', CAT.SPICE], ['Turmeric Finger (Whole)', CAT.SPICE],
    ['Turmeric Oleoresin', CAT.OLEO], ['Turmeric Essential Oil', CAT.OIL], ['Curcumin Extract 95%', CAT.OLEO, 'also called turmeric extract'],
    ['Chilli / Red Pepper', CAT.SPICE], ['Dried Chilli — Guntur Sannam (S4), whole with stem', CAT.SPICE], ['Dried Chilli — Whole', CAT.SPICE],
    ['Chilli Powder Teja S17', CAT.SPICE], ['Red Chilli Powder — Sortex Clean', CAT.SPICE], ['Dried Chilli Flakes — Crushed', CAT.SPICE],
    ['Paprika', CAT.SPICE], ['Chilli / Capsicum Oleoresin', CAT.OLEO], ['Fresh Green Chilli', CAT.FRESH], ['Hot Sauce / Chilli Sauce', CAT.SAUCE],
    ['Cardamom 8mm — Green, bold', CAT.SPICE], ['Black Pepper', CAT.SPICE], ['Black Pepper Powder', CAT.SPICE], ['Coriander Powder', CAT.SPICE],
    ['Cumin Seed', CAT.SPICE], ['Curry Powder — Export Blend', CAT.BLEND], ['Garam Masala', CAT.BLEND], ['Dehydrated Onion', CAT.DEHY],
    ['Dehydrated Garlic Flakes', CAT.DEHY], ['Paprika Oleoresin', CAT.COL], ['Annatto Extract', CAT.COL], ['Guar Gum', 'Hydrocolloids & Gums'],
    ['Whey Protein Conc. 80%', CAT.DAIRY], ['Skimmed Milk Powder', CAT.DAIRY], ['Citric Acid Anhydrous BP', CAT.ACID]
  ].map(([name, category, alias]) => ({ name, category, alias: alias || '' }));

  const S = (id, name, type, city, state, years, certs, rating, deals, respond, cats, products, extra) => Object.assign({
    id, name, initial: name[0], type, city, state, years, certs, rating, deals, respond,
    categories: cats.map(([c, n]) => ({ name: c, count: n })), products, verified: true
  }, extra || {});
  const SELLERS = [
    S('annapurna', 'Annapurna Food Works', 'Manufacturer', 'Guntur', 'Andhra Pradesh', 22, ['FSSAI Central', 'ISO 22000:2018', 'BRC / GFSI', 'HACCP'], 4.8, 38, '~1 hr', [[CAT.SPICE, 14], [CAT.BLEND, 9], [CAT.COL, 3]], ['Dried Chilli — Guntur Sannam (S4), whole with stem', 'Chilli / Red Pepper', 'Turmeric Powder', 'Turmeric Powder, Curcumin ≥5%', 'Curry Powder — Export Blend', 'Paprika Oleoresin', 'Red Chilli Powder — Sortex Clean']),
    S('srilakshmi', 'Sri Lakshmi Spice Mills', 'Manufacturer', 'Guntur', 'Andhra Pradesh', 18, ['FSSAI Central', 'ISO 22000:2018', 'Spices Board', 'HACCP'], 4.6, 38, '~2 hrs', [[CAT.SPICE, 16], [CAT.BLEND, 3]], ['Dried Chilli — Guntur Sannam (S4), whole with stem', 'Chilli / Red Pepper', 'Turmeric Powder', 'Turmeric Powder, Curcumin ≥5%', 'Chilli Powder Teja S17', 'Dried Chilli Flakes — Crushed', 'Curry Powder — Export Blend']),
    S('kisan', 'Kisan Agro Exports', 'Exporter', 'Khammam', 'Telangana', 16, ['FSSAI Central', 'ISO 22000:2018', 'Spices Board'], 4.5, 24, '~3 hrs', [[CAT.SPICE, 14], [CAT.DEHY, 5]], ['Dried Chilli — Guntur Sannam (S4), whole with stem', 'Chilli / Red Pepper', 'Turmeric Powder', 'Turmeric Powder, Curcumin ≥5%', 'Dehydrated Onion']),
    S('deccan', 'Deccan Spice Works', 'Manufacturer', 'Hyderabad', 'Telangana', 14, ['FSSAI Central', 'Spices Board', 'HACCP', 'Halal'], 4.7, 19, '~2 hrs', [[CAT.SPICE, 14], [CAT.OLEO, 6], [CAT.OIL, 4]], ['Dried Chilli — Guntur Sannam (S4), whole with stem', 'Chilli / Red Pepper', 'Turmeric Powder', 'Turmeric Powder, Curcumin ≥5%', 'Turmeric Oleoresin', 'Chilli / Capsicum Oleoresin', 'Turmeric Essential Oil']),
    S('byadgi', 'Byadgi Naturals', 'Manufacturer', 'Haveri', 'Karnataka', 12, ['FSSAI Central', 'Spices Board', 'Organic — NPOP'], 4.4, 12, '~4 hrs', [[CAT.SPICE, 14], [CAT.COL, 3]], ['Dried Chilli — Guntur Sannam (S4), whole with stem', 'Chilli / Red Pepper', 'Paprika', 'Paprika Oleoresin']),
    S('guntur', 'Guntur Spice Traders', 'Trader', 'Guntur', 'Andhra Pradesh', 11, ['FSSAI Central', 'HACCP'], 4.2, 9, '~5 hrs', [[CAT.SPICE, 14]], ['Dried Chilli — Guntur Sannam (S4), whole with stem', 'Chilli / Red Pepper', 'Chilli Powder Teja S17']),
    S('ashwin', 'Ashwin Spice Works', 'Manufacturer', 'Kochi', 'Kerala', 12, ['FSSAI Central', 'ISO 22000:2018', 'Spices Board'], 4.8, 38, '~2 hrs', [[CAT.SPICE, 12], [CAT.OLEO, 4], [CAT.BLEND, 5]], ['Turmeric Powder', 'Turmeric Powder, Curcumin ≥5%', 'Cardamom 8mm — Green, bold', 'Chilli Powder Teja S17', 'Black Pepper Powder', 'Coriander Powder', 'Turmeric Oleoresin']),
    S('meridian', 'Meridian Foods Pvt Ltd', 'Manufacturer', 'Pune', 'Maharashtra', 9, ['FSSAI Central', 'BRC / GFSI'], 4.6, 21, '~4 hrs', [[CAT.SPICE, 8], [CAT.DAIRY, 6]], ['Turmeric Powder', 'Turmeric Powder, Curcumin ≥5%', 'Whey Protein Conc. 80%', 'Skimmed Milk Powder']),
    S('agropure', 'AgroPure Ingredients', 'Manufacturer', 'Bengaluru', 'Karnataka', 10, ['FSSAI Central', 'HACCP'], 4.5, 15, '~3 hrs', [[CAT.SPICE, 9], [CAT.DEHY, 4]], ['Dried Chilli — Whole', 'Chilli / Red Pepper', 'Dehydrated Onion']),
    S('nutriva', 'Nutriva Ingredients', 'Manufacturer', 'Ahmedabad', 'Gujarat', 8, ['FSSAI Central', 'ISO 22000:2018'], 4.3, 11, '~4 hrs', [[CAT.ACID, 5]], ['Citric Acid Anhydrous BP']),
    S('sunfield', 'Sunfield Agro Exports', 'Exporter', 'Nashik', 'Maharashtra', 15, ['FSSAI Central', 'APEDA', 'Organic — NPOP'], 4.9, 30, '~3 hrs', [[CAT.SPICE, 10], [CAT.DEHY, 6]], ['Turmeric Powder', 'Turmeric Powder, Curcumin ≥5%', 'Dehydrated Onion', 'Dehydrated Garlic Flakes']),
    S('nilgiri', 'Nilgiri Naturals', 'Manufacturer', 'Coimbatore', 'Tamil Nadu', 7, ['FSSAI Central', 'HACCP'], 4.5, 9, '~5 hrs', [[CAT.DAIRY, 4], [CAT.COL, 2]], ['Whey Protein Conc. 80%', 'Annatto Extract']),
    S('malabar', 'Malabar Spice Co.', 'Manufacturer', 'Kozhikode', 'Kerala', 20, ['FSSAI Central', 'Spices Board', 'ISO 22000:2018'], 4.7, 27, '~2 hrs', [[CAT.SPICE, 18]], ['Turmeric Powder', 'Turmeric Powder, Curcumin ≥5%', 'Black Pepper', 'Cardamom 8mm — Green, bold']),
    S('erode', 'Erode Turmeric Traders', 'Trader', 'Erode', 'Tamil Nadu', 13, ['FSSAI Central', 'Spices Board'], 4.4, 14, '~3 hrs', [[CAT.SPICE, 9]], ['Turmeric Powder', 'Turmeric Powder, Curcumin ≥5%', 'Turmeric Finger (Whole)'])
  ];
  const BUYERS = [
    { id: 'vega', name: 'Vega Foods Pvt Ltd', short: 'Vega Foods', initials: 'VF', contact: 'Meera Nair', type: 'Food manufacturer', city: 'Kochi', state: 'Kerala', rating: 4.7, enquiries: 34, deals: 19, since: 2024, phone: '98470 22110', email: 'meera@vegafoods.in' },
    { id: 'northline', name: 'Northline Foods', short: 'Northline', initials: 'NF', type: 'Food manufacturer', city: 'Ludhiana', state: 'Punjab', rating: 4.5, enquiries: 12, deals: 6, since: 2025 },
    { id: 'kerala', name: 'Kerala Agro Mills', short: 'Kerala Agro', initials: 'KA', type: 'Processor', city: 'Thrissur', state: 'Kerala', rating: 4.6, enquiries: 21, deals: 11, since: 2024 },
    { id: 'sunrise', name: 'Sunrise Bakers', short: 'Sunrise', initials: 'SB', type: 'Bakery chain', city: 'Chennai', state: 'Tamil Nadu', rating: 4.4, enquiries: 8, deals: 3, since: 2025 },
    { id: 'coastal', name: 'Coastal Foods Ltd', short: 'Coastal', initials: 'CF', type: 'Food manufacturer', city: 'Mangaluru', state: 'Karnataka', rating: 4.8, enquiries: 40, deals: 25, since: 2024 }
  ];
  const ACCOUNTS = {
    buyer: { role: 'buyer', id: 'vega', name: 'Meera Nair', company: 'Vega Foods Pvt Ltd', phone: '98470 22110', email: 'meera@vegafoods.in' },
    seller: { role: 'seller', id: 'ashwin', name: 'Ashwin Menon', company: 'Ashwin Spice Works', phone: '98450 11324', email: 'sales@ashwinspice.in' }
  };

  const T = (d, h, m) => new Date(2026, 7, d, h, m).toISOString(); // August 2026
  const TURM = { name: 'Turmeric Powder, Curcumin ≥5%', qty: '2', unit: 'MT', notes: 'Steam sterilised, 25 kg paper bags. Please share COA with your reply.', category: CAT.SPICE };
  const C = (id, buyerId, sellerId, products, status, extra) => Object.assign({ id, buyerId, sellerId, products, status, type: 'direct', createdAt: T(12, 10, 12), messages: [], reads: {} }, extra || {});
  const conv = [
    C('c-ashwin-turmeric', 'vega', 'ashwin', [TURM], 'active', {
      createdAt: T(12, 10, 12), acceptedAt: T(12, 10, 24), pinned: true,
      messages: [
        { k: 'enquiry', from: 'buyer', at: T(12, 10, 12) },
        { k: 'event', text: 'accepted', from: 'seller', at: T(12, 10, 24) },
        { k: 'notice', at: T(12, 10, 24) },
        { k: 'text', from: 'seller', text: 'Thanks for the enquiry. We can supply 2 MT of 5% curcumin turmeric powder, steam sterilised, 25 kg paper bags.', at: T(12, 10, 26) },
        { k: 'text', from: 'buyer', text: 'Can you share the COA for the most recent lot?', at: T(12, 10, 31) },
        { k: 'file', from: 'seller', name: 'COA_Lot_2291.pdf', size: 'PDF · 240 KB', at: T(12, 10, 44) },
        { k: 'text', from: 'seller', text: 'Yes, we can supply 2 MT. The rate will be ₹138 per kg, packed in 25 kg bags.', at: T(12, 10, 58) }
      ], reads: { buyer: T(12, 10, 40) }
    }),
    C('c-agropure', 'vega', 'agropure', [{ name: 'Dried Chilli — Whole', qty: '1', unit: 'MT', notes: 'Stemless, 10 kg cartons.', category: CAT.SPICE }], 'active', {
      createdAt: T(12, 8, 30), acceptedAt: T(12, 9, 10),
      messages: [{ k: 'enquiry', from: 'buyer', at: T(12, 8, 30) }, { k: 'event', text: 'accepted', from: 'seller', at: T(12, 9, 10) }, { k: 'text', from: 'seller', text: 'Can share COA for the current lot.', at: T(12, 11, 5) }], reads: { buyer: T(12, 9, 0) }
    }),
    C('c-nutriva', 'vega', 'nutriva', [{ name: 'Citric Acid Anhydrous BP', qty: '500', unit: 'kg', notes: '', category: CAT.ACID }], 'active', {
      createdAt: T(10, 9, 0), acceptedAt: T(10, 11, 0),
      messages: [{ k: 'enquiry', from: 'buyer', at: T(10, 9, 0) }, { k: 'event', text: 'accepted', from: 'seller', at: T(10, 11, 0) }, { k: 'text', from: 'seller', text: 'Quote: ₹96/kg ex-works, 25 kg bags.', at: T(11, 10, 0) }, { k: 'text', from: 'buyer', text: 'Accepted the quote', at: T(12, 9, 0) }], reads: { buyer: T(12, 9, 0) }
    }),
    C('c-sunfield', 'vega', 'sunfield', [TURM], 'active', {
      createdAt: T(9, 9, 0), acceptedAt: T(9, 12, 0),
      messages: [{ k: 'enquiry', from: 'buyer', at: T(9, 9, 0) }, { k: 'event', text: 'accepted', from: 'seller', at: T(9, 12, 0) }, { k: 'text', from: 'seller', text: '₹145/kg, valid 5 days.', at: T(10, 9, 0) }, { k: 'text', from: 'buyer', text: 'Can you hold this price for September?', at: T(11, 9, 0) }], reads: { buyer: T(11, 9, 0) }
    }),
    C('c-nilgiri', 'vega', 'nilgiri', [{ name: 'Whey Protein Conc. 80%', qty: '250', unit: 'kg', notes: '', category: CAT.DAIRY }], 'pending', { createdAt: T(11, 9, 0), messages: [{ k: 'enquiry', from: 'buyer', at: T(11, 9, 0) }] }),
    C('c-meridian', 'vega', 'meridian', [TURM], 'pending', { createdAt: T(9, 9, 40), messages: [{ k: 'enquiry', from: 'buyer', at: T(9, 9, 40) }] }),
    // Ashwin's side (seller demo account)
    C('c-northline', 'northline', 'ashwin', [{ name: 'Chilli Powder Teja S17', qty: '5', unit: 'MT', notes: 'ASTA 80+, 25 kg bags.', category: CAT.SPICE }], 'pending', { createdAt: T(13, 8, 30), messages: [{ k: 'enquiry', from: 'buyer', at: T(13, 8, 30) }] }),
    C('c-kerala', 'kerala', 'ashwin', [{ name: 'Turmeric Powder', qty: '800', unit: 'kg', notes: '', category: CAT.SPICE }], 'active', {
      createdAt: T(12, 14, 0), acceptedAt: T(12, 15, 0),
      messages: [{ k: 'enquiry', from: 'buyer', at: T(12, 14, 0) }, { k: 'event', text: 'accepted', from: 'seller', at: T(12, 15, 0) }, { k: 'text', from: 'buyer', text: 'Can you do 800 kg of turmeric powder by Friday?', at: T(13, 7, 30) }, { k: 'text', from: 'buyer', text: 'Need it for a Monday production run.', at: T(13, 7, 31) }], reads: { seller: T(12, 16, 0) }
    }),
    C('c-sunrise', 'sunrise', 'ashwin', [{ name: 'Cardamom 8mm — Green, bold', qty: '100', unit: 'kg', notes: 'Monthly repeat order. Please share your best rate and lead time.', category: CAT.SPICE }], 'active', {
      createdAt: T(13, 11, 4), acceptedAt: T(13, 11, 20),
      messages: [{ k: 'enquiry', from: 'buyer', at: T(13, 11, 4) }, { k: 'event', text: 'accepted', from: 'seller', at: T(13, 11, 20) }, { k: 'notice', at: T(13, 11, 20) }, { k: 'text', from: 'seller', text: 'Thanks for the enquiry. We can supply 8mm bold cardamom from the current Idukki lot.', at: T(13, 11, 26) }, { k: 'file', from: 'seller', name: 'COA_Lot_2291.pdf', size: 'PDF · 180 KB', at: T(13, 11, 27) }], reads: { seller: T(13, 11, 30) }
    }),
    C('c-coastal', 'coastal', 'ashwin', [{ name: 'Turmeric Powder', qty: '3', unit: 'MT', notes: '', category: CAT.SPICE }], 'active', {
      createdAt: T(11, 10, 0), acceptedAt: T(11, 11, 0),
      messages: [{ k: 'enquiry', from: 'buyer', at: T(11, 10, 0) }, { k: 'event', text: 'accepted', from: 'seller', at: T(11, 11, 0) }, { k: 'text', from: 'seller', text: 'Quote sent — ₹142 / kg, valid 5 days', at: T(12, 17, 0) }], reads: { seller: T(12, 17, 0) }
    })
  ];
  return { CAT, PRODUCTS, SELLERS, BUYERS, ACCOUNTS, conversations: conv };
})();
