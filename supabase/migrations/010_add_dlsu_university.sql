INSERT INTO public.universities (name, short_code, email_domain, theme_color) VALUES
  ('De La Salle University', 'DLSU', 'dlsu.edu.ph', '#00703C')
ON CONFLICT (email_domain) DO UPDATE SET
  name = EXCLUDED.name,
  short_code = EXCLUDED.short_code,
  theme_color = EXCLUDED.theme_color;
