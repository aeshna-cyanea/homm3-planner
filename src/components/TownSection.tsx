import { Show, createSignal } from "solid-js";
import type { Planner } from "../planner";
import { ProductionScheme } from "./ProductionScheme";
import { TownRecruitment } from "./Recruitment";

export function TownSection(props: {
  planner: Planner;
  planId: string;
  index: number;
}) {
  const [collapsed, setCollapsed] = createSignal(false);
  const contentId = `town-content-${props.planId}`;

  return (
    <article class="town-section" data-town-id={props.planId}>
      <header class="town-section-header">
        <div>
          <p class="eyebrow">Town {props.index + 1}</p>
          <h2>{props.planner.townLabel(props.planId)}</h2>
        </div>
        <div class="town-section-actions">
          <Show when={props.planner.state.townPlans.length > 1}>
            <button
              class="town-header-button remove-town-button"
              type="button"
              aria-label={`Remove ${props.planner.townLabel(props.planId)}`}
              onClick={() => props.planner.removeTown(props.planId)}
            >
              Remove
            </button>
          </Show>
          <button
            class="town-header-button"
            type="button"
            aria-expanded={!collapsed()}
            aria-controls={contentId}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed() ? "Expand" : "Collapse"}
          </button>
        </div>
      </header>

      <div
        class="planner-layout town-layout"
        id={contentId}
        hidden={collapsed()}
      >
        <ProductionScheme planner={props.planner} planId={props.planId} />
        <TownRecruitment planner={props.planner} planId={props.planId} />
      </div>
    </article>
  );
}
