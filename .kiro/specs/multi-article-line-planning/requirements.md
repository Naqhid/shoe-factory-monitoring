# Requirements Document

## Introduction

Today a production line (work centre) can run only one article (style) per day. The `production_plan` table is unique on (plan_date, work_centre_id) and the `line_style_assignments` table is unique on (assignment_date, work_centre_id). WIP is tracked per line per day in `wip_daily_state`, and reports, the TV dashboard and the mobile production screen compute targets from a single plan per line per day.

This feature lets a planner schedule several articles on the same line on the same day, and lets two or more of those articles run on the line at the same time. Each machine on the line is assigned to an article, and the cycles recorded on a machine count against the article assigned to that machine. Each article keeps its own target, its own WIP visibility and its own output counts, so supervisors keep control of every article on the line.

### Assumptions (defaults chosen for open questions; please confirm or change)

- **A1. Parallel execution (decided by Naqhid).** Two or more articles can run on the same line at the same time on the same day. There is no single "active" article and no sequential switch.
- **A2. Explicit target per article.** The planner enters a target quantity for each article. The day's line target is the sum of the article targets. The system does not split a single day target automatically.
- **A3. Sequence number is display order only.** Each article has a sequence number that defines the order in which articles are listed on the planning screen, reports and dashboards. The sequence number does not define run order, and any article can run at any time.
- **A4. Machine-level article assignment (to confirm).** Each machine on a line, together with its operator session, is assigned to exactly one Article_Plan at a time. Input and output cycles are attributed to the Article_Plan assigned to the machine that recorded the cycle. A Supervisor can change an Article_Assignment during the day, and the change applies only to cycles recorded after the change time.
- **A5. Shared input and end-of-line machines (to confirm).** An input machine or an end-of-line machine can be assigned to several Article_Plans at the same time (a Shared_Machine). For each cycle on a Shared_Machine, the operator session selects the article, and the cycle is attributed to the selected article. Other machine types (process machines) can have only one Article_Assignment at a time.
- **A6. Machine with no article assigned (to confirm).** The system does not reject the cycle, so that no production is lost. The cycle is recorded as unassigned, the machine is flagged to the Supervisor, and the quantity is reported separately as Unassigned_Output. Unassigned cycles do not change any Article_WIP. Reassigning an unassigned cycle to an article afterwards is out of scope.
- **A7. Line output with unassigned output.** Line-level output equals the sum of the per-article output plus Unassigned_Output. Line-level WIP equals the sum of the Article_WIP values.
- **A8. Target reached while other articles keep running (to confirm).** When one article reaches its target, the system keeps its Article_Assignments and keeps counting its output (completion can exceed 100%). The system shows a prompt to the Supervisor to reassign the machines. The system does not stop or reassign machines automatically, and the other Running_Articles are not affected.
- **A9. Per-article WIP.** WIP is tracked per article per line per day. Input and output cycles change only the WIP of the article they are attributed to.
- **A10. Changeover.** An Article_Assignment change reuses the existing changeover behaviour (machine reassignment based on the routing of the newly assigned article), applied only to the machines affected by the change.
- **A11. Day start (to confirm).** On a Line with exactly one Article_Plan, all machines are assigned to that Article_Plan automatically. On a Line with two or more Article_Plans, no machine is assigned at the start of the day until a Supervisor assigns it, and the Assignments of the previous day are not copied. Copying a plan to another date copies Article_Plans only, not Article_Assignments.
- **A12. Backward compatibility.** A line with one article behaves exactly as it does today.

## Glossary

- **Planning_System**: The production planning module (frontend `ProductionPlanningForm` and backend `productionPlanningController` / `productionPlanningBoardService`).
- **Line**: A work centre on which production runs.
- **Machine**: A machine on a Line. A Machine is an input machine, an end-of-line machine, or a process machine.
- **Operator_Session**: The logged-in session of an operator on a Machine.
- **Article**: A shoe style (`style_id`) that can be planned on a Line.
- **Line_Day_Plan**: The set of all Article_Plans for one Line on one date.
- **Article_Plan**: One planned article on a Line for a date, with a sequence number (display order) and a target quantity.
- **Article_Assignment**: The assignment of one Machine, together with its Operator_Session, to one Article_Plan of the Line_Day_Plan, effective from a change time until it is changed.
- **Running_Article**: An Article_Plan that has at least one Article_Assignment in effect. Several Running_Articles can exist on a Line at the same time.
- **Shared_Machine**: An input machine or an end-of-line machine that has two or more Article_Assignments in effect at the same time.
- **Unassigned_Output**: The quantity of cycles recorded on a Machine that has no Article_Assignment in effect at the cycle time, or on a Shared_Machine without an article selection. These cycles are attributed to no Article_Plan.
- **Assignment_History**: The chronological record of Article_Assignment changes.
- **Article_WIP**: Opening WIP, input, output, current WIP and closing WIP for one Article on one Line on one date.
- **WIP_System**: The WIP tracking service (`wipStateService`) and the `wip_daily_state` data.
- **Assignment_System**: The line style assignment service (`lineStyleAssignmentService`) and its board.
- **Reporting_System**: The reports (Reports.tsx / apiController.js), TV dashboard and mobile production screen that display targets and output.
- **Planner**: A user who creates and edits production plans.
- **Supervisor**: A user who runs a Line and changes Article_Assignments.

## Requirements

### Requirement 1: Plan multiple articles on one line per day

**User Story:** As a Planner, I want to plan more than one article on the same line on the same day, so that the line can finish several orders without separate workarounds.

#### Acceptance Criteria

1. THE Planning_System SHALL store between 1 and 20 Article_Plans for each Line and date.
2. WHEN a Planner adds an Article_Plan for a Line and date that already has a different Article, THE Planning_System SHALL add the Article_Plan to the Line_Day_Plan, keep all existing Article_Plans unchanged, and assign the new Article_Plan a sequence number equal to the previous highest sequence number plus 1.
3. IF a Planner adds an Article_Plan with an Article that already exists in the same Line_Day_Plan, THEN THE Planning_System SHALL reject the request with an error message naming the duplicate Article and SHALL leave the Line_Day_Plan unchanged.
4. IF a Planner adds an Article_Plan to a Line_Day_Plan that already contains 20 Article_Plans, THEN THE Planning_System SHALL reject the request with an error message stating that the maximum of 20 Article_Plans has been reached and SHALL leave the Line_Day_Plan unchanged.
5. IF a Planner submits an Article_Plan whose target quantity is not a whole number from 1 to 999,999, THEN THE Planning_System SHALL reject the request with an error message stating the allowed range and SHALL leave the Line_Day_Plan unchanged.
6. THE Planning_System SHALL assign each Article_Plan a sequence number that defines its display order only, is unique within its Line_Day_Plan, starts at 1, and has no gaps.
7. WHEN a Planner reorders Article_Plans, THE Planning_System SHALL update the sequence numbers so that they are unique and contiguous from 1 to the number of Article_Plans, SHALL apply the new order to all Article_Plans in a single operation or to none of them, and SHALL leave all Article_Assignments, output and Article_WIP unchanged.
8. WHEN a Planner deletes an Article_Plan that has no recorded output, no Article_WIP and no Article_Assignment in effect for the day, THE Planning_System SHALL remove only that Article_Plan and SHALL renumber the remaining Article_Plans so that sequence numbers stay unique and contiguous from 1, preserving their relative order.
9. THE Planning_System SHALL calculate the Line_Day_Plan target as the sum of the target quantities of its Article_Plans, and SHALL recalculate it after each add, edit, or delete of an Article_Plan.
10. IF a Planner deletes an Article_Plan that has recorded output greater than zero, Article_WIP greater than zero, or an Article_Assignment in effect for the day, THEN THE Planning_System SHALL reject the deletion with an error message stating the reason (production has been recorded, or machines are assigned) and SHALL leave the Article_Plan and all sequence numbers unchanged.

### Requirement 2: Planning screen for multi-article lines

**User Story:** As a Planner, I want to see and edit all articles of a line in one place, so that I can review the whole day on that line.

#### Acceptance Criteria

1. WHEN a Planner opens the planning screen for a date, THE Planning_System SHALL display, for each Line, every Article_Plan for that Line and date in ascending sequence number (display) order, showing the Article, the target quantity as a whole number and the status, within 2 seconds for up to 50 Lines with up to 20 Article_Plans each.
2. WHEN the planning screen displays a Line and date, THE Planning_System SHALL display the Line_Day_Plan total target next to the Line, equal to the sum of the target quantities of all Article_Plans of that Line and date, and SHALL show 0 for a Line with no Article_Plan.
3. WHEN a Planner opens the add/edit dialog for a Line that already has at least one Article_Plan, THE Planning_System SHALL offer an option to add another Article_Plan and an option to edit each existing Article_Plan.
4. WHEN a Planner confirms a copy of a day or a week of plans, THE Planning_System SHALL create, for each Line in the source range, an Article_Plan at the destination date with the same Article, sequence number and target quantity as the source Article_Plan, and SHALL create no Article_Assignment at the destination date.
5. WHEN a Planner copies a day or a week of plans and the destination already contains Article_Plans for a Line, THE Planning_System SHALL show the existing and incoming Article_Plans of that Line side by side in the copy preview and SHALL require the Planner to choose one of keep, replace or merge before the copy can be confirmed.
6. WHEN a Planner confirms the copy with the choice keep, THE Planning_System SHALL retain the existing Article_Plans of the Line and discard the incoming ones. WHEN the choice is replace, THE Planning_System SHALL delete the existing Article_Plans of the Line and create the incoming ones. WHEN the choice is merge, THE Planning_System SHALL retain the existing Article_Plans and append each incoming Article_Plan whose Article is not already planned for that Line and date, after the highest existing sequence number and in the incoming sequence order.
7. WHEN a Planner imports plans from Excel and the file has several rows for the same Line and date, THE Planning_System SHALL create one Article_Plan per row, with sequence numbers assigned in row order starting after any existing Article_Plans for that Line and date.
8. IF an Excel row duplicates an Article already planned for the same Line and date, THEN THE Planning_System SHALL skip that row, continue importing the remaining rows, and report the row number of each skipped row in the import result.
9. IF an Excel row has an unknown Line, an unknown Article, or a target quantity that is not a whole number from 1 to 999,999, THEN THE Planning_System SHALL skip that row, continue importing the remaining rows, and report the row number and the reason for each skipped row in the import result.
10. IF a Planner cancels the copy preview, THEN THE Planning_System SHALL close the preview and leave all existing Article_Plans at the destination unchanged.
11. WHEN a Line has no Article_Plan for a working date, THE Planning_System SHALL show the existing plan gap banner for that Line.

### Requirement 3: Article assignment to machines and sessions

**User Story:** As a Supervisor, I want to assign each machine on my line to an article, so that several articles can run in parallel and output is counted against the article actually being made on each machine.

#### Acceptance Criteria

1. THE Assignment_System SHALL allow two or more Article_Plans of the same Line_Day_Plan to be Running_Articles at the same time, with a maximum of 20 Article_Plans per Line_Day_Plan.
2. THE Assignment_System SHALL keep each Machine that is not a Shared_Machine assigned to at most one Article_Plan at any time.
3. WHEN a Supervisor assigns a Machine to an Article_Plan of the Line_Day_Plan, THE Assignment_System SHALL make the Article_Assignment effective for the Machine and its Operator_Session within 5 seconds and SHALL record the change time.
4. WHEN a Supervisor changes the Article_Assignment of a Machine to another Article_Plan of the same Line_Day_Plan, THE Assignment_System SHALL apply the new Article_Assignment to cycles recorded after the change time and SHALL keep the attribution of cycles recorded before the change time unchanged.
5. WHEN an Article_Assignment is changed for one or more Machines, THE Assignment_System SHALL apply the existing changeover machine reassignment using the routing of the newly assigned Article, for the affected Machines only, and SHALL leave the Article_Assignments and machine reassignments of all other Running_Articles unchanged.
6. IF a Supervisor requests an Article_Assignment to an Article that is not in the Line_Day_Plan, THEN THE Assignment_System SHALL reject the request, show an error message to the Supervisor indicating the Article is not in the Line_Day_Plan, keep the current Article_Assignments, and make no change to the machine assignments or the Assignment_History.
7. IF an Article_Assignment change fails during the changeover machine reassignment, THEN THE Assignment_System SHALL roll back the change, keep the previous Article_Assignments and machine assignments, and show an error message to the Supervisor indicating the change failed.
8. WHEN a Supervisor assigns an input machine or an end-of-line machine to a second Article_Plan while its first Article_Assignment is still in effect, THE Assignment_System SHALL keep both Article_Assignments in effect and treat the Machine as a Shared_Machine.
9. IF a Supervisor assigns a process machine to a second Article_Plan while its first Article_Assignment is still in effect, THEN THE Assignment_System SHALL reject the request, show an error message stating that only input machines and end-of-line machines can be shared, and keep the existing Article_Assignment.
10. WHEN a cycle is recorded on a Shared_Machine, THE Assignment_System SHALL require the Operator_Session to select one of the Article_Plans assigned to that Machine, and SHALL attribute the cycle to the selected Article_Plan.
11. IF the Operator_Session selects an Article_Plan that is not assigned to the Shared_Machine at the cycle time, THEN THE Assignment_System SHALL reject the cycle with an error message naming the Article, record no cycle, and leave all Article_WIP unchanged.
12. IF a cycle is recorded on a Shared_Machine without an article selection, THEN THE Assignment_System SHALL record the cycle as Unassigned_Output and flag the Machine to the Supervisor within 5 seconds.
13. IF a cycle is recorded on a Machine of a Line with two or more Article_Plans and the Machine has no Article_Assignment in effect at the cycle time, THEN THE Assignment_System SHALL record the cycle as Unassigned_Output, attribute it to no Article_Plan, and flag the Machine to the Supervisor within 5 seconds.
14. WHEN a Machine is assigned to one Article_Plan and a Supervisor changes the Article_Assignment to another Article_Plan during the same clock hour, THE Assignment_System SHALL attribute each cycle to the Article_Plan assigned at that cycle's recorded time, so that for each Machine and hour the per-Article counts plus the Unassigned_Output equal the total count of cycles recorded by the Machine in that hour.
15. WHEN a Line has exactly one Article_Plan on a date, THE Assignment_System SHALL treat every Machine of the Line as assigned to that Article_Plan from the start of the day, including Machines added to the Line later that day.
16. WHEN a day starts and a Line has two or more Article_Plans, THE Assignment_System SHALL start the day with no Article_Assignment in effect until a Supervisor assigns Machines.
17. WHEN an Article_Plan reaches its target quantity, THE Assignment_System SHALL show a prompt to the Supervisor within 5 seconds to reassign the Machines of that Article_Plan, SHALL keep the Article_Assignments of that Article_Plan in effect until the Supervisor changes them, SHALL continue to attribute cycles above the target to that Article_Plan, and SHALL leave all other Running_Articles unchanged.
18. WHEN an Article_Assignment is created or changed, THE Assignment_System SHALL add an entry to the Assignment_History containing the change time, the Machine, the previous Article (or none), the new Article and the Supervisor, and SHALL retain entries in chronological order.

### Requirement 4: Per-article WIP visibility and control

**User Story:** As a Supervisor, I want to see WIP for each article on the line, so that I know how much unfinished work of each article is on the floor while several articles run in parallel.

#### Acceptance Criteria

1. WHEN a Line has one or more Article_Plans on a date, THE WIP_System SHALL maintain, for each Article_Plan of that Line on that date, an Article_WIP record containing opening WIP, input, output, current WIP and closing WIP, each as a whole number from 0 to 999,999.
2. WHEN an input-machine cycle is recorded and attributed to an Article_Plan, THE WIP_System SHALL add the cycle quantity to the input and to the current WIP of that Article_Plan within 1 second of the cycle being recorded.
3. WHEN an end-of-line machine cycle is recorded, is attributed to an Article_Plan, and the cycle quantity is less than or equal to the current WIP of that Article_Plan, THE WIP_System SHALL add the cycle quantity to the output of that Article_Plan and reduce the current WIP of that Article_Plan by that quantity within 1 second of the cycle being recorded.
4. WHEN any Article's current WIP changes, THE WIP_System SHALL set the line-level current WIP equal to the sum of the current WIP of all Articles on the Line within 1 second of the change.
5. WHEN a working day starts, THE WIP_System SHALL set the opening WIP and the current WIP of each Article on a Line to the closing WIP of that Article from the previous working day, or to 0 if the Article has no previous closing WIP.
6. WHEN an Article_Assignment is created or changed, THE WIP_System SHALL keep the current WIP, input and output of every Article on the Line unchanged.
7. WHILE a Line has Article_Plans on the current date, THE WIP_System SHALL report for every Article_Plan of the Line its current WIP quantity (including 0) and an indicator of whether the Article_Plan is a Running_Article, regardless of which Article_Plans are running.
8. IF an end-of-line cycle attributed to an Article_Plan has a quantity greater than the current WIP of that Article_Plan, THEN THE WIP_System SHALL set the Article's current WIP to zero, add only the quantity that was available (the Article's current WIP before the cycle) to the Article's output, flag the day for the Line as a WIP discrepancy visible to the Supervisor, and retain the original cycle record unchanged.
9. WHERE a Supervisor holds the WIP adjustment permission, THE WIP_System SHALL allow a manual WIP adjustment for a single Article, with a mandatory reason of 1 to 500 characters, resulting in a current WIP between 0 and 999,999, and SHALL record the user, the time, the previous value and the new value.
10. IF a manual WIP adjustment has an empty reason, a reason longer than 500 characters, or a resulting current WIP outside 0 to 999,999, THEN THE WIP_System SHALL reject the adjustment, show an error message indicating the cause to the Supervisor, and leave the Article's current WIP unchanged.
11. WHEN a day ends, THE WIP_System SHALL store the closing WIP of each Article separately, equal to that Article's current WIP at the day end.
12. WHEN a Line has only one Article_Plan on a date, THE WIP_System SHALL produce line-level WIP values identical to those produced before this feature for the same recorded cycles.
13. WHEN a cycle is recorded as Unassigned_Output, THE WIP_System SHALL leave every Article_WIP unchanged and SHALL record the unassigned input and unassigned output quantities for the Line and date separately from all Article_WIP records.
14. WHEN cycles attributed to two or more Article_Plans of the same Line are recorded at the same time, THE WIP_System SHALL apply each cycle exactly once to the Article_WIP of its own Article_Plan, so that the line-level current WIP equals the sum of the Article current WIP values after all cycles are applied.

### Requirement 5: Targets, progress and reporting with several running articles

**User Story:** As a manager, I want reports and dashboards to show every running article and the line total together, so that I can judge performance without losing the single-article view.

#### Acceptance Criteria

1. WHEN a report or dashboard is displayed for a Line and date, THE Reporting_System SHALL show the Line total target, the Line total output, and for each Article_Plan of that date its Article name, target, output, WIP and completion percentage (output divided by target, multiplied by 100, rounded to the nearest whole percent, and shown as 0% if the target is 0).
2. WHEN a report or dashboard is displayed for a Line and date and the Line has Unassigned_Output greater than zero, THE Reporting_System SHALL show the Unassigned_Output as a separate item that is not included in the output of any Article_Plan.
3. WHEN a report or dashboard is displayed for a Line and date, THE Reporting_System SHALL calculate line-level efficiency as total Line output divided by the Line_Day_Plan total target, multiplied by 100, rounded to one decimal place, and shown as 0.0% if the total target is 0.
4. WHEN a cycle record is created, THE Reporting_System SHALL attribute the record to the Article_Plan assigned to the Machine at the recorded cycle time (or to the Article_Plan selected for the cycle on a Shared_Machine), and SHALL keep that attribution unchanged by any later change of an Article_Assignment.
5. WHEN a report is filtered by Article, THE Reporting_System SHALL include only the cycle records and WIP attributed to that Article, and SHALL show totals, efficiency and completion percentage calculated from those records only.
6. WHILE a Line has one or more Running_Articles, THE Reporting_System SHALL show on the TV dashboard for that Line all Running_Articles together, each with its Article name, target, output, WIP and completion percentage, and SHALL refresh these values within 5 seconds of a new cycle record or an Article_Assignment change.
7. WHILE a Line has more than one Article_Plan on the current date, THE Reporting_System SHALL show on the TV dashboard the Article_Plans that are not Running_Articles and not yet completed in ascending sequence number order, each with its Article name and target.
8. WHEN a Supervisor or operator opens the mobile production screen for a Machine, THE Reporting_System SHALL show the name, target, output and WIP of the Article_Plan assigned to that Machine, and SHALL show a message indicating that no article is assigned if the Machine has no Article_Assignment in effect.
9. WHEN the mobile production screen is opened for a Shared_Machine, THE Reporting_System SHALL show the Article_Plans assigned to that Machine and SHALL provide a selection of the Article_Plan for each cycle in line with Requirement 3.
10. WHEN a Supervisor uses the mobile production screen, THE Reporting_System SHALL provide an action to change the Article_Assignment of Machines of the Line that follows Requirements 3 and 7.
11. WHEN a Line has only one Article_Plan on a date, THE Reporting_System SHALL display the same values and layout on reports, the TV dashboard and the mobile production screen as before this feature.
12. FOR ALL Lines and dates, THE Reporting_System SHALL report a Line-level output equal to the sum of the per-Article outputs plus the Unassigned_Output, including cycle records attributed to Articles whose Article_Plan was later changed or completed.
13. FOR ALL Lines, dates, Machines and hours, THE Reporting_System SHALL report per-Article hourly output that, summed over all Articles and added to the unassigned hourly output, equals the total hourly output of the Machine.
14. IF the per-Article data for a Line cannot be retrieved, THEN THE Reporting_System SHALL show an error indication for that Line, SHALL NOT show partial totals as complete, and SHALL keep previously stored cycle records unchanged.

### Requirement 6: Data migration and backward compatibility

**User Story:** As a system owner, I want existing plans and history to keep working, so that current data and integrations are not broken.

#### Acceptance Criteria

1. WHEN the data migration runs, THE Planning_System SHALL convert each existing production plan row into exactly one Article_Plan with sequence number 1, copying the plan's Line, date, Article, and target quantity unchanged.
2. WHEN the data migration runs, THE WIP_System SHALL create exactly one Article_WIP record for each existing line-level WIP record that has a plan for its Line and date, using the Article of that plan and copying the WIP quantity unchanged.
3. IF a historical WIP record has no plan for its Line and date, THEN THE WIP_System SHALL keep the line-level record unchanged, leave the Article empty, and create no Article_WIP record for it.
4. THE Planning_System SHALL keep existing API endpoints for single-article plans working with unchanged request fields and unchanged response fields (names, types, and values), and SHALL add the Article list as additional response fields only.
5. WHEN the data migration runs, THE Assignment_System SHALL create, for each migrated single Article_Plan, one Article_Assignment for every Machine of its Line, effective from the start of the plan date, so that every existing single-article Line has its single Article_Plan assigned to all of its Machines.
6. WHEN the data migration runs a second or later time against data that has already been migrated, THE Planning_System SHALL create 0 additional Article_Plans, THE WIP_System SHALL create 0 additional Article_WIP records, and THE Assignment_System SHALL create 0 additional Article_Assignments.
7. IF the data migration fails, THEN THE Planning_System SHALL roll back all changes made by that run so that plan, WIP and Article_Assignment row counts and field values equal their pre-migration state, SHALL stop the migration, and SHALL report the failure to the operator with an error indication that identifies the failed step.
8. WHEN the data migration completes, THE Planning_System SHALL report the number of Article_Plans created, the number of Article_WIP records created, the number of Article_Assignments created, and the number of WIP records left with an empty Article.

### Requirement 7: Validation, permissions and audit

**User Story:** As a system owner, I want multi-article changes to be validated and traceable, so that the plan and the machine assignments stay consistent and accountable.

#### Acceptance Criteria

1. IF an Article_Plan refers to an Article that has no routing for the Line, THEN THE Planning_System SHALL reject the Article_Plan, save no part of it, and return an error naming each Article code that lacks a routing.
2. IF a user without the planning permission attempts to create, edit, reorder or delete an Article_Plan, THEN THE Planning_System SHALL reject the action, leave the Article_Plan and its sequence unchanged, and return an error indicating insufficient permission.
3. IF a user without the Supervisor permission or the planning permission for a Line attempts to create or change an Article_Assignment on that Line, THEN THE Assignment_System SHALL reject the request, leave the current Article_Assignments unchanged, and return an error indicating insufficient permission.
4. WHEN an Article_Plan is created, changed, reordered or deleted, THE Planning_System SHALL record one audit entry containing the user identifier, the timestamp with a resolution of 1 second or finer, the action type, and the previous and new values of every changed field. For a creation the previous value is empty, and for a deletion the new value is empty.
5. WHEN a Planner changes the target of an Article_Plan to a value below the recorded output of that Article, THE Planning_System SHALL reject the change, keep the existing target, and return an error that includes the recorded output as a whole number of pairs.
6. WHEN the schedule sync runs for a Line_Day_Plan, THE Planning_System SHALL create exactly one schedule entry for each Article_Plan in the Line_Day_Plan, ordered by ascending sequence number, and SHALL complete within 5 seconds for up to 20 Article_Plans.
7. IF the audit entry for a change to an Article_Plan, or the Assignment_History entry for a change to an Article_Assignment, cannot be recorded, THEN THE Planning_System or THE Assignment_System SHALL roll back that change and return an error indicating the change was not saved.
8. IF the schedule sync fails for any Article_Plan in a Line_Day_Plan, THEN THE Planning_System SHALL create no schedule entries from that run and return an error identifying the Article_Plan that failed.
