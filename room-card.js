/**
 * Room Card
 * Kompakte Raum-Karte mit Icon, Name (klickbar -> Navigation) und
 * Schnellzugriff-Buttons (aktuell: Licht an/aus).
 *
 * https://github.com/Nellyskills/room-card
 */

const TRANSLATIONS = {
  de: {
    editor_icon: "Icon",
    editor_name: "Name",
    editor_navigation_path: "Navigationspfad (z.B. /lovelace/wohnzimmer)",
    editor_entities: "Schnellzugriff",
    editor_add_entity: "Hinzufügen",
    editor_type: "Typ",
    editor_type_light: "Licht",
    editor_type_cover: "Vorhang",
    editor_type_door: "Tür/Fenster",
    editor_entity: "Entität",
    editor_icon_label: "Icon",
    editor_icon_open: "Icon (geöffnet)",
    editor_icon_closed: "Icon (geschlossen)",
    editor_remove: "Entfernen",
    editor_no_entities: "Noch keine Schnellzugriffe hinzugefügt.",
    editor_reorder: "Zum Sortieren ziehen",
    editor_temperature: "Temperatursensor (optional)",
    editor_entity_nav_path: "Navigationspfad (optional)",
  },
  en: {
    editor_icon: "Icon",
    editor_name: "Name",
    editor_navigation_path: "Navigation path (e.g. /lovelace/living-room)",
    editor_entities: "Quick actions",
    editor_add_entity: "Add",
    editor_type: "Type",
    editor_type_light: "Light",
    editor_type_cover: "Cover",
    editor_type_door: "Door/Window",
    editor_entity: "Entity",
    editor_icon_label: "Icon",
    editor_icon_open: "Icon (open)",
    editor_icon_closed: "Icon (closed)",
    editor_remove: "Remove",
    editor_no_entities: "No quick actions added yet.",
    editor_reorder: "Drag to reorder",
    editor_temperature: "Temperature sensor (optional)",
    editor_entity_nav_path: "Navigation path (optional)",
  },
};

function t(hass, key) {
  const lang = hass && hass.language && hass.language.startsWith("de") ? "de" : "en";
  return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || key;
}

function fireEvent(node, type, detail) {
  const event = new CustomEvent(type, {
    detail,
    bubbles: true,
    composed: true,
  });
  node.dispatchEvent(event);
}

/* ------------------------------------------------------------------ */
/* Card                                                                 */
/* ------------------------------------------------------------------ */

class RoomCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("room-card-editor");
  }

  static getStubConfig() {
    return {
      icon: "mdi:sofa",
      name: "Raum",
      navigation_path: "",
      temperature_entity: "",
      entities: [],
    };
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Ungültige Konfiguration");
    }
    this._config = {
      ...config,
      icon: config.icon || "mdi:sofa",
      name: config.name || "",
      navigation_path: config.navigation_path || "",
      temperature_entity: config.temperature_entity || "",
      entities: Array.isArray(config.entities) ? config.entities : [],
    };
    this._built = false;
    if (this._hass) {
      this._build();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._built) {
      this._build();
    } else {
      this._update();
    }
  }

  getCardSize() {
    return 1;
  }

  _build() {
    if (!this._config) return;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card>
        <div class="row">
          <div class="main"></div>
          <span class="temp"></span>
          <div class="entities"></div>
        </div>
      </ha-card>
    `;

    const main = this.shadowRoot.querySelector(".main");
    const iconWrap = document.createElement("div");
    iconWrap.className = "icon-wrap";
    const icon = document.createElement("ha-icon");
    icon.className = "icon";
    iconWrap.appendChild(icon);
    const name = document.createElement("span");
    name.className = "name";
    main.appendChild(iconWrap);
    main.appendChild(name);
    main.addEventListener("click", () => this._navigate());

    this._mainIcon = icon;
    this._mainName = name;
    this._tempEl = this.shadowRoot.querySelector(".temp");
    this._entitiesEl = this.shadowRoot.querySelector(".entities");

    this._buttons = [];
    this._config.entities.forEach((entCfg) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ent-btn";
      const btnIcon = document.createElement("ha-icon");
      btn.appendChild(btnIcon);
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._handleClick(entCfg);
      });
      this._entitiesEl.appendChild(btn);
      this._buttons.push({ btn, icon: btnIcon, cfg: entCfg });
    });

    this._built = true;
    this._update();
  }

  _navigate(path) {
    const target = path || this._config.navigation_path;
    if (!target) return;
    history.pushState(null, "", target);
    fireEvent(window, "location-changed", { replace: false });
  }

  _handleClick(cfg) {
    if (!cfg.entity || !this._hass || !this._hass.states[cfg.entity]) return;
    if (cfg.type === "cover") {
      this._openMoreInfo(cfg.entity);
    } else if (cfg.type === "door") {
      if (cfg.navigation_path) {
        this._navigate(cfg.navigation_path);
      } else {
        this._openMoreInfo(cfg.entity);
      }
    } else {
      this._toggle(cfg.entity);
    }
  }

  _openMoreInfo(entityId) {
    fireEvent(this, "hass-more-info", { entityId });
  }

  _toggle(entityId) {
    if (!entityId || !this._hass || !this._hass.states[entityId]) return;
    const domain = entityId.split(".")[0];
    this._hass.callService(domain, "toggle", { entity_id: entityId });
  }

  _update() {
    if (!this._hass || !this._built) return;

    this._mainIcon.setAttribute("icon", this._config.icon);
    this._mainName.textContent = this._config.name;

    if (this._config.temperature_entity) {
      const tempState = this._hass.states[this._config.temperature_entity];
      if (tempState && tempState.state !== "unavailable" && tempState.state !== "unknown") {
        const unit = tempState.attributes.unit_of_measurement || "°C";
        const value = Math.round(parseFloat(tempState.state) * 10) / 10;
        this._tempEl.textContent = Number.isNaN(value) ? "" : `${value}${unit}`;
      } else {
        this._tempEl.textContent = "";
      }
    } else {
      this._tempEl.textContent = "";
    }

    this._buttons.forEach(({ btn, icon, cfg }) => {
      const stateObj = this._hass.states[cfg.entity];
      btn.classList.remove("on", "off", "unavailable", "cover-open", "door-open", "door-closed");

      if (!stateObj || stateObj.state === "unavailable" || stateObj.state === "unknown") {
        icon.setAttribute(
          "icon",
          cfg.type === "cover"
            ? cfg.icon_open || "mdi:curtains"
            : cfg.type === "door"
              ? cfg.icon_open || "mdi:door-open"
              : cfg.icon || "mdi:lightbulb"
        );
        btn.classList.add("unavailable");
        btn.disabled = true;
        return;
      }

      btn.disabled = false;
      if (cfg.type === "cover") {
        const isClosed = stateObj.state === "closed";
        icon.setAttribute("icon", isClosed ? cfg.icon_closed || "mdi:curtains-closed" : cfg.icon_open || "mdi:curtains");
        btn.classList.add(isClosed ? "off" : "cover-open");
      } else if (cfg.type === "door") {
        const isOpen = stateObj.state === "on";
        icon.setAttribute("icon", isOpen ? cfg.icon_open || "mdi:door-open" : cfg.icon_closed || "mdi:door-closed");
        btn.classList.add(isOpen ? "door-open" : "door-closed");
      } else {
        icon.setAttribute("icon", cfg.icon || "mdi:lightbulb");
        btn.classList.add(stateObj.state === "on" ? "on" : "off");
      }
    });
  }

  _styles() {
    return `
      ha-card {
        box-shadow: var(--ha-card-box-shadow, none);
        background: var(--ha-card-background, var(--card-background-color, #1c1c1c));
        border-radius: var(--ha-card-border-radius, 12px);
      }
      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px;
        height: 58px;
      }
      .main {
        display: flex;
        align-items: center;
        gap: 0;
        flex: 1;
        min-width: 0;
        height: 100%;
        cursor: pointer;
      }
      .icon-wrap {
        width: 40px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: flex-start;
      }
      .icon {
        --mdc-icon-size: 22px;
        color: var(--primary-text-color);
      }
      .name {
        font-weight: 500;
        font-size: 16px;
        color: var(--primary-text-color);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding-left: 6px;
      }
      .temp {
        flex-shrink: 0;
        color: var(--secondary-text-color);
        font-size: 15px;
        font-weight: 500;
        padding-left: 8px;
      }
      .temp:empty {
        display: none;
      }
      .entities {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
        padding-left: 8px;
      }
      .ent-btn {
        width: 40px;
        height: 40px;
        border-radius: 14px;
        border: none;
        background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.08);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
      }
      .ent-btn ha-icon {
        --mdc-icon-size: 18px;
        color: var(--disabled-text-color);
      }
      .ent-btn.on ha-icon {
        color: rgba(255, 193, 7, 0.95);
      }
      .ent-btn.off ha-icon {
        color: var(--disabled-text-color);
      }
      .ent-btn.cover-open ha-icon {
        color: rgba(33, 150, 243, 0.95);
      }
      .ent-btn.door-closed ha-icon {
        color: rgba(76, 175, 80, 0.95);
      }
      .ent-btn.door-open ha-icon {
        color: rgba(233, 30, 99, 0.9);
      }
      .ent-btn.unavailable {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .ent-btn.unavailable ha-icon {
        color: rgba(255, 80, 80, 0.9);
      }
    `;
  }
}

/* ------------------------------------------------------------------ */
/* Editor                                                               */
/* ------------------------------------------------------------------ */

class RoomCardEditor extends HTMLElement {
  setConfig(config) {
    const topLevel = {
      ...config,
      icon: config.icon || "mdi:sofa",
      name: config.name || "",
      navigation_path: config.navigation_path || "",
      temperature_entity: config.temperature_entity || "",
    };

    if (!this._built || !this._config) {
      // Erster Aufbau (oder nach einem Reset): Entities frisch aus der
      // eingehenden Config übernehmen.
      this._config = {
        ...topLevel,
        entities: Array.isArray(config.entities) ? config.entities.map((e) => ({ ...e })) : [],
      };
      this._render();
      return;
    }

    // Editor ist bereits aufgebaut: Dieser Aufruf ist so gut wie immer nur
    // ein Echo unserer eigenen Änderung (config-changed -> HA -> setConfig).
    // Die entities-Referenz bleibt daher unangetastet - sie ist ab jetzt
    // ausschließlich über Hinzufügen/Entfernen/Typ-Wechsel veränderbar.
    // So verwaisen laufende Bearbeitungen nicht, egal wie viele Änderungen
    // man hintereinander macht, ohne den Editor neu zu öffnen.
    this._config = {
      ...topLevel,
      entities: this._config.entities,
    };
    this._syncFieldValues();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._built) {
      this._syncHassRefs();
    } else {
      this._render();
    }
  }

  connectedCallback() {
    if (this._config) this._render();
  }

  _fire() {
    // WICHTIG: Niemals unsere eigenen (internen, weiterhin veränderbaren)
    // Objekte direkt an HA übergeben. HA friert die per config-changed
    // gesendete Config ein (Object.freeze) - wenn das dieselbe Objekt-
    // referenz wäre, mit der wir intern weiterarbeiten, würde jede
    // weitere Bearbeitung mit "Cannot assign to read only property"
    // fehlschlagen. Deshalb hier eine komplette, unabhängige Kopie senden.
    const configCopy = JSON.parse(JSON.stringify(this._config));
    fireEvent(this, "config-changed", { config: configCopy });
  }

  _render() {
    if (!this._config) return;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <div class="section">
        <div class="top-row"></div>
        <div class="name-row"></div>
        <div class="nav-row"></div>
        <div class="temp-row"></div>
      </div>
      <div class="section">
        <div class="section-title">${t(this._hass, "editor_entities")}</div>
        <div class="entities-list"></div>
        <button class="add-btn" type="button">
          <ha-icon icon="mdi:plus"></ha-icon><span>${t(this._hass, "editor_add_entity")}</span>
        </button>
      </div>
    `;

    const topRow = this.shadowRoot.querySelector(".top-row");
    const iconPicker = document.createElement("ha-icon-picker");
    iconPicker.label = t(this._hass, "editor_icon");
    iconPicker.hass = this._hass;
    iconPicker.value = this._config.icon;
    iconPicker.addEventListener("value-changed", (e) => {
      this._config.icon = e.detail.value;
      this._fire();
    });
    topRow.appendChild(iconPicker);
    this._iconPicker = iconPicker;

    const nameField = this._createTextField(
      t(this._hass, "editor_name"),
      this._config.name,
      (value) => {
        this._config.name = value;
        this._fire();
      }
    );
    this.shadowRoot.querySelector(".name-row").appendChild(nameField.wrap);
    this._nameInput = nameField.input;

    const navField = this._createTextField(
      t(this._hass, "editor_navigation_path"),
      this._config.navigation_path,
      (value) => {
        this._config.navigation_path = value;
        this._fire();
      }
    );
    this.shadowRoot.querySelector(".nav-row").appendChild(navField.wrap);
    this._navInput = navField.input;

    const tempRow = this.shadowRoot.querySelector(".temp-row");
    const tempPicker = document.createElement("ha-entity-picker");
    tempPicker.hass = this._hass;
    tempPicker.label = t(this._hass, "editor_temperature");
    tempPicker.value = this._config.temperature_entity || "";
    tempPicker.includeDomains = ["sensor"];
    tempPicker.allowCustomEntity = false;
    tempPicker.classList.add("temp-picker");
    tempPicker.addEventListener("value-changed", (e) => {
      this._config.temperature_entity = e.detail.value || "";
      this._fire();
    });
    tempRow.appendChild(tempPicker);
    this._tempPicker = tempPicker;

    this._list = this.shadowRoot.querySelector(".entities-list");
    this._addBtn = this.shadowRoot.querySelector(".add-btn");
    this._addBtn.addEventListener("click", () => {
      this._config.entities = [
        ...this._config.entities,
        { type: "light", icon: "mdi:lightbulb", entity: "" },
      ];
      this._fire();
      this._render();
    });

    this._renderEntities();
    this._built = true;
  }

  _renderEntities() {
    this._list.innerHTML = "";

    if (this._config.entities.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = t(this._hass, "editor_no_entities");
      this._list.appendChild(empty);
      return;
    }

    this._config.entities.forEach((entCfg, idx) => {
      if (!entCfg.type) entCfg.type = "light";
      const item = document.createElement("div");
      item.className = "ent-item";
      item._entCfg = entCfg;

      const topRow = document.createElement("div");
      topRow.className = "ent-row";
      topRow.style.gridTemplateColumns = "72px minmax(0, 1fr) 40px";

      const typeSelect = document.createElement("select");
      typeSelect.className = "type-select";
      typeSelect.title = t(this._hass, "editor_type");
      const optLight = document.createElement("option");
      optLight.value = "light";
      optLight.textContent = t(this._hass, "editor_type_light");
      const optCover = document.createElement("option");
      optCover.value = "cover";
      optCover.textContent = t(this._hass, "editor_type_cover");
      const optDoor = document.createElement("option");
      optDoor.value = "door";
      optDoor.textContent = t(this._hass, "editor_type_door");
      typeSelect.appendChild(optLight);
      typeSelect.appendChild(optCover);
      typeSelect.appendChild(optDoor);
      typeSelect.value = entCfg.type;
      typeSelect.addEventListener("keydown", (e) => e.stopPropagation());
      typeSelect.addEventListener("change", (e) => {
        entCfg.type = e.target.value;
        if (entCfg.type === "cover") {
          delete entCfg.icon;
          delete entCfg.navigation_path;
          entCfg.icon_open = entCfg.icon_open || "mdi:curtains";
          entCfg.icon_closed = entCfg.icon_closed || "mdi:curtains-closed";
        } else if (entCfg.type === "door") {
          delete entCfg.icon;
          entCfg.icon_open = entCfg.icon_open || "mdi:door-open";
          entCfg.icon_closed = entCfg.icon_closed || "mdi:door-closed";
          entCfg.navigation_path = entCfg.navigation_path || "";
        } else {
          delete entCfg.icon_open;
          delete entCfg.icon_closed;
          delete entCfg.navigation_path;
          entCfg.icon = entCfg.icon || "mdi:lightbulb";
        }
        entCfg.entity = "";
        this._fire();
        this._render();
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-btn";
      removeBtn.title = t(this._hass, "editor_remove");
      const removeIcon = document.createElement("ha-icon");
      removeIcon.setAttribute("icon", "mdi:delete-outline");
      removeBtn.appendChild(removeIcon);
      removeBtn.addEventListener("click", () => {
        this._config.entities = this._config.entities.filter((_, i) => i !== idx);
        this._fire();
        this._render();
      });

      const entityPicker = document.createElement("ha-entity-picker");
      entityPicker.hass = this._hass;
      entityPicker.value = entCfg.entity || "";
      if (entCfg.type === "cover") {
        entityPicker.includeDomains = ["cover"];
      } else if (entCfg.type === "door") {
        entityPicker.includeDomains = ["binary_sensor"];
        entityPicker.includeDeviceClasses = ["door", "window", "garage_door", "opening"];
      } else {
        entityPicker.includeDomains = ["light", "switch"];
      }
      entityPicker.classList.add("entity-picker");
      entityPicker.addEventListener("value-changed", (e) => {
        entCfg.entity = e.detail.value;
        this._fire();
      });

      topRow.appendChild(typeSelect);
      topRow.appendChild(entityPicker);
      topRow.appendChild(removeBtn);
      item.appendChild(topRow);

      const iconsRow = document.createElement("div");
      iconsRow.className = "ent-icons-row";

      const dragHandle = document.createElement("div");
      dragHandle.className = "drag-handle";
      dragHandle.title = t(this._hass, "editor_reorder");
      const dragIcon = document.createElement("ha-icon");
      dragIcon.setAttribute("icon", "mdi:drag-horizontal");
      dragHandle.appendChild(dragIcon);
      iconsRow.appendChild(dragHandle);

      if (entCfg.type === "cover" || entCfg.type === "door") {
        const defaultOpen = entCfg.type === "cover" ? "mdi:curtains" : "mdi:door-open";
        const defaultClosed = entCfg.type === "cover" ? "mdi:curtains-closed" : "mdi:door-closed";

        const openGroup = document.createElement("div");
        openGroup.className = "icon-group";
        const openLabel = document.createElement("label");
        openLabel.textContent = t(this._hass, "editor_icon_open");
        const iconOpenPicker = document.createElement("ha-icon-picker");
        iconOpenPicker.hass = this._hass;
        iconOpenPicker.value = entCfg.icon_open || defaultOpen;
        iconOpenPicker.classList.add("icon-picker");
        iconOpenPicker.addEventListener("value-changed", (e) => {
          entCfg.icon_open = e.detail.value;
          this._fire();
        });
        openGroup.appendChild(openLabel);
        openGroup.appendChild(iconOpenPicker);

        const closedGroup = document.createElement("div");
        closedGroup.className = "icon-group";
        const closedLabel = document.createElement("label");
        closedLabel.textContent = t(this._hass, "editor_icon_closed");
        const iconClosedPicker = document.createElement("ha-icon-picker");
        iconClosedPicker.hass = this._hass;
        iconClosedPicker.value = entCfg.icon_closed || defaultClosed;
        iconClosedPicker.classList.add("icon-picker");
        iconClosedPicker.addEventListener("value-changed", (e) => {
          entCfg.icon_closed = e.detail.value;
          this._fire();
        });
        closedGroup.appendChild(closedLabel);
        closedGroup.appendChild(iconClosedPicker);

        iconsRow.appendChild(openGroup);
        iconsRow.appendChild(closedGroup);
      } else {
        const iconGroup = document.createElement("div");
        iconGroup.className = "icon-group";
        const iconLabel = document.createElement("label");
        iconLabel.textContent = t(this._hass, "editor_icon_label");
        const iconPicker = document.createElement("ha-icon-picker");
        iconPicker.hass = this._hass;
        iconPicker.value = entCfg.icon || "mdi:lightbulb";
        iconPicker.classList.add("icon-picker");
        iconPicker.addEventListener("value-changed", (e) => {
          entCfg.icon = e.detail.value;
          this._fire();
        });
        iconGroup.appendChild(iconLabel);
        iconGroup.appendChild(iconPicker);
        iconsRow.appendChild(iconGroup);
      }

      item.appendChild(iconsRow);

      if (entCfg.type === "door") {
        const navRow = document.createElement("div");
        navRow.className = "ent-nav-row";
        const navField = this._createTextField(
          t(this._hass, "editor_entity_nav_path"),
          entCfg.navigation_path || "",
          (value) => {
            entCfg.navigation_path = value;
            this._fire();
          }
        );
        navField.wrap.classList.add("compact-field");
        navRow.appendChild(navField.wrap);
        item.appendChild(navRow);
      }

      this._list.appendChild(item);
      this._makeDraggable(item, dragHandle);
    });
  }

  _makeDraggable(item, handle) {
    handle.addEventListener("mousedown", () => {
      item.draggable = true;
    });
    handle.addEventListener("touchstart", () => {
      item.draggable = true;
    });
    const reset = () => {
      item.draggable = false;
    };
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      reset();
    });

    item.addEventListener("dragstart", (e) => {
      this._dragSrcEntity = item._entCfg;
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", "");
      } catch (err) {
        // Manche Browser verlangen setData, Inhalt ist hier irrelevant.
      }
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    item.addEventListener("dragenter", () => {
      if (item._entCfg !== this._dragSrcEntity) {
        item.classList.add("drag-over");
      }
    });
    item.addEventListener("dragleave", () => {
      item.classList.remove("drag-over");
    });

    item.addEventListener("drop", (e) => {
      e.preventDefault();
      item.classList.remove("drag-over");
      const src = this._dragSrcEntity;
      const target = item._entCfg;
      this._dragSrcEntity = null;
      if (!src || src === target) return;
      const entities = this._config.entities;
      const fromIdx = entities.indexOf(src);
      const toIdx = entities.indexOf(target);
      if (fromIdx === -1 || toIdx === -1) return;
      entities.splice(fromIdx, 1);
      entities.splice(toIdx, 0, src);
      this._fire();
      this._render();
    });
  }

  _syncFieldValues() {
    const active = this.shadowRoot && this.shadowRoot.activeElement;
    if (this._nameInput && active !== this._nameInput && this._nameInput.value !== this._config.name) {
      this._nameInput.value = this._config.name;
    }
    if (
      this._navInput &&
      active !== this._navInput &&
      this._navInput.value !== this._config.navigation_path
    ) {
      this._navInput.value = this._config.navigation_path;
    }
    if (
      this._iconPicker &&
      active !== this._iconPicker &&
      this._iconPicker.value !== this._config.icon
    ) {
      this._iconPicker.value = this._config.icon;
    }
    if (
      this._tempPicker &&
      active !== this._tempPicker &&
      this._tempPicker.value !== this._config.temperature_entity
    ) {
      this._tempPicker.value = this._config.temperature_entity || "";
    }
  }

  _createTextField(label, value, onInput) {
    const wrap = document.createElement("div");
    wrap.className = "text-field";
    const lbl = document.createElement("label");
    lbl.textContent = label;
    const input = document.createElement("input");
    input.type = "text";
    input.value = value || "";
    input.addEventListener("input", (e) => onInput(e.target.value));
    input.addEventListener("keydown", (e) => e.stopPropagation());
    input.addEventListener("keyup", (e) => e.stopPropagation());
    wrap.appendChild(lbl);
    wrap.appendChild(input);
    return { wrap, input };
  }

  _syncHassRefs() {
    if (!this.shadowRoot) return;
    this.shadowRoot.querySelectorAll("ha-icon-picker, ha-entity-picker").forEach((el) => {
      el.hass = this._hass;
    });
  }

  _styles() {
    return `
      :host { display: block; }
      .section { margin-bottom: 16px; }
      .section-title {
        font-weight: 500;
        margin-bottom: 8px;
        color: var(--primary-text-color);
      }
      .top-row { display: block; }
      .temp-row {
        margin-top: 12px;
      }
      .temp-picker {
        width: 100%;
      }
      .text-field {
        display: flex;
        flex-direction: column;
        margin-top: 12px;
      }
      .text-field label {
        font-size: 12px;
        color: var(--secondary-text-color);
        margin-bottom: 4px;
      }
      .text-field input {
        font: inherit;
        font-size: 14px;
        color: var(--primary-text-color);
        background: var(--card-background-color, #1c1c1c);
        border: 1px solid var(--divider-color, #444);
        border-radius: 6px;
        padding: 10px;
        outline: none;
        width: 100%;
        box-sizing: border-box;
      }
      .text-field input:focus {
        border-color: var(--primary-color);
      }
      .ent-item {
        margin-bottom: 14px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--divider-color, #333);
        border-radius: 8px;
        transition: opacity 0.15s ease, background 0.15s ease;
      }
      .ent-item:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }
      .ent-item.dragging {
        opacity: 0.35;
      }
      .ent-item.drag-over {
        background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.06);
      }
      .ent-row {
        display: grid;
        align-items: center;
        gap: 6px;
      }
      .ent-icons-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 8px;
      }
      .ent-nav-row {
        padding-left: 82px;
        margin-top: 4px;
      }
      .ent-nav-row .compact-field {
        margin-top: 0;
      }
      .drag-handle {
        flex: 0 0 72px;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 40px;
        cursor: grab;
        color: var(--secondary-text-color);
        border-radius: 8px;
      }
      .drag-handle:hover {
        background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.06);
        color: var(--primary-text-color);
      }
      .drag-handle:active {
        cursor: grabbing;
      }
      .icon-group {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .icon-group label {
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      .type-select {
        height: 40px;
        padding: 0 4px;
        border-radius: 8px;
        border: 1px solid var(--divider-color, #444);
        background: var(--card-background-color, #1c1c1c);
        color: var(--primary-text-color);
        box-sizing: border-box;
        width: 100%;
      }
      .icon-picker {
        width: 100%;
        min-width: 0;
      }
      .entity-picker {
        width: 100%;
        min-width: 0;
      }
      .remove-btn {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        border: none;
        background: none;
        cursor: pointer;
        color: var(--error-color, #db4437);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .empty {
        color: var(--secondary-text-color);
        font-size: 14px;
        padding: 8px 0;
      }
      .add-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        border: 1px dashed var(--divider-color, #444);
        background: none;
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        color: var(--primary-color);
        width: 100%;
        margin-top: 10px;
        box-sizing: border-box;
      }
    `;
  }
}

customElements.define("room-card", RoomCard);
customElements.define("room-card-editor", RoomCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "room-card",
  name: "Nellyskills Room Card",
  description: "Kompakte Raum-Karte mit Icon, Name und Schnellzugriff-Buttons für Lichter.",
  preview: true,
});
