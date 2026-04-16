/**
 * Boster Product Migration Pilot — 5 products
 * Tables: boster_products, boster_attribute_definitions, boster_product_images
 * These are Boster-specific tables, NOT Medusa defaults. Medusa has its own
 * product/variant/category schema. These tables are a staging/migration layer
 * that will feed into Medusa later.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRETE_KEY
);

const products = [
  {
    sku: "A00001-2",
    title: "Anti-TP53 Antibody Picoband",
    handle: "anti-tp53-picoband-trade-antibody-a00001-2-boster",
    description: "Boster Bio Anti-TP53 Antibody Picoband catalog # A00001-2. Tested in ELISA, Flow Cytometry, IHC, WB applications. This antibody reacts with Human.",
    short_description: "Anti-TP53 Antibody Picoband. Tested in ELISA, Flow Cytometry, IHC, WB. Reacts with Human.",
    product_template: "antibodies",
    status: "active",
    visibility: "visible",
    reactivity: ["Human"],
    applications: ["WB", "IHC", "ELISA", "Flow Cytometry (Fixed)"],
    clone: "Polyclonal",
    host_species: "Rabbit",
    badges: ["free-antibody-validation"],
    target_info: { gene_name: "TP53", uniprot_id: "P04637", protein_function: "Tumor suppressor protein containing transcriptional activation, DNA binding, and oligomerization domains." },
    background: "This gene encodes a tumor suppressor protein containing transcriptional activation, DNA binding, and oligomerization domains.",
    storage: "At -20\u00b0C for one year from date of receipt. After reconstitution, at 4\u00b0C for one month.",
    meta_title: "TP53 Antibody",
    meta_description: "Boster Bio Anti-TP53 Antibody Picoband catalog # A00001-2. Tested in ELISA, Flow Cytometry, IHC, WB applications.",
    meta_keywords: "Anti-TP53 Antibody Picoband",
    price: null,
    attr_1: "E.coli-derived human TP53 recombinant protein (Position: M1-D186).",
    attr_2: "Immunogen affinity purified.",
    attr_3: "Adding 0.2 ml of distilled water will yield a concentration of 500 \u00b5g/ml.",
    attr_4: "Lyophilized",
    attr_5: "Rabbit IgG",
    attr_6: "53 kDa",
    attr_7: "Adding 0.2 ml of distilled water will yield a concentration of 500 \u00b5g/ml.",
    attr_8: "Boster recommends Enhanced Chemiluminescent Kit with anti-Rabbit IgG (EK1002) for Western blot.",
    attr_9: "Each vial contains 4 mg Trehalose, 0.9 mg NaCl, 0.2 mg Na2HPO4.",
    attr_10: "Western blot, 0.25-0.5 \u00b5g/ml, Human\nIHC(Paraffin), 2-5 \u00b5g/ml, Human\nFlow Cytometry (Fixed), 1-3 \u00b5g/ml/1x10^6 cells, Human\nELISA, 0.1-0.5 \u00b5g/ml, Human",
    attr_11: "Tested Species: In-house tested species with positive results.",
    attr_12: "<b>WB: </b>human A431 whole cell, human T-47D whole cell, human 293T whole cell<br><b>IHC: </b>human esophageal squamous carcinoma tissue",
    attr_13: "100 \u00b5g/vial",
  },
  {
    sku: "M00531",
    title: "Anti-Ikaros Purified IKZF1 Monoclonal Antibody",
    handle: "anti-ikaros-purified-ikzf1-monoclonal-antibody-m00531-boster",
    description: "Boster Bio Anti-Ikaros Purified IKZF1 Monoclonal Antibody (Catalog# M00531). Tested in Flow Cytometry, IP, WB, ICC.",
    short_description: "Anti-Ikaros IKZF1 Monoclonal Antibody. Tested in Flow Cytometry, IP, WB, ICC.",
    product_template: "antibodies",
    status: "active",
    visibility: "visible",
    reactivity: ["Mouse", "Human"],
    applications: ["Flow Cytometry", "IP", "WB", "ICC"],
    clone: "Monoclonal, 4E9",
    host_species: "Mouse",
    badges: ["free-antibody-validation"],
    target_info: { gene_name: "IKZF1", uniprot_id: "Q13422", synonyms: "IKZF1; IK1; LYF1; IKAROS; PPP1R92", protein_function: "Transcription regulator of hematopoietic cell differentiation.", gene_full_name: "IKAROS family zinc finger 1", protein_name: "DNA-binding protein Ikaros" },
    background: "Ikaros, also known as IKZF1 is a hematopoietic-specific transcription factor involved in the regulation of lymphocyte development.",
    storage: "Store at 2-8\u00b0C. Do not freeze.",
    meta_title: "Anti-Ikaros Purified IKZF1 Monoclonal Antibody",
    meta_description: "Boster Bio Anti-Ikaros Purified IKZF1 Monoclonal Antibody. Tested in Flow Cytometry, IP, WB, ICC.",
    meta_keywords: "Anti-Ikaros Purified IKZF1 Monoclonal Antibody",
    price: 299.00,
    attr_1: "Recombinant human Ikaros (C-terminal part).",
    attr_2: "Purified by protein-A affinity chromatography.",
    attr_3: "1 mg/ml",
    attr_4: "Liquid",
    attr_5: "Mouse IgG1",
    attr_6: "42 kDa",
    attr_9: "Phosphate buffered saline (PBS), pH 7.4, 15 mM sodium azide",
    attr_10: "Flow cytometry: 1-4 \u00b5g/ml. Intracellular staining.",
    attr_11: "Anti-apoLipoprotein antibodies have been tested in IHC and used for indirect trapping ELISA.",
    attr_13: "0.1 mg",
    attr_14: "Phosphorylated, Thr449",
    attr_15: "Nucleus",
    attr_16: "Abundantly expressed in thymus, spleen and peripheral blood Leukocytes and lymph nodes.",
    attr_17: "EK1456,M00717,PA1247,PB9844,PB9845",
    attr_18: "sc 19015|sc 19014|sc 19011|sc 368427",
  },
  {
    sku: "PB9396",
    title: "Anti-Smad3 Antibody Picoband",
    handle: "anti-smad3-picoband-trade-antibody-pb9396-boster",
    description: "Boster Bio Anti-Smad3 Antibody Picoband catalog # PB9396. Tested in ICC/IF, IHC, WB. Reacts with Human, Mouse, Rat.",
    short_description: "Anti-Smad3 Antibody Picoband. Tested in ICC/IF, IHC, WB.",
    product_template: "antibodies",
    status: "active",
    visibility: "visible",
    reactivity: ["Human", "Mouse", "Rat"],
    applications: ["IF", "IHC", "ICC", "WB"],
    clone: "Polyclonal",
    host_species: "Rabbit",
    badges: ["free-antibody-validation"],
    target_info: { gene_name: "SMAD3", uniprot_id: "P84022", synonyms: "MADH3; hMAD-3; JV15-2; hSMAD3", protein_function: "Receptor-regulated SMAD, intracellular signal transducer activated by TGF-beta.", gene_full_name: "Mothers against decapentaplegic homolog 3", protein_name: "Mothers against decapentaplegic homolog 3" },
    background: "SMAD3 is a member of the SMAD family, mediates signals from TGF-beta superfamily.",
    storage: "Store at -20\u00b0C for one year from date of receipt.",
    meta_title: "Anti-Smad3 Antibody Picoband | Bosterbio",
    meta_description: "Boster Bio Anti-Smad3 Antibody Picoband catalog # PB9396.",
    meta_keywords: "Anti-Smad3 Antibody Picoband",
    price: 370.00,
    attr_1: "A synthetic peptide corresponding to a sequence in the middle region of human Smad3.",
    attr_2: "Immunogen affinity purified.",
    attr_3: "Adding 0.2 ml of distilled water will yield a concentration of 500 \u00b5g/ml.",
    attr_4: "Lyophilized",
    attr_5: "Rabbit IgG",
    attr_6: "50-55 kDa",
    attr_7: "Add 0.2ml of distilled water will yield a concentration of 500ug/ml.",
    attr_8: "Boster recommends ECL Plus Western Blotting Substrate (AR1196-200) for WB.",
    attr_9: "Each vial contains 4 mg Trehalose, 0.9 mg NaCl and 0.2 mg Na2HPO4.",
    attr_10: "Western blot, 0.1-0.5\u00b5g/ml, Human, Mouse, Rat\nIHC(Paraffin), 2-5\u00b5g/ml, Human\nICC/IF, 5\u00b5g/ml, Human",
    attr_11: "WB: The detection limit for Smad3 is approximately 0.1ng/lane under reducing conditions.",
    attr_12: "<b>WB: </b>human A549, RT4, A431, PC-3, rat brain, rat ovary, mouse brain<br><b>IHC: </b>human liver cancer<br><b>ICC/IF: </b>A549 cell",
    attr_13: "100 \u00b5g/vial",
    attr_15: "Cytoplasm. Nucleus.",
    attr_17: "B0001-5,AR1156,AR0146",
    attr_18: "sc 101154",
    attr_19: "No cross-reactivity with other proteins.",
    attr_20: "Belongs to the dwarfin/SMAD family.",
  },
  {
    sku: "M02830",
    title: "Anti-HBG1/2 Rabbit Monoclonal Antibody",
    handle: "anti-hbg1-2-rabbit-monoclonal-antibody-m02830-boster",
    description: "Boster Bio Anti-HBG1/2 Rabbit Monoclonal Antibody catalog # M02830. Tested in WB. Reacts with Human.",
    short_description: "Anti-HBG1/2 Rabbit Monoclonal Antibody. Tested in WB.",
    product_template: "antibodies",
    status: "active",
    visibility: "visible",
    reactivity: ["Human"],
    applications: ["WB"],
    clone: "Monoclonal, AADB-8",
    host_species: "Rabbit",
    badges: ["free-antibody-validation"],
    target_info: { gene_name: "HBG1", uniprot_id: "P69891/P69892", synonyms: "Hemoglobin subunit gamma-1; Gamma-1-globin", protein_function: "Gamma chains make up the fetal hemoglobin F.", gene_full_name: "Hemoglobin subunit gamma-1", protein_name: "Hemoglobin subunit gamma-1" },
    storage: "Store at -20\u00b0C for one year. For short term, at 4\u00b0C for up to one month.",
    meta_title: "Anti-HBG1/2 Rabbit Monoclonal Antibody",
    meta_description: "Boster Bio Anti-HBG1/2 Rabbit Monoclonal Antibody catalog # M02830.",
    meta_keywords: "Anti-HBG1/2 Rabbit Monoclonal Antibody",
    price: 370.00,
    attr_1: "A synthesized peptide derived from human HBG1/2",
    attr_2: "Affinity-chromatography",
    attr_3: "0.5mg/ml",
    attr_4: "Liquid",
    attr_5: "Rabbit IgG",
    attr_6: "12 kDa",
    attr_7: "Restore with deionized water for reconstitution volume of 1.0 mL",
    attr_9: "Rabbit IgG in stabilizing components, PBS, pH 7.4, 150mM NaCl, 0.02% sodium azide and 50% glycerol.",
    attr_10: "WB 1:500-1:2000",
    attr_11: "Specific for endogenous levels of the ~100 kDa GluR1 protein phosphorylated at Ser845.",
    attr_13: "100 \u00b5l",
    attr_15: "Cytoplasm.",
    attr_16: "Red blood cells.",
  },
  {
    sku: "EK0101",
    title: "Mouse IgG ELISA Kit PicoKine",
    handle: "mouse-igg-picokine-elisa-kit-ek0101-boster",
    description: "Mouse IgG ELISA Kit PicoKine (96 Tests). Quantitate Mouse IgG in Cell Culture Supernatants, Serum. Sensitivity: 10 ng/ml.",
    short_description: "Mouse IgG ELISA Kit PicoKine (96 Tests). Sensitivity: 10 ng/ml.",
    product_template: "elisa-kits",
    status: "active",
    visibility: "visible",
    reactivity: ["Mouse"],
    applications: ["ELISA"],
    clone: null,
    host_species: null,
    badges: [],
    target_info: { gene_name: "IgG", uniprot_id: "N/A" },
    background: "Immunoglobulin G (IgG) is the most common type of antibody found in blood circulation, representing ~75% of serum antibodies.",
    storage: "Store at 4\u00b0C for 6 months, at -20\u00b0C for 12 months.",
    meta_title: "Mouse IgG PicoKine ELISA Kit",
    meta_keywords: "Mouse IgG PicoKine ELISA Kit",
    price: 499.00,
    attr_1: "<10 ng/ml",
    attr_2: "1.56 ng/ml - 100 ng/ml",
    attr_3: "Cell Culture Supernatants, Serum.",
    attr_4: "1 ug/tube",
    attr_5: "There is no detectable cross-reactivity with other relevant proteins.",
    attr_6: "polyclonal antibody from goat|polyclonal antibody from goat",
    attr_7: "heparin or EDTA",
    attr_9: "96 wells/kit, with removable strips.",
    attr_10: '<table class="intra_inter_assay_variability"><tbody><tr><th></th><th colspan="3">Intra-Assay</th><th colspan="3">Inter-Assay</th></tr></tbody></table>',
    attr_11: '<table class="typical_data"><tbody><tr><td>Conc (ng/ml)</td><td>0</td><td>1.56</td><td>3.12</td><td>6.25</td><td>12.5</td><td>25</td><td>50</td><td>100</td></tr><tr><td>O.D.</td><td>0.001</td><td>0.121</td><td>0.21</td><td>0.375</td><td>0.684</td><td>1.145</td><td>1.628</td><td>2.038</td></tr></tbody></table>',
    attr_12: "<ul><li>Microplate reader</li><li>Automated plate washer</li><li>Incubator</li><li>Adjustable pipettes</li></ul>",
  },
];

const antibodyDefs = [
  { template: "antibodies", attr_key: "attr_1", label: "Immunogen", type: "text", display_order: 1, required: true },
  { template: "antibodies", attr_key: "attr_2", label: "Purification", type: "text", display_order: 2 },
  { template: "antibodies", attr_key: "attr_3", label: "Concentration", type: "text", display_order: 3 },
  { template: "antibodies", attr_key: "attr_4", label: "Form", type: "text", display_order: 4, required: true },
  { template: "antibodies", attr_key: "attr_5", label: "Isotype", type: "text", display_order: 5 },
  { template: "antibodies", attr_key: "attr_6", label: "Molecular Weight", type: "text", display_order: 6 },
  { template: "antibodies", attr_key: "attr_7", label: "Reconstitution", type: "text", display_order: 7 },
  { template: "antibodies", attr_key: "attr_8", label: "Recommended Detection Systems", type: "text", display_order: 8 },
  { template: "antibodies", attr_key: "attr_9", label: "Contents", type: "text", display_order: 9 },
  { template: "antibodies", attr_key: "attr_10", label: "Application Details", type: "text", display_order: 10 },
  { template: "antibodies", attr_key: "attr_11", label: "Application Notes", type: "text", display_order: 11 },
  { template: "antibodies", attr_key: "attr_12", label: "Tested Samples", type: "html", display_order: 12 },
  { template: "antibodies", attr_key: "attr_13", label: "Size", type: "text", display_order: 13, required: true },
  { template: "antibodies", attr_key: "attr_14", label: "Phospho Site", type: "text", display_order: 14 },
  { template: "antibodies", attr_key: "attr_15", label: "Subcellular Localization", type: "text", display_order: 15 },
  { template: "antibodies", attr_key: "attr_16", label: "Tissue Specificity", type: "text", display_order: 16 },
  { template: "antibodies", attr_key: "attr_17", label: "Related Products", type: "text", display_order: 17 },
  { template: "antibodies", attr_key: "attr_18", label: "Competitor Equivalents", type: "text", display_order: 18 },
  { template: "antibodies", attr_key: "attr_19", label: "Cross Reactivity", type: "text", display_order: 19 },
  { template: "antibodies", attr_key: "attr_20", label: "Sequence Similarities", type: "text", display_order: 20 },
];

const elisaDefs = [
  { template: "elisa-kits", attr_key: "attr_1", label: "Sensitivity", type: "text", display_order: 1, required: true },
  { template: "elisa-kits", attr_key: "attr_2", label: "Assay Range", type: "text", display_order: 2, required: true },
  { template: "elisa-kits", attr_key: "attr_3", label: "Sample Type", type: "text", display_order: 3, required: true },
  { template: "elisa-kits", attr_key: "attr_4", label: "Kit Components", type: "text", display_order: 4, required: true },
  { template: "elisa-kits", attr_key: "attr_5", label: "Cross Reactivity", type: "text", display_order: 5 },
  { template: "elisa-kits", attr_key: "attr_6", label: "Principle", type: "text", display_order: 6 },
  { template: "elisa-kits", attr_key: "attr_7", label: "Anticoagulant", type: "text", display_order: 7 },
  { template: "elisa-kits", attr_key: "attr_8", label: "Reconstitution", type: "text", display_order: 8 },
  { template: "elisa-kits", attr_key: "attr_9", label: "Size", type: "text", display_order: 9, required: true },
  { template: "elisa-kits", attr_key: "attr_10", label: "Precision (CV)", type: "html", display_order: 10 },
  { template: "elisa-kits", attr_key: "attr_11", label: "Typical Data", type: "html", display_order: 11 },
  { template: "elisa-kits", attr_key: "attr_12", label: "Materials Required", type: "html", display_order: 12 },
];

async function run() {
  // Insert products
  const { data, error } = await sb.from("boster_products").insert(products).select("id,sku");
  if (error) { console.error("Product insert error:", error); return; }
  console.log("Inserted products:", data.map((r) => r.sku).join(", "));

  const idMap = {};
  data.forEach((r) => (idMap[r.sku] = r.id));

  // Insert attribute definitions
  const { error: e2 } = await sb.from("boster_attribute_definitions").insert([...antibodyDefs, ...elisaDefs]);
  if (e2) console.error("Attr defs error:", e2);
  else console.log(`Inserted ${antibodyDefs.length} antibody + ${elisaDefs.length} ELISA attribute definitions`);

  // Insert images
  const images = [
    { product_id: idMap["A00001-2"], image_url: "/a/0/a00001-2-tp53-primary-antibodies-wb-testing-1.jpg", alt_text: "Western blot analysis of TP53 using anti-TP53 antibody (A00001-2)", type: "hero", position: 1 },
    { product_id: idMap["M00531"], image_url: "/antibody/A01497-apolipoprotein-c-ii_antibody_1_ihc_4x3.jpg", alt_text: "Apolipoprotein C-II detected in kidney tissues", type: "hero", position: 1 },
    { product_id: idMap["PB9396"], image_url: "/p/b/pb9396-smad3-primary-antibodies-wb-testing-1_1.jpg", alt_text: "Anti-SMAD3 Picoband antibody PB9396 Western blotting", type: "hero", position: 1 },
    { product_id: idMap["M02830"], image_url: "/m/0/m02830-wb7.jpg", alt_text: "HBG1/2 antibody M02830 Western blot", type: "hero", position: 1 },
    { product_id: idMap["M02830"], image_url: "/A00237_1.jpg", alt_text: "M02830 gallery 1", type: "gallery", position: 2 },
    { product_id: idMap["M02830"], image_url: "/A00237_2.jpg", alt_text: "M02830 gallery 2", type: "gallery", position: 3 },
    { product_id: idMap["M02830"], image_url: "/A00237_3.jpg", alt_text: "M02830 gallery 3", type: "gallery", position: 4 },
    { product_id: idMap["EK0101"], image_url: "/e/k/ek0101.png", alt_text: "Mouse IgG ELISA Kit PicoKine EK0101", type: "hero", position: 1 },
  ];
  const { error: e3 } = await sb.from("boster_product_images").insert(images);
  if (e3) console.error("Images error:", e3);
  else console.log(`Inserted ${images.length} product images`);

  // Verify
  const { data: verify } = await sb.from("boster_products").select("sku,title,product_template,applications,reactivity,price");
  console.log("\nVerification:");
  verify.forEach((p) => console.log(`  ${p.sku} | ${p.product_template} | ${(p.applications || []).join(",")} | ${(p.reactivity || []).join(",")} | $${p.price || "N/A"}`));
}

run().catch(console.error);
