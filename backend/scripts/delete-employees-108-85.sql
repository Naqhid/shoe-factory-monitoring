-- Hard-delete employees with codes 108, 85, 580 (and dependents).
-- CMD:
--   set MYSQL_PWD=YourPasswordHere
--   "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h localhost -P 3306 -u root florence < "D:\Software Projects\shoe-factory-monitoring\backend\scripts\delete-employees-108-85.sql"
--
-- PowerShell:
--   $env:MYSQL_PWD='YourPasswordHere'
--   Get-Content "D:\...\delete-employees-108-85.sql" | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h localhost -P 3306 -u root florence

START TRANSACTION;

DELETE FROM missed_action_states
WHERE issue_key LIKE '%__108__%'
   OR issue_key LIKE '%__85__%'
   OR issue_key LIKE '%__580__%';

DELETE FROM mobile_sessions
WHERE emp_code IN ('108', '85', '580')
   OR emp_id IN (SELECT id FROM employees WHERE code IN ('108', '85', '580'));

DELETE FROM pivot_data
WHERE emp_id IN (SELECT id FROM employees WHERE code IN ('108', '85', '580'));

DELETE FROM machine_centre_production
WHERE emp_id IN ('108', '85', '580');

DELETE FROM machine_centre_summary
WHERE emp_id IN ('108', '85', '580');

DELETE FROM machine_centre_summary_history
WHERE emp_id IN ('108', '85', '580');

DELETE FROM line_setup
WHERE employee_id IN (SELECT id FROM employees WHERE code IN ('108', '85', '580'));

DELETE FROM employees
WHERE code IN ('108', '85', '580');

COMMIT;
