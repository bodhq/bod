-- Every protected write uses the same transaction lock as API authorization.
CREATE OR REPLACE FUNCTION bod_guard_er_history() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    data jsonb;
    previous jsonb;
    plan_id uuid;
    parent_id uuid;
    locked_at timestamptz;
    state text;
BEGIN
    PERFORM pg_advisory_xact_lock(7463812041);
    IF TG_OP <> 'INSERT' THEN
        previous := to_jsonb(OLD);
        IF TG_TABLE_NAME IN ('teaching_plans','time_grids','room_distance_models')
           AND previous->>'frozen_at' IS NOT NULL THEN
            RAISE EXCEPTION 'Published dependency is frozen' USING ERRCODE='23514';
        END IF;
        IF TG_TABLE_NAME = 'lesson_occurrences' THEN
            RAISE EXCEPTION 'Occurrence identity is immutable' USING ERRCODE='23514';
        END IF;
        IF TG_TABLE_NAME = 'timetable_versions'
           AND previous->>'status' IN ('published','archived') THEN
            IF TG_OP = 'DELETE' THEN
                RAISE EXCEPTION 'Published history cannot be deleted' USING ERRCODE='23514';
            END IF;
            data := to_jsonb(NEW);
            IF previous->>'status' <> 'published'
               OR data->>'status' <> 'archived'
               OR (data - 'valid_to' - 'status') <> (previous - 'valid_to' - 'status')
               OR data->>'valid_to' IS NULL
               OR (data->>'valid_to')::date <= (previous->>'valid_from')::date
               OR (previous->>'valid_to' IS NOT NULL AND
                   (data->>'valid_to')::date > (previous->>'valid_to')::date) THEN
                RAISE EXCEPTION 'Invalid change to published history' USING ERRCODE='23514';
            END IF;
        END IF;
    END IF;
    -- Check both sides so moving a child cannot bypass a frozen old parent.
    FOR data IN
        SELECT value FROM jsonb_array_elements(
            CASE WHEN TG_OP='INSERT' THEN jsonb_build_array(to_jsonb(NEW))
                 WHEN TG_OP='DELETE' THEN jsonb_build_array(to_jsonb(OLD))
                 ELSE jsonb_build_array(to_jsonb(OLD),to_jsonb(NEW)) END)
    LOOP
        plan_id := NULL;
        IF TG_TABLE_NAME IN ('teaching_assignments','teaching_cycle_weeks',
            'teaching_cycle_steps','teaching_plan_calendar_weeks',
            'teaching_plan_calendar_days') THEN
            plan_id := (data->>'teaching_plan_id')::uuid;
        ELSIF TG_TABLE_NAME='teaching_assignment_weeks' THEN
            SELECT teaching_plan_id INTO plan_id FROM teaching_assignments
            WHERE id=(data->>'teaching_assignment_id')::uuid;
        ELSIF TG_TABLE_NAME IN ('teaching_blocks','teaching_block_members') THEN
            SELECT teaching_plan_id INTO plan_id FROM teaching_cycle_weeks
            WHERE id=(data->>'cycle_week_id')::uuid;
        ELSIF TG_TABLE_NAME IN ('timetable_entries','timetable_preferences') THEN
            SELECT status INTO state FROM timetable_versions
            WHERE id=(data->>'timetable_version_id')::uuid;
            IF state <> 'draft' THEN
                RAISE EXCEPTION 'Published version is immutable' USING ERRCODE='23514';
            END IF;
        ELSIF TG_TABLE_NAME='time_slots' THEN
            SELECT frozen_at INTO locked_at FROM time_grids
            WHERE id=(data->>'time_grid_id')::uuid;
            IF locked_at IS NOT NULL THEN
                RAISE EXCEPTION 'Time grid is frozen' USING ERRCODE='23514';
            END IF;
        ELSIF TG_TABLE_NAME='room_connections' THEN
            SELECT frozen_at INTO locked_at FROM room_distance_models
            WHERE id=(data->>'distance_model_id')::uuid;
            IF locked_at IS NOT NULL THEN
                RAISE EXCEPTION 'Distance model is frozen' USING ERRCODE='23514';
            END IF;
        END IF;
        IF plan_id IS NOT NULL THEN
            SELECT frozen_at INTO locked_at FROM teaching_plans WHERE id=plan_id;
            IF locked_at IS NOT NULL THEN
                RAISE EXCEPTION 'Teaching plan is frozen' USING ERRCODE='23514';
            END IF;
        END IF;
    END LOOP;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'teaching_plans','teaching_assignments','teaching_cycle_weeks',
        'teaching_cycle_steps','teaching_plan_calendar_weeks',
        'teaching_plan_calendar_days','teaching_assignment_weeks',
        'teaching_blocks','teaching_block_members','timetable_versions',
        'timetable_entries','timetable_preferences','time_grids','time_slots',
        'room_distance_models','room_connections','lesson_occurrences'
    ] LOOP
        EXECUTE format('CREATE TRIGGER guard_er_history BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION bod_guard_er_history()', table_name);
    END LOOP;
END;
$$;
