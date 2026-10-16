import { useState } from "react";
import {
  SHOP,
  achievements,
  purchase,
  readSave,
  saveProgress,
  type Save,
} from "../game/action/progression";
import { pokemon, BONUS_PARTNERS } from "../../shared/roster";
export function AdventureWorkshop({
  selected,
  play,
}: {
  selected: number;
  play: (id: number) => void;
}) {
  const [save, setSave] = useState(readSave),
    [message, setMessage] = useState("");
  const persist = (next: Save) => {
    if (saveProgress(next)) {
      setSave(next);
      setMessage("Saved on this browser.");
    } else
      setMessage(
        "Browser storage is unavailable. Your purchase was not saved.",
      );
  };
  return (
    <details className="adventure-workshop">
      <summary>
        Adventure journal & workshop <strong>{save.coins} coins</strong>
      </summary>
      <p>
        Earn coins by playing. All 38 partners remain available. Mastery and
        starting bonuses apply to practice; official runs use equal starting
        stats. Cosmetics work in both modes. Progress stays on this browser.
      </p>
      <div className="workshop-grid">
        {SHOP.map((item) => (
          <article key={item.id}>
            <strong>{item.name}</strong>
            <p>{item.description}</p>
            <button
              disabled={save.owned.includes(item.id) || save.coins < item.cost}
              onClick={() => {
                const next = purchase(save, item.id);
                if (next) persist(next);
              }}
            >
              {save.owned.includes(item.id) ? "Owned" : `${item.cost} coins`}
            </button>
          </article>
        ))}
        <article>
          <strong>{pokemon(selected).name} mastery</strong>
          <p>
            Unlock this partner's upgraded practice attack: burn, water burst,
            longer guard, vine stun or faster bolts.
          </p>
          <button
            disabled={save.upgrades.includes(selected) || save.coins < 250}
            onClick={() => {
              const next = purchase(save, "mastery", selected);
              if (next) persist(next);
            }}
          >
            {save.upgrades.includes(selected)
              ? "Mastered"
              : "Unlock · 250 coins"}
          </button>
        </article>
      </div>
      <div className="bonus-partners">
        {BONUS_PARTNERS.map((p) => (
          <button
            key={p.id}
            disabled={!save.owned.includes(`partner-${p.id}`)}
            onClick={() => play(p.id)}
          >
            <img src={p.image} alt="" />
            {save.owned.includes(`partner-${p.id}`)
              ? `Play as ${p.name}`
              : `${p.name} · locked`}
          </button>
        ))}
      </div>
      <div className="workshop-options">
        <label>
          Partner palette
          <select
            value={save.skin}
            onChange={(e) => persist({ ...save, skin: e.target.value })}
          >
            <option value="classic">Classic</option>
            {save.owned
              .filter((x) => x.startsWith("skin-"))
              .map((x) => (
                <option key={x} value={x}>
                  {x.slice(5)}
                </option>
              ))}
          </select>
        </label>
        <label>
          Trail / attack effect
          <select
            value={save.trail}
            onChange={(e) => persist({ ...save, trail: e.target.value })}
          >
            <option value="classic">Classic dust</option>
            {save.owned.includes("trail-star") && (
              <option value="trail-star">Starlight</option>
            )}
            {save.owned.includes("effect-prism") && (
              <option value="effect-prism">Prismatic attacks</option>
            )}
          </select>
        </label>
        <label>
          Practice start
          <select
            value={save.bonus}
            onChange={(e) => persist({ ...save, bonus: e.target.value })}
          >
            <option value="none">Standard start</option>
            {save.owned
              .filter((x) => x.startsWith("start-"))
              .map((x) => (
                <option key={x} value={x}>
                  {x.slice(6)}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="achievement-grid">
        {achievements(save).map((a) => (
          <article key={a.name} className={a.done ? "earned" : ""}>
            <strong>
              {a.done ? "★" : "◇"} {a.name}
            </strong>
            <span>{a.goal}</span>
            <small>{a.progress}</small>
          </article>
        ))}
      </div>
      <p role="status">{message}</p>
    </details>
  );
}
