# Machine Centre Production - New Schema Implementation

## Overview
This document describes the migration from the old schema (`prod_data`, `pivot_data`) to the new schema (`machine_centre_production`, `machine_centre_summary`) as per requirements.

## New Schema Features

### Table 1: machine_centre_production
- **Purpose**: Stores raw production entries (per 12 pairs)
- **Key Features**:
  - Auto-calculated `actual_time` = `finish_time - start_time`
  - Auto-calculated `idle_mins` = `idle_stop_time - idle_start_time`
  - Uses DATETIME for timestamps (not TIME)
  - Default output_pairs = 12

### Table 2: machine_centre_summary
- **Purpose**: Aggregated/pivot summary data
- **Key Features**:
  - Auto-updated via database triggers
  - Calculates efficiency percentage
  - Calculates cumulative average time
  - Groups by: prod_date, work_centre_id, machine_id, emp_id

## Migration Steps

### Step 1: Create New Tables
```bash
mysql -u root -p shoe_factory < backend/machine_centre_production_new_schema.sql
```

### Step 2: Run Migration Script
```bash
mysql -u root -p shoe_factory < backend/migration_to_new_schema.sql
```

### Step 3: Verify Data
Check the output of the migration script to ensure all records were migrated.

### Step 4: Update Backend Code
The backend controller needs to be updated to use the new table names. The current `mobileProductionController.js` uses `prod_data` - it needs to be updated to use `machine_centre_production`.

### Step 5: Test
1. Test inserting new production records
2. Verify summary table auto-updates
3. Test all CRUD operations
4. Verify calculations are correct

## Key Differences from Old Schema

| Feature | Old Schema | New Schema |
|---------|-----------|------------|
| Detail Table | `prod_data` | `machine_centre_production` |
| Summary Table | `pivot_data` | `machine_centre_summary` |
| Time Fields | TIME or INT | DATETIME |
| Calculations | Manual | Auto-calculated (GENERATED) |
| Summary Updates | Manual | Auto-triggered |
| Output Pairs | Configurable | Fixed at 12 |
| Idle Tracking | `idle_duration` (INT) | `idle_mins` (calculated) |

## Business Logic

### Actual Time Calculation
```sql
actual_time = TIMESTAMPDIFF(MINUTE, start_time, finish_time)
```

### Idle Time Calculation
```sql
idle_mins = TIMESTAMPDIFF(MINUTE, idle_start_time, idle_stop_time)
```

### Efficiency Calculation
```sql
avg_efficiency_percent = (total_actual_mins / total_target_mins) * 100
```

### Cumulative Average Time
```sql
cum_avg_time = total_actual_mins / 12
```

## Application Flow

1. **START** → Insert record with `start_time`, `button_status = 1`
2. **STOP** → Update with `idle_start_time`, `button_status = 3`
3. **RESUME** → Update with `idle_stop_time`, `button_status = 1`
4. **FINISH** → Update with `finish_time`, `button_status = 2`
   - `actual_time` auto-calculated
   - `idle_mins` auto-calculated
   - Summary table auto-updated via trigger

## Next Steps

After running the migration:

1. ✅ Update backend controller to use new table names
2. ✅ Update API endpoints if needed
3. ✅ Test all functionality
4. ✅ Update frontend if any field names changed
5. ✅ Drop old tables after verification (optional)

## Rollback Plan

If issues occur:
```sql
-- Restore from backup
DROP TABLE IF EXISTS prod_data;
DROP TABLE IF EXISTS pivot_data;
CREATE TABLE prod_data AS SELECT * FROM prod_data_backup;
CREATE TABLE pivot_data AS SELECT * FROM pivot_data_backup;
```

## Notes

- The new schema uses database triggers for automatic summary updates
- All time calculations are handled at the database level
- The schema enforces the "12 pairs per entry" business rule
- DATETIME fields allow for precise timestamp tracking
