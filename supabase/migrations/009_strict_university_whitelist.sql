INSERT    INTO public.universities (name, short_code, email_domain, theme_color)
VALUES    ('Ateneo de Manila University', 'ADMU', 'student.ateneo.edu', '#1E6FBA'),
          ('FEU Tech', 'FEUTECH', 'fit.edu.ph', '#006400'),
          ('FEU Manila', 'FEU', 'feu.edu.ph', '#004D25'),
          ('University of Santo Tomas', 'UST', 'ust.edu.ph', '#FFD700'),
          ('University of Asia and the Pacific', 'UA&P', 'uap.asia', '#002B49'),
          ('CIIT College of Arts and Technology', 'CIIT', 'ciit.edu.ph', '#E31837'),
          ('Mapúa University', 'MAPUA', 'mymail.mapua.edu.ph', '#990000')
ON        CONFLICT (email_domain) DO UPDATE
SET       name = EXCLUDED.name,
          short_code = EXCLUDED.short_code,
          theme_color = EXCLUDED.theme_color;
CREATE    OR REPLACE FUNCTION public.validate_user_university_domain () RETURNS trigger SECURITY DEFINER
SET       search_path = '' AS $$
DECLARE
  _email  text;
  _domain text;
  _uni_id uuid;
BEGIN
  _email  := coalesce(new.email, new.raw_user_meta_data->>'email');
  _domain := lower(split_part(_email, '@', 2));

  SELECT u.id INTO _uni_id
  FROM public.universities u
  WHERE _domain LIKE '%' || u.email_domain
  ORDER BY length(u.email_domain) DESC
  LIMIT 1;

  IF _uni_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Unapproved Domain';
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql;
DROP      TRIGGER IF EXISTS check_university_domain_before_insert ON auth.users;
CREATE    TRIGGER check_university_domain_before_insert BEFORE INSERT
OR       
          UPDATE    ON auth.users FOR EACH ROW
          EXECUTE   FUNCTION public.validate_user_university_domain ();