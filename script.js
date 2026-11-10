
(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  const STORAGE_KEY = "zenote-studio-v1";

  const COLORS = [
    "#f4b75e",
    "#6d5dfc",
    "#35b995",
    "#e783a5",
    "#5b9de8",
    "#d58b54"
  ];

  const now = () => new Date().toISOString();

  const uid = () =>
    crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const escapeHTML = (value = "") =>
    String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character]));

  const initialState = {
    notes: [
      {
        id: uid(),
        title: "Welcome to Zenote",
        content:
`Your ideas deserve a beautiful space.

✦ Create notes for anything on your mind.
✦ Add tags to connect related thoughts.
✦ Pin important notes and keep your workspace tidy.
✦ Export your notes whenever you need a backup.

This is your space. Make it yours.`,
        folder: "Personal",
        tags: ["Getting started", "Ideas"],
        pinned: true,
        favorite: true,
        archived: false,
        trashed: false,
        createdAt: now(),
        updatedAt: now()
      }
    ],

    folders: ["Personal", "Work", "Ideas", "Learning"],
    theme: "light",
    view: "all",
    activeId: null,
    filter: "recent",
    layout: "grid"
  };

  let state = loadState();
  let activeNote = null;
  let saveTimer = null;
  let toastTimer = null;

  /* STORAGE */

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

      if (saved && Array.isArray(saved.notes)) {
        return { ...initialState, ...saved };
      }
    } catch (error) {
      console.error("Could not load saved notes:", error);
    }

    return structuredClone(initialState);
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      $("#saveStatus").textContent = "All changes saved";
    } catch (error) {
      console.error("Saving failed:", error);
      $("#saveStatus").textContent = "Unable to save";
      toast("Storage limit reached or saving failed");
    }
  }

  function scheduleSave() {
    $("#saveStatus").textContent = "Saving…";

    clearTimeout(saveTimer);

    saveTimer = setTimeout(persist, 350);
  }

  /* NOTIFICATIONS */

  function toast(message) {
    const element = $("#toast");

    element.textContent = message;
    element.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      element.classList.remove("show");
    }, 2200);
  }

  /* DATE HELPERS */

  function formatDate(date) {
    const value = new Date(date);

    return value.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year:
        value.getFullYear() !== new Date().getFullYear()
          ? "numeric"
          : undefined
    });
  }

  function shortText(text, max = 115) {
    const clean = (text || "").replace(/\s+/g, " ").trim();

    return clean.length > max
      ? clean.slice(0, max).trim() + "…"
      : clean || "No additional text";
  }

  function currentFolder() {
    return state.view.startsWith("folder:")
      ? state.view.slice(7)
      : null;
  }

  function viewName() {
    if (state.view.startsWith("folder:")) {
      return currentFolder();
    }

    return {
      all: "All notes",
      pinned: "Pinned",
      favorites: "Favorites",
      archive: "Archive",
      trash: "Trash"
    }[state.view] || "All notes";
  }

  /* FILTER NOTES */

  function visibleNotes() {
    const query = $("#searchInput").value.trim().toLowerCase();

    let notes = state.notes.filter(note => {

      if (state.view === "trash") {
        return note.trashed;
      }

      if (note.trashed) return false;

      if (state.view === "archive") {
        return note.archived;
      }

      if (note.archived) return false;

      if (state.view === "pinned") {
        return note.pinned;
      }

      if (state.view === "favorites") {
        return note.favorite;
      }

      if (currentFolder()) {
        return note.folder === currentFolder();
      }

      return true;
    });

    if (query) {
      notes = notes.filter(note => {
        const searchable = [
          note.title,
          note.content,
          note.folder,
          ...note.tags
        ].join(" ").toLowerCase();

        return searchable.includes(query);
      });
    }

    if (state.filter === "az") {
      notes.sort((a, b) =>
        (a.title || "").localeCompare(b.title || "")
      );
    } else if (state.filter === "created") {
      notes.sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );
    } else {
      notes.sort((a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        new Date(b.updatedAt) - new Date(a.updatedAt)
      );
    }

    return notes;
  }

  /* RENDER APPLICATION */

  function render() {

    document.documentElement.dataset.theme = state.theme;

    $("#viewHeading").textContent = viewName();

    $("#pageTitle").innerHTML =
      escapeHTML(viewName()) +
      '<span class="title-period">.</span>';

    $("#pageSubtitle").textContent =
      state.view === "trash"
        ? "Notes you have moved out of your workspace."
        : state.view === "archive"
          ? "A quiet home for notes you want to keep."
          : "Capture ideas. Connect thoughts. Make things happen.";

    $("#allCount").textContent =
      state.notes.filter(note =>
        !note.trashed && !note.archived
      ).length;

    /* Navigation */

    $$(".nav-item[data-view]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.view === state.view
      );
    });

    /* Folders */

    $("#folderList").innerHTML = state.folders.map((folder, index) => `
      <div
        class="folder-item ${currentFolder() === folder ? "active" : ""}"
        data-folder="${escapeHTML(folder)}"
      >
        <i
          class="folder-color"
          style="background:${COLORS[index % COLORS.length]}"
        ></i>

        <span>${escapeHTML(folder)}</span>

        <span>
          ${state.notes.filter(note =>
            note.folder === folder &&
            !note.trashed &&
            !note.archived
          ).length}
        </span>
      </div>
    `).join("");

    /* Notes */

    const notes = visibleNotes();

    $("#resultCount").textContent =
      `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;

    $("#notesGrid").classList.toggle(
      "list-view",
      state.layout === "list"
    );

    $("#gridViewBtn").classList.toggle(
      "active",
      state.layout === "grid"
    );

    $("#listViewBtn").classList.toggle(
      "active",
      state.layout === "list"
    );

    $("#notesGrid").innerHTML = notes.map(note => `
      <article
        class="note-card ${activeNote?.id === note.id ? "selected" : ""}"
        data-id="${escapeHTML(note.id)}"
      >

        <div class="card-top">

          <span class="card-folder">
            ${escapeHTML(note.folder || "PERSONAL").toUpperCase()}
          </span>

          <span class="card-flags">
            ${note.pinned ? "⌑" : ""}
            ${note.favorite ? "★" : ""}
          </span>

        </div>

        <h3>${escapeHTML(note.title || "Untitled note")}</h3>

        <div class="note-preview">
          ${escapeHTML(shortText(note.content, 150))}
        </div>

        <div class="card-bottom">

          <span class="card-date">
            ${formatDate(note.updatedAt)}
          </span>

          <div class="card-tags">
            ${note.tags.slice(0, 2).map(tag => `
              <span class="mini-tag">
                #${escapeHTML(tag)}
              </span>
            `).join("")}
          </div>

        </div>

      </article>
    `).join("");

    const empty = notes.length === 0;

    $("#emptyState").hidden = !empty;
    $("#notesGrid").hidden = empty;

    $("#emptyTitle").textContent =
      state.view === "trash"
        ? "Your trash is empty."
        : $("#searchInput").value
          ? "No matching notes."
          : "A fresh page awaits.";

    $("#emptyText").textContent =
      $("#searchInput").value
        ? "Try another search term."
        : "Create your first note and give your ideas a home.";

    if (
      activeNote &&
      !state.notes.some(note => note.id === activeNote.id)
    ) {
      closeEditor();
    }
  }

  /* EDITOR */

  function openEditor(note) {
    activeNote = note;
    state.activeId = note.id;

    $("#editorPanel").classList.add("open");
    $("#editorPanel").classList.remove("empty-editor");

    $("#noteTitle").value = note.title;
    $("#noteContent").value = note.content;

    $("#editorFolder").textContent =
      (note.folder || "Personal").toUpperCase();

    $("#editorDate").textContent =
      formatDate(note.updatedAt).toUpperCase();

    $("#favoriteBtn").classList.toggle(
      "is-active",
      note.favorite
    );

    $("#favoriteBtn").textContent =
      note.favorite ? "★" : "☆";

    $("#pinBtn").classList.toggle(
      "is-active",
      note.pinned
    );

    $("#archiveBtn").classList.toggle(
      "is-active",
      note.archived
    );

    $("#deleteBtn").title =
      note.trashed ? "Permanently delete" : "Move to trash";

    renderTags();
    updateStats();
    render();
  }

  function closeEditor() {
    activeNote = null;
    state.activeId = null;

    $("#editorPanel").classList.remove("open");
    $("#editorPanel").classList.add("empty-editor");

    $("#noteTitle").value = "";
    $("#noteContent").value = "";

    $("#tagChips").innerHTML = "";

    $("#wordCount").textContent = "0 words";
    $("#charCount").textContent = "0 chars";

    render();
  }

  /* CREATE NOTE */

  function createNote() {
    const note = {
      id: uid(),
      title: "",
      content: "",
      folder: currentFolder() || "Personal",
      tags: [],
      pinned: false,
      favorite: false,
      archived: false,
      trashed: false,
      createdAt: now(),
      updatedAt: now()
    };

    state.notes.unshift(note);
    state.view = note.folder
      ? `folder:${note.folder}`
      : "all";

    persist();
    render();
    openEditor(note);

    $("#noteTitle").focus();

    toast("New note created");
  }

  /* AUTOMATIC NOTE SAVING */

  function updateActive() {
    if (!activeNote) return;

    activeNote.title = $("#noteTitle").value;
    activeNote.content = $("#noteContent").value;
    activeNote.updatedAt = now();

    scheduleSave();
    updateStats();

    render();

    $("#editorDate").textContent =
      formatDate(activeNote.updatedAt).toUpperCase();
  }

  /* WORD AND CHARACTER COUNTER */

  function updateStats() {
    const text = $("#noteContent").value;

    const words = text.trim()
      ? text.trim().split(/\s+/).length
      : 0;

    $("#wordCount").textContent =
      `${words} ${words === 1 ? "word" : "words"}`;

    $("#charCount").textContent =
      `${text.length} chars`;
  }

  /* TAGS */

  function renderTags() {
    if (!activeNote) return;

    $("#tagChips").innerHTML =
      activeNote.tags.map((tag, index) => `
        <span class="tag-chip">
          #${escapeHTML(tag)}

          <button
            data-remove-tag="${index}"
            aria-label="Remove tag"
          >×</button>
        </span>
      `).join("");
  }

  function addTag() {
    const input = $("#tagInput");

    const tag = input.value.trim().replace(/^#/, "");

    if (!tag || !activeNote) return;

    if (!activeNote.tags.some(
      item => item.toLowerCase() === tag.toLowerCase()
    )) {
      activeNote.tags.push(tag);
    }

    input.value = "";
    activeNote.updatedAt = now();

    renderTags();
    scheduleSave();
    render();
  }

  /* FAVORITES AND PINNING */

  function toggleProperty(property) {
    if (!activeNote) return;

    activeNote[property] = !activeNote[property];
    activeNote.updatedAt = now();

    scheduleSave();
    openEditor(activeNote);

    toast(
      `${property === "pinned" ? "Pin" : "Favorite"} ${
        activeNote[property] ? "enabled" : "removed"
      }`
    );
  }

  /* ARCHIVING */

  function toggleArchive() {
    if (!activeNote) return;

    const archived = !activeNote.archived;

    activeNote.archived = archived;
    activeNote.updatedAt = now();

    scheduleSave();
    closeEditor();

    toast(archived ? "Note archived" : "Removed from archive");
  }

  /* TRASH AND RESTORE */

  function deleteOrRestore() {
    if (!activeNote) return;

    if (activeNote.trashed) {
      if (!confirm("Permanently delete this note?")) return;

      state.notes = state.notes.filter(
        note => note.id !== activeNote.id
      );

      persist();
      closeEditor();

      toast("Note permanently deleted");

      return;
    }

    activeNote.trashed = true;
    activeNote.pinned = false;
    activeNote.favorite = false;
    activeNote.updatedAt = now();

    persist();
    closeEditor();

    toast("Moved to trash");
  }

  function restoreNote() {
    if (!activeNote || !activeNote.trashed) return;

    activeNote.trashed = false;
    activeNote.updatedAt = now();

    persist();
    closeEditor();

    toast("Note restored");
  }

  /* TEXT FORMATTING */

  function formatText(type) {
    const area = $("#noteContent");

    const start = area.selectionStart;
    const end = area.selectionEnd;

    const selected = area.value.slice(start, end);

    const prefixes = {
      bold: "**",
      italic: "*",
      heading: "## ",
      bullet: "• ",
      number: "1. ",
      check: "☐ ",
      quote: "> "
    };

    const prefix = prefixes[type];

    let insertion;

    if (type === "bold" || type === "italic") {
      insertion = prefix + (selected || "text") + prefix;
    } else {
      insertion = prefix + (selected || "");
    }

    area.setRangeText(
      insertion,
      start,
      end,
      "select"
    );

    area.focus();

    updateActive();
  }

  /* FOLDER MODAL */

  function showModal() {
    $("#modalTitle").textContent = "Create a folder";
    $("#modalDescription").textContent =
      "Give this collection a name.";

    $("#modalInput").value = "";
    $("#modalConfirm").textContent = "Create folder";

    $("#modalBackdrop").hidden = false;

    $("#modalInput").focus();
  }

  function hideModal() {
    $("#modalBackdrop").hidden = true;
  }

  function confirmModal() {
    const value = $("#modalInput").value.trim();

    if (!value) {
      toast("Enter a folder name");
      return;
    }

    if (state.folders.some(
      folder => folder.toLowerCase() === value.toLowerCase()
    )) {
      toast("That folder already exists");
      return;
    }

    state.folders.push(value);
    state.view = `folder:${value}`;

    persist();
    render();
    hideModal();

    toast("Folder created");
  }

  /* EXPORT NOTES */

  function exportNotes() {
    const payload = {
      app: "Zenote Studio",
      version: 1,
      exportedAt: now(),
      ...state
    };

    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download =
      `zenote-backup-${new Date().toISOString().slice(0, 10)}.json`;

    link.click();

    URL.revokeObjectURL(url);

    toast("Backup exported");
  }

  /* IMPORT NOTES */

  function importNotes(file) {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);

        if (!Array.isArray(data.notes)) {
          throw new Error("Invalid backup");
        }

        const incoming = data.notes.filter(note =>
          note &&
          typeof note === "object" &&
          typeof note.id === "string" &&
          typeof note.title === "string" &&
          typeof note.content === "string"
        );

        const existing = new Set(
          state.notes.map(note => note.id)
        );

        let imported = 0;

        incoming.forEach(note => {
          if (!existing.has(note.id)) {
            state.notes.push({
              ...note,
              tags: Array.isArray(note.tags) ? note.tags : []
            });

            imported++;
          }
        });

        if (Array.isArray(data.folders)) {
          state.folders = [
            ...new Set([...state.folders, ...data.folders])
          ];
        }

        persist();
        render();

        toast(`${imported} notes imported`);

      } catch (error) {
        toast("That file is not a valid Zenote backup");
      }
    };

    reader.readAsText(file);
  }

  /* EVENT LISTENERS */

  function bind() {

    $("#newNoteBtn").onclick = createNote;
    $("#headerNewBtn").onclick = createNote;
    $("#emptyCreateBtn").onclick = createNote;

    $("#closeEditorBtn").onclick = closeEditor;

    $("#noteTitle").addEventListener(
      "input",
      updateActive
    );

    $("#noteContent").addEventListener(
      "input",
      updateActive
    );

    $("#tagInput").addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        addTag();
      }
    });

    $("#tagChips").addEventListener("click", event => {
      const button = event.target.closest("[data-remove-tag]");

      if (!button || !activeNote) return;

      activeNote.tags.splice(
        Number(button.dataset.removeTag),
        1
      );

      renderTags();
      scheduleSave();
      render();
    });

    $("#favoriteBtn").onclick = () =>
      toggleProperty("favorite");

    $("#pinBtn").onclick = () =>
      toggleProperty("pinned");

    $("#archiveBtn").onclick = toggleArchive;

    $("#deleteBtn").onclick = deleteOrRestore;

    /* Formatting */

    $$(".format-toolbar button").forEach(button => {
      button.onclick = () => formatText(button.dataset.format);
    });

    /* Search */

    $("#searchInput").addEventListener("input", render);

    /* Main navigation */

    $$(".nav-item[data-view]").forEach(button => {
      button.onclick = () => {
        state.view = button.dataset.view;

        closeEditor();
        render();

        $("#sidebar").classList.remove("open");
      };
    });

    /* Folder navigation */

    $("#folderList").addEventListener("click", event => {
      const item = event.target.closest("[data-folder]");

      if (!item) return;

      state.view = `folder:${item.dataset.folder}`;

      closeEditor();
      render();

      $("#sidebar").classList.remove("open");
    });

    /* Folder creation */

    $("#addFolderBtn").onclick = showModal;

    $("#modalClose").onclick = hideModal;
    $("#modalCancel").onclick = hideModal;
    $("#modalConfirm").onclick = confirmModal;

    $("#modalInput").addEventListener("keydown", event => {
      if (event.key === "Enter") confirmModal();
      if (event.key === "Escape") hideModal();
    });

    $("#modalBackdrop").addEventListener("click", event => {
      if (event.target.id === "modalBackdrop") {
        hideModal();
      }
    });

    /* Sorting */

    $("#filterTabs").addEventListener("click", event => {
      const button = event.target.closest("[data-filter]");

      if (!button) return;

      state.filter = button.dataset.filter;

      $$(".filter-tab").forEach(tab => {
        tab.classList.toggle("selected", tab === button);
      });

      render();
    });

    /* Open notes */

    $("#notesGrid").addEventListener("click", event => {
      const card = event.target.closest("[data-id]");

      if (!card) return;

      const note = state.notes.find(
        item => item.id === card.dataset.id
      );

      if (note) openEditor(note);
    });

    /* Grid and list */

    $("#gridViewBtn").onclick = () => {
      state.layout = "grid";
      render();
    };

    $("#listViewBtn").onclick = () => {
      state.layout = "list";
      render();
    };

    /* Theme */

    $("#themeToggle").onclick = () => {
      state.theme =
        state.theme === "light" ? "dark" : "light";

      persist();
      render();
    };

    /* Backup */

    $("#exportBtn").onclick = exportNotes;

    $("#importBtn").onclick = () =>
      $("#importFile").click();

    $("#importFile").onchange = event => {
      const file = event.target.files[0];

      if (file) importNotes(file);

      event.target.value = "";
    };

    /* Mobile sidebar */

    $("#mobileMenu").onclick = () => {
      $("#sidebar").classList.toggle("open");
    };

    /* Keyboard shortcuts */

    document.addEventListener("keydown", event => {

      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        $("#searchInput").focus();
      }

      if (modifier && event.key.toLowerCase() === "n") {
        event.preventDefault();
        createNote();
      }

      if (event.key === "Escape") {
        hideModal();
        $("#sidebar").classList.remove("open");
      }
    });

    /* Save before leaving */

    window.addEventListener("beforeunload", () => {
      clearTimeout(saveTimer);
      persist();
    });
  }

  /* INITIALIZE */

  $("#todayLabel").textContent =
    new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    }).toUpperCase();

  bind();

  render();

  $("#editorPanel").classList.add("empty-editor");

})();
