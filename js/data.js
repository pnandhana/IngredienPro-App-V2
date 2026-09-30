/* Seed data — the seller directory, product list and the two demo accounts the
   role switch signs in as before anyone registers. */
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

  /* No demo conversations: My enQ, notifications and dashboards start empty and
     fill only with what the user does in the app. */
  return { CAT, PRODUCTS, SELLERS, BUYERS, ACCOUNTS };
})();
