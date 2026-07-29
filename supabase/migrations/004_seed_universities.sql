INSERT    INTO public.universities (name, short_code, email_domain, theme_color)
VALUES    ('Ateneo de Manila University', 'ADMU', 'ateneo.edu', '#1E6FBA'),
          ('De La Salle University', 'DLSU', 'dlsu.edu.ph', '#00703C'),
          ('University of the Philippines', 'UP', 'up.edu.ph', '#7B1113'),
          ('University of Santo Tomas', 'UST', 'ust.edu.ph', '#FFD700') ON conflict (email_domain) do nothing;