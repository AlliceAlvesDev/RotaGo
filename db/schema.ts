import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const workSessions = sqliteTable("work_sessions", {
  id: text("id").primaryKey(),
  workDate: text("work_date").notNull(),
  platform: text("platform").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  kmStart: real("km_start").notNull(),
  kmEnd: real("km_end").notNull(),
  liters: real("liters").notNull().default(0),
  kmDriven: real("km_driven").notNull().default(0),
  kmPerLiter: real("km_per_liter").notNull().default(0),
  fuelPriceCents: integer("fuel_price_cents").notNull().default(0),
  earningsCents: integer("earnings_cents").notNull().default(0),
  fuelCents: integer("fuel_cents").notNull().default(0),
  maintenanceCents: integer("maintenance_cents").notNull().default(0),
  investmentCents: integer("investment_cents").notNull().default(0),
  expensesJson: text("expenses_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const dailyGoals = sqliteTable("daily_goals", {
  workDate: text("work_date").primaryKey(),
  shopeeCents: integer("shopee_cents").notNull().default(0),
  ride99Cents: integer("ride_99_cents").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey(),
  automaticReserves: integer("automatic_reserves", { mode: "boolean" })
    .notNull()
    .default(false),
  maintenancePercent: real("maintenance_percent").notNull().default(10),
  investmentPercent: real("investment_percent").notNull().default(10),
  updatedAt: text("updated_at").notNull(),
});

export const monthlyPlans = sqliteTable("monthly_plans", {
  id: text("id").primaryKey(),
  month: text("month").notNull(),
  startDate: text("start_date").notNull(),
  availableCents: integer("available_cents").notNull().default(0),
  dailyReserveCents: integer("daily_reserve_cents").notNull().default(1000),
  kmPerLiter: real("km_per_liter").notNull().default(9.7),
  fuelPriceCents: integer("fuel_price_cents").notNull().default(0),
  kmPerWorkday: real("km_per_workday").notNull().default(0),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("monthly_plans_month_unique").on(table.month)]);

export const planItems = sqliteTable("plan_items", {
  id: text("id").primaryKey(),
  planId: text("plan_id").notNull().references(() => monthlyPlans.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull().default(0),
  reservedCents: integer("reserved_cents").notNull().default(0),
  dueDate: text("due_date").notNull(),
  createdAt: text("created_at").notNull(),
});

export const planDaysOff = sqliteTable("plan_days_off", {
  id: text("id").primaryKey(),
  planId: text("plan_id").notNull().references(() => monthlyPlans.id, { onDelete: "cascade" }),
  offDate: text("off_date").notNull(),
}, (table) => [uniqueIndex("plan_days_off_plan_date_unique").on(table.planId, table.offDate)]);
