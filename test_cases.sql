-- Constraint and validation test cases.
-- Run after schema.sql and seed.sql.
-- The script catches expected failures and prints a PASS/FAIL result table.

CREATE TEMP TABLE test_results (
    test_case VARCHAR(120),
    expected_result TEXT,
    actual_result TEXT,
    status VARCHAR(10)
);

DO $$
DECLARE
    matched_admin_count INTEGER;
BEGIN
    SELECT count(*)
    INTO matched_admin_count
    FROM admin
    WHERE email = 'admin@amrita.edu'
      AND hashed_password = crypt('admin123', hashed_password);

    INSERT INTO test_results
    VALUES (
        'Admin password hash login',
        'One admin row is returned for the correct password',
        matched_admin_count || ' row(s) returned',
        CASE WHEN matched_admin_count = 1 THEN 'PASS' ELSE 'FAIL' END
    );
END;
$$;

DO $$
BEGIN
    INSERT INTO student (
        student_id,
        first_name,
        middle_name,
        last_name,
        email,
        hashed_password,
        semester,
        department_id
    ) VALUES (
        'AM.SC.U4CSE25018',
        'Duplicate',
        NULL,
        'Student',
        'duplicate.student@am.students.amrita.edu',
        crypt('Duplicate Student', gen_salt('bf')),
        3,
        'CSE'
    );

    INSERT INTO test_results
    VALUES (
        'Duplicate student id',
        'Primary key violation',
        'Insert succeeded unexpectedly',
        'FAIL'
    );
EXCEPTION
    WHEN unique_violation THEN
        INSERT INTO test_results
        VALUES (
            'Duplicate student id',
            'Primary key violation',
            'Unique violation raised',
            'PASS'
        );
    WHEN OTHERS THEN
        INSERT INTO test_results
        VALUES (
            'Duplicate student id',
            'Primary key violation',
            SQLERRM,
            'FAIL'
        );
END;
$$;

DO $$
BEGIN
    INSERT INTO enrollment (student_id, assignment_id)
    VALUES ('AM.SC.U4CSE25018', 1);

    INSERT INTO test_results
    VALUES (
        'Duplicate enrollment',
        'Unique constraint violation',
        'Insert succeeded unexpectedly',
        'FAIL'
    );
EXCEPTION
    WHEN unique_violation THEN
        INSERT INTO test_results
        VALUES (
            'Duplicate enrollment',
            'Unique constraint violation',
            'Unique violation raised',
            'PASS'
        );
    WHEN OTHERS THEN
        INSERT INTO test_results
        VALUES (
            'Duplicate enrollment',
            'Unique constraint violation',
            SQLERRM,
            'FAIL'
        );
END;
$$;

DO $$
BEGIN
    INSERT INTO student (
        student_id,
        first_name,
        middle_name,
        last_name,
        email,
        hashed_password,
        semester,
        department_id
    ) VALUES (
        'BAD-ID',
        'Bad',
        NULL,
        'Id',
        'bad.id@am.students.amrita.edu',
        crypt('Bad Id', gen_salt('bf')),
        3,
        'CSE'
    );

    INSERT INTO test_results
    VALUES (
        'Student id format',
        'CHECK constraint violation',
        'Insert succeeded unexpectedly',
        'FAIL'
    );
EXCEPTION
    WHEN check_violation THEN
        INSERT INTO test_results
        VALUES (
            'Student id format',
            'CHECK constraint violation',
            'Check violation raised',
            'PASS'
        );
    WHEN OTHERS THEN
        INSERT INTO test_results
        VALUES (
            'Student id format',
            'CHECK constraint violation',
            SQLERRM,
            'FAIL'
        );
END;
$$;

DO $$
BEGIN
    INSERT INTO feedback (evaluation_id, question_id, score)
    VALUES (1, 1, 6);

    INSERT INTO test_results
    VALUES (
        'Feedback score upper limit',
        'Trigger rejects score above max_score',
        'Insert succeeded unexpectedly',
        'FAIL'
    );
EXCEPTION
    WHEN check_violation THEN
        INSERT INTO test_results
        VALUES (
            'Feedback score upper limit',
            'Trigger rejects score above max_score',
            'Check violation raised',
            'PASS'
        );
    WHEN OTHERS THEN
        INSERT INTO test_results
        VALUES (
            'Feedback score upper limit',
            'Trigger rejects score above max_score',
            SQLERRM,
            'FAIL'
        );
END;
$$;

DO $$
BEGIN
    UPDATE evaluation_question
    SET is_active = FALSE
    WHERE question_id = 1;

    INSERT INTO feedback (evaluation_id, question_id, score)
    VALUES (2, 1, 4);

    INSERT INTO test_results
    VALUES (
        'Inactive question response',
        'Trigger rejects inactive questions',
        'Insert succeeded unexpectedly',
        'FAIL'
    );
EXCEPTION
    WHEN check_violation THEN
        INSERT INTO test_results
        VALUES (
            'Inactive question response',
            'Trigger rejects inactive questions',
            'Check violation raised',
            'PASS'
        );
    WHEN OTHERS THEN
        INSERT INTO test_results
        VALUES (
            'Inactive question response',
            'Trigger rejects inactive questions',
            SQLERRM,
            'FAIL'
        );
END;
$$;

DO $$
BEGIN
    INSERT INTO evaluation (enrollment_id, status, comment)
    VALUES (1, 'SUBMITTED', 'Duplicate evaluation attempt');

    INSERT INTO test_results
    VALUES (
        'Duplicate evaluation',
        'Unique constraint violation',
        'Insert succeeded unexpectedly',
        'FAIL'
    );
EXCEPTION
    WHEN unique_violation THEN
        INSERT INTO test_results
        VALUES (
            'Duplicate evaluation',
            'Unique constraint violation',
            'Unique violation raised',
            'PASS'
        );
    WHEN OTHERS THEN
        INSERT INTO test_results
        VALUES (
            'Duplicate evaluation',
            'Unique constraint violation',
            SQLERRM,
            'FAIL'
        );
END;
$$;

DO $$
BEGIN
    SET CONSTRAINTS ALL DEFERRED;

    INSERT INTO department (
        department_id,
        department_name,
        admin_id,
        hod_faculty_id
    ) VALUES (
        'ECE',
        'Electronics and Communication Engineering',
        'ADM001',
        'FAC001'
    );

    SET CONSTRAINTS ALL IMMEDIATE;

    INSERT INTO test_results
    VALUES (
        'HOD same department rule',
        'Deferred foreign key rejects faculty from another department',
        'Insert succeeded unexpectedly',
        'FAIL'
    );
EXCEPTION
    WHEN foreign_key_violation THEN
        INSERT INTO test_results
        VALUES (
            'HOD same department rule',
            'Deferred foreign key rejects faculty from another department',
            'Foreign key violation raised',
            'PASS'
        );
    WHEN OTHERS THEN
        INSERT INTO test_results
        VALUES (
            'HOD same department rule',
            'Deferred foreign key rejects faculty from another department',
            SQLERRM,
            'FAIL'
        );
END;
$$;

SELECT *
FROM test_results
ORDER BY test_case;
