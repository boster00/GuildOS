-- Boster Product Migration Tables
-- Per: docs/product-attributes-migration-plan.md (bosterbio.com2026 repo)

-- Main product table
CREATE TABLE IF NOT EXISTS boster_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  title text NOT NULL,
  handle text UNIQUE, -- url_key
  description text,
  short_description text,
  product_template text, -- e.g. 'antibodies', 'elisa-kits', 'proteins'
  status text DEFAULT 'active',
  visibility text DEFAULT 'visible',

  -- Indexed / query-critical (Category 1A)
  reactivity text[], -- e.g. {'Human','Mouse','Rat'}
  applications text[], -- e.g. {'WB','IHC','ELISA'}
  clone text, -- merged clonality + clone_number
  host_species text,
  badges text[], -- e.g. {'free-antibody-validation','top-seller'}
  target_info jsonb, -- {gene_name, uniprot_id, synonyms, protein_function, gene_full_name, protein_name}

  -- Dedicated but NOT indexed (Category 1B)
  background text,
  storage text,
  shipping_storage_handling text,
  search_index text, -- computed, for full-text search
  meta_title text,
  meta_description text,
  meta_keywords text,

  -- Flexible attributes (Category 2) — generic text columns
  attr_1 text, attr_2 text, attr_3 text, attr_4 text, attr_5 text,
  attr_6 text, attr_7 text, attr_8 text, attr_9 text, attr_10 text,
  attr_11 text, attr_12 text, attr_13 text, attr_14 text, attr_15 text,
  attr_16 text, attr_17 text, attr_18 text, attr_19 text, attr_20 text,
  attr_21 text, attr_22 text, attr_23 text, attr_24 text, attr_25 text,

  -- Catch-all
  metadata jsonb DEFAULT '{}',

  -- Price (simple for now, variants later)
  price numeric(10,2),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Attribute definitions — maps attr_N columns to labels per template
CREATE TABLE IF NOT EXISTS boster_attribute_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template text NOT NULL, -- e.g. 'antibodies', 'elisa-kits'
  attr_key text NOT NULL, -- e.g. 'attr_1', 'attr_2'
  label text NOT NULL, -- e.g. 'Immunogen', 'Kit Components'
  type text DEFAULT 'text', -- 'text' or 'html'
  display_order int DEFAULT 0,
  required boolean DEFAULT false,
  UNIQUE (template, attr_key)
);

-- Product images — many-to-one with product
CREATE TABLE IF NOT EXISTS boster_product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES boster_products(id) ON DELETE CASCADE,
  image_url text NOT NULL, -- storage key or full URL
  alt_text text,
  ltx_description text, -- long HTML description
  position int DEFAULT 0,
  type text DEFAULT 'gallery', -- 'hero', 'gallery', 'datasheet', 'swatch'
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_boster_products_template ON boster_products(product_template);
CREATE INDEX IF NOT EXISTS idx_boster_products_sku ON boster_products(sku);
CREATE INDEX IF NOT EXISTS idx_boster_products_reactivity ON boster_products USING GIN(reactivity);
CREATE INDEX IF NOT EXISTS idx_boster_products_applications ON boster_products USING GIN(applications);
CREATE INDEX IF NOT EXISTS idx_boster_products_target ON boster_products USING GIN(target_info);
CREATE INDEX IF NOT EXISTS idx_boster_product_images_product ON boster_product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_boster_attr_defs_template ON boster_attribute_definitions(template);
