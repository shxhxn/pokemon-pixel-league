import { useState } from "react";
import { Search, Check } from "lucide-react";
import { ROSTER, pokemon } from "../../shared/roster";
export function Roster({
  selected,
  onSelect,
  compact = false,
}: {
  selected: number;
  onSelect: (id: number) => void;
  compact?: boolean;
}) {
  const [search, setSearch] = useState(""),
    [type, setType] = useState("All");
  const shown = ROSTER.filter(
    (p) =>
      (type === "All" || p.type === type) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="roster-selector">
      <div className="roster-tools">
        <label className="search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find your partner…"
            aria-label="Search Pokémon"
          />
        </label>
        <select
          value={type}
          aria-label="Filter Pokémon type"
          onChange={(e) => setType(e.target.value)}
        >
          {["All", ...new Set(ROSTER.map((p) => p.type))].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className={"roster-grid " + (compact ? "compact" : "")}>
        {shown.map((p) => (
          <button
            type="button"
            className={
              "pokemon-option " + (p.id === selected ? "selected" : "")
            }
            key={p.id}
            onClick={() => onSelect(p.id)}
            aria-pressed={p.id === selected}
          >
            <span className="dex">#{String(p.id).padStart(3, "0")}</span>
            {p.id === selected && (
              <Check className="selected-check" size={15} />
            )}
            <img src={p.image} alt="" loading="lazy" />
            <strong>{p.name}</strong>
            <small>{p.type}</small>
          </button>
        ))}
      </div>
      {!shown.length && <p className="empty">No partners match that search.</p>}
      <div className="selection-note">
        <span className="status-dot" />
        {pokemon(selected).name} selected{" "}
        <span>Same stats. Your signature style.</span>
      </div>
    </div>
  );
}
