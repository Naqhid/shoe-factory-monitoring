'use strict';

/**
 * Multi-article lines: machine-to-article assignment, cycle attribution and per-article stats.
 *
 * Model (parallel articles on one line):
 * - production_plan_articles holds the articles of a line/day plan (only when there are 2+ articles).
 * - article_machine_assignments is an append-only history. The latest row for a machine on a
 *   line/day is the article that machine is working on. plan_article_id NULL means "unassigned".
 * - machine_centre_production.plan_article_id records the article a cycle counts against.
 *   It is set when the cycle is created and never changed by later reassignments.
 * - The line's input and EOL machines are shared: the operator picks the article for each cycle.
 *   If no article is picked, the machine's current assignment is used.
 * - Per-article WIP = all-time input − all-time EOL output for that line + article (style),
 *   so WIP carries forward across days. Cycles with no article are reported as unassigned.
 */

const db = require('../../config/database');
const { resolveInputMachineId, resolveEolMachineId } = require('./lineMachineResolver');

function toDateKey(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const part = String(value).trim().split('T')[0].split(' ')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null;
}

async function ensureSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS article_machine_assignments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      work_centre_id INT NOT NULL,
      assign_date DATE NOT NULL,
      machine_id VARCHAR(100) NOT NULL,
      plan_article_id INT NULL,
      assigned_by VARCHAR(100) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_ama_lookup (work_centre_id, assign_date, machine_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  try {
    await db.execute('ALTER TABLE machine_centre_production ADD COLUMN plan_article_id INT NULL');
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e;
  }
  try {
    await db.execute('ALTER TABLE machine_centre_production ADD KEY idx_mcp_plan_article (plan_article_id)');
  } catch (e) {
    if (e.code !== 'ER_DUP_KEYNAME') throw e;
  }
}

/** Articles of the line/day plan, or [] when the line runs a single article. */
async function getPlanArticles(workCentreId, dateKey, conn = db) {
  const [rows] = await conn.query(
    `SELECT a.id, a.plan_id, a.sequence_no, a.style_id, a.total_target_per_day,
            s.name AS style_name, s.code AS style_code
     FROM production_plan pp
     JOIN production_plan_articles a ON a.plan_id = pp.id
     LEFT JOIN styles s ON s.id = a.style_id
     WHERE pp.work_centre_id = ? AND DATE(pp.plan_date) = DATE(?) AND pp.deleted_at IS NULL
     ORDER BY a.sequence_no`,
    [Number(workCentreId), dateKey]
  );
  return rows;
}

/** Current article per machine for a line/day: Map(machine_id -> plan_article_id|null). */
async function getCurrentAssignments(workCentreId, dateKey, conn = db) {
  const [rows] = await conn.query(
    `SELECT ama.machine_id, ama.plan_article_id
     FROM article_machine_assignments ama
     JOIN (
       SELECT machine_id, MAX(id) AS max_id
       FROM article_machine_assignments
       WHERE work_centre_id = ? AND assign_date = ?
       GROUP BY machine_id
     ) latest ON latest.max_id = ama.id`,
    [Number(workCentreId), dateKey]
  );
  const map = new Map();
  for (const r of rows) map.set(String(r.machine_id), r.plan_article_id == null ? null : Number(r.plan_article_id));
  return map;
}

/**
 * Article a new cycle counts against. Returns null for single-article lines (unchanged behaviour)
 * and for unassigned machines on multi-article lines.
 */
async function resolveCycleArticle({ workCentreId, machineId, prodDate, requestedArticleId }) {
  const dateKey = toDateKey(prodDate) || toDateKey(new Date());
  if (!workCentreId || !machineId) return { planArticleId: null, multiArticle: false };
  const articles = await getPlanArticles(workCentreId, dateKey);
  if (articles.length < 2) return { planArticleId: null, multiArticle: false };

  const validIds = new Set(articles.map((a) => Number(a.id)));
  const requested = requestedArticleId != null && requestedArticleId !== '' ? Number(requestedArticleId) : null;
  if (requested != null) {
    if (!validIds.has(requested)) {
      throw Object.assign(new Error('The selected article is not planned on this line today'), { status: 400 });
    }
    return { planArticleId: requested, multiArticle: true };
  }
  const assignments = await getCurrentAssignments(workCentreId, dateKey);
  const assigned = assignments.get(String(machineId));
  return { planArticleId: assigned && validIds.has(assigned) ? assigned : null, multiArticle: true };
}

/** Assigns machines to an article (or unassigns with planArticleId = null). Recorded as history. */
async function assignMachines({ workCentreId, dateKey, machineIds, planArticleId, assignedBy }) {
  const wc = Number(workCentreId);
  const day = toDateKey(dateKey);
  if (!wc || !day) throw Object.assign(new Error('work_centre_id and date are required'), { status: 400 });
  const ids = (Array.isArray(machineIds) ? machineIds : []).map(String).filter(Boolean);
  if (ids.length === 0) throw Object.assign(new Error('Select at least one machine'), { status: 400 });

  const articles = await getPlanArticles(wc, day);
  if (articles.length < 2) {
    throw Object.assign(new Error('This line has only one article today, so machines need no assignment'), { status: 400 });
  }
  const target = planArticleId == null || planArticleId === '' ? null : Number(planArticleId);
  if (target != null && !articles.some((a) => Number(a.id) === target)) {
    throw Object.assign(new Error('The selected article is not planned on this line for that day'), { status: 400 });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const machineId of ids) {
      await conn.execute(
        `INSERT INTO article_machine_assignments (work_centre_id, assign_date, machine_id, plan_article_id, assigned_by)
         VALUES (?, ?, ?, ?, ?)`,
        [wc, day, machineId, target, assignedBy || null]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return { assigned: ids.length, plan_article_id: target };
}

/** Per-article target, input, output, WIP and completion for a line/day, plus unassigned output. */
async function getLineArticleSummary(workCentreId, dateKey) {
  const wc = Number(workCentreId);
  const day = toDateKey(dateKey) || toDateKey(new Date());
  const articles = await getPlanArticles(wc, day);
  const [inputMachine, eolMachine] = await Promise.all([resolveInputMachineId(wc), resolveEolMachineId(wc)]);

  const [machines] = await db.query(
    `SELECT machine_id, COALESCE(machine_name, name, machine_id) AS machine_name
     FROM machine_centres
     WHERE work_centre_id = ? AND deleted_at IS NULL AND COALESCE(is_active, 1) = 1
     ORDER BY machine_id`,
    [wc]
  );
  const assignments = await getCurrentAssignments(wc, day);

  const [todayRows] = await db.query(
    `SELECT plan_article_id, machine_id, SUM(output_pairs) AS pairs
     FROM machine_centre_production
     WHERE work_centre_id = ? AND DATE(prod_date) = DATE(?) AND button_status = 2
     GROUP BY plan_article_id, machine_id`,
    [wc, day]
  );

  // Carry-forward WIP: all-time input − EOL output for this line, grouped by article style.
  const [wipRows] = await db.query(
    `SELECT a.style_id,
            SUM(CASE WHEN mcp.machine_id = ? THEN mcp.output_pairs ELSE 0 END) AS input_pairs,
            SUM(CASE WHEN mcp.machine_id = ? THEN mcp.output_pairs ELSE 0 END) AS eol_pairs
     FROM machine_centre_production mcp
     JOIN production_plan_articles a ON a.id = mcp.plan_article_id
     WHERE mcp.work_centre_id = ? AND mcp.button_status = 2 AND DATE(mcp.prod_date) <= DATE(?)
     GROUP BY a.style_id`,
    [inputMachine, eolMachine, wc, day]
  );
  const wipByStyle = new Map(wipRows.map((r) => [Number(r.style_id), Math.max(0, Number(r.input_pairs || 0) - Number(r.eol_pairs || 0))]));

  const statsFor = (articleId) => {
    let input = 0;
    let output = 0;
    for (const r of todayRows) {
      const rid = r.plan_article_id == null ? null : Number(r.plan_article_id);
      if (rid !== articleId) continue;
      if (String(r.machine_id) === String(inputMachine)) input += Number(r.pairs || 0);
      if (String(r.machine_id) === String(eolMachine)) output += Number(r.pairs || 0);
    }
    return { input, output };
  };

  const rows = articles.map((a) => {
    const { input, output } = statsFor(Number(a.id));
    const target = Number(a.total_target_per_day || 0);
    const assignedMachines = machines
      .filter((m) => assignments.get(String(m.machine_id)) === Number(a.id))
      .map((m) => String(m.machine_id));
    return {
      plan_article_id: Number(a.id),
      sequence_no: a.sequence_no,
      style_id: a.style_id,
      style_name: a.style_name,
      style_code: a.style_code,
      target,
      input,
      output,
      wip: wipByStyle.get(Number(a.style_id)) || 0,
      completion_percent: target > 0 ? Math.round((output / target) * 100) : 0,
      running: assignedMachines.length > 0,
      assigned_machines: assignedMachines,
    };
  });

  const unassigned = statsFor(null);
  const totalTarget = rows.reduce((s, r) => s + r.target, 0);
  const totalOutput = rows.reduce((s, r) => s + r.output, 0) + (articles.length >= 2 ? unassigned.output : 0);

  return {
    work_centre_id: wc,
    date: day,
    multi_article: articles.length >= 2,
    input_machine_id: String(inputMachine),
    eol_machine_id: String(eolMachine),
    articles: rows,
    unassigned: articles.length >= 2 ? unassigned : { input: 0, output: 0 },
    total_target: totalTarget,
    total_output: totalOutput,
    total_wip: rows.reduce((s, r) => s + r.wip, 0),
    machines: machines.map((m) => {
      const assigned = assignments.get(String(m.machine_id));
      return {
        machine_id: String(m.machine_id),
        machine_name: m.machine_name,
        shared: String(m.machine_id) === String(inputMachine) || String(m.machine_id) === String(eolMachine),
        plan_article_id: assigned == null ? null : assigned,
      };
    }),
  };
}

async function getAssignmentHistory(workCentreId, dateKey) {
  const [rows] = await db.query(
    `SELECT ama.id, ama.machine_id, ama.plan_article_id, ama.assigned_by, ama.created_at, s.name AS style_name
     FROM article_machine_assignments ama
     LEFT JOIN production_plan_articles a ON a.id = ama.plan_article_id
     LEFT JOIN styles s ON s.id = a.style_id
     WHERE ama.work_centre_id = ? AND ama.assign_date = ?
     ORDER BY ama.created_at, ama.id`,
    [Number(workCentreId), toDateKey(dateKey)]
  );
  return rows;
}

module.exports = {
  ensureSchema,
  toDateKey,
  getPlanArticles,
  resolveCycleArticle,
  assignMachines,
  getLineArticleSummary,
  getAssignmentHistory,
};
