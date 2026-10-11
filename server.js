require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 3000);

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
      }
    : {
        host: process.env.PGHOST || "localhost",
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE || "feedback_hub",
        user: process.env.PGUSER || "postgres",
        password: process.env.PGPASSWORD,
      },
);

app.use(express.json());

function fullName(row, prefix = "") {
  return [row[`${prefix}first_name`], row[`${prefix}middle_name`], row[`${prefix}last_name`]]
    .filter(Boolean)
    .join(" ");
}

function splitName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", middleName: null, lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], middleName: null, lastName: "" };
  }

  return {
    firstName: parts[0],
    middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : null,
    lastName: parts[parts.length - 1],
  };
}

function studentEmailFor(studentId) {
  const localPart = String(studentId)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `${localPart}@am.students.amrita.edu`;
}

function currentOfferingDefaults() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startYear = month >= 6 ? year : year - 1;

  let term = "EVEN";
  if (month >= 6 && month <= 11) {
    term = "ODD";
  } else if (month >= 3 && month <= 5) {
    term = "SUMMER";
  }

  return {
    semester: 3,
    academicYear: `${startYear}-${startYear + 1}`,
    term,
    section: process.env.DEFAULT_SECTION || "A",
  };
}

async function getDefaultDepartmentId(client) {
  const preferred = process.env.DEFAULT_DEPARTMENT_ID || "CSE";
  const preferredResult = await client.query(
    "SELECT department_id FROM department WHERE department_id = $1",
    [preferred],
  );

  if (preferredResult.rowCount > 0) {
    return preferredResult.rows[0].department_id;
  }

  const fallbackResult = await client.query(
    "SELECT department_id FROM department ORDER BY department_id LIMIT 1",
  );

  if (fallbackResult.rowCount === 0) {
    throw httpError(400, "Create a department before adding faculty.");
  }

  return fallbackResult.rows[0].department_id;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertRequired(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw httpError(400, `${fieldName} is required.`);
  }
}

function sendError(res, error) {
  const status = error.status || (error.code === "23505" ? 409 : 500);
  const message =
    status === 500
      ? "Database operation failed. Check the server log for details."
      : error.message;

  if (status === 500) {
    console.error(error);
  }

  res.status(status).json({ error: message });
}

function asyncRoute(handler) {
  return (req, res) => {
    Promise.resolve(handler(req, res)).catch((error) => sendError(res, error));
  };
}

async function getAppData(client = pool) {
  const [adminResult, questionResult, studentResult, teacherResult, courseResult, feedbackResult] =
    await Promise.all([
      client.query(`
        SELECT first_name, middle_name, last_name, email
        FROM admin
        ORDER BY admin_id
        LIMIT 1
      `),
      client.query(`
        SELECT
          question_id AS id,
          display_order AS no,
          question_text AS text,
          max_score AS "maxScore",
          is_active AS "isActive"
        FROM evaluation_question
        WHERE is_active = TRUE
        ORDER BY display_order
      `),
      client.query(`
        SELECT
          student_id AS id,
          first_name,
          middle_name,
          last_name,
          department_id AS dept,
          semester AS sem
        FROM student
        ORDER BY student_id
      `),
      client.query(`
        SELECT
          f.faculty_id AS id,
          f.first_name,
          f.middle_name,
          f.last_name,
          f.email,
          COALESCE(NULLIF(string_agg(DISTINCT c.subject_label, ', '), ''), f.designation) AS subject
        FROM faculty f
        LEFT JOIN teaching_assignment ta ON ta.faculty_id = f.faculty_id
        LEFT JOIN course c ON c.course_id = ta.course_id
        GROUP BY
          f.faculty_id,
          f.first_name,
          f.middle_name,
          f.last_name,
          f.email,
          f.designation
        ORDER BY f.faculty_id
      `),
      client.query(`
        SELECT
          c.course_code AS code,
          c.course_name AS name,
          latest_assignment.faculty_id AS "teacherId",
          c.subject_label AS subject
        FROM course c
        LEFT JOIN LATERAL (
          SELECT ta.faculty_id
          FROM teaching_assignment ta
          WHERE ta.course_id = c.course_id
          ORDER BY ta.academic_year DESC, ta.assignment_id DESC
          LIMIT 1
        ) latest_assignment ON TRUE
        ORDER BY c.course_code
      `),
      client.query(`
        SELECT
          e.evaluation_id AS id,
          en.student_id AS "studentId",
          c.course_code AS "courseCode",
          array_agg(fb.score ORDER BY q.display_order) AS ratings,
          e.comment,
          e.submission_date::date::text AS date
        FROM evaluation e
        JOIN enrollment en ON en.enrollment_id = e.enrollment_id
        JOIN teaching_assignment ta ON ta.assignment_id = en.assignment_id
        JOIN course c ON c.course_id = ta.course_id
        JOIN feedback fb ON fb.evaluation_id = e.evaluation_id
        JOIN evaluation_question q ON q.question_id = fb.question_id
        GROUP BY
          e.evaluation_id,
          en.student_id,
          c.course_code,
          e.comment,
          e.submission_date
        ORDER BY e.submission_date, e.evaluation_id
      `),
    ]);

  const adminRow = adminResult.rows[0];

  return {
    admin: adminRow
      ? {
          name: fullName(adminRow),
          email: adminRow.email,
        }
      : null,
    questions: questionResult.rows,
    students: studentResult.rows.map((row) => ({
      id: row.id,
      name: fullName(row),
      dept: row.dept,
      sem: row.sem,
    })),
    teachers: teacherResult.rows.map((row) => ({
      id: row.id,
      name: fullName(row),
      email: row.email,
      subject: row.subject,
    })),
    courses: courseResult.rows,
    feedbacks: feedbackResult.rows,
  };
}

app.get(
  "/api/health",
  asyncRoute(async (_req, res) => {
    const result = await pool.query("SELECT CURRENT_TIMESTAMP AS now");
    res.json({ ok: true, databaseTime: result.rows[0].now });
  }),
);

app.get(
  "/api/data",
  asyncRoute(async (_req, res) => {
    res.json(await getAppData());
  }),
);

app.post(
  "/api/login",
  asyncRoute(async (req, res) => {
    const { role, id, secret } = req.body;
    assertRequired(role, "Role");
    assertRequired(id, "Login ID");
    assertRequired(secret, "Password or name");

    if (role === "admin") {
      const result = await pool.query(
        `
          SELECT first_name, middle_name, last_name, email
          FROM admin
          WHERE lower(email) = lower($1)
            AND hashed_password = crypt($2, hashed_password)
        `,
        [id, secret],
      );

      if (result.rowCount === 0) {
        throw httpError(401, "Incorrect admin email or password.");
      }

      const admin = result.rows[0];
      res.json({ name: fullName(admin), email: admin.email });
      return;
    }

    if (role === "student") {
      const result = await pool.query(
        `
          SELECT
            student_id AS id,
            first_name,
            middle_name,
            last_name,
            department_id AS dept,
            semester AS sem
          FROM student
          WHERE student_id = $1
            AND hashed_password = crypt($2, hashed_password)
        `,
        [id, secret],
      );

      if (result.rowCount === 0) {
        throw httpError(401, "Student ID and name do not match our records.");
      }

      const student = result.rows[0];
      res.json({
        id: student.id,
        name: fullName(student),
        dept: student.dept,
        sem: student.sem,
      });
      return;
    }

    throw httpError(400, "Unsupported role.");
  }),
);

app.post(
  "/api/feedback",
  asyncRoute(async (req, res) => {
    const { studentId, courseCode, ratings, comment } = req.body;
    assertRequired(studentId, "Student ID");
    assertRequired(courseCode, "Course code");

    if (!Array.isArray(ratings) || ratings.length === 0) {
      throw httpError(400, "Ratings are required.");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const enrollmentResult = await client.query(
        `
          SELECT en.enrollment_id
          FROM enrollment en
          JOIN teaching_assignment ta ON ta.assignment_id = en.assignment_id
          JOIN course c ON c.course_id = ta.course_id
          WHERE en.student_id = $1
            AND c.course_code = $2
          ORDER BY ta.academic_year DESC, ta.assignment_id DESC
          LIMIT 1
        `,
        [studentId, courseCode],
      );

      if (enrollmentResult.rowCount === 0) {
        throw httpError(403, "Only enrolled students can submit feedback for this course.");
      }

      const questionResult = await client.query(
        `
          SELECT question_id, display_order
          FROM evaluation_question
          WHERE is_active = TRUE
          ORDER BY display_order
        `,
      );

      if (ratings.length !== questionResult.rowCount) {
        throw httpError(400, "Submit one rating for each active question.");
      }

      const evaluationResult = await client.query(
        `
          INSERT INTO evaluation (enrollment_id, status, comment)
          VALUES ($1, 'SUBMITTED', NULLIF($2, ''))
          RETURNING evaluation_id
        `,
        [enrollmentResult.rows[0].enrollment_id, String(comment || "").trim()],
      );

      const evaluationId = evaluationResult.rows[0].evaluation_id;

      for (let index = 0; index < questionResult.rows.length; index += 1) {
        await client.query(
          `
            INSERT INTO feedback (evaluation_id, question_id, score)
            VALUES ($1, $2, $3)
          `,
          [evaluationId, questionResult.rows[index].question_id, Number(ratings[index])],
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ ok: true, evaluationId });
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23505") {
        throw httpError(409, "Feedback already exists for this enrollment.");
      }
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.post(
  "/api/students",
  asyncRoute(async (req, res) => {
    const { id, name, dept, sem } = req.body;
    assertRequired(id, "Student ID");
    assertRequired(name, "Student name");
    assertRequired(dept, "Department");
    assertRequired(sem, "Semester");

    const { firstName, middleName, lastName } = splitName(name);
    const result = await pool.query(
      `
        INSERT INTO student (
          student_id,
          first_name,
          middle_name,
          last_name,
          email,
          hashed_password,
          semester,
          department_id
        )
        VALUES ($1, $2, $3, $4, $5, crypt($6, gen_salt('bf')), $7, $8)
        RETURNING student_id
      `,
      [id, firstName, middleName, lastName, studentEmailFor(id), name, Number(sem), dept],
    );

    res.status(201).json({ ok: true, id: result.rows[0].student_id });
  }),
);

app.put(
  "/api/students/:id",
  asyncRoute(async (req, res) => {
    const { name, dept, sem } = req.body;
    assertRequired(name, "Student name");
    assertRequired(dept, "Department");
    assertRequired(sem, "Semester");

    const { firstName, middleName, lastName } = splitName(name);
    const result = await pool.query(
      `
        UPDATE student
        SET
          first_name = $2,
          middle_name = $3,
          last_name = $4,
          hashed_password = crypt($5, gen_salt('bf')),
          semester = $6,
          department_id = $7
        WHERE student_id = $1
        RETURNING student_id
      `,
      [req.params.id, firstName, middleName, lastName, name, Number(sem), dept],
    );

    if (result.rowCount === 0) {
      throw httpError(404, "Student not found.");
    }

    res.json({ ok: true });
  }),
);

app.post(
  "/api/teachers",
  asyncRoute(async (req, res) => {
    const { id, name, email, subject } = req.body;
    assertRequired(id, "Teacher ID");
    assertRequired(name, "Teacher name");
    assertRequired(email, "Email");
    assertRequired(subject, "Subject");

    const client = await pool.connect();
    try {
      const departmentId = await getDefaultDepartmentId(client);
      const { firstName, middleName, lastName } = splitName(name);
      const result = await client.query(
        `
          INSERT INTO faculty (
            faculty_id,
            first_name,
            middle_name,
            last_name,
            email,
            hashed_password,
            designation,
            department_id
          )
          VALUES ($1, $2, $3, $4, $5, crypt($6, gen_salt('bf')), $7, $8)
          RETURNING faculty_id
        `,
        [id, firstName, middleName, lastName, email, "faculty123", subject, departmentId],
      );

      res.status(201).json({ ok: true, id: result.rows[0].faculty_id });
    } finally {
      client.release();
    }
  }),
);

app.put(
  "/api/teachers/:id",
  asyncRoute(async (req, res) => {
    const { name, email, subject } = req.body;
    assertRequired(name, "Teacher name");
    assertRequired(email, "Email");
    assertRequired(subject, "Subject");

    const { firstName, middleName, lastName } = splitName(name);
    const result = await pool.query(
      `
        UPDATE faculty
        SET
          first_name = $2,
          middle_name = $3,
          last_name = $4,
          email = $5,
          designation = $6
        WHERE faculty_id = $1
        RETURNING faculty_id
      `,
      [req.params.id, firstName, middleName, lastName, email, subject],
    );

    if (result.rowCount === 0) {
      throw httpError(404, "Teacher not found.");
    }

    res.json({ ok: true });
  }),
);

app.post(
  "/api/courses",
  asyncRoute(async (req, res) => {
    const { code, name, teacherId, subject } = req.body;
    assertRequired(code, "Course code");
    assertRequired(name, "Course name");
    assertRequired(teacherId, "Teacher");
    assertRequired(subject, "Subject");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const facultyResult = await client.query(
        "SELECT department_id FROM faculty WHERE faculty_id = $1",
        [teacherId],
      );

      if (facultyResult.rowCount === 0) {
        throw httpError(404, "Teacher not found.");
      }

      await client.query(
        `
          INSERT INTO course (
            course_id,
            course_code,
            course_name,
            subject_label,
            credits,
            department_id
          )
          VALUES ($1, $1, $2, $3, 3, $4)
        `,
        [code, name, subject, facultyResult.rows[0].department_id],
      );

      const offering = currentOfferingDefaults();
      await client.query(
        `
          INSERT INTO teaching_assignment (
            course_id,
            faculty_id,
            semester,
            academic_year,
            term,
            section
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          code,
          teacherId,
          offering.semester,
          offering.academicYear,
          offering.term,
          offering.section,
        ],
      );

      await client.query("COMMIT");
      res.status(201).json({ ok: true, code });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.put(
  "/api/courses/:code",
  asyncRoute(async (req, res) => {
    const { name, teacherId, subject } = req.body;
    assertRequired(name, "Course name");
    assertRequired(teacherId, "Teacher");
    assertRequired(subject, "Subject");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const facultyResult = await client.query(
        "SELECT department_id FROM faculty WHERE faculty_id = $1",
        [teacherId],
      );

      if (facultyResult.rowCount === 0) {
        throw httpError(404, "Teacher not found.");
      }

      const courseResult = await client.query(
        `
          UPDATE course
          SET
            course_name = $2,
            subject_label = $3,
            department_id = $4
          WHERE course_code = $1
          RETURNING course_id
        `,
        [req.params.code, name, subject, facultyResult.rows[0].department_id],
      );

      if (courseResult.rowCount === 0) {
        throw httpError(404, "Course not found.");
      }

      const assignmentResult = await client.query(
        `
          UPDATE teaching_assignment
          SET faculty_id = $2
          WHERE assignment_id = (
            SELECT assignment_id
            FROM teaching_assignment
            WHERE course_id = $1
            ORDER BY academic_year DESC, assignment_id DESC
            LIMIT 1
          )
        `,
        [courseResult.rows[0].course_id, teacherId],
      );

      if (assignmentResult.rowCount === 0) {
        const offering = currentOfferingDefaults();
        await client.query(
          `
            INSERT INTO teaching_assignment (
              course_id,
              faculty_id,
              semester,
              academic_year,
              term,
              section
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            courseResult.rows[0].course_id,
            teacherId,
            offering.semester,
            offering.academicYear,
            offering.term,
            offering.section,
          ],
        );
      }

      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.post(
  "/api/reset-seed",
  asyncRoute(async (_req, res) => {
    const seedSql = await fs.readFile(path.join(__dirname, "seed.sql"), "utf8");
    await pool.query(seedSql);
    res.json({ ok: true });
  }),
);

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

for (const fileName of ["style.css", "script.js", "data.js"]) {
  app.get(`/${fileName}`, (_req, res) => {
    res.sendFile(path.join(__dirname, fileName));
  });
}

app.listen(port, () => {
  console.log(`Feedback Hub server running at http://localhost:${port}`);
});
