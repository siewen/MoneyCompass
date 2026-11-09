// The demo profile: a made-up household with a few problems and a few opportunities, so that a new user sees the advisors work
// before entering any own data. It is a separate profile: the user's own data is never touched.
import { T, State, newData, createProfile, switchTo, deleteProfile, profiles, isoDate, today, addMonths, uuid } from "./core.js";

export function buildDemo() {
  const d = newData(), t = today(), s = d.Settings;
  const month = n => addMonths(new Date(t.getFullYear(), t.getMonth(), 1), n);
  d.Incomes.push({ Id: uuid(), Name: T("Salary"), Type: "Salary", Amount: 7800, Currency: "PLN", Frequency: "Monthly", Date: isoDate(month(-3)), Active: true });
  // Three full months of spending: a little more than comfortable, so the advisors have something to say
  const rows = [["Housing / rent", T("Rent"), 2300, true], ["Food & groceries", T("Groceries"), 1250, true], ["Transport / fuel", T("Fuel and tickets"), 420, true], ["Housing / rent", T("Utilities"), 480, true],
    ["Hobbies & leisure", T("Restaurants and fun"), 900, false], ["Shopping", T("Clothes and online shopping"), 850, false], ["Other", T("Subscriptions"), 140, false]];
  // from the 1st to the last day of each month, so the months count as complete
  for (let m = -3; m <= -1; m++) rows.forEach(([cat, name, amt, ess], i) => { const x = month(m), last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(), day = i === 0 ? 1 : i === rows.length - 1 ? last : 3 + i * 4;
    d.Expenses.push({ Id: uuid(), Date: isoDate(new Date(x.getFullYear(), x.getMonth(), day)), Description: name, Category: cat, Amount: amt + (m % 2 ? 40 : -30), Essential: ess }); });
  d.Holdings.push({ Id: uuid(), Name: T("Main account"), Place: "Bank", Amount: 7200, Currency: "PLN", RatePercent: 0.5, Safe: true },
    { Id: uuid(), Name: T("Cash at home"), Place: "Cash", Amount: 600, Currency: "PLN", RatePercent: 0, Safe: true });
  d.Loans.push({ Id: uuid(), Name: T("Car loan"), Kind: "car", Original: 32000, Remaining: 24000, MonthlyPayment: 780, RatePercent: 11.5, EndDate: isoDate(addMonths(t, 36)) });
  d.Goals.push({ Id: uuid(), Name: T("Holiday"), Target: 6000, Saved: 1200, TargetDate: isoDate(addMonths(t, 8)), HoldingId: "" });
  // A little history, so Net Worth shows a trend from the first minute
  const key = n => { const x = month(n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; };
  s.SavingsHistory = { [key(-5)]: 4100, [key(-4)]: 5200, [key(-3)]: 5900, [key(-2)]: 6600, [key(-1)]: 7300 };
  s.DebtHistory = { [key(-5)]: 29000, [key(-4)]: 28000, [key(-3)]: 27000, [key(-2)]: 26000, [key(-1)]: 25000 };
  Object.assign(s, { ProfileName: T("Demo profile"), IsDemo: true, AskOnStart: false, GuideHidden: true, Modules: ["loans", "budget", "taxes"], Language: State.data.Settings.Language, EmergencyMonths: 3 });
  return d;
}

/** Opens the demo as its own profile. */
export function startDemo() { createProfile(T("Demo profile"), buildDemo()); }

/** Leaves the demo: back to the user's own profile (a new empty one if there is none) and removes the demo. */
export function leaveDemo() {
  const demo = State.id, own = profiles().find(p => p.id !== demo);
  if (own) switchTo(own.id); else createProfile(T("My profile"));
  deleteProfile(demo);
  if (State.id === demo) createProfile(T("My profile"));
}
export const isDemo = () => !!State.data.Settings.IsDemo;
