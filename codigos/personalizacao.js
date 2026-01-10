(() => {
  const STORE_ID = new URLSearchParams(window.location.search).get("loja") || "";

  const MODEL_CONFIG = {
    masculino: {
      areaTopRatio: 0.42,
      areaTopOffsetPx: 6,
      areaHeightRatio: 0.36,
      areaWidthRatio: (297 / 420) * 0.92,
      areaLeftRatio: -0.025,
      areaLeftOffsetPx: 23,
      areaWidthOffsetPx: 4,
      mockups: []
    }
  };

  const storeAlert = document.getElementById("storeAlert");
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
  const stampText = document.getElementById("stampText");
  const areaHandles = Array.from(document.querySelectorAll("[data-area-handle]"));

  const form = document.getElementById("personalizacaoForm");
  const submitBtn = document.getElementById("submitPersonalizacaoBtn");
  const formMessage = document.getElementById("formMessage");
  const sendProgress = document.getElementById("sendProgress");
  const sendProgressBar = document.getElementById("sendProgressBar");
  const sendProgressText = document.getElementById("sendProgressText");
  const storeBrand = document.getElementById("storeBrand");
  const storeBackBtn = document.getElementById("storeBackBtn");
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

  const state = {
    model: "masculino",
    color: "",
    colorCss: "",
    mockupFile: null,
    mockupSource: "",
    stampFile: null,
    stampAspect: 1,
    stampReady: false,
    stampOpacity: 1,
    customText: "",
    customTextColor: "#000000",
    customTextFont: "Arial",
    customTextSize: 32,
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
  let storeInfo = null;
  let sendProgressTimer = null;
  let sendProgressValue = 0;

  function showStoreMessage(message){
    if(!storeAlert) return;
    storeAlert.classList.remove("isLogo");
    storeAlert.textContent = message || "";
    storeAlert.style.display = message ? "block" : "none";
    if(storeBrand) storeBrand.style.display = message ? "flex" : "none";
  }
  function showStoreLogo(logoUrl, name){
    if(!storeAlert || !logoUrl) return;
    storeAlert.classList.add("isLogo");
    const label = name ? name : "Logo da loja";
    const link = (storeInfo && storeInfo.site_url) ? storeInfo.site_url : "";
    if(link){
      storeAlert.innerHTML = `<a href="${link}"><img src="${logoUrl}" alt="${label}"></a>`;
    }else{
      storeAlert.innerHTML = `<img src="${logoUrl}" alt="${label}">`;
    }
    storeAlert.style.display = "block";
    if(storeBrand) storeBrand.style.display = "flex";
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
      if(storeInfo.logo_url){
        showStoreLogo(storeInfo.logo_url, storeInfo.name);
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
      if(storeBrand){
        storeBrand.style.display = storeInfo.logo_url || storeBackBtn?.style.display === "inline-flex" ? "flex" : "none";
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

  function setFormMessage(message, ok){
    if(!formMessage) return;
    formMessage.textContent = message || "";
    formMessage.style.color = ok ? "#1b7f4a" : "#d64545";
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
    return `area_${state.model}_${suffix}`;
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
      img.onerror = () => reject(new Error("load_error"));
      img.src = src;
    });
  }

  let maleMapCache = null;

  async function getMaleMapData(){
    if(maleMapCache) return maleMapCache;
    const displacementSrc = "../imagens/app/masculino/displacement.png";
    const maskSrc = "../imagens/app/masculino/mascara.png";
    const [dispImg, maskImg] = await Promise.all([loadImage(displacementSrc), loadImage(maskSrc)]);
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
      const rect = clampAreaRect(
        Math.round(state.mockupW * data.x),
        Math.round(state.mockupH * data.y),
        Math.round(state.mockupW * data.w),
        Math.round(state.mockupH * data.h)
      );
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
    const topOffset = Number.isFinite(info.areaTopOffsetPx) ? info.areaTopOffsetPx : 0;
    const targetH = Math.round(state.mockupH * ratioH);
    let targetW = 750;
    if(Number.isFinite(info.areaWidthRatio)){
      targetW = Math.round(targetH * info.areaWidthRatio);
    }else if(Number.isFinite(info.areaW)){
      targetW = info.areaW;
    }
    if(Number.isFinite(info.areaWidthOffsetPx)){
      targetW = Math.max(1, targetW + info.areaWidthOffsetPx);
    }
    const ratioLeft = Number.isFinite(info.areaLeftRatio) ? info.areaLeftRatio : 0;
    const leftOffset = Number.isFinite(info.areaLeftOffsetPx) ? info.areaLeftOffsetPx : 0;
    const rect = clampAreaRect(
      Math.round((state.mockupW - targetW) / 2 + (state.mockupW * ratioLeft) + leftOffset),
      Math.round(state.mockupH * ratioTop + topOffset),
      Math.round(Math.min(targetW, state.mockupW)),
      Math.round(targetH)
    );
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

  function getSelectedShirtHex(){
    if(!shirtColor) return null;
    const opt = shirtColor.options[shirtColor.selectedIndex];
    if(!opt) return null;
    const hex = opt.getAttribute("data-hex");
    return hex ? hex.toLowerCase() : null;
  }

  async function applyTintedMockup(){
    if(state.model !== "masculino" || !state.colorCss) return;
    const baseSrc = "../imagens/app/masculino/branco.png";
    const maskSrc = "../imagens/app/masculino/mascara.png";
    const [baseImg, maskImg] = await Promise.all([loadImage(baseSrc), loadImage(maskSrc)]);
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

    setMockupImage(canvas.toDataURL("image/png"));
    state.mockupSource = "masculino/branco.png";
    state.mockupFile = null;
  }

  async function setColor(color){
    if(state.model === "masculino"){
      const hex = getSelectedShirtHex() || color;
      const parsed = parseColorInput(hex);
      if(!parsed) return;
      state.color = parsed.hex;
      state.colorCss = parsed.css;
      renderColors();
      await applyTintedMockup();
      return;
    }
    state.color = color;
    state.areaCustom = false;
    state.areaKey = "";
    renderColors();
    if(state.model === "feminino"){
      const src = `../imagens/app/${state.model}/${color}.png`;
      state.mockupSource = `${state.model}/${color}.png`;
      state.mockupFile = null;
      setMockupImage(src);
    }
  }

  function setModel(model){
    state.model = model;
    state.color = "";
    state.colorCss = "";
    state.mockupFile = null;
    state.mockupSource = "";
    state.areaCustom = false;
    state.areaKey = "";
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
      const info = MODEL_CONFIG[model];
    if(model === "masculino"){
        const defaultHex = getSelectedShirtHex() || "#d9d9d9";
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
  }

  function updatePrintAreaPosition(){
    if(!printArea) return;
    const scale = state.mockupScale || 1;
    printArea.style.width = `${state.areaW * scale}px`;
    printArea.style.height = `${state.areaH * scale}px`;
    printArea.style.left = `${state.areaX * scale}px`;
    printArea.style.top = `${state.areaY * scale}px`;
    updateAreaDebug();
    updateStampTextPreview();
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

  function resetStamp(){
    state.stampFile = null;
    state.stampReady = false;
    state.stampAspect = 1;
    state.stampOpacity = 1;
    state.stamp = { x: 0, y: 0, w: 0, h: 0 };
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
  }

  function loadStampFile(file){
    if(!file){
      resetStamp();
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if(!allowed.includes(file.type)){
      setError(stampUploadError, "Formato invalido. Use PNG, JPG, JPEG ou WEBP.");
      resetStamp();
      return;
    }
    if(file.size > 15 * 1024 * 1024){
      setError(stampUploadError, "Arquivo maior que 15 MB.");
      resetStamp();
      return;
    }
    state.stampFile = file;
    setStampClearEnabled(true);
    const url = URL.createObjectURL(file);
    stampImg.onload = () => {
      state.stampAspect = stampImg.naturalHeight / stampImg.naturalWidth || 1;
      state.stampReady = true;
      if(state.mockupW && state.mockupH){
        initStampPlacement();
      }
    };
    stampImg.src = url;
  }

  async function loadCustomFont(file){
    if(!file || !customTextFont) return;
    const name = file.name.replace(/\.[^.]+$/, "") || "Fonte personalizada";
    const fontName = `Fonte_${Date.now()}`;
    try{
      const fontFace = new FontFace(fontName, URL.createObjectURL(file));
      await fontFace.load();
      document.fonts.add(fontFace);
      const option = document.createElement("option");
      option.value = fontName;
      option.textContent = name;
      customTextFont.appendChild(option);
      customTextFont.value = fontName;
      state.customTextFont = fontName;
      if(customFontClearBtn){
        customFontClearBtn.disabled = false;
        customFontClearBtn.classList.remove("isDisabled");
      }
      if(customFontFileName){
        customFontFileName.value = file.name || "Vazio";
      }
      updateStampTextPreview();
    }catch(e){
      setFormMessage("Nao foi possivel carregar a fonte.", false);
    }finally{
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
    if(customFontFileName){
      customFontFileName.value = "Vazio";
    }
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
  }

  async function buildPreviewBlob(){
    const canvas = document.createElement("canvas");
    canvas.width = state.mockupW;
    canvas.height = state.mockupH;
    const ctx = canvas.getContext("2d");
    if(!ctx) return null;
    ctx.drawImage(mockupImg, 0, 0, state.mockupW, state.mockupH);

    const stampX = Math.round(state.areaX + (state.stamp.x / state.mockupScale));
    const stampY = Math.round(state.areaY + (state.stamp.y / state.mockupScale));
    const stampW = Math.round(state.stamp.w / state.mockupScale);
    const stampH = Math.round(state.stamp.h / state.mockupScale);

    let drawn = false;
    if(state.model === "masculino" && !state.mockupFile){
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
    drawCustomText(ctx, state.areaX, state.areaY, state.areaW, state.areaH);

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
    const stampPct = getStampPercentInArea();
    if(!areaPct || !stampPct) return null;

    const areaX = Math.round(canvas.width * areaPct.x);
    const areaY = Math.round(canvas.height * areaPct.y);
    const areaW = Math.round(canvas.width * areaPct.w);
    const areaH = Math.round(canvas.height * areaPct.h);
    const stampX = Math.round(areaX + (areaW * stampPct.x));
    const stampY = Math.round(areaY + (areaH * stampPct.y));
    const stampW = Math.round(areaW * stampPct.w);
    const stampH = Math.round(areaH * stampPct.h);

    let drawn = false;
    if(state.model === "masculino" && !state.mockupFile){
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
    drawCustomText(ctx, areaX, areaY, areaW, areaH);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  function validateForm(){
    let ok = true;
    setError(customerNameError, "");
    setError(customerEmailError, "");
    setError(customerPhoneError, "");
    setError(customerNotesError, "");
    setFormMessage("");

    if(!customerName.value.trim()){
      setError(customerNameError, "Informe seu nome.");
      ok = false;
    }
    if(!customerEmail.value.trim()){
      setError(customerEmailError, "Informe seu e-mail.");
      ok = false;
    }
    if(!customerPhone.value.trim()){
      setError(customerPhoneError, "Informe seu telefone.");
      ok = false;
    }
    if(!customerNotes.value.trim()){
      setError(customerNotesError, "Informe as observacoes.");
      ok = false;
    }
    if(!shirtColor || !shirtColor.value.trim()){
      setError(shirtColorError, "Selecione a cor.");
      ok = false;
    }
    if(!shirtSize || !shirtSize.value.trim()){
      setError(shirtSizeError, "Selecione o tamanho.");
      ok = false;
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
    if(!state.model){
      setFormMessage("Selecione o modelo.", false);
      return;
    }
    if(state.model !== "proprio" && !state.color){
      setFormMessage("Selecione a cor da camiseta.", false);
      return;
    }
    if(state.model === "proprio" && !state.mockupFile){
      setFormMessage("Envie o mockup personalizado.", false);
      return;
    }
    if(state.model === "proprio"){
      const key = getAreaStorageKey();
      const saved = key ? localStorage.getItem(key) : null;
      if(!saved){
        setFormMessage("Ajuste a area de impressao antes de enviar.", false);
        return;
      }
    }
    if(!state.stampFile){
      setFormMessage("Envie a estampa em PNG.", false);
      return;
    }
    if(!mockupImg.src){
      setFormMessage("Selecione o mockup.", false);
      return;
    }

    const previewBlob = await buildPreviewBlob();
    if(!previewBlob){
      setFormMessage("Nao foi possivel gerar o preview.", false);
      return;
    }

    const formData = new FormData();
    formData.append("store_id", STORE_ID);
    formData.append("model", state.model);
    formData.append("color", state.color);
    formData.append("area_w", String(state.areaW));
    formData.append("area_h", String(state.areaH));
    formData.append("area_x", String(state.areaX));
    formData.append("area_y", String(state.areaY));
    const areaPct = getAreaPercent();
    if(areaPct){
      formData.append("area_x_pct", String(areaPct.x));
      formData.append("area_y_pct", String(areaPct.y));
      formData.append("area_w_pct", String(areaPct.w));
      formData.append("area_h_pct", String(areaPct.h));
    }
    formData.append("stamp_x", String(Math.round(state.stamp.x / state.mockupScale)));
    formData.append("stamp_y", String(Math.round(state.stamp.y / state.mockupScale)));
    formData.append("stamp_w", String(Math.round(state.stamp.w / state.mockupScale)));
    formData.append("stamp_h", String(Math.round(state.stamp.h / state.mockupScale)));
    formData.append("mockup_source", state.mockupSource);
    formData.append("customer_name", customerName.value.trim());
    formData.append("customer_email", customerEmail.value.trim());
    formData.append("customer_phone", customerPhone.value.trim());
    formData.append("customer_notes", customerNotes.value.trim());
    formData.append("order_color", shirtColor ? shirtColor.value.trim() : "");
    formData.append("order_size", shirtSize ? shirtSize.value.trim() : "");
    formData.append("stamp_file", state.stampFile, state.stampFile.name || "estampa.png");
    formData.append("preview_file", previewBlob, "preview.png");
    if(state.model === "proprio" && state.mockupFile){
      formData.append("mockup_file", state.mockupFile, state.mockupFile.name || "mockup.png");
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
      resetStamp();
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
        state.mockupFile = null;
        return;
      }
      if(!file.type.startsWith("image/")){
        setError(mockupUploadError, "Arquivo de mockup invalido.");
        mockupUploadInput.value = "";
        return;
      }
      state.mockupFile = file;
      state.mockupSource = "mockup-personalizado";
      state.areaCustom = false;
      state.areaKey = "";
      const url = URL.createObjectURL(file);
      setMockupImage(url);
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
  window.addEventListener("resize", updateStageLayout);

  if(form){
    form.addEventListener("submit", handleSubmit);
  }

  updateSizeInfo();
  renderColors();
  setModel("masculino");
})();
