// Pure HTML render functions for each interactive question type.
// renderControl  — pre-submission interactive control
// renderAnswered — post-submission read-only answered section

import type { Question, AnswerValue } from "./validate.ts";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str: string): string {
  return escapeHtml(str);
}

// ─── Header shared by both control and answered sections ──────────────────────

function renderSectionHeader(q: Question): string {
  const qTextEsc = escapeHtml(q.question);
  const contextLine =
    q.context !== undefined ? `\n  <p class="cs-context">${escapeHtml(q.context)}</p>` : "";
  const eyebrow = q.context !== undefined ? `QUESTION | ${escapeHtml(q.context)}` : "QUESTION";
  return `  <p class="eyebrow">${eyebrow}</p>
  <h3 class="h-section">${qTextEsc}</h3>${contextLine}`;
}

// ─── renderControl — interactive (pre-submission) ─────────────────────────────

function renderPickOneControl(q: Extract<Question, { type: "pick_one" }>): string {
  const buttons = q.options
    .map((opt) => {
      const isRecommended = q.recommended !== undefined && q.recommended === opt.id;
      const cls = isRecommended ? "cs-pick cs-recommended" : "cs-pick";
      const recommendedChip = isRecommended
        ? `\n    <span class="eyebrow" style="color: var(--accent);">RECOMMENDED</span>`
        : "";
      const descLine =
        opt.description !== undefined
          ? `\n    <p class="cs-pick-desc">${escapeHtml(opt.description)}</p>`
          : "";
      return `  <button class="${cls}" data-value="${escapeAttr(opt.id)}">
    <strong>${escapeHtml(opt.label)}</strong>${recommendedChip}${descLine}
  </button>`;
    })
    .join("\n");
  return buttons;
}

function renderPickManyControl(q: Extract<Question, { type: "pick_many" }>): string {
  const hint =
    q.min !== undefined || q.max !== undefined
      ? (() => {
          const parts: string[] = [];
          if (q.min !== undefined) parts.push(`at least ${q.min}`);
          if (q.max !== undefined) parts.push(`at most ${q.max}`);
          return `\n  <p class="eyebrow">PICK ${parts.join(" / ")}</p>`;
        })()
      : "";
  const checkboxes = q.options
    .map((opt) => {
      const descLine =
        opt.description !== undefined
          ? `\n    <p class="cs-pick-desc">${escapeHtml(opt.description)}</p>`
          : "";
      return `  <label class="cs-pick">
    <input type="checkbox" data-value="${escapeAttr(opt.id)}">
    <strong>${escapeHtml(opt.label)}</strong>${descLine}
  </label>`;
    })
    .join("\n");
  return `${hint}
${checkboxes}
  <button class="cs-submit" disabled>Submit</button>`;
}

function renderConfirmControl(q: Extract<Question, { type: "confirm" }>): string {
  const yesLabel = escapeHtml(q.yesLabel ?? "Yes");
  const noLabel = escapeHtml(q.noLabel ?? "No");
  return `  <div class="cs-confirm-row">
    <button class="cs-confirm cs-yes" data-value="yes">${yesLabel}</button>
    <button class="cs-confirm cs-no" data-value="no">${noLabel}</button>
  </div>`;
}

function renderAskTextControl(q: Extract<Question, { type: "ask_text" }>): string {
  const placeholder = q.placeholder !== undefined ? escapeAttr(q.placeholder) : "";
  const idAttr = escapeAttr(q.id);
  const skipButton =
    q.optional === true
      ? `\n  <div class="cs-button-row">\n    <button class="cs-submit" data-question-id="${idAttr}" disabled>Submit</button>\n    <button class="cs-skip" data-question-id="${idAttr}">Skip</button>\n  </div>`
      : `\n  <button class="cs-submit" disabled>Submit</button>`;
  if (q.multiline === true) {
    return `  <textarea class="cs-text" rows="4" placeholder="${placeholder}"></textarea>${skipButton}`;
  }
  return `  <input type="text" class="cs-text" placeholder="${placeholder}">${skipButton}`;
}

function renderSliderControl(q: Extract<Question, { type: "slider" }>): string {
  const min = q.min;
  const max = q.max;
  const step = q.step ?? 1;
  const defaultVal = q.defaultValue ?? min;
  return `  <input type="range" class="cs-slider" min="${min}" max="${max}" step="${step}" value="${defaultVal}">
  <output class="cs-slider-out">${defaultVal}</output>
  <button class="cs-submit">Submit</button>`;
}

function renderReactControl(q: Extract<Question, { type: "react" }>): string {
  const mode = q.mode ?? "approve";
  const commentTextarea =
    q.allowComment === true
      ? `\n  <textarea class="cs-react-comment" placeholder="Optional comment..."></textarea>`
      : "";

  let buttons: string;
  if (mode === "thumbs") {
    buttons = `  <button class="cs-react" data-value="up">Thumbs up</button>
  <button class="cs-react" data-value="down">Thumbs down</button>`;
  } else {
    buttons = `  <button class="cs-react" data-value="approve">Approve</button>
  <button class="cs-react" data-value="reject">Reject</button>
  <button class="cs-react" data-value="comment">Just a comment</button>`;
  }

  return `${commentTextarea}
  <div class="cs-react-row">
${buttons}
  </div>`;
}

/** Renders the interactive (pre-submission) control HTML for a question. */
export function renderControl(question: Question): string {
  const idAttr = escapeAttr(question.id);
  const header = renderSectionHeader(question);
  let controlHtml: string;

  switch (question.type) {
    case "pick_one":
      controlHtml = renderPickOneControl(question);
      break;
    case "pick_many":
      controlHtml = renderPickManyControl(question);
      break;
    case "confirm":
      controlHtml = renderConfirmControl(question);
      break;
    case "ask_text":
      controlHtml = renderAskTextControl(question);
      break;
    case "slider":
      controlHtml = renderSliderControl(question);
      break;
    case "react":
      controlHtml = renderReactControl(question);
      break;
  }

  return `<section class="cs-control-${question.type}" data-question-id="${idAttr}">
${header}
${controlHtml}
</section>`;
}

// ─── renderAnswered — read-only post-submission ───────────────────────────────

function renderAnsweredPickOne(
  q: Extract<Question, { type: "pick_one" }>,
  answer: Extract<AnswerValue, { type: "pick_one" }>,
): string {
  const opt = q.options.find((o) => o.id === answer.selected);
  const label = opt !== undefined ? escapeHtml(opt.label) : escapeHtml(answer.selected);
  const descLine =
    opt?.description !== undefined
      ? `\n    <p class="cs-pick-desc">${escapeHtml(opt.description)}</p>`
      : "";
  return `  <div class="cs-pick cs-pick-final">
    <strong>${label}</strong>${descLine}
  </div>`;
}

function renderAnsweredPickMany(
  q: Extract<Question, { type: "pick_many" }>,
  answer: Extract<AnswerValue, { type: "pick_many" }>,
): string {
  return answer.selected
    .map((sel) => {
      const opt = q.options.find((o) => o.id === sel);
      const label = opt !== undefined ? escapeHtml(opt.label) : escapeHtml(sel);
      const descLine =
        opt?.description !== undefined
          ? `\n    <p class="cs-pick-desc">${escapeHtml(opt.description)}</p>`
          : "";
      return `  <div class="cs-pick cs-pick-final">
    <strong>${label}</strong>${descLine}
  </div>`;
    })
    .join("\n");
}

function renderAnsweredConfirm(
  q: Extract<Question, { type: "confirm" }>,
  answer: Extract<AnswerValue, { type: "confirm" }>,
): string {
  const yesClass =
    answer.choice === "yes" ? "cs-confirm cs-confirm-final cs-yes" : "cs-confirm cs-no";
  const noClass =
    answer.choice === "no" ? "cs-confirm cs-confirm-final cs-no" : "cs-confirm cs-yes";
  const yesLabel = escapeHtml(q.yesLabel ?? "Yes");
  const noLabel = escapeHtml(q.noLabel ?? "No");
  if (answer.choice === "yes") {
    return `  <div class="cs-confirm-row">
    <button class="${yesClass}" disabled>${yesLabel}</button>
    <button class="${noClass}" disabled aria-disabled="true" style="opacity: 0.4;">${noLabel}</button>
  </div>`;
  }
  return `  <div class="cs-confirm-row">
    <button class="${yesClass}" disabled aria-disabled="true" style="opacity: 0.4;">${yesLabel}</button>
    <button class="${noClass}" disabled>${noLabel}</button>
  </div>`;
}

function renderAnsweredAskText(
  q: Extract<Question, { type: "ask_text" }>,
  answer: Extract<AnswerValue, { type: "ask_text" }>,
): string {
  if (answer.text === "" && q.optional === true) {
    return `  <p class="cs-answered-skipped"><em>(skipped)</em></p>`;
  }
  const escaped = escapeHtml(answer.text);
  const withBreaks = escaped.replace(/\n/g, "<br>");
  return `  <blockquote class="cs-answered-text">${withBreaks}</blockquote>`;
}

function renderAnsweredSlider(answer: Extract<AnswerValue, { type: "slider" }>): string {
  return `  <p class="cs-slider-final">Value: <strong>${answer.value}</strong></p>`;
}

function renderAnsweredReact(answer: Extract<AnswerValue, { type: "react" }>): string {
  const decisionClass = `cs-react cs-confirm-final`;
  const commentHtml =
    answer.comment !== undefined && answer.comment !== ""
      ? `\n  <p class="cs-comment">${escapeHtml(answer.comment)}</p>`
      : "";
  return `  <div class="cs-react-row">
    <button class="${decisionClass}" disabled>${escapeHtml(answer.decision)}</button>
  </div>${commentHtml}`;
}

/** Renders the read-only post-submission answered section for a question. */
export function renderAnswered(question: Question, answer: AnswerValue): string {
  const idAttr = escapeAttr(question.id);
  const qTextEsc = escapeHtml(question.question);
  let valueHtml: string;

  switch (answer.type) {
    case "pick_one": {
      if (question.type !== "pick_one") {
        valueHtml = "";
        break;
      }
      valueHtml = renderAnsweredPickOne(question, answer);
      break;
    }
    case "pick_many": {
      if (question.type !== "pick_many") {
        valueHtml = "";
        break;
      }
      valueHtml = renderAnsweredPickMany(question, answer);
      break;
    }
    case "confirm": {
      if (question.type !== "confirm") {
        valueHtml = "";
        break;
      }
      valueHtml = renderAnsweredConfirm(question, answer);
      break;
    }
    case "ask_text":
      valueHtml = renderAnsweredAskText(
        question as Extract<Question, { type: "ask_text" }>,
        answer,
      );
      break;
    case "slider":
      valueHtml = renderAnsweredSlider(answer);
      break;
    case "react":
      valueHtml = renderAnsweredReact(answer);
      break;
  }

  return `<section class="cs-answered" data-question-id="${idAttr}">
  <p class="eyebrow">YOU ANSWERED</p>
  <h3 class="h-section">${qTextEsc}</h3>
${valueHtml}
</section>`;
}
