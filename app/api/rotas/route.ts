import { getRotasDb } from "@/lib/rotas-db";

type SessionPayload = {
  id?: string;
  date?: string;
  platform?: "shopee" | "99" | "uber";
  kmMode?: "trip" | "odometer";
  kmStart?: number | string;
  kmEnd?: number | string;
  expenses?: Array<{ id?: string; description?: string; amount?: number }>;
  startTime?: string;
  endTime?: string;
  kmDriven?: number;
  kmPerLiter?: number;
  fuelPrice?: number;
  earnings?: number;
  maintenance?: number;
  investment?: number;
};

type PlanPayload = {
  id?: string;
  month?: string;
  startDate?: string;
  available?: number;
  dailyReserve?: number;
  kmPerLiter?: number;
  fuelPrice?: number;
  kmPerWorkday?: number;
  enabled?: boolean;
  items?: Array<{ id?: string; description?: string; amount?: number; reserved?: number; dueDate?: string }>;
  daysOff?: string[];
};

const cents = (value: unknown) =>
  Math.max(0, Math.round(Number(value || 0) * 100));

const amount = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validTime(value: unknown): value is string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

export async function GET() {
  try {
    const db = getRotasDb();
    const [sessions, goals, settings, plans, planItems, planDaysOff] = await db.batch([
      db.prepare(
        `SELECT id, work_date, platform, start_time, end_time, km_start, km_end,
          liters, km_driven, km_per_liter, fuel_price_cents,
          earnings_cents, fuel_cents, maintenance_cents,
          investment_cents, expenses_json, created_at, updated_at
        FROM work_sessions
        ORDER BY work_date DESC, start_time DESC
        LIMIT 1000`
      ),
      db.prepare(
        `SELECT work_date, shopee_cents, ride_99_cents, updated_at
        FROM daily_goals
        ORDER BY work_date DESC
        LIMIT 400`
      ),
      db.prepare(
        `SELECT id, automatic_reserves, maintenance_percent,
          investment_percent, updated_at
        FROM app_settings
        WHERE id = 1`
      ),
      db.prepare(
        `SELECT id, month, start_date, available_cents, daily_reserve_cents,
          km_per_liter, fuel_price_cents, km_per_workday, enabled,
          created_at, updated_at
        FROM monthly_plans
        ORDER BY month DESC`
      ),
      db.prepare(
        `SELECT id, plan_id, description, amount_cents, reserved_cents, due_date, created_at
        FROM plan_items
        ORDER BY due_date, created_at`
      ),
      db.prepare(
        `SELECT id, plan_id, off_date
        FROM plan_days_off
        ORDER BY off_date`
      ),
    ]);

    return Response.json({
      sessions: sessions.results,
      goals: goals.results,
      settings: settings.results[0] ?? {
        id: 1,
        automatic_reserves: 0,
        maintenance_percent: 10,
        investment_percent: 10,
      },
      plans: plans.results,
      planItems: planItems.results,
      planDaysOff: planDaysOff.results,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar seus dados." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      type?: "session" | "goal" | "settings" | "plan";
      session?: SessionPayload;
      plan?: PlanPayload;
      date?: string;
      shopee?: number;
      ride99?: number;
      automaticReserves?: boolean;
      maintenancePercent?: number;
      investmentPercent?: number;
    };
    const db = getRotasDb();
    const now = new Date().toISOString();

    if (payload.type === "session") {
      const session = payload.session ?? {};
      if (
        !validDate(session.date) ||
        !validTime(session.startTime) ||
        !validTime(session.endTime) ||
        !["shopee", "99", "uber"].includes(session.platform ?? "")
      ) {
        return Response.json({ error: "Preencha data, plataforma e horários corretamente." }, { status: 400 });
      }

      const kmStart = session.kmMode === "odometer" ? Number(session.kmStart) : 0;
      const kmDriven = session.kmMode === "odometer" ? Number(session.kmEnd) - kmStart : amount(session.kmDriven);
      if (!Number.isFinite(kmStart) || kmStart < 0 || !Number.isFinite(kmDriven) || kmDriven <= 0 || session.startTime === session.endTime) return Response.json({ error:"Confira a quilometragem e informe horários diferentes." }, {status:400});
      if (session.expenses !== undefined && (!Array.isArray(session.expenses) || session.expenses.length > 100 || session.expenses.some(e => typeof e.description !== "string" || !e.description.trim() || e.description.length > 80 || !Number.isFinite(Number(e.amount)) || Number(e.amount) <= 0))) return Response.json({ error:"Informe descrição e valor positivo para cada gasto." }, {status:400});
      const expenses = (session.expenses || []).map(e => ({id:e.id || crypto.randomUUID(),description:String(e.description).trim(),amountCents:cents(e.amount)}));
      const kmPerLiter = amount(session.kmPerLiter);
      const fuelPrice = amount(session.fuelPrice);
      if (!kmDriven || !kmPerLiter || !fuelPrice) {
        return Response.json({ error: "Informe km rodados, km por litro e o preço do litro." }, { status: 400 });
      }

      const calculatedLiters = kmDriven / kmPerLiter;
      const roundedFuelReais = Math.ceil(calculatedLiters * fuelPrice);

      const id = session.id || crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO work_sessions (
            id, work_date, platform, start_time, end_time, km_start, km_end,
            liters, km_driven, km_per_liter, fuel_price_cents,
            earnings_cents, fuel_cents, maintenance_cents,
            investment_cents, expenses_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            work_date = excluded.work_date,
            platform = excluded.platform,
            start_time = excluded.start_time,
            end_time = excluded.end_time,
            km_start = excluded.km_start,
            km_end = excluded.km_end,
            liters = excluded.liters,
            km_driven = excluded.km_driven,
            km_per_liter = excluded.km_per_liter,
            fuel_price_cents = excluded.fuel_price_cents,
            earnings_cents = excluded.earnings_cents,
            fuel_cents = excluded.fuel_cents,
            maintenance_cents = excluded.maintenance_cents,
            investment_cents = excluded.investment_cents,
            expenses_json = excluded.expenses_json,
            updated_at = excluded.updated_at`
        )
        .bind(
          id,
          session.date,
          session.platform,
          session.startTime,
          session.endTime,
          kmStart,
          kmStart + kmDriven,
          calculatedLiters,
          kmDriven,
          kmPerLiter,
          cents(fuelPrice),
          cents(session.earnings),
          roundedFuelReais * 100,
          cents(session.maintenance),
          cents(session.investment),
          JSON.stringify(expenses),
          now,
          now
        )
        .run();

      return Response.json({ ok: true, id });
    }

    if (payload.type === "goal") {
      if (!validDate(payload.date)) {
        return Response.json({ error: "Escolha uma data válida." }, { status: 400 });
      }
      await db
        .prepare(
          `INSERT INTO daily_goals (work_date, shopee_cents, ride_99_cents, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(work_date) DO UPDATE SET
            shopee_cents = excluded.shopee_cents,
            ride_99_cents = excluded.ride_99_cents,
            updated_at = excluded.updated_at`
        )
        .bind(payload.date, cents(payload.shopee), cents(payload.ride99), now)
        .run();
      return Response.json({ ok: true });
    }

    if (payload.type === "settings") {
      await db
        .prepare(
          `INSERT INTO app_settings (
            id, automatic_reserves, maintenance_percent, investment_percent, updated_at
          ) VALUES (1, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            automatic_reserves = excluded.automatic_reserves,
            maintenance_percent = excluded.maintenance_percent,
            investment_percent = excluded.investment_percent,
            updated_at = excluded.updated_at`
        )
        .bind(
          payload.automaticReserves ? 1 : 0,
          amount(payload.maintenancePercent),
          amount(payload.investmentPercent),
          now
        )
        .run();
      return Response.json({ ok: true });
    }

    if (payload.type === "plan") {
      const plan = payload.plan ?? {};
      if (
        typeof plan.month !== "string" || !/^\d{4}-\d{2}$/.test(plan.month) ||
        !validDate(plan.startDate) || !Array.isArray(plan.items) || !plan.items.length
      ) {
        return Response.json({ error: "Informe o mês, a data inicial e pelo menos uma conta." }, { status: 400 });
      }

      const validItems = plan.items.filter((item) =>
        validDate(item.dueDate) && String(item.description || "").trim() && amount(item.amount) > 0 &&
        amount(item.reserved) <= amount(item.amount)
      );
      if (validItems.length !== plan.items.length) {
        return Response.json({ error: "Preencha nome, valor e vencimento; o valor separado não pode superar a conta." }, { status: 400 });
      }
      if (validItems.some((item) => String(item.dueDate) < String(plan.startDate))) {
        return Response.json({ error: "O vencimento não pode ser anterior ao início do plano." }, { status: 400 });
      }

      const existing = await db
        .prepare("SELECT id, created_at FROM monthly_plans WHERE month = ?")
        .bind(plan.month)
        .first<{ id: string; created_at: string }>();
      const id = existing?.id || plan.id || crypto.randomUUID();
      const daysOff = [...new Set((plan.daysOff || []).filter(validDate))]
        .filter((date) => date >= String(plan.startDate));
      const statements = [
        db.prepare(
          `INSERT INTO monthly_plans (
            id, month, start_date, available_cents, daily_reserve_cents,
            km_per_liter, fuel_price_cents, km_per_workday, enabled,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(month) DO UPDATE SET
            start_date = excluded.start_date,
            available_cents = excluded.available_cents,
            daily_reserve_cents = excluded.daily_reserve_cents,
            km_per_liter = excluded.km_per_liter,
            fuel_price_cents = excluded.fuel_price_cents,
            km_per_workday = excluded.km_per_workday,
            enabled = excluded.enabled,
            updated_at = excluded.updated_at`
        ).bind(
          id,
          plan.month,
          plan.startDate,
          cents(plan.available),
          cents(plan.dailyReserve),
          amount(plan.kmPerLiter),
          cents(plan.fuelPrice),
          amount(plan.kmPerWorkday),
          plan.enabled === false ? 0 : 1,
          existing?.created_at || now,
          now
        ),
        db.prepare("DELETE FROM plan_items WHERE plan_id = ?").bind(id),
        db.prepare("DELETE FROM plan_days_off WHERE plan_id = ?").bind(id),
        ...validItems.map((item) =>
          db.prepare(
            `INSERT INTO plan_items (id, plan_id, description, amount_cents, reserved_cents, due_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(item.id || crypto.randomUUID(), id, String(item.description).trim(), cents(item.amount), cents(item.reserved), item.dueDate, now)
        ),
        ...daysOff.map((offDate) =>
          db.prepare("INSERT INTO plan_days_off (id, plan_id, off_date) VALUES (?, ?, ?)")
            .bind(crypto.randomUUID(), id, offDate)
        ),
      ];
      await db.batch(statements);
      return Response.json({ ok: true, id });
    }

    return Response.json({ error: "Operação inválida." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível salvar." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const planId = params.get("planId");
    if (planId) {
      await getRotasDb().prepare("DELETE FROM monthly_plans WHERE id = ?").bind(planId).run();
      return Response.json({ ok: true });
    }
    const id = params.get("id");
    if (!id) {
      return Response.json({ error: "Registro não informado." }, { status: 400 });
    }
    await getRotasDb().prepare("DELETE FROM work_sessions WHERE id = ?").bind(id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível excluir." },
      { status: 500 }
    );
  }
}
