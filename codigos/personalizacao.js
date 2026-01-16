(() => {
  const STORE_ID = new URLSearchParams(window.location.search).get("loja") || "";
  const PREVIEW_SCALE = 0.65;
  const BACK_AREA_OFFSET_PX = -20;
  const BACK_AREA_TOP_SCREEN_PX = 120.185;
  const ATTENTION_TEXT_MAX = 240;

  const MODEL_CONFIG = {
    masculino: {
      areaTopRatio: 0.42,
      areaTopOffsetPx: 6,
      areaHeightRatio: 0.36,
      areaWidthRatio: (297 / 420) * 0.96,
      areaLeftRatio: -0.025,
      areaLeftOffsetPx: 26,
      areaWidthOffsetPx: 12,
      mockups: []
    }
  };

  const storeTopbar = document.getElementById("storeTopbar");
  const storeAlert = document.getElementById("storeAlert");
  const storeTopLogoLink = document.getElementById("storeTopLogoLink");
  const colorGroup = document.getElementById("colorGroup");
  const colorGrid = document.getElementById("colorGrid");
  const mockupUploadGroup = document.getElementById("mockupUploadGroup");
  const mockupUploadInput = document.getElementById("mockupUploadInput");
  const mockupUploadError = document.getElementById("mockupUploadError");
  const stampUploadInput = document.getElementById("stampUploadInput");
  const stampUploadError = document.getElementById("stampUploadError");
  const sizeInfo = document.getElementById("sizeInfo");
  const shirtColor = document.getElementById("shirtColor");
  const shirtSize = document.getElementById("shirtSize");
  const shirtColorError = document.getElementById("shirtColorError");
  const shirtSizeError = document.getElementById("shirtSizeError");

  const mockupStage = document.getElementById("mockupStage");
  const mockupImg = document.getElementById("mockupImg");
  const printArea = document.getElementById("printArea");
  const stampImg = document.getElementById("stampImg");
  const stampResizeHandle = document.getElementById("stampResizeHandle");
  const areaAdjustToggle = document.getElementById("areaAdjustToggle");
  const areaDebug = document.getElementById("areaDebug");
  const mockupUploadBtn = document.getElementById("mockupUploadBtn");
  const opacityToggleBtn = document.getElementById("opacityToggleBtn");
  const opacityPanel = document.getElementById("opacityPanel");
  const stampOpacityRange = document.getElementById("stampOpacityRange");
  const stampOpacityValue = document.getElementById("stampOpacityValue");
  const mockupSideToggleBtn = document.getElementById("mockupSideToggleBtn");
  const mockupSideLabel = document.getElementById("mockupSideLabel");
  const mockupPreviewFront = document.getElementById("mockupPreviewFront");
  const mockupPreviewBack = document.getElementById("mockupPreviewBack");
  const mockupPreviewFrontEmpty = document.getElementById("mockupPreviewFrontEmpty");
  const mockupPreviewBackEmpty = document.getElementById("mockupPreviewBackEmpty");
  const mockupSidePreviews = document.getElementById("mockupSidePreviews");
  const stampClearBtn = document.getElementById("stampClearBtn");
  const stampChooseBtn = document.getElementById("stampChooseBtn");
  const stampFileName = document.getElementById("stampFileName");
  const customTextInput = document.getElementById("customTextInput");
  const customTextFont = document.getElementById("customTextFont");
  const customTextColorPicker = document.getElementById("customTextColorPicker");
  const customTextSize = document.getElementById("customTextSize");
  const customTextFontUpload = document.getElementById("customTextFontUpload");
  const customFontChooseBtn = document.getElementById("customFontChooseBtn");
  const customFontFileName = document.getElementById("customFontFileName");
  const customFontClearBtn = document.getElementById("customFontClearBtn");
  const customFontError = document.getElementById("customFontError");
  const stampText = document.getElementById("stampText");
  const priceValue = document.getElementById("priceValue");
  const mockupPriceNote = document.getElementById("mockupPriceNote");
  const mockupHint = document.getElementById("mockupHint");
  const configPanel = document.getElementById("configPanel");
  const mockupPanel = document.getElementById("mockupPanel");
  const customerPanel = document.getElementById("customerPanel");
  const attentionBox = document.getElementById("attentionBox");
  const attentionList = document.getElementById("attentionList");
  const customTextBlock = document.getElementById("customTextBlock");
  const customFontBlock = document.getElementById("customFontBlock");
  const configDividerTextBefore = document.getElementById("configDividerTextBefore");
  const configDividerTextAfter = document.getElementById("configDividerTextAfter");
  const customPopupOverlay = document.getElementById("personalizacaoCustomPopupOverlay");
  const customPopupTitle = document.getElementById("personalizacaoCustomPopupTitle");
  const customPopupBody = document.getElementById("personalizacaoCustomPopupBody");
  const customPopupClose = document.getElementById("personalizacaoCustomPopupClose");
  const areaHandles = Array.from(document.querySelectorAll("[data-area-handle]"));
  const sectionDividers = Array.from(document.querySelectorAll(".sectionDivider"));

  const form = document.getElementById("personalizacaoForm");
  const submitBtn = document.getElementById("submitPersonalizacaoBtn");
  const formMessage = document.getElementById("formMessage");
  const sendProgress = document.getElementById("sendProgress");
  const sendProgressBar = document.getElementById("sendProgressBar");
  const sendProgressText = document.getElementById("sendProgressText");
  const storeBackBtn = document.getElementById("storeBackBtn");
  const storeTopLogoImg = document.getElementById("storeTopLogoImg");
  const storeTopSocials = document.getElementById("storeTopSocials");
  const colorMismatchOverlay = document.getElementById("colorMismatchOverlay");
  const colorMismatchClose = document.getElementById("colorMismatchClose");
  const successOverlay = document.getElementById("personalizacaoSuccessOverlay");
  const successCloseBtn = document.getElementById("personalizacaoSuccessClose");
  const successWhatsappBtn = document.getElementById("personalizacaoSuccessWhatsapp");

  const customerName = document.getElementById("customerName");
  const customerEmail = document.getElementById("customerEmail");
  const customerPhone = document.getElementById("customerPhone");
  const customerNotes = document.getElementById("customerNotes");
  const customerNameError = document.getElementById("customerNameError");
  const customerEmailError = document.getElementById("customerEmailError");
  const customerPhoneError = document.getElementById("customerPhoneError");
  const customerNotesError = document.getElementById("customerNotesError");
  let personalizacaoConfig = null;

  function createSideState(){
    return {
      model: "masculino",
      color: "",
      colorName: "",
      colorCss: "",
      mockupFile: null,
      mockupFileUrl: "",
      mockupSource: "",
      mockupDisplaySrc: "",
      stampFile: null,
      stampFileName: "Vazio",
      stampSrc: "",
      stampAspect: 1,
      stampReady: false,
      stampOpacity: 1,
      customText: "",
      customTextColor: "#000000",
      customTextFont: "Arial",
      customTextSize: 32,
      customFontFile: null,
      customFontFileName: "Vazio",
      customFontLabel: "",
      areaCustom: false,
      areaKey: "",
      areaAdjustMode: true,
      areaLocked: true,
      areaW: MODEL_CONFIG.masculino.areaW,
      areaH: MODEL_CONFIG.masculino.areaH,
      areaX: 0,
      areaY: 0,
      mockupW: 0,
      mockupH: 0,
      mockupScale: 1,
      stamp: { x: 0, y: 0, w: 0, h: 0 }
    };
  }

  const sideStates = {
    front: createSideState(),
    back: createSideState()
  };
  let activeSide = "front";
  let state = sideStates[activeSide];
  const sidePreviewUrls = { front: "", back: "" };
  let previewTimer = null;
  let storeInfo = null;
  let sendProgressTimer = null;
  let sendProgressValue = 0;

  function showStoreMessage(message){
    if(!storeAlert) return;
    storeAlert.textContent = message || "";
    storeAlert.style.display = message ? "block" : "none";
  }

  function setTopLogo(logoUrl, name){
    if(!storeTopLogoImg) return;
    if(logoUrl){
      storeTopLogoImg.src = logoUrl;
      storeTopLogoImg.alt = name ? name : "Logo da loja";
      storeTopLogoImg.style.display = "block";
    }else{
      storeTopLogoImg.removeAttribute("src");
      storeTopLogoImg.style.display = "none";
    }
  }
  function setTopLogoLink(url){
    if(!storeTopLogoLink) return;
    const link = (url || "").toString().trim();
    if(link){
      storeTopLogoLink.href = link;
      storeTopLogoLink.style.display = "inline-flex";
    }else{
      storeTopLogoLink.href = "#";
      storeTopLogoLink.style.display = "none";
    }
  }

  function buildSocialButtons(){
    if(!storeTopSocials){
      return;
    }
    if(!storeInfo){
      storeTopSocials.innerHTML = "";
      return;
    }
    const items = [];
    const normalizeSocialKey = (value) => (value || "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    const getSocialIconBase = (label) => {
      const key = normalizeSocialKey(label);
      if(key === "instagram") return "instagram";
      if(key === "facebook") return "facebook";
      if(key === "tiktok") return "tik-tok";
      if(key === "youtube") return "youtube";
      if(key === "pinterest") return "pinterest";
      if(key === "twitter") return "twitter";
      return "";
    };
    const getTopbarLuminance = () => {
      if(!storeTopbar) return null;
      const raw = getComputedStyle(storeTopbar).backgroundColor || "";
      const match = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if(!match) return null;
      const r = Number(match[1]);
      const g = Number(match[2]);
      const b = Number(match[3]);
      if(Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    const applyTopbarContrast = () => {
      const luminance = getTopbarLuminance();
      if(typeof luminance !== "number") return;
      if(storeBackBtn){
        storeBackBtn.style.color = luminance >= 0.6 ? "#111111" : "#ffffff";
      }
    };
    const getTopbarIconVariant = () => {
      const luminance = getTopbarLuminance();
      return typeof luminance === "number" && luminance >= 0.6 ? "preto" : "branco";
    };
    const addItem = (label, url) => {
      const link = (url || "").toString().trim();
      if(!link) return;
      const iconBase = getSocialIconBase(label);
      if(!iconBase) return;
      items.push({ label, url: link, iconBase });
    };
    applyTopbarContrast();
    addItem("Instagram", storeInfo.instagram_url);
    addItem("Facebook", storeInfo.facebook_url);
    addItem("TikTok", storeInfo.tiktok_url);
    addItem("YouTube", storeInfo.youtube_url);
    addItem("Pinterest", storeInfo.pinterest_url);
    if(Array.isArray(storeInfo.social_extras)){
      storeInfo.social_extras.forEach((extra) => {
        const label = (extra && extra.name) ? extra.name.toString().trim() : "";
        const url = (extra && (extra.profile_url || extra.profileUrl)) ? (extra.profile_url || extra.profileUrl).toString().trim() : "";
        if(label && url){
          addItem(label, url);
        }
      });
    }
    if(!items.length){
      storeTopSocials.innerHTML = "";
      return;
    }
    const iconVariant = getTopbarIconVariant();
    storeTopSocials.innerHTML = items.map((item) => {
      const iconSrc = `/FlowDesk/imagens/app/icones/${item.iconBase}-${iconVariant}.png`;
      return `<a class="topbarSocialBtn" href="${item.url}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(item.label)}">
        <img class="topbarSocialIcon" src="${iconSrc}" alt="${escapeHtml(item.label)}" loading="lazy" />
      </a>`;
    }).join("");
  }
  async function loadStoreInfo(){
    if(!STORE_ID){
      showStoreMessage("Identificador da loja nao informado. Verifique o link de personalizacao.");
      return;
    }
    try{
      const response = await fetch(`../codigos/api/store_public.php?loja=${encodeURIComponent(STORE_ID)}`, {
        method: "GET"
      });
      const data = await response.json().catch(() => ({}));
      if(!response.ok || !data.ok || !data.store){
        showStoreMessage("Nao localizamos a loja. Verifique o link de personalizacao.");
        return;
      }
      storeInfo = data.store;
      setTopLogo(storeInfo.logo_url, storeInfo.name);
      setTopLogoLink(storeInfo.site_url);
      buildSocialButtons();
      if(storeInfo.personalizacao_config){
        let parsedConfig = storeInfo.personalizacao_config;
        if(typeof parsedConfig === "string"){
          try{
            parsedConfig = JSON.parse(parsedConfig);
          }catch(e){
            parsedConfig = null;
          }
        }
        applyConfigToUI(parsedConfig);
      }else{
        applyConfigToUI(null);
      }
      if(storeBackBtn){
        const link = storeInfo.site_url || "";
        if(link){
          storeBackBtn.href = link;
          storeBackBtn.style.display = "inline-flex";
        }else{
          storeBackBtn.style.display = "none";
        }
      }
    }catch(err){
      showStoreMessage("Nao localizamos a loja. Verifique o link de personalizacao.");
    }
  }
  loadStoreInfo();

  if(customTextFont && customTextFont.value){
    state.customTextFont = customTextFont.value;
  }
  if(customTextColorPicker && customTextColorPicker.value){
    state.customTextColor = customTextColorPicker.value;
  }
  if(customTextSize && customTextSize.value){
    state.customTextSize = clampTextSize(customTextSize.value, 12, 80);
    customTextSize.value = String(state.customTextSize);
  }
  if(customTextInput && customTextInput.value){
    state.customText = customTextInput.value.slice(0, 18);
    if(customTextInput.value !== state.customText){
      customTextInput.value = state.customText;
    }
  }

  function getSideLabel(side){
    return side === "back" ? "Costas" : "Frente";
  }

  function updateSideToggleLabel(){
    if(mockupSideLabel){
      mockupSideLabel.textContent = getSideLabel(activeSide);
    }
    if(mockupSideToggleBtn){
      mockupSideToggleBtn.textContent = activeSide === "front" ? "Costas da camiseta" : "Frente da camiseta";
    }
  }

  function updatePreviewForSide(side, url){
    const imgEl = side === "back" ? mockupPreviewBack : mockupPreviewFront;
    const emptyEl = side === "back" ? mockupPreviewBackEmpty : mockupPreviewFrontEmpty;
    const holder = imgEl ? imgEl.closest(".mockupSidePreview") : null;
    if(sidePreviewUrls[side]){
      URL.revokeObjectURL(sidePreviewUrls[side]);
      sidePreviewUrls[side] = "";
    }
    if(imgEl && url){
      imgEl.src = url;
      sidePreviewUrls[side] = url;
      if(holder) holder.classList.add("hasPreview");
      if(emptyEl) emptyEl.style.display = "none";
      return;
    }
    if(imgEl){
      imgEl.removeAttribute("src");
    }
    if(holder) holder.classList.remove("hasPreview");
    if(emptyEl) emptyEl.style.display = "block";
  }

  function schedulePreviewUpdate(){
    if(previewTimer){
      clearTimeout(previewTimer);
      previewTimer = null;
    }
    previewTimer = setTimeout(async () => {
      const hasStamp = state.stampReady && state.stampSrc;
      const hasText = (state.customText || "").trim().length > 0;
      if(!state.mockupW || !state.mockupH || !stampImg || (!hasStamp && !hasText)){
        updatePreviewForSide(activeSide, "");
        return;
      }
      const blob = await buildPreviewBlob(PREVIEW_SCALE);
      if(!blob){
        updatePreviewForSide(activeSide, "");
        return;
      }
      const url = URL.createObjectURL(blob);
      updatePreviewForSide(activeSide, url);
    }, 220);
  }

  function applyStateToUI(){
    updateSideToggleLabel();
    if(customTextInput){
      customTextInput.value = state.customText || "";
    }
    if(customTextFont){
      customTextFont.value = state.customTextFont || "Arial";
    }
    if(customTextColorPicker){
      customTextColorPicker.value = state.customTextColor || "#000000";
    }
    if(customTextSize){
      customTextSize.value = String(state.customTextSize || 32);
    }
    if(customFontFileName){
      customFontFileName.value = state.customFontFileName || "Vazio";
    }
    if(stampOpacityRange){
      stampOpacityRange.value = String(Math.round(state.stampOpacity * 100));
    }
    if(stampOpacityValue){
      stampOpacityValue.textContent = `${Math.round(state.stampOpacity * 100)}%`;
    }
    if(stampFileName){
      stampFileName.value = state.stampFileName || "Vazio";
    }
    updateShirtColorSelect();
    if(stampImg){
      if(state.stampSrc){
        stampImg.src = state.stampSrc;
        stampImg.style.display = "block";
      }else{
        stampImg.removeAttribute("src");
        stampImg.style.display = "none";
      }
    }
    if(stampResizeHandle){
      stampResizeHandle.style.display = state.stampReady ? "block" : "none";
    }
    setStampClearEnabled(!!state.stampFile);
    updateStampTextPreview();
    updatePrintAreaPosition();
  }

  async function setActiveSide(side){
    if(side !== "front" && side !== "back") return;
    if(side === activeSide) return;
    activeSide = side;
    state = sideStates[activeSide];
    applyStateToUI();
    await applyMockupForCurrentSide();
  }

  function toLabel(value){
    const raw = (value || "").toString().replace(/-/g, " ");
    return raw.replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function setError(el, message){
    if(!el) return;
    if(message){
      el.textContent = message;
      el.style.display = "block";
    }else{
      el.textContent = "";
      el.style.display = "none";
    }
  }

  function escapeHtml(value){
    return (value || "").toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setFormMessage(message, ok){
    if(!formMessage) return;
    formMessage.textContent = message || "";
    formMessage.style.color = ok ? "#1b7f4a" : "#d64545";
  }

  function getDefaultColors(){
    if(!shirtColor) return [];
    const options = Array.from(shirtColor.querySelectorAll("option"));
    return options
      .map((opt) => ({
        name: (opt.value || "").toString(),
        hex: (opt.dataset.hex || "").toString(),
        enabled: opt.value !== ""
      }))
      .filter((item) => item.name);
  }

  function getDefaultSizes(){
    if(!shirtSize) return [];
    const options = Array.from(shirtSize.querySelectorAll("option"));
    return options
      .map((opt) => (opt.value || "").toString())
      .filter((value) => value && value !== "Selecione");
  }

  function getDefaultAttention(){
    if(!attentionList) return [];
    return Array.from(attentionList.querySelectorAll("li"))
      .map((li) => (li.textContent || "").trim())
      .filter(Boolean);
  }

  function buildDefaultConfig(){
    return {
      version: 1,
      global: {
        topbarColor: (storeTopbar && storeTopbar.style.backgroundColor) || "",
        pageBg: "",
        dividerColor: "",
        editBtnBg: "",
        editBtnText: "",
        actionBtnBg: "",
        actionBtnText: "",
        popup: {
          enabled: false,
          autoShow: false,
          title: "",
          content: ""
        }
      },
      cards: {
          config: {
            bg: "",
            text: "",
            fieldText: "",
            buttonBg: "",
            buttonText: "",
            trashIconColor: "",
            attentionTextColor: "",
            attentionBgColor: "",
            textFieldsEnabled: true,
            colors: getDefaultColors(),
            sizes: getDefaultSizes(),
            attentionText: getDefaultAttention()
        },
          mockup: {
            hintText: (mockupHint && mockupHint.textContent) ? mockupHint.textContent.trim() : "",
            bg: "",
            panelBg: "",
            text: "",
            previewEmptyTextColor: "",
            buttonBg: "",
            buttonText: "",
            priceSingle: "",
            priceDouble: ""
        },
        customer: {
          bg: "",
          text: "",
          buttonBg: "",
          buttonText: ""
        }
      }
    };
  }

  function mergeConfig(base, incoming){
    if(!incoming || typeof incoming !== "object") return base;
    const out = JSON.parse(JSON.stringify(base));
    const merge = (target, src) => {
      Object.keys(src || {}).forEach((key) => {
        if(src[key] && typeof src[key] === "object" && !Array.isArray(src[key])){
          if(!target[key] || typeof target[key] !== "object") target[key] = {};
          merge(target[key], src[key]);
        }else{
          target[key] = src[key];
        }
      });
    };
    merge(out, incoming);
    return out;
  }

  function normalizeConfig(incoming){
    const base = buildDefaultConfig();
    const next = mergeConfig(base, incoming);
    if(!Array.isArray(next.cards.config.colors)) next.cards.config.colors = base.cards.config.colors;
    if(!Array.isArray(next.cards.config.sizes)) next.cards.config.sizes = base.cards.config.sizes;
    if(!Array.isArray(next.cards.config.attentionText)) next.cards.config.attentionText = base.cards.config.attentionText;
    return next;
  }

  function applyConfigToUI(config){
    const cfg = normalizeConfig(config);
    personalizacaoConfig = cfg;

    if(storeTopbar && cfg.global.topbarColor){
      storeTopbar.style.background = cfg.global.topbarColor;
      buildSocialButtons();
    }
    if(cfg.global.pageBg){
      document.body.style.background = cfg.global.pageBg;
    }else{
      document.body.style.removeProperty("background");
    }
    if(document.body.classList.contains("adminBody")){
      const editButtons = document.querySelectorAll(".adminEditBtn");
      editButtons.forEach((btn) => {
        if(cfg.global.editBtnBg){
          btn.style.background = cfg.global.editBtnBg;
          btn.style.borderColor = cfg.global.editBtnBg;
        }else{
          btn.style.removeProperty("background");
          btn.style.removeProperty("border-color");
        }
        if(cfg.global.editBtnText){
          btn.style.color = cfg.global.editBtnText;
        }else{
          btn.style.removeProperty("color");
        }
      });
      const actionButtons = document.querySelectorAll("#adminPublishBtn, #adminSaveBtn, #adminResetBtn");
      actionButtons.forEach((btn) => {
        if(cfg.global.actionBtnBg){
          btn.style.background = cfg.global.actionBtnBg;
          btn.style.borderColor = cfg.global.actionBtnBg;
        }else{
          btn.style.removeProperty("background");
          btn.style.removeProperty("border-color");
        }
        if(cfg.global.actionBtnText){
          btn.style.color = cfg.global.actionBtnText;
        }else{
          btn.style.removeProperty("color");
        }
      });
    }
    if(sectionDividers.length && cfg.global.dividerColor){
      sectionDividers.forEach((divider) => {
        divider.style.background = cfg.global.dividerColor;
      });
    }

      if(configPanel){
        if(cfg.cards.config.bg){
          configPanel.style.background = cfg.cards.config.bg;
        }else{
          configPanel.style.removeProperty("background");
        }
        if(cfg.cards.config.text){
          configPanel.style.color = cfg.cards.config.text;
          configPanel.style.setProperty("--config-text-color", cfg.cards.config.text);
        }else{
          configPanel.style.removeProperty("color");
          configPanel.style.removeProperty("--config-text-color");
        }
        if(cfg.cards.config.fieldText){
          configPanel.style.setProperty("--config-field-text-color", cfg.cards.config.fieldText);
        }else{
          configPanel.style.removeProperty("--config-field-text-color");
        }
        const cfgButtons = configPanel.querySelectorAll(".btn, .iconBtn");
        cfgButtons.forEach((btn) => {
          if(btn.classList.contains("adminEditBtn")) return;
          if(cfg.cards.config.buttonBg){
            btn.style.background = cfg.cards.config.buttonBg;
            btn.style.borderColor = cfg.cards.config.buttonBg;
          }else{
            btn.style.removeProperty("background");
            btn.style.removeProperty("border-color");
          }
          if(cfg.cards.config.buttonText){
            btn.style.color = cfg.cards.config.buttonText;
          }else{
            btn.style.removeProperty("color");
          }
        });
        if(cfg.cards.config.trashIconColor){
          configPanel.style.setProperty("--trash-icon-color", cfg.cards.config.trashIconColor);
        }else{
          configPanel.style.removeProperty("--trash-icon-color");
        }
      }
    if(customTextBlock){
      customTextBlock.style.display = cfg.cards.config.textFieldsEnabled ? "" : "none";
    }
    if(customFontBlock){
      customFontBlock.style.display = cfg.cards.config.textFieldsEnabled ? "" : "none";
    }
    if(configDividerTextBefore){
      configDividerTextBefore.style.display = cfg.cards.config.textFieldsEnabled ? "" : "none";
    }
    if(configDividerTextAfter){
      configDividerTextAfter.style.display = "";
    }
      if(attentionList){
        attentionList.innerHTML = (cfg.cards.config.attentionText || [])
          .map((text) => `<li>${escapeHtml(text)}</li>`)
          .join("");
      }
      if(attentionBox){
        const attentionTargets = attentionBox.querySelectorAll(".warningTitle, .sizeInfo, ul, li");
        if(cfg.cards.config.attentionTextColor){
          attentionBox.style.color = cfg.cards.config.attentionTextColor;
          attentionBox.style.setProperty("--muted", cfg.cards.config.attentionTextColor);
          attentionTargets.forEach((el) => {
            el.style.color = cfg.cards.config.attentionTextColor;
          });
          if(attentionList) attentionList.style.color = cfg.cards.config.attentionTextColor;
        }else if(cfg.cards.config.text){
          attentionBox.style.color = cfg.cards.config.text;
          attentionBox.style.removeProperty("--muted");
          attentionTargets.forEach((el) => {
            el.style.color = cfg.cards.config.text;
          });
          if(attentionList) attentionList.style.color = cfg.cards.config.text;
        }else{
          attentionBox.style.removeProperty("color");
          attentionBox.style.removeProperty("--muted");
          attentionTargets.forEach((el) => {
            el.style.removeProperty("color");
          });
          if(attentionList) attentionList.style.removeProperty("color");
        }
        if(cfg.cards.config.attentionBgColor){
          attentionBox.style.background = cfg.cards.config.attentionBgColor;
        }else{
          attentionBox.style.removeProperty("background");
        }
      }

    if(shirtColor){
      const enabledColors = (cfg.cards.config.colors || []).filter(c => c && c.enabled);
      const options = ['<option value="">Selecione</option>'].concat(
        enabledColors.map(c => `<option value="${escapeHtml(c.name)}" data-hex="${escapeHtml(c.hex || "")}">${escapeHtml(c.name)}</option>`)
      );
      shirtColor.innerHTML = options.join("");
    }
    if(shirtSize){
      const sizes = (cfg.cards.config.sizes || []).filter(Boolean);
      const options = ['<option value="">Selecione</option>'].concat(
        sizes.map(size => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`)
      );
      shirtSize.innerHTML = options.join("");
    }

    if(mockupPanel){
      if(cfg.cards.mockup.text){
        mockupPanel.style.color = cfg.cards.mockup.text;
      }else{
        mockupPanel.style.removeProperty("color");
      }
      if(cfg.cards.mockup.panelBg){
        mockupPanel.style.background = cfg.cards.mockup.panelBg;
      }else{
        mockupPanel.style.removeProperty("background");
      }
    }
    if(mockupHint && cfg.cards.mockup.hintText){
      mockupHint.textContent = cfg.cards.mockup.hintText;
    }
    if(mockupHint){
      if(cfg.cards.mockup.text){
        mockupHint.style.color = cfg.cards.mockup.text;
      }else{
        mockupHint.style.removeProperty("color");
      }
    }
    if(mockupSideLabel){
      if(cfg.cards.mockup.text){
        mockupSideLabel.style.color = cfg.cards.mockup.text;
      }else{
        mockupSideLabel.style.removeProperty("color");
      }
    }
    if(mockupPriceNote){
      if(cfg.cards.mockup.text){
        mockupPriceNote.style.color = cfg.cards.mockup.text;
      }else{
        mockupPriceNote.style.removeProperty("color");
      }
    }
    if(mockupStage && cfg.cards.mockup.bg){
      mockupStage.closest(".mockupStageWrap")?.setAttribute("style", `background:${cfg.cards.mockup.bg}; border-color:${cfg.cards.mockup.bg};`);
    }else if(mockupStage){
      const wrap = mockupStage.closest(".mockupStageWrap");
      if(wrap) wrap.removeAttribute("style");
    }
    if(mockupSidePreviews && cfg.cards.mockup.bg){
      mockupSidePreviews.querySelectorAll(".mockupSidePreview").forEach((el) => {
        el.style.background = cfg.cards.mockup.bg;
        el.style.borderColor = cfg.cards.mockup.bg;
      });
    }else if(mockupSidePreviews){
      mockupSidePreviews.querySelectorAll(".mockupSidePreview").forEach((el) => {
        el.style.removeProperty("background");
        el.style.removeProperty("border-color");
      });
    }
    if(cfg.cards.mockup.previewEmptyTextColor){
      if(mockupPreviewFrontEmpty) mockupPreviewFrontEmpty.style.color = cfg.cards.mockup.previewEmptyTextColor;
      if(mockupPreviewBackEmpty) mockupPreviewBackEmpty.style.color = cfg.cards.mockup.previewEmptyTextColor;
      if(mockupSidePreviews){
        mockupSidePreviews.querySelectorAll(".mockupSideTitle").forEach((title) => {
          title.style.color = cfg.cards.mockup.previewEmptyTextColor;
        });
      }
    }else{
      if(mockupPreviewFrontEmpty) mockupPreviewFrontEmpty.style.removeProperty("color");
      if(mockupPreviewBackEmpty) mockupPreviewBackEmpty.style.removeProperty("color");
      if(mockupSidePreviews){
        mockupSidePreviews.querySelectorAll(".mockupSideTitle").forEach((title) => {
          title.style.removeProperty("color");
        });
      }
    }
      if(mockupPanel){
        const buttons = mockupPanel.querySelectorAll(".btn");
        buttons.forEach((btn) => {
          if(btn.classList.contains("adminEditBtn")) return;
          if(cfg.cards.mockup.buttonBg) btn.style.background = cfg.cards.mockup.buttonBg;
          if(cfg.cards.mockup.buttonText) btn.style.color = cfg.cards.mockup.buttonText;
          if(cfg.cards.mockup.buttonBg) btn.style.borderColor = cfg.cards.mockup.buttonBg;
        });
      }

    if(customerPanel){
      if(cfg.cards.customer.bg){
        customerPanel.style.background = cfg.cards.customer.bg;
      }else{
        customerPanel.style.removeProperty("background");
      }
      if(cfg.cards.customer.text){
        customerPanel.style.color = cfg.cards.customer.text;
        customerPanel.style.setProperty("--customer-text-color", cfg.cards.customer.text);
      }else{
        customerPanel.style.removeProperty("color");
        customerPanel.style.removeProperty("--customer-text-color");
      }
    }
    if(submitBtn){
      if(cfg.cards.customer.buttonBg) submitBtn.style.background = cfg.cards.customer.buttonBg;
      if(cfg.cards.customer.buttonText) submitBtn.style.color = cfg.cards.customer.buttonText;
      if(cfg.cards.customer.buttonBg) submitBtn.style.borderColor = cfg.cards.customer.buttonBg;
    }

    if(customPopupOverlay){
      const popupCfg = cfg.global.popup || {};
      if(customPopupTitle) customPopupTitle.textContent = popupCfg.title || "Aviso";
      if(customPopupBody) customPopupBody.textContent = popupCfg.content || "";
      if(popupCfg.enabled){
        customPopupOverlay.style.display = popupCfg.autoShow ? "flex" : "none";
      }else{
        customPopupOverlay.style.display = "none";
      }
    }
    updatePriceInfo();
  }

  function sideHasContent(targetState){
    return Boolean(targetState.stampFile) || ((targetState.customText || "").trim().length > 0);
  }

  function updatePriceInfo(){
    if(!priceValue || !mockupPriceNote) return;
    const cfg = personalizacaoConfig ? normalizeConfig(personalizacaoConfig) : buildDefaultConfig();
    const priceSingle = (cfg.cards.mockup.priceSingle || "").toString().trim();
    const priceDouble = (cfg.cards.mockup.priceDouble || "").toString().trim();
    if(!priceSingle && !priceDouble){
      mockupPriceNote.style.display = "none";
      return;
    }
    const hasFront = sideHasContent(sideStates.front);
    const hasBack = sideHasContent(sideStates.back);
    const next = (hasFront && hasBack) ? (priceDouble || priceSingle) : priceSingle;
    if(!next){
      mockupPriceNote.style.display = "none";
      return;
    }
    mockupPriceNote.style.display = "";
    priceValue.textContent = next;
  }

  function updateShirtColorSelect(){
    if(!shirtColor) return;
    const targetName = state.colorName;
    if(!targetName) return;
    const options = Array.from(shirtColor.options);
    const match = options.find((opt) => normalizeColorName(opt.value) === targetName);
    if(match && shirtColor.value !== match.value){
      shirtColor.value = match.value;
    }
  }

  function showColorMismatch(){
    if(!colorMismatchOverlay) return;
    colorMismatchOverlay.style.display = "flex";
  }

  function hideColorMismatch(){
    if(!colorMismatchOverlay) return;
    colorMismatchOverlay.style.display = "none";
  }

  function focusInvalidField(el){
    if(!el) return;
    if(typeof el.scrollIntoView === "function"){
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if(typeof el.focus === "function"){
      el.focus({ preventScroll: true });
    }
  }

  function setSendProgress(value, label){
    if(sendProgressBar){
      sendProgressBar.style.width = `${Math.max(0, Math.min(100, value))}%`;
    }
    if(sendProgressText && label){
      sendProgressText.textContent = label;
    }
  }
  function startSendProgress(){
    if(!sendProgress) return;
    sendProgress.style.display = "flex";
    sendProgressValue = 0;
    setSendProgress(0, "Enviando...");
    if(sendProgressTimer){
      clearInterval(sendProgressTimer);
      sendProgressTimer = null;
    }
    sendProgressTimer = setInterval(() => {
      const remaining = 90 - sendProgressValue;
      if(remaining <= 0){
        setSendProgress(90);
        return;
      }
      sendProgressValue += Math.max(0.6, remaining * 0.08);
      if(sendProgressValue > 90) sendProgressValue = 90;
      setSendProgress(sendProgressValue);
    }, 180);
  }
  function finishSendProgress(){
    if(sendProgressTimer){
      clearInterval(sendProgressTimer);
      sendProgressTimer = null;
    }
    setSendProgress(100, "Enviado");
    if(sendProgress){
      setTimeout(() => {
        sendProgress.style.display = "none";
        setSendProgress(0);
      }, 350);
    }
  }
  function failSendProgress(){
    if(sendProgressTimer){
      clearInterval(sendProgressTimer);
      sendProgressTimer = null;
    }
    if(sendProgress){
      sendProgress.style.display = "none";
    }
    setSendProgress(0);
  }

  function openSuccessPopup(){
    if(!successOverlay) return;
    if(successWhatsappBtn){
      const url = (storeInfo && storeInfo.whatsapp_link) ? storeInfo.whatsapp_link : "";
      if(url){
        successWhatsappBtn.href = url;
        successWhatsappBtn.style.display = "inline-flex";
      }else{
        successWhatsappBtn.href = "#";
        successWhatsappBtn.style.display = "none";
      }
    }
    successOverlay.style.display = "flex";
  }
  function closeSuccessPopup(){
    if(!successOverlay) return;
    successOverlay.style.display = "none";
  }
  if(successCloseBtn){
    successCloseBtn.addEventListener("click", closeSuccessPopup);
  }
  if(successOverlay){
    successOverlay.addEventListener("click", (e)=>{
      if(e.target !== successOverlay) return;
      closeSuccessPopup();
    });
  }

  function updateSizeInfo(){
    if(!sizeInfo) return;
    sizeInfo.innerHTML = "";
  }

  function getMockupKey(){
    if(state.model === "proprio"){
      if(state.mockupFile && state.mockupFile.name) return state.mockupFile.name;
      if(state.mockupSource) return state.mockupSource;
      return "mockup-personalizado";
    }
    if(state.model === "masculino"){
      return "tint";
    }
    if(state.color) return `${state.color}.png`;
    return "";
  }

  function getAreaStorageKey(){
    const suffix = getMockupKey();
    if(!suffix) return "";
    return `area_${activeSide}_${state.model}_${suffix}`;
  }

  function getAreaPercent(){
    if(!state.mockupW || !state.mockupH) return null;
    return {
      x: state.areaX / state.mockupW,
      y: state.areaY / state.mockupH,
      w: state.areaW / state.mockupW,
      h: state.areaH / state.mockupH
    };
  }

  function updateAreaDebug(){
    if(!areaDebug) return;
    const pct = getAreaPercent();
    if(!pct){
      areaDebug.textContent = "";
      return;
    }
    const x = (pct.x * 100).toFixed(2);
    const y = (pct.y * 100).toFixed(2);
    const w = (pct.w * 100).toFixed(2);
    const h = (pct.h * 100).toFixed(2);
    areaDebug.textContent = `Area: ${x}%, ${y}%, ${w}%, ${h}%`;
  }

  function getStampPercentInArea(){
    if(!state.mockupScale || !state.areaW || !state.areaH) return null;
    const stampX = state.stamp.x / state.mockupScale;
    const stampY = state.stamp.y / state.mockupScale;
    const stampW = state.stamp.w / state.mockupScale;
    const stampH = state.stamp.h / state.mockupScale;
    return {
      x: stampX / state.areaW,
      y: stampY / state.areaH,
      w: stampW / state.areaW,
      h: stampH / state.areaH
    };
  }

  function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function loadImage(src){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`load_error:${src}`));
      img.src = src;
    });
  }

  function waitForImageLoad(img){
    return new Promise((resolve) => {
      if(!img){
        resolve();
        return;
      }
      if(img.complete && img.naturalWidth){
        resolve();
        return;
      }
      const onLoad = () => {
        img.removeEventListener("load", onLoad);
        resolve();
      };
      img.addEventListener("load", onLoad);
    });
  }

  let maleMapCache = null;

  async function getMaleMapData(){
    if(maleMapCache) return maleMapCache;
    const displacementSrc = "../imagens/app/masculino/displacement.png";
    const maskSrc = "../imagens/app/masculino/mascara.png";
    let dispImg;
    let maskImg;
    try{
      [dispImg, maskImg] = await Promise.all([loadImage(displacementSrc), loadImage(maskSrc)]);
    }catch(err){
      maleMapCache = null;
      return null;
    }
    const dispCanvas = document.createElement("canvas");
    dispCanvas.width = dispImg.naturalWidth || dispImg.width;
    dispCanvas.height = dispImg.naturalHeight || dispImg.height;
    const dispCtx = dispCanvas.getContext("2d");
    dispCtx.drawImage(dispImg, 0, 0, dispCanvas.width, dispCanvas.height);
    const dispData = dispCtx.getImageData(0, 0, dispCanvas.width, dispCanvas.height);

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = maskImg.naturalWidth || maskImg.width;
    maskCanvas.height = maskImg.naturalHeight || maskImg.height;
    const maskCtx = maskCanvas.getContext("2d");
    maskCtx.drawImage(maskImg, 0, 0, maskCanvas.width, maskCanvas.height);
    const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);

    maleMapCache = {
      dispData,
      maskData,
      width: dispCanvas.width,
      height: dispCanvas.height
    };
    return maleMapCache;
  }

  function drawStampWithDisplacement(ctx, mockupW, mockupH, areaRect, stampRect, opacity){
    if(!maleMapCache) return false;
    const mapW = maleMapCache.width;
    const mapH = maleMapCache.height;
    if(!mapW || !mapH) return false;

    const areaW = Math.max(1, Math.round(areaRect.w));
    const areaH = Math.max(1, Math.round(areaRect.h));

    const stampCanvas = document.createElement("canvas");
    stampCanvas.width = areaW;
    stampCanvas.height = areaH;
    const stampCtx = stampCanvas.getContext("2d");
    if(!stampCtx) return false;
    stampCtx.clearRect(0, 0, areaW, areaH);
    stampCtx.globalAlpha = opacity;
    stampCtx.drawImage(
      stampImg,
      Math.round(stampRect.x - areaRect.x),
      Math.round(stampRect.y - areaRect.y),
      Math.round(stampRect.w),
      Math.round(stampRect.h)
    );

    const stampData = stampCtx.getImageData(0, 0, areaW, areaH);
    const outData = stampCtx.createImageData(areaW, areaH);
    const baseData = ctx.getImageData(Math.round(areaRect.x), Math.round(areaRect.y), areaW, areaH).data;
    const disp = maleMapCache.dispData.data;
    const mask = maleMapCache.maskData.data;
    const dispScaleX = mapW / mockupW;
    const dispScaleY = mapH / mockupH;
    const strengthX = Math.max(10, Math.round(areaW * 0.03));
    const strengthY = Math.max(14, Math.round(areaH * 0.04));
    const shadeStrength = 0.4;

    for(let y = 0; y < areaH; y++){
      const mapY = Math.max(0, Math.min(mapH - 1, Math.round((areaRect.y + y) * dispScaleY)));
      for(let x = 0; x < areaW; x++){
        const mapX = Math.max(0, Math.min(mapW - 1, Math.round((areaRect.x + x) * dispScaleX)));
        const mapIdx = (mapY * mapW + mapX) * 4;
        const gray = (disp[mapIdx] + disp[mapIdx + 1] + disp[mapIdx + 2]) / 3;
        const offset = (gray - 128) / 128;
        const srcX = Math.max(0, Math.min(areaW - 1, Math.round(x + offset * strengthX)));
        const srcY = Math.max(0, Math.min(areaH - 1, Math.round(y + offset * strengthY)));
        const srcIdx = (srcY * areaW + srcX) * 4;
        const dstIdx = (y * areaW + x) * 4;
        const alphaMask = mask[mapIdx + 3] / 255;
        const baseIdx = (y * areaW + x) * 4;
        const baseLum = (baseData[baseIdx] + baseData[baseIdx + 1] + baseData[baseIdx + 2]) / 3 / 255;
        const shade = (1 - (offset * shadeStrength)) * (0.75 + baseLum * 0.35);
        outData.data[dstIdx] = Math.min(255, Math.max(0, stampData.data[srcIdx] * shade));
        outData.data[dstIdx + 1] = Math.min(255, Math.max(0, stampData.data[srcIdx + 1] * shade));
        outData.data[dstIdx + 2] = Math.min(255, Math.max(0, stampData.data[srcIdx + 2] * shade));
        outData.data[dstIdx + 3] = Math.round(stampData.data[srcIdx + 3] * alphaMask);
      }
    }

    stampCtx.putImageData(outData, 0, 0);
    ctx.drawImage(stampCanvas, Math.round(areaRect.x), Math.round(areaRect.y));
    return true;
  }

  function clampAreaRect(x, y, w, h){
    const minW = 1;
    const minH = 1;
    const maxW = state.mockupW;
    const maxH = state.mockupH;
    let nextW = Math.max(minW, Math.min(w, maxW));
    let nextH = Math.max(minH, Math.min(h, maxH));
    let nextX = Math.max(0, Math.min(x, state.mockupW - nextW));
    let nextY = Math.max(0, Math.min(y, state.mockupH - nextH));
    return { x: nextX, y: nextY, w: nextW, h: nextH };
  }

  function clampAreaPosition(x, y){
    let nextX = Math.max(0, Math.min(x, state.mockupW - state.areaW));
    let nextY = Math.max(0, Math.min(y, state.mockupH - state.areaH));
    return { x: nextX, y: nextY };
  }

  function getBackAreaOffsetPx(){
    if(activeSide !== "back") return 0;
    const scale = state.mockupScale || 1;
    return Math.round(BACK_AREA_OFFSET_PX / scale);
  }

  function saveAreaToStorage(){
    const key = getAreaStorageKey();
    const pct = getAreaPercent();
    if(!key || !pct) return;
    localStorage.setItem(key, JSON.stringify(pct));
    state.areaCustom = true;
    state.areaKey = key;
    updateAreaDebug();
  }

  function loadAreaFromStorage(){
    const key = getAreaStorageKey();
    if(!key || !state.mockupW || !state.mockupH) return false;
    state.areaKey = key;
    const raw = localStorage.getItem(key);
    if(!raw) return false;
    try{
      const data = JSON.parse(raw);
      if(!data || !isFinite(data.x) || !isFinite(data.y) || !isFinite(data.w) || !isFinite(data.h)){
        return false;
      }
      let rect = clampAreaRect(
        Math.round(state.mockupW * data.x),
        Math.round(state.mockupH * data.y),
        Math.round(state.mockupW * data.w),
        Math.round(state.mockupH * data.h)
      );
      const backOffset = getBackAreaOffsetPx();
      if(backOffset){
        rect = clampAreaRect(rect.x, rect.y + backOffset, rect.w, rect.h);
      }
      state.areaX = rect.x;
      state.areaY = rect.y;
      state.areaW = rect.w;
      state.areaH = rect.h;
      state.areaCustom = true;
      updatePrintAreaPosition();
      updateAreaDebug();
      return true;
    }catch(e){
      return false;
    }
  }

  function setDefaultArea(info){
    const ratioTop = Number.isFinite(info.areaTopRatio) ? info.areaTopRatio : 0.3;
    const ratioH = Number.isFinite(info.areaHeightRatio) ? info.areaHeightRatio : 0.38;
    let topOffset = Number.isFinite(info.areaTopOffsetPx) ? info.areaTopOffsetPx : 0;
    const targetH = Math.round(state.mockupH * ratioH);
    let targetW = 750;
    let widthRatio = Number.isFinite(info.areaWidthRatio) ? info.areaWidthRatio : null;
    if(activeSide === "back" && widthRatio){
      widthRatio *= 1.15;
      topOffset -= 8;
    }
    if(widthRatio){
      targetW = Math.round(targetH * widthRatio);
    }else if(Number.isFinite(info.areaW)){
      targetW = info.areaW;
    }
    if(Number.isFinite(info.areaWidthOffsetPx)){
      targetW = Math.max(1, targetW + info.areaWidthOffsetPx);
    }
    const ratioLeft = Number.isFinite(info.areaLeftRatio) ? info.areaLeftRatio : 0;
    const leftOffset = Number.isFinite(info.areaLeftOffsetPx) ? info.areaLeftOffsetPx : 0;
    let rect = clampAreaRect(
      Math.round((state.mockupW - targetW) / 2 + (state.mockupW * ratioLeft) + leftOffset),
      Math.round(state.mockupH * ratioTop + topOffset),
      Math.round(Math.min(targetW, state.mockupW)),
      Math.round(targetH)
    );
    const backOffset = getBackAreaOffsetPx();
    if(backOffset){
      rect = clampAreaRect(rect.x, rect.y + backOffset, rect.w, rect.h);
    }
    state.areaX = rect.x;
    state.areaY = rect.y;
    state.areaW = rect.w;
    state.areaH = rect.h;
    state.areaCustom = false;
    updatePrintAreaPosition();
    updateAreaDebug();
  }

  function setAreaAdjustMode(next){
    if(state.areaLocked){
      next = false;
    }
    state.areaAdjustMode = next;
    if(printArea){
      printArea.classList.toggle("isAdjusting", next);
      if(state.areaLocked){
        printArea.classList.remove("isHidden");
      }else{
        printArea.classList.toggle("isHidden", !next);
      }
    }
    if(areaAdjustToggle){
      areaAdjustToggle.classList.toggle("active", next);
      if(state.areaLocked){
        areaAdjustToggle.textContent = "Area fixa";
        areaAdjustToggle.disabled = true;
      }else{
        areaAdjustToggle.textContent = next ? "Travar area" : "Ajustar area";
        areaAdjustToggle.disabled = false;
      }
    }
    if(!next){
      saveAreaToStorage();
    }
  }

  function renderColors(){
    if(!colorGrid) return;
    colorGrid.innerHTML = "";
  }


  function parseColorInput(value){
    const raw = (value || "").toString().trim();
    if(!raw) return null;
    let r = 0;
    let g = 0;
    let b = 0;
    if(raw.startsWith("#")){
      const hex = raw.replace("#", "");
      if(hex.length === 3){
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      }else if(hex.length === 6){
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }else{
        return null;
      }
    }else if(raw.toLowerCase().startsWith("rgb")){
      const nums = raw.replace(/[^\d,]/g, "").split(",").map((n) => parseInt(n, 10));
      if(nums.length < 3) return null;
      [r, g, b] = nums;
    }else if(raw.includes(",")){
      const nums = raw.split(",").map((n) => parseInt(n, 10));
      if(nums.length < 3) return null;
      [r, g, b] = nums;
    }else{
      return null;
    }
    if([r, g, b].some((v) => Number.isNaN(v))) return null;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    return { hex, css: `rgb(${r}, ${g}, ${b})` };
  }

  function normalizeColorName(value){
    const raw = (value || "").toString().trim().toLowerCase();
    if(!raw) return "";
    const noAccents = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const slug = noAccents.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const normalized = slug === "rosa-bebe" ? "rosa" : slug;
    return normalized.replace(/-costas$/, "");
  }

  function getSelectedShirtHex(){
    if(!shirtColor) return null;
    const opt = shirtColor.options[shirtColor.selectedIndex];
    if(!opt) return null;
    const hex = opt.getAttribute("data-hex");
    return hex ? hex.toLowerCase() : null;
  }

  function getSideMockupBase(){
    if(state.model !== "masculino") return "";
    if(activeSide === "back"){
      const colorName = normalizeColorName(state.colorName) || "branco";
      const fileName = colorName === "branco" ? "branco-costas.png" : `${colorName}.png`;
      return `../imagens/app/masculino/${fileName}`;
    }
    return "../imagens/app/masculino/branco.png";
  }

  async function applyTintedMockup(){
    if(state.model !== "masculino" || !state.colorCss) return;
    const baseSrc = getSideMockupBase();
    if(!baseSrc) return;
    if(activeSide === "back"){
      setMockupImage(baseSrc);
      const colorName = normalizeColorName(state.colorName) || "branco";
      state.mockupSource = colorName === "branco" ? "masculino/branco-costas.png" : `masculino/${colorName}.png`;
      state.mockupFile = null;
      state.mockupDisplaySrc = baseSrc;
      return;
    }
    const maskSrc = "../imagens/app/masculino/mascara.png";
    let baseImg;
    let maskImg;
    try{
      [baseImg, maskImg] = await Promise.all([loadImage(baseSrc), loadImage(maskSrc)]);
    }catch(err){
      try{
        [baseImg, maskImg] = await Promise.all([
          loadImage("../imagens/app/masculino/branco.png"),
          loadImage(maskSrc)
        ]);
      }catch(errFallback){
        setMockupImage("");
        return;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = baseImg.naturalWidth || baseImg.width;
    canvas.height = baseImg.naturalHeight || baseImg.height;
    const ctx = canvas.getContext("2d");
    if(!ctx) return;
    ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

    const tintCanvas = document.createElement("canvas");
    tintCanvas.width = canvas.width;
    tintCanvas.height = canvas.height;
    const tintCtx = tintCanvas.getContext("2d");
    if(!tintCtx) return;
    tintCtx.fillStyle = state.colorCss;
    tintCtx.fillRect(0, 0, tintCanvas.width, tintCanvas.height);
    tintCtx.globalCompositeOperation = "destination-in";
    tintCtx.drawImage(maskImg, 0, 0, tintCanvas.width, tintCanvas.height);
    tintCtx.globalCompositeOperation = "source-over";

    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.85;
    ctx.drawImage(tintCanvas, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = canvas.width;
    shadowCanvas.height = canvas.height;
    const shadowCtx = shadowCanvas.getContext("2d");
    shadowCtx.drawImage(baseImg, 0, 0, shadowCanvas.width, shadowCanvas.height);
    shadowCtx.globalCompositeOperation = "color";
    shadowCtx.fillStyle = state.colorCss;
    shadowCtx.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
    shadowCtx.globalCompositeOperation = "destination-in";
    shadowCtx.drawImage(maskImg, 0, 0, shadowCanvas.width, shadowCanvas.height);

    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.55;
    ctx.drawImage(shadowCanvas, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    const dataUrl = canvas.toDataURL("image/png");
    setMockupImage(dataUrl);
    state.mockupSource = "masculino/branco.png";
    state.mockupFile = null;
    state.mockupDisplaySrc = dataUrl;
  }

  async function setColor(color){
    if(state.model === "masculino"){
      const hex = getSelectedShirtHex() || color;
      const parsed = parseColorInput(hex);
      if(!parsed) return;
      const colorName = normalizeColorName(shirtColor ? shirtColor.value : color);
      const targets = activeSide === "back" ? [sideStates.back] : [sideStates.front, sideStates.back];
      targets.forEach((target) => {
        target.color = parsed.hex;
        target.colorName = colorName;
        target.colorCss = parsed.css;
      });
      renderColors();
      await applyTintedMockup();
      return;
    }
    const targets = activeSide === "back" ? [sideStates.back] : [sideStates.front, sideStates.back];
    targets.forEach((target) => {
      target.color = color;
      target.colorName = normalizeColorName(color);
      target.areaCustom = false;
      target.areaKey = "";
    });
    renderColors();
    if(state.model === "feminino"){
      const src = `../imagens/app/${state.model}/${color}.png`;
      state.mockupSource = `${state.model}/${color}.png`;
      state.mockupFile = null;
      state.mockupDisplaySrc = src;
      setMockupImage(src);
    }
  }

  function setModel(model){
    Object.values(sideStates).forEach((target) => {
      target.model = model;
      target.color = "";
      target.colorName = "";
      target.colorCss = "";
      target.mockupFile = null;
      target.mockupFileUrl = "";
      target.mockupSource = "";
      target.mockupDisplaySrc = "";
      target.areaCustom = false;
      target.areaKey = "";
    });
    if(mockupUploadBtn && model === "proprio"){
      mockupUploadBtn.classList.add("active");
    }else if(mockupUploadBtn){
      mockupUploadBtn.classList.remove("active");
    }
    if(model === "proprio"){
      if(colorGroup) colorGroup.style.display = "none";
      if(mockupUploadGroup) mockupUploadGroup.style.display = "block";
      setMockupImage("");
    }else{
      if(colorGroup) colorGroup.style.display = "block";
      if(mockupUploadGroup) mockupUploadGroup.style.display = "none";
      if(shirtColor && !shirtColor.value){
        shirtColor.value = "Branco";
      }
      const info = MODEL_CONFIG[model];
      if(model === "masculino"){
        const defaultHex = getSelectedShirtHex() || "#ffffff";
        void setColor(defaultHex);
      }else if(info && info.mockups.length){
        void setColor(info.mockups[0]);
      }
    }
    updateSizeInfo();
  }

  function setMockupImage(src){
    if(!mockupImg) return;
    if(!src){
      mockupImg.removeAttribute("src");
      mockupImg.style.display = "none";
      return;
    }
    mockupImg.style.display = "block";
    mockupImg.src = src;
    state.mockupDisplaySrc = src;
  }

  async function applyMockupForCurrentSide(){
    if(state.model === "proprio"){
      if(state.mockupFileUrl){
        setMockupImage(state.mockupFileUrl);
        return;
      }
      if(state.mockupFile){
        state.mockupFileUrl = URL.createObjectURL(state.mockupFile);
        setMockupImage(state.mockupFileUrl);
        return;
      }
      setMockupImage("");
      return;
    }
    if(state.model === "masculino"){
      if(state.colorCss){
        await applyTintedMockup();
        return;
      }
      const baseSrc = getSideMockupBase();
      if(baseSrc){
        if(activeSide === "back"){
          const colorName = normalizeColorName(state.colorName) || "branco";
          state.mockupSource = colorName === "branco" ? "masculino/branco-costas.png" : `masculino/${colorName}.png`;
        }else{
          state.mockupSource = "masculino/branco.png";
        }
        setMockupImage(baseSrc);
      }
      return;
    }
    if(state.model === "feminino" && state.color){
      const src = `../imagens/app/${state.model}/${state.color}.png`;
      state.mockupSource = `${state.model}/${state.color}.png`;
      setMockupImage(src);
    }
  }

  function updatePrintAreaPosition(){
    if(!printArea) return;
    const scale = state.mockupScale || 1;
    printArea.style.width = `${state.areaW * scale}px`;
    printArea.style.height = `${state.areaH * scale}px`;
    printArea.style.left = `${state.areaX * scale}px`;
    let topPx = state.areaY * scale;
    if(activeSide === "back"){
      topPx = BACK_AREA_TOP_SCREEN_PX;
      state.areaY = topPx / scale;
    }
    printArea.style.top = `${topPx}px`;
    updateAreaDebug();
    updateStampTextPreview();
    schedulePreviewUpdate();
  }

  function updateStageLayout(){
    if(!mockupImg || !mockupStage || !printArea) return;
    const naturalW = mockupImg.naturalWidth || 0;
    const naturalH = mockupImg.naturalHeight || 0;
    if(!naturalW || !naturalH) return;

    state.mockupW = naturalW;
    state.mockupH = naturalH;

    const container = mockupStage.parentElement;
    const containerWidth = container ? container.clientWidth : 400;
    const displayWidth = Math.min(containerWidth, 520);
    const scale = displayWidth / naturalW;
    const displayHeight = naturalH * scale;

    state.mockupScale = scale;
    mockupStage.style.width = `${displayWidth}px`;
    mockupStage.style.height = `${displayHeight}px`;

    const info = MODEL_CONFIG[state.model] || { areaW: 750, areaTopRatio: 0.3, areaHeightRatio: 0.38 };
    if(state.areaCustom){
      updatePrintAreaPosition();
    }else{
      const loaded = loadAreaFromStorage();
      if(!loaded){
        setDefaultArea(info);
      }
    }

    if(state.stampReady && (!state.stamp.w || !state.stamp.h)){
      initStampPlacement();
      return;
    }
    if(stampImg && stampImg.src){
      clampStamp();
      updateStampPosition();
    }
    updateSizeInfo();
  }

  function updateStampPosition(){
    if(!stampImg) return;
    stampImg.style.display = "block";
    stampImg.style.width = `${state.stamp.w}px`;
    stampImg.style.height = `${state.stamp.h}px`;
    stampImg.style.left = `${state.stamp.x}px`;
    stampImg.style.top = `${state.stamp.y}px`;
    stampImg.style.opacity = String(state.stampOpacity);
    if(stampResizeHandle){
      stampResizeHandle.style.display = "block";
    }
  }

  const textMeasureCtx = document.createElement("canvas").getContext("2d");

  function fitTextSize(text, fontFamily, maxWidth, maxSize, minSize){
    if(!textMeasureCtx) return minSize;
    let size = maxSize;
    textMeasureCtx.font = `${size}px ${fontFamily}`;
    while(size > minSize && textMeasureCtx.measureText(text).width > maxWidth){
      size -= 2;
      textMeasureCtx.font = `${size}px ${fontFamily}`;
    }
    return Math.max(minSize, size);
  }

  function clampTextSize(value, minSize, maxSize){
    const parsed = Number(value) || minSize;
    return Math.max(minSize, Math.min(parsed, maxSize));
  }

  function updateStampTextPreview(){
    if(!stampText || !printArea) return;
    const text = (state.customText || "").slice(0, 18);
      if(!text){
        stampText.textContent = "";
        stampText.style.display = "none";
        schedulePreviewUpdate();
        updatePriceInfo();
        return;
      }
    const scale = state.mockupScale || 1;
    const maxWidth = Math.max(40, state.areaW * scale * 0.8);
    const maxSize = Math.max(14, state.areaH * scale * 0.2);
    const minSize = 12;
    const chosenSize = clampTextSize(state.customTextSize, minSize, 80);
    const textLines = text.split(/\r?\n/);
    const longestLine = textLines.reduce((acc, line) => (line.length > acc.length ? line : acc), "");
    const fontSize = fitTextSize(longestLine || text, state.customTextFont, maxWidth, Math.min(maxSize, chosenSize), minSize);
    stampText.textContent = text;
    stampText.style.display = "block";
    stampText.style.fontFamily = state.customTextFont;
    stampText.style.fontSize = `${fontSize}px`;
    stampText.style.color = state.customTextColor;
    schedulePreviewUpdate();
    updatePriceInfo();
  }

  function drawCustomText(ctx, areaX, areaY, areaW, areaH){
    const text = (state.customText || "").slice(0, 18);
    if(!text) return;
    const maxWidth = Math.max(40, areaW * 0.8);
    const maxSize = Math.max(14, areaH * 0.2);
    const minSize = 12;
    const chosenSize = clampTextSize(state.customTextSize, minSize, 80);
    const textLines = text.split(/\r?\n/);
    const longestLine = textLines.reduce((acc, line) => (line.length > acc.length ? line : acc), "");
    const fontSize = fitTextSize(longestLine || text, state.customTextFont, maxWidth, Math.min(maxSize, chosenSize), minSize);
    ctx.save();
    ctx.fillStyle = state.customTextColor;
    ctx.font = `${fontSize}px ${state.customTextFont}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const x = areaX + (areaW * 0.5);
    const y = areaY + (areaH * 0.28);
    const lineHeight = fontSize * 1.15;
    const totalHeight = lineHeight * textLines.length;
    let startY = y - (totalHeight / 2) + (lineHeight / 2);
    textLines.forEach((line, idx) => {
      ctx.fillText(line, x, startY + (idx * lineHeight), maxWidth);
    });
    ctx.restore();
  }

  function clampStamp(){
    const maxW = state.areaW * state.mockupScale;
    const maxH = state.areaH * state.mockupScale;
    state.stamp.w = Math.min(state.stamp.w, maxW);
    state.stamp.h = Math.min(state.stamp.h, maxH);
    state.stamp.x = Math.max(0, Math.min(state.stamp.x, maxW - state.stamp.w));
    state.stamp.y = Math.max(0, Math.min(state.stamp.y, maxH - state.stamp.h));
  }

  function initStampPlacement(){
    const maxW = state.areaW * state.mockupScale;
    const maxH = state.areaH * state.mockupScale;
    let width = maxW * 0.6;
    let height = width * state.stampAspect;
    if(height > maxH){
      height = maxH * 0.6;
      width = height / state.stampAspect;
    }
    state.stamp.w = Math.max(40, width);
    state.stamp.h = Math.max(40, height);
    state.stamp.x = (maxW - state.stamp.w) / 2;
    state.stamp.y = (maxH - state.stamp.h) / 2;
    updateStampPosition();
  }

  let dragState = null;
  let areaDragState = null;
  let areaResizeState = null;

  function setStampClearEnabled(enabled){
    if(!stampClearBtn) return;
    stampClearBtn.disabled = !enabled;
    stampClearBtn.classList.toggle("isDisabled", !enabled);
  }

  function resetStamp(targetState = state){
    const targetSide = targetState === sideStates.back ? "back" : "front";
    targetState.stampFile = null;
    targetState.stampFileName = "Vazio";
    targetState.stampSrc = "";
    targetState.stampReady = false;
    targetState.stampAspect = 1;
    targetState.stampOpacity = 1;
    targetState.stamp = { x: 0, y: 0, w: 0, h: 0 };
    if(targetState === state){
      if(stampImg){
        stampImg.removeAttribute("src");
        stampImg.style.display = "none";
        stampImg.style.opacity = "1";
      }
      if(stampResizeHandle){
        stampResizeHandle.style.display = "none";
      }
      if(stampUploadInput){
        stampUploadInput.value = "";
      }
      if(stampFileName){
        stampFileName.value = "Vazio";
      }
      if(stampOpacityRange){
        stampOpacityRange.value = "100";
      }
      if(stampOpacityValue){
        stampOpacityValue.textContent = "100%";
      }
      setStampClearEnabled(false);
      updatePreviewForSide(activeSide, "");
    }
    if(targetState !== state){
      updatePreviewForSide(targetSide, "");
    }
    updatePriceInfo();
  }

  function loadStampFile(file, targetState = state){
    if(!file){
      resetStamp(targetState);
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if(!allowed.includes(file.type)){
      setError(stampUploadError, "Formato invalido. Use PNG, JPG, JPEG ou WEBP.");
      resetStamp(targetState);
      return;
    }
    if(file.size > 15 * 1024 * 1024){
      setError(stampUploadError, "Arquivo maior que 15 MB.");
      resetStamp(targetState);
      return;
    }
    targetState.stampFile = file;
    targetState.stampFileName = file.name || "Vazio";
    targetState.stampReady = false;
    const url = URL.createObjectURL(file);
    targetState.stampSrc = url;
    loadImage(url).then((img) => {
      targetState.stampAspect = img.naturalHeight / img.naturalWidth || 1;
      targetState.stampReady = true;
      if(targetState === state && state.mockupW && state.mockupH){
        initStampPlacement();
        schedulePreviewUpdate();
      }
    }).catch(() => {
      resetStamp(targetState);
    });
    if(targetState === state){
      setStampClearEnabled(true);
      if(stampImg){
        stampImg.src = url;
      }
      if(stampFileName){
        stampFileName.value = targetState.stampFileName;
      }
    }
    updatePriceInfo();
  }

  async function loadCustomFont(file){
    if(!file || !customTextFont) return;
    const name = file.name.replace(/\.[^.]+$/, "") || "Fonte personalizada";
    const fontName = `Fonte_${Date.now()}`;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const formatMap = {
      ttf: "truetype",
      otf: "opentype",
      woff: "woff",
      woff2: "woff2"
    };
    const formatHint = formatMap[ext] ? ` format("${formatMap[ext]}")` : "";
    const fontUrl = URL.createObjectURL(file);
    try{
      const fontFace = new FontFace(fontName, `url(${fontUrl})${formatHint}`);
      await fontFace.load();
      document.fonts.add(fontFace);
      const option = document.createElement("option");
      option.value = fontName;
      option.textContent = name;
      customTextFont.appendChild(option);
      customTextFont.value = fontName;
      state.customTextFont = fontName;
      state.customFontFile = file;
      state.customFontFileName = file.name || "Vazio";
      state.customFontLabel = name;
      if(customFontClearBtn){
        customFontClearBtn.disabled = false;
        customFontClearBtn.classList.remove("isDisabled");
      }
      if(customFontFileName){
        customFontFileName.value = file.name || "Vazio";
      }
      setError(customFontError, "");
      updateStampTextPreview();
    }catch(e){
      setError(customFontError, "Nao foi possivel carregar a fonte.");
    }finally{
      URL.revokeObjectURL(fontUrl);
      if(customTextFontUpload){
        customTextFontUpload.value = "";
      }
    }
  }

  function clearCustomFont(){
    if(customTextFont){
      const selected = customTextFont.value;
      const option = customTextFont.querySelector(`option[value="${selected}"]`);
      if(option && !["Arial", "Georgia", "Times New Roman", "Verdana"].includes(selected)){
        option.remove();
      }
      customTextFont.value = "Arial";
    }
    state.customTextFont = "Arial";
    state.customFontFile = null;
    state.customFontFileName = "Vazio";
    state.customFontLabel = "";
    if(customFontFileName){
      customFontFileName.value = "Vazio";
    }
    setError(customFontError, "");
    if(customFontClearBtn){
      customFontClearBtn.disabled = true;
      customFontClearBtn.classList.add("isDisabled");
    }
    updateStampTextPreview();
  }

  function applyStampOpacity(value){
    const pct = Math.max(10, Math.min(100, Number(value) || 100));
    state.stampOpacity = pct / 100;
    if(stampImg){
      stampImg.style.opacity = String(state.stampOpacity);
    }
    if(stampOpacityValue){
      stampOpacityValue.textContent = `${pct}%`;
    }
    schedulePreviewUpdate();
  }

  function startDrag(e, mode){
    if(!stampImg.src) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    dragState = {
      mode,
      startX,
      startY,
      origX: state.stamp.x,
      origY: state.stamp.y,
      origW: state.stamp.w,
      origH: state.stamp.h
    };
    if(stampImg.setPointerCapture){
      stampImg.setPointerCapture(e.pointerId);
    }
  }

  function startAreaDrag(e){
    if(state.areaLocked) return;
    if(!state.areaAdjustMode) return;
    if(!printArea || !mockupImg) return;
    if(e.target === stampImg || e.target === stampResizeHandle) return;
    e.preventDefault();
    areaDragState = {
      startX: e.clientX,
      startY: e.clientY,
      origX: state.areaX,
      origY: state.areaY
    };
    if(printArea.setPointerCapture){
      printArea.setPointerCapture(e.pointerId);
    }
  }

  function startAreaResize(e, handle){
    if(state.areaLocked) return;
    if(!state.areaAdjustMode) return;
    if(!printArea || !mockupImg) return;
    e.preventDefault();
    areaResizeState = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: state.areaX,
      origY: state.areaY,
      origW: state.areaW,
      origH: state.areaH
    };
    if(printArea.setPointerCapture){
      printArea.setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e){
    if(dragState){
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const maxW = state.areaW * state.mockupScale;
      const maxH = state.areaH * state.mockupScale;
      if(dragState.mode === "drag"){
        state.stamp.x = dragState.origX + dx;
        state.stamp.y = dragState.origY + dy;
        clampStamp();
        updateStampPosition();
        return;
      }
      if(dragState.mode === "resize"){
        let newW = dragState.origW + dx;
        newW = Math.max(40, Math.min(newW, maxW));
        let newH = newW * state.stampAspect;
        if(newH > maxH){
          newH = maxH;
          newW = newH / state.stampAspect;
        }
        state.stamp.w = newW;
        state.stamp.h = newH;
        state.stamp.x = Math.min(state.stamp.x, maxW - state.stamp.w);
        state.stamp.y = Math.min(state.stamp.y, maxH - state.stamp.h);
        updateStampPosition();
        return;
      }
    }
    if(areaDragState){
      const dx = e.clientX - areaDragState.startX;
      const dy = e.clientY - areaDragState.startY;
      const scale = state.mockupScale || 1;
      const pos = clampAreaPosition(
        areaDragState.origX + (dx / scale),
        areaDragState.origY + (dy / scale)
      );
      state.areaX = pos.x;
      state.areaY = pos.y;
      state.areaCustom = true;
      updatePrintAreaPosition();
      if(stampImg && stampImg.src){
        clampStamp();
        updateStampPosition();
      }
    }
    if(areaResizeState){
      const dx = (e.clientX - areaResizeState.startX) / (state.mockupScale || 1);
      const dy = (e.clientY - areaResizeState.startY) / (state.mockupScale || 1);
      let nextX = areaResizeState.origX;
      let nextY = areaResizeState.origY;
      let nextW = areaResizeState.origW;
      let nextH = areaResizeState.origH;
      if(areaResizeState.handle === "nw"){
        nextX = areaResizeState.origX + dx;
        nextY = areaResizeState.origY + dy;
        nextW = areaResizeState.origW - dx;
        nextH = areaResizeState.origH - dy;
      }else if(areaResizeState.handle === "ne"){
        nextY = areaResizeState.origY + dy;
        nextW = areaResizeState.origW + dx;
        nextH = areaResizeState.origH - dy;
      }else if(areaResizeState.handle === "n"){
        nextY = areaResizeState.origY + dy;
        nextH = areaResizeState.origH - dy;
      }else if(areaResizeState.handle === "sw"){
        nextX = areaResizeState.origX + dx;
        nextW = areaResizeState.origW - dx;
        nextH = areaResizeState.origH + dy;
      }else if(areaResizeState.handle === "se"){
        nextW = areaResizeState.origW + dx;
        nextH = areaResizeState.origH + dy;
      }else if(areaResizeState.handle === "s"){
        nextH = areaResizeState.origH + dy;
      }
      const rect = clampAreaRect(nextX, nextY, nextW, nextH);
      state.areaX = rect.x;
      state.areaY = rect.y;
      state.areaW = rect.w;
      state.areaH = rect.h;
      state.areaCustom = true;
      updatePrintAreaPosition();
      if(stampImg && stampImg.src){
        clampStamp();
        updateStampPosition();
      }
    }
  }

  function stopDrag(){
    dragState = null;
    areaDragState = null;
    areaResizeState = null;
    schedulePreviewUpdate();
  }

  async function buildPreviewBlob(scale = 1){
    const previewScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(state.mockupW * previewScale));
    canvas.height = Math.max(1, Math.round(state.mockupH * previewScale));
    const ctx = canvas.getContext("2d");
    if(!ctx) return null;
    ctx.drawImage(mockupImg, 0, 0, canvas.width, canvas.height);

    const hasStamp = state.stampReady && state.stampSrc;
    if(hasStamp){
      const stampX = Math.round((state.areaX + (state.stamp.x / state.mockupScale)) * previewScale);
      const stampY = Math.round((state.areaY + (state.stamp.y / state.mockupScale)) * previewScale);
      const stampW = Math.round((state.stamp.w / state.mockupScale) * previewScale);
      const stampH = Math.round((state.stamp.h / state.mockupScale) * previewScale);

      let drawn = false;
      if(previewScale === 1 && state.model === "masculino" && !state.mockupFile && activeSide === "front"){
        try{
          await getMaleMapData();
          drawn = drawStampWithDisplacement(
            ctx,
            state.mockupW,
            state.mockupH,
            { x: state.areaX, y: state.areaY, w: state.areaW, h: state.areaH },
            { x: stampX, y: stampY, w: stampW, h: stampH },
            state.stampOpacity
          );
        }catch(e){
          drawn = false;
        }
      }
      if(!drawn){
        ctx.globalAlpha = state.stampOpacity;
        ctx.drawImage(stampImg, stampX, stampY, stampW, stampH);
        ctx.globalAlpha = 1;
      }
    }
    drawCustomText(
      ctx,
      Math.round(state.areaX * previewScale),
      Math.round(state.areaY * previewScale),
      Math.round(state.areaW * previewScale),
      Math.round(state.areaH * previewScale)
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  async function buildCompositeBlobForMockup(img){
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if(!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const areaPct = getAreaPercent();
    if(!areaPct) return null;
    const hasStamp = state.stampReady && state.stampSrc;
    const stampPct = hasStamp ? getStampPercentInArea() : null;
    if(hasStamp && !stampPct) return null;

    const areaX = Math.round(canvas.width * areaPct.x);
    const areaY = Math.round(canvas.height * areaPct.y);
    const areaW = Math.round(canvas.width * areaPct.w);
    const areaH = Math.round(canvas.height * areaPct.h);
    if(hasStamp){
      const stampX = Math.round(areaX + (areaW * stampPct.x));
      const stampY = Math.round(areaY + (areaH * stampPct.y));
      const stampW = Math.round(areaW * stampPct.w);
      const stampH = Math.round(areaH * stampPct.h);

      let drawn = false;
      if(state.model === "masculino" && !state.mockupFile && activeSide === "front"){
        try{
          await getMaleMapData();
          drawn = drawStampWithDisplacement(
            ctx,
            canvas.width,
            canvas.height,
            { x: areaX, y: areaY, w: areaW, h: areaH },
            { x: stampX, y: stampY, w: stampW, h: stampH },
            state.stampOpacity
          );
        }catch(e){
          drawn = false;
        }
      }
      if(!drawn){
        ctx.globalAlpha = state.stampOpacity;
        ctx.drawImage(stampImg, stampX, stampY, stampW, stampH);
        ctx.globalAlpha = 1;
      }
    }
    drawCustomText(ctx, areaX, areaY, areaW, areaH);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  function validateForm(){
    let ok = true;
    let firstInvalid = null;
    setError(customerNameError, "");
    setError(customerEmailError, "");
    setError(customerPhoneError, "");
    setError(customerNotesError, "");
    setFormMessage("");

    if(!customerName.value.trim()){
      setError(customerNameError, "Informe seu nome.");
      ok = false;
      if(!firstInvalid) firstInvalid = customerName;
    }
    if(!customerEmail.value.trim()){
      setError(customerEmailError, "Informe seu e-mail.");
      ok = false;
      if(!firstInvalid) firstInvalid = customerEmail;
    }else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.value.trim())){
      setError(customerEmailError, "E-mail invalido.");
      ok = false;
      if(!firstInvalid) firstInvalid = customerEmail;
    }
    if(!customerPhone.value.trim()){
      setError(customerPhoneError, "Informe seu telefone.");
      ok = false;
      if(!firstInvalid) firstInvalid = customerPhone;
    }else{
      const digits = customerPhone.value.replace(/\D+/g, "");
      if(digits.length < 10){
        setError(customerPhoneError, "Telefone invalido.");
        ok = false;
        if(!firstInvalid) firstInvalid = customerPhone;
      }
    }
    if(!customerNotes.value.trim()){
      setError(customerNotesError, "Informe as observacoes.");
      ok = false;
      if(!firstInvalid) firstInvalid = customerNotes;
    }
    if(!shirtColor || !shirtColor.value.trim()){
      setError(shirtColorError, "Selecione a cor.");
      ok = false;
      if(!firstInvalid) firstInvalid = shirtColor;
    }
    if(!shirtSize || !shirtSize.value.trim()){
      setError(shirtSizeError, "Selecione o tamanho.");
      ok = false;
      if(!firstInvalid) firstInvalid = shirtSize;
    }
    if(!ok && firstInvalid){
      focusInvalidField(firstInvalid);
    }
    return ok;
  }

  async function handleSubmit(e){
    e.preventDefault();
    if(!STORE_ID){
      setFormMessage("Identificador da loja nao informado.", false);
      return;
    }
    if(!validateForm()) return;
    const frontColor = sideStates.front.colorName || "";
    const backColor = sideStates.back.colorName || "";
    const backHasContent = !!sideStates.back.stampFile || (sideStates.back.customText || "").trim().length > 0;
    if(backHasContent && frontColor && backColor && frontColor !== backColor){
      showColorMismatch();
      return;
    }
    const originalSide = activeSide;
    await setActiveSide("front");
    if(!state.model){
      setError(mockupUploadError, "Selecione o modelo.");
      await setActiveSide(originalSide);
      return;
    }
    if(state.model !== "proprio" && !state.color){
      setError(shirtColorError, "Selecione a cor da camiseta.");
      focusInvalidField(shirtColor);
      await setActiveSide(originalSide);
      return;
    }
    if(state.model === "proprio" && !state.mockupFile){
      setError(mockupUploadError, "Envie o mockup personalizado.");
      focusInvalidField(mockupUploadBtn || mockupUploadInput);
      await setActiveSide(originalSide);
      return;
    }
    if(state.model === "proprio"){
      const key = getAreaStorageKey();
      const saved = key ? localStorage.getItem(key) : null;
      if(!saved){
        setError(mockupUploadError, "Ajuste a area de impressao antes de enviar.");
        focusInvalidField(printArea);
        await setActiveSide(originalSide);
        return;
      }
    }
    const formData = new FormData();
    formData.append("store_id", STORE_ID);
    formData.append("model", sideStates.front.model);
    formData.append("color", sideStates.front.color);
    formData.append("customer_name", customerName.value.trim());
    formData.append("customer_email", customerEmail.value.trim());
    formData.append("customer_phone", customerPhone.value.trim());
    formData.append("customer_notes", customerNotes.value.trim());
    formData.append("order_color", shirtColor ? shirtColor.value.trim() : "");
    formData.append("order_size", shirtSize ? shirtSize.value.trim() : "");

    let hasBack = false;
    const sides = ["front", "back"];
    for(const side of sides){
      await setActiveSide(side);
      await waitForImageLoad(mockupImg);
      if(!mockupImg || !mockupImg.src){
        if(side === "front"){
          setError(mockupUploadError, "Selecione o mockup.");
          focusInvalidField(mockupUploadBtn || mockupUploadInput);
          await setActiveSide(originalSide);
          return;
        }
        continue;
      }
      const hasText = (state.customText || "").trim().length > 0;
      const hasStampFile = !!state.stampFile;
      if(!hasStampFile && !hasText){
        if(side === "front"){
          setError(stampUploadError, "Envie a estampa em PNG ou escreva o texto.");
          focusInvalidField(stampChooseBtn || stampUploadInput);
          await setActiveSide(originalSide);
          return;
        }
        continue;
      }
      if(state.stampSrc && stampImg && stampImg.src !== state.stampSrc){
        stampImg.src = state.stampSrc;
        await waitForImageLoad(stampImg);
      }
      const previewBlob = await buildPreviewBlob();
      if(!previewBlob){
        if(side === "front"){
          setError(stampUploadError, "Nao foi possivel gerar o preview.");
          await setActiveSide(originalSide);
          return;
        }
        continue;
      }
      const suffix = side === "back" ? "_back" : "";
      formData.append(`area_w${suffix}`, String(state.areaW));
      formData.append(`area_h${suffix}`, String(state.areaH));
      formData.append(`area_x${suffix}`, String(state.areaX));
      formData.append(`area_y${suffix}`, String(state.areaY));
      const areaPct = getAreaPercent();
      if(areaPct){
        formData.append(`area_x_pct${suffix}`, String(areaPct.x));
        formData.append(`area_y_pct${suffix}`, String(areaPct.y));
        formData.append(`area_w_pct${suffix}`, String(areaPct.w));
        formData.append(`area_h_pct${suffix}`, String(areaPct.h));
      }
      formData.append(`stamp_x${suffix}`, String(Math.round(state.stamp.x / state.mockupScale)));
      formData.append(`stamp_y${suffix}`, String(Math.round(state.stamp.y / state.mockupScale)));
      formData.append(`stamp_w${suffix}`, String(Math.round(state.stamp.w / state.mockupScale)));
      formData.append(`stamp_h${suffix}`, String(Math.round(state.stamp.h / state.mockupScale)));
      formData.append(`mockup_source${suffix}`, state.mockupSource);
      formData.append(`custom_text${suffix}`, (state.customText || "").toString());
      formData.append(`custom_text_font${suffix}`, (state.customTextFont || "").toString());
      formData.append(`custom_text_font_label${suffix}`, (state.customFontLabel || "").toString());
      formData.append(`custom_text_color${suffix}`, (state.customTextColor || "").toString());
      formData.append(`custom_text_size${suffix}`, String(state.customTextSize || ""));
      if(state.customFontFile){
        formData.append(`custom_font_file${suffix}`, state.customFontFile, state.customFontFile.name || `fonte${suffix || ""}`);
      }
      formData.append(`has_text${suffix}`, hasText ? "1" : "0");
      if(hasStampFile){
        formData.append(`stamp_file${suffix}`, state.stampFile, state.stampFile.name || `estampa${suffix || ""}.png`);
      }
      formData.append(`preview_file${suffix}`, previewBlob, `preview${suffix || ""}.png`);
      if(state.model === "proprio" && state.mockupFile){
        formData.append(`mockup_file${suffix}`, state.mockupFile, state.mockupFile.name || `mockup${suffix || ""}.png`);
      }
      if(side === "back"){
        hasBack = true;
      }
    }
    await setActiveSide(originalSide);
    if(hasBack){
      formData.append("has_back", "1");
    }

    submitBtn.disabled = true;
    setFormMessage("", true);
    startSendProgress();

    try{
      const response = await fetch("../codigos/api/personalizacao_submit.php", {
        method: "POST",
        body: formData
      });
      const data = await response.json().catch(() => ({}));
      if(!response.ok || !data.ok){
        throw new Error(data.error || "erro_envio");
      }
      setFormMessage("", true);
      finishSendProgress();
      setTimeout(() => {
        openSuccessPopup();
      }, 200);
      form.reset();
      resetStamp(sideStates.front);
      resetStamp(sideStates.back);
    }catch(err){
      failSendProgress();
      setFormMessage("Nao foi possivel enviar. Tente novamente.", false);
    }finally{
      submitBtn.disabled = false;
    }
  }

  if(mockupUploadInput){
    mockupUploadInput.addEventListener("change", () => {
      setError(mockupUploadError, "");
      const file = mockupUploadInput.files && mockupUploadInput.files[0];
      if(!file){
        if(state.mockupFileUrl){
          URL.revokeObjectURL(state.mockupFileUrl);
        }
        state.mockupFile = null;
        state.mockupFileUrl = "";
        return;
      }
      if(!file.type.startsWith("image/")){
        setError(mockupUploadError, "Arquivo de mockup invalido.");
        mockupUploadInput.value = "";
        return;
      }
      if(state.mockupFileUrl){
        URL.revokeObjectURL(state.mockupFileUrl);
      }
      state.mockupFile = file;
      state.mockupSource = "mockup-personalizado";
      state.areaCustom = false;
      state.areaKey = "";
      state.mockupFileUrl = URL.createObjectURL(file);
      setMockupImage(state.mockupFileUrl);
    });
  }


  if(stampUploadInput){
    stampUploadInput.addEventListener("change", () => {
      setError(stampUploadError, "");
      const file = stampUploadInput.files && stampUploadInput.files[0];
      if(!file){
        resetStamp();
        return;
      }
      if(stampFileName){
        stampFileName.value = file.name || "Vazio";
      }
      loadStampFile(file);
    });
  }

  if(stampImg){
    stampImg.addEventListener("pointerdown", (e) => startDrag(e, "drag"));
    stampImg.addEventListener("dragstart", (e) => e.preventDefault());
  }
  if(stampResizeHandle){
    stampResizeHandle.addEventListener("pointerdown", (e) => startDrag(e, "resize"));
  }
  if(areaHandles.length){
    areaHandles.forEach((handle) => {
      handle.addEventListener("pointerdown", (e) => {
        const mode = handle.getAttribute("data-area-handle") || "";
        if(!mode) return;
        startAreaResize(e, mode);
      });
    });
  }
  if(printArea){
    printArea.addEventListener("pointerdown", startAreaDrag);
    printArea.addEventListener("dragenter", (e) => {
      e.preventDefault();
      printArea.classList.add("isDragOver");
    });
    printArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      printArea.classList.add("isDragOver");
    });
    printArea.addEventListener("dragleave", () => {
      printArea.classList.remove("isDragOver");
    });
    printArea.addEventListener("drop", (e) => {
      e.preventDefault();
      printArea.classList.remove("isDragOver");
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if(file){
        setError(stampUploadError, "");
        if(stampFileName){
          stampFileName.value = file.name || "Vazio";
        }
        loadStampFile(file);
      }
    });
  }
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", stopDrag);

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
    });
  });

  if(mockupImg){
    mockupImg.addEventListener("load", updateStageLayout);
  }

  if(areaAdjustToggle){
    areaAdjustToggle.addEventListener("click", () => {
      setAreaAdjustMode(!state.areaAdjustMode);
    });
  }
  if(mockupUploadBtn && mockupUploadInput){
    mockupUploadBtn.addEventListener("click", () => {
      mockupUploadInput.click();
    });
  }
  if(stampChooseBtn && stampUploadInput){
    stampChooseBtn.addEventListener("click", () => {
      stampUploadInput.click();
    });
  }
  if(customTextInput){
    customTextInput.addEventListener("input", () => {
      state.customText = (customTextInput.value || "").slice(0, 18);
      if(customTextInput.value !== state.customText){
        customTextInput.value = state.customText;
      }
      updateStampTextPreview();
    });
  }
  if(customTextColorPicker){
    customTextColorPicker.addEventListener("input", () => {
      state.customTextColor = customTextColorPicker.value || "#000000";
      updateStampTextPreview();
    });
  }
  if(customTextFont){
    customTextFont.addEventListener("change", () => {
      state.customTextFont = customTextFont.value || "Arial";
      updateStampTextPreview();
    });
  }
  if(customTextSize){
    customTextSize.addEventListener("input", () => {
      state.customTextSize = clampTextSize(customTextSize.value, 12, 80);
      customTextSize.value = String(state.customTextSize);
      updateStampTextPreview();
    });
  }
  if(customFontChooseBtn && customTextFontUpload){
    customFontChooseBtn.addEventListener("click", () => {
      customTextFontUpload.click();
    });
  }
  if(customFontClearBtn){
    customFontClearBtn.addEventListener("click", () => {
      clearCustomFont();
    });
  }
  if(customTextFontUpload){
    customTextFontUpload.addEventListener("change", () => {
      const file = customTextFontUpload.files && customTextFontUpload.files[0];
      if(file){
        void loadCustomFont(file);
      }
    });
  }
  if(mockupSideToggleBtn){
    mockupSideToggleBtn.addEventListener("click", () => {
      const nextSide = activeSide === "front" ? "back" : "front";
      void setActiveSide(nextSide);
    });
  }
  if(mockupUploadBtn){
    mockupUploadBtn.addEventListener("click", () => {
      setModel("proprio");
      if(mockupUploadInput) mockupUploadInput.click();
    });
  }
  if(opacityToggleBtn && opacityPanel){
    opacityToggleBtn.textContent = "Transparência";
    opacityToggleBtn.addEventListener("click", () => {
      opacityPanel.classList.toggle("show");
    });
  }
  if(stampOpacityRange){
    stampOpacityRange.addEventListener("input", () => {
      applyStampOpacity(stampOpacityRange.value);
    });
  }

  if(shirtColor){
    shirtColor.addEventListener("change", () => {
      void setColor(shirtColor.value);
    });
  }

  setAreaAdjustMode(true);

  if(stampClearBtn){
    stampClearBtn.addEventListener("click", () => {
      setError(stampUploadError, "");
      resetStamp();
    });
  }
  if(mockupUploadInput){
    mockupUploadInput.addEventListener("change", () => {
      setError(mockupUploadError, "");
    });
  }
  window.addEventListener("resize", updateStageLayout);

  if(form){
    form.addEventListener("submit", handleSubmit);
  }
  if(colorMismatchClose){
    colorMismatchClose.addEventListener("click", hideColorMismatch);
  }
  if(colorMismatchOverlay){
    colorMismatchOverlay.addEventListener("click", (e) => {
      if(e.target !== colorMismatchOverlay) return;
      hideColorMismatch();
    });
  }
  if(customPopupClose){
    customPopupClose.addEventListener("click", () => {
      if(customPopupOverlay) customPopupOverlay.style.display = "none";
    });
  }
  if(customPopupOverlay){
    customPopupOverlay.addEventListener("click", (e) => {
      if(e.target !== customPopupOverlay) return;
      customPopupOverlay.style.display = "none";
    });
  }

  updateSizeInfo();
  renderColors();
  setModel("masculino");
  updatePriceInfo();

  if(typeof window !== "undefined"){
    window.personalizacaoConfigApi = {
      applyConfigToUI,
      buildDefaultConfig,
      normalizeConfig
    };
  }
})();
