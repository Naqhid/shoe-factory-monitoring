# Adding an Article Before You Know the Line or Start Date

This guide explains how to set up a **new article (style)** in ProdPulse when you only have:

- A list of **machine centres** (e.g. 7 machines)
- **Time study / target times** for routing

You do **not** yet know:

- Which **line (work centre)** the article will run on
- When production will **start**

That is normal. Set up the article and routing first; assign lines and dates later.

---

## Overview

| Phase | What you do | When |
|-------|-------------|------|
| **1. Master data** | Create the style (article) | Now |
| **2. Machines** | Add machine centres **without** a work centre | Now |
| **3. Routing** | Link the style to those machines with target times | Now |
| **4. Line assignment** | Assign each machine to a work centre (line) | When line is known |
| **5. Article on line** | Schedule the article on a line with a start date | When line + date are known |
| **6. Production plan** | Plan daily output for that line/date | When planning |

---

## Phase 1 — Add the article (style)

1. Open **Masters → Style**
2. Click **Add**
3. Enter:
   - **Style Code** — article code (e.g. `6024`)
   - **Style Name** — article description
4. Click **Save**

---

## Phase 2 — Add machine centres (no line required)

1. Open **Masters → Machine Centre**
2. For each machine in your time study list, click **Add** and fill in:

   | Field | Notes |
   |-------|--------|
   | **Work Centre** | Leave as **No work centre (optional)** |
   | **Machine ID** | Unique ID used across the system (e.g. `44`, `M12`) |
   | **Machine Centre Code** | Your internal code |
   | **Process Name** | Operation name (e.g. Eyelet Attaching, Lasting) |

3. Click **Save** for each machine

**Why no work centre?**  
Routing and target times are tied to **machines**, not lines. You can assign a machine to a line later when you know where it sits physically.

---

## Phase 3 — Create production routing

1. Open **Production Routing**
2. Click **Add routing**
3. Select the **style** (article) from Phase 1
4. Fill header fields as needed (customer, group, leather, colour, etc.)
5. Add one row per machine from Phase 2:
   - **Machine centre** — pick from the list you created
   - **Observed time** — from your time study (minutes)
   - **Rating factor** / **Manpower** — if your factory uses them
6. Review **Total SMV** and **Target per day** if shown
7. Click **Save**

Routing is now ready for:

- Mobile production (target time per cycle)
- TV dashboard and production tracking
- Production planning (when you add plans later)

**No line or start date is required for routing.**

---

## Phase 4 — Assign machines to lines (when known)

When you know which **line (work centre)** each machine belongs to:

1. Open **Masters → Machine Centre**
2. **Edit** each machine
3. Select the correct **Work Centre**
4. Save

Optional: on **Masters → Work Centre**, edit a line to set **Input machine** and **EOL machine** for output tracking.

---

## Phase 5 — Put the article on a line (when known)

When you know **which line** will run the article and **when it starts**:

1. Open **Line Schedule** (screen title: **Article on Line**)
2. Find the line and click **Change article**
3. Search and select the **style**
4. Set **Start date** to the day production begins
5. Leave **open-ended** (default) — the article stays active until the next changeover
6. Optionally enable **Update production plan** to sync planning
7. Save

**Note:** The **Schedule date** picker at the top of Line Schedule is only for **viewing** what is active on a given day. The actual future start is set inside **Change article**.

---

## Phase 6 — Production planning (when ready)

1. Open **Production Planning**
2. Add a plan for the **work centre**, **date**, and **style**
3. Use **Copy from yesterday** / **Copy from today** if helpful

Missing-plan warnings on the planning screen remind you when a line has no plan for today or tomorrow.

---

## Quick reference — what needs what

| Task | Style | Machines | Work centre on machine | Routing | Line schedule |
|------|:-----:|:--------:|:----------------------:|:-------:|:-------------:|
| Time study only | ✓ | ✓ | — | ✓ | — |
| Know line, not date | ✓ | ✓ | ✓ | ✓ | — |
| Know line + start date | ✓ | ✓ | ✓ | ✓ | ✓ |
| Daily output plan | ✓ | ✓ | ✓ | ✓ | ✓ (recommended) |

---

## Common questions

### Can I save a machine without selecting a work centre?

**Yes.** Work Centre is **optional** on **Masters → Machine Centre**. Use **No work centre** until the line is decided.

### Do I need Line Schedule if I only have routing?

**No.** Line Schedule is for recording **when an article starts on a specific line**. Routing alone is enough to define target times.

### What if the same machine type appears on multiple lines?

Each physical machine should have its own **Machine ID** in master data. Routing rows point to those machine IDs. Assign each to the correct work centre when the layout is known.

### What happens if routing is missing?

Production Planning and mobile targets may show errors or missing targets for that style. Always create routing after adding the style and machines.

---

## Recommended order (checklist)

- [ ] Add **Style** (article)
- [ ] Add all **Machine Centres** (work centre = none)
- [ ] Create **Production Routing** (style + 7 machines + times)
- [ ] *(Later)* Assign **Work Centre** on each machine
- [ ] *(Later)* **Line Schedule → Change article** (line + start date)
- [ ] *(Later)* **Production Planning** for planned days

---

*ProdPulse — Smart Production Tracking System*
