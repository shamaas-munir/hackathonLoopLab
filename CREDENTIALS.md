# ExamSlot: Demo login credentials

Live site: https://hackathon-loop-lab.vercel.app
API docs: https://hackathonlooplab1.onrender.com/api/v1/docs/

These are demo accounts from the seed scripts (`manage.py seed` and `manage.py seed_mock`). No real secrets are in this file.

## Admin

| Role | Email | Password |
|---|---|---|
| Admin | `admin@examslot.app` | `Admin@123` |

## Main demo students

All students use the password **`Student@123`**.

| Student | Email | State (what you will see) |
|---|---|---|
| Ali Raza | `ali@student.examslot.app` | No branch yet: starts at branch selection |
| Sara Ahmed | `sara@student.examslot.app` | Branch chosen (Lahore): ready to pick exam slots |
| Muhammad Usman | `usman@student.examslot.app` | Date sheet saved and locked (6 courses) |
| Ayesha Khan | `ayesha@student.examslot.app` | Only 3 courses: "assignment incomplete" |
| Bilal Hussain | `bilal@student.examslot.app` | Date sheet saved, pending date sheet change request |

## Extra mock students

Same password: **`Student@123`**.

| Student | Email | State |
|---|---|---|
| Hamza Malik | `hamza.malik1@student.examslot.app` | No branch yet: starts at branch selection |
| Fatima Sheikh | `fatima.sheikh2@student.examslot.app` | Branch chosen: ready to pick slots |
| Zainab Qureshi | `zainab.qureshi3@student.examslot.app` | Date sheet saved and locked |
| Ahmed Butt | `ahmed.butt4@student.examslot.app` | Date sheet saved, has a change request (pending, change date sheet) |
| Hira Chaudhry | `hira.chaudhry5@student.examslot.app` | No branch yet: starts at branch selection |
| Omar Siddiqui | `omar.siddiqui6@student.examslot.app` | Only 3 courses: assignment incomplete |
| Maryam Abbasi | `maryam.abbasi7@student.examslot.app` | Date sheet saved and locked |
| Hassan Mirza | `hassan.mirza8@student.examslot.app` | Date sheet saved, has a change request (approved, change date sheet) |
| Iqra Javed | `iqra.javed9@student.examslot.app` | No branch yet: starts at branch selection |
| Saad Iqbal | `saad.iqbal10@student.examslot.app` | Branch chosen: ready to pick slots |
| Amna Malik | `amna.malik11@student.examslot.app` | Date sheet saved and locked |
| Talha Sheikh | `talha.sheikh12@student.examslot.app` | Date sheet saved, has a change request (rejected, change date sheet) |
| Mahnoor Qureshi | `mahnoor.qureshi13@student.examslot.app` | No branch yet: starts at branch selection |
| Usama Butt | `usama.butt14@student.examslot.app` | Branch chosen: ready to pick slots |
| Noor Chaudhry | `noor.chaudhry15@student.examslot.app` | Date sheet saved and locked |
| Daniyal Siddiqui | `daniyal.siddiqui16@student.examslot.app` | Date sheet saved, has a change request (pending, change date sheet) |
| Areeba Abbasi | `areeba.abbasi17@student.examslot.app` | No branch yet: starts at branch selection |
| Fahad Mirza | `fahad.mirza18@student.examslot.app` | Branch chosen: ready to pick slots |
| Sana Javed | `sana.javed19@student.examslot.app` | Date sheet saved and locked |
| Haris Iqbal | `haris.iqbal20@student.examslot.app` | Date sheet saved, has a change request (approved, change date sheet) |

## Notes

- New students created by the admin get a set-password email; use a password not similar to the email (e.g. `Exam!Slot2026`).
- Forgot password sends a 1-hour reset link; account setup links last 24 hours. Both work once.
- If a demo student was changed during testing, an admin can reset all demo data with `uv run python manage.py seed --reset` then `uv run python manage.py seed_mock` (this wipes all data).
