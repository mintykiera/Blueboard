DROP policy IF EXISTS "tasks_delete_beadle" ON public.tasks;
DROP policy IF EXISTS "tasks_delete_beadle_or_creator" ON public.tasks;
CREATE policy "tasks_delete_beadle_or_creator" ON public.tasks FOR
DELETE    TO authenticated using (
public.is_beadle_of (block_id)
OR        created_by = auth.uid ()
          );