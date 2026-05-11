// Inline client JS bundle for interactive artifacts.
// This script is embedded in artifacts with interactive.status === "open".
// It POSTs answers to /api/sessions/:id/answers/:qid and handles UI state.
//
// Server response shape (Phase C will implement):
// { ok: boolean, status: "open" | "complete" | "expired" | "cancelled", remaining: string[], replacementHtml: string }

/** Returns the standalone JS string to embed in interactive artifacts. */
export function getClientJs(): string {
  return `(function cesiumClient() {
  "use strict";

  // ─── API base URL derived from window.location.pathname ────────────────────
  // Artifacts are served at /projects/<projectSlug>/artifacts/<filename>.html
  // If not served via cesium HTTP server (e.g. file://), apiBase will be null.
  var m = window.location.pathname.match(/^\\/projects\\/([^\\/]+)\\/artifacts\\/([^\\/]+)$/);
  var apiBase = m ? "/api/sessions/" + m[1] + "/" + m[2] : null;

  // ─── File:// / offline banner ───────────────────────────────────────────────
  if (!apiBase) {
    document.addEventListener("DOMContentLoaded", function () {
      if (document.querySelector(".cs-banner-offline")) return;
      var banner = document.createElement("div");
      banner.className = "cs-banner cs-banner-offline";
      banner.textContent =
        "Interactive controls require viewing this artifact via the cesium HTTP server. " +
        "Run cesium open or visit localhost:3030";
      document.body.insertBefore(banner, document.body.firstChild);
    });
  }

  // ─── Session-ended banner ───────────────────────────────────────────────────
  function showSessionEndedBanner() {
    if (document.querySelector(".cs-banner-ended")) return;
    var banner = document.createElement("div");
    banner.className = "cs-banner cs-banner-ended";
    banner.textContent = "Session ended — answers can no longer be submitted.";
    document.body.insertBefore(banner, document.body.firstChild);
    // Disable all interactive controls
    var disabled = document.querySelectorAll(
      ".cs-submit, .cs-pick, .cs-confirm, .cs-react"
    );
    for (var i = 0; i < disabled.length; i++) {
      var el = disabled[i];
      if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) {
        el.disabled = true;
      }
    }
  }

  // ─── POST answer ────────────────────────────────────────────────────────────
  function postAnswer(qid, value) {
    if (!apiBase) {
      return Promise.reject(new Error("not served via cesium HTTP server"));
    }
    return fetch(apiBase + "/answers/" + qid, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: value }),
    }).then(function (r) {
      if (r.status === 410) {
        showSessionEndedBanner();
        throw new Error("session ended");
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  // ─── Section replacement ────────────────────────────────────────────────────
  function replaceSection(qid, replacementHtml) {
    var section = document.querySelector(
      "section[data-question-id=\\"" + qid + "\\"]"
    );
    if (!section) return;
    var tmp = document.createElement("div");
    tmp.innerHTML = replacementHtml;
    var newSection = tmp.firstElementChild;
    if (newSection && section.parentNode) {
      section.parentNode.replaceChild(newSection, section);
    }
  }

  // ─── Pending / error state ──────────────────────────────────────────────────
  function setPending(section, pending) {
    if (pending) {
      section.dataset["pending"] = "true";
      section.classList.add("cs-saving");
      var btns = section.querySelectorAll("button, input");
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (b instanceof HTMLButtonElement || b instanceof HTMLInputElement) {
          b.disabled = true;
        }
      }
    } else {
      delete section.dataset["pending"];
      section.classList.remove("cs-saving");
      var btns2 = section.querySelectorAll("button, input");
      for (var i2 = 0; i2 < btns2.length; i2++) {
        var b2 = btns2[i2];
        if (b2 instanceof HTMLButtonElement || b2 instanceof HTMLInputElement) {
          b2.disabled = false;
        }
      }
    }
  }

  function showError(section, message) {
    var existing = section.querySelector(".cs-error");
    if (existing) existing.remove();
    var errEl = document.createElement("p");
    errEl.className = "cs-error";
    errEl.setAttribute("role", "alert");
    errEl.textContent = "Failed to save: " + message;
    section.appendChild(errEl);
  }

  function clearError(section) {
    var existing = section.querySelector(".cs-error");
    if (existing) existing.remove();
  }

  // ─── Submit helper ──────────────────────────────────────────────────────────
  function submitAnswer(section, qid, value) {
    clearError(section);
    setPending(section, true);
    postAnswer(qid, value)
      .then(function (resp) {
        if (resp && resp.replacementHtml) {
          replaceSection(qid, resp.replacementHtml);
        } else {
          setPending(section, false);
        }
      })
      .catch(function (err) {
        setPending(section, false);
        showError(section, err instanceof Error ? err.message : String(err));
      });
  }

  // ─── pick_one wiring ─────────────────────────────────────────────────────────
  function wirePickOne(section) {
    var qid = section.dataset["questionId"] || "";
    var btns = section.querySelectorAll("button.cs-pick");
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          var dataValue = btn.dataset["value"] || "";
          submitAnswer(section, qid, { type: "pick_one", selected: dataValue });
        });
      })(btns[i]);
    }
  }

  // ─── pick_many wiring ────────────────────────────────────────────────────────
  function wirePickMany(section) {
    var qid = section.dataset["questionId"] || "";
    var submitBtn = section.querySelector("button.cs-submit");
    var minAttr = section.dataset["min"];
    var maxAttr = section.dataset["max"];
    var min = minAttr ? parseInt(minAttr, 10) : 1;
    var max = maxAttr ? parseInt(maxAttr, 10) : Infinity;

    function updateSubmitState() {
      var checked = section.querySelectorAll("input[type=checkbox]:checked");
      var count = checked.length;
      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = count < min || count > max;
      }
    }

    var checkboxes = section.querySelectorAll("input[type=checkbox]");
    for (var i = 0; i < checkboxes.length; i++) {
      checkboxes[i].addEventListener("change", updateSubmitState);
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", function () {
        var checked = section.querySelectorAll("input[type=checkbox]:checked");
        var selected = [];
        for (var i2 = 0; i2 < checked.length; i2++) {
          var cb = checked[i2];
          if (cb instanceof HTMLInputElement) {
            selected.push(cb.dataset["value"] || "");
          }
        }
        submitAnswer(section, qid, { type: "pick_many", selected: selected });
      });
    }
  }

  // ─── confirm wiring ──────────────────────────────────────────────────────────
  function wireConfirm(section) {
    var qid = section.dataset["questionId"] || "";
    var btns = section.querySelectorAll("button.cs-confirm");
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          var choice = btn.dataset["value"] || "";
          submitAnswer(section, qid, { type: "confirm", choice: choice });
        });
      })(btns[i]);
    }
  }

  // ─── ask_text wiring ─────────────────────────────────────────────────────────
  function wireAskText(section) {
    var qid = section.dataset["questionId"] || "";
    var input = section.querySelector("input.cs-text, textarea.cs-text");
    var submitBtn = section.querySelector("button.cs-submit");

    function updateSubmitState() {
      if (submitBtn instanceof HTMLButtonElement && input) {
        var val = input instanceof HTMLInputElement
          ? input.value
          : input instanceof HTMLTextAreaElement
          ? input.value
          : "";
        submitBtn.disabled = val.trim() === "";
      }
    }

    if (input) {
      input.addEventListener("input", updateSubmitState);
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", function () {
        var text = "";
        if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
          text = input.value;
        }
        submitAnswer(section, qid, { type: "ask_text", text: text });
      });
    }
  }

  // ─── slider wiring ───────────────────────────────────────────────────────────
  function wireSlider(section) {
    var qid = section.dataset["questionId"] || "";
    var sliderInput = section.querySelector("input.cs-slider");
    var outputEl = section.querySelector("output.cs-slider-out");
    var submitBtn = section.querySelector("button.cs-submit");

    if (sliderInput) {
      sliderInput.addEventListener("input", function () {
        if (outputEl && sliderInput instanceof HTMLInputElement) {
          outputEl.textContent = sliderInput.value;
        }
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", function () {
        var value = sliderInput instanceof HTMLInputElement
          ? Number(sliderInput.value)
          : 0;
        submitAnswer(section, qid, { type: "slider", value: value });
      });
    }
  }

  // ─── react wiring ────────────────────────────────────────────────────────────
  function wireReact(section) {
    var qid = section.dataset["questionId"] || "";
    var btns = section.querySelectorAll("button.cs-react");
    var commentArea = section.querySelector("textarea.cs-react-comment");

    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          var decision = btn.dataset["value"] || "";
          var comment = commentArea instanceof HTMLTextAreaElement && commentArea.value !== ""
            ? commentArea.value
            : undefined;
          var value = comment !== undefined
            ? { type: "react", decision: decision, comment: comment }
            : { type: "react", decision: decision };
          submitAnswer(section, qid, value);
        });
      })(btns[i]);
    }
  }

  // ─── Wire all sections on DOMContentLoaded ───────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    var sections = document.querySelectorAll("section[data-question-id]");
    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      if (!(section instanceof HTMLElement)) continue;
      var cls = section.className || "";
      if (cls.indexOf("cs-control-pick_one") !== -1) {
        wirePickOne(section);
      } else if (cls.indexOf("cs-control-pick_many") !== -1) {
        wirePickMany(section);
      } else if (cls.indexOf("cs-control-confirm") !== -1) {
        wireConfirm(section);
      } else if (cls.indexOf("cs-control-ask_text") !== -1) {
        wireAskText(section);
      } else if (cls.indexOf("cs-control-slider") !== -1) {
        wireSlider(section);
      } else if (cls.indexOf("cs-control-react") !== -1) {
        wireReact(section);
      }
    }
  });
})();`;
}
