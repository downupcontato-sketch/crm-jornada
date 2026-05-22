-- Migration: flag para duplicatas já revisadas pela coordenadora
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS duplicata_revisada BOOLEAN DEFAULT false;

COMMENT ON COLUMN contacts.duplicata_revisada IS
  'Indica que este par de duplicatas foi revisado e marcado para não aparecer mais na tela de gestão';
