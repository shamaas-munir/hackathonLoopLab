"""Where a student is in the exam journey. Used by login redirects, guards and admin badges."""

MIN_COURSES, MAX_COURSES = 4, 6


def flow_state(student, assignment_count: int | None = None) -> dict:
    if assignment_count is None:
        assignment_count = student.assignments.count()
    has_branch = student.branch_id is not None
    saved = student.datesheet_saved_at is not None
    complete = MIN_COURSES <= assignment_count <= MAX_COURSES
    needs_branch = (not has_branch) or student.branch_unlocked
    can_edit = complete and has_branch and ((not saved) or student.datesheet_unlocked)

    if needs_branch:
        home = "/student/select-branch"
    elif saved and not student.datesheet_unlocked:
        home = "/student/datesheet"
    else:
        home = "/student/dashboard"

    return {
        "has_branch": has_branch,
        "needs_branch_selection": needs_branch,
        "assignment_count": assignment_count,
        "assignment_complete": complete,
        "has_saved_datesheet": saved,
        "can_edit_datesheet": can_edit,
        "branch_unlocked": student.branch_unlocked,
        "datesheet_unlocked": student.datesheet_unlocked,
        "home_route": home,
    }
