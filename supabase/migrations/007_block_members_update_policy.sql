CREATE policy "block_members_update_beadle" ON public.block_members FOR
UPDATE    TO authenticated using (public.is_beadle_of (block_id))
WITH      CHECK (public.is_beadle_of (block_id));