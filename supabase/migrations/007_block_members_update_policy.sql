-- Allow beadles to update block member roles (e.g. promoting a member to beadle)
create policy "block_members_update_beadle"
  on public.block_members for update
  to authenticated
  using (
    public.is_beadle_of(block_id)
  )
  with check (
    public.is_beadle_of(block_id)
  );
