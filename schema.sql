BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Core login/account table for department administrators.
CREATE TABLE admin (
    admin_id VARCHAR(20) PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_admin_id_not_blank CHECK (length(trim(admin_id)) > 0),
    CONSTRAINT chk_admin_email_format CHECK (position('@' in email) > 1),
    CONSTRAINT chk_admin_password_hash CHECK (length(hashed_password) >= 20)
);

CREATE TABLE admin_phone (
    admin_id VARCHAR(20) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    PRIMARY KEY (admin_id, phone),
    CONSTRAINT fk_admin_phone_admin
        FOREIGN KEY (admin_id)
        REFERENCES admin(admin_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_admin_phone_format
        CHECK (phone ~ '^[0-9+ -]{7,20}$')
);

-- HOD is linked after faculty is created to handle the Department-Faculty cycle.
CREATE TABLE department (
    department_id VARCHAR(20) PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL UNIQUE,
    admin_id VARCHAR(20) NOT NULL,
    hod_faculty_id VARCHAR(20) NOT NULL UNIQUE,
    CONSTRAINT fk_department_admin
        FOREIGN KEY (admin_id)
        REFERENCES admin(admin_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_department_id_not_blank
        CHECK (length(trim(department_id)) > 0)
);

CREATE TABLE student (
    student_id VARCHAR(20) PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    semester SMALLINT NOT NULL,
    department_id VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_student_department
        FOREIGN KEY (department_id)
        REFERENCES department(department_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_student_id_format
        CHECK (student_id ~ '^AM\.SC\.U4CSE[0-9]{5}$'),
    CONSTRAINT chk_student_email_format
        CHECK (position('@' in email) > 1),
    CONSTRAINT chk_student_password_hash
        CHECK (length(hashed_password) >= 20),
    CONSTRAINT chk_student_semester
        CHECK (semester BETWEEN 1 AND 8)
);

CREATE TABLE student_phone (
    student_id VARCHAR(20) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    PRIMARY KEY (student_id, phone),
    CONSTRAINT fk_student_phone_student
        FOREIGN KEY (student_id)
        REFERENCES student(student_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_student_phone_format
        CHECK (phone ~ '^[0-9+ -]{7,20}$')
);

CREATE TABLE faculty (
    faculty_id VARCHAR(20) PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    department_id VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_faculty_department
        FOREIGN KEY (department_id)
        REFERENCES department(department_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT uq_faculty_department_pair
        UNIQUE (department_id, faculty_id),
    CONSTRAINT chk_faculty_id_not_blank
        CHECK (length(trim(faculty_id)) > 0),
    CONSTRAINT chk_faculty_email_format
        CHECK (position('@' in email) > 1),
    CONSTRAINT chk_faculty_password_hash
        CHECK (length(hashed_password) >= 20)
);

CREATE TABLE faculty_phone (
    faculty_id VARCHAR(20) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    PRIMARY KEY (faculty_id, phone),
    CONSTRAINT fk_faculty_phone_faculty
        FOREIGN KEY (faculty_id)
        REFERENCES faculty(faculty_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_faculty_phone_format
        CHECK (phone ~ '^[0-9+ -]{7,20}$')
);

ALTER TABLE department
    ADD CONSTRAINT fk_department_hod_same_department
    FOREIGN KEY (department_id, hod_faculty_id)
    REFERENCES faculty(department_id, faculty_id)
    ON UPDATE CASCADE
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE course (
    course_id VARCHAR(20) PRIMARY KEY,
    course_code VARCHAR(20) NOT NULL UNIQUE,
    course_name VARCHAR(150) NOT NULL,
    subject_label VARCHAR(50) NOT NULL,
    credits SMALLINT NOT NULL,
    department_id VARCHAR(20) NOT NULL,
    CONSTRAINT fk_course_department
        FOREIGN KEY (department_id)
        REFERENCES department(department_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_course_id_not_blank
        CHECK (length(trim(course_id)) > 0),
    CONSTRAINT chk_course_code_format
        CHECK (course_code ~ '^[0-9]{2}[A-Z]{3}[0-9]{3}$'),
    CONSTRAINT chk_course_credits
        CHECK (credits > 0)
);

CREATE TABLE teaching_assignment (
    assignment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_id VARCHAR(20) NOT NULL,
    faculty_id VARCHAR(20) NOT NULL,
    semester SMALLINT NOT NULL,
    academic_year VARCHAR(9) NOT NULL,
    term VARCHAR(20) NOT NULL,
    section VARCHAR(10) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_teaching_assignment_course
        FOREIGN KEY (course_id)
        REFERENCES course(course_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_teaching_assignment_faculty
        FOREIGN KEY (faculty_id)
        REFERENCES faculty(faculty_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT uq_teaching_assignment_offering
        UNIQUE (course_id, faculty_id, academic_year, term, section),
    CONSTRAINT chk_teaching_assignment_semester
        CHECK (semester BETWEEN 1 AND 8),
    CONSTRAINT chk_teaching_assignment_academic_year
        CHECK (academic_year ~ '^[0-9]{4}-[0-9]{4}$'),
    CONSTRAINT chk_teaching_assignment_term
        CHECK (term IN ('ODD', 'EVEN', 'SUMMER')),
    CONSTRAINT chk_teaching_assignment_section
        CHECK (length(trim(section)) > 0)
);

CREATE TABLE enrollment (
    enrollment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL,
    assignment_id BIGINT NOT NULL,
    enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT fk_enrollment_student
        FOREIGN KEY (student_id)
        REFERENCES student(student_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_enrollment_assignment
        FOREIGN KEY (assignment_id)
        REFERENCES teaching_assignment(assignment_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT uq_enrollment_student_assignment
        UNIQUE (student_id, assignment_id)
);

CREATE TABLE evaluation_question (
    question_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    question_text TEXT NOT NULL,
    max_score SMALLINT NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL UNIQUE,
    CONSTRAINT chk_evaluation_question_text
        CHECK (length(trim(question_text)) > 0),
    CONSTRAINT chk_evaluation_question_max_score
        CHECK (max_score BETWEEN 1 AND 5),
    CONSTRAINT chk_evaluation_question_display_order
        CHECK (display_order > 0)
);

CREATE TABLE evaluation (
    evaluation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    enrollment_id BIGINT NOT NULL UNIQUE,
    submission_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
    comment TEXT,
    CONSTRAINT fk_evaluation_enrollment
        FOREIGN KEY (enrollment_id)
        REFERENCES enrollment(enrollment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_evaluation_status
        CHECK (status IN ('DRAFT', 'SUBMITTED', 'VOID')),
    CONSTRAINT chk_evaluation_comment_length
        CHECK (comment IS NULL OR length(comment) <= 1000)
);

CREATE TABLE feedback (
    evaluation_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    score SMALLINT NOT NULL,
    remark TEXT,
    PRIMARY KEY (evaluation_id, question_id),
    CONSTRAINT fk_feedback_evaluation
        FOREIGN KEY (evaluation_id)
        REFERENCES evaluation(evaluation_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_feedback_question
        FOREIGN KEY (question_id)
        REFERENCES evaluation_question(question_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_feedback_score_positive
        CHECK (score >= 1),
    CONSTRAINT chk_feedback_remark_length
        CHECK (remark IS NULL OR length(remark) <= 1000)
);

CREATE OR REPLACE FUNCTION validate_feedback_score()
RETURNS TRIGGER AS $$
DECLARE
    question_max_score SMALLINT;
    question_is_active BOOLEAN;
BEGIN
    SELECT max_score, is_active
    INTO question_max_score, question_is_active
    FROM evaluation_question
    WHERE question_id = NEW.question_id;

    IF question_max_score IS NULL THEN
        RAISE EXCEPTION 'Evaluation question % does not exist', NEW.question_id
            USING ERRCODE = '23503';
    END IF;

    IF question_is_active IS FALSE THEN
        RAISE EXCEPTION 'Evaluation question % is inactive', NEW.question_id
            USING ERRCODE = '23514';
    END IF;

    IF NEW.score > question_max_score THEN
        RAISE EXCEPTION 'Score % exceeds max score % for question %',
            NEW.score, question_max_score, NEW.question_id
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_feedback_validate_score
BEFORE INSERT OR UPDATE OF question_id, score ON feedback
FOR EACH ROW
EXECUTE FUNCTION validate_feedback_score();

CREATE OR REPLACE FUNCTION prevent_invalid_question_max_score()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM feedback
        WHERE question_id = NEW.question_id
          AND score > NEW.max_score
    ) THEN
        RAISE EXCEPTION
            'Cannot reduce max score for question % below existing feedback scores',
            NEW.question_id
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_question_prevent_invalid_max_score
BEFORE UPDATE OF max_score ON evaluation_question
FOR EACH ROW
EXECUTE FUNCTION prevent_invalid_question_max_score();

-- Foreign-key indexes for joins, deletes, and report queries.
CREATE INDEX idx_department_admin_id
    ON department(admin_id);

CREATE INDEX idx_student_department_id
    ON student(department_id);

CREATE INDEX idx_faculty_department_id
    ON faculty(department_id);

CREATE INDEX idx_course_department_id
    ON course(department_id);

CREATE INDEX idx_teaching_assignment_course_id
    ON teaching_assignment(course_id);

CREATE INDEX idx_teaching_assignment_faculty_id
    ON teaching_assignment(faculty_id);

CREATE INDEX idx_enrollment_student_id
    ON enrollment(student_id);

CREATE INDEX idx_enrollment_assignment_id
    ON enrollment(assignment_id);

CREATE INDEX idx_feedback_question_id
    ON feedback(question_id);

COMMIT;
