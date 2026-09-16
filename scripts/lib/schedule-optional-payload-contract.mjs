import assert from 'node:assert/strict';

// Exercise JSON-serialized staff command payloads against real command bodies.
// Each scenario rolls back, including crew revisions and any generated rows.
export async function verifyOptionalSchedulePayloads(database) {
  const crew = '10000000-0000-4000-8000-000000000001';
  const otherCrew = '10000000-0000-4000-8000-000000000002';
  const project = '10000000-0000-4000-8000-000000000003';
  for (const populated of [false, true]) {
    for (const optional of [null, undefined]) {
      await database.exec('begin;');
      try {
        await database.query('insert into public.schedule_crews(id,name) values ($1,$3),($2,$3)', [crew, otherCrew, 'Optional payload QA']);
        await database.query('insert into public.projects(id) values ($1)', [project]);
        if (populated) {
          await database.query("insert into public.crew_downtimes(crew_id,duration_days,reason) values ($1,1,'other')", [crew]);
          await database.query("insert into public.crew_schedule_items(crew_id,item_type,downtime_id,position) select $1,'downtime',id,0 from public.crew_downtimes where crew_id=$1", [crew]);
        }
        await database.exec('grant all on all tables in schema public to service_role; set local role service_role;');
        const guard = async (...ids) => Object.fromEntries(await Promise.all(ids.map(async id => {
          const row = (await database.query('select schedule_revision from public.schedule_crews where id=$1', [id])).rows[0];
          return [id, { revision: Number(row.schedule_revision), anchor_date: '2026-09-21' }];
        })));
        const command = async (name, args, revisions) => (await database.query(
          'select public.schedule_v2_guarded_command($1,$2::jsonb,$3::jsonb) as result',
          [name, JSON.stringify(args), JSON.stringify(revisions)],
        )).rows[0].result;
        const positions = (await database.query('select id,position from public.crew_schedule_items where crew_id=$1', [crew])).rows;
        const assignment = {
          p_target_crew_id: crew, p_target_insert_position: positions.length,
          p_target_positions: positions, p_target_forecast_updates: [],
          p_assignment: { job_id: project, forecast_duration_days: 2, forecast_start: '2026-09-21', forecast_end_exclusive: '2026-09-23' },
          p_move: optional,
        };
        const beforeInvalid = await guard(crew);
        for (const malformed of [false, [], 'invalid']) {
          await database.exec('savepoint invalid_optional;');
          await assert.rejects(command('schedule_v2_assign_job', { ...assignment, p_move: malformed }, beforeInvalid),
            { message: 'p_move must be an object' });
          await database.exec('rollback to savepoint invalid_optional;');
          assert.deepEqual(await guard(crew), beforeInvalid, 'invalid optional payload rolls back crew revisions');
        }
        const assigned = await command('schedule_v2_assign_job', assignment, await guard(crew));
        const job = assigned.scheduled_job_id;
        assert.ok(job, 'first assignment must create a real job');
        assert.deepEqual((await database.query('select crew_id,forecast_start::text,forecast_end_exclusive::text from public.scheduled_jobs where id=$1', [job])).rows[0], {
          crew_id: crew, forecast_start: '2026-09-21', forecast_end_exclusive: '2026-09-23',
        });
        // Model the existing-job repair path: job exists but queue item is missing.
        await database.query('delete from public.crew_schedule_items where id=$1', [assigned.schedule_item_id]);
        const reassigned = await command('schedule_v2_assign_job', {
          ...assignment, p_assignment: { scheduled_job_id: job },
        }, await guard(crew));
        assert.equal(reassigned.scheduled_job_id, job, 'repair preserves the existing job');
        const moved = await command('schedule_v2_assign_job', {
          ...assignment, p_target_crew_id: otherCrew, p_target_insert_position: 0, p_target_positions: [],
          p_assignment: { scheduled_job_id: job },
          p_move: { source_crew_id: crew, source_job_item_id: reassigned.schedule_item_id, source_positions: positions, source_forecast_updates: [] },
        }, await guard(crew, otherCrew));
        assert.equal(moved.scheduled_job_id, job, 'non-null cross-crew move still works');
        await database.exec('savepoint finish_early;');
        await command('schedule_v2_mark_done', {
          p_scheduled_job_id: job, p_actual_start: '2026-09-21', p_actual_finish: '2026-09-21', p_forecast_updates: [],
          p_finish_early: { crew_id: otherCrew, freed_days: 1, buffer_note: 'QA buffer', insert_position: 1,
            existing_positions: [{ id: moved.schedule_item_id, position: 0 }] },
        }, await guard(otherCrew));
        assert.equal((await database.query('select count(*)::int as n from public.crew_downtimes where crew_id=$1', [otherCrew])).rows[0].n, 1,
          'non-null finish-early payload still creates the requested buffer');
        await database.exec('rollback to savepoint finish_early;');
        await command('schedule_v2_mark_done', {
          p_scheduled_job_id: job, p_actual_start: '2026-09-21', p_actual_finish: '2026-09-22',
          p_forecast_updates: [], p_finish_early: optional,
        }, await guard(otherCrew));
        assert.equal((await database.query('select status from public.scheduled_jobs where id=$1', [job])).rows[0].status, 'done');
        assert.equal((await database.query('select count(*)::int as n from public.crew_downtimes where crew_id=$1', [otherCrew])).rows[0].n, 0);
      } finally {
        await database.exec('rollback;');
      }
    }
  }
  console.log('schedule-db: null/omitted optional payloads, empty/populated assignment, existing-job repair, cross-crew move and mark done passed');
}
