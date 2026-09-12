import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronRight, Clock3, ExternalLink, Heart, LoaderCircle, MapPin, Pizza, Plus, RotateCcw, ShieldCheck, ShoppingBag, Sparkles, Trash2, Users } from "lucide-react";
import { API_URL } from "../../services/api";
import "./ConciergeView.css";
import "./ConciergeScrollFix.css";

type PizzaPlan = {
  summary: string;
  size: "Personal" | "Medium" | "Large";
  crust: "Classic" | "Thin" | "Stuffed";
  quantity: number;
  pizzas: Array<{ name: string; toppings: string[]; remove: string[]; notes: string }>;
  sides: string[];
  drinks: string[];
  estimatedTotal: number;
  warnings: string[];
};

type SavedOrder = PizzaPlan & { id: string; savedAt: string; label: string };
type Provider = { name: string; detail: string; url: (postcode: string) => string };

const profileKey = "sentinel-concierge-profile-v1";
const savedKey = "sentinel-concierge-orders-v1";
const providers: Provider[] = [
  { name: "Just Eat", detail: "Compare nearby restaurants", url: postcode => `https://www.just-eat.co.uk/area/${encodeURIComponent(postcode.replace(/\s/g, ""))}` },
  { name: "Deliveroo", detail: "Restaurants and live delivery", url: () => "https://deliveroo.co.uk/menu" },
  { name: "Uber Eats", detail: "Local delivery marketplace", url: () => "https://www.ubereats.com/gb" },
  { name: "Domino's", detail: "Open the official UK ordering flow", url: () => "https://www.dominos.co.uk/" },
];

function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; }
}

export default function ConciergeView() {
  const [request, setRequest] = useState("");
  const [people, setPeople] = useState(2);
  const [profile, setProfile] = useState(() => read(profileKey, { postcode: "", addressLabel: "Home", allergies: "", budget: 35 }));
  const [plan, setPlan] = useState<PizzaPlan | null>(null);
  const [saved, setSaved] = useState<SavedOrder[]>(() => read(savedKey, []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [approved, setApproved] = useState(false);
  const [provider, setProvider] = useState<Provider>(providers[0]);
  const [handoffReady, setHandoffReady] = useState(false);

  useEffect(() => localStorage.setItem(profileKey, JSON.stringify(profile)), [profile]);
  useEffect(() => localStorage.setItem(savedKey, JSON.stringify(saved)), [saved]);
  useEffect(() => { setApproved(false); setHandoffReady(false); }, [plan, provider]);

  const budgetExceeded = Boolean(plan && profile.budget > 0 && plan.estimatedTotal > profile.budget);
  const basketLines = useMemo(() => plan ? [
    ...plan.pizzas.map(item => `${plan.quantity > 1 ? `${plan.quantity}× ` : ""}${plan.size} ${item.name} · ${plan.crust}`),
    ...plan.sides,
    ...plan.drinks,
  ] : [], [plan]);

  async function createPlan(event: FormEvent) {
    event.preventDefault();
    if (!request.trim()) return;
    setLoading(true); setError(""); setPlan(null);
    try {
      const response = await fetch(`${API_URL}/concierge/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ request: request.trim(), people, allergies: profile.allergies, budget: profile.budget }),
      });
      const result = await response.json() as PizzaPlan & { error?: string };
      if (!response.ok) throw new Error(result.error || "Sentinel could not prepare that order.");
      setPlan({ ...result, quantity: Math.max(1, Math.min(8, Number(result.quantity) || 1)), estimatedTotal: Math.max(0, Number(result.estimatedTotal) || 0) });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Sentinel could not prepare that order."); }
    finally { setLoading(false); }
  }

  function saveFavourite() {
    if (!plan) return;
    const label = window.prompt("Name this favourite order", plan.summary.slice(0, 45));
    if (!label?.trim()) return;
    setSaved(items => [{ ...plan, id: crypto.randomUUID(), savedAt: new Date().toISOString(), label: label.trim() }, ...items].slice(0, 12));
  }

  function approveHandoff() {
    if (!plan || !approved || budgetExceeded || !profile.postcode.trim()) return;
    setHandoffReady(true);
  }

  return <div className="concierge-view">
    <header className="concierge-heading">
      <div><span><Sparkles />PERSONAL SERVICE</span><h1>Sentinel Concierge</h1><p>Plan the order, inspect every detail, then approve a secure provider handoff.</p></div>
      <div className="concierge-safety"><ShieldCheck /><span><strong>Approval protected</strong><small>No cards or provider passwords are stored</small></span></div>
    </header>

    <section className="concierge-hero">
      <div className="concierge-orb"><Pizza /><i /><i /></div>
      <div><span>PIZZA CONCIERGE · FIRST WORKFLOW</span><h2>What would you like tonight?</h2><p>Use natural language. Include sizes, toppings, sides, dietary needs and a budget—or let Sentinel propose a sensible basket.</p></div>
      <div className="concierge-profile-summary"><MapPin /><span><small>Deliver to</small><strong>{profile.postcode || "Add postcode"}</strong></span><Users /><span><small>People</small><strong>{people}</strong></span></div>
    </section>

    <div className="concierge-grid">
      <main>
        <form className="concierge-request" onSubmit={createPlan}>
          <label>ASK SENTINEL TO BUILD THE BASKET</label>
          <textarea value={request} onChange={event => setRequest(event.target.value)} placeholder="For example: Two large pizzas for four people, one pepperoni and one vegetarian, garlic bread and drinks. Keep it under £35." />
          <div><div className="concierge-people"><button type="button" onClick={() => setPeople(value => Math.max(1, value - 1))}>−</button><span><Users />{people} people</span><button type="button" onClick={() => setPeople(value => Math.min(12, value + 1))}>+</button></div><button className="concierge-build" disabled={loading || !request.trim()}>{loading ? <LoaderCircle className="concierge-spin" /> : <Sparkles />}{loading ? "Planning" : "Build order"}</button></div>
        </form>

        {error && <div className="concierge-error"><AlertTriangle />{error}</div>}

        {!plan ? <section className="concierge-empty"><ShoppingBag /><h2>Your basket is ready for an idea</h2><p>Sentinel will create an editable plan. Prices remain estimates until the selected provider confirms its live menu.</p><div>{["Friday pizza for four", "Vegetarian meal under £25", "My usual with garlic bread"].map(text => <button key={text} onClick={() => setRequest(text)}>{text}<ChevronRight /></button>)}</div></section> :
          <section className="concierge-basket">
            <header><div><span>PROPOSED BASKET</span><h2>{plan.summary}</h2></div><div><button onClick={saveFavourite}><Heart />Save favourite</button><button onClick={() => setPlan(null)}><RotateCcw />Start again</button></div></header>
            <div className="concierge-basket-lines">
              {plan.pizzas.map((pizza, index) => <article key={`${pizza.name}-${index}`}><div className="concierge-item-icon"><Pizza /></div><div><strong>{plan.quantity}× {plan.size} {pizza.name}</strong><span>{plan.crust} crust · {pizza.toppings.join(", ") || "standard toppings"}</span>{pizza.remove.length > 0 && <small>Remove: {pizza.remove.join(", ")}</small>}{pizza.notes && <small>{pizza.notes}</small>}</div></article>)}
              {[...plan.sides, ...plan.drinks].map((item, index) => <article key={`${item}-${index}`}><div className="concierge-item-icon"><Plus /></div><div><strong>{item}</strong><span>Confirm size and live price with the provider</span></div></article>)}
            </div>
            {(profile.allergies || plan.warnings.length > 0) && <div className="concierge-warning"><AlertTriangle /><div><strong>Safety check required</strong>{profile.allergies && <p>Saved requirements: {profile.allergies}</p>}{plan.warnings.map(item => <p key={item}>{item}</p>)}<small>The restaurant—not Sentinel—must confirm allergen suitability.</small></div></div>}
            <footer><div><small>PLANNING ESTIMATE</small><strong>£{plan.estimatedTotal.toFixed(2)}</strong><span>Provider price, fees and availability may differ.</span></div><button onClick={() => setReviewOpen(true)}>Review and approve <ChevronRight /></button></footer>
          </section>}

        {saved.length > 0 && <section className="concierge-favourites"><header><Heart /><div><h2>Saved favourites</h2><p>Recall an order without rebuilding it.</p></div></header><div>{saved.map(item => <article key={item.id}><button onClick={() => { setPlan(item); setRequest(item.label); }}><strong>{item.label}</strong><span>{item.pizzas.map(pizza => pizza.name).join(" · ")}</span><small>Estimated £{item.estimatedTotal.toFixed(2)} · saved {new Date(item.savedAt).toLocaleDateString()}</small></button><button aria-label={`Delete ${item.label}`} onClick={() => setSaved(items => items.filter(savedItem => savedItem.id !== item.id))}><Trash2 /></button></article>)}</div></section>}
      </main>

      <aside className="concierge-rail">
        <section><header><MapPin /><div><h2>Delivery profile</h2><p>Stored only on this computer</p></div></header><label>Address label<input value={profile.addressLabel} onChange={event => setProfile(value => ({ ...value, addressLabel: event.target.value }))} placeholder="Home" /></label><label>Postcode<input value={profile.postcode} onChange={event => setProfile(value => ({ ...value, postcode: event.target.value.toUpperCase() }))} placeholder="HP11 1AA" /></label><label>Allergies or dietary needs<textarea value={profile.allergies} onChange={event => setProfile(value => ({ ...value, allergies: event.target.value }))} placeholder="For example: nut allergy, vegetarian" /></label><label>Maximum order budget<div className="concierge-money">£<input type="number" min="0" step="1" value={profile.budget} onChange={event => setProfile(value => ({ ...value, budget: Number(event.target.value) }))} /></div></label></section>
        <section><header><Clock3 /><div><h2>How approval works</h2><p>Sentinel never purchases silently</p></div></header><ol><li><i>1</i>Build and edit the basket</li><li><i>2</i>Review provider and estimate</li><li><i>3</i>Give explicit approval</li><li><i>4</i>Confirm live basket and payment with the provider</li></ol></section>
      </aside>
    </div>

    {reviewOpen && plan && <div className="concierge-modal" onMouseDown={() => setReviewOpen(false)}><section onMouseDown={event => event.stopPropagation()}><header><div><span>EXPRESS APPROVAL</span><h2>Review before handoff</h2></div><button onClick={() => setReviewOpen(false)}>×</button></header><div className="concierge-review-lines">{basketLines.map(item => <p key={item}><Check />{item}</p>)}</div><div className="concierge-review-total"><span>Planning estimate</span><strong>£{plan.estimatedTotal.toFixed(2)}</strong></div>{budgetExceeded && <div className="concierge-error"><AlertTriangle />This exceeds your £{profile.budget.toFixed(2)} spending limit.</div>}{!profile.postcode.trim() && <div className="concierge-error"><MapPin />Add your delivery postcode before approval.</div>}<div className="concierge-providers">{providers.map(item => <button className={provider.name === item.name ? "active" : ""} onClick={() => setProvider(item)} key={item.name}><strong>{item.name}</strong><small>{item.detail}</small></button>)}</div><label className="concierge-consent"><input type="checkbox" checked={approved} onChange={event => setApproved(event.target.checked)} /><i>{approved && <Check />}</i><span>I approve this basket estimate and understand that I must verify the live total, address, allergens and payment with {provider.name}.</span></label><button className="concierge-approve" disabled={!approved || budgetExceeded || !profile.postcode.trim()} onClick={approveHandoff}><ShieldCheck />Approve secure handoff</button>{handoffReady && <div className="concierge-handoff"><Check /><div><strong>Approval recorded for this basket</strong><span>No payment has been taken. Continue to {provider.name} to verify the live basket and complete payment.</span></div><a href={provider.url(profile.postcode)} target="_blank" rel="noreferrer">Open {provider.name}<ExternalLink /></a></div>}</section></div>}
  </div>;
}
