(() => {
  const STORE_ID = new URLSearchParams(window.location.search).get("loja") || "";
  const STORAGE_KEY_STORES = "stores_v1";
  const ATTENTION_TEXT_MAX = 240;

  const adminLayout = document.getElementById("adminLayout");
  const adminSidebar = document.getElementById("adminSidebar");
  const adminSidebarBody = document.getElementById("adminSidebarBody");
  const adminSidebarTitle = document.getElementById("adminSidebarTitle");
  const adminSidebarClose = document.getElementById("adminSidebarClose");
  const adminPublishBtn = document.getElementById("adminPublishBtn");
  const adminSaveBtn = document.getElementById("adminSaveBtn");
  const adminResetBtn = document.getElementById("adminResetBtn");
  const adminPublishHint = document.getElementById("adminPublishHint");
  const adminActionOverlay = document.getElementById("adminActionOverlay");
  const adminActionTitle = document.getElementById("adminActionTitle");
  const adminActionBar = document.getElementById("adminActionBar");
  const adminActionStatus = document.getElementById("adminActionStatus");
  const adminActionResult = document.getElementById("adminActionResult");
  const adminActionClose = document.getElementById("adminActionClose");

  let storesCache = [];
  let currentStore = null;
  let draftConfig = null;
  let activeSection = "";

  const api = window.personalizacaoConfigApi;

  function normalizeStoreKey(value){
    const raw = (value || "").toString().trim().toLowerCase();
    if(!raw) return "";
    return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  async function apiRequest(path, payload){
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload || {})
    });
    const data = await response.json().catch(() => ({}));
    if(!response.ok || data.ok === false){
      throw new Error(data.error || "request_failed");
    }
    return data;
  }

  function clone(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  function applyDraft(){
    if(!api || !draftConfig) return;
    api.applyConfigToUI(draftConfig);
  }

  function setPublishHint(message, ok){
    if(!adminPublishHint) return;
    adminPublishHint.textContent = message || "";
    adminPublishHint.style.color = ok ? "#22c55e" : "#f87171";
  }

  let actionTimer = null;
  function showActionPopup(title, message, ok){
    if(!adminActionOverlay || !adminActionBar || !adminActionStatus || !adminActionResult || !adminActionTitle || !adminActionClose){
      setPublishHint(message, ok);
      return;
    }
    if(actionTimer){
      clearInterval(actionTimer);
      actionTimer = null;
    }
    adminActionTitle.textContent = title || "Processando...";
    adminActionBar.style.width = "0%";
    adminActionStatus.textContent = "Carregando...";
    adminActionResult.style.display = "none";
    adminActionResult.textContent = "";
    adminActionClose.disabled = true;
    adminActionOverlay.style.display = "flex";
    let progress = 0;
    actionTimer = setInterval(() => {
      progress = Math.min(100, progress + 12 + Math.random() * 10);
      adminActionBar.style.width = `${progress}%`;
      if(progress >= 100){
        clearInterval(actionTimer);
        actionTimer = null;
        adminActionStatus.textContent = "Concluido";
        adminActionResult.style.display = "block";
        adminActionResult.textContent = message || "";
        adminActionResult.style.color = ok ? "#111111" : "#f87171";
        adminActionClose.disabled = false;
      }
    }, 120);
  }

  function closeActionPopup(){
    if(adminActionOverlay) adminActionOverlay.style.display = "none";
  }

  function openSidebar(section, title){
    activeSection = section;
    if(adminSidebarTitle) adminSidebarTitle.textContent = title || "Editar";
    if(adminLayout) adminLayout.classList.add("isPanelOpen");
    if(adminSidebar) adminSidebar.setAttribute("aria-hidden", "false");
    renderSidebar(section);
  }

  function closeSidebar(){
    if(adminLayout) adminLayout.classList.remove("isPanelOpen");
    if(adminSidebar) adminSidebar.setAttribute("aria-hidden", "true");
  }

  function renderSidebar(section){
    if(!adminSidebarBody || !draftConfig) return;
    if(section === "config"){
      adminSidebarBody.innerHTML = `
        <div class="adminConfigHeaderRow">
          <div class="adminSidebarSectionTitle adminConfigHeaderTitle">Cart&atilde;o de configura&ccedil;&otilde;es</div>
          <button class="btn small adminConfigCloseBtn" type="button" id="adminConfigCloseBtn">Fechar</button>
        </div>
        <div class="adminSidebarSection adminConfigColors">
          <div class="adminSidebarSectionTitle">Cores</div>
          <div class="adminField">
            <label>Cor de fundo</label>
            <input type="color" id="cfgBg" value="${draftConfig.cards.config.bg || "#ffffff"}" />
          </div>
          <div class="adminField">
            <label>Cor do texto</label>
            <input type="color" id="cfgText" value="${draftConfig.cards.config.text || "#111827"}" />
          </div>
          <div class="adminField">
            <label>Cor dos campos</label>
            <input type="color" id="cfgFieldText" value="${draftConfig.cards.config.fieldText || "#111827"}" />
          </div>
          <div class="adminField">
            <label>Cor do bot&atilde;o</label>
            <input type="color" id="cfgBtnBg" value="${draftConfig.cards.config.buttonBg || "#ffffff"}" />
          </div>
          <div class="adminField">
            <label>Cor do texto do bot&atilde;o</label>
            <input type="color" id="cfgBtnText" value="${draftConfig.cards.config.buttonText || "#111827"}" />
          </div>
          <div class="adminField">
            <label>Cor do &iacute;cone de lixeira</label>
            <input type="color" id="cfgTrashIcon" value="${draftConfig.cards.config.trashIconColor || ""}" />
          </div>
          <div class="adminField">
            <label>Cor do texto do campo Aten&ccedil;&atilde;o</label>
            <input type="color" id="cfgAttentionText" value="${draftConfig.cards.config.attentionTextColor || ""}" />
          </div>
          <div class="adminField">
            <label>Cor do fundo do campo Aten&ccedil;&atilde;o</label>
            <input type="color" id="cfgAttentionBg" value="${draftConfig.cards.config.attentionBgColor || ""}" />
          </div>
          <div class="adminField">
            <label>Cor das linhas divis&oacute;rias</label>
            <input type="color" id="cfgDivider" value="${draftConfig.global.dividerColor || "#b9c2cf"}" />
          </div>
        </div>
        <div class="adminSidebarSection">
          <div class="adminSidebarSectionTitle">Cores da camiseta</div>
          <div class="adminList" id="cfgColors"></div>
          <div class="adminHelp">Marque as cores que o cliente pode escolher.</div>
        </div>
        <div class="adminSidebarSection">
          <div class="adminSidebarSectionTitle">Textos da estampa</div>
          <div class="adminToggleRow">
            <input type="checkbox" id="cfgTextFields" ${draftConfig.cards.config.textFieldsEnabled ? "checked" : ""} />
            <label for="cfgTextFields">Habilitar textos da estampa</label>
          </div>
          <div class="adminHelp adminHelpCenter">Controla se o cliente pode adicionar texto e fonte personalizada na estampa.</div>
        </div>
        <div class="adminSidebarSection">
          <div class="adminSidebarSectionTitle">Tamanhos</div>
          <div class="adminField">
            <label>Lista (uma por linha)</label>
            <textarea id="cfgSizes"></textarea>
          </div>
        </div>
        <div class="adminSidebarSection">
          <div class="adminSidebarSectionTitle">Campo de aten&ccedil;&atilde;o</div>
          <div class="adminField">
            <label>Texto (uma linha por item)</label>
            <textarea id="cfgAttention" maxlength="${ATTENTION_TEXT_MAX}"></textarea>
            <div class="adminHelp" id="cfgAttentionCount"></div>
          </div>
        </div>
      `;
      renderColorsEditor();
      bindConfigEditors();
      const configClose = adminSidebarBody.querySelector("#adminConfigCloseBtn");
      if(configClose){
        configClose.addEventListener("click", closeSidebar);
      }
      return;
    }
    if(section === "mockup"){
      adminSidebarBody.innerHTML = `
        <div class="adminPanelHeaderRow">
          <div class="adminSidebarSectionTitle adminPanelHeaderTitle">Cart&atilde;o do mockup</div>
          <button class="btn small adminPanelCloseBtn" type="button" id="adminMockupCloseBtn">Fechar</button>
        </div>
        <div class="adminSidebarSection">
          <div class="adminSidebarSectionTitle">Texto do mockup</div>
          <div class="adminField">
            <label>Descricao</label>
            <textarea id="mockupHintInput"></textarea>
          </div>
        </div>
        <div class="adminSidebarSection">
          <div class="adminSidebarSectionTitle">Cores</div>
          <div class="adminField">
            <label>Fundo do cart&atilde;o</label>
            <input type="color" id="mockupPanelBg" value="${draftConfig.cards.mockup.panelBg || ""}" />
          </div>
          <div class="adminField">
            <label>Fundo do mockup</label>
            <input type="color" id="mockupBg" value="${draftConfig.cards.mockup.bg || "#e8f1ff"}" />
          </div>
          <div class="adminField">
            <label>Cor do texto das pr&eacute;vias sem estampa</label>
            <input type="color" id="mockupPreviewEmptyText" value="${draftConfig.cards.mockup.previewEmptyTextColor || ""}" />
          </div>
          <div class="adminField">
            <label>Cor do texto</label>
            <input type="color" id="mockupText" value="${draftConfig.cards.mockup.text || "#111827"}" />
          </div>
          <div class="adminField">
            <label>Cor do bot&atilde;o</label>
            <input type="color" id="mockupBtnBg" value="${draftConfig.cards.mockup.buttonBg || "#ffffff"}" />
          </div>
          <div class="adminField">
            <label>Cor do texto do bot&atilde;o</label>
            <input type="color" id="mockupBtnText" value="${draftConfig.cards.mockup.buttonText || "#111827"}" />
          </div>
        </div>
        <div class="adminSidebarSection">
          <div class="adminSidebarSectionTitle">Valores</div>
          <div class="adminField">
            <label>Valor de camisetas com estampa de 1 lado</label>
            <input type="text" id="priceSingle" value="${draftConfig.cards.mockup.priceSingle || ""}" placeholder="Ex: R$ 82,90" />
          </div>
          <div class="adminField">
            <label>Valor de camisetas com estampa dos 2 lados</label>
            <input type="text" id="priceDouble" value="${draftConfig.cards.mockup.priceDouble || ""}" placeholder="Ex: R$ 99,90" />
          </div>
        </div>
      `;
      const hintInput = adminSidebarBody.querySelector("#mockupHintInput");
      if(hintInput) hintInput.value = draftConfig.cards.mockup.hintText || "";
      bindMockupEditors();
      const mockupClose = adminSidebarBody.querySelector("#adminMockupCloseBtn");
      if(mockupClose){
        mockupClose.addEventListener("click", closeSidebar);
      }
      return;
    }
    if(section === "customer"){
      adminSidebarBody.innerHTML = `
        <div class="adminPanelHeaderRow">
          <div class="adminSidebarSectionTitle adminPanelHeaderTitle">Cart&atilde;o dos dados dos clientes</div>
          <button class="btn small adminPanelCloseBtn" type="button" id="adminCustomerCloseBtn">Fechar</button>
        </div>
        <div class="adminSidebarSection">
          <div class="adminSidebarSectionTitle">Cores</div>
          <div class="adminField">
            <label>Cor de fundo</label>
            <input type="color" id="customerBg" value="${draftConfig.cards.customer.bg || "#ffffff"}" />
          </div>
          <div class="adminField">
            <label>Cor do texto</label>
            <input type="color" id="customerText" value="${draftConfig.cards.customer.text || "#111827"}" />
          </div>
          <div class="adminField">
            <label>Cor do bot&atilde;o</label>
            <input type="color" id="customerBtnBg" value="${draftConfig.cards.customer.buttonBg || "#2f5bff"}" />
          </div>
          <div class="adminField">
            <label>Cor do texto do bot&atilde;o</label>
            <input type="color" id="customerBtnText" value="${draftConfig.cards.customer.buttonText || "#ffffff"}" />
          </div>
        </div>
      `;
      bindCustomerEditors();
      const customerClose = adminSidebarBody.querySelector("#adminCustomerCloseBtn");
      if(customerClose){
        customerClose.addEventListener("click", closeSidebar);
      }
      return;
    }
    if(section === "global"){
      adminSidebarBody.innerHTML = `
        <div class="adminPanelHeaderRow">
          <div class="adminSidebarSectionTitle adminPanelHeaderTitle">Cart&atilde;o Global</div>
          <button class="btn small adminPanelCloseBtn" type="button" id="adminGlobalCloseBtn">Fechar</button>
        </div>
        <div class="adminSidebarSection">
          <div class="adminSidebarSectionTitle">Cores</div>
          <div class="adminField">
            <label>Cor da barra superior</label>
            <input type="color" id="topbarColor" value="${draftConfig.global.topbarColor || "#0b0b0b"}" />
          </div>
          <div class="adminField">
            <label>Cor do fundo da p&aacute;gina</label>
            <input type="color" id="pageBgColor" value="${draftConfig.global.pageBg || "#f4f7fb"}" />
          </div>
          <div class="adminField">
            <label>Cor do fundo dos bot&otilde;es de editar</label>
            <input type="color" id="editBtnBgColor" value="${draftConfig.global.editBtnBg || "#ffffff"}" />
          </div>
          <div class="adminField">
            <label>Cor do texto dos bot&otilde;es de editar</label>
            <input type="color" id="editBtnTextColor" value="${draftConfig.global.editBtnText || "#000000"}" />
          </div>
          <div class="adminField">
            <label>Cor do fundo dos bot&otilde;es de a&ccedil;&atilde;o</label>
            <input type="color" id="actionBtnBgColor" value="${draftConfig.global.actionBtnBg || "#7171b3"}" />
          </div>
          <div class="adminField">
            <label>Cor do texto dos bot&otilde;es de a&ccedil;&atilde;o</label>
            <input type="color" id="actionBtnTextColor" value="${draftConfig.global.actionBtnText || "#ffffff"}" />
          </div>
        </div>
        <div class="adminSidebarSection">
          <div class="adminSidebarSectionTitle">Popup</div>
          <div class="adminToggleRow adminPopupToggleRow">
            <input type="checkbox" id="popupEnabled" ${draftConfig.global.popup.enabled ? "checked" : ""} />
            <label for="popupEnabled">Ativar popup</label>
          </div>
          <div class="adminToggleRow adminPopupToggleRow">
            <input type="checkbox" id="popupAuto" ${draftConfig.global.popup.autoShow ? "checked" : ""} />
            <label for="popupAuto">Abrir automaticamente</label>
          </div>
          <div class="adminField">
            <label>T&iacute;tulo</label>
            <input type="text" id="popupTitle" value="${draftConfig.global.popup.title || ""}" />
          </div>
          <div class="adminField">
            <label>Conte&uacute;do</label>
            <textarea id="popupContent"></textarea>
          </div>
        </div>
      `;
      const popupContent = adminSidebarBody.querySelector("#popupContent");
      if(popupContent) popupContent.value = draftConfig.global.popup.content || "";
      const globalClose = adminSidebarBody.querySelector("#adminGlobalCloseBtn");
      if(globalClose){
        globalClose.addEventListener("click", closeSidebar);
      }
      bindGlobalEditors();
      return;
    }
  }

  function renderColorsEditor(){
    const host = adminSidebarBody.querySelector("#cfgColors");
    if(!host) return;
    host.innerHTML = (draftConfig.cards.config.colors || []).map((color, idx) => `
      <div class="adminToggleRow adminColorRow">
        <input type="checkbox" data-color-idx="${idx}" ${color.enabled ? "checked" : ""} />
        <span class="adminColorLabel">${color.name}</span>
      </div>
    `).join("");
  }

  function bindConfigEditors(){
    const cfgBg = adminSidebarBody.querySelector("#cfgBg");
    const cfgText = adminSidebarBody.querySelector("#cfgText");
    const cfgFieldText = adminSidebarBody.querySelector("#cfgFieldText");
    const cfgBtnBg = adminSidebarBody.querySelector("#cfgBtnBg");
    const cfgBtnText = adminSidebarBody.querySelector("#cfgBtnText");
    const cfgTrashIcon = adminSidebarBody.querySelector("#cfgTrashIcon");
    const cfgAttentionText = adminSidebarBody.querySelector("#cfgAttentionText");
    const cfgAttentionBg = adminSidebarBody.querySelector("#cfgAttentionBg");
    const cfgTextFields = adminSidebarBody.querySelector("#cfgTextFields");
    const cfgSizes = adminSidebarBody.querySelector("#cfgSizes");
    const cfgAttention = adminSidebarBody.querySelector("#cfgAttention");
    const cfgDivider = adminSidebarBody.querySelector("#cfgDivider");
    const cfgAttentionCount = adminSidebarBody.querySelector("#cfgAttentionCount");

    if(cfgBg){
      cfgBg.addEventListener("input", () => {
        draftConfig.cards.config.bg = cfgBg.value;
        applyDraft();
      });
    }
    if(cfgText){
      cfgText.addEventListener("input", () => {
        draftConfig.cards.config.text = cfgText.value;
        applyDraft();
      });
    }
      if(cfgFieldText){
        cfgFieldText.addEventListener("input", () => {
          draftConfig.cards.config.fieldText = cfgFieldText.value;
          applyDraft();
        });
      }
      if(cfgAttentionText){
        cfgAttentionText.addEventListener("input", () => {
          draftConfig.cards.config.attentionTextColor = cfgAttentionText.value;
          applyDraft();
        });
      }
      if(cfgAttentionBg){
        cfgAttentionBg.addEventListener("input", () => {
          draftConfig.cards.config.attentionBgColor = cfgAttentionBg.value;
          applyDraft();
        });
      }
    if(cfgBtnBg){
      cfgBtnBg.addEventListener("input", () => {
        draftConfig.cards.config.buttonBg = cfgBtnBg.value;
        applyDraft();
      });
    }
      if(cfgBtnText){
        cfgBtnText.addEventListener("input", () => {
          draftConfig.cards.config.buttonText = cfgBtnText.value;
          applyDraft();
        });
      }
      if(cfgTrashIcon){
        cfgTrashIcon.addEventListener("input", () => {
          draftConfig.cards.config.trashIconColor = cfgTrashIcon.value;
          applyDraft();
        });
      }
    if(cfgTextFields){
      cfgTextFields.addEventListener("change", () => {
        draftConfig.cards.config.textFieldsEnabled = cfgTextFields.checked;
        applyDraft();
      });
    }
    if(cfgSizes){
      cfgSizes.value = (draftConfig.cards.config.sizes || []).join("\n");
      cfgSizes.addEventListener("input", () => {
        draftConfig.cards.config.sizes = cfgSizes.value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
        applyDraft();
      });
    }
    if(cfgAttention){
      cfgAttention.value = (draftConfig.cards.config.attentionText || []).join("\n");
      const updateCount = () => {
        if(cfgAttentionCount){
          cfgAttentionCount.textContent = `${cfgAttention.value.length}/${ATTENTION_TEXT_MAX}`;
        }
      };
      updateCount();
      cfgAttention.addEventListener("input", () => {
        draftConfig.cards.config.attentionText = cfgAttention.value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
        updateCount();
        applyDraft();
      });
    }
    if(cfgDivider){
      cfgDivider.addEventListener("input", () => {
        draftConfig.global.dividerColor = cfgDivider.value;
        applyDraft();
      });
    }
    adminSidebarBody.querySelectorAll("[data-color-idx]").forEach((input) => {
      input.addEventListener("change", () => {
        const idx = Number(input.getAttribute("data-color-idx") || -1);
        if(idx < 0 || !draftConfig.cards.config.colors[idx]) return;
        draftConfig.cards.config.colors[idx].enabled = input.checked;
        applyDraft();
      });
    });
  }

  function bindMockupEditors(){
    const hintInput = adminSidebarBody.querySelector("#mockupHintInput");
      const mockupBg = adminSidebarBody.querySelector("#mockupBg");
      const mockupPanelBg = adminSidebarBody.querySelector("#mockupPanelBg");
      const mockupPreviewEmptyText = adminSidebarBody.querySelector("#mockupPreviewEmptyText");
      const mockupText = adminSidebarBody.querySelector("#mockupText");
    const mockupBtnBg = adminSidebarBody.querySelector("#mockupBtnBg");
    const mockupBtnText = adminSidebarBody.querySelector("#mockupBtnText");
    const priceSingle = adminSidebarBody.querySelector("#priceSingle");
    const priceDouble = adminSidebarBody.querySelector("#priceDouble");

    if(hintInput){
      hintInput.addEventListener("input", () => {
        draftConfig.cards.mockup.hintText = hintInput.value;
        applyDraft();
      });
    }
      if(mockupBg){
        mockupBg.addEventListener("input", () => {
          draftConfig.cards.mockup.bg = mockupBg.value;
          applyDraft();
        });
      }
      if(mockupPanelBg){
        mockupPanelBg.addEventListener("input", () => {
          draftConfig.cards.mockup.panelBg = mockupPanelBg.value;
          applyDraft();
        });
      }
      if(mockupPreviewEmptyText){
        mockupPreviewEmptyText.addEventListener("input", () => {
          draftConfig.cards.mockup.previewEmptyTextColor = mockupPreviewEmptyText.value;
          applyDraft();
        });
      }
    if(mockupText){
      mockupText.addEventListener("input", () => {
        draftConfig.cards.mockup.text = mockupText.value;
        applyDraft();
      });
    }
    if(mockupBtnBg){
      mockupBtnBg.addEventListener("input", () => {
        draftConfig.cards.mockup.buttonBg = mockupBtnBg.value;
        applyDraft();
      });
    }
    if(mockupBtnText){
      mockupBtnText.addEventListener("input", () => {
        draftConfig.cards.mockup.buttonText = mockupBtnText.value;
        applyDraft();
      });
    }
    if(priceSingle){
      priceSingle.addEventListener("input", () => {
        draftConfig.cards.mockup.priceSingle = priceSingle.value;
        applyDraft();
      });
    }
    if(priceDouble){
      priceDouble.addEventListener("input", () => {
        draftConfig.cards.mockup.priceDouble = priceDouble.value;
        applyDraft();
      });
    }
  }

  function bindCustomerEditors(){
    const customerBg = adminSidebarBody.querySelector("#customerBg");
    const customerText = adminSidebarBody.querySelector("#customerText");
    const customerBtnBg = adminSidebarBody.querySelector("#customerBtnBg");
    const customerBtnText = adminSidebarBody.querySelector("#customerBtnText");

    if(customerBg){
      customerBg.addEventListener("input", () => {
        draftConfig.cards.customer.bg = customerBg.value;
        applyDraft();
      });
    }
    if(customerText){
      customerText.addEventListener("input", () => {
        draftConfig.cards.customer.text = customerText.value;
        applyDraft();
      });
    }
    if(customerBtnBg){
      customerBtnBg.addEventListener("input", () => {
        draftConfig.cards.customer.buttonBg = customerBtnBg.value;
        applyDraft();
      });
    }
    if(customerBtnText){
      customerBtnText.addEventListener("input", () => {
        draftConfig.cards.customer.buttonText = customerBtnText.value;
        applyDraft();
      });
    }
  }

  function bindGlobalEditors(){
    const topbarColor = adminSidebarBody.querySelector("#topbarColor");
    const pageBgColor = adminSidebarBody.querySelector("#pageBgColor");
    const editBtnBgColor = adminSidebarBody.querySelector("#editBtnBgColor");
    const editBtnTextColor = adminSidebarBody.querySelector("#editBtnTextColor");
    const actionBtnBgColor = adminSidebarBody.querySelector("#actionBtnBgColor");
    const actionBtnTextColor = adminSidebarBody.querySelector("#actionBtnTextColor");
    const popupEnabled = adminSidebarBody.querySelector("#popupEnabled");
    const popupAuto = adminSidebarBody.querySelector("#popupAuto");
    const popupTitle = adminSidebarBody.querySelector("#popupTitle");
    const popupContent = adminSidebarBody.querySelector("#popupContent");

    if(topbarColor){
      topbarColor.addEventListener("input", () => {
        draftConfig.global.topbarColor = topbarColor.value;
        applyDraft();
      });
    }
    if(pageBgColor){
      pageBgColor.addEventListener("input", () => {
        draftConfig.global.pageBg = pageBgColor.value;
        applyDraft();
      });
    }
    if(editBtnBgColor){
      editBtnBgColor.addEventListener("input", () => {
        draftConfig.global.editBtnBg = editBtnBgColor.value;
        applyDraft();
      });
    }
    if(editBtnTextColor){
      editBtnTextColor.addEventListener("input", () => {
        draftConfig.global.editBtnText = editBtnTextColor.value;
        applyDraft();
      });
    }
    if(actionBtnBgColor){
      actionBtnBgColor.addEventListener("input", () => {
        draftConfig.global.actionBtnBg = actionBtnBgColor.value;
        applyDraft();
      });
    }
    if(actionBtnTextColor){
      actionBtnTextColor.addEventListener("input", () => {
        draftConfig.global.actionBtnText = actionBtnTextColor.value;
        applyDraft();
      });
    }
    if(popupEnabled){
      popupEnabled.addEventListener("change", () => {
        draftConfig.global.popup.enabled = popupEnabled.checked;
        applyDraft();
      });
    }
    if(popupAuto){
      popupAuto.addEventListener("change", () => {
        draftConfig.global.popup.autoShow = popupAuto.checked;
        applyDraft();
      });
    }
    if(popupTitle){
      popupTitle.addEventListener("input", () => {
        draftConfig.global.popup.title = popupTitle.value;
        applyDraft();
      });
    }
    if(popupContent){
      popupContent.addEventListener("input", () => {
        draftConfig.global.popup.content = popupContent.value;
        applyDraft();
      });
    }
  }

  function insertEditButtons(){
    const targets = [
      { id: "configPanel", label: "Configuracoes", section: "config" },
      { id: "mockupPanel", label: "Mockup", section: "mockup" },
      { id: "customerPanel", label: "Dados do cliente", section: "customer" }
    ];
    targets.forEach((target) => {
      const panel = document.getElementById(target.id);
      if(!panel) return;
      const titleEl = panel.querySelector(".panelTitle");
      if(!titleEl) return;
      const row = document.createElement("div");
      row.className = "adminPanelTitleRow";
      const parent = titleEl.parentElement;
      parent.insertBefore(row, titleEl);
      row.appendChild(titleEl);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn small adminEditBtn";
      btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>Editar`;
      btn.addEventListener("click", () => {
        if(target.section === "config"){
          openSidebar("config", "Cart\u00e3o de Configura\u00e7\u00e3o");
          return;
        }
        openSidebar(target.section, `Editar ${target.label}`);
      });
      row.appendChild(btn);
    });
    const header = document.querySelector(".personalizacaoHeader");
    if(header){
      const globalBtn = document.createElement("button");
      globalBtn.type = "button";
      globalBtn.className = "btn small adminEditBtn";
      globalBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>Edi&ccedil;&otilde;es globais`;
      globalBtn.addEventListener("click", () => openSidebar("global", "Edi&ccedil;&otilde;es globais"));
      header.appendChild(globalBtn);
    }
  }

  async function loadStores(){
    const data = await apiRequest("../codigos/api/storage.php", {
      action: "get",
      keys: [STORAGE_KEY_STORES]
    });
    const raw = (data && data.data && data.data[STORAGE_KEY_STORES]) ? data.data[STORAGE_KEY_STORES] : "[]";
    try{
      storesCache = JSON.parse(raw) || [];
    }catch(err){
      storesCache = [];
    }
  }

  function findStore(){
    const key = normalizeStoreKey(STORE_ID);
    if(!key) return null;
    return storesCache.find((store) => {
      const name = normalizeStoreKey(store.name || "");
      const custom = normalizeStoreKey(store.personalizacaoId || "");
      return key === name || key === custom;
    }) || null;
  }

  async function publishConfig(){
    if(!currentStore){
      showActionPopup("Publicando...", "Loja nao encontrada.", false);
      return;
    }
    if(!draftConfig){
      showActionPopup("Publicando...", "Nenhuma configuracao para publicar.", false);
      return;
    }
    if((draftConfig.cards.config.attentionText || []).join("\n").length > ATTENTION_TEXT_MAX){
      showActionPopup("Publicando...", "Texto de atencao excede o limite.", false);
      return;
    }
    const updatedStores = storesCache.map((store) => {
      if(store !== currentStore) return store;
      return {
        ...store,
        personalizacaoConfig: clone(draftConfig),
        personalizacaoConfigDraft: null
      };
    });
    try{
      await apiRequest("../codigos/api/storage.php", {
        action: "set",
        key: STORAGE_KEY_STORES,
        value: JSON.stringify(updatedStores)
      });
      storesCache = updatedStores;
      currentStore = findStore();
      showActionPopup("Publicando...", "Alterações publicadas.", true);
    }catch(err){
      showActionPopup("Publicando...", "Falha ao publicar.", false);
    }
  }
  
  async function saveDraft(){
    if(!currentStore){
      showActionPopup("Salvando...", "Loja nao encontrada.", false);
      return;
    }
    if(!draftConfig){
      showActionPopup("Salvando...", "Nenhuma configuracao para salvar.", false);
      return;
    }
    if((draftConfig.cards.config.attentionText || []).join("\n").length > ATTENTION_TEXT_MAX){
      showActionPopup("Salvando...", "Texto de atencao excede o limite.", false);
      return;
    }
    const updatedStores = storesCache.map((store) => {
      if(store !== currentStore) return store;
      return {
        ...store,
        personalizacaoConfigDraft: clone(draftConfig)
      };
    });
    try{
      await apiRequest("../codigos/api/storage.php", {
        action: "set",
        key: STORAGE_KEY_STORES,
        value: JSON.stringify(updatedStores)
      });
      storesCache = updatedStores;
      currentStore = findStore();
      showActionPopup("Salvando...", "Alterações salvas.", true);
    }catch(err){
      showActionPopup("Salvando...", "Falha ao salvar.", false);
    }
  }

  function buildResetConfig(){
    if(!api) return null;
    const base = api.buildDefaultConfig();
    base.global.topbarColor = "";
    base.global.pageBg = "";
    base.global.dividerColor = "";
    base.global.editBtnBg = "";
    base.global.editBtnText = "";
    base.global.actionBtnBg = "";
    base.global.actionBtnText = "";
    base.global.popup = {
      enabled: false,
      autoShow: false,
      title: "",
      content: ""
    };
    base.cards.config.bg = "";
    base.cards.config.text = "";
    base.cards.config.fieldText = "";
    base.cards.config.buttonBg = "";
    base.cards.config.buttonText = "";
    base.cards.config.trashIconColor = "";
    base.cards.config.attentionTextColor = "";
    base.cards.config.attentionBgColor = "";
    base.cards.config.textFieldsEnabled = true;
    base.cards.mockup.bg = "";
    base.cards.mockup.panelBg = "";
    base.cards.mockup.text = "";
    base.cards.mockup.previewEmptyTextColor = "";
    base.cards.mockup.buttonBg = "";
    base.cards.mockup.buttonText = "";
    base.cards.mockup.priceSingle = "";
    base.cards.mockup.priceDouble = "";
    base.cards.customer.bg = "";
    base.cards.customer.text = "";
    base.cards.customer.buttonBg = "";
    base.cards.customer.buttonText = "";
    return api.normalizeConfig(base);
  }

  function resetConfig(){
    if(!api){
      showActionPopup("Resetando...", "API de configuracao indisponivel.", false);
      return;
    }
    const resetConfig = buildResetConfig();
    if(!resetConfig){
      showActionPopup("Resetando...", "Nao foi possivel resetar.", false);
      return;
    }
    draftConfig = resetConfig;
    applyDraft();
    renderSidebar(activeSection);
    showActionPopup("Resetando...", "Configurações resetadas.", true);
  }

  async function init(){
    if(!api){
      setPublishHint("API de configuracao indisponivel.", false);
      return;
    }
    try{
      await loadStores();
      currentStore = findStore();
      const base = api.buildDefaultConfig();
      const currentConfig = currentStore && (currentStore.personalizacaoConfigDraft || currentStore.personalizacaoConfig) ? (currentStore.personalizacaoConfigDraft || currentStore.personalizacaoConfig) : null;
      draftConfig = api.normalizeConfig(currentConfig || base);
      applyDraft();
      insertEditButtons();
      const form = document.getElementById("personalizacaoForm");
      if(form){
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          e.stopImmediatePropagation();
          setPublishHint("A pagina admin nao envia pedidos.", false);
        }, true);
      }
      if(adminPublishBtn){
        adminPublishBtn.addEventListener("click", publishConfig);
      }
      if(adminSaveBtn){
        adminSaveBtn.addEventListener("click", saveDraft);
      }
      if(adminResetBtn){
        adminResetBtn.addEventListener("click", resetConfig);
      }
      if(adminActionClose){
        adminActionClose.addEventListener("click", closeActionPopup);
      }
      if(adminSidebarClose){
        adminSidebarClose.addEventListener("click", closeSidebar);
      }
    }catch(err){
      setPublishHint("Falha ao carregar configuracoes.", false);
    }
  }

  init();
})();
