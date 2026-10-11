BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

SET CONSTRAINTS ALL DEFERRED;

TRUNCATE TABLE
    feedback,
    evaluation,
    evaluation_question,
    enrollment,
    teaching_assignment,
    course,
    faculty_phone,
    faculty,
    student_phone,
    student,
    department,
    admin_phone,
    admin
RESTART IDENTITY CASCADE;

INSERT INTO admin (
    admin_id,
    first_name,
    middle_name,
    last_name,
    email,
    hashed_password
) VALUES (
    'ADM001',
    'Course',
    NULL,
    'Admin',
    'admin@amrita.edu',
    crypt('admin123', gen_salt('bf'))
);

INSERT INTO department (
    department_id,
    department_name,
    admin_id,
    hod_faculty_id
) VALUES (
    'CSE',
    'Computer Science and Engineering',
    'ADM001',
    'FAC001'
);

INSERT INTO faculty (
    faculty_id,
    first_name,
    middle_name,
    last_name,
    email,
    hashed_password,
    designation,
    department_id
) VALUES
    (
        'FAC001',
        'Lakshmi',
        NULL,
        'Menon',
        'lakshmi.menon@amrita.edu',
        crypt('faculty123', gen_salt('bf')),
        'Associate Professor',
        'CSE'
    ),
    (
        'FAC002',
        'Arun',
        NULL,
        'Pillai',
        'arun.pillai@amrita.edu',
        crypt('faculty123', gen_salt('bf')),
        'Assistant Professor',
        'CSE'
    ),
    (
        'FAC003',
        'Sandhya',
        NULL,
        'Kumar',
        'sandhya.kumar@amrita.edu',
        crypt('faculty123', gen_salt('bf')),
        'Professor',
        'CSE'
    );

INSERT INTO student (
    student_id,
    first_name,
    middle_name,
    last_name,
    email,
    hashed_password,
    semester,
    department_id
) VALUES
    (
        'AM.SC.U4CSE25018',
        'Aditya',
        NULL,
        'Sahu',
        'aditya.sahu@am.students.amrita.edu',
        crypt('Aditya Sahu', gen_salt('bf')),
        3,
        'CSE'
    ),
    (
        'AM.SC.U4CSE25022',
        'Meera',
        NULL,
        'Krishnan',
        'meera.krishnan@am.students.amrita.edu',
        crypt('Meera Krishnan', gen_salt('bf')),
        3,
        'CSE'
    ),
    (
        'AM.SC.U4CSE25041',
        'Rohan',
        NULL,
        'Nair',
        'rohan.nair@am.students.amrita.edu',
        crypt('Rohan Nair', gen_salt('bf')),
        3,
        'CSE'
    ),
    (
        'AM.SC.U4CSE25009',
        'Fathima',
        NULL,
        'Rasheed',
        'fathima.rasheed@am.students.amrita.edu',
        crypt('Fathima Rasheed', gen_salt('bf')),
        3,
        'CSE'
    );

INSERT INTO course (
    course_id,
    course_code,
    course_name,
    subject_label,
    credits,
    department_id
) VALUES
    (
        '23CSE202',
        '23CSE202',
        'Database Management Systems',
        'DBMS',
        4,
        'CSE'
    ),
    (
        '23CSE204',
        '23CSE204',
        'Operating Systems',
        'OS',
        4,
        'CSE'
    ),
    (
        '23CSE206',
        '23CSE206',
        'Computer Networks',
        'Networks',
        3,
        'CSE'
    );

INSERT INTO teaching_assignment (
    assignment_id,
    course_id,
    faculty_id,
    semester,
    academic_year,
    term,
    section
)
OVERRIDING SYSTEM VALUE
VALUES
    (1, '23CSE202', 'FAC001', 3, '2026-2027', 'ODD', 'A'),
    (2, '23CSE204', 'FAC002', 3, '2026-2027', 'ODD', 'A'),
    (3, '23CSE206', 'FAC003', 3, '2026-2027', 'ODD', 'A');

INSERT INTO enrollment (
    enrollment_id,
    student_id,
    assignment_id,
    enrollment_date
)
OVERRIDING SYSTEM VALUE
VALUES
    (1, 'AM.SC.U4CSE25018', 1, DATE '2026-07-01'),
    (2, 'AM.SC.U4CSE25018', 2, DATE '2026-07-01'),
    (3, 'AM.SC.U4CSE25018', 3, DATE '2026-07-01'),
    (4, 'AM.SC.U4CSE25022', 1, DATE '2026-07-01'),
    (5, 'AM.SC.U4CSE25022', 2, DATE '2026-07-01'),
    (6, 'AM.SC.U4CSE25022', 3, DATE '2026-07-01'),
    (7, 'AM.SC.U4CSE25041', 1, DATE '2026-07-01'),
    (8, 'AM.SC.U4CSE25041', 2, DATE '2026-07-01'),
    (9, 'AM.SC.U4CSE25041', 3, DATE '2026-07-01'),
    (10, 'AM.SC.U4CSE25009', 1, DATE '2026-07-01'),
    (11, 'AM.SC.U4CSE25009', 2, DATE '2026-07-01'),
    (12, 'AM.SC.U4CSE25009', 3, DATE '2026-07-01');

INSERT INTO evaluation_question (
    question_id,
    question_text,
    max_score,
    is_active,
    display_order
)
OVERRIDING SYSTEM VALUE
VALUES
    (
        1,
        'The instructor explained concepts clearly.',
        5,
        TRUE,
        1
    ),
    (
        2,
        'Course materials were well organized.',
        5,
        TRUE,
        2
    ),
    (
        3,
        'Pace of the course was appropriate.',
        5,
        TRUE,
        3
    ),
    (
        4,
        'Doubts and questions were addressed well.',
        5,
        TRUE,
        4
    ),
    (
        5,
        'Overall, I am satisfied with this course.',
        5,
        TRUE,
        5
    );

INSERT INTO evaluation (
    evaluation_id,
    enrollment_id,
    submission_date,
    status,
    comment
)
OVERRIDING SYSTEM VALUE
VALUES
    (
        1,
        1,
        TIMESTAMP '2026-07-20 10:00:00',
        'SUBMITTED',
        'Great pace, loved the SQL labs.'
    ),
    (
        2,
        4,
        TIMESTAMP '2026-07-21 11:15:00',
        'SUBMITTED',
        'Could use more normalization examples.'
    ),
    (
        3,
        8,
        TIMESTAMP '2026-07-22 09:40:00',
        'SUBMITTED',
        'Scheduling unit was a bit rushed.'
    ),
    (
        4,
        12,
        TIMESTAMP '2026-07-23 14:20:00',
        'SUBMITTED',
        'Best course this semester.'
    );

INSERT INTO feedback (
    evaluation_id,
    question_id,
    score
) VALUES
    (1, 1, 5),
    (1, 2, 4),
    (1, 3, 4),
    (1, 4, 5),
    (1, 5, 5),
    (2, 1, 4),
    (2, 2, 4),
    (2, 3, 3),
    (2, 4, 4),
    (2, 5, 4),
    (3, 1, 3),
    (3, 2, 4),
    (3, 3, 3),
    (3, 4, 4),
    (3, 5, 3),
    (4, 1, 5),
    (4, 2, 5),
    (4, 3, 4),
    (4, 4, 5),
    (4, 5, 5);

SELECT setval(
    pg_get_serial_sequence('teaching_assignment', 'assignment_id'),
    (SELECT max(assignment_id) FROM teaching_assignment),
    TRUE
);

SELECT setval(
    pg_get_serial_sequence('enrollment', 'enrollment_id'),
    (SELECT max(enrollment_id) FROM enrollment),
    TRUE
);

SELECT setval(
    pg_get_serial_sequence('evaluation_question', 'question_id'),
    (SELECT max(question_id) FROM evaluation_question),
    TRUE
);

SELECT setval(
    pg_get_serial_sequence('evaluation', 'evaluation_id'),
    (SELECT max(evaluation_id) FROM evaluation),
    TRUE
);

COMMIT;
