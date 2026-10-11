const state = {
  role: "student",
  currentStudent: null,
  selectedStudentId: null,
  selectedTeacherId: null,
  selectedCourseCode: null,
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) =>
  Array.from(scope.querySelectorAll(selector));

document.addEventListener("DOMContentLoaded", async () => {
  bindLogin();
  bindNavigation("#student-screen");
  bindNavigation("#admin-screen");
  bindStudentActions();
  bindAdminActions();
  updateLoginFields();

  try {
    await hydrateData();
    renderAll();
  } catch (error) {
    setMessage("login-message", apiOfflineMessage(error), "error");
  }
});

function bindLogin() {
  $$(".role-btn").forEach((button) => {
    button.addEventListener("click", () => {
      state.role = button.dataset.role;
      $$(".role-btn").forEach((item) =>
        item.classList.toggle("active", item === button),
      );
      updateLoginFields();
      setMessage("login-message", "");
    });
  });

  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = $("#login-id").value.trim();
    const secret = $("#login-secret").value.trim();

    try {
      const user = await loginApi(state.role, id, secret);
      if (state.role === "student") {
        state.currentStudent = user;
        showScreen("student-screen");
        renderStudentScreen();
      } else {
        showScreen("admin-screen");
        renderAdminScreen();
      }
    } catch (error) {
      setMessage("login-message", error.message, "error");
    }
  });

  $("#student-logout").addEventListener("click", logout);
  $("#admin-logout").addEventListener("click", logout);
}

function updateLoginFields() {
  const admin = state.role === "admin";
  $("#id-label").textContent = admin ? "Admin email" : "Student ID";
  $("#login-id").placeholder = admin ? "admin@amrita.edu" : "AM.SC.U4CSE25018";
  $("#secret-label").textContent = admin ? "Password" : "Full name";
  $("#login-secret").type = admin ? "password" : "text";
  $("#login-secret").placeholder = admin ? "admin123" : "Aditya Sahu";
  $("#login-id").value = "";
  $("#login-secret").value = "";
}

function bindNavigation(screenSelector) {
  const screen = $(screenSelector);
  $$(".nav-btn", screen).forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      $$(".nav-btn", screen).forEach((item) => {
        item.classList.toggle("active", item.dataset.view === view);
      });
      $$(".view", screen).forEach((panel) => {
        panel.classList.toggle("hidden", panel.dataset.view !== view);
      });
      renderAll();
    });
  });
}

function bindStudentActions() {
  $("#submit-feedback-btn").addEventListener("click", async () => {
    const courseCode = $("#feedback-course").value;
    const comment = $("#feedback-comment").value.trim();
    const ratings = $$("#question-box input[type='range']").map((input) =>
      Number(input.value),
    );

    if (!state.currentStudent) return;
    if (!courseCode) {
      setMessage("submit-feedback-message", "Please select a course.", "error");
      return;
    }

    try {
      await submitFeedbackApi({
        studentId: state.currentStudent.id,
        courseCode,
        ratings,
        comment,
      });
      $("#feedback-comment").value = "";
      $("#feedback-course").value = "";
      $$("#question-box input[type='range']").forEach((input) => {
        input.value = "3";
        input.dispatchEvent(new Event("input"));
      });
      setMessage("submit-feedback-message", "Feedback saved.", "success");
      renderAll();
    } catch (error) {
      setMessage("submit-feedback-message", error.message, "error");
    }
  });
}

function bindAdminActions() {
  $("#student-add").addEventListener("click", addStudent);
  $("#student-load").addEventListener("click", loadSelectedStudent);
  $("#student-update").addEventListener("click", updateStudent);

  $("#teacher-add").addEventListener("click", addTeacher);
  $("#teacher-load").addEventListener("click", loadSelectedTeacher);
  $("#teacher-update").addEventListener("click", updateTeacher);

  $("#course-add").addEventListener("click", addCourse);
  $("#course-load").addEventListener("click", loadSelectedCourse);
  $("#course-update").addEventListener("click", updateCourse);

  $("#feedback-refresh").addEventListener("click", async () => {
    try {
      await hydrateData();
      renderFeedbackResults();
      setMessage("feedback-message", "Results refreshed.", "success");
    } catch (error) {
      setMessage("feedback-message", error.message, "error");
    }
  });
  $("#feedback-save").addEventListener("click", exportFeedback);
  $("#report-generate").addEventListener("click", renderCourseReport);
  $("#reset-demo").addEventListener("click", async () => {
    try {
      await resetSeedDataApi();
      state.selectedStudentId = null;
      state.selectedTeacherId = null;
      state.selectedCourseCode = null;
      renderAll();
    } catch (error) {
      alert(error.message);
    }
  });
}

function showScreen(screenId) {
  $$(".screen").forEach((screen) => screen.classList.add("hidden"));
  $("#" + screenId).classList.remove("hidden");
}

function logout() {
  state.currentStudent = null;
  state.role = "student";
  $("#login-form").reset();
  $$(".role-btn").forEach((item) =>
    item.classList.toggle("active", item.dataset.role === "student"),
  );
  updateLoginFields();
  setMessage("login-message", "");
  showScreen("login-screen");
}

function renderAll() {
  renderLoginMetrics();
  renderCourseOptions();
  renderQuestionBox();
  renderStudentScreen();
  renderAdminScreen();
}

function renderLoginMetrics() {
  $("#login-metrics").innerHTML = [
    metricCard(DB.students.length, "Students"),
    metricCard(DB.courses.length, "Courses"),
    metricCard(DB.feedbacks.length, "Feedbacks"),
  ].join("");
}

function renderStudentScreen() {
  if (!state.currentStudent) return;

  $("#student-header-name").textContent = state.currentStudent.name;
  $("#student-sidebar-id").textContent = state.currentStudent.id;
  renderMyFeedbacks();
  renderStudentProfile();
}

function renderAdminScreen() {
  $("#admin-header-name").textContent = DB.admin.name || "Course Admin";
  $("#admin-sidebar-email").textContent = DB.admin.email || "admin@amrita.edu";
  renderAdminMetrics();
  renderChart();
  renderRecentFeedback();
  renderStudentsTable();
  renderTeachersTable();
  renderCoursesTable();
  renderFeedbackResults();
  renderCourseOptions();
}

function renderCourseOptions() {
  const courseOptions = DB.courses
    .map(
      (course) =>
        `<option value="${escapeHtml(course.code)}">${escapeHtml(course.code)} - ${escapeHtml(course.name)}</option>`,
    )
    .join("");

  const feedbackSelect = $("#feedback-course");
  const previousFeedbackValue = feedbackSelect.value;
  feedbackSelect.innerHTML = `<option value="">Select course</option>${courseOptions}`;
  feedbackSelect.value = previousFeedbackValue;

  const reportSelect = $("#report-course");
  const previousReportValue = reportSelect.value;
  reportSelect.innerHTML = `<option value="">Select course</option>${courseOptions}`;
  reportSelect.value = previousReportValue;

  $("#course-teacher").innerHTML = DB.teachers
    .map(
      (teacher) =>
        `<option value="${escapeHtml(teacher.id)}">${escapeHtml(teacher.name)} (${escapeHtml(teacher.id)})</option>`,
    )
    .join("");
}

function renderQuestionBox() {
  $("#question-count").textContent = `${DB.questions.length} questions`;
  $("#question-box").innerHTML = DB.questions
    .map(
      (question) => `
        <div class="question-row">
          <label for="q-${question.no}">Q${question.no}. ${escapeHtml(question.text)}</label>
          <input id="q-${question.no}" type="range" min="1" max="5" step="1" value="3" />
          <output>3</output>
        </div>
      `,
    )
    .join("");

  $$("#question-box input[type='range']").forEach((input) => {
    input.addEventListener("input", () => {
      input.nextElementSibling.textContent = input.value;
    });
  });
}

function renderAdminMetrics() {
  $("#admin-metrics").innerHTML = [
    metricCard(DB.students.length, "Students"),
    metricCard(DB.teachers.length, "Faculty"),
    metricCard(DB.courses.length, "Courses"),
    metricCard(overallAverage().toFixed(1), "Avg rating"),
  ].join("");
}

function renderChart() {
  const bars = DB.courses.map((course) => {
    const average = courseAverage(course.code);
    const height = Math.max((average / 5) * 100, 4);
    return `
      <div class="chart-item">
        <span class="chart-value">${average.toFixed(1)}</span>
        <div class="chart-track">
          <div class="chart-bar" style="height: ${height}%"></div>
        </div>
        <span class="chart-label">${escapeHtml(course.subject)}</span>
      </div>
    `;
  });

  $("#rating-chart").innerHTML = bars.join("") || emptyRow("No courses yet.");
}

function renderRecentFeedback() {
  const recent = [...DB.feedbacks].reverse().slice(0, 5);
  $("#recent-count").textContent = `${DB.feedbacks.length} total`;

  if (recent.length === 0) {
    $("#recent-feedback-list").innerHTML = emptyRow(
      "No feedback submitted yet.",
    );
    return;
  }

  $("#recent-feedback-list").innerHTML = recent
    .map(
      (feedback) => `
        <article class="feedback-card">
          <span class="avatar">${initialsFor(studentName(feedback.studentId))}</span>
          <div>
            <strong>${escapeHtml(studentName(feedback.studentId))}</strong>
            <p>${escapeHtml(courseName(feedback.courseCode))}</p>
            <small>${escapeHtml(feedback.comment || "No comment")}</small>
          </div>
          <span class="rating">${feedbackAverage(feedback).toFixed(1)}</span>
        </article>
      `,
    )
    .join("");
}

function renderMyFeedbacks() {
  const feedbacks = feedbacksForStudent(state.currentStudent.id);
  $("#my-feedback-body").innerHTML =
    feedbacks
      .map(
        (feedback) => `
          <tr>
            <td>${escapeHtml(courseName(feedback.courseCode))}</td>
            <td><span class="score">${feedbackAverage(feedback).toFixed(2)}</span></td>
            <td>${formatDate(feedback.date)}</td>
            <td>${escapeHtml(feedback.comment || "No comment")}</td>
          </tr>
        `,
      )
      .join("") || tableEmpty(4, "No feedback submitted yet.");
}

function renderStudentProfile() {
  const student = state.currentStudent;
  $("#student-profile-details").innerHTML = [
    detailRow("Name", student.name),
    detailRow("Student ID", student.id),
    detailRow("Department", student.dept),
    detailRow("Semester", String(student.sem)),
    detailRow(
      "Feedbacks submitted",
      String(feedbacksForStudent(student.id).length),
    ),
  ].join("");
}

function renderStudentsTable() {
  $("#students-body").innerHTML =
    DB.students
      .map(
        (student) => `
        <tr data-id="${escapeHtml(student.id)}" class="${student.id === state.selectedStudentId ? "selected" : ""}">
          <td>${escapeHtml(student.id)}</td>
          <td>${escapeHtml(student.name)}</td>
          <td>${escapeHtml(student.dept)}</td>
          <td>${student.sem}</td>
        </tr>
      `,
      )
      .join("") || tableEmpty(4, "No students yet.");

  bindTableSelection("#students-body", "selectedStudentId");
}

function renderTeachersTable() {
  $("#teachers-body").innerHTML =
    DB.teachers
      .map(
        (teacher) => `
        <tr data-id="${escapeHtml(teacher.id)}" class="${teacher.id === state.selectedTeacherId ? "selected" : ""}">
          <td>${escapeHtml(teacher.id)}</td>
          <td>${escapeHtml(teacher.name)}</td>
          <td>${escapeHtml(teacher.email)}</td>
          <td>${escapeHtml(teacher.subject)}</td>
        </tr>
      `,
      )
      .join("") || tableEmpty(4, "No faculty yet.");

  bindTableSelection("#teachers-body", "selectedTeacherId");
}

function renderCoursesTable() {
  $("#courses-body").innerHTML =
    DB.courses
      .map(
        (course) => `
        <tr data-id="${escapeHtml(course.code)}" class="${course.code === state.selectedCourseCode ? "selected" : ""}">
          <td>${escapeHtml(course.code)}</td>
          <td>${escapeHtml(course.name)}</td>
          <td>${escapeHtml(teacherName(course.teacherId))}</td>
          <td>${escapeHtml(course.subject)}</td>
          <td><span class="score">${courseAverage(course.code).toFixed(2)}</span></td>
        </tr>
      `,
      )
      .join("") || tableEmpty(5, "No courses yet.");

  bindTableSelection("#courses-body", "selectedCourseCode");
}

function renderFeedbackResults() {
  $("#feedback-metrics").innerHTML = [
    metricCard(DB.feedbacks.length, "Total feedbacks"),
    metricCard(overallAverage().toFixed(2), "Overall avg"),
    metricCard(bestCourseLabel(), "Top course"),
  ].join("");

  $("#all-feedback-body").innerHTML =
    DB.feedbacks
      .map(
        (feedback) => `
          <tr>
            <td>${escapeHtml(studentName(feedback.studentId))}</td>
            <td>${escapeHtml(courseName(feedback.courseCode))}</td>
            <td><span class="score">${feedbackAverage(feedback).toFixed(2)}</span></td>
            <td>${formatDate(feedback.date)}</td>
            <td>${escapeHtml(feedback.comment || "No comment")}</td>
          </tr>
        `,
      )
      .join("") || tableEmpty(5, "No feedback submitted yet.");

  $("#course-averages").innerHTML =
    DB.courses
      .map((course) => {
        const average = courseAverage(course.code);
        return `
        <div class="average-row">
          <div>
            <strong>${escapeHtml(course.name)}</strong>
            <span>${escapeHtml(course.code)} &middot; ${escapeHtml(teacherName(course.teacherId))}</span>
          </div>
          <progress max="5" value="${average}"></progress>
          <b>${average.toFixed(2)}</b>
        </div>
      `;
      })
      .join("") || emptyRow("No courses yet.");
}

function renderCourseReport() {
  const courseCode = $("#report-course").value;
  const output = $("#report-output");

  if (!courseCode) {
    output.innerHTML = `<p class="hint">Please select a course.</p>`;
    return;
  }

  const course = findCourse(courseCode);
  const feedbacks = feedbacksForCourse(courseCode);

  if (!course || feedbacks.length === 0) {
    output.innerHTML = `<p class="hint">No feedback has been submitted for this course yet.</p>`;
    return;
  }

  const questionRows = DB.questions
    .map((question, index) => {
      const total = feedbacks.reduce(
        (sum, feedback) => sum + feedback.ratings[index],
        0,
      );
      const average = total / feedbacks.length;
      return `
        <div class="average-row">
          <div>
            <strong>Q${question.no}. ${escapeHtml(question.text)}</strong>
            <span>Average rating</span>
          </div>
          <progress max="5" value="${average}"></progress>
          <b>${average.toFixed(2)}</b>
        </div>
      `;
    })
    .join("");

  output.innerHTML = `
    <div class="report-header">
      <div>
        <p class="eyebrow">${escapeHtml(course.code)}</p>
        <h3>${escapeHtml(course.name)}</h3>
        <p>${escapeHtml(teacherName(course.teacherId))} &middot; ${feedbacks.length} responses</p>
      </div>
      <span class="big-score">${courseAverage(courseCode).toFixed(2)}</span>
    </div>
    ${questionRows}
  `;
}

async function addStudent() {
  const student = {
    id: $("#student-id").value.trim(),
    name: $("#student-name").value.trim(),
    dept: $("#student-dept").value.trim(),
    sem: Number($("#student-sem").value.trim()),
  };

  if (!student.id || !student.name || !student.dept || !student.sem) {
    setMessage("student-message", "Fill all student details.", "error");
    return;
  }
  if (findStudent(student.id)) {
    setMessage("student-message", "Student ID already exists.", "error");
    return;
  }

  try {
    await createStudentApi(student);
    clearFields("student-id", "student-name", "student-dept", "student-sem");
    setMessage("student-message", "Student saved.", "success");
    renderAll();
  } catch (error) {
    setMessage("student-message", error.message, "error");
  }
}

function loadSelectedStudent() {
  const student = findStudent(state.selectedStudentId || "");
  if (!student) {
    setMessage("student-message", "Select a student first.", "error");
    return;
  }

  $("#student-id").value = student.id;
  $("#student-id").disabled = true;
  $("#student-name").value = student.name;
  $("#student-dept").value = student.dept;
  $("#student-sem").value = student.sem;
}

async function updateStudent() {
  const student = findStudent(state.selectedStudentId || "");
  if (!student) {
    setMessage("student-message", "Select a student to update.", "error");
    return;
  }

  const updated = {
    name: $("#student-name").value.trim(),
    dept: $("#student-dept").value.trim(),
    sem: Number($("#student-sem").value.trim()),
  };
  if (!updated.name || !updated.dept || !updated.sem) {
    setMessage("student-message", "Fill all update details.", "error");
    return;
  }

  try {
    await updateStudentApi(student.id, updated);
    $("#student-id").disabled = false;
    clearFields("student-id", "student-name", "student-dept", "student-sem");
    setMessage("student-message", "Student updated.", "success");
    renderAll();
  } catch (error) {
    setMessage("student-message", error.message, "error");
  }
}

async function addTeacher() {
  const teacher = {
    id: $("#teacher-id").value.trim(),
    name: $("#teacher-name").value.trim(),
    email: $("#teacher-email").value.trim(),
    subject: $("#teacher-subject").value.trim(),
  };

  if (!teacher.id || !teacher.name || !teacher.email || !teacher.subject) {
    setMessage("teacher-message", "Fill all teacher details.", "error");
    return;
  }
  if (findTeacher(teacher.id)) {
    setMessage("teacher-message", "Teacher ID already exists.", "error");
    return;
  }

  try {
    await createTeacherApi(teacher);
    clearFields(
      "teacher-id",
      "teacher-name",
      "teacher-email",
      "teacher-subject",
    );
    setMessage("teacher-message", "Teacher saved.", "success");
    renderAll();
  } catch (error) {
    setMessage("teacher-message", error.message, "error");
  }
}

function loadSelectedTeacher() {
  const teacher = findTeacher(state.selectedTeacherId || "");
  if (!teacher) {
    setMessage("teacher-message", "Select a teacher first.", "error");
    return;
  }

  $("#teacher-id").value = teacher.id;
  $("#teacher-id").disabled = true;
  $("#teacher-email").value = teacher.email;
  $("#teacher-name").value = teacher.name;
  $("#teacher-subject").value = teacher.subject;
}

async function updateTeacher() {
  const teacher = findTeacher(state.selectedTeacherId || "");
  if (!teacher) {
    setMessage("teacher-message", "Select a teacher to update.", "error");
    return;
  }

  const updated = {
    name: $("#teacher-name").value.trim(),
    email: $("#teacher-email").value.trim(),
    subject: $("#teacher-subject").value.trim(),
  };
  if (!updated.name || !updated.email || !updated.subject) {
    setMessage("teacher-message", "Fill all update details.", "error");
    return;
  }

  try {
    await updateTeacherApi(teacher.id, updated);
    $("#teacher-id").disabled = false;
    clearFields(
      "teacher-id",
      "teacher-name",
      "teacher-email",
      "teacher-subject",
    );
    setMessage("teacher-message", "Teacher updated.", "success");
    renderAll();
  } catch (error) {
    setMessage("teacher-message", error.message, "error");
  }
}

async function addCourse() {
  const course = {
    code: $("#course-code").value.trim(),
    name: $("#course-name").value.trim(),
    teacherId: $("#course-teacher").value,
    subject: $("#course-subject").value.trim(),
  };

  if (!course.code || !course.name || !course.teacherId || !course.subject) {
    setMessage("course-message", "Fill all course details.", "error");
    return;
  }
  if (findCourse(course.code)) {
    setMessage("course-message", "Course code already exists.", "error");
    return;
  }

  try {
    await createCourseApi(course);
    clearFields("course-code", "course-name", "course-subject");
    setMessage("course-message", "Course saved.", "success");
    renderAll();
  } catch (error) {
    setMessage("course-message", error.message, "error");
  }
}

function loadSelectedCourse() {
  const course = findCourse(state.selectedCourseCode || "");
  if (!course) {
    setMessage("course-message", "Select a course first.", "error");
    return;
  }

  $("#course-code").value = course.code;
  $("#course-code").disabled = true;
  $("#course-name").value = course.name;
  $("#course-teacher").value = course.teacherId;
  $("#course-subject").value = course.subject;
}

async function updateCourse() {
  const course = findCourse(state.selectedCourseCode || "");
  if (!course) {
    setMessage("course-message", "Select a course to update.", "error");
    return;
  }

  const updated = {
    name: $("#course-name").value.trim(),
    teacherId: $("#course-teacher").value,
    subject: $("#course-subject").value.trim(),
  };
  if (!updated.name || !updated.teacherId || !updated.subject) {
    setMessage("course-message", "Fill all update details.", "error");
    return;
  }

  try {
    await updateCourseApi(course.code, updated);
    $("#course-code").disabled = false;
    clearFields("course-code", "course-name", "course-subject");
    setMessage("course-message", "Course updated.", "success");
    renderAll();
  } catch (error) {
    setMessage("course-message", error.message, "error");
  }
}

function exportFeedback() {
  const rows = DB.feedbacks.map((feedback) => ({
    student: studentName(feedback.studentId),
    course: courseName(feedback.courseCode),
    average: feedbackAverage(feedback).toFixed(2),
    date: feedback.date,
    comment: feedback.comment,
  }));
  const blob = new Blob([JSON.stringify(rows, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "feedback-export.json";
  link.click();
  URL.revokeObjectURL(link.href);
  setMessage("feedback-message", "Feedback exported.", "success");
}

function bindTableSelection(bodySelector, stateKey) {
  $$(bodySelector + " tr[data-id]").forEach((row) => {
    row.addEventListener("click", () => {
      state[stateKey] = row.dataset.id;
      $$(bodySelector + " tr[data-id]").forEach((item) =>
        item.classList.remove("selected"),
      );
      row.classList.add("selected");
    });
  });
}

function bestCourseLabel() {
  if (DB.courses.length === 0) return "N/A";
  const best = DB.courses.reduce((top, course) => {
    return courseAverage(course.code) > courseAverage(top.code) ? course : top;
  }, DB.courses[0]);
  return best.subject || best.code;
}

function metricCard(value, label) {
  return `
    <article class="metric-card">
      <strong>${escapeHtml(String(value))}</strong>
      <span>${escapeHtml(label)}</span>
    </article>
  `;
}

function detailRow(label, value) {
  return `
    <div class="detail-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function tableEmpty(columns, message) {
  return `<tr><td class="empty" colspan="${columns}">${escapeHtml(message)}</td></tr>`;
}

function emptyRow(message) {
  return `<p class="hint">${escapeHtml(message)}</p>`;
}

function clearFields(...ids) {
  ids.forEach((id) => {
    const field = $("#" + id);
    field.value = "";
    field.disabled = false;
  });
}

function setMessage(id, text, type = "") {
  const element = $("#" + id);
  element.textContent = text;
  element.className = "message";
  if (type) element.classList.add(type);
}

function apiOfflineMessage(error) {
  return `${error.message} This is a UI-only preview — the database layer isn't connected yet.`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
