# Production Planning Guide

## Overview
The Production Planning module allows planners to schedule and manage daily production targets for work centres (production lines) in the shoe factory.

---

## Planner Responsibilities

### 1. Daily Production Planning
- Create production plans for each work centre/line
- Set target quantities and time allocations
- Assign styles and colors to production lines
- Monitor plan execution and adjust as needed

### 2. Master Data Management
- Maintain customer records
- Update style and color information
- Manage leather/material inventory
- Keep work centre configurations current

---

## Step-by-Step Guide

### **Step 1: Access Production Planning**
1. Login with Planner credentials
2. Navigate to **Process → Production Planning**
3. View existing plans in the table

### **Step 2: Create New Production Plan**
1. Click **+ Add Plan** button
2. Fill in required fields:

   **Basic Information:**
   - **Plan Date**: Select production date
   - **Work Centre**: Choose production line (e.g., Line 1, Line 2)
   - **Customer**: Select customer order
   - **Style**: Choose shoe style to produce
   - **Color**: Select color variant

   **Target Settings:**
   - **Target Pairs**: Total pairs to produce (e.g., 500 pairs)
   - **Target Pairs per Tray**: Pairs per production tray (e.g., 25 pairs)
   - **Target Minutes per Tray**: Time allocated per tray (e.g., 45 minutes)

   **Additional Details:**
   - **Remarks**: Any special instructions or notes

3. Click **Save** to create the plan

### **Step 3: Edit Existing Plan**
1. Find the plan in the table
2. Click the **Edit** (pencil) icon
3. Modify fields as needed
4. Click **Save** to update

### **Step 4: Delete Plan**
1. Find the plan to remove
2. Click the **Delete** (trash) icon
3. Confirm deletion

---

## Key Concepts

### **Work Centre**
- A production line or assembly area
- Each work centre has multiple machine centres/workstations
- Example: Line 1, Line 2, Stitching Line

### **Target Pairs**
- Total number of shoe pairs to produce in the day
- Used to calculate overall efficiency

### **Target Pairs per Tray**
- Standard batch size for production
- Helps operators track progress in manageable units
- Example: 25 pairs per tray means 20 trays for 500 pairs

### **Target Minutes per Tray**
- Standard time allocated to complete one tray
- Used to calculate machine centre efficiency
- Example: 45 minutes per tray

---

## Best Practices

### **Planning Tips**
✅ Create plans at least 1 day in advance  
✅ Verify customer orders before planning  
✅ Check material availability (leather, colors)  
✅ Balance workload across work centres  
✅ Set realistic targets based on historical data  
✅ Add remarks for special requirements  

### **Target Setting Guidelines**
- **Target Pairs per Tray**: Typically 20-30 pairs
- **Target Minutes per Tray**: Based on style complexity
  - Simple styles: 30-40 minutes
  - Medium complexity: 40-50 minutes
  - Complex styles: 50-60 minutes

### **Common Mistakes to Avoid**
❌ Setting unrealistic targets  
❌ Forgetting to assign styles/colors  
❌ Not checking work centre availability  
❌ Duplicate plans for same date/line  
❌ Missing target time calculations  

---

## Production Flow

```
1. Planner creates production plan
   ↓
2. Line Supervisor sets up line (assigns operators)
   ↓
3. Machine Centre operators start production
   ↓
4. System tracks actual time vs target time
   ↓
5. Reports show efficiency and performance
```

---

## Monitoring Production

### **View Production Status**
- Navigate to **Process → Production Tracker**
- See real-time progress for all lines
- Monitor efficiency percentages
- Track hourly performance

### **Key Metrics to Watch**
- **Efficiency %**: (Target Time / Actual Time) × 100
- **Output Pairs**: Total pairs completed
- **Idle Time**: Time machines are stopped
- **Stoppage Reasons**: Why production was paused

### **Target Efficiency**
- 🟢 **90%+**: Excellent performance
- 🟡 **80-89%**: Good performance
- 🟠 **70-79%**: Needs attention
- 🔴 **<70%**: Requires immediate action

---

## Reports Available

### **1. TV Dashboard**
- Real-time line performance
- Hourly output tracking
- Efficiency rankings
- Visual status indicators

### **2. Production Tracker**
- Daily summary by line
- Hourly performance breakdown
- Workstation-level details
- Stoppage analysis

### **3. Reports Module**
- Historical performance data
- Efficiency trends
- Machine utilization
- Custom date ranges

---

## Troubleshooting

### **Issue: Cannot create plan**
- ✓ Check if work centre exists in masters
- ✓ Verify customer/style/color are configured
- ✓ Ensure no duplicate plan for same date/line

### **Issue: Wrong targets showing**
- ✓ Edit the plan and update target values
- ✓ Ensure target_pairs_per_tray is set correctly
- ✓ Verify target_mins_per_tray matches style complexity

### **Issue: Plan not visible to operators**
- ✓ Confirm plan date is today
- ✓ Check work centre ID matches line setup
- ✓ Verify plan is saved (not in draft)

---

## Master Data Prerequisites

Before creating production plans, ensure these masters are configured:

### **Required Masters**
1. **Customers**: All customer codes and names
2. **Styles**: Shoe style codes and descriptions
3. **Colors**: Available color variants
4. **Work Centres**: Production lines/areas
5. **Machine Centres**: Individual workstations
6. **Employees**: Operator information

### **Access Masters**
- Navigate to **Masters** menu
- Select the master type to manage
- Add/Edit/Delete records as needed

---

## Quick Reference

### **Daily Workflow**
1. ☑ Review customer orders
2. ☑ Check material availability
3. ☑ Create production plans for tomorrow
4. ☑ Monitor today's production progress
5. ☑ Review efficiency reports
6. ☑ Adjust plans if needed

### **Keyboard Shortcuts**
- **Ctrl + N**: New plan (when available)
- **Ctrl + S**: Save plan
- **Esc**: Cancel/Close form

---

## Support & Contact

For technical issues or questions:
- Contact System Administrator
- Check user manual
- Review training materials

---

**Last Updated**: March 2026  
**Version**: 1.0
