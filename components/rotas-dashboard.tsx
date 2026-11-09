"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Calculator,
  CalendarClock,
  CalendarDays,
  CalendarX,
  Car,
  Check,
  Clock3,
  Fuel,
  Gauge,
  Package,
  Pencil,
  PiggyBank,
  Plus,
  Route,
  Settings2,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

type RotasResponse = { error?: string; sessions?: Record<string, unknown>[]; goals?: Record<string, unknown>[]; plans?: Record<string, unknown>[]; planItems?: Record<string, unknown>[]; planDaysOff?: Record<string, unknown>[]; settings?: { automatic_reserves?: boolean; maintenance_percent?: number; investment_percent?: number } };
type Platform = "shopee" | "99" | "uber";
type RouteExpense = { id: string; description: string; amountCents: number };

type WorkSession = {
  id: string;
  date: string;
  platform: Platform;
  startTime: string;
  endTime: string;
  kmDriven: number;
  kmPerLiter: number;
  fuelPriceCents: number;
  earningsCents: number;
  fuelCents: number;
  maintenanceCents: number;
  investmentCents: number;
  expenses: RouteExpense[];
  kmStart: number;
};

type DailyGoal = {
  date: string;
  shopeeCents: number;
  ride99Cents: number;
};

type Settings = {
  automaticReserves: boolean;
  maintenancePercent: number;
  investmentPercent: number;
};

type PlanItem = {
  id: string;
  description: string;
  amountCents: number;
  reservedCents: number;
  dueDate: string;
};

type MonthlyPlan = {
  id: string;
  month: string;
  startDate: string;
  availableCents: number;
  dailyReserveCents: number;
  kmPerLiter: number;
  fuelPriceCents: number;
  kmPerWorkday: number;
  enabled: boolean;
  items: PlanItem[];
  daysOff: string[];
};

type PlanForm = {
  id: string;
  month: string;
  startDate: string;
  available: string;
  dailyReserve: string;
  kmPerLiter: string;
  fuelPrice: string;
  kmPerWorkday: string;
  enabled: boolean;
  items: Array<{ id: string; description: string; amount: string; reserved: string; dueDate: string }>;
  daysOff: string[];
};

type PlanPhase = {
  startDate: string;
  endDate: string;
  workDays: number;
  netDailyCents: number;
  fuelDailyCents: number;
  grossDailyCents: number;
};

type SessionForm = {
  id: string;
  date: string;
  platform: Platform;
  startTime: string;
  endTime: string;
  kmDriven: string;
  kmPerLiter: string;
  fuelPrice: string;
  earnings: string;
  maintenance: string;
  investment: string;
  expenses: Array<{ id: string; description: string; amount: string }>;
  kmMode: "trip" | "odometer";
  kmStart: string;
  kmEnd: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" });

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatDate(key: string) {
  return shortDate.format(dateFromKey(key)).replace(".", "");
}

function minutesBetween(start: string, end: string) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  let minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
}

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h${rest ? ` ${String(rest).padStart(2, "0")}min` : ""}`;
}

function emptySession(date: string): SessionForm {
  const now = new Date();
  const startTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return {
    id: "",
    date,
    platform: "shopee",
    startTime,
    endTime: "",
    kmDriven: "",
    kmPerLiter: "",
    fuelPrice: "",
    earnings: "",
    maintenance: "",
    investment: "",
    expenses: [], kmMode: "trip", kmStart: "", kmEnd: "",
  };
}

function emptyPlan(date: string): PlanForm {
  return {
    id: "",
    month: date.slice(0, 7),
    startDate: date,
    available: "",
    dailyReserve: "10",
    kmPerLiter: "9.7",
    fuelPrice: "",
    kmPerWorkday: "",
    enabled: true,
    items: [{ id: crypto.randomUUID(), description: "", amount: "", reserved: "0", dueDate: "" }],
    daysOff: [],
  };
}

function nextDateKey(key: string) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + 1);
  return localDateKey(date);
}

function countWorkDays(start: string, end: string, daysOff: Set<string>) {
  if (start > end) return 0;
  let count = 0;
  const cursor = dateFromKey(start);
  const final = dateFromKey(end);
  while (cursor <= final) {
    if (!daysOff.has(localDateKey(cursor))) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function calculateBillProgress(plan: MonthlyPlan, sessions: WorkSession[] = [], asOfDate = plan.startDate) {
  const earningsByDay = new Map<string, number>();
  for (const session of sessions) {
    if (session.date < plan.startDate || session.date > asOfDate) continue;
    earningsByDay.set(
      session.date,
      (earningsByDay.get(session.date) || 0) + session.earningsCents - session.fuelCents - session.maintenanceCents - session.investmentCents - expenseTotal(session),
    );
  }
  const earnedForBills = [...earningsByDay.values()].reduce(
    (total, dailyNet) => total + (dailyNet < 0 ? dailyNet : Math.max(0, dailyNet - plan.dailyReserveCents)),
    0,
  );
  let available = Math.max(0, plan.availableCents + earnedForBills);
  return [...plan.items]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((item) => {
      const reserved = Math.min(item.amountCents, item.reservedCents);
      const availableApplied = Math.min(item.amountCents - reserved, available);
      available -= availableApplied;
      const coveredCents = reserved + availableApplied;
      return {
        id: item.id,
        coveredCents,
        remainingCents: Math.max(0, item.amountCents - coveredCents),
      };
    });
}

export function calculatePlan(plan: MonthlyPlan, sessions: WorkSession[] = [], asOfDate = plan.startDate) {
  const items = [...plan.items].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const off = new Set(plan.daysOff);
  const phases: PlanPhase[] = [];
  let cursor = asOfDate > plan.startDate ? asOfDate : plan.startDate;
  let cash = 0;
  const progressByItem = new Map(calculateBillProgress(plan, sessions, asOfDate).map((item) => [item.id, item]));
  let remaining = items
    .map((item) => ({ ...item, amountCents: progressByItem.get(item.id)?.remainingCents ?? item.amountCents }))
    .filter((item) => item.amountCents > 0);
  let impossible = "";
  const fuelDailyCents = plan.kmPerLiter > 0 && plan.fuelPriceCents > 0 && plan.kmPerWorkday > 0
    ? Math.ceil((plan.kmPerWorkday / plan.kmPerLiter) * (plan.fuelPriceCents / 100)) * 100
    : 0;

  while (remaining.length) {
    let cumulative = 0;
    let highestRate = -Infinity;
    let bindingIndex = 0;
    for (let index = 0; index < remaining.length; index += 1) {
      cumulative += remaining[index].amountCents;
      const workDays = countWorkDays(cursor, remaining[index].dueDate, off);
      const deficit = Math.max(0, cumulative - cash);
      if (!workDays && deficit > 0) {
        impossible = `Não há dia de trabalho disponível antes de ${formatDate(remaining[index].dueDate)}.`;
        break;
      }
      const rate = workDays ? deficit / workDays : 0;
      if (rate >= highestRate) {
        highestRate = rate;
        bindingIndex = index;
      }
    }
    if (impossible) break;

    const endDate = remaining[bindingIndex].dueDate;
    const workDays = countWorkDays(cursor, endDate, off);
    const netDailyCents = Math.max(0, Math.ceil(highestRate));
    phases.push({
      startDate: cursor,
      endDate,
      workDays,
      netDailyCents,
      fuelDailyCents,
      grossDailyCents: netDailyCents + plan.dailyReserveCents + fuelDailyCents,
    });
    cash += netDailyCents * workDays;
    for (let index = 0; index <= bindingIndex; index += 1) cash -= remaining[index].amountCents;
    remaining = remaining.slice(bindingIndex + 1);
    cursor = nextDateKey(endDate);
  }

  return { phases, impossible, fuelDailyCents };
}

function expenseTotal(session: WorkSession) { return (session.expenses || []).reduce((sum, item) => sum + item.amountCents, 0); }
function normalizeSession(row: Record<string, unknown>): WorkSession {
  const legacyKm = Math.max(0, Number(row.km_end) - Number(row.km_start));
  const legacyLiters = Number(row.liters);
  const kmDriven = Number(row.km_driven) || legacyKm;
  const kmPerLiter = Number(row.km_per_liter) || (legacyLiters ? legacyKm / legacyLiters : 0);
  const fuelCents = Number(row.fuel_cents);
  return {
    id: String(row.id),
    date: String(row.work_date),
    platform: row.platform === "uber" ? "uber" : row.platform === "99" ? "99" : "shopee",
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    kmDriven,
    kmPerLiter,
    fuelPriceCents: Number(row.fuel_price_cents) || (legacyLiters ? Math.round(fuelCents / legacyLiters) : 0),
    earningsCents: Number(row.earnings_cents),
    fuelCents,
    maintenanceCents: Number(row.maintenance_cents),
    investmentCents: Number(row.investment_cents),
    expenses: JSON.parse(String(row.expenses_json || "[]")),
    kmStart: Number(row.km_start || 0),
  };
}

function summarize(list: WorkSession[]) {
  return list.reduce(
    (total, item) => {
      total.earnings += item.earningsCents;
      total.fuel += item.fuelCents;
      total.maintenance += item.maintenanceCents;
      total.investment += item.investmentCents;
      total.extras += expenseTotal(item);
      total.km += item.kmDriven;
      total.fuelLiters += item.kmPerLiter ? item.kmDriven / item.kmPerLiter : 0;
      total.minutes += minutesBetween(item.startTime, item.endTime);
      return total;
    },
    { earnings: 0, fuel: 0, maintenance: 0, investment: 0, extras: 0, km: 0, fuelLiters: 0, minutes: 0 }
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`field-stack ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function MoneyInput({ label, value, onChange, disabled = false, required = false, max }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; required?: boolean; max?: number }) {
  return (
    <Field label={label}>
      <div className="money-input">
        <span>R$</span>
        <Input required={required} inputMode="decimal" type="number" step="0.01" min="0" max={max} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      </div>
    </Field>
  );
}

function MetricCard({ icon: Icon, label, value, detail, accent = false }: { icon: typeof Wallet; label: string; value: string; detail: string; accent?: boolean }) {
  return (
    <article className={`metric-card ${accent ? "metric-card-accent" : ""}`}>
      <div className="metric-icon"><Icon size={18} strokeWidth={2} /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  );
}

export function RotasDashboard({ firstName }: { firstName: string | null }) {
  const [theme, setTheme] = useState("dark");
  useEffect(() => { const saved = localStorage.getItem("rotago-theme") || "dark"; setTheme(saved); document.documentElement.classList.toggle("light", saved === "light"); document.documentElement.classList.toggle("dark", saved !== "light"); }, []);
  function toggleTheme() { const next = theme === "dark" ? "light" : "dark"; setTheme(next); localStorage.setItem("rotago-theme", next); document.documentElement.classList.toggle("light", next === "light"); document.documentElement.classList.toggle("dark", next !== "light"); }
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [plans, setPlans] = useState<MonthlyPlan[]>([]);
  const [settings, setSettings] = useState<Settings>({ automaticReserves: false, maintenancePercent: 10, investmentPercent: 10 });
  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [sessionForm, setSessionForm] = useState<SessionForm>(() => emptySession(localDateKey()));
  const [goalForm, setGoalForm] = useState({ shopee: "", ride99: "" });
  const [settingsForm, setSettingsForm] = useState(settings);
  const [planForm, setPlanForm] = useState<PlanForm>(() => emptyPlan(localDateKey()));
  const [newOffDate, setNewOffDate] = useState("");
  const [reportPeriod, setReportPeriod] = useState("week");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/rotas", { cache: "no-store" });
      const data = await response.json() as RotasResponse;
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar.");
      setSessions((data.sessions || []).map(normalizeSession));
      setGoals((data.goals || []).map((row: Record<string, unknown>) => ({
        date: String(row.work_date),
        shopeeCents: Number(row.shopee_cents),
        ride99Cents: Number(row.ride_99_cents),
      })));
      const itemRows = (data.planItems || []) as Array<Record<string, unknown>>;
      const dayOffRows = (data.planDaysOff || []) as Array<Record<string, unknown>>;
      setPlans(((data.plans || []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        month: String(row.month),
        startDate: String(row.start_date),
        availableCents: Number(row.available_cents),
        dailyReserveCents: Number(row.daily_reserve_cents),
        kmPerLiter: Number(row.km_per_liter),
        fuelPriceCents: Number(row.fuel_price_cents),
        kmPerWorkday: Number(row.km_per_workday),
        enabled: Boolean(row.enabled),
        items: itemRows.filter((item) => item.plan_id === row.id).map((item) => ({
          id: String(item.id),
          description: String(item.description),
          amountCents: Number(item.amount_cents),
          reservedCents: Number(item.reserved_cents || 0),
          dueDate: String(item.due_date),
        })),
        daysOff: dayOffRows.filter((day) => day.plan_id === row.id).map((day) => String(day.off_date)),
      })));
      const nextSettings = {
        automaticReserves: Boolean(data.settings?.automatic_reserves),
        maintenancePercent: Number(data.settings?.maintenance_percent ?? 10),
        investmentPercent: Number(data.settings?.investment_percent ?? 10),
      };
      setSettings(nextSettings);
      setSettingsForm(nextSettings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar seus dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void loadData(); });
  }, [loadData]);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const daySessions = useMemo(() => sessions.filter((item) => item.date === selectedDate), [sessions, selectedDate]);
  const daySummary = useMemo(() => summarize(daySessions), [daySessions]);
  const selectedGoal = goals.find((goal) => goal.date === selectedDate) ?? { date: selectedDate, shopeeCents: 0, ride99Cents: 0 };
  const manualGoalTotal = selectedGoal.shopeeCents + selectedGoal.ride99Cents;
  const goalPlan = plans.find(p => p.month === selectedDate.slice(0,7) && p.enabled);
  const dayStartSessions = sessions.filter(s => s.date < selectedDate);
  const dayPlan = goalPlan ? calculatePlan(goalPlan, dayStartSessions, selectedDate) : null;
  const dayPhase = dayPlan?.phases.find(p => selectedDate >= p.startDate && selectedDate <= p.endDate);
  const goalTotal = goalPlan ? (goalPlan.daysOff.includes(selectedDate) ? 0 : dayPhase?.grossDailyCents || 0) : manualGoalTotal;
  const progress = goalTotal ? Math.min(100, Math.round((daySummary.earnings / goalTotal) * 100)) : 0;
  const costs = daySummary.fuel + daySummary.maintenance + daySummary.investment + daySummary.extras;
  const profit = daySummary.earnings - costs;
  const consumption = daySummary.fuelLiters ? daySummary.km / daySummary.fuelLiters : 0;
  const hourly = daySummary.minutes ? daySummary.earnings / (daySummary.minutes / 60) : 0;
  const selectedPlan = plans.find((plan) => plan.month === selectedDate.slice(0, 7));
  const selectedPlanCalculation = useMemo(
    () => selectedPlan ? calculatePlan(selectedPlan, sessions, selectedDate) : null,
    [selectedPlan, sessions, selectedDate]
  );
  const selectedPlanProgress = useMemo(
    () => selectedPlan ? calculateBillProgress(selectedPlan, sessions, selectedDate) : [],
    [selectedPlan, sessions, selectedDate]
  );
  const selectedPlanTotal = selectedPlan?.items.reduce((sum, item) => sum + item.amountCents, 0) ?? 0;
  const activePhase = selectedPlanCalculation?.phases.find((phase) => selectedDate >= phase.startDate && selectedDate <= phase.endDate);

  const reportRange = useMemo(() => {
    const focus = dateFromKey(selectedDate);
    let start = new Date(focus);
    let end = new Date(focus);
    if (reportPeriod === "week") {
      const day = focus.getDay() || 7;
      start.setDate(focus.getDate() - day + 1);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (reportPeriod === "month") {
      start = new Date(focus.getFullYear(), focus.getMonth(), 1, 12);
      end = new Date(focus.getFullYear(), focus.getMonth() + 1, 0, 12);
    }
    return { start: localDateKey(start), end: localDateKey(end) };
  }, [selectedDate, reportPeriod]);

  const reportSessions = useMemo(
    () => sessions.filter((item) => item.date >= reportRange.start && item.date <= reportRange.end),
    [sessions, reportRange]
  );
  const reportSummary = useMemo(() => summarize(reportSessions), [reportSessions]);
  const reportCosts = reportSummary.fuel + reportSummary.maintenance + reportSummary.investment + reportSummary.extras;
  const reportProfit = reportSummary.earnings - reportCosts;
  const reportGoal = goals
    .filter((goal) => goal.date >= reportRange.start && goal.date <= reportRange.end)
    .reduce((sum, goal) => sum + goal.shopeeCents + goal.ride99Cents, 0);

  const reportSeries = useMemo(() => {
    const result: { date: string; earnings: number; profit: number }[] = [];
    const cursor = dateFromKey(reportRange.start);
    const end = dateFromKey(reportRange.end);
    while (cursor <= end) {
      const date = localDateKey(cursor);
      const daily = summarize(reportSessions.filter((item) => item.date === date));
      result.push({
        date,
        earnings: daily.earnings,
        profit: daily.earnings - daily.fuel - daily.maintenance - daily.investment - daily.extras,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [reportRange, reportSessions]);

  const maxSeriesValue = Math.max(1, ...reportSeries.map((item) => item.earnings));
  const reportShopee = reportSessions.filter((item) => item.platform === "shopee").reduce((sum, item) => sum + item.earningsCents, 0);
  const reportUber = reportSessions.filter(item => item.platform === "uber").reduce((sum,item)=>sum+item.earningsCents,0);
  const report99 = reportSessions.filter((item) => item.platform === "99").reduce((sum, item) => sum + item.earningsCents, 0);

  function openNewSession() {
    setSessionForm(emptySession(selectedDate));
    setSessionOpen(true);
  }

  function openEditSession(item: WorkSession) {
    setSessionForm({
      id: item.id,
      date: item.date,
      platform: item.platform,
      startTime: item.startTime,
      endTime: item.endTime,
      kmDriven: String(item.kmDriven),
      kmPerLiter: item.kmPerLiter ? String(Number(item.kmPerLiter.toFixed(2))) : "",
      fuelPrice: item.fuelPriceCents ? String(item.fuelPriceCents / 100) : "",
      earnings: String(item.earningsCents / 100),
      maintenance: item.maintenanceCents ? String(item.maintenanceCents / 100) : "",
      investment: item.investmentCents ? String(item.investmentCents / 100) : "",
      expenses: (item.expenses || []).map(e => ({ id:e.id, description:e.description, amount:String(e.amountCents / 100) })),
      kmMode: item.kmStart ? "odometer" : "trip", kmStart:String(item.kmStart || ""), kmEnd:String(item.kmStart + item.kmDriven),
    });
    setSessionOpen(true);
  }

  function openGoals() {
    setGoalForm({
      shopee: selectedGoal.shopeeCents ? String(selectedGoal.shopeeCents / 100) : "",
      ride99: selectedGoal.ride99Cents ? String(selectedGoal.ride99Cents / 100) : "",
    });
    setGoalOpen(true);
  }

  function openPlan() {
    if (selectedPlan) {
      setPlanForm({
        id: selectedPlan.id,
        month: selectedPlan.month,
        startDate: selectedPlan.startDate,
        available: selectedPlan.availableCents ? String(selectedPlan.availableCents / 100) : "",
        dailyReserve: String(selectedPlan.dailyReserveCents / 100),
        kmPerLiter: String(selectedPlan.kmPerLiter),
        fuelPrice: selectedPlan.fuelPriceCents ? String(selectedPlan.fuelPriceCents / 100) : "",
        kmPerWorkday: selectedPlan.kmPerWorkday ? String(selectedPlan.kmPerWorkday) : "",
        enabled: selectedPlan.enabled,
        items: selectedPlan.items.map((item) => ({
          id: item.id,
          description: item.description,
          amount: String(item.amountCents / 100),
          reserved: String(item.reservedCents / 100),
          dueDate: item.dueDate,
        })),
        daysOff: selectedPlan.daysOff,
      });
    } else {
      setPlanForm(emptyPlan(selectedDate));
    }
    setNewOffDate("");
    setPlanOpen(true);
  }

  async function postData(body: unknown) {
    const response = await fetch("/api/rotas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json() as RotasResponse;
    if (!response.ok) throw new Error(data.error || "Não foi possível salvar.");
  }

  async function saveSession(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const earnings = Number(sessionForm.earnings || 0);
      const maintenance = settings.automaticReserves
        ? (earnings * settings.maintenancePercent) / 100
        : Number(sessionForm.maintenance || 0);
      const investment = settings.automaticReserves
        ? (earnings * settings.investmentPercent) / 100
        : Number(sessionForm.investment || 0);
      await postData({
        type: "session",
        session: { ...sessionForm, maintenance, investment, expenses: sessionForm.expenses.map(e => ({ id:e.id, description:e.description, amount:Number(e.amount) })) },
      });
      setSelectedDate(sessionForm.date);
      setSessionOpen(false);
      await loadData();
      toast.success(sessionForm.id ? "Jornada atualizada." : "Jornada registrada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function saveGoal(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await postData({ type: "goal", date: selectedDate, shopee: Number(goalForm.shopee || 0), ride99: Number(goalForm.ride99 || 0) });
      setGoalOpen(false);
      await loadData();
      toast.success("Metas do dia salvas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await postData({ type: "settings", ...settingsForm });
      setSettings(settingsForm);
      setSettingsOpen(false);
      await loadData();
      toast.success("Preferências atualizadas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function savePlan(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await postData({
        type: "plan",
        plan: {
          ...planForm,
          available: Number(planForm.available || 0),
          dailyReserve: Number(planForm.dailyReserve || 0),
          kmPerLiter: Number(planForm.kmPerLiter || 0),
          fuelPrice: Number(planForm.fuelPrice || 0),
          kmPerWorkday: Number(planForm.kmPerWorkday || 0),
          items: planForm.items.map((item) => ({ ...item, amount: Number(item.amount || 0), reserved: Number(item.reserved || 0) })),
        },
      });
      setPlanOpen(false);
      await loadData();
      toast.success("Planejamento salvo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o planejamento.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan() {
    if (!deletePlanId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/rotas?planId=${encodeURIComponent(deletePlanId)}`, { method: "DELETE" });
      const data = await response.json() as RotasResponse;
      if (!response.ok) throw new Error(data.error || "Não foi possível excluir.");
      setDeletePlanId(null);
      await loadData();
      toast.success("Planejamento removido. O restante do app continua igual.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o planejamento.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSession() {
    if (!deleteId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/rotas?id=${encodeURIComponent(deleteId)}`, { method: "DELETE" });
      const data = await response.json() as RotasResponse;
      if (!response.ok) throw new Error(data.error || "Não foi possível excluir.");
      setDeleteId(null);
      await loadData();
      toast.success("Jornada excluída.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    } finally {
      setSaving(false);
    }
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  }

  const autoMaintenance = (Number(sessionForm.earnings || 0) * settings.maintenancePercent) / 100;
  const autoInvestment = (Number(sessionForm.earnings || 0) * settings.investmentPercent) / 100;
  const calculatedFuel =
    Number(sessionForm.kmDriven) > 0 && Number(sessionForm.kmPerLiter) > 0 && Number(sessionForm.fuelPrice) > 0
      ? Math.ceil((Number(sessionForm.kmDriven) / Number(sessionForm.kmPerLiter)) * Number(sessionForm.fuelPrice))
      : 0;
  const planFuelPreview =
    Number(planForm.kmPerWorkday) > 0 && Number(planForm.kmPerLiter) > 0 && Number(planForm.fuelPrice) > 0
      ? Math.ceil((Number(planForm.kmPerWorkday) / Number(planForm.kmPerLiter)) * Number(planForm.fuelPrice))
      : 0;

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="app-frame">
        <header className="app-header">
          <div className="brand-lockup">
            <picture className="rotago-brand"><source media="(min-width: 1050px)" srcSet="/logo-full.png" /><img src="/logo-symbol.png" alt="RotaGo" width={64} height={64} /></picture>
            <div>
              <h1>Rota<b>Go</b></h1>
              <p>{firstName ? `Olá, ${firstName}. ` : ""}Pra você rodar hoje e planejar o amanhã.</p>
            </div>
          </div>
          <div className="header-actions"><Button variant="ghost" size="icon" className="icon-button" onClick={toggleTheme} aria-label="Alternar tema">{theme === "dark" ? "☀" : "☾"}</Button>
            {installPrompt && (
              <Button variant="outline" className="install-button" onClick={installApp}>Instalar app</Button>
            )}
            <Button variant="ghost" size="icon" className="icon-button" onClick={() => { setSettingsForm(settings); setSettingsOpen(true); }} aria-label="Abrir configurações">
              <Settings2 size={20} />
            </Button>
          </div>
        </header>

        <div className="date-strip">
          <div>
            <span>Visão do dia</span>
            <strong>{formatDate(selectedDate)}</strong>
          </div>
          <label className="date-picker">
            <CalendarDays size={18} />
            <span className="sr-only">Escolher data</span>
            <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </label>
        </div>

        <Tabs defaultValue="today" className="main-tabs">
          <TabsList className="main-tabs-list">
            <TabsTrigger value="today">Rota / Meta</TabsTrigger>
            <TabsTrigger value="planner">Planejamento</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="tab-panel">
            {loading ? (
              <div className="loading-grid"><Skeleton className="h-72 rounded-[28px]" /><Skeleton className="h-72 rounded-[28px]" /><Skeleton className="h-36 rounded-[28px]" /><Skeleton className="h-36 rounded-[28px]" /></div>
            ) : (
              <>
                <section className="overview-grid">
                  <article className="goal-card">
                    <div className="goal-copy">
                      <div className="section-eyebrow"><Target size={16} /> Meta de hoje</div>
                      <h2>{currency.format(daySummary.earnings / 100)}</h2>
                      <p>de {currency.format(goalTotal / 100)} planejados{goalPlan ? " · meta automática do plano" : ""}</p><p>{goalTotal ? (daySummary.earnings >= goalTotal ? `${currency.format((daySummary.earnings-goalTotal)/100)} além da meta` : `Faltam ${currency.format((goalTotal-daySummary.earnings)/100)}`) : "Sem meta neste dia"}</p>
                      <Button variant="ghost" className="goal-edit" disabled={Boolean(goalPlan)} onClick={openGoals}>{goalTotal ? "Editar metas" : "Definir metas"} <Pencil size={14} /></Button>
                    </div>
                    <div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}>
                      <div><strong>{progress}%</strong><span>alcançado</span></div>
                    </div>
                    <div className="platform-progress">
                      <div>
                        <span className="platform-dot shopee-dot"><Package size={13} /></span>
                        <p>Shopee <strong>{currency.format(daySessions.filter((item) => item.platform === "shopee").reduce((sum, item) => sum + item.earningsCents, 0) / 100)}</strong></p>
                        <small>meta {currency.format(selectedGoal.shopeeCents / 100)}</small>
                      </div>
                      <div>
                        <span className="platform-dot ride-dot"><Car size={13} /></span>
                        <p>99 Corridas <strong>{currency.format(daySessions.filter((item) => item.platform === "99").reduce((sum, item) => sum + item.earningsCents, 0) / 100)}</strong></p>
                        <small>meta {currency.format(selectedGoal.ride99Cents / 100)}</small>
                      </div>
                    </div>
                  </article>

                  <article className="profit-card">
                    <div className="section-eyebrow"><TrendingUp size={16} /> Resultado real</div>
                    <p>Lucro do dia</p>
                    <h2 className={profit < 0 ? "negative" : ""}>{currency.format(profit / 100)}</h2>
                    <div className="profit-breakdown">
                      <div><span>Ganhos</span><strong>{currency.format(daySummary.earnings / 100)}</strong></div>
                      <div><span>Outros gastos</span><strong>− {currency.format(daySummary.extras / 100)}</strong></div><div><span>Saídas + reservas</span><strong>− {currency.format(costs / 100)}</strong></div>
                    </div>
                    <div className="profit-glow" />
                  </article>
                </section>

                <section className="metrics-grid">
                  <MetricCard icon={Wallet} label="Ganhos por hora" value={currency.format(hourly / 100)} detail={`${formatHours(daySummary.minutes)} trabalhadas`} accent />
                  <MetricCard icon={Route} label="Distância" value={`${daySummary.km.toFixed(1)} km`} detail={daySummary.km ? `${currency.format(daySummary.earnings / daySummary.km / 100)} por km` : "Aguardando jornada"} />
                  <MetricCard icon={Gauge} label="Consumo médio" value={`${consumption.toFixed(1)} km/L`} detail={daySummary.fuelLiters ? "Média das jornadas" : "Informe o km/L"} />
                  <MetricCard icon={Fuel} label="Combustível" value={currency.format(daySummary.fuel / 100)} detail="Custo calculado do dia" />
                </section>

                <section className="sessions-section">
                  <div className="section-heading">
                    <div>
                      <span>Jornadas</span>
                      <h2>Seus períodos do dia</h2>
                    </div>
                    <Button className="primary-action" onClick={openNewSession}><Plus size={18} /> Nova jornada</Button>
                  </div>

                  {daySessions.length ? (
                    <div className="session-list">
                      {daySessions.map((item, index) => {
                        const km = item.kmDriven;
                        const itemCosts = item.fuelCents + item.maintenanceCents + item.investmentCents + expenseTotal(item);
                        return (
                          <article className="session-card" key={item.id}>
                            <div className="session-sequence">{String(index + 1).padStart(2, "0")}</div>
                            <div className={`session-platform ${item.platform}`}>
                              {item.platform === "shopee" ? <Package size={20} /> : <Car size={20} />}
                            </div>
                            <div className="session-main">
                              <div><strong>{item.platform === "shopee" ? "Shopee" : item.platform === "uber" ? "Uber" : "99 Corridas"}</strong><span><Clock3 size={14} /> {item.startTime} — {item.endTime} · {formatHours(minutesBetween(item.startTime, item.endTime))}</span></div>
                              <div className="session-stats"><span>{km.toFixed(1)} km</span><span>{item.kmPerLiter ? `${item.kmPerLiter.toFixed(1)} km/L` : "— km/L"}</span><span>combustível {currency.format(item.fuelCents / 100)}</span>{item.expenses.map(e => <span key={e.id}>{e.description}: {currency.format(e.amountCents / 100)}</span>)}</div>
                            </div>
                            <div className="session-value"><span>ganho</span><strong>{currency.format(item.earningsCents / 100)}</strong><small>líquido {currency.format((item.earningsCents - itemCosts) / 100)}</small></div>
                            <div className="session-actions">
                              <Button size="icon" variant="ghost" onClick={() => openEditSession(item)} aria-label="Editar jornada"><Pencil size={16} /></Button>
                              <Button size="icon" variant="ghost" onClick={() => setDeleteId(item.id)} aria-label="Excluir jornada"><Trash2 size={16} /></Button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div><Route size={26} /></div>
                      <h3>Comece sua rota por aqui</h3>
                      <p>Registre quantos períodos precisar — manhã, tarde ou noite.</p>
                      <Button className="primary-action" onClick={openNewSession}><Plus size={18} /> Registrar primeira jornada</Button>
                    </div>
                  )}
                </section>
              </>
            )}
          </TabsContent>

          <TabsContent value="planner" className="tab-panel">
            <section className="report-header planner-header">
              <div><span>Meta automática</span><h2>Planejamento do mês</h2><p>Contas, combustível e reserva em uma meta diária.</p></div>
              <Button className="primary-action" onClick={openPlan}>{selectedPlan ? <><Pencil size={16} /> Editar plano</> : <><Plus size={17} /> Criar plano</>}</Button>
            </section>

            {loading ? (
              <div className="loading-grid"><Skeleton className="h-72 rounded-[28px]" /><Skeleton className="h-72 rounded-[28px]" /></div>
            ) : !selectedPlan ? (
              <section className="planner-empty">
                <div><Calculator size={30} /></div>
                <h3>Este mês continua livre</h3>
                <p>Crie um planejamento somente quando precisar. Suas jornadas, metas manuais e relatórios não mudam.</p>
                <Button className="primary-action" onClick={openPlan}><Plus size={17} /> Planejar este mês</Button>
              </section>
            ) : (
              <>
                {!selectedPlan.enabled && <div className="planner-paused"><CalendarClock size={18} /><span>O cálculo deste mês está pausado. Você pode reativá-lo ao editar.</span></div>}
                {selectedPlanCalculation?.impossible && <div className="planner-warning"><CalendarX size={18} /><span>{selectedPlanCalculation.impossible}</span></div>}

                <section className={`planner-hero ${!selectedPlan.enabled ? "is-paused" : ""}`}>
                  <article className="planner-target">
                    <div className="section-eyebrow"><Target size={16} /> Meta de {formatDate(selectedDate)}</div>
                    {selectedPlan.daysOff.includes(selectedDate) ? (
                      <><h2>{currency.format(0)}</h2><p>Folga planejada para este dia</p></>
                    ) : activePhase ? (
                      <><h2>{currency.format(activePhase.grossDailyCents / 100)}</h2><p>valor bruto para faturar</p></>
                    ) : (
                      <><h2>—</h2><p>Fora do período planejado</p></>
                    )}
                    {activePhase && !selectedPlan.daysOff.includes(selectedDate) && (
                      <div className="planner-breakdown">
                        <div><span>Para as contas</span><strong>{currency.format(activePhase.netDailyCents / 100)}</strong></div>
                        <div><span>Reserva do dia</span><strong>{currency.format(selectedPlan.dailyReserveCents / 100)}</strong></div>
                        <div><span>Combustível estimado</span><strong>{currency.format(activePhase.fuelDailyCents / 100)}</strong></div>
                      </div>
                    )}
                  </article>

                  <article className="planner-summary">
                    <div className="section-eyebrow"><Wallet size={16} /> Visão do plano</div>
                    <div className="planner-summary-grid">
                      <div><span>Total das contas</span><strong>{currency.format(selectedPlanTotal / 100)}</strong></div>
                      <div><span>Separado para contas</span><strong>{currency.format(selectedPlanProgress.reduce((sum, item) => sum + item.coveredCents, 0) / 100)}</strong></div>
                      <div><span>Consumo usado</span><strong>{selectedPlan.kmPerLiter.toFixed(1)} km/L</strong></div>
                      <div><span>Estimativa diária</span><strong>{selectedPlan.kmPerWorkday.toFixed(1)} km</strong></div>
                    </div>
                  </article>
                </section>

                <section className="planner-grid">
                  <article className="planner-card">
                    <div className="planner-card-heading"><div><span>Ritmo diário</span><h3>Metas até os vencimentos</h3></div><CalendarClock size={20} /></div>
                    <div className="phase-list">
                      {selectedPlanCalculation?.phases.map((phase) => (
                        <div className="phase-row" key={`${phase.startDate}-${phase.endDate}`}>
                          <div><strong>{formatDate(phase.startDate)} — {formatDate(phase.endDate)}</strong><span>{phase.workDays} {phase.workDays === 1 ? "dia de trabalho" : "dias de trabalho"}</span></div>
                          <div><span>meta bruta/dia</span><strong>{currency.format(phase.grossDailyCents / 100)}</strong><small>{currency.format(phase.netDailyCents / 100)} livres para contas</small></div>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="planner-card">
                    <div className="planner-card-heading"><div><span>Compromissos</span><h3>Valores cadastrados</h3></div><PiggyBank size={20} /></div>
                    <p className="bill-progress-note">O progresso considera o saldo inicial, valores já separados e o lucro líquido das jornadas até a data selecionada, descontando combustível, manutenção, investimento, outros gastos e a reserva diária (uma vez por dia). O saldo se atualiza ao criar, editar ou excluir jornadas; valores manuais não são sobrescritos.</p>
                    <div className="bill-list">
                      {selectedPlan.items.map((item) => {
                        const progress = selectedPlanProgress.find((entry) => entry.id === item.id);
                        const covered = progress?.coveredCents ?? 0;
                        const remaining = progress?.remainingCents ?? item.amountCents;
                        const percent = item.amountCents ? Math.round((covered / item.amountCents) * 100) : 0;
                        return (
                          <div className="bill-progress-item" key={item.id}>
                            <div className="bill-progress-heading"><div><strong>{item.description}</strong><span>até {formatDate(item.dueDate)}</span></div><b>{currency.format(item.amountCents / 100)}</b></div>
                            <div className="bill-progress-track" role="progressbar" aria-label={`Progresso de ${item.description}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
                            <div className="bill-progress-caption"><span>{currency.format(covered / 100)} coberto</span><strong>{remaining ? `Faltam ${currency.format(remaining / 100)}` : "Conta coberta"}</strong></div>
                          </div>
                        );
                      })}
                    </div>
                    {selectedPlan.daysOff.length > 0 && (
                      <div className="days-off-summary"><CalendarX size={16} /><span>Folgas: {selectedPlan.daysOff.map(formatDate).join(", ")}</span></div>
                    )}
                    <Button variant="ghost" className="delete-plan-button" onClick={() => setDeletePlanId(selectedPlan.id)}><Trash2 size={15} /> Remover planejamento do mês</Button>
                  </article>
                </section>
              </>
            )}
          </TabsContent>

          <TabsContent value="reports" className="tab-panel">
            <section className="report-header">
              <div><span>Desempenho</span><h2>Relatórios financeiros</h2><p>Entenda onde sua rota rende mais.</p></div>
              <Tabs value={reportPeriod} onValueChange={setReportPeriod}>
                <TabsList className="period-tabs"><TabsTrigger value="day">Diário</TabsTrigger><TabsTrigger value="week">Semanal</TabsTrigger><TabsTrigger value="month">Mensal</TabsTrigger></TabsList>
              </Tabs><footer className="rotago-footer"><span>RotaGo · Seu dinheiro em movimento</span><a href="/versao-anterior/">Acessar versão anterior e exportar dados deste navegador</a></footer>
            </section>

            <section className="report-metrics">
              <article><span>Ganhos</span><strong>{currency.format(reportSummary.earnings / 100)}</strong><small>{reportSessions.length} {reportSessions.length === 1 ? "jornada" : "jornadas"}</small></article>
              <article className="report-profit"><span>Lucro real</span><strong>{currency.format(reportProfit / 100)}</strong><small>{reportSummary.earnings ? Math.round((reportProfit / reportSummary.earnings) * 100) : 0}% dos ganhos</small></article>
              <article><span>Despesas + reservas</span><strong>{currency.format(reportCosts / 100)}</strong><small>combustível, reservas e outros gastos</small></article>
              <article><span>Meta registrada</span><strong>{currency.format(reportGoal / 100)}</strong><small>{reportGoal ? `${Math.round((reportSummary.earnings / reportGoal) * 100)}% alcançada` : "sem meta no período"}</small></article>
            </section>

            <section className="report-grid">
              <article className="chart-card">
                <div className="chart-heading"><div><span>Ganhos por dia</span><h3>{formatDate(reportRange.start)} — {formatDate(reportRange.end)}</h3></div><div className="chart-legend"><span /><small>Ganhos</small></div></div>
                <div className="bar-chart" style={{ gridTemplateColumns: `repeat(${reportSeries.length}, minmax(10px, 1fr))` }}>
                  {reportSeries.map((item) => (
                    <div className="bar-column" key={item.date} title={`${formatDate(item.date)}: ${currency.format(item.earnings / 100)}`}>
                      <div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(item.earnings ? 8 : 2, (item.earnings / maxSeriesValue) * 100)}%` }} /></div>
                      <span>{reportPeriod === "week" ? formatDate(item.date).slice(0, 3) : dateFromKey(item.date).getDate()}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="platform-card">
                <div><span>Por plataforma</span><h3>Origem dos ganhos</h3></div>
                <div className="platform-total-row"><div className="platform-dot shopee-dot"><Package size={16} /></div><div><strong>Shopee</strong><span>{reportSummary.earnings ? Math.round((reportShopee / reportSummary.earnings) * 100) : 0}% do total</span></div><b>{currency.format(reportShopee / 100)}</b></div>
                <div className="platform-total-row"><div className="platform-dot ride-dot"><Car size={16} /></div><div><strong>99 Corridas</strong><span>{reportSummary.earnings ? Math.round((report99 / reportSummary.earnings) * 100) : 0}% do total</span></div><b>{currency.format(report99 / 100)}</b></div>
                <div className="platform-total-row"><div className="platform-dot ride-dot"><Car size={16} /></div><div><strong>Uber</strong><span>{reportSummary.earnings ? Math.round(reportUber / reportSummary.earnings * 100) : 0}% do total</span></div><b>{currency.format(reportUber / 100)}</b></div><div className="cost-list">
                  <div><Fuel size={15} /><span>Combustível</span><strong>{currency.format(reportSummary.fuel / 100)}</strong></div>
                  <div><Wrench size={15} /><span>Manutenção</span><strong>{currency.format(reportSummary.maintenance / 100)}</strong></div>
                  <div><PiggyBank size={15} /><span>Investimento</span><strong>{currency.format(reportSummary.investment / 100)}</strong></div><div><Wallet size={15} /><span>Outros gastos</span><strong>{currency.format(reportSummary.extras / 100)}</strong></div>
                </div>
              </article>
            </section>
          </TabsContent>
        </Tabs><footer className="rotago-footer"><span>RotaGo · Seu dinheiro em movimento</span><a href="/versao-anterior/">Acessar versão anterior e exportar dados deste navegador</a></footer>
      </div>

      <Button className="mobile-fab" onClick={openNewSession} aria-label="Nova jornada"><Plus size={24} /></Button>

      <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
        <DialogContent className="app-dialog session-dialog">
          <form onSubmit={saveSession}>
            <DialogHeader><DialogTitle>{sessionForm.id ? "Editar jornada" : "Nova jornada"}</DialogTitle><DialogDescription>Registre um período de trabalho. Você pode adicionar vários no mesmo dia.</DialogDescription></DialogHeader>
            <div className="form-grid">
              <Field label="Data"><Input required type="date" value={sessionForm.date} onChange={(event) => setSessionForm({ ...sessionForm, date: event.target.value })} /></Field>
              <Field label="Plataforma"><Select value={sessionForm.platform} onValueChange={(value) => setSessionForm({ ...sessionForm, platform: value as Platform })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="shopee">Shopee</SelectItem><SelectItem value="99">99 Corridas</SelectItem><SelectItem value="uber">Uber</SelectItem></SelectContent></Select></Field>
              <Field label="Início"><Input required type="time" value={sessionForm.startTime} onChange={(event) => setSessionForm({ ...sessionForm, startTime: event.target.value })} /></Field>
              <Field label="Término"><Input required type="time" value={sessionForm.endTime} onChange={(event) => setSessionForm({ ...sessionForm, endTime: event.target.value })} /></Field>
              <MoneyInput label="Ganho real" value={sessionForm.earnings} onChange={(earnings) => setSessionForm({ ...sessionForm, earnings })} />
              <Field label="Como informar o trajeto"><select className="route-km-select" value={sessionForm.kmMode} onChange={e => setSessionForm({ ...sessionForm, kmMode:e.target.value as "trip" | "odometer", kmDriven:"" })}><option value="trip">Distância rodada</option><option value="odometer">KM inicial e KM final</option></select></Field>
              {sessionForm.kmMode === "odometer" ? <><Field label="KM inicial"><Input required type="number" min="0" step="0.1" value={sessionForm.kmStart} onChange={e => setSessionForm({ ...sessionForm, kmStart:e.target.value, kmDriven:String(Number(sessionForm.kmEnd)-Number(e.target.value)) })} /></Field><Field label="KM final"><Input required type="number" min={Number(sessionForm.kmStart)+0.1} step="0.1" value={sessionForm.kmEnd} onChange={e => setSessionForm({ ...sessionForm, kmEnd:e.target.value, kmDriven:String(Number(e.target.value)-Number(sessionForm.kmStart)) })} /></Field></> : <Field label="KM rodados"><Input required inputMode="decimal" type="number" step="0.1" min="0.1" value={sessionForm.kmDriven} onChange={(event) => setSessionForm({ ...sessionForm, kmDriven: event.target.value })} /></Field>}
              <Field label="KM rodados por litro (km/L)"><Input required inputMode="decimal" type="number" step="0.1" min="0.1" value={sessionForm.kmPerLiter} onChange={(event) => setSessionForm({ ...sessionForm, kmPerLiter: event.target.value })} /></Field>
              <MoneyInput required label="Preço do litro no posto" value={sessionForm.fuelPrice} onChange={(fuelPrice) => setSessionForm({ ...sessionForm, fuelPrice })} />
              <div className="form-calculation form-calculation-wide"><Fuel size={16} /><span>Combustível calculado</span><strong>{calculatedFuel ? currency.format(calculatedFuel) : "—"}</strong><small>KM rodados ÷ km/L × preço do litro, arredondado para cima</small></div>
              <MoneyInput label={`Reserva manutenção${settings.automaticReserves ? ` (${settings.maintenancePercent}%)` : ""}`} value={settings.automaticReserves ? autoMaintenance.toFixed(2) : sessionForm.maintenance} disabled={settings.automaticReserves} onChange={(maintenance) => setSessionForm({ ...sessionForm, maintenance })} />
              <MoneyInput label={`Reserva investimento${settings.automaticReserves ? ` (${settings.investmentPercent}%)` : ""}`} value={settings.automaticReserves ? autoInvestment.toFixed(2) : sessionForm.investment} disabled={settings.automaticReserves} onChange={(investment) => setSessionForm({ ...sessionForm, investment })} />
            </div>
            <section className="route-expenses"><h3>Outros gastos da rota</h3><p>Alimentação, estacionamento, pedágio ou outros gastos.</p>{sessionForm.expenses.map(expense => <div className="route-expense-row" key={expense.id}><Input aria-label="Descrição do gasto" placeholder="Ex.: alimentação" required maxLength={80} value={expense.description} onChange={e => setSessionForm({ ...sessionForm, expenses:sessionForm.expenses.map(x => x.id === expense.id ? {...x,description:e.target.value} : x) })} /><Input aria-label="Valor do gasto" type="number" inputMode="decimal" required min="0.01" step="0.01" placeholder="R$" value={expense.amount} onChange={e => setSessionForm({ ...sessionForm, expenses:sessionForm.expenses.map(x => x.id === expense.id ? {...x,amount:e.target.value} : x) })} /><Button type="button" variant="ghost" size="icon" aria-label="Remover gasto" onClick={() => setSessionForm({ ...sessionForm, expenses:sessionForm.expenses.filter(x => x.id !== expense.id) })}><Trash2 size={16} /></Button></div>)}<Button type="button" variant="outline" onClick={() => setSessionForm({ ...sessionForm, expenses:[...sessionForm.expenses,{id:crypto.randomUUID(),description:"",amount:""}] })}><Plus size={15} /> Adicionar gasto</Button></section>
            <div className="live-result"><span>Disponível para contas nesta jornada</span><strong>{currency.format((Number(sessionForm.earnings || 0) - calculatedFuel - (settings.automaticReserves ? autoMaintenance : Number(sessionForm.maintenance || 0)) - (settings.automaticReserves ? autoInvestment : Number(sessionForm.investment || 0)) - sessionForm.expenses.reduce((sum,e)=>sum+Number(e.amount || 0),0)))}</strong></div>
            <DialogFooter><Button type="button" variant="ghost" onClick={() => setSessionOpen(false)}>Cancelar</Button><Button className="primary-action" type="submit" disabled={saving}>{saving ? "Salvando..." : <><Check size={17} /> Salvar jornada</>}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
        <DialogContent className="app-dialog small-dialog"><form onSubmit={saveGoal}><DialogHeader><DialogTitle>Metas de {formatDate(selectedDate)}</DialogTitle><DialogDescription>Defina quanto quer faturar em cada plataforma neste dia.</DialogDescription></DialogHeader><div className="goal-form"><MoneyInput label="Meta Shopee" value={goalForm.shopee} onChange={(shopee) => setGoalForm({ ...goalForm, shopee })} /><MoneyInput label="Meta 99 Corridas" value={goalForm.ride99} onChange={(ride99) => setGoalForm({ ...goalForm, ride99 })} /></div><DialogFooter><Button type="button" variant="ghost" onClick={() => setGoalOpen(false)}>Cancelar</Button><Button className="primary-action" type="submit" disabled={saving}>Salvar metas</Button></DialogFooter></form></DialogContent>
      </Dialog>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="app-dialog planner-dialog">
          <form onSubmit={savePlan}>
            <DialogHeader><DialogTitle>{planForm.id ? "Editar planejamento" : "Novo planejamento mensal"}</DialogTitle><DialogDescription>O cálculo é opcional e vale somente para o mês escolhido.</DialogDescription></DialogHeader>

            <div className="setting-toggle planner-toggle">
              <div><strong>Ativar cálculo neste mês</strong><span>Quando pausado, suas jornadas e relatórios continuam funcionando normalmente.</span></div>
              <Switch checked={planForm.enabled} onCheckedChange={(enabled) => setPlanForm({ ...planForm, enabled })} aria-label="Ativar planejamento do mês" />
            </div>

            <div className="plan-form-section">
              <div className="plan-form-title"><span>1</span><div><strong>Período e dinheiro disponível</strong><small>Defina de quando o cálculo deve começar.</small></div></div>
              <div className="form-grid plan-base-grid">
                <Field label="Mês do planejamento"><Input required type="month" value={planForm.month} onChange={(event) => setPlanForm({ ...planForm, month: event.target.value })} /></Field>
                <Field label="Começar em"><Input required type="date" value={planForm.startDate} onChange={(event) => setPlanForm({ ...planForm, startDate: event.target.value })} /></Field>
                <MoneyInput label="Saldo livre inicial" value={planForm.available} onChange={(available) => setPlanForm({ ...planForm, available })} />
                <MoneyInput label="Reserva por dia" value={planForm.dailyReserve} onChange={(dailyReserve) => setPlanForm({ ...planForm, dailyReserve })} required />
              </div>
              <p className="plan-help">Informe aqui o dinheiro ainda sem destino. Valores manuais para uma conta ficam em “Já separado (manual)”. O líquido das jornadas é somado automaticamente no progresso das contas; não o digite novamente.</p>
            </div>

            <div className="plan-form-section">
              <div className="plan-form-title"><span>2</span><div><strong>Estimativa de combustível</strong><small>Use uma média realista para o tipo de trabalho deste mês.</small></div></div>
              <div className="form-grid plan-fuel-grid">
                <Field label="KM previstos por dia"><Input required inputMode="decimal" type="number" step="0.1" min="0.1" value={planForm.kmPerWorkday} onChange={(event) => setPlanForm({ ...planForm, kmPerWorkday: event.target.value })} /></Field>
                <Field label="Média do carro (km/L)"><Input required inputMode="decimal" type="number" step="0.1" min="0.1" value={planForm.kmPerLiter} onChange={(event) => setPlanForm({ ...planForm, kmPerLiter: event.target.value })} /></Field>
                <MoneyInput required label="Preço do litro" value={planForm.fuelPrice} onChange={(fuelPrice) => setPlanForm({ ...planForm, fuelPrice })} />
                <div className="form-calculation"><Fuel size={16} /><span>Combustível por dia</span><strong>{planFuelPreview ? currency.format(planFuelPreview) : "—"}</strong><small>Arredondado para cima</small></div>
              </div>
            </div>

            <div className="plan-form-section">
              <div className="plan-form-title plan-form-title-action"><span>3</span><div><strong>Contas e valores</strong><small>Adicione vencimentos e informe quanto já separou para cada conta.</small></div><Button type="button" variant="outline" onClick={() => setPlanForm({ ...planForm, items: [...planForm.items, { id: crypto.randomUUID(), description: "", amount: "", reserved: "0", dueDate: "" }] })}><Plus size={15} /> Adicionar</Button></div>
              <div className="plan-item-list">
                {planForm.items.map((item, index) => (
                  <div className="plan-item-row" key={item.id}>
                    <Field label={`Conta ${index + 1}`}><Input required placeholder="Ex.: Parcela do carro" value={item.description} onChange={(event) => setPlanForm({ ...planForm, items: planForm.items.map((current) => current.id === item.id ? { ...current, description: event.target.value } : current) })} /></Field>
                    <MoneyInput required label="Valor" value={item.amount} onChange={(amountValue) => setPlanForm({ ...planForm, items: planForm.items.map((current) => current.id === item.id ? { ...current, amount: amountValue } : current) })} />
                    <MoneyInput label="Já separado (manual)" value={item.reserved} max={Number(item.amount || 0)} onChange={(reserved) => setPlanForm({ ...planForm, items: planForm.items.map((current) => current.id === item.id ? { ...current, reserved } : current) })} />
                    <Field label="Preciso até"><Input required type="date" min={planForm.startDate} value={item.dueDate} onChange={(event) => setPlanForm({ ...planForm, items: planForm.items.map((current) => current.id === item.id ? { ...current, dueDate: event.target.value } : current) })} /></Field>
                    <Button type="button" variant="ghost" size="icon" disabled={planForm.items.length === 1} onClick={() => setPlanForm({ ...planForm, items: planForm.items.filter((current) => current.id !== item.id) })} aria-label={`Remover conta ${index + 1}`}><Trash2 size={16} /></Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="plan-form-section">
              <div className="plan-form-title"><span>4</span><div><strong>Dias sem trabalhar</strong><small>Esses dias ficam com meta zero e são excluídos do cálculo.</small></div></div>
              <div className="off-day-adder"><Input type="date" min={planForm.startDate} value={newOffDate} onChange={(event) => setNewOffDate(event.target.value)} /><Button type="button" variant="outline" disabled={!newOffDate || planForm.daysOff.includes(newOffDate)} onClick={() => { setPlanForm({ ...planForm, daysOff: [...planForm.daysOff, newOffDate].sort() }); setNewOffDate(""); }}><Plus size={15} /> Incluir folga</Button></div>
              {planForm.daysOff.length > 0 && <div className="off-day-chips">{planForm.daysOff.map((date) => <button type="button" key={date} onClick={() => setPlanForm({ ...planForm, daysOff: planForm.daysOff.filter((day) => day !== date) })}>{formatDate(date)} <span>×</span></button>)}</div>}
            </div>

            <DialogFooter><Button type="button" variant="ghost" onClick={() => setPlanOpen(false)}>Cancelar</Button><Button className="primary-action" type="submit" disabled={saving}>{saving ? "Calculando..." : <><Calculator size={17} /> Calcular e salvar</>}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="app-dialog small-dialog"><form onSubmit={saveSettings}><DialogHeader><DialogTitle>Configurações</DialogTitle><DialogDescription>Escolha como suas reservas serão informadas.</DialogDescription></DialogHeader><div className="settings-panel"><div className="setting-toggle"><div><strong>Reservas automáticas</strong><span>Desativado por padrão. No modo manual, você digita cada valor.</span></div><Switch checked={settingsForm.automaticReserves} onCheckedChange={(automaticReserves) => setSettingsForm({ ...settingsForm, automaticReserves })} aria-label="Ativar reservas automáticas" /></div>{settingsForm.automaticReserves && <div className="percentage-grid"><Field label="Manutenção (%)"><Input type="number" min="0" max="100" step="0.5" value={settingsForm.maintenancePercent} onChange={(event) => setSettingsForm({ ...settingsForm, maintenancePercent: Number(event.target.value) })} /></Field><Field label="Investimento (%)"><Input type="number" min="0" max="100" step="0.5" value={settingsForm.investmentPercent} onChange={(event) => setSettingsForm({ ...settingsForm, investmentPercent: Number(event.target.value) })} /></Field></div>}</div><DialogFooter><Button type="button" variant="ghost" onClick={() => setSettingsOpen(false)}>Cancelar</Button><Button className="primary-action" type="submit" disabled={saving}>Salvar preferências</Button></DialogFooter></form></DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}><AlertDialogContent className="app-dialog small-dialog"><AlertDialogHeader><AlertDialogTitle>Excluir esta jornada?</AlertDialogTitle><AlertDialogDescription>Os valores dessa jornada serão removidos dos relatórios. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={deleteSession} disabled={saving}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={Boolean(deletePlanId)} onOpenChange={(open) => !open && setDeletePlanId(null)}><AlertDialogContent className="app-dialog small-dialog"><AlertDialogHeader><AlertDialogTitle>Remover o planejamento deste mês?</AlertDialogTitle><AlertDialogDescription>As jornadas, metas manuais e relatórios serão preservados. Somente este cálculo mensal será removido.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={deletePlan} disabled={saving}>Remover planejamento</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <Toaster position="top-center" richColors theme="dark" />
    </main>
  );
}
