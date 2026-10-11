-- Report queries for the Course Feedback and Faculty Evaluation System.
-- Run after schema.sql and seed.sql.

-- 1. Admin dashboard metrics.
SELECT
    (SELECT count(*) FROM student) AS total_students,
    (SELECT count(*) FROM faculty) AS total_faculty,
    (SELECT count(*) FROM course) AS total_courses,
    (SELECT count(*) FROM evaluation WHERE status = 'SUBMITTED') AS total_feedbacks,
    round(avg(f.score)::numeric, 2) AS overall_average_rating
FROM feedback f
JOIN evaluation e ON e.evaluation_id = f.evaluation_id
WHERE e.status = 'SUBMITTED';

-- 2. Average rating by course.
SELECT
    c.course_code,
    c.course_name,
    c.subject_label,
    round(avg(f.score)::numeric, 2) AS average_rating,
    count(DISTINCT e.evaluation_id) AS response_count
FROM course c
JOIN teaching_assignment ta ON ta.course_id = c.course_id
JOIN enrollment en ON en.assignment_id = ta.assignment_id
JOIN evaluation e ON e.enrollment_id = en.enrollment_id
JOIN feedback f ON f.evaluation_id = e.evaluation_id
WHERE e.status = 'SUBMITTED'
GROUP BY c.course_code, c.course_name, c.subject_label
ORDER BY average_rating DESC, c.course_code;

-- 3. Recent feedback with student identity, intended for admin view only.
SELECT
    e.evaluation_id,
    s.student_id,
    concat_ws(' ', s.first_name, s.middle_name, s.last_name) AS student_name,
    c.course_code,
    c.course_name,
    round(avg(f.score)::numeric, 2) AS average_rating,
    e.submission_date::date AS submitted_on,
    e.comment
FROM evaluation e
JOIN enrollment en ON en.enrollment_id = e.enrollment_id
JOIN student s ON s.student_id = en.student_id
JOIN teaching_assignment ta ON ta.assignment_id = en.assignment_id
JOIN course c ON c.course_id = ta.course_id
JOIN feedback f ON f.evaluation_id = e.evaluation_id
WHERE e.status = 'SUBMITTED'
GROUP BY
    e.evaluation_id,
    s.student_id,
    student_name,
    c.course_code,
    c.course_name,
    e.submission_date,
    e.comment
ORDER BY e.submission_date DESC, e.evaluation_id DESC
LIMIT 10;

-- 4. Course report by question for one course.
-- Change the course code in the WHERE clause as needed.
SELECT
    c.course_code,
    c.course_name,
    q.display_order,
    q.question_text,
    round(avg(f.score)::numeric, 2) AS average_score,
    count(*) AS response_count
FROM course c
JOIN teaching_assignment ta ON ta.course_id = c.course_id
JOIN enrollment en ON en.assignment_id = ta.assignment_id
JOIN evaluation e ON e.enrollment_id = en.enrollment_id
JOIN feedback f ON f.evaluation_id = e.evaluation_id
JOIN evaluation_question q ON q.question_id = f.question_id
WHERE c.course_code = '23CSE202'
  AND e.status = 'SUBMITTED'
GROUP BY c.course_code, c.course_name, q.display_order, q.question_text
ORDER BY q.display_order;

-- 5. Faculty report with anonymous aggregate scores.
-- This query intentionally does not select student_id or student_name.
SELECT
    fa.faculty_id,
    concat_ws(' ', fa.first_name, fa.middle_name, fa.last_name) AS faculty_name,
    c.course_code,
    c.course_name,
    ta.academic_year,
    ta.term,
    ta.section,
    round(avg(f.score)::numeric, 2) AS average_rating,
    count(DISTINCT e.evaluation_id) AS response_count
FROM faculty fa
JOIN teaching_assignment ta ON ta.faculty_id = fa.faculty_id
JOIN course c ON c.course_id = ta.course_id
JOIN enrollment en ON en.assignment_id = ta.assignment_id
JOIN evaluation e ON e.enrollment_id = en.enrollment_id
JOIN feedback f ON f.evaluation_id = e.evaluation_id
WHERE e.status = 'SUBMITTED'
GROUP BY
    fa.faculty_id,
    faculty_name,
    c.course_code,
    c.course_name,
    ta.academic_year,
    ta.term,
    ta.section
ORDER BY faculty_name, c.course_code;

-- 6. Department and term summary.
SELECT
    d.department_id,
    d.department_name,
    ta.academic_year,
    ta.term,
    round(avg(f.score)::numeric, 2) AS average_rating,
    count(DISTINCT e.evaluation_id) AS response_count
FROM department d
JOIN course c ON c.department_id = d.department_id
JOIN teaching_assignment ta ON ta.course_id = c.course_id
JOIN enrollment en ON en.assignment_id = ta.assignment_id
JOIN evaluation e ON e.enrollment_id = en.enrollment_id
JOIN feedback f ON f.evaluation_id = e.evaluation_id
WHERE e.status = 'SUBMITTED'
GROUP BY d.department_id, d.department_name, ta.academic_year, ta.term
ORDER BY d.department_id, ta.academic_year, ta.term;

-- 7. Student feedback history for the student portal.
-- Change the student id in the WHERE clause as needed.
SELECT
    s.student_id,
    concat_ws(' ', s.first_name, s.middle_name, s.last_name) AS student_name,
    c.course_code,
    c.course_name,
    round(avg(f.score)::numeric, 2) AS average_rating,
    e.submission_date::date AS submitted_on,
    e.comment
FROM student s
JOIN enrollment en ON en.student_id = s.student_id
JOIN teaching_assignment ta ON ta.assignment_id = en.assignment_id
JOIN course c ON c.course_id = ta.course_id
JOIN evaluation e ON e.enrollment_id = en.enrollment_id
JOIN feedback f ON f.evaluation_id = e.evaluation_id
WHERE s.student_id = 'AM.SC.U4CSE25018'
GROUP BY
    s.student_id,
    student_name,
    c.course_code,
    c.course_name,
    e.submission_date,
    e.comment
ORDER BY e.submission_date DESC;

-- 8. Enrolled students who have not submitted feedback yet.
SELECT
    s.student_id,
    concat_ws(' ', s.first_name, s.middle_name, s.last_name) AS student_name,
    c.course_code,
    c.course_name,
    ta.academic_year,
    ta.term,
    ta.section
FROM enrollment en
JOIN student s ON s.student_id = en.student_id
JOIN teaching_assignment ta ON ta.assignment_id = en.assignment_id
JOIN course c ON c.course_id = ta.course_id
LEFT JOIN evaluation e ON e.enrollment_id = en.enrollment_id
WHERE e.evaluation_id IS NULL
ORDER BY s.student_id, c.course_code;
