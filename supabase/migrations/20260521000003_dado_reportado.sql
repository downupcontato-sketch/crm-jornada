-- Migration: flag para contatos com dado incorreto reportado
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS dado_reportado BOOLEAN DEFAULT false;

COMMENT ON COLUMN contacts.dado_reportado IS
  'Indica que um voluntário ou coordenador reportou um dado incorreto neste contato';
