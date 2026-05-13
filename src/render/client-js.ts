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

  // ─── Read cesium-meta ────────────────────────────────────────────────────────
  function readMeta() {
    var el = document.getElementById("cesium-meta");
    if (!el) return null;
    try { return JSON.parse(el.textContent || ""); } catch (e) { return null; }
  }
  var meta = readMeta();
  var interactive = meta && meta.interactive;
  var kind = interactive && interactive.kind;

  // ─── File:// / offline banner ───────────────────────────────────────────────
  if (!apiBase) {
    document.addEventListener("DOMContentLoaded", function () {
      if (document.querySelector(".cs-banner-offline")) return;
      var banner = document.createElement("div");
      banner.className = "cs-banner cs-banner-offline";
      banner.textContent =
        "Review controls require viewing this artifact via the cesium HTTP server. " +
        "Run cesium open or visit localhost:3030";
      document.body.insertBefore(banner, document.body.firstChild);
    });
  }

  // ─── Session-ended banner ───────────────────────────────────────────────────
  function showSessionEndedBanner(msg) {
    if (document.querySelector(".cs-banner-ended")) return;
    var banner = document.createElement("div");
    banner.className = "cs-banner cs-banner-ended";
    banner.textContent = msg || "Session ended — answers can no longer be submitted.";
    document.body.insertBefore(banner, document.body.firstChild);
    // Disable all interactive controls
    var disabled = document.querySelectorAll(
      ".cs-submit, .cs-skip, .cs-pick, .cs-confirm, .cs-react"
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
    var skipBtn = section.querySelector("button.cs-skip");

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

    if (skipBtn) {
      skipBtn.addEventListener("click", function () {
        submitAnswer(section, qid, { type: "ask_text", text: "" });
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

  // ─── wireAsk ─────────────────────────────────────────────────────────────────
  function wireAsk() {
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
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── wireAnnotate ────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  function wireAnnotate(interactiveData) {
    // ─── Helpers ────────────────────────────────────────────────────────────
    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function humanizeAnchor(anchor) {
      var parts = String(anchor).split(".");
      var blockPart = parts[0] || "";
      var blockNum = blockPart.replace("block-", "");
      if (parts.length === 1) {
        return "Block " + blockNum;
      }
      var linePart = parts[1] || "";
      var lineNum = linePart.replace("line-", "");
      return "Block " + blockNum + " \u00b7 line " + lineNum;
    }

    function apiPost(path, body) {
      return fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(function (r) {
        if (r.status === 410) {
          showSessionEndedBanner("Review closed.");
          return r.json().then(function (data) {
            throw new Error(data && data.status ? "session ended: " + data.status : "session ended");
          });
        }
        return r.json().then(function (data) {
          if (!r.ok) {
            var msg = (data && (data.message || data.reason || data.error)) || ("HTTP " + r.status);
            throw new Error(msg);
          }
          return data;
        });
      });
    }

    function apiDelete(path) {
      return fetch(path, { method: "DELETE" }).then(function (r) {
        if (r.status === 410) {
          showSessionEndedBanner("Review closed.");
          return r.json().then(function (data) {
            throw new Error(data && data.status ? "session ended: " + data.status : "session ended");
          });
        }
        return r.json().then(function (data) {
          if (!r.ok) {
            var msg = (data && (data.message || data.reason || data.error)) || ("HTTP " + r.status);
            throw new Error(msg);
          }
          return data;
        });
      });
    }

    // ─── State ──────────────────────────────────────────────────────────────
    var state = {
      comments: (interactiveData && Array.isArray(interactiveData.comments))
        ? interactiveData.comments.slice()
        : [],
      verdictMode: (interactiveData && interactiveData.verdictMode) || "approve",
      status: (interactiveData && interactiveData.status) || "open",
    };

    // Active popup reference (only one at a time)
    var activePopup = null;

    // ─── Count display ───────────────────────────────────────────────────────
    function updateCount() {
      var countEl = document.querySelector("[data-cesium-comment-count]");
      if (!countEl) return;
      var n = state.comments.length;
      countEl.textContent = n === 1 ? "1 comment" : n + " comments";
    }

    // ─── Verdict button enablement ───────────────────────────────────────────
    function updateVerdictButtons() {
      var hasComments = state.comments.length > 0;
      var btns = document.querySelectorAll("button.cs-verdict[data-verdict]");
      for (var i = 0; i < btns.length; i++) {
        var btn = btns[i];
        if (!(btn instanceof HTMLButtonElement)) continue;
        var v = btn.getAttribute("data-verdict");
        // approve — always enabled; request_changes + comment — need comments
        if (v === "approve") {
          btn.disabled = false;
        } else {
          btn.disabled = !hasComments;
        }
      }
    }

    // ─── Banner error (toplevel) ─────────────────────────────────────────────
    function showBannerError(message) {
      var existing = document.querySelector(".cs-banner-error");
      if (existing) existing.remove();
      var banner = document.createElement("div");
      banner.className = "cs-banner cs-banner-error cs-error";
      banner.setAttribute("role", "alert");
      banner.textContent = message;
      banner.style.cssText =
        "position:fixed;top:0;left:0;right:0;padding:0.75rem 1.25rem;" +
        "text-align:center;z-index:200;";
      document.body.insertBefore(banner, document.body.firstChild);
      setTimeout(function () { if (banner.parentNode) banner.remove(); }, 6000);
    }

    // ─── Comment rail ────────────────────────────────────────────────────────
    function getRail() {
      return document.querySelector("[data-cesium-comment-rail]");
    }

    function buildBubble(comment) {
      var article = document.createElement("article");
      article.className = "cs-comment-bubble";
      article.setAttribute("data-comment-id", comment.id);
      article.setAttribute("data-anchor", comment.anchor);

      var head = document.createElement("header");
      head.className = "cs-comment-bubble-head";

      var label = document.createElement("span");
      label.className = "cs-comment-anchor-label";
      label.textContent = humanizeAnchor(comment.anchor);

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "cs-comment-delete";
      delBtn.setAttribute("aria-label", "Delete comment");
      delBtn.textContent = "\u00d7";

      head.appendChild(label);
      head.appendChild(delBtn);

      var textEl = document.createElement("p");
      textEl.className = "cs-comment-text";
      textEl.textContent = comment.comment;

      article.appendChild(head);
      article.appendChild(textEl);

      if (comment.selectedText && comment.selectedText.trim() !== "") {
        var quoteEl = document.createElement("blockquote");
        quoteEl.className = "cs-comment-bubble-quote";
        quoteEl.textContent = comment.selectedText;
        article.appendChild(quoteEl);
      }

      // ─── Delete handler ────────────────────────────────────────────────────
      delBtn.addEventListener("click", function () {
        if (!apiBase) return;
        // Optimistic: mark pending
        article.classList.add("cs-saving");
        delBtn.disabled = true;
        apiDelete(apiBase + "/comments/" + comment.id)
          .then(function () {
            // Remove from state
            state.comments = state.comments.filter(function (c) {
              return c.id !== comment.id;
            });
            article.remove();
            updateCount();
            updateVerdictButtons();
            positionBubbles();
          })
          .catch(function (err) {
            // Restore
            article.classList.remove("cs-saving");
            delBtn.disabled = false;
            showBannerError("Could not delete comment: " + (err instanceof Error ? err.message : String(err)));
          });
      });

      return article;
    }

    function mountBubble(comment) {
      var rail = getRail();
      if (!rail) return;
      var bubble = buildBubble(comment);
      rail.appendChild(bubble);
      positionBubbles();
    }

    function mountAllSeededComments() {
      for (var i = 0; i < state.comments.length; i++) {
        mountBubble(state.comments[i]);
      }
    }

    // ─── Position bubbles aligned to anchors (marginalia style) ─────────────
    function positionBubbles() {
      var rail = getRail();
      if (!rail) return;
      var railParent = rail.offsetParent || document.body;
      var railParentTop = railParent instanceof HTMLElement
        ? railParent.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0)
        : 0;
      var bubbles = rail.querySelectorAll("[data-anchor]");
      for (var i = 0; i < bubbles.length; i++) {
        var bubble = bubbles[i];
        if (!(bubble instanceof HTMLElement)) continue;
        var anchorKey = bubble.getAttribute("data-anchor") || "";
        var anchorEl = document.querySelector("[data-cesium-anchor=\\"" + anchorKey + "\\"]");
        if (anchorEl instanceof HTMLElement) {
          var anchorTop = anchorEl.getBoundingClientRect().top
            + (window.scrollY || window.pageYOffset || 0)
            - railParentTop;
          bubble.style.top = anchorTop + "px";
          bubble.classList.remove("cs-comment-bubble-orphan");
        } else {
          bubble.style.top = "0px";
          bubble.classList.add("cs-comment-bubble-orphan");
        }
      }
    }

    // ─── Mutual hover linking ────────────────────────────────────────────────
    function wireHoverLinking() {
      var rail = getRail();
      if (!rail) return;

      // Bubble → anchor
      rail.addEventListener("mouseover", function (e) {
        var bubble = e.target instanceof Element
          ? e.target.closest("[data-anchor]")
          : null;
        if (!(bubble instanceof HTMLElement)) return;
        var anchorKey = bubble.getAttribute("data-anchor") || "";
        var anchorEl = document.querySelector("[data-cesium-anchor=\\"" + anchorKey + "\\"]");
        bubble.classList.add("cs-comment-bubble-active");
        if (anchorEl instanceof HTMLElement) {
          anchorEl.classList.add("cs-anchor-active");
        }
      });
      rail.addEventListener("mouseout", function (e) {
        var bubble = e.target instanceof Element
          ? e.target.closest("[data-anchor]")
          : null;
        if (!(bubble instanceof HTMLElement)) return;
        var anchorKey = bubble.getAttribute("data-anchor") || "";
        var anchorEl = document.querySelector("[data-cesium-anchor=\\"" + anchorKey + "\\"]");
        bubble.classList.remove("cs-comment-bubble-active");
        if (anchorEl instanceof HTMLElement) {
          anchorEl.classList.remove("cs-anchor-active");
        }
      });

      // Anchor → bubble
      var anchors = document.querySelectorAll("[data-cesium-anchor]");
      for (var i = 0; i < anchors.length; i++) {
        (function (anchorEl) {
          var anchorKey = anchorEl.getAttribute("data-cesium-anchor") || "";
          anchorEl.addEventListener("mouseenter", function () {
            var bubble = rail.querySelector("[data-anchor=\\"" + anchorKey + "\\"]");
            if (bubble instanceof HTMLElement) {
              bubble.classList.add("cs-comment-bubble-active");
            }
            anchorEl.classList.add("cs-anchor-active");
          });
          anchorEl.addEventListener("mouseleave", function () {
            var bubble = rail.querySelector("[data-anchor=\\"" + anchorKey + "\\"]");
            if (bubble instanceof HTMLElement) {
              bubble.classList.remove("cs-comment-bubble-active");
            }
            anchorEl.classList.remove("cs-anchor-active");
          });
        })(anchors[i]);
      }
    }

    // ─── Resize debounce ─────────────────────────────────────────────────────
    var resizeTimer = null;
    function onResize() {
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resizeTimer = null;
        positionBubbles();
      }, 150);
    }

    // ─── Popup ──────────────────────────────────────────────────────────────
    function closePopup() {
      if (activePopup && activePopup.parentNode) {
        activePopup.remove();
      }
      activePopup = null;
    }

    function openPopup(anchorEl, anchorStr) {
      closePopup();

      var tmpl = document.getElementById("cs-annotate-comment-popup");
      if (!(tmpl instanceof HTMLTemplateElement)) return;
      var clone = tmpl.content.cloneNode(true);
      var popup = clone instanceof DocumentFragment
        ? clone.firstElementChild
        : null;
      if (!popup) return;
      if (!(popup instanceof HTMLElement)) return;

      popup.setAttribute("data-popup-anchor", anchorStr);
      popup.style.position = "absolute";
      popup.style.zIndex = "200";

      // Capture selection
      var sel = window.getSelection ? window.getSelection() : null;
      var selText = "";
      if (sel && sel.rangeCount > 0 && sel.toString().trim() !== "") {
        var range = sel.getRangeAt(0);
        // Check containment: range must intersect anchor element
        if (anchorEl.contains(range.commonAncestorContainer)
            || range.commonAncestorContainer === anchorEl) {
          selText = sel.toString().slice(0, 4096);
        }
      }
      if (!selText) {
        selText = (anchorEl.textContent || "").trim().slice(0, 300);
      }
      popup.setAttribute("data-selected-text", selText);

      // Prepend quote block above textarea if we have text
      if (selText) {
        var quote = document.createElement("blockquote");
        quote.className = "cs-comment-popup-quote";
        quote.textContent = selText.slice(0, 200) + (selText.length > 200 ? "\u2026" : "");
        popup.insertBefore(quote, popup.firstChild);
      }

      document.body.appendChild(popup);
      activePopup = popup;

      // Position the popup
      var rect = anchorEl.getBoundingClientRect();
      var scrollX = window.scrollX || window.pageXOffset || 0;
      var scrollY = window.scrollY || window.pageYOffset || 0;
      var viewportW = window.innerWidth || document.documentElement.clientWidth;
      var popupW = 360;

      var top = rect.bottom + scrollY + 4;
      var left = rect.left + scrollX;
      // Wide viewport: try to place to the right
      if (viewportW > 900 && rect.right + popupW + 16 < viewportW) {
        left = rect.right + scrollX + 12;
        top = rect.top + scrollY;
      }
      // Clamp to viewport
      if (left + popupW > scrollX + viewportW - 16) {
        left = scrollX + viewportW - popupW - 16;
      }
      if (left < scrollX + 8) left = scrollX + 8;

      popup.style.top = top + "px";
      popup.style.left = left + "px";

      // Wire save / cancel
      var textarea = popup.querySelector("textarea.cs-comment-input");
      var saveBtn = popup.querySelector("button.cs-comment-save");
      var cancelBtn = popup.querySelector("button.cs-comment-cancel");

      // Save starts disabled — enable when text is non-empty
      if (saveBtn instanceof HTMLButtonElement) {
        saveBtn.disabled = true;
      }

      if (textarea instanceof HTMLTextAreaElement && saveBtn instanceof HTMLButtonElement) {
        textarea.addEventListener("input", function () {
          saveBtn.disabled = textarea.value.trim() === "";
        });
        // Cmd/Ctrl+Enter to submit
        textarea.addEventListener("keydown", function (e) {
          if ((e.metaKey || e.ctrlKey) && (e.key === "Enter" || e.keyCode === 13)) {
            if (!saveBtn.disabled) saveBtn.click();
          }
        });
        // Auto-focus
        textarea.focus();
      }

      if (saveBtn instanceof HTMLButtonElement) {
        saveBtn.addEventListener("click", function () {
          if (!(textarea instanceof HTMLTextAreaElement)) return;
          var commentText = textarea.value;
          if (!commentText.trim()) return;
          if (!apiBase) { closePopup(); return; }

          // Disable buttons during save
          saveBtn.disabled = true;
          if (cancelBtn instanceof HTMLButtonElement) cancelBtn.disabled = true;
          popup.classList.add("cs-saving");

          // Remove any prior error
          var priorErr = popup.querySelector(".cs-error");
          if (priorErr) priorErr.remove();

          apiPost(apiBase + "/comments", {
            anchor: anchorStr,
            selectedText: selText,
            comment: commentText,
          })
            .then(function (resp) {
              var newComment = resp && resp.comment;
              if (newComment) {
                state.comments.push(newComment);
                mountBubble(newComment);
                updateCount();
                updateVerdictButtons();
              }
              closePopup();
            })
            .catch(function (err) {
              popup.classList.remove("cs-saving");
              saveBtn.disabled = textarea.value.trim() === "";
              if (cancelBtn instanceof HTMLButtonElement) cancelBtn.disabled = false;
              var errEl = document.createElement("p");
              errEl.className = "cs-error";
              errEl.setAttribute("role", "alert");
              errEl.textContent = err instanceof Error ? err.message : String(err);
              popup.appendChild(errEl);
            });
        });
      }

      if (cancelBtn instanceof HTMLButtonElement) {
        cancelBtn.addEventListener("click", closePopup);
      }

      // Escape closes the popup
      function onKeydown(e) {
        if (e.key === "Escape" || e.keyCode === 27) {
          closePopup();
          document.removeEventListener("keydown", onKeydown);
        }
      }
      document.addEventListener("keydown", onKeydown);

      // Click outside closes
      setTimeout(function () {
        function onOutside(e) {
          if (activePopup && !activePopup.contains(e.target)) {
            closePopup();
            document.removeEventListener("click", onOutside);
          }
        }
        document.addEventListener("click", onOutside);
      }, 0);
    }

    // ─── Inject affordances ──────────────────────────────────────────────────
    function injectAffordances() {
      var anchors = document.querySelectorAll("[data-cesium-anchor]");
      for (var i = 0; i < anchors.length; i++) {
        var anchorEl = anchors[i];
        if (!(anchorEl instanceof HTMLElement)) continue;
        var anchorStr = anchorEl.getAttribute("data-cesium-anchor") || "";

        // Determine line vs block affordance
        var isLine = /^block-\\d+\\.line-\\d+$/.test(anchorStr);

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = isLine
          ? "cs-anchor-affordance cs-anchor-affordance-line"
          : "cs-anchor-affordance cs-anchor-affordance-block";
        btn.setAttribute("aria-label", "Add comment");
        btn.setAttribute("data-anchor", anchorStr);
        btn.textContent = isLine ? "+" : "\u270f\ufe0f";

        // Wire click: open popup for this anchor
        (function (el, aStr, affordBtn) {
          affordBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            openPopup(el, aStr);
          });
        })(anchorEl, anchorStr, btn);

        anchorEl.insertBefore(btn, anchorEl.firstChild);
      }
    }

    // ─── Verdict button wiring ───────────────────────────────────────────────
    function wireVerdictButtons() {
      var btns = document.querySelectorAll("button.cs-verdict[data-verdict]");
      for (var i = 0; i < btns.length; i++) {
        (function (btn) {
          btn.addEventListener("click", function () {
            if (!(btn instanceof HTMLButtonElement)) return;
            if (!apiBase) return;
            var verdictValue = btn.getAttribute("data-verdict");
            if (!verdictValue) return;

            // Two-step confirmation: show confirm/cancel pair inline
            if (btn.getAttribute("data-confirming") === "true") return;
            btn.setAttribute("data-confirming", "true");

            var originalText = btn.textContent;
            btn.textContent = "Confirm " + originalText + "?";
            btn.setAttribute("aria-label", "Confirm " + originalText);

            var cancelConfirmBtn = document.createElement("button");
            cancelConfirmBtn.type = "button";
            cancelConfirmBtn.className = "cs-verdict-btn cs-comment-cancel";
            cancelConfirmBtn.style.cssText = "margin-left:8px;";
            cancelConfirmBtn.textContent = "Cancel";

            btn.parentNode && btn.parentNode.insertBefore(cancelConfirmBtn, btn.nextSibling);

            var cancelConfirmTimeout = setTimeout(function () {
              btn.removeAttribute("data-confirming");
              btn.textContent = originalText;
              btn.removeAttribute("aria-label");
              if (cancelConfirmBtn.parentNode) cancelConfirmBtn.remove();
            }, 6000);

            cancelConfirmBtn.addEventListener("click", function () {
              clearTimeout(cancelConfirmTimeout);
              btn.removeAttribute("data-confirming");
              btn.textContent = originalText;
              btn.removeAttribute("aria-label");
              cancelConfirmBtn.remove();
            });

            btn.addEventListener("click", function onConfirm() {
              clearTimeout(cancelConfirmTimeout);
              cancelConfirmBtn.remove();

              // Disable all verdict buttons
              var allVerdictBtns = document.querySelectorAll("button.cs-verdict");
              for (var j = 0; j < allVerdictBtns.length; j++) {
                var vb = allVerdictBtns[j];
                if (vb instanceof HTMLButtonElement) vb.disabled = true;
              }
              btn.textContent = "Submitting\u2026";
              btn.removeEventListener("click", onConfirm);

              apiPost(apiBase + "/verdict", { verdict: verdictValue })
                .then(function () {
                  window.location.reload();
                })
                .catch(function (err) {
                  // Re-enable buttons on error
                  for (var j2 = 0; j2 < allVerdictBtns.length; j2++) {
                    var vb2 = allVerdictBtns[j2];
                    if (vb2 instanceof HTMLButtonElement) vb2.disabled = false;
                  }
                  btn.removeAttribute("data-confirming");
                  btn.textContent = originalText;
                  updateVerdictButtons();
                  showBannerError("Could not submit verdict: " + (err instanceof Error ? err.message : String(err)));
                });
            }, { once: true });
          });
        })(btns[i]);
      }
    }

    // ─── Freeze UI (non-open status) ─────────────────────────────────────────
    function freezeUi() {
      // Hide affordances, disable verdict buttons
      var affordances = document.querySelectorAll(".cs-anchor-affordance");
      for (var i = 0; i < affordances.length; i++) {
        var a = affordances[i];
        if (a instanceof HTMLElement) a.style.display = "none";
      }
      var vBtns = document.querySelectorAll("button.cs-verdict");
      for (var j = 0; j < vBtns.length; j++) {
        var vb = vBtns[j];
        if (vb instanceof HTMLButtonElement) vb.disabled = true;
      }
    }

    // ─── DOMContentLoaded: main init ─────────────────────────────────────────
    document.addEventListener("DOMContentLoaded", function () {
      // Add body class for padding-bottom (fallback for browsers without :has)
      document.body.classList.add("cs-annotate-active");

      if (state.status !== "open") {
        showSessionEndedBanner("Review closed.");
        mountAllSeededComments();
        updateCount();
        requestAnimationFrame(positionBubbles);
        window.addEventListener("resize", onResize);
        return;
      }

      if (!apiBase) {
        // Offline: render seeded comments but hide affordances, disable verdict btns
        mountAllSeededComments();
        updateCount();
        freezeUi();
        requestAnimationFrame(positionBubbles);
        window.addEventListener("resize", onResize);
        wireHoverLinking();
        return;
      }

      // Normal wiring
      injectAffordances();
      mountAllSeededComments();
      updateCount();
      updateVerdictButtons();
      wireVerdictButtons();
      requestAnimationFrame(positionBubbles);
      window.addEventListener("resize", onResize);
      wireHoverLinking();
    });
  }

  // ─── Dispatch on kind ────────────────────────────────────────────────────────
  if (kind === "annotate") {
    wireAnnotate(interactive);
  } else {
    // ask (or legacy without kind) — existing wiring
    document.addEventListener("DOMContentLoaded", wireAsk);
  }

})();`;
}
