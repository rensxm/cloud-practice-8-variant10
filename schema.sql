CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  content_type VARCHAR(127) NOT NULL CHECK (length(trim(content_type)) > 0),
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0)
);

INSERT INTO files (name, content_type, size_bytes) VALUES
  ('дәріс.pdf', 'application/pdf', 245760),
  ('таныстырылым.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 1048576),
  ('конспект.txt', 'text/plain', 4096),
  ('сурет.png', 'image/png', 512000),
  ('жоба.zip', 'application/zip', 2097152)
ON CONFLICT (name) DO NOTHING;
