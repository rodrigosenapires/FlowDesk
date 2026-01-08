/***********************
     * CONFIG / STORAGE
     ***********************/
    const STORAGE_KEY_BASE  = "baseAtendimento_v5";
    const STORAGE_KEY_MENU  = "drawerMenuButtons_v2";
    const STORAGE_KEY_THEME = "theme_pref_v1";
    const STORAGE_KEY_QUICK_LINKS = "quick_links_v1";
    const STORAGE_KEY_NUVEM_LINKS = "nuvem_links_v1";
    const STORAGE_KEY_STORES = "stores_v1";
    const STORAGE_KEY_SEARCH_TAGS = "search_tags_v1";
    const STORAGE_KEY_SIZE_TABLES = "size_tables_custom_v1";
    const STORAGE_KEY_SIZE_TABLES_OVERRIDES = "size_tables_overrides_v1";
    const STORAGE_KEY_PRODUCTS = "products_custom_v1";
    const DAILY_REPEAT_LABEL = "Todos os dias";
    const WEEKLY_REPEAT_PREFIX = "Semanal: cada ";
    const MONTHLY_ORDINAL_PREFIX = "Mensal nos(as) ";
    const WEEKDAYS_REPEAT_LABEL = "Todos os dias da semana (segunda a sexta-feira)";
    const ANNUAL_REPEAT_PREFIX = "Anual em ";

    // >>> TAREFAS
    const STORAGE_KEY_TASKS = "tarefasDiarias_v1";
    const STORAGE_KEY_TASKS_DONE = "tarefasDiarias_concluidas_v1";

    // >>> CALEND\u00c1RIO (hist\u00f3rico dos assuntos por Pr\u00f3xima Etapa)
    // Mant\u00e9m registros mesmo ap\u00f3s remover chamados (para aparecer vermelho no calend\u00e1rio)
    const STORAGE_KEY_CALENDAR = "calendarHistory_v1";
    const STORAGE_KEY_SIDE_MENU = "side_menu_collapsed_v1";
    const STORAGE_KEY_USER_PROFILE = "user_profile_v1";
    const STORAGE_KEY_VIEW = "view_state_v1";
    const ADMIN_USERNAME = "Rodrigosp";

    const PASSWORD = "123"; // usado para editar/excluir PERGUNTAS e importar
    const FILE_NAME_PREFIX = "base-atendimento";
    const BACKUP_VERSION = 10;

    const API_BASE = (() => {
      const url = new URL(window.location.href);
      let path = url.pathname || "/";
      if (!path.endsWith("/")) {
        const last = path.split("/").pop() || "";
        if (last && !last.includes(".")) {
          path += "/";
        } else {
          path = path.slice(0, path.lastIndexOf("/") + 1);
        }
      }
      return `${path}api`;
    })();
    let storageCache = {};
    let storageReady = false;
    let currentUser = null;
    let userProfile = null;
    let userProfileAvatarPending = "";
    let userProfileAvatarPrev = "";
    let userProfileRequired = false;
    let storesRequired = false;
    let authMode = "login";
    let needsSetupFlag = false;
    let usersCache = [];
    let usersError = "";
    let usersSearchName = "";
    let usersSearchStore = "ALL";
    let usersSearchStatus = "";
    let activityPingTimer = null;
    let usersAutoRefreshTimer = null;
    let usersRefreshStatusTimer = null;
    let lastActivityPing = 0;

    function storageGet(key){
      return Object.prototype.hasOwnProperty.call(storageCache, key) ? storageCache[key] : null;
    }

    function storageSet(key, value){
      const nextValue = (value ?? "").toString();
      storageCache[key] = nextValue;
      void apiStorageSet(key, nextValue);
    }

    function storageSetMany(items){
      const payload = {};
      Object.keys(items || {}).forEach((key) => {
        const nextValue = (items[key] ?? "").toString();
        storageCache[key] = nextValue;
        payload[key] = nextValue;
      });
      if(Object.keys(payload).length){
        void apiStorageSetMany(payload);
      }
    }

    function normalizeUserProfile(profile){
      const data = profile && typeof profile === "object" ? profile : {};
      return {
        name: (data.name || "").toString().trim(),
        doc: (data.doc || "").toString().trim(),
        whatsapp: (data.whatsapp || "").toString().trim(),
        email: (data.email || "").toString().trim(),
        avatar: (data.avatar || "").toString().trim()
      };
    }

    function loadUserProfile(){
      const raw = storageGet(STORAGE_KEY_USER_PROFILE);
      const parsed = safeJsonParse(raw);
      return normalizeUserProfile(parsed);
    }

    function saveUserProfile(profile){
      userProfile = normalizeUserProfile(profile);
      storageSet(STORAGE_KEY_USER_PROFILE, JSON.stringify(userProfile));
      updateUserProfileUI();
    }

    function isUserProfileComplete(profile){
      const data = normalizeUserProfile(profile);
      return Boolean(data.name) && Boolean(data.doc) && Boolean(data.whatsapp) && Boolean(data.email);
    }

    function getInitials(name){
      const parts = (name || "").trim().split(/\s+/).filter(Boolean);
      if(!parts.length) return "U";
      const first = parts[0].charAt(0) || "";
      const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
      return (first + last).toUpperCase() || "U";
    }

    function buildImagePath(filename, defaultFolder){
      const raw = (filename || "").toString().trim();
      if(!raw) return "";
      const clean = raw.replace(/\\/g, "/");
      const parts = clean.split("/").filter(Boolean);
      let folderParts = [];
      let nameParts = [];
      if(parts.length >= 2){
        folderParts = parts.slice(0, -1);
        nameParts = [parts[parts.length - 1]];
      }else{
        nameParts = [parts[0] || raw];
        if(defaultFolder){
          folderParts = defaultFolder.split("/").filter(Boolean);
        }
      }
      const folderSafe = folderParts.length ? folderParts.map(p => encodeURIComponent(p)).join("/") + "/" : "";
      const nameSafe = nameParts.map(p => encodeURIComponent(p)).join("/");
      return `../imagens/${folderSafe}${nameSafe}`;
    }

    function setAvatarElements(imgEl, fallbackEl, name, avatar){
      if(!imgEl || !fallbackEl) return;
      const initials = getInitials(name);
      fallbackEl.textContent = initials;
      const avatarFile = (avatar || "").toString().trim();
      if(avatarFile){
        imgEl.src = buildImagePath(avatarFile, "app/geral");
        imgEl.style.display = "block";
        fallbackEl.style.display = "none";
      }else{
        imgEl.removeAttribute("src");
        imgEl.style.display = "none";
        fallbackEl.style.display = "block";
      }
    }

    function updateUserProfileUI(){
      const data = normalizeUserProfile(userProfile);
      if(userNameLabel) userNameLabel.textContent = data.name || "Minha conta";
      setAvatarElements(userAvatarImg, userAvatarFallback, data.name, data.avatar);
      setAvatarElements(userProfileAvatarImg, userProfileAvatarFallback, data.name, data.avatar);
    }

    function updateAdminAccessUI(){
      const canUsers = canAccessUsersView();
      if(goToUsersBtn) goToUsersBtn.style.display = canUsers ? "" : "none";
      if(navUsersBtn) navUsersBtn.style.display = canUsers ? "" : "none";
      if(addUserBtn) addUserBtn.style.display = (isAdminUser() || isPrincipalUser()) ? "" : "none";
      if(openRegisterBtn) openRegisterBtn.style.display = "none";
    }

    async function apiRequest(path, body, options){
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body || {}),
        ...options
      });
      const data = await response.json().catch(() => ({}));
      if(!response.ok){
        const msg = data?.error || "request_failed";
        throw new Error(msg);
      }
      return data;
    }

    async function apiSession(){
      const response = await fetch(`${API_BASE}/session.php`, { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      return data || {};
    }

    async function apiAdminUsers(){
      const response = await fetch(`${API_BASE}/admin_users.php`, { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if(!response.ok){
        const msg = data?.error || "request_failed";
        throw new Error(msg);
      }
      return data;
    }

    async function apiUserActivity(userId){
      const id = String(userId || "").trim();
      const response = await fetch(`${API_BASE}/user_activity.php?user_id=${encodeURIComponent(id)}`, { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if(!response.ok){
        const msg = data?.error || "request_failed";
        throw new Error(msg);
      }
      return data;
    }

    async function apiAdminUserAction(action, userId){
      return apiRequest(`${API_BASE}/admin_user_action.php`, { action, user_id: userId });
    }

    async function apiSetupStatus(){
      const response = await fetch(`${API_BASE}/setup.php`, { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      return data || {};
    }

    async function apiStorageGetAll(){
      return apiRequest(`${API_BASE}/storage.php`, { action: "getAll" });
    }

    async function apiStorageSet(key, value){
      return apiRequest(`${API_BASE}/storage.php`, { action: "set", key, value });
    }

    async function apiStorageSetMany(items){
      return apiRequest(`${API_BASE}/storage.php`, { action: "setMany", items });
    }

    async function apiUploadImage(file, folder){
      const formData = new FormData();
      formData.append("file", file);
      if(folder){
        formData.append("folder", folder);
      }
      const response = await fetch(`${API_BASE}/upload_image.php`, {
        method: "POST",
        credentials: "include",
        body: formData
      });
      const data = await response.json().catch(() => ({}));
      if(!response.ok || !data?.ok){
        const msg = data?.error || "upload_failed";
        throw new Error(msg);
      }
      return (data.filename || "").toString();
    }
    async function apiDeleteImage(filename){
      return apiRequest(`${API_BASE}/delete_image.php`, { filename });
    }
    async function apiActivityPing(){
      const response = await fetch(`${API_BASE}/ping.php`, { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if(!response.ok){
        const msg = data?.error || "request_failed";
        throw new Error(msg);
      }
      return data;
    }

    const DEFAULT_DIARIO_LOGO = "https://acdn-us.mitiendanube.com/stores/003/800/267/themes/common/logo-1017420669-1696607286-3604afa78036bc99d42c4a45a62c9aac1696607286-480-0.webp";
    const DEFAULT_SHOP80_LOGO = "https://acdn-us.mitiendanube.com/stores/006/053/724/themes/common/logo-881782978-1743865292-d422bc1fcaed5234816adb11a5e1931b1743865292-480-0.webp";

    const DRAWER_PAGE_SIZE = 3;

    const STATUS_OPTIONS = [
      { value:"Tr\u00e2nsito - F\u00e1brica para o Cliente", colorA:"#7c8cff", colorB:"#38d9a9" },
      { value:"Tr\u00e2nsito - Cliente para a F\u00e1brica", colorA:"#ff9f43", colorB:"#ffd43b" },
      { value:"Tr\u00e2nsito - Cliente para a Rio das Ostras", colorA:"#ff5c7a", colorB:"#ffd43b" },
      { value:"Aguardando a Nuvem", colorA:"#3b5bdb", colorB:"#74c0fc" },
      { value:"Aguardando a F\u00e1brica", colorA:"#12b886", colorB:"#38d9a9" },
      { value:"Aguardando prazo do Chamado e Reenvio - Defeito de fabrica\u00e7\u00e3o.", colorA:"#845ef7", colorB:"#ff5c7a" },
    ];

    const FONTE_OPTIONS = [
      "F\u00e1brica King - Di\u00e1rio Nerdify",
      "F\u00e1brica King - Shop 80",
      "Nuvemshop - Di\u00e1rio Nerdify",
      "Nuvemshop - Shop 80",
    ];

    const QUICK_LINK_KEYS = ["sakChat", "metaInbox", "emailMenu", "storeLinks", "productsExtra", "transportadorasExtra"];
    const DEFAULT_SEARCH_TAGS = [
      "envio",
      "rastreio",
      "prazo",
      "entrega",
      "insta",
      "face",
      "temas",
      "marcas",
      "personalizado",
      "whatsapp",
      "desconto"
    ];
    const MAX_STORES = 3;
    const NUVEM_DEFAULT_LINKS = {
      "Di\u00e1rio Nerdify": [
        { id:"vendas", label:"Vendas", url:"", fixed:true },
        { id:"produtos", label:"Produtos", url:"", fixed:true },
        { id:"envios", label:"Envios", url:"", fixed:true },
        { id:"mensagens", label:"Mensagens", url:"", fixed:true },
        { id:"cupons", label:"Cupons de desconto", url:"", fixed:true },
        { id:"novo", label:"Novo Pedido", url:"", fixed:true }
      ],
      "Shop 80": [
        { id:"vendas", label:"Vendas", url:"", fixed:true },
        { id:"produtos", label:"Produtos", url:"", fixed:true },
        { id:"envios", label:"Envios", url:"", fixed:true },
        { id:"mensagens", label:"Mensagens", url:"", fixed:true },
        { id:"cupons", label:"Cupons de desconto", url:"", fixed:true },
        { id:"novo", label:"Novo Pedido", url:"", fixed:true }
      ]
    };

    const DEFAULT_STORES = [
      {
        name: "Di\u00e1rio Nerdify",
        logoUrl: DEFAULT_DIARIO_LOGO,
        siteUrl: "https://diarionerdify.com.br/",
        stampsUrl: "https://drive.google.com/drive/folders/10EKdHW5QXZwCgOWdbXCwkQH0llZnhObg",
        supportWhatsapp: "https://api.whatsapp.com/send?phone=551150395895",
        instagramUrl: "",
        facebookUrl: "",
        tiktokUrl: "",
        youtubeUrl: "",
        pinterestUrl: "",
        whatsappUrl: "",
        socialExtras: [],
        metaInboxUrl: "https://business.facebook.com/latest/inbox/instagram?asset_id=288888780971776&business_id=1796204240794310&mailbox_id=288888780971776&selected_item_id=770298646164118&thread_type=INSTAGRAM_POST",
        emailAdmin: "atendimento@diarionerdify.com.br",
        emailAtendimento: "contato@diarionerdify.com.br",
        emailOpenUrl1: "https://mail.zoho.com/zm/#mail/folder/inbox",
        emailOpenUrl2: "https://mail.zoho.com/zm/#mail/folder/inbox"
      },
      {
        name: "Shop 80",
        logoUrl: DEFAULT_SHOP80_LOGO,
        siteUrl: "https://shop80.com.br/",
        stampsUrl: "https://drive.google.com/drive/folders/1e5GAl5tYRRL6xKmp4SHSPxGwmUuf9N_x",
        supportWhatsapp: "https://api.whatsapp.com/send?phone=551140207216",
        instagramUrl: "",
        facebookUrl: "",
        tiktokUrl: "",
        youtubeUrl: "",
        pinterestUrl: "",
        whatsappUrl: "",
        socialExtras: [],
        metaInboxUrl: "https://business.facebook.com/latest/inbox/facebook?asset_id=643845715482383&business_id=1882886565833888&mailbox_id=643845715482383&selected_item_id=707518642448423&thread_type=FB_AD_POST",
        emailAdmin: "atendimento@shop80.com.br",
        emailAtendimento: "contato@shop80.com.br",
        emailOpenUrl1: "https://mail.zoho.com/zm/#mail/folder/inbox",
        emailOpenUrl2: "https://mail.zoho.com/zm/#mail/folder/inbox"
      }
    ];

    function normalizeQuickLinks(obj){
      const out = {};
      for(const key of QUICK_LINK_KEYS){
        const raw = obj ? obj[key] : null;
        let list = [];
        if(Array.isArray(raw)){
          list = raw;
        }else if(typeof raw === "string"){
          list = raw.trim() ? [{ title:"", url: raw }] : [];
        }else if(raw && typeof raw === "object" && Array.isArray(raw.links)){
          list = raw.links;
        }
        out[key] = (list || [])
          .map(l => ({
            title: (l?.title ?? l?.name ?? "").toString(),
            url: (l?.url ?? "").toString()
          }))
          .filter(l => (l.url || "").trim());
      }
      return out;
    }

    function loadQuickLinks(){
      const raw = storageGet(STORAGE_KEY_QUICK_LINKS);
      const parsed = safeJsonParse(raw);
      if(parsed && typeof parsed === "object") return normalizeQuickLinks(parsed);
      return normalizeQuickLinks({});
    }

    function saveQuickLinks(next){
      quickLinks = normalizeQuickLinks(next);
      storageSet(STORAGE_KEY_QUICK_LINKS, JSON.stringify(quickLinks));
      renderExtraMenuLinks();
    }

    function normalizeSearchTags(list){
      const raw = Array.isArray(list) ? list : [];
      const out = [];
      const seen = new Set();
      for(const tag of raw){
        const t = (tag || "").toString().trim().toLowerCase();
        if(!t || seen.has(t)) continue;
        seen.add(t);
        out.push(t);
      }
      return out;
    }

    const DEFAULT_TRANSPORTADORAS_LINKS = [
      { title:"Rastreio Loggi", url:"https://app.loggi.com/rastreador/completo" },
      { title:"Rastreio Jadlog", url:"https://www.jadlog.com.br/jadlog/captcha" },
      { title:"Rastreio Correios", url:"https://rastreamento.correios.com.br/app/index.php" },
      { title:"Rastreio Onlog", url:"https://conecta.log.br/rastreio" },
      { title:"Gerar Etiqueta Correios", url:"https://www2.correios.com.br/encomendas/servicosonline/" },
      { title:"Gerar Etiqueta Onlog", url:"https://conecta.log.br/" }
    ];
    const STORAGE_KEY_TRANSPORTADORAS_SEEDED = "quick_links_transportadoras_seeded";
    const STORAGE_KEYS_ALL = [
      STORAGE_KEY_BASE,
      STORAGE_KEY_MENU,
      STORAGE_KEY_THEME,
      STORAGE_KEY_QUICK_LINKS,
      STORAGE_KEY_NUVEM_LINKS,
      STORAGE_KEY_STORES,
      STORAGE_KEY_SEARCH_TAGS,
      STORAGE_KEY_SIZE_TABLES,
      STORAGE_KEY_SIZE_TABLES_OVERRIDES,
      STORAGE_KEY_PRODUCTS,
      STORAGE_KEY_TASKS,
      STORAGE_KEY_TASKS_DONE,
      STORAGE_KEY_CALENDAR,
      STORAGE_KEY_TRANSPORTADORAS_SEEDED
    ];
    function seedTransportadorasLinks(){
      if(storageGet(STORAGE_KEY_TRANSPORTADORAS_SEEDED) === "1") return;
      const list = Array.isArray(quickLinks.transportadorasExtra) ? quickLinks.transportadorasExtra : [];
      if(list.length){
        storageSet(STORAGE_KEY_TRANSPORTADORAS_SEEDED, "1");
        return;
      }
      quickLinks = normalizeQuickLinks({ ...quickLinks, transportadorasExtra: DEFAULT_TRANSPORTADORAS_LINKS });
      storageSet(STORAGE_KEY_QUICK_LINKS, JSON.stringify(quickLinks));
      storageSet(STORAGE_KEY_TRANSPORTADORAS_SEEDED, "1");
    }

    function loadSearchTags(){
      const raw = storageGet(STORAGE_KEY_SEARCH_TAGS);
      const parsed = safeJsonParse(raw);
      if(Array.isArray(parsed)) return normalizeSearchTags(parsed);
      return normalizeSearchTags(DEFAULT_SEARCH_TAGS);
    }

    function saveSearchTags(next){
      searchTags = normalizeSearchTags(next);
      storageSet(STORAGE_KEY_SEARCH_TAGS, JSON.stringify(searchTags));
      renderSearchTags();
    }

    function normalizeSizeTables(list){
      const raw = Array.isArray(list) ? list : [];
      return raw
        .map(t => ({
          name: (t?.name || "").toString().trim(),
          dataUrl: (t?.dataUrl || "").toString().trim()
        }))
        .filter(t => t.name && t.dataUrl);
    }

    function loadSizeTablesCustom(){
      const raw = storageGet(STORAGE_KEY_SIZE_TABLES);
      const parsed = safeJsonParse(raw);
      if(Array.isArray(parsed)) return normalizeSizeTables(parsed);
      return [];
    }

    function saveSizeTablesCustom(next){
      sizeTablesCustom = normalizeSizeTables(next);
      storageSet(STORAGE_KEY_SIZE_TABLES, JSON.stringify(sizeTablesCustom));
      buildSizeTablesGrid();
    }

    function loadSizeTablesOverrides(){
      const raw = storageGet(STORAGE_KEY_SIZE_TABLES_OVERRIDES);
      const parsed = safeJsonParse(raw);
      if(Array.isArray(parsed)) return normalizeSizeTables(parsed);
      return [];
    }

    function saveSizeTablesOverrides(next){
      sizeTablesOverrides = normalizeSizeTables(next);
      storageSet(STORAGE_KEY_SIZE_TABLES_OVERRIDES, JSON.stringify(sizeTablesOverrides));
      buildSizeTablesGrid();
    }

    const DEFAULT_PRODUCTS_MINIMAL = [
      {
        store: "Di\u00e1rio Nerdify",
        name: "Camisetas",
        price: "R$82,90"
      },
      {
        store: "Shop 80",
        name: "Camisetas",
        price: "R$74,90"
      }
    ];

    const LEGACY_PRODUCTS = [
      { store: "Di\u00e1rio Nerdify", name: "Camisetas", price: "R$82,90" },
      { store: "Di\u00e1rio Nerdify", name: "Regatas", price: "R$82,90" },
      { store: "Di\u00e1rio Nerdify", name: "Manga longa", price: "R$110,00" },
      { store: "Di\u00e1rio Nerdify", name: "Baby look", price: "R$82,90" },
      { store: "Di\u00e1rio Nerdify", name: "Plus size", price: "R$109,90" },
      { store: "Di\u00e1rio Nerdify", name: "Bon\u00e9s", price: "R$69,90" },
      { store: "Shop 80", name: "Camisetas", price: "R$74,90" },
      { store: "Shop 80", name: "Regatas", price: "R$74,90" },
      { store: "Shop 80", name: "Manga longa", price: "R$99,90" },
      { store: "Shop 80", name: "Plus size", price: "R$99,90" },
      { store: "Shop 80", name: "Bon\u00e9s", price: "R$69,90" }
    ];

    function productKeyFromName(name){
      const raw = (name || "").toString().trim().toLowerCase();
      const clean = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if(clean.includes("manga longa")) return "manga-longa";
      if(clean.includes("baby")) return "baby-look";
      if(clean.includes("plus")) return "plus-size";
      if(clean.includes("regata")) return "regata";
      if(clean.includes("bon")) return "bones";
      if(clean.includes("camis")) return "camiseta";
      return clean.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    }

    function normalizeProductSpecs(value){
      if(Array.isArray(value)){
        return value.map(v => (v || "").toString().trim()).filter(Boolean);
      }
      if(typeof value === "string"){
        return value
          .split(/\r?\n/)
          .map(v => v.trim())
          .filter(Boolean);
      }
      return [];
    }

    function normalizeHex(value){
      const raw = (value || "").toString().trim();
      if(!raw) return "";
      const match = raw.match(/#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
      if(!match) return "";
      return `#${match[1].toUpperCase()}`;
    }

    function parseProductColorLine(line){
      const raw = (line || "").toString().trim();
      if(!raw) return null;
      let name = "";
      let hex = "";
      if(raw.includes("|")){
        const parts = raw.split("|");
        name = (parts[0] || "").trim();
        hex = normalizeHex(parts.slice(1).join("|"));
      }else{
        const match = raw.match(/#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})/);
        if(match){
          hex = normalizeHex(match[0]);
          name = raw.replace(match[0], "").replace(/\s*-\s*/g, " ").trim();
        }else{
          name = raw;
        }
      }
      if(!hex) return null;
      return { name: name || hex, hex };
    }

    function normalizeProductColors(value){
      if(Array.isArray(value)){
        return value.map(c => {
          const name = (c?.name || "").toString().trim();
          const hex = normalizeHex(c?.hex || "");
          if(!hex) return null;
          return { name: name || hex, hex };
        }).filter(Boolean);
      }
      if(typeof value === "string"){
        return value
          .split(/\r?\n/)
          .map(parseProductColorLine)
          .filter(Boolean);
      }
      return [];
    }

    function formatProductSpecsText(specs){
      return (specs || []).map(v => (v || "").toString()).filter(Boolean).join("\n");
    }

    function formatProductColorsText(colors){
      return (colors || [])
        .map(c => `${(c?.name || "").toString().trim()} | ${(c?.hex || "").toString().trim()}`.trim())
        .filter(Boolean)
        .join("\n");
    }

    function buildProductColorOptions(){
      const normalizeName = (value)=> (value || "")
        .toString()
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const base = Array.isArray(PRODUCT_COLORS) ? PRODUCT_COLORS.slice() : [];
      const plus = Array.isArray(PRODUCT_COLORS_PLUS) ? PRODUCT_COLORS_PLUS : [];
      const offWhite = plus.find(c => (c?.name || "").toString().toLowerCase().includes("off white"));
      if(offWhite){
        const offHex = normalizeHex(offWhite.hex);
        const exists = base.some(c => normalizeHex(c.hex) === offHex);
        if(offHex && !exists){
          base.push({ name: "Off White", hex: offHex });
        }
      }
      const baseHexSet = new Set(base.map(c => normalizeHex(c.hex)));
      const baseNameMap = new Map(base.map(c => [normalizeName(c.name), normalizeHex(c.hex)]));
      const baby = Array.isArray(PRODUCT_COLORS_BABY) ? PRODUCT_COLORS_BABY : [];
      const extras = [];
      baby.forEach(c => {
        const hex = normalizeHex(c.hex);
        if(!hex || baseHexSet.has(hex)) return;
        const rawName = (c.name || "").toString().trim();
        const nameKey = normalizeName(rawName);
        const baseHex = baseNameMap.get(nameKey);
        const name = baseHex && baseHex !== hex ? `${rawName} Baby Look` : rawName;
        extras.push({ name, hex });
      });
      return [...base, ...extras];
    }

    function renderProductManageSpecs(){
      if(!productManageSpecsList) return;
      if(!productManageSpecsItems.length){
        productManageSpecsList.innerHTML = `<div class="note">Nenhuma especifica\u00e7\u00e3o adicionada.</div>`;
        return;
      }
      productManageSpecsList.innerHTML = productManageSpecsItems.map((item, idx) => `
        <div class="specsItem">
          <span>${escapeHtml(item)}</span>
          <span class="specsActions">
            <button class="specsMoveBtn" type="button" data-spec-move="up" data-spec-index="${idx}" aria-label="Subir">
              <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="6 14 12 8 18 14"></polyline>
              </svg>
            </button>
            <button class="specsMoveBtn" type="button" data-spec-move="down" data-spec-index="${idx}" aria-label="Descer">
              <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="6 10 12 16 18 10"></polyline>
              </svg>
            </button>
            <button class="specsRemoveBtn" type="button" data-spec-remove="${idx}" aria-label="Remover">x</button>
          </span>
        </div>
      `).join("");
      productManageSpecsList.querySelectorAll("[data-spec-remove]").forEach(btn => {
        btn.addEventListener("click", ()=>{
          const index = Number(btn.getAttribute("data-spec-remove"));
          if(!Number.isFinite(index)) return;
          productManageSpecsItems.splice(index, 1);
          renderProductManageSpecs();
        });
      });
      productManageSpecsList.querySelectorAll("[data-spec-move]").forEach(btn => {
        btn.addEventListener("click", ()=>{
          const dir = btn.getAttribute("data-spec-move");
          const index = Number(btn.getAttribute("data-spec-index"));
          if(!Number.isFinite(index)) return;
          const target = dir === "up" ? index - 1 : index + 1;
          if(target < 0 || target >= productManageSpecsItems.length) return;
          const next = productManageSpecsItems.slice();
          const temp = next[index];
          next[index] = next[target];
          next[target] = temp;
          productManageSpecsItems = next;
          renderProductManageSpecs();
        });
      });
    }

    function setProductManageSpecs(list){
      productManageSpecsItems = normalizeProductSpecs(list);
      renderProductManageSpecs();
    }

    function addProductManageSpec(){
      if(!productManageSpecsInput) return;
      const value = (productManageSpecsInput.value || "").toString().trim();
      if(!value) return;
      productManageSpecsItems.push(value);
      productManageSpecsInput.value = "";
      renderProductManageSpecs();
      productManageSpecsInput.focus();
    }

    function renderProductManageColors(){
      if(!productManageColorsList) return;
      const options = buildProductColorOptions();
      const selectedHex = new Set(productManageSelectedColors.map(c => normalizeHex(c.hex)));
      productManageColorsList.innerHTML = options.map((color, idx) => {
        const hex = normalizeHex(color.hex);
        const name = (color.name || "").toString().trim();
        const checked = selectedHex.has(hex) ? "checked" : "";
        return `
          <label class="colorPickItem">
            <span class="colorPickInfo">
              <span class="colorPickSwatch" style="background:${escapeHtml(hex)};"></span>
              <span>${escapeHtml(name)}</span>
            </span>
            <input class="colorPickCheck" type="checkbox" data-color-idx="${idx}" ${checked}>
          </label>
        `;
      }).join("");
      productManageColorsList.querySelectorAll("[data-color-idx]").forEach(inp => {
        inp.addEventListener("change", ()=>{
          const idx = Number(inp.getAttribute("data-color-idx"));
          const color = options[idx];
          if(!color) return;
          const hex = normalizeHex(color.hex);
          const name = (color.name || "").toString().trim();
          if(inp.checked){
            if(!productManageSelectedColors.some(c => normalizeHex(c.hex) === hex)){
              productManageSelectedColors.push({ name, hex });
            }
          }else{
            productManageSelectedColors = productManageSelectedColors.filter(c => normalizeHex(c.hex) !== hex);
          }
        });
      });
    }

    function setProductManageColors(list){
      productManageSelectedColors = normalizeProductColors(list);
      renderProductManageColors();
    }

    function normalizeProducts(list){
      const raw = Array.isArray(list) ? list : [];
      return raw.map(p => {
        const name = (p?.name || "").toString().trim();
        const store = (p?.store || "").toString().trim();
        const price = (p?.price || "").toString().trim();
        const key = (p?.key || productKeyFromName(name)).toString().trim();
        const rawStampsUrl = (p?.stampsUrl || p?.stamps || "").toString().trim();
        const rawSpecs = p?.specs;
        const rawColors = p?.colors;
        const rawTableUrl = (p?.tableUrl || p?.tableDataUrl || "").toString().trim();
        const hasSpecs = Array.isArray(rawSpecs) ? rawSpecs.length > 0 : Boolean(rawSpecs && rawSpecs.toString().trim());
        const hasColors = Array.isArray(rawColors) ? rawColors.length > 0 : Boolean(rawColors && rawColors.toString().trim());
        const detailsCustom = Boolean(p?.detailsCustom) || Boolean(rawStampsUrl) || hasSpecs || hasColors || Boolean(rawTableUrl);
        const stampsUrl = rawStampsUrl;
        const specs = normalizeProductSpecs(rawSpecs);
        const colors = normalizeProductColors(rawColors);
        const tableUrl = rawTableUrl;
        const id = (p?.id || "").toString().trim() || uid();
        return { id, store, name, price, key, stampsUrl, specs, colors, tableUrl, detailsCustom };
      }).filter(p => p.name && p.store);
    }

    function loadProducts(){
      const raw = storageGet(STORAGE_KEY_PRODUCTS);
      const parsed = safeJsonParse(raw);
      if(Array.isArray(parsed)) return normalizeProducts(parsed);
      const hasBase = Boolean(storageGet(STORAGE_KEY_BASE));
      const seed = hasBase ? LEGACY_PRODUCTS : DEFAULT_PRODUCTS_MINIMAL;
      return normalizeProducts(seed);
    }

    function saveProducts(next){
      productsCustom = normalizeProducts(next);
      storageSet(STORAGE_KEY_PRODUCTS, JSON.stringify(productsCustom));
      buildProductsGrid();
    }

    function normalizeStoreKey(value){
      return (value || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    function findDefaultStoreMatch(store, defaultsByName){
      if(store?.name && defaultsByName.has(store.name)) return defaultsByName.get(store.name);
      const nameKey = normalizeStoreKey(store?.name || "");
      if(nameKey){
        for(const def of defaultsByName.values()){
          const defKey = normalizeStoreKey(def?.name || "");
          if(defKey && (nameKey.includes(defKey) || defKey.includes(nameKey))) return def;
        }
      }
      const site = (store?.siteUrl || "").toString().trim().toLowerCase().replace(/\/+$/,"");
      if(site){
        for(const def of defaultsByName.values()){
          const defSite = (def?.siteUrl || "").toString().trim().toLowerCase().replace(/\/+$/,"");
          if(defSite && (site.includes(defSite) || defSite.includes(site))) return def;
        }
      }
      const logo = (store?.logoUrl || "").toString().trim();
      if(logo){
        for(const def of defaultsByName.values()){
          if(def?.logoUrl && def.logoUrl === logo) return def;
        }
      }
      return null;
    }

    function normalizeStores(list){
      const raw = Array.isArray(list) ? list : [];
      const defaultsByName = new Map(DEFAULT_STORES.map(s => [s.name, s]));
      const out = raw.map(s => ({
        name: (s?.name || "").toString().trim(),
        logoUrl: (s?.logoUrl || "").toString().trim(),
        siteUrl: (s?.siteUrl || "").toString().trim(),
        stampsUrl: (s?.stampsUrl || "").toString().trim(),
        supportWhatsapp: (s?.supportWhatsapp || "").toString().trim(),
        instagramUrl: (s?.instagramUrl || "").toString().trim(),
        facebookUrl: (s?.facebookUrl || "").toString().trim(),
        tiktokUrl: (s?.tiktokUrl || "").toString().trim(),
        youtubeUrl: (s?.youtubeUrl || "").toString().trim(),
        pinterestUrl: (s?.pinterestUrl || "").toString().trim(),
        whatsappUrl: (s?.whatsappUrl || "").toString().trim(),
        socialExtras: Array.isArray(s?.socialExtras)
          ? s.socialExtras.map(item => ({
              name: (item?.name || "").toString().trim(),
              url: (item?.url || "").toString().trim()
            })).filter(item => item.name || item.url)
          : [],
        metaInboxUrl: (s?.metaInboxUrl || "").toString().trim(),
        emailList: Array.isArray(s?.emailList)
          ? s.emailList.map(item => ({
              email: (item?.email || "").toString().trim(),
              openUrl: (item?.openUrl || "").toString().trim()
            })).filter(item => item.email || item.openUrl)
          : [],
        emailAdmin: (s?.emailAdmin || "").toString().trim(),
        emailAtendimento: (s?.emailAtendimento || "").toString().trim(),
        emailOpenUrl1: (() => {
          const direct = (s?.emailOpenUrl1 || "").toString().trim();
          const legacy = (s?.emailOpenUrl || "").toString().trim();
          return direct || legacy;
        })(),
        emailOpenUrl2: (() => {
          const direct = (s?.emailOpenUrl2 || "").toString().trim();
          const legacy = (s?.emailOpenUrl || "").toString().trim();
          return direct || legacy;
        })()
      })).map(s => {
        if(!s.stampsUrl){
          const def = findDefaultStoreMatch(s, defaultsByName);
          if(def){
            s.stampsUrl = (def?.stampsUrl || "").toString().trim();
          }
        }
        return s;
      }).map(s => {
        if(!s.socialExtras || !s.socialExtras.length){
          const extras = [];
          const legacy = [
            { key: "instagramUrl", label: "Instagram" },
            { key: "facebookUrl", label: "Facebook" },
            { key: "tiktokUrl", label: "TikTok" },
            { key: "youtubeUrl", label: "YouTube" },
            { key: "pinterestUrl", label: "Pinterest" }
          ];
          legacy.forEach(item => {
            const url = (s[item.key] || "").toString().trim();
            if(url) extras.push({ name: item.label, url });
          });
          if(extras.length) s.socialExtras = extras;
        }
        if(!s.emailList || !s.emailList.length){
          const legacy = [];
          const admin = (s.emailAdmin || "").toString().trim();
          const atendimento = (s.emailAtendimento || "").toString().trim();
          if(admin) legacy.push({ email: admin, openUrl: (s.emailOpenUrl1 || "").toString().trim() });
          if(atendimento) legacy.push({ email: atendimento, openUrl: (s.emailOpenUrl2 || "").toString().trim() });
          if(legacy.length) s.emailList = legacy;
        }
        return s;
      }).filter(s => s.name || s.logoUrl || s.siteUrl || s.stampsUrl || s.supportWhatsapp || s.instagramUrl || s.facebookUrl || s.tiktokUrl || s.youtubeUrl || s.pinterestUrl || s.whatsappUrl || s.socialExtras.length || s.metaInboxUrl || (s.emailList && s.emailList.length) || s.emailAdmin || s.emailAtendimento || s.emailOpenUrl1 || s.emailOpenUrl2);

      return out.slice(0, MAX_STORES);
    }

    function loadStores(){
      const raw = storageGet(STORAGE_KEY_STORES);
      const parsed = safeJsonParse(raw);
      if(!Array.isArray(parsed)) return [];
      const normalized = normalizeStores(parsed);
      const defaultsByName = new Map(DEFAULT_STORES.map(s => [s.name, s]));
      let changed = false;
      const backfilled = normalized.map(store => {
        if(!store.stampsUrl){
          const def = findDefaultStoreMatch(store, defaultsByName);
          const url = (def?.stampsUrl || "").toString().trim();
          if(url){
            changed = true;
            return { ...store, stampsUrl: url };
          }
        }
        return store;
      });
      if(changed){
        storageSet(STORAGE_KEY_STORES, JSON.stringify(backfilled));
      }
      return backfilled;
    }

    function saveStores(next){
      stores = normalizeStores(next);
      storageSet(STORAGE_KEY_STORES, JSON.stringify(stores));
      updateStoresUI();
    }

    function cleanupStoreData(removedNames, remainingNames){
      const removed = new Set((removedNames || []).map(n => (n || "").toString()));
      if(!removed.size) return;
      const shouldReassign = false;

      let itemsChanged = false;
      let nextItems = items.filter(it => {
        const store = (it?.store || "").toString();
        if(!removed.has(store)) return true;
        itemsChanged = true;
        return false;
      });
      if(itemsChanged){
        items = nextItems;
        saveBase(items);
        render();
      }

      let tasksChanged = false;
      const nextTasks = (tasks || []).filter(t => {
        const loja = (t?.loja || "").toString();
        if(!removed.has(loja)) return true;
        tasksChanged = true;
        return false;
      });
      if(tasksChanged) saveTasks(nextTasks);

      let tasksDoneChanged = false;
      const nextTasksDone = (tasksDone || []).filter(t => {
        const loja = (t?.loja || "").toString();
        if(!removed.has(loja)) return true;
        tasksDoneChanged = true;
        return false;
      });
      if(tasksDoneChanged) saveTasksDone(nextTasksDone);

      const nextProducts = (productsCustom || []).filter(p => {
        const store = (p?.store || "").toString();
        if(!removed.has(store)) return true;
        return false;
      });
      if(nextProducts.length !== (productsCustom || []).length){
        saveProducts(nextProducts);
      }

      if(Array.isArray(calendarHistory) && calendarHistory.length){
        const nextCalendar = calendarHistory.filter(entry => {
          const loja = (entry?.loja || "").toString();
          if(!removed.has(loja)) return true;
          return false;
        });
        saveCalendarHistory(nextCalendar);
      }

      if(nuvemLinks && typeof nuvemLinks === "object"){
        const nextNuvem = { ...nuvemLinks };
        removed.forEach(name => { delete nextNuvem[name]; });
        saveNuvemLinks(nextNuvem);
      }
    }

    function getStoreNames(){
      return (stores || []).map(s => s.name).filter(Boolean);
    }

    function getStoreByName(name){
      const target = (name || "").toString();
      return (stores || []).find(s => (s.name || "") === target) || null;
    }

    function normalizeNuvemLinks(obj){
      const out = {};
      const storeNames = getStoreNames();
      for(const store of storeNames){
        const defaults = NUVEM_DEFAULT_LINKS[store] || [];
        const raw = Array.isArray(obj?.[store]) ? obj[store] : [];
        const normalizedRaw = raw.map(item => ({
          id: (item?.id || "").toString(),
          label: (item?.label || "").toString(),
          url: (item?.url || "").toString(),
          fixed: Boolean(item?.fixed)
        })).filter(item => item.id && item.label);

        if(!normalizedRaw.length){
          out[store] = defaults.map(def => ({
            id: def.id,
            label: def.label,
            url: def.url || "",
            fixed: true
          }));
          continue;
        }

        const defaultsMap = new Map();
        defaults.forEach(def => defaultsMap.set(def.id, def));
        const seenDefaults = new Set();

        const ordered = normalizedRaw.map(item => {
          const def = defaultsMap.get(item.id);
          if(def){
            seenDefaults.add(def.id);
            return {
              id: def.id,
              label: def.label,
              url: item.url || def.url || "",
              fixed: true
            };
          }
          return {
            id: item.id,
            label: item.label,
            url: item.url,
            fixed: Boolean(item.fixed)
          };
        });

        const missingDefaults = defaults
          .filter(def => !seenDefaults.has(def.id))
          .map(def => ({
            id: def.id,
            label: def.label,
            url: def.url || "",
            fixed: true
          }));

        out[store] = [...ordered, ...missingDefaults];
      }
      return out;
    }

    function loadNuvemLinks(){
      const raw = storageGet(STORAGE_KEY_NUVEM_LINKS);
      const parsed = safeJsonParse(raw);
      if(parsed && typeof parsed === "object") return normalizeNuvemLinks(parsed);
      return normalizeNuvemLinks({});
    }

    function saveNuvemLinks(next){
      nuvemLinks = normalizeNuvemLinks(next);
      storageSet(STORAGE_KEY_NUVEM_LINKS, JSON.stringify(nuvemLinks));
      renderNuvemLinks();
    }

    function renderSearchTags(){
      if(!searchTagList) return;
      const tags = Array.isArray(searchTags) ? searchTags : [];
      const rows = tags.map(tag => (
        `<span class="tagItem">
          <label class="tagFilterItem"><input type="checkbox" data-search-tag value="${escapeHtml(tag)}"> ${escapeHtml(tag)}</label>
          <button class="tagRemoveBtn" type="button" data-tag-remove="${escapeHtml(tag)}" aria-label="Excluir tag">x</button>
        </span>`
      ));
      searchTagList.innerHTML = rows.join("");
      searchTagInputs = Array.from(searchTagList.querySelectorAll("[data-search-tag]"));
      searchTagInputs.forEach(inp => {
        const v = (inp.value || "").toString().trim().toLowerCase();
        inp.checked = searchTagsFilter.includes(v);
      });
    }

    function normalizeQuickLinkUrl(value){
      const v = (value || "").toString().trim();
      if(!v) return "";
      if(/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return v;
      return `https://${v}`;
    }

    function getNuvemList(store){
      return Array.isArray(nuvemLinks[store]) ? nuvemLinks[store] : [];
    }

    function findNuvemItem(store, id){
      return getNuvemList(store).find(item => item.id === id);
    }

    function addQuickLink(key, title, url){
      const current = Array.isArray(quickLinks[key]) ? quickLinks[key] : [];
      const nextList = [...current, { title: (title || "").toString(), url: (url || "").toString() }];
      saveQuickLinks({ ...quickLinks, [key]: nextList });
    }
    function updateQuickLink(key, index, title, url){
      const current = Array.isArray(quickLinks[key]) ? quickLinks[key] : [];
      if(index < 0 || index >= current.length) return;
      const nextList = current.map((item, idx) => {
        if(idx !== index) return item;
        return { title: (title || "").toString(), url: (url || "").toString() };
      });
      saveQuickLinks({ ...quickLinks, [key]: nextList });
    }
    function deleteQuickLink(key, index){
      const current = Array.isArray(quickLinks[key]) ? quickLinks[key] : [];
      if(index < 0 || index >= current.length) return;
      const nextList = current.filter((_, idx) => idx !== index);
      saveQuickLinks({ ...quickLinks, [key]: nextList });
    }

    function openQuickLinkModal(key, label){
      pendingQuickLinkKey = (key || "").toString();
      pendingQuickLinkLabel = (label || "").toString();
      currentQuickLinkEditIndex = -1;
      if(quickLinkLabel){
        quickLinkLabel.textContent = pendingQuickLinkKey === "sakChat"
          ? "Cadastrar link de atendimento:"
          : `Cadastrar link para ${pendingQuickLinkLabel}:`;
      }
      if(quickLinkTitleInput) quickLinkTitleInput.value = "";
      if(quickLinkUrlInput) quickLinkUrlInput.value = "";
      if(quickLinkNote){
        if(pendingQuickLinkKey === "sakChat"){
          quickLinkNote.textContent = "Aqui voc\u00ea deve cadastrar o link do seu atendimento via WhatsApp ou de algum programa que voc\u00ea use, como o SAK, por exemplo.";
          quickLinkNote.dataset.example = "https://api.whatsapp.com/send?phone=5521999999999";
          quickLinkNote.textContent += " Exemplo: https://api.whatsapp.com/send?phone=5521999999999";
        }else{
          quickLinkNote.textContent = "Exemplo: https://meusite.com.br";
        }
      }
      if(quickLinkOverlay){
        markOverlayForDrawerReturn(quickLinkOverlay, [quickLinkCancelBtn]);
        quickLinkOverlay.classList.add("show");
      }
      if(quickLinkTitleInput) quickLinkTitleInput.focus();
    }

    function openQuickLinkEditModal(key, label, index){
      const list = Array.isArray(quickLinks[key]) ? quickLinks[key] : [];
      const item = list[index];
      if(!item) return;
      pendingQuickLinkKey = (key || "").toString();
      pendingQuickLinkLabel = (label || "").toString();
      currentQuickLinkEditIndex = index;
      if(quickLinkLabel){
        quickLinkLabel.textContent = pendingQuickLinkKey === "sakChat"
          ? "Editar link de atendimento:"
          : `Editar link de ${pendingQuickLinkLabel}:`;
      }
      if(quickLinkTitleInput) quickLinkTitleInput.value = (item.title || "").toString();
      if(quickLinkUrlInput) quickLinkUrlInput.value = (item.url || "").toString();
      if(quickLinkNote){
        if(pendingQuickLinkKey === "sakChat"){
          quickLinkNote.textContent = "Aqui voc\u00ea deve cadastrar o link do seu atendimento via WhatsApp ou de algum programa que voc\u00ea use, como o SAK, por exemplo.";
          quickLinkNote.dataset.example = "https://api.whatsapp.com/send?phone=5521999999999";
          quickLinkNote.textContent += " Exemplo: https://api.whatsapp.com/send?phone=5521999999999";
        }else{
          quickLinkNote.textContent = "Exemplo: https://meusite.com.br";
        }
      }
      if(quickLinkOverlay){
        markOverlayForDrawerReturn(quickLinkOverlay, [quickLinkCancelBtn]);
        quickLinkOverlay.classList.add("show");
      }
      if(quickLinkTitleInput) quickLinkTitleInput.focus();
    }

    function closeQuickLinkModal(){
      if(quickLinkOverlay) quickLinkOverlay.classList.remove("show");
      pendingQuickLinkKey = "";
      pendingQuickLinkLabel = "";
      currentQuickLinkEditIndex = -1;
    }

    function saveQuickLinkModal(){
      if(!pendingQuickLinkKey) return;
      const key = pendingQuickLinkKey;
      const label = pendingQuickLinkLabel;
      const title = (quickLinkTitleInput ? quickLinkTitleInput.value : "").toString().trim();
      const url = normalizeQuickLinkUrl(quickLinkUrlInput ? quickLinkUrlInput.value : "");
      if(!url) return;
      if(currentQuickLinkEditIndex >= 0){
        updateQuickLink(key, currentQuickLinkEditIndex, title, url);
      }else{
        addQuickLink(key, title, url);
      }
      closeQuickLinkModal();
      clearDrawerReturnState(quickLinkOverlay, [quickLinkCancelBtn]);
      openQuickLinksListModal(key, label, currentQuickLinksListMode);
    }

    function openQuickLinksListModal(key, label, mode){
      currentQuickLinksListKey = (key || "").toString();
      currentQuickLinksListLabel = (label || "").toString();
      currentQuickLinksListMode = (mode === "manage") ? "manage" : "list";
      if(quickLinksListTitle){
        quickLinksListTitle.textContent = currentQuickLinksListMode === "manage"
          ? `Gerenciar bot\u00f5es: ${currentQuickLinksListLabel || "Links"}`
          : (currentQuickLinksListLabel || "Links");
      }
      renderQuickLinksList();
      if(quickLinksListOverlay){
        markOverlayForDrawerReturn(quickLinksListOverlay, [quickLinksListCloseBtn]);
        quickLinksListOverlay.classList.add("show");
      }
    }

    function closeQuickLinksListModal(){
      if(quickLinksListOverlay) quickLinksListOverlay.classList.remove("show");
      currentQuickLinksListKey = "";
      currentQuickLinksListLabel = "";
      currentQuickLinksListMode = "list";
    }

    function renderQuickLinksList(){
      if(!quickLinksListHost) return;
      const list = Array.isArray(quickLinks[currentQuickLinksListKey]) ? quickLinks[currentQuickLinksListKey] : [];
      if(!list.length){
        quickLinksListHost.innerHTML = `<div class="note">Nenhum link cadastrado.</div>`;
        return;
      }
      if(currentQuickLinksListMode === "manage"){
        const rows = list.map((item, idx) => {
          const title = (item.title || "").trim();
          const label = title || item.url;
          const url = (item.url || "").trim();
          return `
            <div class="quickLinksManageRow">
              <div class="quickLinksManageInfo">
                <div class="quickLinksManageTitle">${escapeHtml(label)}</div>
                <div class="quickLinksManageUrl">${escapeHtml(url)}</div>
              </div>
              <div class="quickLinksManageActions">
                <button class="btn small iconBtn" type="button" data-quick-link-edit="${idx}" title="Editar" aria-label="Editar">
                  <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                  </svg>
                </button>
                <button class="btn small danger iconBtn" type="button" data-quick-link-del="${idx}" title="Excluir" aria-label="Excluir">
                  <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 6h18"></path>
                    <path d="M8 6V4h8v2"></path>
                    <rect x="6" y="6" width="12" height="14" rx="2"></rect>
                    <path d="M10 10v6"></path>
                    <path d="M14 10v6"></path>
                  </svg>
                </button>
              </div>
            </div>
          `;
        });
        quickLinksListHost.innerHTML = rows.join("");
        return;
      }
      const rows = list.map((item) => {
        const title = (item.title || "").trim();
        const label = title || item.url;
        return `<button class="btn small" type="button" data-quick-link-url="${escapeHtml(item.url)}">${escapeHtml(label)}</button>`;
      });
      quickLinksListHost.innerHTML = rows.join("");
    }

    function renderExtraMenuLinks(){
      const renderLinks = (host, key) => {
        if(!host) return;
        const list = Array.isArray(quickLinks[key]) ? quickLinks[key] : [];
        host.innerHTML = list.map(item => {
          const title = (item?.title || "").toString().trim();
          const label = title || item.url;
          const url = (item?.url || "").toString().trim();
          if(!url) return "";
          return `<a class="btn small" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
        }).join("");
      };
      renderLinks(productsExtraLinks, "productsExtra");
      renderLinks(transportadorasExtraLinks, "transportadorasExtra");
    }

    function renderNuvemLinks(){
      if(!nuvemLinksHost) return;
      const blocks = getStoreNames().map(store => {
        const storeData = getStoreByName(store);
        const logoUrl = storeData ? (storeData.logoUrl || "") : "";
        const list = getNuvemList(store);
        const pageSize = 3;
        const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
        const currentPage = Math.min(Math.max(1, Number(nuvemPageByStore[store] || 1)), totalPages);
        nuvemPageByStore[store] = currentPage;
        const start = (currentPage - 1) * pageSize;
        const pageItems = list.slice(start, start + pageSize);

        const rows = pageItems.map((item, idx) => {
          const absoluteIndex = start + idx;
          const canUp = absoluteIndex > 0;
          const canDown = absoluteIndex < list.length - 1;
          const rowClass = idx === pageItems.length - 1 ? "nuvemItemRow isLast" : "nuvemItemRow";
          return `
            <div class="${rowClass}">
              <button class="btn small" type="button" data-nuvem-open="${escapeHtml(item.id)}" data-nuvem-store="${escapeHtml(store)}">${escapeHtml(item.label)}</button>
              <div class="nuvemActions">
                <button class="nuvemEditIcon" type="button" data-nuvem-edit="${escapeHtml(item.id)}" data-nuvem-store="${escapeHtml(store)}" aria-label="Editar">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                  </svg>
                </button>
                <span class="nuvemActionDivider" aria-hidden="true"></span>
                <div class="nuvemMoveGroup" aria-hidden="true">
                  <button class="nuvemMoveBtn" type="button" data-nuvem-move="up" data-nuvem-id="${escapeHtml(item.id)}" data-nuvem-store="${escapeHtml(store)}" ${canUp ? "" : "disabled"}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <polyline points="6 15 12 9 18 15"></polyline>
                    </svg>
                  </button>
                  <button class="nuvemMoveBtn" type="button" data-nuvem-move="down" data-nuvem-id="${escapeHtml(item.id)}" data-nuvem-store="${escapeHtml(store)}" ${canDown ? "" : "disabled"}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          `;
        });
        const pager = `
          <div class="nuvemPager">
            <button class="btn small" type="button" data-nuvem-prev="${escapeHtml(store)}">&#x25C0;</button>
            <div class="count">P\u00e1gina ${currentPage}/${totalPages}</div>
            <button class="btn small" type="button" data-nuvem-next="${escapeHtml(store)}">&#x25B6;</button>
          </div>
        `;
        return `
          <div class="menuCard">
            <div class="menuTop nuvemMenuTop">
              <div class="menuIcon">${logoUrl ? `<img alt="${escapeHtml(store)}" src="${escapeHtml(logoUrl)}">` : `<div class="txt">NS</div>`}</div>
              <p class="menuTitle">${escapeHtml(store)}</p>
              <div class="nuvemHeaderRight">
                <button class="btn small iconBtn" type="button" data-nuvem-add="${escapeHtml(store)}" title="Adicionar bot\u00e3o" aria-label="Adicionar bot\u00e3o">
                  <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>
            </div>
            <div class="menuBtnsRow">
              <div class="nuvemList">
                ${rows.join("")}
              </div>
              ${pager}
            </div>
          </div>
        `;
      });
      nuvemLinksHost.innerHTML = blocks.join("");
    }

    function openNuvemLinksModal(){
      renderNuvemLinks();
      if(nuvemLinksOverlay){
        markOverlayForDrawerReturn(nuvemLinksOverlay, [nuvemLinksCloseBtn]);
        nuvemLinksOverlay.classList.add("show");
      }
    }

    function closeNuvemLinksModal(){
      if(nuvemLinksOverlay) nuvemLinksOverlay.classList.remove("show");
    }

    function openHeaderNuvemshopSupport(){
      const list = (stores && stores.length) ? stores : DEFAULT_STORES;
      const options = (list || [])
        .map(s => ({ name: (s?.name || "").toString().trim() }))
        .filter(s => s.name);
      if(!options.length){
        showAlert("Nenhum suporte configurado.");
        return;
      }
      if(options.length === 1){
        openNuvemshopSupportPopup(options[0].name, "");
        return;
      }
      openPopup({ title: "Suporte Nuvemshop", message: "", okLabel: "", showCancel: false });
      if(!popupMessage) return;
      const buttons = options.map(o => (
        `<button class="btn small" type="button" data-support-store-name="${escapeHtml(o.name)}">${escapeHtml(o.name)}</button>`
      )).join("");
      popupMessage.innerHTML = `
        <div class="popupQuickPick">
          <div class="popupQuickPickTitle">Escolha a loja</div>
          <div class="popupQuickPickOptions">${buttons}</div>
        </div>
      `;
      popupMessage.querySelectorAll("[data-support-store-name]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const storeName = (btn.getAttribute("data-support-store-name") || "").trim();
          closePopup(false);
          if(storeName) openNuvemshopSupportPopup(storeName, "");
        });
      });
    }

    function openNuvemEditModal(store, id, isNew){
      nuvemEditStore = (store || "").toString();
      nuvemEditId = (id || "").toString();
      nuvemEditIsNew = Boolean(isNew);
      const item = isNew ? null : findNuvemItem(nuvemEditStore, nuvemEditId);
      if(nuvemEditTitle){
        nuvemEditTitle.textContent = isNew ? "Novo botao" : "Editar link";
      }
      if(nuvemEditLabelInput){
        nuvemEditLabelInput.value = item ? item.label : "";
        nuvemEditLabelInput.readOnly = Boolean(item && item.fixed);
      }
      if(nuvemEditUrlInput){
        nuvemEditUrlInput.value = item ? item.url : "";
      }
      if(nuvemEditDeleteBtn){
        nuvemEditDeleteBtn.style.display = (!isNew && item && !item.fixed) ? "" : "none";
      }
      if(nuvemEditOverlay) nuvemEditOverlay.classList.add("show");
      if(nuvemEditUrlInput) nuvemEditUrlInput.focus();
    }

    function closeNuvemEditModal(){
      if(nuvemEditOverlay) nuvemEditOverlay.classList.remove("show");
      nuvemEditStore = "";
      nuvemEditId = "";
      nuvemEditIsNew = false;
    }

    function saveNuvemEditModal(){
      if(!nuvemEditStore) return;
      const label = (nuvemEditLabelInput ? nuvemEditLabelInput.value : "").toString().trim();
      const url = normalizeQuickLinkUrl(nuvemEditUrlInput ? nuvemEditUrlInput.value : "");
      if(!url){
        showAlert("Digite o link.");
        return;
      }
      const list = getNuvemList(nuvemEditStore);
      if(nuvemEditIsNew){
        if(!label){
          showAlert("Digite o t\u00edtulo do bot\u00e3o.");
          return;
        }
        const next = [...list, { id: uid(), label, url, fixed:false }];
        saveNuvemLinks({ ...nuvemLinks, [nuvemEditStore]: next });
        const totalPages = Math.max(1, Math.ceil(next.length / 3));
        nuvemPageByStore[nuvemEditStore] = totalPages;
        closeNuvemEditModal();
        return;
      }

      const next = list.map(item => {
        if(item.id !== nuvemEditId) return item;
        return { ...item, url, label: item.fixed ? item.label : (label || item.label) };
      });
      saveNuvemLinks({ ...nuvemLinks, [nuvemEditStore]: next });
      closeNuvemEditModal();
    }

    function deleteNuvemEditModal(){
      if(!nuvemEditStore || !nuvemEditId) return;
      const list = getNuvemList(nuvemEditStore);
      const next = list.filter(item => item.id !== nuvemEditId);
      saveNuvemLinks({ ...nuvemLinks, [nuvemEditStore]: next });
      closeNuvemEditModal();
    }

    function cloneStoresList(list){
      return (list || []).map(s => {
        const emailList = Array.isArray(s?.emailList) ? s.emailList.map(item => ({
          email: (item?.email || "").toString(),
          openUrl: (item?.openUrl || "").toString()
        })) : [];
        if(!emailList.length){
          const admin = (s?.emailAdmin || "").toString().trim();
          const atendimento = (s?.emailAtendimento || "").toString().trim();
          if(admin) emailList.push({ email: admin, openUrl: (s?.emailOpenUrl1 || s?.emailOpenUrl || "").toString() });
          if(atendimento) emailList.push({ email: atendimento, openUrl: (s?.emailOpenUrl2 || s?.emailOpenUrl || "").toString() });
        }
        return {
          name: (s?.name || "").toString(),
          logoUrl: (s?.logoUrl || "").toString(),
          siteUrl: (s?.siteUrl || "").toString(),
          stampsUrl: (s?.stampsUrl || "").toString(),
          supportWhatsapp: (s?.supportWhatsapp || "").toString(),
          instagramUrl: (s?.instagramUrl || "").toString(),
          facebookUrl: (s?.facebookUrl || "").toString(),
          tiktokUrl: (s?.tiktokUrl || "").toString(),
          youtubeUrl: (s?.youtubeUrl || "").toString(),
          pinterestUrl: (s?.pinterestUrl || "").toString(),
          whatsappUrl: (s?.whatsappUrl || "").toString(),
          socialExtras: Array.isArray(s?.socialExtras) ? s.socialExtras.map(item => ({
            name: (item?.name || "").toString(),
            url: (item?.url || "").toString()
          })) : [],
          metaInboxUrl: (s?.metaInboxUrl || "").toString(),
          emailList,
          emailAdmin: (s?.emailAdmin || "").toString(),
          emailAtendimento: (s?.emailAtendimento || "").toString(),
          emailOpenUrl1: (s?.emailOpenUrl1 || s?.emailOpenUrl || "").toString(),
          emailOpenUrl2: (s?.emailOpenUrl2 || s?.emailOpenUrl || "").toString()
        };
      });
    }

    function renderStoresConfig(){
      if(!storesConfigHost) return;
      const list = storesDraft.length ? storesDraft : [];
      const cards = list.map((store, idx) => {
        const fieldId = (name) => `store-${idx}-${name}`;
        const extras = Array.isArray(store.socialExtras) ? store.socialExtras : [];
        const extrasHtml = extras.length
          ? extras.map((item, j) => {
              const nameId = `store-${idx}-social-${j}-name`;
              const urlId = `store-${idx}-social-${j}-url`;
              return `
              <div class="socialExtraRow" data-social-extra-row="${j}">
                <div class="fieldStack">
                  <input id="${nameId}" type="text" data-social-extra-field="name" data-social-extra-index="${j}" placeholder="Nome da rede" value="${escapeHtml(item?.name || "")}">
                  <div class="fieldError" data-error-for="${nameId}"></div>
                </div>
                <div class="fieldStack">
                  <input id="${urlId}" type="text" data-social-extra-field="url" data-social-extra-index="${j}" placeholder="Link de atendimento" value="${escapeHtml(item?.url || "")}">
                  <div class="fieldError" data-error-for="${urlId}"></div>
                </div>
                <button class="specsRemoveBtn" type="button" data-social-extra-remove="${j}" title="Remover" aria-label="Remover">x</button>
              </div>
            `;
            }).join("")
          : `<div class="note">Nenhuma rede adicional cadastrada.</div>`;
        const emails = Array.isArray(store.emailList) ? store.emailList : [];
        const emailsHtml = emails.length
          ? emails.map((item, j) => {
              const emailId = `store-${idx}-email-${j}-email`;
              const openId = `store-${idx}-email-${j}-open`;
              return `
              <div class="emailExtraRow" data-email-row="${j}">
                <div class="fieldStack">
                  <input id="${emailId}" type="text" data-email-field="email" data-email-index="${j}" placeholder="E-mail" value="${escapeHtml(item?.email || "")}">
                  <div class="fieldError" data-error-for="${emailId}"></div>
                </div>
                <div class="fieldStack">
                  <input id="${openId}" type="text" data-email-field="openUrl" data-email-index="${j}" placeholder="Link de acesso" value="${escapeHtml(item?.openUrl || "")}">
                  <div class="fieldError" data-error-for="${openId}"></div>
                </div>
                <button class="specsRemoveBtn" type="button" data-email-remove="${j}" title="Remover" aria-label="Remover">x</button>
              </div>
            `;
            }).join("")
          : `<div class="note">Nenhum e-mail cadastrado.</div>`;
        return `
          <div class="menuCard" data-store-index="${idx}">
            <div class="menuTop">
              <div class="menuIcon"><div class="txt">${idx + 1}</div></div>
              <p class="menuTitle">Loja ${idx + 1}</p>
            </div>
            <div class="formGrid">
              <div class="label">Nome da loja</div>
              <input id="${fieldId("name")}" type="text" data-store-field="name" placeholder="Nome da loja" value="${escapeHtml(store.name || "")}">
              <div class="fieldError" data-error-for="${fieldId("name")}"></div>
              <div class="label">Link da logo</div>
              <div class="note">Informe o link da logo ou envie o arquivo abaixo.</div>
              <input id="${fieldId("logoUrl")}" type="text" data-store-field="logoUrl" placeholder="Link da logo" value="${escapeHtml(store.logoUrl || "")}">
              <div class="fieldError" data-error-for="${fieldId("logoUrl")}"></div>
              <div class="label">Enviar logo</div>
              <input id="${fieldId("logoFile")}" type="file" data-store-field="logoFile" accept="image/*">
              <div class="label">Link do site da loja</div>
              <input id="${fieldId("siteUrl")}" type="text" data-store-field="siteUrl" placeholder="Link do site da loja" value="${escapeHtml(store.siteUrl || "")}">
              <div class="fieldError" data-error-for="${fieldId("siteUrl")}"></div>
              <div class="label">Link das estampas</div>
              <input id="${fieldId("stampsUrl")}" type="text" data-store-field="stampsUrl" placeholder="Link das estampas" value="${escapeHtml(store.stampsUrl || "")}">
              <div class="fieldError" data-error-for="${fieldId("stampsUrl")}"></div>
              <div class="label">WhatsApp (atendimento)</div>
              <input id="${fieldId("whatsappUrl")}" type="text" data-store-field="whatsappUrl" placeholder="Link de atendimento do WhatsApp" value="${escapeHtml(store.whatsappUrl || "")}">
              <div class="fieldError" data-error-for="${fieldId("whatsappUrl")}"></div>
              <div class="label">Redes sociais</div>
              <div class="note">Use o link do atendimento/caixa de entrada (onde voce responde aos clientes), nao o link do perfil da rede social.</div>
              ${extrasHtml}
              <button class="btn small" type="button" data-social-extra-add="${idx}">+ Adicionar rede</button>
              <div class="label">E-mails</div>
              <div class="note">Insira o e-mail e o link de acesso correspondente.</div>
              ${emailsHtml}
              <button class="btn small" type="button" data-email-add="${idx}">+ Adicionar e-mail</button>
              <div class="label">WhatsApp suporte Nuvemshop</div>
              <input id="${fieldId("supportWhatsapp")}" type="text" data-store-field="supportWhatsapp" placeholder="Link do WhatsApp de suporte" value="${escapeHtml(store.supportWhatsapp || "")}">
              <div class="fieldError" data-error-for="${fieldId("supportWhatsapp")}"></div>
            </div>
            ${idx > 0 ? `<div class="menuToolsRow"><button class="btn small danger iconBtn" type="button" data-store-remove="${idx}" title="Excluir" aria-label="Excluir">
              <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18"></path>
                <path d="M8 6V4h8v2"></path>
                <rect x="6" y="6" width="12" height="14" rx="2"></rect>
                <path d="M10 10v6"></path>
                <path d="M14 10v6"></path>
              </svg>
            </button></div>` : ""}
          </div>
        `;
      });
      storesConfigHost.innerHTML = cards.join("");
    }

    function openStoresConfig(options){
      storesRequired = Boolean(options?.required);
      const emptyStore = { name:"", logoUrl:"", siteUrl:"", stampsUrl:"", supportWhatsapp:"", instagramUrl:"", facebookUrl:"", tiktokUrl:"", youtubeUrl:"", pinterestUrl:"", metaInboxUrl:"", emailList: [] };
      const base = stores.length ? stores : [emptyStore];
      storesDraft = cloneStoresList(base);
      renderStoresConfig();
      if(storesConfigCloseBtn){
        storesConfigCloseBtn.style.display = storesRequired ? "none" : "inline-flex";
      }
      if(storesConfigOverlay) storesConfigOverlay.classList.add("show");
    }

    function closeStoresConfig(){
      if(storesRequired) return;
      if(storesConfigOverlay) storesConfigOverlay.classList.remove("show");
    }

    function collectStoresFromForm(){
      if(!storesConfigHost) return [];
      const cards = Array.from(storesConfigHost.querySelectorAll("[data-store-index]"));
      const next = cards.map(card => {
        const read = (field) => {
          const el = card.querySelector(`[data-store-field="${field}"]`);
          return el ? (el.value || "").toString().trim() : "";
        };
        return {
          name: read("name"),
          logoUrl: read("logoUrl"),
          siteUrl: read("siteUrl"),
          stampsUrl: read("stampsUrl"),
          supportWhatsapp: read("supportWhatsapp"),
          instagramUrl: read("instagramUrl"),
          facebookUrl: read("facebookUrl"),
          tiktokUrl: read("tiktokUrl"),
          youtubeUrl: read("youtubeUrl"),
          pinterestUrl: read("pinterestUrl"),
          whatsappUrl: read("whatsappUrl"),
          socialExtras: Array.from(card.querySelectorAll("[data-social-extra-row]")).map(row => {
            const nameInput = row.querySelector('[data-social-extra-field="name"]');
            const urlInput = row.querySelector('[data-social-extra-field="url"]');
            return {
              name: nameInput ? (nameInput.value || "").toString().trim() : "",
              url: urlInput ? (urlInput.value || "").toString().trim() : ""
            };
          }).filter(item => item.name || item.url),
          emailList: Array.from(card.querySelectorAll("[data-email-row]")).map(row => {
            const emailInput = row.querySelector('[data-email-field="email"]');
            const urlInput = row.querySelector('[data-email-field="openUrl"]');
            return {
              email: emailInput ? (emailInput.value || "").toString().trim() : "",
              openUrl: urlInput ? (urlInput.value || "").toString().trim() : ""
            };
          }).filter(item => item.email || item.openUrl)
        };
      });
      return normalizeStores(next);
    }

    function validateStoresConfigForm(){
      if(!storesConfigHost) return false;
      const cards = Array.from(storesConfigHost.querySelectorAll("[data-store-index]"));
      if(!cards.length) return false;
      let ok = true;

      cards.forEach(card => {
        const inputs = Array.from(card.querySelectorAll("input, textarea, select"));
        inputs.forEach(clearFieldError);

        const read = (field) => {
          const el = card.querySelector(`[data-store-field="${field}"]`);
          return el ? (el.value || "").toString().trim() : "";
        };
        const get = (field) => card.querySelector(`[data-store-field="${field}"]`);

        const nameInput = get("name");
        const logoInput = get("logoUrl");
        const siteInput = get("siteUrl");
        const stampsInput = get("stampsUrl");
        const whatsappInput = get("whatsappUrl");
        const supportInput = get("supportWhatsapp");

        const nameVal = read("name");
        const logoVal = read("logoUrl");
        const siteVal = read("siteUrl");
        const stampsVal = read("stampsUrl");
        const whatsappVal = read("whatsappUrl");
        const supportVal = read("supportWhatsapp");

        if(!nameVal){
          setFieldError(nameInput, "Preencha o nome da loja.");
          ok = false;
        }
        if(!logoVal){
          setFieldError(logoInput, "Informe o link da logo.");
          ok = false;
        }else if(!isValidUrl(logoVal, { allowData:true })){
          setFieldError(logoInput, "Link da logo invalido.");
          ok = false;
        }
        if(siteVal && !isValidUrl(siteVal)){
          setFieldError(siteInput, "Link do site invalido.");
          ok = false;
        }
        if(stampsVal && !isValidUrl(stampsVal)){
          setFieldError(stampsInput, "Link das estampas invalido.");
          ok = false;
        }
        if(!whatsappVal){
          setFieldError(whatsappInput, "Informe o link do WhatsApp.");
          ok = false;
        }else if(!isValidUrl(whatsappVal)){
          setFieldError(whatsappInput, "Link do WhatsApp invalido.");
          ok = false;
        }
        if(supportVal && !isValidUrl(supportVal)){
          setFieldError(supportInput, "Link de suporte invalido.");
          ok = false;
        }

        card.querySelectorAll("[data-social-extra-row]").forEach(row => {
          const nameInput = row.querySelector('[data-social-extra-field="name"]');
          const urlInput = row.querySelector('[data-social-extra-field="url"]');
          const nameVal = nameInput ? (nameInput.value || "").toString().trim() : "";
          const urlVal = urlInput ? (urlInput.value || "").toString().trim() : "";
          if(nameVal || urlVal){
            if(!nameVal){
              setFieldError(nameInput, "Informe o nome da rede.");
              ok = false;
            }
            if(!urlVal){
              setFieldError(urlInput, "Informe o link da rede.");
              ok = false;
            }else if(!isValidUrl(urlVal)){
              setFieldError(urlInput, "Link invalido.");
              ok = false;
            }
          }
        });

        card.querySelectorAll("[data-email-row]").forEach(row => {
          const emailInput = row.querySelector('[data-email-field="email"]');
          const openInput = row.querySelector('[data-email-field="openUrl"]');
          const emailVal = emailInput ? (emailInput.value || "").toString().trim() : "";
          const openVal = openInput ? (openInput.value || "").toString().trim() : "";
          if(emailVal || openVal){
            if(!emailVal){
              setFieldError(emailInput, "Informe o e-mail.");
              ok = false;
            }else if(!isValidEmail(emailVal)){
              setFieldError(emailInput, "E-mail invalido.");
              ok = false;
            }
            if(!openVal){
              setFieldError(openInput, "Informe o link de acesso.");
              ok = false;
            }else if(!isValidUrl(openVal)){
              setFieldError(openInput, "Link de acesso invalido.");
              ok = false;
            }
          }
        });
      });

      return ok;
    }    function updateStoresUI(){
      const list = stores || [];
      const names = getStoreNames();

      if(storeLinksGrid){
        storeLinksGrid.dataset.count = String(list.length || 0);
        storeLinksGrid.innerHTML = list.map(store => {
          const url = (store.siteUrl || "").trim();
          const tag = "button";
          const attrs = `type="button" data-open-stores-config="1"`;
          const cls = store === list[0] ? "storeLinkLogo dn" : "storeLinkLogo";
          const logoUrl = (store.logoUrl || "").trim();
          const nameHtml = `<div class="storeLinkName${logoUrl ? " isHidden" : ""}">${escapeHtml(store.name)}</div>`;
          const logoHtml = logoUrl
            ? `<img class="${cls}" alt="${escapeHtml(store.name)}" src="${escapeHtml(logoUrl)}" onerror="this.style.display='none';const n=this.closest('.storeLinkCard').querySelector('.storeLinkName');if(n){n.style.display='block';n.classList.remove('isHidden');}">`
            : "";
          const siteBtn = url
            ? `<a class="btn small storeLinkSiteBtn" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Loja</a>`
            : "";
          return `<${tag} class="storeLinkCard" ${attrs}>
            <div class="storeLinkMedia">
              ${logoHtml}
              ${nameHtml}
            </div>
            <div class="storeLinkActions">
              ${siteBtn}
            </div>
          </${tag}>`;
        }).join("");
      }

      if(metaInboxGrid){
        metaInboxGrid.dataset.count = String(list.length || 0);
        metaInboxGrid.innerHTML = list.map(store => {
          const cls = store === list[0] ? "storeLinkLogo dn" : "storeLinkLogo";
          const buttons = [];
          const whatsappUrl = (store.whatsappUrl || "").trim();
          if(whatsappUrl){
            buttons.push(`<a class="btn small" href="${escapeHtml(whatsappUrl)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`);
          }
          const extras = Array.isArray(store.socialExtras) ? store.socialExtras : [];
          extras.forEach(item => {
            const label = (item?.name || "").toString().trim();
            const url = (item?.url || "").toString().trim();
            if(!url) return;
            buttons.push(`<a class="btn small" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label || url)}</a>`);
          });
          const fallback = buttons.length
            ? ""
            : `<button class="btn small" type="button" data-open-stores-config="1">Adicionar redes</button>`;
          const logoUrl = (store.logoUrl || "").trim();
          const nameHtml = `<div class="storeLinkName${logoUrl ? " isHidden" : ""}">${escapeHtml(store.name)}</div>`;
          const logoHtml = logoUrl
            ? `<img class="${cls}" alt="${escapeHtml(store.name)}" src="${escapeHtml(logoUrl)}" onerror="this.style.display='none';const n=this.closest('.socialLinksCard').querySelector('.storeLinkName');if(n){n.style.display='block';n.classList.remove('isHidden');}">`
            : "";
          return `
            <div class="storeLinkCard socialLinksCard">
              <div class="storeLinkMedia">
                ${logoHtml}
                ${nameHtml}
              </div>
              <div class="storeLinkActions">
                <div class="socialLinksActions">${buttons.join("") || fallback}</div>
              </div>
            </div>
          `;
        }).join("");
      }

      if(stampsLinksRow){
        const stamped = list.filter(store => (store.stampsUrl || "").trim());
        stampsLinksRow.innerHTML = stamped.map(store => {
          const url = (store.stampsUrl || "").trim();
          return `<a class="btn small" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Estampas ${escapeHtml(store.name)}</a>`;
        }).join("");
      }

      if(emailMenuHost){
        const cards = list.map(store => {
          const emailList = Array.isArray(store.emailList) ? store.emailList : [];
          const getEmailLabel = (email) => {
            const atIndex = email.indexOf("@");
            const name = atIndex > 0 ? email.slice(0, atIndex) : email;
            return (name || "E-mail").toString().trim();
          };
          const rows = [];
          const renderEmailRow = (entry) => {
            const email = (entry?.email || "").toString().trim();
            const openUrl = (entry?.openUrl || "").toString().trim();
            if(!email && !openUrl) return "";
            const openBtn = openUrl
              ? `<a class="emailOpenIcon" href="${escapeHtml(openUrl)}" target="_blank" rel="noopener noreferrer" title="Abrir e-mail" aria-label="Abrir e-mail">
                  <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"></path>
                  </svg>
                </a>`
              : `<button class="btn small" type="button" data-open-stores-config="1">Adicionar link</button>`;
            return `
              <div class="emailBtn">
                <div class="emailBtnTitleRow">
                  <span class="emailBtnTitle">${escapeHtml(getEmailLabel(email))}</span>
                  ${openUrl ? openBtn : ""}
                </div>
                <div class="emailBtnRow">
                  <span class="emailBtnAddr">${escapeHtml(email)}</span>
                  <button class="copyIconBtn" type="button" data-copy-email="${escapeHtml(email)}" title="Copiar e-mail" aria-label="Copiar e-mail">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="9" y="9" width="10" height="10" rx="2"></rect>
                      <rect x="5" y="5" width="10" height="10" rx="2"></rect>
                    </svg>
                  </button>
                </div>
                ${openUrl ? "" : `<div class="emailBtnActions">${openBtn}</div>`}
              </div>
            `;
          };
          const emailHtml = emailList.map(renderEmailRow).filter(Boolean).join("");
          if(emailHtml) rows.push(emailHtml);
          return `
            <div class="menuCard">
              <div class="menuTop">
                <div class="menuIcon"><img alt="${escapeHtml(store.name)}" src="${escapeHtml(store.logoUrl)}"></div>
                <p class="menuTitle">${escapeHtml(store.name)}</p>
              </div>
              <div class="menuBtnsRow">
                <div class="emailBtnGroup">
                  ${rows.join("") || `<div class="note">Nenhum e-mail cadastrado.</div>`}
                </div>
              </div>
            </div>
          `;
        });
        emailMenuHost.innerHTML = cards.join("");
      }

      if(qStoreSelect){
        const options = ['<option value="ALL" selected>Todas as lojas</option>']
          .concat(names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`));
        qStoreSelect.innerHTML = options.join("");
      }
      if(searchStoreSelect){
        const options = ['<option value="" selected>Escolha a loja</option>']
          .concat(names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`));
        searchStoreSelect.innerHTML = options.join("");
      }
      if(tasksSearchStore){
        const options = ['<option value="" selected>Todas as lojas</option>']
          .concat(names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`));
        tasksSearchStore.innerHTML = options.join("");
      }
      if(doneSearchStore){
        const options = ['<option value="" selected>Todas as lojas</option>']
          .concat(names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`));
        doneSearchStore.innerHTML = options.join("");
      }
      if(tLoja){
        const options = ['<option value="" selected>Escolha a loja</option>']
          .concat(names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`));
        tLoja.innerHTML = options.join("");
      }
      if(simpleTaskStore){
        const options = ['<option value="" selected>Escolha a loja</option>']
          .concat(names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`));
        simpleTaskStore.innerHTML = options.join("");
      }
      if(orderLookupStore){
        const options = ['<option value="" selected>Escolha a loja</option>']
          .concat(names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`));
        orderLookupStore.innerHTML = options.join("");
      }

      if(orderLookupLogoDn && list[0]){
        orderLookupLogoDn.src = list[0].logoUrl || "";
        orderLookupLogoDn.alt = list[0].name || "";
      }
      if(orderLookupLogoShop80 && list[1]){
        orderLookupLogoShop80.src = list[1].logoUrl || "";
        orderLookupLogoShop80.alt = list[1].name || "";
      }
      if(orderLookupMenu){
        const titles = orderLookupMenu.querySelectorAll(".menuTitle");
        if(titles[0] && list[0]) titles[0].textContent = list[0].name || "";
        if(titles[1] && list[1]) titles[1].textContent = list[1].name || "";
      }

      updateCalendarStoreFilterOptions();
      buildProductsGrid();

      nuvemLinks = normalizeNuvemLinks(nuvemLinks);
      storageSet(STORAGE_KEY_NUVEM_LINKS, JSON.stringify(nuvemLinks));
      renderNuvemLinks();
    }

    function updateCalendarStoreFilterOptions(){
      if(!calStoreFilter) return;
      const names = getStoreNames();
      const current = (calStoreFilterValue || "").trim();
      const opts = ['<option value="" selected>Todas as lojas</option>'];
      names.forEach(name => {
        opts.push(`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`);
      });
      calStoreFilter.innerHTML = opts.join("");
      if(current && names.includes(current)){
        calStoreFilter.value = current;
      }else{
        calStoreFilter.value = "";
        calStoreFilterValue = "";
      }
      updateFilterButtonsState();
    }

    function matchesCalendarStoreFilter(entry){
      const filter = (calStoreFilterValue || "").trim();
      if(!filter) return true;
      const loja = (entry?.loja || "").toString().trim();
      return loja === filter;
    }

    function shouldIncludeDailyRepeatOnDate(entry, iso){
      if(!shouldIncludeRepeatWindow(entry, iso)) return false;
      return true;
    }

    function getCalendarEntriesForDate(iso, options){
      if(!iso) return [];
      const applyStoreFilter = options?.applyStoreFilter !== false;
      const visibleHistory = getVisibleCalendarHistoryList(calendarHistory);
      const base = (visibleHistory || [])
        .filter(e => e.date === iso)
        .filter(e => !isCalendarRepeatEntry(e));
      const repeatEntries = (visibleHistory || []).filter(isCalendarRepeatEntry);
      const repeats = [];
      repeatEntries.forEach(entry => {
        if(isDailyRepeatCalendarEntry(entry)){
          if(shouldIncludeDailyRepeatOnDate(entry, iso)) repeats.push({ ...entry, date: iso });
          return;
        }
        if(isWeeklyRepeatCalendarEntry(entry)){
          if(shouldIncludeWeeklyRepeatOnDate(entry, iso)) repeats.push({ ...entry, date: iso });
          return;
        }
        if(isMonthlyLastWeekdayCalendarEntry(entry)){
          if(shouldIncludeMonthlyLastWeekdayOnDate(entry, iso)) repeats.push({ ...entry, date: iso });
          return;
        }
        if(isWeekdaysRepeatCalendarEntry(entry)){
          if(shouldIncludeWeekdaysRepeatOnDate(entry, iso)) repeats.push({ ...entry, date: iso });
          return;
        }
        if(isAnnualRepeatCalendarEntry(entry)){
          if(shouldIncludeAnnualRepeatOnDate(entry, iso)) repeats.push({ ...entry, date: iso });
          return;
        }
        if(isCustomRepeatCalendarEntry(entry)){
          if(shouldIncludeCustomRepeatOnDate(entry, iso)) repeats.push({ ...entry, date: iso });
        }
      });
      let entries = base.concat(repeats);
      if(applyStoreFilter) entries = entries.filter(matchesCalendarStoreFilter);
      return entries;
    }

    function setCalendarFilterPanelOpen(open){
      if(!calFilterPanel) return;
      calFilterPanel.style.display = open ? "block" : "none";
    }

    function truncateHalfWithEllipsis(text){
      const raw = (text || "").toString();
      return raw;
    }

    function updateFilterButtonsState(){
      const searchStore = (searchStoreSelect ? (searchStoreSelect.value || "").trim() : "");
      const searchActive = Boolean(searchTagsFilter.length) || (searchStore && searchStore !== "ALL");
      const tasksActive = Boolean((tasksSearchStoreValue || "").trim())
        || (tasksSearchPeriodValue || "").trim() !== "ALL"
        || Boolean((tasksSearchStatusValue || "").trim())
        || Boolean((tasksSearchPeriodFromValue || "").trim())
        || Boolean((tasksSearchPeriodToValue || "").trim());
      const doneActive = Boolean((doneSearchStoreValue || "").trim())
        || (doneSearchPeriodValue || "").trim() !== "ALL"
        || Boolean((doneSearchStatusValue || "").trim())
        || Boolean((doneSearchPeriodFromValue || "").trim())
        || Boolean((doneSearchPeriodToValue || "").trim());
      if(searchFilterBtn){
        if(currentView === "users"){
          const active = Boolean((usersSearchName || "").trim())
            || ((usersSearchStore || "").trim() && (usersSearchStore || "").trim() !== "ALL")
            || Boolean((usersSearchStatus || "").trim());
          searchFilterBtn.classList.toggle("isActive", active);
        }else{
          const active = currentView === "tasks" ? tasksActive : (currentView === "done" ? doneActive : searchActive);
          searchFilterBtn.classList.toggle("isActive", active);
        }
      }
      if(calFilterBtn){
        calFilterBtn.classList.toggle("isActive", Boolean((calStoreFilterValue || "").trim()));
      }
    }

    /***********************
     * ELEMENTS
     ***********************/
    const searchRow   = document.getElementById("searchRow");
    const searchHint  = document.getElementById("searchHint");

    const viewSearch  = document.getElementById("viewSearch");
    const viewTasks   = document.getElementById("viewTasks");
    const viewDone    = document.getElementById("viewDone");
    const viewUsers   = document.getElementById("viewUsers");
    const viewUserActivity = document.getElementById("viewUserActivity");
    const viewStack   = document.getElementById("viewStack");
    const sideMenu    = document.getElementById("sideMenu");
    const sideMenuToggle = document.getElementById("sideMenuToggle");
    const openUserProfileBtn = document.getElementById("openUserProfileBtn");
    const userAvatarImg = document.getElementById("userAvatarImg");
    const userAvatarFallback = document.getElementById("userAvatarFallback");
    const userNameLabel = document.getElementById("userName");

    const searchInput = document.getElementById("search");
    const searchStoreSelect = document.getElementById("searchStore");
    const searchClearBtn = document.getElementById("searchClearBtn");
    const searchFilterBtn = document.getElementById("searchFilterBtn");
    const searchFiltersOverlay = document.getElementById("searchFiltersOverlay");
    const searchFiltersCloseBtn = document.getElementById("searchFiltersCloseBtn");
    const searchFiltersApplyBtn = document.getElementById("searchFiltersApplyBtn");
    const searchFiltersClearBtn = document.getElementById("searchFiltersClearBtn");
    const searchTagList = document.getElementById("searchTagList");
    const searchTagNew = document.getElementById("searchTagNew");
    const addSearchTagBtn = document.getElementById("addSearchTagBtn");
    let searchTagInputs = [];
    const resultsEl  = document.getElementById("results");
    const countEl    = document.getElementById("count");

    const qInput     = document.getElementById("q");
    const qStoreSelect = document.getElementById("qStore");
    const rInput     = document.getElementById("r");
    const linksInput = document.getElementById("links");
    const tagsInput  = document.getElementById("tags");

    const qCountEl   = document.getElementById("qCount");
    const modeLabel  = document.getElementById("modeLabel");

    const saveBtn    = document.getElementById("saveBtn");
    const exportBtn  = document.getElementById("exportBtn");
    const importBtn  = document.getElementById("importBtn");
    const filePicker = document.getElementById("filePicker");
    const openQuestionModalBtn = document.getElementById("openQuestionModalBtn");
    const questionOverlay = document.getElementById("questionOverlay");
    const questionCloseBtn = document.getElementById("questionCloseBtn");
    const questionModalTitle = document.getElementById("questionModalTitle");
    const openTaskModalBtn = document.getElementById("openTaskModalBtn");
    const openExtraTaskModalBtn = document.getElementById("openExtraTaskModalBtn");
    const taskOverlay = document.getElementById("taskOverlay");
    const taskCloseBtn = document.getElementById("taskCloseBtn");

    const addStepBtn = document.getElementById("addStepBtn");
    const stepsHost  = document.getElementById("stepsHost");

    const overlay    = document.getElementById("overlay");
    const modalBody  = document.getElementById("modalBody");
    const closeModalBtn = document.getElementById("closeModalBtn");
    const okModalBtn    = document.getElementById("okModalBtn");
    const nextStepBtn   = document.getElementById("nextStepBtn");
    const prevStepBtn   = document.getElementById("prevStepBtn");

    const qPickImgsBtn = document.getElementById("qPickImgsBtn");
    const qClearImgsBtn = document.getElementById("qClearImgsBtn");
    const qImgsFile = document.getElementById("qImgsFile");
    const qImgsCount = document.getElementById("qImgsCount");
    const qImgsPreviewGrid = document.getElementById("qImgsPreviewGrid");

    const addQuestionLinkBtn = document.getElementById("addQuestionLinkBtn");
    const questionLinksHost = document.getElementById("questionLinksHost");

    const cardsNav = document.getElementById("cardsNav");
    const viewTitleText = document.getElementById("viewTitleText");

    const drawer = document.getElementById("drawer");
    const drawerBackdrop = document.getElementById("drawerBackdrop");
    const openDrawerBtn = document.getElementById("openDrawerBtn");
    const openDrawerBtnMobile = document.getElementById("openDrawerBtnMobile");
    const closeDrawerBtn = document.getElementById("closeDrawerBtn");
    const drawerButtonsHost = document.getElementById("drawerButtonsHost");
    const drawerPager = document.getElementById("drawerPager");
    const drawerPrev = document.getElementById("drawerPrev");
    const drawerNext = document.getElementById("drawerNext");
    const drawerPageInfo = document.getElementById("drawerPageInfo");
    const openRightDrawerBtn = document.getElementById("openRightDrawerBtn");
    const rightDrawer = document.getElementById("rightDrawer");
    const rightDrawerBackdrop = document.getElementById("rightDrawerBackdrop");
    const closeRightDrawerBtn = document.getElementById("closeRightDrawerBtn");
    const openSizeTablesBtn = document.getElementById("openSizeTablesBtn");
    const sizeTablesOverlay = document.getElementById("sizeTablesOverlay");
    const sizeTablesCloseBtn = document.getElementById("sizeTablesCloseBtn");
    const openAddSizeTableBtn = document.getElementById("openAddSizeTableBtn");
    const sizeTablesGrid = document.getElementById("sizeTablesGrid");
    const sizeTableUploadOverlay = document.getElementById("sizeTableUploadOverlay");
    const sizeTableUploadCloseBtn = document.getElementById("sizeTableUploadCloseBtn");
    const sizeTableUploadTitle = document.getElementById("sizeTableUploadTitle");
    const sizeTableUploadName = document.getElementById("sizeTableUploadName");
    const sizeTableUploadFile = document.getElementById("sizeTableUploadFile");
    const sizeTableUploadHint = document.getElementById("sizeTableUploadHint");
    const sizeTableUploadError = document.getElementById("sizeTableUploadError");
    const sizeTableUploadSaveBtn = document.getElementById("sizeTableUploadSaveBtn");
    const openProductsBtn = document.getElementById("openProductsBtn");
    const productsOverlay = document.getElementById("productsOverlay");
    const productsCloseBtn = document.getElementById("productsCloseBtn");
    const productsGrid = document.getElementById("productsGrid");
    const productManageOverlay = document.getElementById("productManageOverlay");
    const productManageCloseBtn = document.getElementById("productManageCloseBtn");
    const productManageStore = document.getElementById("productManageStore");
    const productManageName = document.getElementById("productManageName");
    const productManagePrice = document.getElementById("productManagePrice");
    const productManageStampsUrl = document.getElementById("productManageStampsUrl");
    const productManageSpecsInput = document.getElementById("productManageSpecsInput");
    const productManageSpecsAddBtn = document.getElementById("productManageSpecsAddBtn");
    const productManageSpecsList = document.getElementById("productManageSpecsList");
    const productManageColorsList = document.getElementById("productManageColorsList");
    const productManageTableFile = document.getElementById("productManageTableFile");
    const productManageTableClearBtn = document.getElementById("productManageTableClearBtn");
    const productManageSaveBtn = document.getElementById("productManageSaveBtn");
    const productManageError = document.getElementById("productManageError");
    const productManageStoreError = document.getElementById("productManageStoreError");
    const productManageNameError = document.getElementById("productManageNameError");
    const productManagePriceError = document.getElementById("productManagePriceError");
    const productManageStampsError = document.getElementById("productManageStampsError");
    const productManageSpecsError = document.getElementById("productManageSpecsError");
    const productManageColorsError = document.getElementById("productManageColorsError");
    const productManageTableError = document.getElementById("productManageTableError");
    const productDetailsOverlay = document.getElementById("productDetailsOverlay");
    const productDetailsCloseBtn = document.getElementById("productDetailsCloseBtn");
    const productDetailsTitle = document.getElementById("productDetailsTitle");
    const productDetailsMeta = document.getElementById("productDetailsMeta");
    const productDetailsEmpty = document.getElementById("productDetailsEmpty");
    const productDetailsContent = document.getElementById("productDetailsContent");
    const productDetailsSpecs = document.getElementById("productDetailsSpecs");
    const productColorsList = document.getElementById("productColorsList");
    const productDetailsTableSection = document.getElementById("productDetailsTableSection");
    const productDetailsTableImg = document.getElementById("productDetailsTableImg");
    const copyProductSpecsBtn = document.getElementById("copyProductSpecsBtn");
    const copyProductColorsBtn = document.getElementById("copyProductColorsBtn");
    const copyProductTableBtn = document.getElementById("copyProductTableBtn");
    const productDetailsStore = document.getElementById("productDetailsStore");
    const productDetailsVideoSection = document.getElementById("productDetailsVideoSection");
    const productVideoTitle = document.getElementById("productVideoTitle");
    const productVideoWhatsapp = document.getElementById("productVideoWhatsapp");
    const productVideoSendBtn = document.getElementById("productVideoSendBtn");
    const productDetailsStampsBtn = document.getElementById("productDetailsStampsBtn");

    const newMenuBtnName = document.getElementById("newMenuBtnName");
    const newMenuBtnIcon = document.getElementById("newMenuBtnIcon");
    const newMenuBtnIconFile = document.getElementById("newMenuBtnIconFile");
    const newMenuBtnLink = document.getElementById("newMenuBtnLink");
    const addMenuBtn = document.getElementById("addMenuBtn");

    const themeToggleBtn = document.getElementById("themeToggleBtn");
    const themeIcon = document.getElementById("themeIcon");
    const themeIconMobile = document.getElementById("themeIconMobile");
    const appCloseBtn = document.getElementById("appCloseBtn");
    const backupMenuBtn = document.getElementById("backupMenuBtn");
    const backupOverlay = document.getElementById("backupOverlay");
    const backupCloseBtn = document.getElementById("backupCloseBtn");
    const backupDoneBtn = document.getElementById("backupDoneBtn");
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsOverlay = document.getElementById("settingsOverlay");
    const settingsCloseBtn = document.getElementById("settingsCloseBtn");
    const openStoresConfigBtn = document.getElementById("openStoresConfigBtn");
    const quickLinkOverlay = document.getElementById("quickLinkOverlay");
    const quickLinkLabel = document.getElementById("quickLinkLabel");
    const quickLinkTitleInput = document.getElementById("quickLinkTitleInput");
    const quickLinkUrlInput = document.getElementById("quickLinkUrlInput");
    const quickLinkNote = document.getElementById("quickLinkNote");
    const quickLinkSaveBtn = document.getElementById("quickLinkSaveBtn");
    const quickLinkCancelBtn = document.getElementById("quickLinkCancelBtn");
    const quickLinksListOverlay = document.getElementById("quickLinksListOverlay");
    const quickLinksListTitle = document.getElementById("quickLinksListTitle");
    const quickLinksListHost = document.getElementById("quickLinksListHost");
    const quickLinksListAddBtn = document.getElementById("quickLinksListAddBtn");
    const quickLinksListCloseBtn = document.getElementById("quickLinksListCloseBtn");
    const storesConfigOverlay = document.getElementById("storesConfigOverlay");
    const storesConfigHost = document.getElementById("storesConfigHost");
    const storesConfigAddBtn = document.getElementById("storesConfigAddBtn");
    const storesConfigSaveBtn = document.getElementById("storesConfigSaveBtn");
    const storesConfigCloseBtn = document.getElementById("storesConfigCloseBtn");
    const nuvemLinksOverlay = document.getElementById("nuvemLinksOverlay");
    const nuvemLinksHost = document.getElementById("nuvemLinksHost");
    const nuvemLinksCloseBtn = document.getElementById("nuvemLinksCloseBtn");
    const nuvemEditOverlay = document.getElementById("nuvemEditOverlay");
    const nuvemEditTitle = document.getElementById("nuvemEditTitle");
    const nuvemEditLabelInput = document.getElementById("nuvemEditLabelInput");
    const nuvemEditUrlInput = document.getElementById("nuvemEditUrlInput");
    const nuvemEditSaveBtn = document.getElementById("nuvemEditSaveBtn");
    const nuvemEditCancelBtn = document.getElementById("nuvemEditCancelBtn");
    const nuvemEditDeleteBtn = document.getElementById("nuvemEditDeleteBtn");
    const nuvemEditCloseBtn = document.getElementById("nuvemEditCloseBtn");
    const storeLinksBtn = document.getElementById("storeLinksBtn");
    const storeLinksOverlay = document.getElementById("storeLinksOverlay");
    const storeLinksCloseBtn = document.getElementById("storeLinksCloseBtn");
    const storeLinksGrid = document.getElementById("storeLinksGrid");
    const metaInboxBtn = document.getElementById("metaInboxBtn");
    const metaInboxOverlay = document.getElementById("metaInboxOverlay");
    const metaInboxCloseBtn = document.getElementById("metaInboxCloseBtn");
    const metaInboxGrid = document.getElementById("metaInboxGrid");
    const stampsLinksRow = document.getElementById("stampsLinksRow");
    const productsExtraLinks = document.getElementById("productsExtraLinks");
    const transportadorasExtraLinks = document.getElementById("transportadorasExtraLinks");
    const emailMenuBtn = document.getElementById("emailMenuBtn");
    const emailMenuOverlay = document.getElementById("emailMenuOverlay");
    const emailMenuCloseBtn = document.getElementById("emailMenuCloseBtn");
    const emailMenuHost = document.getElementById("emailMenuHost");
    const closeAppOverlay = document.getElementById("closeAppOverlay");
    const closeAppSaveBtn = document.getElementById("closeAppSaveBtn");
    const closeAppCloseBtn = document.getElementById("closeAppCloseBtn");
    const closeAppCancelBtn = document.getElementById("closeAppCancelBtn");

    // close task modal
    const closeTaskOverlay = document.getElementById("closeTaskOverlay");
    const closeTaskNewPhaseBtn = document.getElementById("closeTaskNewPhaseBtn");
    const closeTaskDoneBtn = document.getElementById("closeTaskDoneBtn");
    const closeTaskCancelBtn = document.getElementById("closeTaskCancelBtn");
    const popupOverlay = document.getElementById("popupOverlay");
    const popupModal = popupOverlay ? popupOverlay.querySelector(".popupModal") : null;
    const popupTitle = document.getElementById("popupTitle");
    const popupMessage = document.getElementById("popupMessage");
    const popupInputWrap = document.getElementById("popupInputWrap");
    const popupInput = document.getElementById("popupInput");
    const popupTextarea = document.getElementById("popupTextarea");
    const popupShortcutHint = document.getElementById("popupShortcutHint");
    const popupCloseBtn = document.getElementById("popupCloseBtn");
    const popupCancelBtn = document.getElementById("popupCancelBtn");
    const popupOkBtn = document.getElementById("popupOkBtn");
    const popupActions = document.getElementById("popupActions");
    const popupImagesWrap = document.getElementById("popupImagesWrap");
    const popupImagesLabel = document.getElementById("popupImagesLabel");
    const popupImagesInput = document.getElementById("popupImagesInput");
    const popupImagesHint = document.getElementById("popupImagesHint");
    const popupImagesList = document.getElementById("popupImagesList");
    let popupImageFiles = [];
    let popupImageUrls = [];
    let popupLastImages = [];
    let popupGalleryFiles = [];
    let popupShortcutContext = null;
    let popupInlineActions = null;

    function clearPopupInlineActions(){
      if(popupInlineActions && popupInlineActions.parentNode){
        popupInlineActions.parentNode.removeChild(popupInlineActions);
      }
      popupInlineActions = null;
    }

    function mountPopupInlineActions(labels){
      if(!popupInputWrap) return;
      clearPopupInlineActions();
      const okLabel = (labels?.okLabel || "Enviar").toString();
      const wrap = document.createElement("div");
      wrap.className = "popupInlineActions";
      wrap.innerHTML = `
        <button class="btn primary" type="button" data-popup-inline-ok>${escapeHtml(okLabel)}</button>
      `;
      const okBtn = wrap.querySelector("[data-popup-inline-ok]");
      if(okBtn){
        okBtn.addEventListener("click", ()=> {
          if(popupOkBtn){
            popupOkBtn.click();
          }else{
            closePopup(true);
          }
        });
      }
      popupInputWrap.appendChild(wrap);
      popupInlineActions = wrap;
      if(popupActions) popupActions.classList.add("isHidden");
    }

    function getTaskRefById(taskId){
      const id = (taskId || "").toString().trim();
      if(!id) return null;
      return (tasks || []).find(t => String(t.id || "") === id)
        || (tasksDone || []).find(t => String(t.id || "") === id)
        || null;
    }

    function collectUniqueStrings(values){
      const out = [];
      const seen = new Set();
      (values || []).forEach(val => {
        const txt = (val || "").toString().trim();
        if(!txt || seen.has(txt)) return;
        seen.add(txt);
        out.push(txt);
      });
      return out;
    }

    function buildPopupShortcutContext(taskId){
      const ref = getTaskRefById(taskId);
      if(!ref) return { taskId:"", pedidos:[], rastreios:[] };
      const obs = Array.isArray(ref.obs) ? ref.obs : [];
      const pedidos = collectUniqueStrings([
        ref.pedido,
        getEffectivePedidoFromTask(ref),
        ...obs.map(o => o?.novoPedido),
        ...obs.map(o => o?.pedido)
      ]);
      const rastreios = collectUniqueStrings([
        ref.rastreio,
        getEffectiveRastreioFromTask(ref),
        ...obs.map(o => o?.rastreio)
      ]);
      return { taskId: String(ref.id || ""), pedidos, rastreios };
    }

    function clearPopupQuickPick(){
      if(!popupInputWrap) return;
      const existing = popupInputWrap.querySelector("#popupQuickPick");
      if(existing) existing.remove();
    }

    function getActivePopupInput(){
      if(popupTextarea && popupTextarea.style.display !== "none") return popupTextarea;
      return popupInput;
    }

    function clearPopupImageUrls(){
      popupImageUrls.forEach(url => URL.revokeObjectURL(url));
      popupImageUrls = [];
    }

    function resetPopupImages(){
      popupImageFiles = [];
      clearPopupImageUrls();
      if(popupImagesInput) popupImagesInput.value = "";
      if(popupImagesList) popupImagesList.innerHTML = "";
    }

    function buildPopupImagesGrid(files, options){
      const list = Array.isArray(files) ? files : [];
      const allowRemove = Boolean(options && options.allowRemove);
      clearPopupImageUrls();
      if(!list.length){
        return "<div class='note'>Nenhuma imagem selecionada.</div>";
      }
      const cards = list.map((file, idx)=>{
        const url = URL.createObjectURL(file);
        popupImageUrls.push(url);
        const name = (file && file.name) ? file.name : `Imagem ${idx + 1}`;
        const removeBtn = allowRemove
          ? `<button class=\"btn small danger\" type=\"button\" data-popup-image-remove=\"${idx}\" title=\"Remover imagem\" aria-label=\"Remover imagem\"><svg class=\"iconStroke\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M3 6h18\"></path><path d=\"M8 6V4h8v2\"></path><rect x=\"6\" y=\"6\" width=\"12\" height=\"14\" rx=\"2\"></rect><path d=\"M10 10v6\"></path><path d=\"M14 10v6\"></path></svg></button>`
          : "";
        return `
          <div class=\"popupImageCard\">
            <img src=\"${url}\" alt=\"Imagem selecionada\" data-popup-image-copy=\"${idx}\" data-popup-image-url=\"${url}\">
            <div class=\"popupImageMeta\">
              <span>${escapeHtml(name)}</span>
              ${removeBtn}
            </div>
          </div>
        `;
      }).join("");
      return `<div class=\"popupImagesGrid\">${cards}</div>`;
    }

function renderPopupImages(){
      if(!popupImagesList) return;
      popupImagesList.innerHTML = buildPopupImagesGrid(popupImageFiles, { allowRemove: true });
    }

    function showPopupImageGallery(images, title){
      const list = Array.isArray(images) ? images : [];
      if(!list.length) return;
      popupGalleryFiles = list.slice();
      popupImageFiles = [];
      openPopup({ title: title || "Imagens", message: "", okLabel: "Fechar", showCancel: false });
      if(popupMessage){
        popupMessage.innerHTML = buildPopupImagesGrid(popupGalleryFiles, { allowRemove: false });
      }
    }


    function insertPopupValue(value){
      const input = getActivePopupInput();
      if(!input) return;
      const text = (value || "").toString();
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const before = input.value.slice(0, start);
      const after = input.value.slice(end);
      input.value = before + text + after;
      const cursor = before.length + text.length;
      input.setSelectionRange(cursor, cursor);
      input.focus();
    }

    function showPopupQuickPick({ items, label, onPick }){
      if(!popupInputWrap) return;
      clearPopupQuickPick();
      const wrap = document.createElement("div");
      wrap.className = "popupQuickPick";
      wrap.id = "popupQuickPick";
      const title = document.createElement("div");
      title.className = "popupQuickPickTitle";
      title.textContent = label;
      const options = document.createElement("div");
      options.className = "popupQuickPickOptions";
      items.forEach(item => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn small";
        btn.textContent = item;
        btn.addEventListener("click", ()=>{
          onPick(item);
          clearPopupQuickPick();
        });
        options.appendChild(btn);
      });
      wrap.appendChild(title);
      wrap.appendChild(options);
      popupInputWrap.appendChild(wrap);
    }

    // buscar pedido (Nuvemshop)
    const orderLookupBtn = document.getElementById("orderLookupBtn");
    const sakChatBtn = document.getElementById("sakChatBtn");
    const orderLookupOverlay = document.getElementById("orderLookupOverlay");
    const closeOrderLookupBtn = document.getElementById("closeOrderLookupBtn");
    const orderLookupCancelBtn = document.getElementById("orderLookupCancelBtn");
    const orderLookupMenu = document.getElementById("orderLookupMenu");
    const orderLookupFormWrap = document.getElementById("orderLookupFormWrap");
    const orderLookupLogoDn = document.getElementById("orderLookupLogoDn");
    const orderLookupLogoShop80 = document.getElementById("orderLookupLogoShop80");
    const orderLookupStore = document.getElementById("orderLookupStore");
    const orderLookupDetails = document.getElementById("orderLookupDetails");
    const orderLookupType = document.getElementById("orderLookupType");
    const orderLookupQuery = document.getElementById("orderLookupQuery");
    const orderLookupGoBtn = document.getElementById("orderLookupGoBtn");

    // calend\u00e1rio (visualiza\u00e7\u00e3o)
    const openCalendarBtn = document.getElementById("openCalendarBtn");
    const calendarOverlay = document.getElementById("calendarOverlay");
    const closeCalendarBtn = document.getElementById("closeCalendarBtn");
    const calPrevMonth = document.getElementById("calPrevMonth");
    const calNextMonth = document.getElementById("calNextMonth");
    const calMonthLabel = document.getElementById("calMonthLabel");
    const calFilterBtn = document.getElementById("calFilterBtn");
    const calFilterPanel = document.getElementById("calFilterPanel");
    const calStoreFilter = document.getElementById("calStoreFilter");
    const calWeekHeader = document.getElementById("calWeekHeader");
    const calGrid = document.getElementById("calGrid");
    const calGridNote = document.getElementById("calGridNote");
    const calNavRow = document.getElementById("calNavRow");
    const calNavSlot = document.getElementById("calNavSlot");
    const calDayTitle = document.getElementById("calDayTitle");
    const calDayDetails = document.getElementById("calDayDetails");
    let calDayDetailsBound = false;
    const calSide = document.getElementById("calSide");
    const calAddSimpleBtn = document.getElementById("calAddSimpleBtn");
    const calAddTaskBtn = document.getElementById("calAddTaskBtn");
    const miniCalendarGrid = document.getElementById("miniCalendarGrid");
    const miniCalendarLabel = document.getElementById("miniCalendarLabel");
    const miniCalPrev = document.getElementById("miniCalPrev");
    const miniCalNext = document.getElementById("miniCalNext");

    const simpleTaskOverlay = document.getElementById("simpleTaskOverlay");
    const simpleTaskCloseBtn = document.getElementById("simpleTaskCloseBtn");
    const simpleTaskCancelBtn = document.getElementById("simpleTaskCancelBtn");
    const simpleTaskSaveBtn = document.getElementById("simpleTaskSaveBtn");
    const simpleTaskDate = document.getElementById("simpleTaskDate");
    const simpleTaskStart = document.getElementById("simpleTaskStart");
    const simpleTaskEnd = document.getElementById("simpleTaskEnd");
    const simpleTaskStore = document.getElementById("simpleTaskStore");
    const simpleTaskSubject = document.getElementById("simpleTaskSubject");
    const simpleTaskText = document.getElementById("simpleTaskText");
    const simpleTaskRepeat = document.getElementById("simpleTaskRepeat");
    const simpleTaskRepeatEditBtn = document.getElementById("simpleTaskRepeatEditBtn");
    const recurrenceOverlay = document.getElementById("recurrenceOverlay");
    const recurrenceCloseBtn = document.getElementById("recurrenceCloseBtn");
    const recurrenceCancelBtn = document.getElementById("recurrenceCancelBtn");
    const recurrenceDoneBtn = document.getElementById("recurrenceDoneBtn");
    const recurrenceStepInput = document.getElementById("recurrenceStepInput");
    const recurrenceFrequency = document.getElementById("recurrenceFrequency");
    const recurrenceWeekdays = document.getElementById("recurrenceWeekdays");
    const recurrenceMonthlyWrap = document.getElementById("recurrenceMonthlyWrap");
    const recurrenceMonthlyOptions = document.getElementById("recurrenceMonthlyOptions");
    const recurrenceEndNever = document.getElementById("recurrenceEndNever");
    const recurrenceEndDate = document.getElementById("recurrenceEndDate");
    const recurrenceEndCount = document.getElementById("recurrenceEndCount");
    const recurrenceEndDateInput = document.getElementById("recurrenceEndDateInput");
    const recurrenceEndCountInput = document.getElementById("recurrenceEndCountInput");

    // modal: editar/adicionar fase (no card)
    const phaseEditOverlay = document.getElementById("phaseEditOverlay");
    const closePhaseEditBtn = document.getElementById("closePhaseEditBtn");
    const phaseEditTitle = document.getElementById("phaseEditTitle");
    const phaseEditText = document.getElementById("phaseEditText");
    const phaseEditDate = document.getElementById("phaseEditDate");
    const phaseEditNovoPedido = document.getElementById("phaseEditNovoPedido");
    const phaseEditRastreio = document.getElementById("phaseEditRastreio");
    const phaseEditSizeFrom = document.getElementById("phaseEditSizeFrom");
    const phaseEditSizeTo = document.getElementById("phaseEditSizeTo");
    const phaseEditSizeWrap = document.getElementById("phaseEditSizeWrap");
    const phaseEditAttention = document.getElementById("phaseEditAttention");
    const phaseEditAttentionWrap = document.getElementById("phaseEditAttentionWrap");
    const phaseEditAttentionNote = document.getElementById("phaseEditAttentionNote");
    const phaseEditChamado = document.getElementById("phaseEditChamado");
    const phaseEditEtiqueta = document.getElementById("phaseEditEtiqueta");
    const phaseEditPrazo = document.getElementById("phaseEditPrazo");
    const phaseEditPrazoHora = document.getElementById("phaseEditPrazoHora");
    const phaseEditStatus = document.getElementById("phaseEditStatus");
    const phaseEditSaveBtn = document.getElementById("phaseEditSaveBtn");
    const phaseEditCloseTaskBtn = document.getElementById("phaseEditCloseTaskBtn");
    const phaseEditDeleteBtn = document.getElementById("phaseEditDeleteBtn");
    const phaseEditCancelBtn = document.getElementById("phaseEditCancelBtn");


    // nav drawer (2 bot\u00f5es)
    const navAtalhosBtn = document.getElementById("navAtalhosBtn");
    const navToggleViewBtn = document.getElementById("navToggleViewBtn");
    const navTasksExtraBtn = document.getElementById("navTasksExtraBtn");
    const navUsersBtn = document.getElementById("navUsersBtn");
    const goToDoneTasksBtn = document.getElementById("goToDoneTasksBtn");
    const goToUsersBtn = document.getElementById("goToUsersBtn");
    const goToSearchBtn = document.getElementById("goToSearchBtn");
    const goToTasksBtn = document.getElementById("goToTasksBtn");
    const goToTasksExtraBtn = document.getElementById("goToTasksExtraBtn");
    const atalhosCreateCard = document.getElementById("atalhosCreateCard");
    const drawerBd = document.getElementById("drawerBd");

    // logos
// menu edit modal
    const menuEditOverlay = document.getElementById("menuEditOverlay");
    const closeMenuEditBtn = document.getElementById("closeMenuEditBtn");
    const menuEditName = document.getElementById("menuEditName");
    const menuEditIcon = document.getElementById("menuEditIcon");
    const menuEditIconFile = document.getElementById("menuEditIconFile");
    const menuEditAddLink = document.getElementById("menuEditAddLink");
    const menuEditLinksHost = document.getElementById("menuEditLinksHost");
    const menuEditSaveBtn = document.getElementById("menuEditSaveBtn");
    const menuEditDeleteBtn = document.getElementById("menuEditDeleteBtn");

    // import choice modal
    const importChoiceOverlay = document.getElementById("importChoiceOverlay");
    const importOption1Btn = document.getElementById("importOption1Btn");
    const importOption2Btn = document.getElementById("importOption2Btn");
    const importCancelBtn = document.getElementById("importCancelBtn");
    const importChoiceCloseX = document.getElementById("importChoiceCloseX");

    // tasks elements
    const tasksModeLabel = document.getElementById("tasksModeLabel");
    const tasksCount = document.getElementById("tasksCount");
    const tasksPeriodLabel = document.getElementById("tasksPeriodLabel");
    const tasksList = document.getElementById("tasksList");
    const doneTasksCount = document.getElementById("doneTasksCount");
    const doneTasksList = document.getElementById("doneTasksList");
    const usersCount = document.getElementById("usersCount");
    const usersCards = document.getElementById("usersCards");
    const usersSearchStoreSelect = document.getElementById("usersSearchStore");
    const usersSearchStatusSelect = document.getElementById("usersSearchStatus");
    const usersFiltersOverlay = document.getElementById("usersFiltersOverlay");
    const usersFiltersCloseBtn = document.getElementById("usersFiltersCloseBtn");
    const usersFiltersClearBtn = document.getElementById("usersFiltersClearBtn");
    const usersFiltersApplyBtn = document.getElementById("usersFiltersApplyBtn");
    const userActivityOverlay = document.getElementById("userActivityOverlay");
    const userActivityTitle = document.getElementById("userActivityTitle");
    const userActivitySummary = document.getElementById("userActivitySummary");
    const userActivityList = document.getElementById("userActivityList");
    const userActivityCloseBtn = document.getElementById("userActivityCloseBtn");
    const userActivityViewTitle = document.getElementById("userActivityViewTitle");
    const userActivityViewMeta = document.getElementById("userActivityViewMeta");
    const userActivityViewSummary = document.getElementById("userActivityViewSummary");
    const userActivityViewList = document.getElementById("userActivityViewList");
    const userActivityBackBtn = document.getElementById("userActivityBackBtn");
    const tasksCountBadge = document.getElementById("tasksCountBadge");
    const tasksExtraCountBadge = document.getElementById("tasksExtraCountBadge");

    const tData = document.getElementById("tData");
    const tCliente = document.getElementById("tCliente");
    const tWhatsapp = document.getElementById("tWhatsapp");
    const tWhatsappPreview = document.getElementById("tWhatsappPreview");
    const tWhatsappBtn = document.getElementById("tWhatsappBtn");
    const tLoja = document.getElementById("tLoja");
    const tPedido = document.getElementById("tPedido");
    const tRastreio = document.getElementById("tRastreio");
    const tAssunto = document.getElementById("tAssunto");
    const tFonte = document.getElementById("tFonte");
    const tStatus = document.getElementById("tStatus");
    const tProxEtapa = document.getElementById("tProxEtapa");
    const obsList = document.getElementById("obsList");
    const tasksSaveBtn = document.getElementById("tasksSaveBtn");
    const tasksClearBtn = document.getElementById("tasksClearBtn");

    const tasksSearch = document.getElementById("tasksSearch");
    const tasksSearchStore = document.getElementById("tasksSearchStore");
    const tasksSearchPeriod = document.getElementById("tasksSearchPeriod");
    const tasksSearchPeriodCustom = document.getElementById("tasksSearchPeriodCustom");
    const tasksSearchPeriodFrom = document.getElementById("tasksSearchPeriodFrom");
    const tasksSearchPeriodTo = document.getElementById("tasksSearchPeriodTo");
    const tasksSearchStatus = document.getElementById("tasksSearchStatus");
    const tasksSearchClearBtn = document.getElementById("tasksSearchClearBtn");
    const doneFiltersOverlay = document.getElementById("doneFiltersOverlay");
    const doneFiltersCloseBtn = document.getElementById("doneFiltersCloseBtn");
    const doneFiltersApplyBtn = document.getElementById("doneFiltersApplyBtn");
    const doneFiltersClearBtn = document.getElementById("doneFiltersClearBtn");
    const doneSearchStore = document.getElementById("doneSearchStore");
    const doneSearchPeriod = document.getElementById("doneSearchPeriod");
    const doneSearchPeriodCustom = document.getElementById("doneSearchPeriodCustom");
    const doneSearchPeriodFrom = document.getElementById("doneSearchPeriodFrom");
    const doneSearchPeriodTo = document.getElementById("doneSearchPeriodTo");
    const doneSearchStatus = document.getElementById("doneSearchStatus");
    const tasksFilterBtn = document.getElementById("tasksFilterBtn");
    const tasksFiltersOverlay = document.getElementById("tasksFiltersOverlay");
    const tasksFiltersCloseBtn = document.getElementById("tasksFiltersCloseBtn");
    const tasksFiltersApplyBtn = document.getElementById("tasksFiltersApplyBtn");
    const tasksFiltersClearBtn = document.getElementById("tasksFiltersClearBtn");
    const tasksPager = document.getElementById("tasksPager");
    const tasksNextBtn = document.getElementById("tasksNextBtn");
    const tasksAllBtn = document.getElementById("tasksAllBtn");
    const tasksSingleBtn = document.getElementById("tasksSingleBtn");
    const quickLinkButtons = Array.from(document.querySelectorAll("[data-quick-link]"));

    const authOverlay = document.getElementById("authOverlay");
    const authTitle = document.getElementById("authTitle");
    const authError = document.getElementById("authError");
    const authHint = document.getElementById("authHint");
    const authOr = document.getElementById("authOr");
    const authGoogleBtn = document.getElementById("authGoogleBtn");
    const authPartner = document.getElementById("authPartner");
    const authCoupon = document.getElementById("authCoupon");
    const loginForm = document.getElementById("loginForm");
    const loginUsername = document.getElementById("loginUsername");
    const loginPassword = document.getElementById("loginPassword");
    const loginPasswordToggle = document.getElementById("loginPasswordToggle");
    const setupForm = document.getElementById("setupForm");
    const resetRequestForm = document.getElementById("resetRequestForm");
    const resetPasswordForm = document.getElementById("resetPasswordForm");
    const resetIdentifier = document.getElementById("resetIdentifier");
    const resetPassword = document.getElementById("resetPassword");
    const resetPasswordConfirm = document.getElementById("resetPasswordConfirm");
    const resetTokenInput = document.getElementById("resetToken");
    const setupUsername = document.getElementById("setupUsername");
    const setupDisplayName = document.getElementById("setupDisplayName");
    const setupEmail = document.getElementById("setupEmail");
    const setupPassword = document.getElementById("setupPassword");
    const setupCaptcha = document.getElementById("setupCaptcha");
    const setupCaptchaQuestion = document.getElementById("setupCaptchaQuestion");
    const setupCaptchaRefreshBtn = document.getElementById("setupCaptchaRefreshBtn");
    const openRegisterBtn = document.getElementById("openRegisterBtn");
    const forgotPasswordLink = document.getElementById("forgotPasswordLink");
    const addUserBtn = document.getElementById("addUserBtn");
    const usersRefreshBtn = document.getElementById("usersRefreshBtn");
    const usersRefreshStatus = document.getElementById("usersRefreshStatus");
    const userRoleLabel = document.getElementById("userRoleLabel");
    const resendVerificationBtn = document.getElementById("resendVerificationBtn");
    const backToLoginBtn = document.getElementById("backToLoginBtn");
    const authLoginActions = document.getElementById("authLoginActions");
    const authSetupActions = document.getElementById("authSetupActions");
    const userProfileOverlay = document.getElementById("userProfileOverlay");
    const userProfileCloseBtn = document.getElementById("userProfileCloseBtn");
    const userProfileName = document.getElementById("userProfileName");
    const userProfileDoc = document.getElementById("userProfileDoc");
    const userProfileWhatsapp = document.getElementById("userProfileWhatsapp");
    const userProfileEmail = document.getElementById("userProfileEmail");
    const userProfileAvatarPreview = document.getElementById("userProfileAvatarPreview");
    const userProfileAvatarImg = document.getElementById("userProfileAvatarImg");
    const userProfileAvatarFallback = document.getElementById("userProfileAvatarFallback");
    const userProfileAvatarFile = document.getElementById("userProfileAvatarFile");
    const userProfileAvatarBtn = document.getElementById("userProfileAvatarBtn");
    const userProfileAvatarClearBtn = document.getElementById("userProfileAvatarClearBtn");
    const userProfileSaveBtn = document.getElementById("userProfileSaveBtn");
    const userProfileLogoutBtn = document.getElementById("userProfileLogoutBtn");
    const userProfileStoresBtn = document.getElementById("userProfileStoresBtn");
    const userProfileNextBtn = document.getElementById("userProfileNextBtn");

    /***********************
     * STATE
     ***********************/
    let items = [];
    let editIndex = -1;

    let qImages = [];
    let pendingDeleteImages = [];
    let qLinks = [];

    // modal steps
    let modalItemIndex = -1;
    let modalStepIndex = 0;

    // modal: fase (card)
    let phaseEditTaskId = "";
    let phaseEditIndex = -1;
    let phaseEditMode = "add"; // add | edit
    let phaseEditOrigin = "";
    let pendingPhaseSave = null;

    // drawer
    let menuButtons = [];
    let drawerPage = 1;
    let quickLinks = {};
    let stores = [];
    let searchTags = [];
    let sizeTablesCustom = [];
    let sizeTablesOverrides = [];
    let productsCustom = [];
    let sizeTableUploadMode = "add";
    let sizeTableUploadIsCustom = false;
    let sizeTableUploadTargetName = "";
    let productManageMode = "add";
    let productManageId = "";
    let productManageTableUrl = "";
    let productManageSpecsItems = [];
    let productManageSelectedColors = [];
    let pendingQuickLinkKey = "";
    let pendingQuickLinkLabel = "";
    let currentQuickLinksListKey = "";
    let currentQuickLinksListLabel = "";
    let currentQuickLinksListMode = "list";
    let currentQuickLinkEditIndex = -1;
    let nuvemLinks = {};
    let nuvemEditStore = "";
    let nuvemEditId = "";
    let nuvemEditIsNew = false;
    let nuvemPageByStore = {};
    let storesDraft = [];

    // cards navigation
    let showAllCards = false;
    let currentSingleIndex = 0;
    let searchTagsFilter = [];
    let searchQueryCache = "";

    // menu edit state
    let editingMenuGlobalIndex = -1;
    let editingMenuLinks = [];

    // view state
    let currentView = "search"; // "search" | "tasks"
    let taskModalFromCalendar = false;

    // close flow
    let allowAppClose = false;

    // product details state
    let currentProductTableUrl = "";
    let currentProductPrice = "";
    let currentProductDetails = null;
    let currentProductVideoUrl = "";
    let currentProductVideoText = "";

    // tasks state
    let tasks = [];
    let tasksDone = [];
    let tasksEditId = null;
    let pendingTaskDraft = null;
    let tasksTypeFilter = "normal";

    // tasks list view state (\u00daltimo chamado / pr\u00f3ximo / todos + busca)
    let tasksShowAll = false;
    let tasksSingleIndex = 0;
    let tasksSearchQuery = "";
    let tasksSearchStoreValue = "";
    let tasksSearchPeriodValue = "ALL";
    let tasksSearchPeriodFromValue = "";
    let tasksSearchPeriodToValue = "";
    let tasksSearchStatusValue = "";
    let doneSearchQuery = "";
    let doneSearchStoreValue = "";
    let doneSearchPeriodValue = "ALL";
    let doneSearchPeriodFromValue = "";
    let doneSearchPeriodToValue = "";
    let doneSearchStatusValue = "";

    // calend\u00e1rio state
    let calendarHistory = [];
    let calViewYear = new Date().getFullYear();
    let calViewMonth = new Date().getMonth(); // 0-11
    let calSelectedISO = "";
    let calStoreFilterValue = "";

    
    const PHASE_STATE_ACTIVE = "Ativa";
    const PHASE_STATE_DONE = "Conclu\u00edda";
    const PHASE_STATUS_OPTIONS = [
      { group: "Extras", options: [
        "Personalizacao",
        PHASE_STATE_DONE
      ]},
      { group: "Trocas e Devolu\u00e7\u00f5es", options: [
        "Troca - Cliente x F\u00e1brica",
        "Aguardando o envio da f\u00e1brica",
        "Troca - F\u00e1brica x Cliente",
        "Defeito de fabrica\u00e7\u00e3o",
        "Erro da f\u00e1brica",
        "Devolu\u00e7\u00e3o - Cliente N\u00e3o Localizado",
        "Solicita\u00e7\u00e3o de Estorno"
      ]},
      { group: "Chamados da Nuvemshop", options: [
        "Solicita\u00e7\u00e3o de estorno",
        "Novo Envio",
        "Atraso",
        "Dificuldades na entrega",
        "Link de rastreio desatualizado",
        "Aguardando o retorno da Nuvemshop",
        "Cliente alega n\u00e3o ter recebido",
        "Acarea\u00e7\u00e3o",
        "Mudan\u00e7a de endere\u00e7o",
        "Cancelamento de envio",
        "Estorno por extravio ou avaria"
      ]}
    ];

    const SIZE_TABLES = [
      { name:"Camisetas", file:"camisetas.png" },
      { name:"Manga longa", file:"manga-longa.png" },
      { name:"Plus size", file:"plus-size.png" },
      { name:"Regatas", file:"regatas.png" },
    ];

    const PRODUCT_TABLE_BASE = "../imagens/app/tabelas de medida/";
    const PRODUCT_SPECS_INFO = [
      "Tamanhos do P ao XGG",
      "Veja o melhor tamanho para voc\u00ea no nosso provador virtual",
      "Malha penteada fio 30.1",
      "100% Algod\u00e3o",
      "Costura refor\u00e7ada com acabamento em vi\u00e9s ombro a ombro",
      "Gola em ribana",
      "Percentual de encolhimento ap\u00f3s lavagem: 2,8%",
      "Impress\u00e3o DTG - Silk HD de alta qualidade",
    ];
    const PRODUCT_SPECS_CAMISETAS_SHOP = [
      "Tamanhos do P ao XGG",
      "Veja o melhor tamanho para voc\u00ea no nosso provador virtual",
      "Malha penteada fio 30.1",
      "100% Algod\u00e3o",
      "Costura refor\u00e7ada com acabamento em vi\u00e9s ombro a ombro",
      "Gola em ribana",
      "Percentual de encolhimento ap\u00f3s lavagem: 2,8%",
      "Impress\u00e3o DTF Alta Defini\u00e7\u00e3o",
    ];
    const PRODUCT_SPECS_MANGA_SHOP = [
      "Tamanhos do P ao XGG",
      "Veja o melhor tamanho para voc\u00ea no nosso provador virtual",
      "Malha penteada fio 30.1",
      "100% Algod\u00e3o",
      "Costura refor\u00e7ada com acabamento em vi\u00e9s ombro a ombro",
      "Gola em ribana",
      "Percentual de encolhimento ap\u00f3s lavagem: 2,8%",
      "Impress\u00e3o DTF Alta Defini\u00e7\u00e3o",
    ];
    const PRODUCT_SPECS_REGATA = [
      "Tamanhos do P ao XG",
      "Veja o melhor tamanho para voc\u00ea no nosso provador virtual",
      "Malha penteada fio 30.1",
      "100% Algod\u00e3o",
      "Costura refor\u00e7ada com acabamento em vi\u00e9s ombro a ombro",
      "Gola em ribana",
      "Percentual de encolhimento ap\u00f3s lavagem: 2,8%",
      "Impress\u00e3o DTG - Silk HD de alta qualidade",
    ];
    const PRODUCT_SPECS_REGATA_SHOP = [
      "Tamanhos do P ao XG",
      "Veja o melhor tamanho para voc\u00ea no nosso provador virtual",
      "Malha penteada fio 30.1",
      "100% Algod\u00e3o",
      "Costura refor\u00e7ada com acabamento em vi\u00e9s ombro a ombro",
      "Gola em ribana",
      "Percentual de encolhimento ap\u00f3s lavagem: 2,8%",
      "Impress\u00e3o DTF Alta Defini\u00e7\u00e3o",
    ];
    const PRODUCT_SPECS_PLUS = [
      "Tamanhos do G1 ao G5",
      "Veja o melhor tamanho para voc\u00ea no nosso provador virtual",
      "Malha penteada fio 30.1",
      "100% Algod\u00e3o",
      "Costura refor\u00e7ada com acabamento em vi\u00e9s ombro a ombro",
      "Gola em ribana",
      "Percentual de encolhimento ap\u00f3s lavagem: 2,8%",
      "Impress\u00e3o DTG - Silk HD de alta qualidade",
    ];
    const PRODUCT_SPECS_PLUS_SHOP = [
      "Tamanhos do G1 ao G5",
      "Veja o melhor tamanho para voc\u00ea no nosso provador virtual",
      "Malha penteada fio 30.1",
      "100% Algod\u00e3o",
      "Costura refor\u00e7ada com acabamento em vi\u00e9s ombro a ombro",
      "Gola em ribana",
      "Percentual de encolhimento ap\u00f3s lavagem: 2,8%",
      "Impress\u00e3o DTF Alta Defini\u00e7\u00e3o",
    ];
    const PRODUCT_SPECS_BONES = [
      "\u00c1rea m\u00e1xima de impress\u00e3o:",
      "Frente: 10x5,5cm.",
      "Malha penteada fio 30.1",
      "Considere a \u00e1rea como largura x altura.",
      "T\u00e9cnica de impress\u00e3o: DTF.",
      "Todo em tecido.",
      "Com aba anat\u00f4mica e flex\u00edvel, voc\u00ea escolhe a curvatura da aba.",
      "Ajuste na parte traseira.",
    ];
    const PRODUCT_COLORS = [
      { name: "Cinza mescla", hex: "#adadad" },
      { name: "Preto", hex: "#000000" },
      { name: "Branco", hex: "#ffffff" },
      { name: "Mostarda", hex: "#d59529" },
      { name: "Azul Royal", hex: "#003df6" },
      { name: "Azul marinho", hex: "#00005e" },
      { name: "Vinho", hex: "#800020" },
      { name: "Vermelho", hex: "#ff0000" },
      { name: "Marrom", hex: "#654321" },
      { name: "Laranja", hex: "#ffa500" },
      { name: "Amarelo", hex: "#e7e70d" },
      { name: "Rosa bebe", hex: "#f4c2c2" },
      { name: "Roxo", hex: "#440044" },
      { name: "Cinza chumbo", hex: "#283136" },
      { name: "Verde musgo", hex: "#2d3a18" },
    ];
    const PRODUCT_COLORS_REGATA = [
      { name: "Preto", hex: "#000000" },
      { name: "Branco", hex: "#ffffff" },
    ];
    const PRODUCT_COLORS_MANGA = [
      { name: "Preto", hex: "#000000" },
      { name: "Branco", hex: "#ffffff" },
    ];
    const PRODUCT_COLORS_PLUS = [
      { name: "Preto", hex: "#000000" },
      { name: "Verde musgo", hex: "#2d3a18" },
      { name: "Vermelho", hex: "#ff0000" },
      { name: "Azul marinho", hex: "#00005e" },
      { name: "Off White", hex: "#FFFFE1" },
      { name: "Branco", hex: "#ffffff" },
      { name: "Cinza mescla", hex: "#adadad" },
    ];
    const PRODUCT_COLORS_BONES = [
      { name: "Preto", hex: "#000000" },
      { name: "Azul royal", hex: "#003df6" },
      { name: "Vermelho", hex: "#ff0000" },
    ];
    const PRODUCT_COLORS_BABY = [
      { name: "Caramelo", hex: "#E18E04" },
      { name: "Preto", hex: "#000000" },
      { name: "Branco", hex: "#ffffff" },
      { name: "Azul Royal", hex: "#1b52f8" },
      { name: "Azul bebe", hex: "#96AEDA" },
      { name: "Vinho", hex: "#67011b" },
      { name: "Vermelho", hex: "#f62121" },
      { name: "Marrom", hex: "#6e3b2d" },
      { name: "Amarelo", hex: "#e7b703" },
      { name: "Rosa bebe", hex: "#D8B0C8" },
      { name: "Verde musgo", hex: "#1e290f" },
    ];
    const PRODUCT_DETAILS = {
      "camiseta": {
        title: "Camisetas",
        tableFile: "camisetas.png",
        stampsDnUrl: "https://drive.google.com/drive/folders/1GzUiy7rFtmAIgMLPhosIgzKkuTsEEzDY",
        stampsShopUrl: "https://drive.google.com/drive/folders/1Bur2NdQBrPoXZ27sTCdaQBRIHvElW1JY",
        specsShop: PRODUCT_SPECS_CAMISETAS_SHOP,
        specsDn: PRODUCT_SPECS_INFO,
      },
      "manga-longa": {
        title: "Manga longa",
        tableFile: "manga-longa.png",
        stampsDnUrl: "https://drive.google.com/drive/folders/11L_jatG3eQTbcyVB9fYfwizf-Q3CuKML",
        stampsShopUrl: "https://drive.google.com/drive/folders/1wM4n85WxLExjLlrrG-EA72iYFaxf4EY0",
        specsShop: PRODUCT_SPECS_MANGA_SHOP,
        specsDn: PRODUCT_SPECS_INFO,
        colors: PRODUCT_COLORS_MANGA,
      },
      "baby-look": {
        title: "Baby look",
        tableFile: "camisetas.png",
        stampsDnUrl: "https://drive.google.com/drive/folders/1iu0F7qYRbaksFH__gaNnb7JuIez2VYOM",
        stampsShopUrl: "https://drive.google.com/drive/folders/1iu0F7qYRbaksFH__gaNnb7JuIez2VYOM",
        hasVideo: true,
        colors: PRODUCT_COLORS_BABY,
      },
      "regata": {
        title: "Regatas",
        tableFile: "regatas.png",
        stampsDnUrl: "https://drive.google.com/drive/folders/1lObkg_c9mT5FlQkWw9Jrq0U8_xWeE9OX",
        stampsShopUrl: "https://drive.google.com/drive/folders/1JTxPUSC2-0onPRuL5dfdIU1QGr-nKexC",
        specs: PRODUCT_SPECS_REGATA,
        specsShop: PRODUCT_SPECS_REGATA_SHOP,
        colors: PRODUCT_COLORS_REGATA,
      },
      "plus-size": {
        title: "Plus size",
        tableFile: "plus-size.png",
        stampsDnUrl: "https://drive.google.com/drive/folders/1b3UaZ4tTzhSfvzcwKGi5UaAq8wHADcg2",
        stampsShopUrl: "https://drive.google.com/drive/folders/1xH2nCEl8TTd30uyzgJ-DBzvLMk_utuJa",
        specs: PRODUCT_SPECS_PLUS,
        specsShop: PRODUCT_SPECS_PLUS_SHOP,
        colors: PRODUCT_COLORS_PLUS,
      },
      "bones": {
        title: "Bon\u00e9s",
        stampsDnUrl: "https://drive.google.com/drive/folders/1Ov4Hjk6uMBFGg0c4HvP7pQSFng3dIDMk",
        stampsShopUrl: "https://drive.google.com/drive/folders/1OQSCso5Mx_S0IBoXdmHI9ZLIpiggNTQE",
        specs: PRODUCT_SPECS_BONES,
        colors: PRODUCT_COLORS_BONES,
        noAdvantages: true,
        noTable: true,
      },
    };

    function getDefaultProductDetails(key, store){
      const details = PRODUCT_DETAILS[key];
      if(!details) return null;
      const storeNormalized = (store || "").toLowerCase();
      const isShop80 = storeNormalized.includes("shop 80");
      const specs =
        (isShop80 && details?.specsShop) ||
        details?.specs ||
        details?.specsDn ||
        PRODUCT_SPECS_INFO;
      const colors = details?.colors || PRODUCT_COLORS;
      const stampsUrl = isShop80 ? details?.stampsShopUrl : details?.stampsDnUrl;
      const tableUrl = details?.noTable || !details?.tableFile
        ? ""
        : encodeURI(PRODUCT_TABLE_BASE + details.tableFile);
      return {
        specs: Array.isArray(specs) ? specs : [],
        colors: Array.isArray(colors) ? colors : [],
        stampsUrl: (stampsUrl || "").toString().trim(),
        tableUrl
      };
    }

    const BONES_VIDEO_URL_DN = "https://www.youtube.com/watch?v=GG3vdVu70gM&t=2s";
    const BONES_VIDEO_URL_SHOP = "https://www.youtube.com/watch?v=EdJdy_sxons&embeds_referring_euri=https%3A%2F%2Fshop80.com.br%2F&source_ve_path=OTY3MTQ";
    const BONES_VIDEO_TEXT = "Segue um link do v\u00eddeo real do bon\u00e9. Nele voc\u00ea consegue ver os detalhes e os \u00e2ngulos da pe\u00e7a.";
    const BABY_VIDEO_URL = "https://www.youtube.com/watch?v=fWMG7MYEupY";
    const BABY_VIDEO_TEXT = "Segue um link do v\u00eddeo real da baby look. Nele voc\u00ea consegue ver os detalhes e os \u00e2ngulos da pe\u00e7a.";
/***********************
     * HELPERS
     ***********************/
    function escapeHtml(str){
      return (str || "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
    }

    function isDailyRepeatLabel(label){
      return (label || "").toString().trim().toLowerCase() === DAILY_REPEAT_LABEL.toLowerCase();
    }

    function isNoRepeatLabel(label){
      return normalizeLabelText(label) === "nao se repete";
    }

    function isDailyRepeatTask(t){
      return Boolean(t?.isExtra) && isDailyRepeatLabel(t?.repeat);
    }

    function isDailyRepeatCalendarEntry(e){
      return (e?.extra || e?.simple) && isDailyRepeatLabel(e?.repeat);
    }

    function addDaysISO(iso, days){
      if(!iso || !Number.isFinite(days)) return "";
      const d = new Date(`${iso}T00:00:00`);
      if(Number.isNaN(d.getTime())) return "";
      d.setDate(d.getDate() + days);
      return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
    }

    function getDaysDiff(startIso, endIso){
      const a = new Date(`${startIso}T00:00:00`);
      const b = new Date(`${endIso}T00:00:00`);
      if(Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return NaN;
      return Math.floor((b - a) / 86400000);
    }

    function getNextBusinessDayISO(iso){
      if(!iso) return "";
      const d = new Date(`${iso}T00:00:00`);
      if(Number.isNaN(d.getTime())) return "";
      const day = d.getDay();
      if(day === 6){ // sabado
        d.setDate(d.getDate() + 2);
      }else if(day === 0){ // domingo
        d.setDate(d.getDate() + 1);
      }
      return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
    }

    function getRepeatExclusions(entry){
      return Array.isArray(entry?.repeatExclusions)
        ? entry.repeatExclusions.map(v => (v || "").toString().trim()).filter(Boolean)
        : [];
    }

    function shouldIncludeRepeatWindow(entry, iso){
      if(!iso) return false;
      const start = (entry?.date || "").toString().trim();
      if(start && iso < start) return false;
      const end = (entry?.repeatUntil || entry?.repeatEnd || "").toString().trim();
      if(end && iso > end) return false;
      const exclusions = getRepeatExclusions(entry);
      if(exclusions.includes(iso)) return false;
      return true;
    }

    const WEEKDAY_LABELS_PT = [
      "domingo",
      "segunda-feira",
      "ter\u00e7a-feira",
      "quarta-feira",
      "quinta-feira",
      "sexta-feira",
      "s\u00e1bado"
    ];
    const WEEKDAY_LABELS_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sab"];
    const MONTH_LABELS_PT = [
      "janeiro",
      "fevereiro",
      "mar\u00e7o",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro"
    ];

    function normalizeLabelText(text){
      return (text || "")
        .toString()
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }

    function getWeekdayIndexFromISO(iso){
      if(!iso) return NaN;
      const d = new Date(`${iso}T00:00:00`);
      if(Number.isNaN(d.getTime())) return NaN;
      return d.getDay();
    }

    function getWeekdayLabelFromIndex(idx){
      return WEEKDAY_LABELS_PT[idx] || "";
    }

    function getMonthlyOrdinalFromISO(iso){
      if(!iso) return null;
      const d = new Date(`${iso}T00:00:00`);
      if(Number.isNaN(d.getTime())) return null;
      const day = d.getDate();
      const month = d.getMonth();
      const year = d.getFullYear();
      const ordinal = Math.floor((day - 1) / 7) + 1;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const isLast = (day + 7) > daysInMonth;
      return { ordinal, isLast };
    }

    function getMonthlyOrdinalWordFromISO(iso){
      const info = getMonthlyOrdinalFromISO(iso);
      if(!info) return "";
      if(info.isLast) return "\u00faltimos(as)";
      if(info.ordinal === 1) return "primeiro(as)";
      if(info.ordinal === 2) return "segunda(as)";
      if(info.ordinal === 3) return "terceira(as)";
      if(info.ordinal === 4) return "quarta(as)";
      return "quinta(as)";
    }

    function getMonthlyOrdinalInfoFromLabel(label){
      const normalized = normalizeLabelText(label);
      const prefix = normalizeLabelText(MONTHLY_ORDINAL_PREFIX);
      if(!normalized.startsWith(prefix)) return null;
      const rest = normalized.slice(prefix.length).trim();
      const parts = rest.split(/\s+/);
      const ordinalToken = parts[0] || "";
      let ordinal = null;
      let isLast = false;
      if(ordinalToken.startsWith("ultimo")) isLast = true;
      else if(ordinalToken.startsWith("primeir")) ordinal = 1;
      else if(ordinalToken.startsWith("segunda")) ordinal = 2;
      else if(ordinalToken.startsWith("terceir")) ordinal = 3;
      else if(ordinalToken.startsWith("quart")) ordinal = 4;
      else if(ordinalToken.startsWith("quint")) ordinal = 5;
      const weekdayIndex = getWeekdayIndexFromLabel(rest);
      return { ordinal, isLast, weekdayIndex };
    }

    function getWeekdayIndexFromLabel(label){
      const normalized = normalizeLabelText(label);
      for(let i = 0; i < WEEKDAY_LABELS_PT.length; i++){
        const token = normalizeLabelText(WEEKDAY_LABELS_PT[i]);
        if(token && normalized.includes(token)) return i;
      }
      return NaN;
    }

    function getSimpleTaskWeeklyLabelByDate(iso){
      const idx = getWeekdayIndexFromISO(iso);
      const label = getWeekdayLabelFromIndex(idx);
      return label ? `${WEEKLY_REPEAT_PREFIX}${label}` : "Semanal";
    }

    function getSimpleTaskMonthlyLabelByDate(iso){
      const idx = getWeekdayIndexFromISO(iso);
      const label = getWeekdayLabelFromIndex(idx);
      const ordinalWord = getMonthlyOrdinalWordFromISO(iso);
      return label ? `${MONTHLY_ORDINAL_PREFIX}${ordinalWord} ${label}` : "Mensal";
    }

    function getMonthlyDayOptionLabel(iso){
      if(!iso) return "Mensal no dia";
      const d = new Date(`${iso}T00:00:00`);
      if(Number.isNaN(d.getTime())) return "Mensal no dia";
      return `Mensal no dia ${d.getDate()}`;
    }

    function getMonthlyWeekdayOptionLabel(iso){
      if(!iso) return "Mensal no(a)";
      const idx = getWeekdayIndexFromISO(iso);
      const weekday = getWeekdayLabelFromIndex(idx);
      const ordinal = getMonthlyOrdinalWordFromISO(iso);
      return weekday ? `Mensal no(a) ${ordinal} ${weekday}` : "Mensal no(a)";
    }

    function getDefaultRecurrenceDraft(iso){
      const startIso = iso || todayISO();
      return {
        interval: 1,
        unit: "day",
        weekdays: [getWeekdayIndexFromISO(startIso)],
        monthlyMode: "by_day"
      };
    }

    function setRecurrenceDraftFromEntry(entry, iso){
      const base = getDefaultRecurrenceDraft(iso);
      if(entry?.repeatUnit){
        base.unit = entry.repeatUnit;
      }
      if(Number.isFinite(entry?.repeatEvery)){
        base.interval = entry.repeatEvery;
      }
      if(Array.isArray(entry?.repeatWeekdays) && entry.repeatWeekdays.length){
        base.weekdays = entry.repeatWeekdays.slice();
      }
      if(entry?.repeatMonthlyMode){
        base.monthlyMode = entry.repeatMonthlyMode;
      }
      recurrenceDraft = base;
    }

    function applyRecurrenceDraftToUI(){
      if(recurrenceStepInput){
        recurrenceStepInput.value = String(recurrenceDraft.interval || 1);
      }
      if(recurrenceFrequency){
        recurrenceFrequency.value = recurrenceDraft.unit || "day";
      }
      if(recurrenceMonthlyOptions){
        recurrenceMonthlyOptions.value = recurrenceDraft.monthlyMode || "by_day";
      }
      if(recurrenceWeekdays){
        const selected = new Set(recurrenceDraft.weekdays || []);
        recurrenceWeekdays.querySelectorAll(".recurrenceDayBtn").forEach(btn=>{
          const idx = Number.parseInt((btn.getAttribute("data-weekday") || ""), 10);
          btn.classList.toggle("isActive", Number.isFinite(idx) && selected.has(idx));
        });
      }
      syncRecurrenceWeekdaysVisibility();
    }

    function saveRecurrenceDraftFromUI(){
      const intervalRaw = Number.parseInt((recurrenceStepInput?.value || "").toString(), 10);
      const interval = Number.isFinite(intervalRaw) && intervalRaw > 0 ? intervalRaw : 1;
      const unit = (recurrenceFrequency?.value || "day").toString().trim();
      const monthlyMode = (recurrenceMonthlyOptions?.value || "by_day").toString().trim();
      let weekdays = [];
      if(recurrenceWeekdays){
        recurrenceWeekdays.querySelectorAll(".recurrenceDayBtn.isActive").forEach(btn=>{
          const idx = Number.parseInt((btn.getAttribute("data-weekday") || ""), 10);
          if(Number.isFinite(idx)) weekdays.push(idx);
        });
      }
      if(unit === "week" && !weekdays.length){
        const fallback = getWeekdayIndexFromISO((simpleTaskDate?.value || "").toString().trim() || todayISO());
        weekdays = Number.isFinite(fallback) ? [fallback] : [];
      }
      recurrenceDraft = { interval, unit, weekdays, monthlyMode };
      saveRecurrenceEndDraftFromUI();
    }

    function getCustomRepeatLabel(config){
      if(!config || !config.unit) return "Personalizado";
      const interval = Number.isFinite(config.interval) ? config.interval : 1;
      if(config.unit === "day"){
        return `Personalizado: a cada ${interval} dia${interval > 1 ? "s" : ""}`;
      }
      if(config.unit === "week"){
        const days = (config.weekdays || [])
          .map(idx => WEEKDAY_LABELS_SHORT[idx] || "")
          .filter(Boolean)
          .join(", ");
        const base = `Personalizado: a cada ${interval} semana${interval > 1 ? "s" : ""}`;
        return days ? `${base} (${days})` : base;
      }
      if(config.unit === "month"){
        return `Personalizado: a cada ${interval} m\u00eas${interval > 1 ? "es" : ""}`;
      }
      if(config.unit === "year"){
        return `Personalizado: a cada ${interval} ano${interval > 1 ? "s" : ""}`;
      }
      return "Personalizado";
    }

    function getCustomMonthlyTarget(entry){
      const start = (entry?.date || "").toString().trim();
      if(!start) return { day:null, weekday:null, ordinal:null, isLast:false };
      const day = Number.parseInt(start.split("-")[2] || "", 10);
      const weekday = getRepeatWeekdayFromEntry(entry);
      const ordinalInfo = getRepeatMonthlyOrdinalFromEntry(entry);
      return { day, weekday, ordinal: ordinalInfo?.ordinal || null, isLast: Boolean(ordinalInfo?.isLast) };
    }

    function shouldIncludeCustomRepeatOnDate(entry, iso){
      if(!shouldIncludeRepeatWindow(entry, iso)) return false;
      const unit = (entry?.repeatUnit || "").toString().trim();
      const interval = Number.isFinite(entry?.repeatEvery) ? entry.repeatEvery : 1;
      const start = (entry?.date || "").toString().trim();
      if(!unit || !start) return false;

      if(unit === "day"){
        const diff = getDaysDiff(start, iso);
        return Number.isFinite(diff) && diff >= 0 && diff % interval === 0;
      }
      if(unit === "week"){
        const diff = getDaysDiff(start, iso);
        if(!Number.isFinite(diff) || diff < 0) return false;
        const weekIndex = Math.floor(diff / 7);
        if(weekIndex % interval !== 0) return false;
        const weekday = getWeekdayIndexFromISO(iso);
        const selected = Array.isArray(entry?.repeatWeekdays) && entry.repeatWeekdays.length
          ? entry.repeatWeekdays
          : [getWeekdayIndexFromISO(start)];
        return selected.includes(weekday);
      }
      if(unit === "month"){
        const startDate = new Date(`${start}T00:00:00`);
        const date = new Date(`${iso}T00:00:00`);
        if(Number.isNaN(startDate.getTime()) || Number.isNaN(date.getTime())) return false;
        const monthsDiff = (date.getFullYear() * 12 + date.getMonth()) - (startDate.getFullYear() * 12 + startDate.getMonth());
        if(monthsDiff < 0 || monthsDiff % interval !== 0) return false;
        const mode = (entry?.repeatMonthlyMode || "by_day").toString().trim();
        if(mode === "by_day"){
          return date.getDate() === startDate.getDate();
        }
        const target = getCustomMonthlyTarget(entry);
        const weekday = getWeekdayIndexFromISO(iso);
        if(!Number.isFinite(target.weekday) || weekday !== target.weekday) return false;
        if(target.isLast){
          return isLastWeekdayOfMonth(iso, target.weekday);
        }
        const occurrence = getMonthlyWeekdayOccurrenceIndex(iso);
        return Number.isFinite(occurrence) && Number.isFinite(target.ordinal) && occurrence === target.ordinal;
      }
      if(unit === "year"){
        const startDate = new Date(`${start}T00:00:00`);
        const date = new Date(`${iso}T00:00:00`);
        if(Number.isNaN(startDate.getTime()) || Number.isNaN(date.getTime())) return false;
        const yearsDiff = date.getFullYear() - startDate.getFullYear();
        if(yearsDiff < 0 || yearsDiff % interval !== 0) return false;
        return date.getMonth() === startDate.getMonth() && date.getDate() === startDate.getDate();
      }
      return false;
    }

    function syncRecurrenceEndInputs(){
      if(!recurrenceEndNever || !recurrenceEndDate || !recurrenceEndCount) return;
      if(recurrenceEndDateInput){
        recurrenceEndDateInput.disabled = !recurrenceEndDate.checked;
      }
      if(recurrenceEndCountInput){
        recurrenceEndCountInput.disabled = !recurrenceEndCount.checked;
      }
    }

    function setRecurrenceEndDraftFromEntry(entry){
      const count = Number.isFinite(entry?.repeatCount) ? entry.repeatCount : null;
      const endDate = (entry?.repeatUntil || entry?.repeatEnd || "").toString().trim();
      if(Number.isFinite(count) && count > 0){
        recurrenceEndDraft = { mode:"count", date:"", count };
        return;
      }
      if(endDate){
        recurrenceEndDraft = { mode:"date", date:endDate, count:null };
        return;
      }
      recurrenceEndDraft = { mode:"never", date:"", count:null };
    }

    function applyRecurrenceEndDraftToUI(){
      if(recurrenceEndNever) recurrenceEndNever.checked = recurrenceEndDraft.mode === "never";
      if(recurrenceEndDate) recurrenceEndDate.checked = recurrenceEndDraft.mode === "date";
      if(recurrenceEndCount) recurrenceEndCount.checked = recurrenceEndDraft.mode === "count";
      if(recurrenceEndDateInput) recurrenceEndDateInput.value = recurrenceEndDraft.date || "";
      if(recurrenceEndCountInput){
        recurrenceEndCountInput.value = recurrenceEndDraft.count ? String(recurrenceEndDraft.count) : "";
      }
      syncRecurrenceEndInputs();
    }

    function saveRecurrenceEndDraftFromUI(){
      if(recurrenceEndDate && recurrenceEndDate.checked){
        recurrenceEndDraft = { mode:"date", date:(recurrenceEndDateInput?.value || "").toString().trim(), count:null };
        if(recurrenceEndCountInput) recurrenceEndCountInput.value = "";
        return;
      }
      if(recurrenceEndCount && recurrenceEndCount.checked){
        const raw = Number.parseInt((recurrenceEndCountInput?.value || "").toString(), 10);
        recurrenceEndDraft = { mode:"count", date:"", count: Number.isFinite(raw) ? raw : null };
        if(recurrenceEndDateInput) recurrenceEndDateInput.value = "";
        return;
      }
      recurrenceEndDraft = { mode:"never", date:"", count:null };
    }

    function getMonthlyWeekdayOccurrenceDate(year, month, weekday, ordinalInfo){
      const first = new Date(year, month, 1);
      const firstWeekday = (first.getDay() - weekday + 7) % 7;
      let day = 1 + firstWeekday;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      if(ordinalInfo?.isLast){
        const last = new Date(year, month + 1, 0);
        const diff = (last.getDay() - weekday + 7) % 7;
        day = last.getDate() - diff;
      }else if(Number.isFinite(ordinalInfo?.ordinal)){
        day = day + (ordinalInfo.ordinal - 1) * 7;
        if(day > daysInMonth) return "";
      }else{
        return "";
      }
      return `${year}-${pad2(month+1)}-${pad2(day)}`;
    }

    function computeRepeatUntilByCount(startIso, repeatValue, repeatWeekday, repeatOrdinal, repeatCount, customConfig){
      if(!startIso || !Number.isFinite(repeatCount) || repeatCount <= 0) return "";
      if(repeatCount === 1) return startIso;
      if(repeatValue === "todos_dias"){
        return addDaysISO(startIso, repeatCount - 1);
      }
      if(repeatValue === "dias_uteis"){
        let iso = startIso;
        let count = 1;
        while(count < repeatCount){
          iso = addDaysISO(iso, 1);
          const weekday = getWeekdayIndexFromISO(iso);
          if(weekday >= 1 && weekday <= 5){
            count += 1;
          }
        }
        return iso;
      }
      if(repeatValue === "semanal"){
        return addDaysISO(startIso, (repeatCount - 1) * 7);
      }
      if(repeatValue === "mensal_ultima"){
        const base = new Date(`${startIso}T00:00:00`);
        if(Number.isNaN(base.getTime())) return "";
        let year = base.getFullYear();
        let month = base.getMonth();
        let occurrence = 1;
        let iso = startIso;
        while(occurrence < repeatCount){
          month += 1;
          if(month > 11){ month = 0; year += 1; }
          const nextIso = getMonthlyWeekdayOccurrenceDate(year, month, repeatWeekday, getRepeatMonthlyOrdinalFromEntry({ repeatOrdinal }));
          if(nextIso){
            iso = nextIso;
            occurrence += 1;
          }else{
            break;
          }
        }
        return iso;
      }
      if(repeatValue === "anual"){
        const base = new Date(`${startIso}T00:00:00`);
        if(Number.isNaN(base.getTime())) return "";
        const year = base.getFullYear() + (repeatCount - 1);
        const month = base.getMonth();
        const day = base.getDate();
        const d = new Date(year, month, day);
        return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
      }
      if(repeatValue === "personalizar" && customConfig?.unit){
        let iso = startIso;
        let count = 1;
        let guard = 0;
        const entry = {
          date: startIso,
          repeatUnit: customConfig.unit,
          repeatEvery: customConfig.interval,
          repeatWeekdays: customConfig.weekdays,
          repeatMonthlyMode: customConfig.monthlyMode
        };
        while(count < repeatCount && guard < 10000){
          iso = addDaysISO(iso, 1);
          guard += 1;
          if(shouldIncludeCustomRepeatOnDate(entry, iso)){
            count += 1;
          }
        }
        return iso;
      }
      return "";
    }

    function getSimpleTaskAnnualLabelByDate(iso){
      if(!iso) return "Anual";
      const d = new Date(`${iso}T00:00:00`);
      if(Number.isNaN(d.getTime())) return "Anual";
      const monthLabel = MONTH_LABELS_PT[d.getMonth()] || "";
      const day = d.getDate();
      return monthLabel ? `${ANNUAL_REPEAT_PREFIX}${monthLabel} ${day}` : "Anual";
    }

    function isWeeklyRepeatLabel(label){
      return normalizeLabelText(label).startsWith(normalizeLabelText(WEEKLY_REPEAT_PREFIX));
    }

    function isMonthlyLastWeekdayLabel(label){
      return normalizeLabelText(label).startsWith(normalizeLabelText(MONTHLY_ORDINAL_PREFIX));
    }

    function isWeekdaysRepeatLabel(label){
      return normalizeLabelText(label) === normalizeLabelText(WEEKDAYS_REPEAT_LABEL);
    }

    function isAnnualRepeatLabel(label){
      return normalizeLabelText(label).startsWith(normalizeLabelText(ANNUAL_REPEAT_PREFIX));
    }

    function getRepeatWeekdayFromEntry(entry){
      if(Number.isFinite(entry?.repeatWeekday)) return entry.repeatWeekday;
      const fromLabel = getWeekdayIndexFromLabel(entry?.repeat || "");
      if(Number.isFinite(fromLabel)) return fromLabel;
      return getWeekdayIndexFromISO(entry?.date || "");
    }

    function getRepeatMonthlyOrdinalFromEntry(entry){
      if(entry?.repeatOrdinal === "last") return { isLast:true, ordinal:null };
      if(Number.isFinite(entry?.repeatOrdinal)) return { isLast:false, ordinal: entry.repeatOrdinal };
      const labelInfo = getMonthlyOrdinalInfoFromLabel(entry?.repeat || "");
      if(labelInfo && (labelInfo.isLast || Number.isFinite(labelInfo.ordinal))){
        return { isLast: Boolean(labelInfo.isLast), ordinal: labelInfo.isLast ? null : labelInfo.ordinal };
      }
      const byDate = getMonthlyOrdinalFromISO(entry?.date || "");
      if(byDate){
        return { isLast: Boolean(byDate.isLast), ordinal: byDate.isLast ? null : byDate.ordinal };
      }
      return { isLast:false, ordinal:null };
    }

    function getMonthlyWeekdayOccurrenceIndex(iso){
      const d = new Date(`${iso}T00:00:00`);
      if(Number.isNaN(d.getTime())) return NaN;
      return Math.floor((d.getDate() - 1) / 7) + 1;
    }

    function shouldIncludeWeeklyRepeatOnDate(entry, iso){
      if(!shouldIncludeRepeatWindow(entry, iso)) return false;
      const weekday = getRepeatWeekdayFromEntry(entry);
      if(!Number.isFinite(weekday)) return false;
      return getWeekdayIndexFromISO(iso) === weekday;
    }

    function isLastWeekdayOfMonth(iso, weekday){
      const d = new Date(`${iso}T00:00:00`);
      if(Number.isNaN(d.getTime())) return false;
      const year = d.getFullYear();
      const month = d.getMonth();
      const lastDay = new Date(year, month + 1, 0);
      const diff = (lastDay.getDay() - weekday + 7) % 7;
      const lastWeekdayDate = lastDay.getDate() - diff;
      return d.getDate() === lastWeekdayDate;
    }

    function shouldIncludeMonthlyLastWeekdayOnDate(entry, iso){
      if(!shouldIncludeRepeatWindow(entry, iso)) return false;
      const weekday = getRepeatWeekdayFromEntry(entry);
      if(!Number.isFinite(weekday)) return false;
      if(getWeekdayIndexFromISO(iso) !== weekday) return false;
      const ordinalInfo = getRepeatMonthlyOrdinalFromEntry(entry);
      if(ordinalInfo.isLast) return isLastWeekdayOfMonth(iso, weekday);
      const occurrence = getMonthlyWeekdayOccurrenceIndex(iso);
      if(!Number.isFinite(occurrence)) return false;
      return occurrence === ordinalInfo.ordinal;
    }

    function shouldIncludeWeekdaysRepeatOnDate(entry, iso){
      if(!shouldIncludeRepeatWindow(entry, iso)) return false;
      const weekday = getWeekdayIndexFromISO(iso);
      return weekday >= 1 && weekday <= 5;
    }

    function getAnnualRepeatMonthDay(label, fallbackIso){
      const normalized = normalizeLabelText(label);
      const prefix = normalizeLabelText(ANNUAL_REPEAT_PREFIX);
      if(normalized.startsWith(prefix)){
        const rest = normalized.slice(prefix.length).trim();
        const parts = rest.split(/\s+/);
        const monthKey = parts[0] || "";
        const day = Number.parseInt(parts[1] || "", 10);
        const months = {
          janeiro: 0,
          fevereiro: 1,
          marco: 2,
          abril: 3,
          maio: 4,
          junho: 5,
          julho: 6,
          agosto: 7,
          setembro: 8,
          outubro: 9,
          novembro: 10,
          dezembro: 11
        };
        if(Object.prototype.hasOwnProperty.call(months, monthKey) && Number.isFinite(day)){
          return { month: months[monthKey], day };
        }
      }
      const fallback = (fallbackIso || "").toString().trim();
      if(!fallback) return null;
      const d = new Date(`${fallback}T00:00:00`);
      if(Number.isNaN(d.getTime())) return null;
      return { month: d.getMonth(), day: d.getDate() };
    }

    function shouldIncludeAnnualRepeatOnDate(entry, iso){
      if(!shouldIncludeRepeatWindow(entry, iso)) return false;
      const target = getAnnualRepeatMonthDay(entry?.repeat || "", entry?.date || "");
      if(!target) return false;
      const d = new Date(`${iso}T00:00:00`);
      if(Number.isNaN(d.getTime())) return false;
      return d.getMonth() === target.month && d.getDate() === target.day;
    }

    function isWeeklyRepeatCalendarEntry(e){
      return (e?.extra || e?.simple) && isWeeklyRepeatLabel(e?.repeat);
    }

    function isMonthlyLastWeekdayCalendarEntry(e){
      return (e?.extra || e?.simple) && isMonthlyLastWeekdayLabel(e?.repeat);
    }

    function isWeekdaysRepeatCalendarEntry(e){
      return (e?.extra || e?.simple) && isWeekdaysRepeatLabel(e?.repeat);
    }

    function isAnnualRepeatCalendarEntry(e){
      return (e?.extra || e?.simple) && isAnnualRepeatLabel(e?.repeat);
    }

    function isCustomRepeatCalendarEntry(e){
      return (e?.extra || e?.simple) && Boolean((e?.repeatUnit || "").toString().trim());
    }

    function isCalendarRepeatEntry(e){
      return isDailyRepeatCalendarEntry(e)
        || isWeeklyRepeatCalendarEntry(e)
        || isMonthlyLastWeekdayCalendarEntry(e)
        || isWeekdaysRepeatCalendarEntry(e)
        || isAnnualRepeatCalendarEntry(e)
        || isCustomRepeatCalendarEntry(e);
    }

    async function copyTextToClipboard(text, btn, doneLabel){
      try{
        if(!navigator.clipboard){
          showAlert("C¥pia de texto nÊo suportada neste navegador.");
          return;
        }
        await navigator.clipboard.writeText(text);
        if(btn){
          const hasIcon = !!btn.querySelector("svg");
          if(hasIcon){
            btn.classList.add("copiedFlash");
            setTimeout(()=>{ btn.classList.remove("copiedFlash"); }, 350);
          }else{
            const original = btn.textContent;
            btn.textContent = doneLabel || "Copiado!";
            setTimeout(()=>{ btn.textContent = original; }, 900);
          }
        }
      }catch(e){
        showAlert("NÊo foi poss¦vel copiar o texto.");
      }
    }

    async function copyImageToClipboard(url, btn, defaultLabel){
      try{
        if(!navigator.clipboard || !window.ClipboardItem){
          showAlert("C¥pia de imagem nÊo suportada neste navegador.");
          return;
        }
        const res = await fetch(url);
        if(!res.ok) throw new Error("fetch");
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        if(btn){
          const hasIcon = !!btn.querySelector("svg");
          if(hasIcon){
            btn.classList.add("copiedFlash");
            setTimeout(()=>{ btn.classList.remove("copiedFlash"); }, 350);
          }else{
            const original = defaultLabel || btn.textContent;
            btn.textContent = "Copiado!";
            setTimeout(()=>{ btn.textContent = original; }, 900);
          }
        }
      }catch(e){
        showAlert("NÊo foi poss¦vel copiar a imagem.");
      }
    }

    let popupResolver = null;
    let popupMode = "alert";
    let popupActionSource = "dismiss";

    function openPopup(options){
      if(!popupOverlay) return Promise.resolve(false);
      clearPopupInlineActions();
      const title = (options?.title || "Aviso").toString();
      const message = (options?.message || "").toString();
      const hasOkLabel = Object.prototype.hasOwnProperty.call(options || {}, "okLabel");
      const okLabelRaw = hasOkLabel ? options.okLabel : "OK";
      const okLabel = (okLabelRaw ?? "").toString();
      const cancelLabel = (options?.cancelLabel || "Cancelar").toString();
      const showCancel = Boolean(options?.showCancel);
      const useInput = Boolean(options?.input);
      const centerMessage = Boolean(options?.centerMessage);
      const multiline = Boolean(options?.multiline);
      const useImages = Boolean(options?.images);
      popupActionSource = "dismiss";
      popupMode = useInput ? "prompt" : (showCancel ? "confirm" : "alert");
      if(popupTitle) popupTitle.textContent = title;
      if(popupMessage) popupMessage.textContent = message;
      if(popupOkBtn) popupOkBtn.textContent = okLabel;
      if(showCancel && !okLabel && popupOkBtn){ popupOkBtn.textContent = "Enviar"; }
      if(popupCancelBtn) popupCancelBtn.textContent = cancelLabel;
      if(popupCancelBtn) popupCancelBtn.style.display = showCancel ? "inline-flex" : "none";
      if(popupOkBtn) popupOkBtn.style.display = (showCancel || okLabel) ? "inline-flex" : "none";
      if(popupActions){
        popupActions.classList.toggle("isHidden", !showCancel && !okLabel);
      }
      if(popupInputWrap) popupInputWrap.style.display = useInput ? "block" : "none";
      if(popupImagesWrap) popupImagesWrap.style.display = useImages ? "block" : "none";
      if(popupModal){
        popupModal.classList.toggle("isCentered", Boolean(useInput));
        popupModal.classList.toggle("isMessageCentered", centerMessage);
      }
      clearPopupQuickPick();
      if(popupInput) popupInput.style.display = multiline ? "none" : "block";
      if(popupTextarea) popupTextarea.style.display = multiline ? "block" : "none";
      if(popupShortcutHint){
        popupShortcutHint.textContent = options?.shortcutsHint
          ? "Atalhos: Ctrl+P pedido | Ctrl+O rastreio"
          : "";
        popupShortcutHint.style.display = options?.shortcutsHint ? "block" : "none";
      }
      popupLastImages = [];
      if(useImages){
        resetPopupImages();
        if(popupImagesLabel) popupImagesLabel.textContent = (options?.imagesLabel || "Imagens (opcional)").toString();
        if(popupImagesHint) popupImagesHint.textContent = (options?.imagesHint || "Clique na imagem para copiar.").toString();
      }else{
        resetPopupImages();
      }
      if(multiline && popupTextarea){
        popupTextarea.value = (options?.inputValue || "").toString();
        popupTextarea.placeholder = (options?.inputPlaceholder || "").toString();
      }else if(popupInput){
        popupInput.type = (options?.inputType || "text").toString();
        popupInput.value = (options?.inputValue || "").toString();
        popupInput.placeholder = (options?.inputPlaceholder || "").toString();
      }
      markOverlayForDrawerReturn(popupOverlay, [popupCloseBtn]);
      popupOverlay.classList.add("show");
      if(useInput){
        const input = getActivePopupInput();
        if(input) setTimeout(()=> input.focus(), 60);
      }
      return new Promise(resolve => {
        popupResolver = resolve;
      });
    }

    function closePopup(result){
      if(!popupOverlay) return;
      popupOverlay.classList.remove("show");
      if(popupResolver){
      if(popupMode === "prompt"){
          const activeInput = getActivePopupInput();
          const value = result ? (activeInput ? activeInput.value : "") : null;
          popupResolver(value);
        }else{
          popupResolver(Boolean(result));
        }
        popupResolver = null;
      }
      popupMode = "alert";
      if(popupInput){
        popupInput.value = "";
        popupInput.type = "text";
        popupInput.placeholder = "";
      }
      if(popupTextarea){
        popupTextarea.value = "";
        popupTextarea.placeholder = "";
      }
      if(popupInputWrap) popupInputWrap.style.display = "none";
      if(popupModal){
        popupModal.classList.remove("isCentered");
        popupModal.classList.remove("isMessageCentered");
      }
      popupLastImages = popupImageFiles.slice();
      popupGalleryFiles = [];
      resetPopupImages();
      if(popupImagesWrap) popupImagesWrap.style.display = "none";
      popupShortcutContext = null;
      clearPopupQuickPick();
      clearPopupInlineActions();
      handleDrawerReturnAfterClose(popupOverlay, [popupCloseBtn]);
    }

    if(popupImagesInput){
      popupImagesInput.addEventListener("change", ()=>{
        popupImageFiles = Array.from(popupImagesInput.files || []);
        renderPopupImages();
      });
    }
    if(popupOverlay){
      popupOverlay.addEventListener("click", (e)=>{
        const btn = e.target.closest("[data-popup-image-copy]");
        if(!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const url = (btn.getAttribute("data-popup-image-url") || "").toString().trim();
        if(!url) return;
        copyImageToClipboard(url, btn, "Copiar");
      });
    }

    function showAlert(message, title){
      return openPopup({ title: title || "Aviso", message, okLabel: "", showCancel: false });
    }

    function showConfirm(message, title){
      return openPopup({ title: title || "Confirmar", message, showCancel: true, centerMessage: true });
    }

    function showPrompt(message, title, options){
      return openPopup({
        title: title || "Aviso",
        message,
        okLabel: options?.okLabel || "OK",
        cancelLabel: options?.cancelLabel || "Cancelar",
        showCancel: true,
        input: true,
        inputType: options?.inputType || "text",
        inputValue: options?.inputValue || "",
        inputPlaceholder: options?.inputPlaceholder || ""
      });
    }

    /***********************
     * CALEND\u00c1RIO (visualiza\u00e7\u00e3o)
     ***********************/
    function syncCalendarOpenFlags(){
      // garante que itens existentes estejam verdes e cria entradas faltantes
      const list = (tasks || []);
      const ids = new Set(list.map(t => String(t.id || "")));
      const nowIso = new Date().toISOString();
      const map = new Map((calendarHistory || []).map(e => [String(e.id || ""), { ...e }]));
      let changed = false;

      for(const t of list){
        if(t?.isExtra) continue;
        const id = String(t.id || "");
        if(!id) continue;
        const prev = map.get(id);
        const date = (getEffectivePhaseDate(t) || t.proxEtapa || prev?.date || "").toString().trim();
        if(!date) continue;
        const whatsapp = normalizeWhatsappNumber(t.whatsapp || "") || (prev?.whatsapp || "");
        const phaseIdx = getLastPhaseIndex(t);
        const prazoHora = getEffectivePhaseTime(t);
        const entry = {
          id,
          date,
          assunto: getCalendarAssuntoFromTask(t),
          loja: (t.loja || "").trim(),
          pedido: (getEffectivePedidoFromTask(t) || t.pedido || "").toString().trim(),
          rastreio: (getEffectiveRastreioFromTask(t) || t.rastreio || "").toString().trim(),
          cliente: (t.cliente || "").trim(),
          whatsapp,
          prazoHora,
          phaseIdx,
          lastPhaseText: getLastPhaseText(t),
          open: true,
          createdAt: prev?.createdAt || nowIso,
          updatedAt: prev?.updatedAt || prev?.createdAt || nowIso,
        };

        const same =
          prev &&
          prev.date === entry.date &&
          prev.assunto === entry.assunto &&
          prev.loja === entry.loja &&
          prev.pedido === entry.pedido &&
          prev.rastreio === entry.rastreio &&
          prev.cliente === entry.cliente &&
          prev.whatsapp === entry.whatsapp &&
          prev.prazoHora === entry.prazoHora &&
          prev.phaseIdx === entry.phaseIdx &&
          prev.lastPhaseText === entry.lastPhaseText &&
          prev.open === true;

        if(!same){
          entry.updatedAt = nowIso;
          map.set(id, entry);
          changed = true;
        }else{
          map.set(id, prev);
        }
      }

      for(const [id, entry] of map){
        const shouldOpen = ids.has(id);
        if(Boolean(entry.open) !== shouldOpen){
          map.set(id, { ...entry, open: shouldOpen, updatedAt: nowIso });
          changed = true;
        }
      }

      if(changed) saveCalendarHistory([...map.values()]);
    }

    let simpleTaskEditId = "";
    let lastSimpleTaskRepeatValue = "nao_repite";
    let recurrenceEndDraft = { mode:"never", date:"", count:null };
    let recurrenceDraft = { interval:1, unit:"day", weekdays:[], monthlyMode:"by_day" };
    let recurrenceModalConfirmed = false;
    function updateSimpleTaskRepeatLabels(iso){
      if(!simpleTaskRepeat) return;
      const options = Array.from(simpleTaskRepeat.options || []);
      const weeklyOption = options.find(opt => (opt.value || "").toString().trim() === "semanal");
      const monthlyOption = options.find(opt => (opt.value || "").toString().trim() === "mensal_ultima");
      const annualOption = options.find(opt => (opt.value || "").toString().trim() === "anual");
      if(weeklyOption) weeklyOption.text = getSimpleTaskWeeklyLabelByDate(iso);
      if(monthlyOption) monthlyOption.text = getSimpleTaskMonthlyLabelByDate(iso);
      if(annualOption) annualOption.text = getSimpleTaskAnnualLabelByDate(iso);
    }

    function openSimpleTaskModal(date, existing){
      if(!simpleTaskOverlay) return;
      const ref = existing || null;
      const iso = (ref?.date || date || calSelectedISO || todayISO()).toString().trim();
      simpleTaskEditId = ref ? String(ref.id || "") : "";
      if(ref){
        setRecurrenceEndDraftFromEntry(ref);
        setRecurrenceDraftFromEntry(ref, iso);
      }else{
        recurrenceEndDraft = { mode:"never", date:"", count:null };
        recurrenceDraft = getDefaultRecurrenceDraft(iso);
      }
      if(simpleTaskDate) simpleTaskDate.value = iso;
      if(simpleTaskStart) simpleTaskStart.value = (ref?.startTime || "").toString().trim();
      if(simpleTaskEnd) simpleTaskEnd.value = (ref?.endTime || "").toString().trim();
      const fallbackTask = ref ? (tasks || []).find(t => String(t.id || "") === String(ref.id || "")) : null;
      const storeValue = (ref?.loja || fallbackTask?.loja || "").toString().trim();
      if(simpleTaskStore) simpleTaskStore.value = storeValue;
      if(simpleTaskSubject) simpleTaskSubject.value = (ref?.assunto || "").toString().trim();
      if(simpleTaskText) simpleTaskText.value = (ref?.extraText || "").toString().trim();
      updateSimpleTaskRepeatLabels(iso);
      if(simpleTaskRepeat){
        const repeatRaw = (ref?.repeat || "").toString().trim();
        let matched = false;
        if(repeatRaw){
          const options = Array.from(simpleTaskRepeat.options || []);
          const optByText = options.find(opt => (opt.text || "").toString().trim() === repeatRaw);
          if(optByText){
            simpleTaskRepeat.value = optByText.value;
            matched = true;
          }else if(isWeeklyRepeatLabel(repeatRaw)){
            simpleTaskRepeat.value = "semanal";
            matched = true;
          }else if(isMonthlyLastWeekdayLabel(repeatRaw)){
            simpleTaskRepeat.value = "mensal_ultima";
            matched = true;
          }else if(isAnnualRepeatLabel(repeatRaw)){
            simpleTaskRepeat.value = "anual";
            matched = true;
          }else if(ref?.repeatUnit){
            simpleTaskRepeat.value = "personalizar";
            matched = true;
          }else{
            const optByValue = options.find(opt => (opt.value || "").toString().trim() === repeatRaw);
            if(optByValue){
              simpleTaskRepeat.value = optByValue.value;
              matched = true;
            }
          }
        }
        if(!matched) simpleTaskRepeat.value = "nao_repite";
        lastSimpleTaskRepeatValue = simpleTaskRepeat.value;
        syncSimpleTaskRepeatEditButton();
      }
      simpleTaskOverlay.classList.add("show");
      setTimeout(()=>{ if(simpleTaskSubject) simpleTaskSubject.focus(); }, 40);
    }

    function closeSimpleTaskModal(){
      if(!simpleTaskOverlay) return;
      simpleTaskOverlay.classList.remove("show");
      simpleTaskEditId = "";
    }

    function openRecurrenceModal(){
      if(!recurrenceOverlay) return;
      const iso = (simpleTaskDate?.value || "").toString().trim() || todayISO();
      if(simpleTaskEditId){
        const entry = (calendarHistory || []).find(item => String(item.id || "") === simpleTaskEditId);
        if(entry){
          setRecurrenceEndDraftFromEntry(entry);
          setRecurrenceDraftFromEntry(entry, iso);
        }else{
          recurrenceDraft = getDefaultRecurrenceDraft(iso);
        }
      }else{
        recurrenceEndDraft = { mode:"never", date:"", count:null };
        recurrenceDraft = getDefaultRecurrenceDraft(iso);
      }
      applyRecurrenceDraftToUI();
      applyRecurrenceEndDraftToUI();
      updateRecurrenceMonthlyOptions(iso);
      syncRecurrenceWeekdaysVisibility();
      recurrenceOverlay.classList.add("show");
    }

    function closeRecurrenceModal(){
      if(!recurrenceOverlay) return;
      recurrenceOverlay.classList.remove("show");
      if(!recurrenceModalConfirmed && simpleTaskRepeat){
        simpleTaskRepeat.value = lastSimpleTaskRepeatValue || "nao_repite";
      }
      syncSimpleTaskRepeatEditButton();
    }

    function syncRecurrenceWeekdaysVisibility(){
      if(!recurrenceWeekdays || !recurrenceFrequency) return;
      const value = (recurrenceFrequency.value || "").toString().trim();
      recurrenceWeekdays.style.display = value === "week" ? "flex" : "none";
      if(recurrenceMonthlyWrap){
        recurrenceMonthlyWrap.style.display = value === "month" ? "block" : "none";
      }
      if(value === "month"){
        const iso = (simpleTaskDate?.value || "").toString().trim() || todayISO();
        updateRecurrenceMonthlyOptions(iso);
      }
    }

    function syncSimpleTaskRepeatEditButton(){
      if(!simpleTaskRepeatEditBtn || !simpleTaskRepeat) return;
      const value = (simpleTaskRepeat.value || "").toString().trim();
      simpleTaskRepeatEditBtn.style.display = value === "personalizar" ? "inline-flex" : "none";
    }

    function updateRecurrenceMonthlyOptions(iso){
      if(!recurrenceMonthlyOptions) return;
      const options = Array.from(recurrenceMonthlyOptions.options || []);
      const byDay = options.find(opt => (opt.value || "").toString().trim() === "by_day");
      const byWeekday = options.find(opt => (opt.value || "").toString().trim() === "by_weekday");
      if(byDay) byDay.text = getMonthlyDayOptionLabel(iso);
      if(byWeekday) byWeekday.text = getMonthlyWeekdayOptionLabel(iso);
    }

    function saveSimpleTask(){
      if(!simpleTaskDate || !simpleTaskText || !simpleTaskSubject) return;
      let date = (simpleTaskDate.value || "").toString().trim();
      const subject = (simpleTaskSubject.value || "").toString().trim();
      const text = (simpleTaskText.value || "").toString().trim();
      if(!date){
        showAlert("Informe a data.");
        return;
      }
      if(!subject){
        showAlert("Digite o assunto.");
        return;
      }
      if(!text){
        showAlert("Digite a descricao.");
        return;
      }
      const startTime = (simpleTaskStart?.value || "").toString().trim();
      const endTime = (simpleTaskEnd?.value || "").toString().trim();
      const loja = (simpleTaskStore?.value || "").toString().trim();
      const repeatValue = (simpleTaskRepeat?.value || "").toString().trim();
      if(repeatValue === "dias_uteis"){
        const adjusted = getNextBusinessDayISO(date);
        if(adjusted) date = adjusted;
      }
      const customConfig = repeatValue === "personalizar"
        ? {
            interval: recurrenceDraft.interval,
            unit: recurrenceDraft.unit,
            weekdays: recurrenceDraft.weekdays,
            monthlyMode: recurrenceDraft.monthlyMode
          }
        : null;
      const repeat = repeatValue === "semanal"
        ? getSimpleTaskWeeklyLabelByDate(date)
        : (repeatValue === "mensal_ultima"
          ? getSimpleTaskMonthlyLabelByDate(date)
          : (repeatValue === "anual"
            ? getSimpleTaskAnnualLabelByDate(date)
            : (repeatValue === "personalizar"
              ? getCustomRepeatLabel(customConfig)
              : (simpleTaskRepeat?.selectedOptions?.[0]?.text || "").toString().trim())));
      if(!loja){
        showAlert("Selecione a loja.");
        return;
      }
      const nowIso = new Date().toISOString();
      const editingId = (simpleTaskEditId || "").trim();
      const entryId = editingId || `simple-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const prevEntry = (calendarHistory || []).find(e => String(e.id || "") === entryId);
      const prevTask = (tasks || []).find(t => String(t.id || "") === entryId);
      const fallbackUserId = String(currentUser?.id || "");
      const fallbackUserName = (currentUser?.display_name || currentUser?.username || "").toString().trim();
      const createdById = (prevTask?.created_by_user_id || prevEntry?.created_by_user_id || fallbackUserId || "").toString();
      const createdByName = (prevTask?.created_by_username || prevEntry?.created_by_username || (createdById === fallbackUserId ? fallbackUserName : "")).toString();
      let repeatWeekday = (repeatValue === "semanal" || repeatValue === "mensal_ultima")
        ? (Number.isFinite(prevEntry?.repeatWeekday) ? prevEntry.repeatWeekday : getWeekdayIndexFromISO(date))
        : null;
      const monthlyInfo = repeatValue === "mensal_ultima" ? getMonthlyOrdinalFromISO(date) : null;
      let repeatOrdinal = repeatValue === "mensal_ultima"
        ? (prevEntry?.repeatOrdinal ?? (monthlyInfo?.isLast ? "last" : monthlyInfo?.ordinal))
        : null;
      if(customConfig?.unit === "month" && customConfig?.monthlyMode === "by_weekday"){
        repeatWeekday = getWeekdayIndexFromISO(date);
        const info = getMonthlyOrdinalFromISO(date);
        repeatOrdinal = info?.isLast ? "last" : info?.ordinal;
      }
      let repeatUntil = "";
      let repeatCount = null;
      if(repeatValue !== "nao_repite"){
        if(recurrenceEndDraft.mode === "date"){
          repeatUntil = (recurrenceEndDraft.date || "").toString().trim();
        }else if(recurrenceEndDraft.mode === "count"){
          const count = Number.isFinite(recurrenceEndDraft.count) ? recurrenceEndDraft.count : null;
          repeatCount = count;
          if(count){
            repeatUntil = computeRepeatUntilByCount(
              date,
              repeatValue,
              repeatWeekday,
              repeatOrdinal,
              count,
              customConfig
            );
          }
        }
      }
      const entry = {
        id: entryId,
        date,
        assunto: subject,
        extraText: text,
        startTime,
        endTime,
        loja,
        repeat,
        repeatWeekday,
        repeatOrdinal,
        repeatEvery: customConfig?.interval || null,
        repeatUnit: customConfig?.unit || "",
        repeatWeekdays: Array.isArray(customConfig?.weekdays) ? customConfig.weekdays.slice() : [],
        repeatMonthlyMode: (customConfig?.monthlyMode || "").toString(),
        repeatUntil,
        repeatCount,
        extra: true,
        open: prevEntry ? Boolean(prevEntry.open) : true,
        created_by_user_id: createdById,
        created_by_username: createdByName,
        createdAt: prevEntry?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      const next = (calendarHistory || []).filter(e => String(e.id || "") !== entryId);
      next.push(entry);
      saveCalendarHistory(next);
      renderCalendar();
      calSelectedISO = date;
      renderCalendarDayDetails(date, { scrollToFirst:true });
      const extraTask = {
        id: entryId,
        data: date,
        proxEtapa: date,
        assunto: subject,
        extraText: text,
        startTime,
        endTime,
        loja,
        repeat,
        repeatWeekday,
        repeatOrdinal,
        repeatEvery: customConfig?.interval || null,
        repeatUnit: customConfig?.unit || "",
        repeatWeekdays: Array.isArray(customConfig?.weekdays) ? customConfig.weekdays.slice() : [],
        repeatMonthlyMode: (customConfig?.monthlyMode || "").toString(),
        repeatUntil,
        repeatCount,
        isExtra: true,
        created_by_user_id: createdById,
        created_by_username: createdByName,
        createdAt: prevEntry?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      const list = (tasks || []).slice();
      const idx = list.findIndex(t => String(t.id || "") === entryId);
      if(idx >= 0){
        list[idx] = { ...list[idx], ...extraTask };
      }else{
        list.unshift(extraTask);
      }
      tasksSingleIndex = 0;
      saveTasks(list);
      closeSimpleTaskModal();
    }

    async function closeExtraTask(taskId){
      const id = (taskId || "").trim();
      if(!id) return;
      const t = (tasks || []).find(x => String(x.id || "") === id);
      if(!t) return false;
      const ok = await showConfirm("Encerrar esta tarefa extra?");
      if(!ok) return;
      const nowIso = new Date().toISOString();
      addTaskToDone(t, { closedAt: nowIso, closedById: (currentUser?.id || "").toString(), closedByName: (currentUser?.display_name || currentUser?.username || "").toString().trim(), isExtra: true });
      tasks = (tasks || []).filter(x => String(x.id || "") !== id);
      saveTasks(tasks);
      const prev = (calendarHistory || []).find(e => String(e.id || "") === id);
      if(prev){
        const next = (calendarHistory || []).filter(e => String(e.id || "") !== id);
        next.push({ ...prev, open:false, updatedAt: nowIso });
        saveCalendarHistory(next);
        renderCalendar();
        renderCalendarDayDetails(calSelectedISO);
      }
    }

    function upsertCalendarFromTask(t){
      if(!t) return false;
      const date = getTaskDisplayDate(t) || (t.proxEtapa || "").trim();
      if(!date) return; // s\u00f3 entra no calend\u00e1rio se tiver Pr\u00f3xima Etapa

      const assunto = getCalendarAssuntoFromTask(t);
      const nowIso = new Date().toISOString();
      const prev = (calendarHistory || []).find(x => x.id === t.id);

      const pedidoEfetivo = (getEffectivePedidoFromTask(t) || "").trim();
      const rastEfetivo = (getEffectiveRastreioFromTask(t) || "").trim();
      const lastPhaseText = getLastPhaseText(t);
      const prazoHora = getEffectivePhaseTime(t);

      const entry = {
        id: String(t.id || ""),
        date,
        assunto,
        loja: (t.loja || "").trim(),
        pedido: pedidoEfetivo || (t.pedido || "").trim(),
        rastreio: rastEfetivo || (t.rastreio || "").trim(),
        cliente: (t.cliente || "").trim(),
        whatsapp: normalizeWhatsappNumber(t.whatsapp || ""),
        prazoHora,
        phaseIdx: getLastPhaseIndex(t),
        lastPhaseText,
        open: true,
        created_by_user_id: (t.created_by_user_id || prev?.created_by_user_id || "").toString(),
        created_by_username: (t.created_by_username || prev?.created_by_username || "").toString(),
        createdAt: prev?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      const next = (calendarHistory || []).filter(x => x.id !== entry.id);
      next.push(entry);
      saveCalendarHistory(next);
    }

    function markCalendarClosed(t){
      if(!t) return false;
      const prev = (calendarHistory || []).find(x => x.id === t.id);
      const date = ((getEffectivePhaseDate(t) || t.proxEtapa || prev?.date || "")).trim();
      if(!date) return;

      const assunto = getCalendarAssuntoFromTask(t) || ((t.assunto || prev?.assunto || "").trim()) || "(Sem assunto)";
      const nowIso = new Date().toISOString();

      const pedidoEfetivo = (getEffectivePedidoFromTask(t) || prev?.pedido || "").toString().trim();
      const rastEfetivo = (getEffectiveRastreioFromTask(t) || prev?.rastreio || "").toString().trim();
      const clienteEfetivo = (t.cliente || prev?.cliente || "").toString().trim();
      const lastPhaseText = getLastPhaseText(t) || (prev?.lastPhaseText || "");
      const prazoHora = getEffectivePhaseTime(t) || (prev?.prazoHora || "");

      const entry = {
        id: String(t.id || ""),
        date,
        assunto,
        loja: ((t.loja || prev?.loja || "")).trim(),
        pedido: pedidoEfetivo || ((t.pedido || prev?.pedido || "")).trim(),
        rastreio: rastEfetivo || ((t.rastreio || prev?.rastreio || "")).trim(),
        cliente: clienteEfetivo,
        whatsapp: normalizeWhatsappNumber(t.whatsapp || "") || (prev?.whatsapp || ""),
        prazoHora,
        phaseIdx: getLastPhaseIndex(t) || (prev?.phaseIdx ?? 0),
        lastPhaseText,
        open: false,
        created_by_user_id: (t.created_by_user_id || prev?.created_by_user_id || "").toString(),
        created_by_username: (t.created_by_username || prev?.created_by_username || "").toString(),
        createdAt: prev?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      const next = (calendarHistory || []).filter(x => x.id !== entry.id);
      next.push(entry);
      saveCalendarHistory(next);
    }

    function monthLabelPT(year, monthIdx){
      const d = new Date(year, monthIdx, 1);
      try{
        return d.toLocaleDateString("pt-BR", { month:"long", year:"numeric" });
      }catch(e){
        return `${monthIdx+1}/${year}`;
      }
    }

    function buildWeekHeader(){
      if(!calWeekHeader) return;
      if(calWeekHeader.dataset.built === "1") return;
      calWeekHeader.innerHTML = "";
      const names = ["Seg","Ter","Qua","Qui","Sex","S\u00e1b","Dom"];
      for(const n of names){
        const el = document.createElement("div");
        el.textContent = n;
        calWeekHeader.appendChild(el);
      }
      calWeekHeader.dataset.built = "1";
    }

    function getMondayBasedWeekdayIndex(date){
      const day = date.getDay(); // 0 (Dom) - 6 (S\u00e1b)
      return (day + 6) % 7; // 0 (Seg) - 6 (Dom)
    }
    function isMobileCalendarLayout(){
      return window.matchMedia && window.matchMedia("(max-width:720px)").matches;
    }

    function syncCalendarNavPlacement(){
      if(!calNavRow) return;
      const mobile = isMobileCalendarLayout();
      if(mobile && calNavSlot && calNavRow.parentElement !== calNavSlot){
        calNavSlot.appendChild(calNavRow);
      }
      if(!mobile && calendarOverlay){
        const header = calendarOverlay.querySelector(".mh");
        if(header && calNavRow.parentElement !== header){
          header.appendChild(calNavRow);
        }
      }
    }

    function renderCalendar(){
      if(!calendarOverlay || !calGrid || !calMonthLabel) return;

      // sempre sincroniza para garantir cores corretas
      syncCalendarOpenFlags();
      syncOverdueCalendarEntries();
      syncCalendarNavPlacement();

      buildWeekHeader();
      calMonthLabel.textContent = monthLabelPT(calViewYear, calViewMonth);

      const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
      const firstDayOfMonth = new Date(calViewYear, calViewMonth, 1);
      const leadingBlanks = getMondayBasedWeekdayIndex(firstDayOfMonth);
      const totalCells = leadingBlanks + daysInMonth;
      const trailingBlanks = (7 - (totalCells % 7)) % 7;

      const todayIso = todayISO();
      const cells = [];
      const prevMonthDate = new Date(calViewYear, calViewMonth, 0);
      const prevMonthDays = prevMonthDate.getDate();
      const prevMonth = prevMonthDate.getMonth();
      const prevMonthYear = prevMonthDate.getFullYear();

      for(let i = 0; i < leadingBlanks; i++){
        const dayNum = prevMonthDays - leadingBlanks + i + 1;
        const iso = `${prevMonthYear}-${pad2(prevMonth+1)}-${pad2(dayNum)}`;
        cells.push({ blank:false, dayNum, iso, entries:[], isOtherMonth:true });
      }

      for(let dayNum = 1; dayNum <= daysInMonth; dayNum++){
        const iso = `${calViewYear}-${pad2(calViewMonth+1)}-${pad2(dayNum)}`;
        const entries = getCalendarEntriesForDate(iso)
          .sort((a,b) => {
            const overA = isCalendarEntryOverdue(a);
            const overB = isCalendarEntryOverdue(b);
            if(overA != overB) return overA ? -1 : 1;
            if(Boolean(a.open) != Boolean(b.open)) return a.open ? -1 : 1;
            return (a.assunto||"").localeCompare(b.assunto||"");
          });
        cells.push({ blank:false, dayNum, iso, entries, valid:true });
      }

      for(let i = 0; i < trailingBlanks; i++){
        cells.push({ blank:true });
      }

      const showGridNote = !calSelectedISO;
      const isMobileLayout = isMobileCalendarLayout();
      if(calGridNote){
        const shouldShowMobileNote = showGridNote && isMobileLayout;
        calGridNote.textContent = shouldShowMobileNote ? "Clique em um dia para ver os assuntos." : "";
        calGridNote.style.display = shouldShowMobileNote ? "flex" : "none";
      }
      const gridNoteHtml = (!isMobileLayout && showGridNote)
        ? `<div class="calGridNote">Clique em um dia para ver os assuntos.</div>`
        : "";

      calGrid.innerHTML = cells.map(c => {
        if(c.blank){
          return `<div class="calCell isBlank" aria-hidden="true"></div>`;
        }

        const isToday = c.iso && (c.iso === todayIso);
        const isSelected = c.iso && (c.iso === calSelectedISO);

        const normalEntries = (c.entries || []).filter(e => !(e.extra || e.simple));
        const extraEntries = (c.entries || []).filter(e => (e.extra || e.simple));
        const normalCount = normalEntries.length;
        const extraCount = extraEntries.length;
        const normalList = normalCount > 1
          ? `<div class="calItem open" title="${normalCount} tarefas">${normalCount} tarefas</div>`
          : normalEntries.map(e => {
              const cls = e.open ? "open" : "closed";
        const isOverdue = isCalendarEntryOverdue(e);
              return `<div class="calItem ${cls}" title="${escapeHtml(e.assunto)}">${escapeHtml(e.assunto)}</div>`;
            }).join("");
        const extraList = extraCount > 1
          ? `<div class="calItem extra" title="${extraCount} tarefas extras">${extraCount} extras</div>`
          : extraEntries.map(e => {
              return `<div class="calItem extra" title="${escapeHtml(e.assunto)}">${escapeHtml(e.assunto)}</div>`;
            }).join("");
        const list = [normalList, extraList].filter(Boolean).join("");

        const entriesCount = normalCount + extraCount;
        const countType = extraCount ? "extra" : (normalCount ? "normal" : "");
        const countAttr = entriesCount ? ` data-count="${entriesCount}" data-count-type="${countType}"` : "";
        const countsMobile = entriesCount
          ? `<div class="calCountsMobile">
              ${normalCount ? `<span class="calCountMobile calCountMobileNormal">${normalCount}</span>` : ""}
              ${extraCount ? `<span class="calCountMobile calCountMobileExtra">${extraCount}</span>` : ""}
            </div>`
          : "";
        const cellAttrs = (!c.isOtherMonth && c.iso) ? `data-iso="${c.iso}" data-cal-iso="${c.iso}" tabindex="0"` : "";
        return `
          <div class="calCell ${isSelected ? "isSelected" : ""} ${c.isOtherMonth ? "isOtherMonth" : ""}" ${cellAttrs}${countAttr}>
            <div class="calDayNum">
              <span>${c.dayNum}</span>
              ${isToday ? `<span class="calTodayDot" title="Hoje"></span>` : ""}
            </div>
            <div class="calItems">${list}</div>
            ${countsMobile}
          </div>
        `;
      }).join("") + gridNoteHtml;

      // se nao houver dia selecionado (ou saiu do mes), limpa detalhes
      if(calSelectedISO){
        const stillInMonth = calSelectedISO.startsWith(`${calViewYear}-${pad2(calViewMonth+1)}-`);
        if(!stillInMonth){
          calSelectedISO = "";
          if(calDayTitle) calDayTitle.textContent = "";
          if(calDayDetails) calDayDetails.innerHTML = "";
          if(calSide) calSide.classList.remove("isVisible");
        }
      }else{
        if(calDayTitle) calDayTitle.textContent = "";
        if(calDayDetails) calDayDetails.innerHTML = "";
        if(calSide) calSide.classList.remove("isVisible");
      }
    }

    function renderMiniCalendar(){
      if(!miniCalendarGrid || !miniCalendarLabel) return;

      ensureMiniCalendarNavPlacement();
      syncCalendarOpenFlags();
      miniCalendarLabel.textContent = monthLabelPT(calViewYear, calViewMonth);

      const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
      const firstDayOfMonth = new Date(calViewYear, calViewMonth, 1);
      const leadingBlanks = getMondayBasedWeekdayIndex(firstDayOfMonth);
      const totalCells = leadingBlanks + daysInMonth;
      const trailingBlanks = (7 - (totalCells % 7)) % 7;
      const todayIso = todayISO();
      const cells = [];
      const prevMonthDate = new Date(calViewYear, calViewMonth, 0);
      const prevMonthDays = prevMonthDate.getDate();
      const prevMonth = prevMonthDate.getMonth();
      const prevMonthYear = prevMonthDate.getFullYear();

      for(let i = 0; i < leadingBlanks; i++){
        const dayNum = prevMonthDays - leadingBlanks + i + 1;
        const iso = `${prevMonthYear}-${pad2(prevMonth+1)}-${pad2(dayNum)}`;
        cells.push({ blank:false, dayNum, iso, normalCount:0, extraCount:0, isOtherMonth:true });
      }

      for(let dayNum = 1; dayNum <= daysInMonth; dayNum++){
        const iso = `${calViewYear}-${pad2(calViewMonth+1)}-${pad2(dayNum)}`;
        const entries = getCalendarEntriesForDate(iso, { applyStoreFilter:false });
        const openEntries = entries.filter(e => e.open !== false);
        const normalCount = openEntries.filter(e => !(e.extra || e.simple)).length;
        const extraCount = openEntries.filter(e => (e.extra || e.simple)).length;
        cells.push({ blank:false, dayNum, iso, normalCount, extraCount });
      }

      for(let i = 0; i < trailingBlanks; i++){
        cells.push({ blank:true });
      }

      miniCalendarGrid.innerHTML = cells.map(c => {
        if(c.blank){
          return `<div class="miniCalCell isBlank" aria-hidden="true"></div>`;
        }
        const isToday = c.iso === todayIso;
        const normalHtml = c.normalCount
          ? `<span class="miniCalCount miniCalCountMain">${c.normalCount}</span>`
          : "";
        const extraHtml = c.extraCount
          ? `<span class="miniCalCount miniCalCountExtra">${c.extraCount}</span>`
          : "";
        const ariaSuffix = c.isOtherMonth ? " (m¦s anterior)" : "";
        const ariaLabel = `Dia ${c.dayNum}${ariaSuffix}: ${c.normalCount || 0} tarefa(s) normal(is), ${c.extraCount || 0} tarefa(s) extra(s)`;
        const isoAttr = c.isOtherMonth ? "" : ` data-mini-iso="${c.iso}"`;
        return `
          <button class="miniCalCell ${isToday ? "isToday" : ""} ${c.isOtherMonth ? "isOtherMonth" : ""}" type="button"${isoAttr} aria-label="${ariaLabel}">
            <span class="miniCalDay">${c.dayNum}</span>
            <span class="miniCalCounts">
              ${normalHtml}
              ${extraHtml}
            </span>
          </button>
        `;
      }).join("");
    }

    function openTaskSummaryPopup(ref){
      if(!ref) return;
      const phases = Array.isArray(ref.obs) && ref.obs.length ? ref.obs : [{
        status: getCalendarAssuntoFromTask(ref) || "",
        novoPedido: getEffectivePedidoFromTask(ref) || "",
        date: ref.data || "",
        prazo: getEffectivePhaseDate(ref) || "",
        text: getLastPhaseText(ref) || ""
      }];
      const summaryItems = phases.map((p, idx) => {
        const status = (p?.status || "").toString().trim() || "-";
        const pedido = (p?.novoPedido || getEffectivePedidoFromTask(ref) || "-").toString().trim() || "-";
        const cliente = (ref?.cliente || "-").toString().trim() || "-";
        const dataInicial = formatDateBR(p?.date || "");
        const prazo = formatDateBR(p?.prazo || "");
        const texto = (p?.text || "").toString().trim() || "-";
        const author = (p?.created_by_username || ref?.created_by_username || "").toString().trim();
        return `
          <div class="summaryPhase">
            <div class="summaryPhaseHeader">
              <div class="summaryPhaseTitle">Fase ${idx + 1}</div>
              <div class="summaryPhaseStatus">${escapeHtml(status)}</div>
            </div>
            <div class="summaryMetaGrid">
              <div class="summaryMetaItem"><span class="popupSummaryLabel">Pedido</span> ${escapeHtml(pedido)}</div>
              <div class="summaryMetaItem"><span class="popupSummaryLabel">Cliente</span> ${escapeHtml(cliente)}</div>
              <div class="summaryMetaItem"><span class="popupSummaryLabel">Data inicial</span> ${escapeHtml(dataInicial)}</div>
              <div class="summaryMetaItem"><span class="popupSummaryLabel">Prazo de resolu&ccedil;&atilde;o</span> ${escapeHtml(prazo)}</div>
              ${author ? `<div class="summaryMetaItem"><span class="popupSummaryLabel">Autor</span> ${escapeHtml(author)}</div>` : ""}
            </div>
            <div class="summaryNote">${escapeHtml(texto)}</div>
          </div>
        `;
      });
      const summaryHtml = `
        <div class="popupSummary">
          ${summaryItems.join('<div class="popupSummaryDivider"></div>')}
        </div>
      `;
      openPopup({
        title: "Resumo da tarefa",
        message: "",
        okLabel: "",
        showCancel: false,
      });
      if(popupMessage) popupMessage.innerHTML = summaryHtml;
    }

    function openAttentionPopup(note){
      const raw = (note ?? "").toString();
      const text = raw.trim() ? raw : "Fazer acompanhamento di\u00e1rio";
      openPopup({ title: "Aten\u00e7\u00e3o", message: text, okLabel: "", showCancel: false });
    }

    function showRecurringDeletePopup(){
      const popupPromise = openPopup({
        title: "Excluir tarefa recorrente",
        message: "",
        okLabel: "OK",
        cancelLabel: "Cancelar",
        showCancel: true,
        centerMessage: true
      });
      if(popupMessage){
        popupMessage.innerHTML = `
          <div class="popupOptions">
            <label style="display:flex; gap:10px; align-items:center; margin:6px 0;">
              <input type="radio" name="recurringDeleteOption" value="this" checked>
              <span>Esta tarefa</span>
            </label>
            <label style="display:flex; gap:10px; align-items:center; margin:6px 0;">
              <input type="radio" name="recurringDeleteOption" value="this_future">
              <span>Esta e as tarefas seguintes</span>
            </label>
            <label style="display:flex; gap:10px; align-items:center; margin:6px 0;">
              <input type="radio" name="recurringDeleteOption" value="all">
              <span>Todas as tarefas</span>
            </label>
          </div>
        `;
      }
      return popupPromise.then(ok => {
        if(!ok) return null;
        if(!popupMessage) return "this";
        const selected = popupMessage.querySelector('input[name="recurringDeleteOption"]:checked');
        return (selected?.value || "this").toString();
      });
    }

    async function openNuvemshopSupportPopup(storeName, taskId){
      const base = getNuvemshopSupportBaseUrl(storeName);
      if(!base){
        showAlert("WhatsApp do suporte da Nuvemshop não informado.");
        return;
      }
      popupShortcutContext = taskId ? buildPopupShortcutContext(taskId) : null;
      const popupPromise = openPopup({
        title: "Suporte Nuvemshop",
        message: "Digite a mensagem:",
        okLabel: "Enviar",
        cancelLabel: "Cancelar",
        showCancel: true,
        input: true,
        multiline: true,
        shortcutsHint: true,
        inputType: "text",
        inputValue: "",
        inputPlaceholder: "Escreva sua mensagem",
      });
      mountPopupInlineActions({ okLabel: "Enviar" });
      if(popupOkBtn){ popupOkBtn.textContent = "Enviar"; popupOkBtn.style.display = "inline-flex"; }
      if(popupCancelBtn) popupCancelBtn.style.display = "inline-flex";
      const message = await popupPromise;
      if(message === null) return;
      const text = (message || "").toString().trim();
      if(!text){
        showAlert("Digite uma mensagem.");
        return;
      }
      const url = `${base}${base.includes("?") ? "&" : "?"}text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener");
    }

    async function openCustomerWhatsappPopup(raw, taskId){
      const base = buildCustomerWhatsappUrl(raw || "");
      if(!base){
        showAlert("Nenhum número de WhatsApp informado.");
        return;
      }
      popupShortcutContext = taskId ? buildPopupShortcutContext(taskId) : null;
      const popupPromise = openPopup({
        title: "WhatsApp do cliente",
        message: "Digite a mensagem:",
        okLabel: "Enviar",
        cancelLabel: "Cancelar",
        showCancel: true,
        input: true,
        multiline: true,
        shortcutsHint: true,
        inputType: "text",
        inputValue: "",
        inputPlaceholder: "Escreva sua mensagem",
      });
      mountPopupInlineActions({ okLabel: "Enviar" });
      if(popupOkBtn){ popupOkBtn.textContent = "Enviar"; popupOkBtn.style.display = "inline-flex"; }
      if(popupCancelBtn) popupCancelBtn.style.display = "inline-flex";
      const message = await popupPromise;
      if(message === null) return;
      const text = (message || "").toString().trim();
      if(!text){
        showAlert("Digite uma mensagem.");
        return;
      }
      const url = `${base}${base.includes("?") ? "&" : "?"}text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener");
    }

    function renderCalendarDayDetails(iso, options){
      if(!calDayTitle || !calDayDetails) return;
      bindCalDayDetailsDelegation();
      calDayTitle.textContent = iso ? `Dia: ${iso}` : "";
      if(calAddSimpleBtn){
        calAddSimpleBtn.disabled = !iso;
        calAddSimpleBtn.style.opacity = iso ? "1" : "0.5";
        calAddSimpleBtn.style.pointerEvents = iso ? "auto" : "none";
      }
      if(calAddTaskBtn){
        calAddTaskBtn.disabled = !iso;
        calAddTaskBtn.style.opacity = iso ? "1" : "0.5";
        calAddTaskBtn.style.pointerEvents = iso ? "auto" : "none";
      }
      const shouldScroll = Boolean(options && options.scrollToFirst);
      syncOverdueCalendarEntries();

      if(!iso){
        calDayDetails.innerHTML = "";
        if(calSide) calSide.classList.remove("isVisible");
        return;
      }
      if(calSide) calSide.classList.add("isVisible");

      const entries = getCalendarEntriesForDate(iso)
        .sort((a,b) => {
          const overA = isCalendarEntryOverdue(a);
          const overB = isCalendarEntryOverdue(b);
          if(overA != overB) return overA ? -1 : 1;
          const ta = getDueTimestamp(a.date, a.startTime || a.prazoHora);
          const tb = getDueTimestamp(b.date, b.startTime || b.prazoHora);
          if(ta != tb) return ta - tb;
          return (a.assunto||"").localeCompare(b.assunto||"");
        });

      if(!entries.length){
        calDayDetails.innerHTML = `<div class="note">Nenhuma tarefa neste dia.</div>`;
        return;
      }

      const copyIconSmall = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        const trashIcon = `<svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><rect x="6" y="6" width="12" height="14" rx="2"></rect><path d="M10 10v6"></path><path d="M14 10v6"></path></svg>`;

      const html = entries.map(e => {
        if(e.extra || e.simple){
          const start = (e.startTime || "").toString().trim();
          const end = (e.endTime || "").toString().trim();
          const timeLabel = (start || end) ? `${start || "--:--"} - ${end || "--:--"}` : "Sem hor\u00e1rio";
          const repeatLabel = (e.repeat || "").toString().trim();
          const extraText = (e.extraText || "").toString().trim();
          const lojaLabel = (e.loja || "").toString().trim();
          return `
            <div class="calDetailRow calSimpleRow" data-cal-simple-id="${escapeHtml(String(e.id || ""))}">
              <div class="dot extra"></div>
              <div class="txt">
                <p class="title">${escapeHtml(e.assunto || "Tarefa extra")}</p>
                <div class="meta">
                  ${extraText ? `<div class="extraMeta"><span>Descri\u00e7\u00e3o:</span> <span class="extraValue">${escapeHtml(extraText)}</span></div>` : ""}
                  ${lojaLabel ? `<div class="extraMeta"><span>Loja:</span> <span class="extraValue">${escapeHtml(lojaLabel)}</span></div>` : ""}
                  <div class="extraMeta"><span>Hor\u00e1rio:</span> <span class="extraValue">${escapeHtml(timeLabel)}</span></div>
                  ${repeatLabel ? `<div class="extraMeta"><span>Repeti\u00e7\u00e3o:</span> <span class="extraValue">${escapeHtml(repeatLabel)}</span></div>` : ""}
                </div>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn small iconBtn" data-cal-simple-view="${escapeHtml(String(e.id || ""))}" title="Ver na lista" aria-label="Ver na lista">
                  <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"></path>
                  </svg>
                </button>
                <button class="btn small iconBtn" data-cal-simple-edit="${escapeHtml(String(e.id || ""))}" title="Editar" aria-label="Editar">
                  <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5l4 4L7 21l-4 1 1-4 12.5-14.5z"></path>
                  </svg>
                </button>
                <button class="btn small danger iconBtn" data-cal-simple-del="${escapeHtml(String(e.id || ""))}" title="Excluir" aria-label="Excluir">
                  <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 6h18"></path>
                    <path d="M8 6V4h8v2"></path>
                    <rect x="6" y="6" width="12" height="14" rx="2"></rect>
                    <path d="M10 10v6"></path>
                    <path d="M14 10v6"></path>
                  </svg>
                </button>
              </div>
            </div>
          `;
        }
        const cls = e.open ? "open" : "closed";
        const isOverdue = isCalendarEntryOverdue(e);
        const loja = (e.loja || "").trim();
        const pedido = (e.pedido || "").trim();
        const rastreio = (e.rastreio || "").trim();
        const cliente = (e.cliente || "").trim();
        const taskRef = (tasks || []).find(t => String(t.id || "") === String(e.id || "")) || (tasksDone || []).find(t => String(t.id || "") === String(e.id || ""));
        const customerWhatsappRaw = (e.whatsapp || (taskRef?.whatsapp || "")).toString().trim();
        const customerPhone = normalizeWhatsappNumber(customerWhatsappRaw);
        const customerWhatsappUrl = buildCustomerWhatsappUrl(customerWhatsappRaw);
        const doneTask = (!e.open && Array.isArray(tasksDone))
          ? tasksDone.find(t => String(t.id || "") === String(e.id || ""))
          : null;
        const lastPhaseText = (e.lastPhaseText || getLastPhaseText(doneTask) || "").trim();
        const closedSummaryText = lastPhaseText || "-";

        const pedidoUrl = pedido ? getNuvemshopOrderUrl(loja, pedido) : "";
        const rastreioUrl = rastreio ? (detectCarrierFromCode(rastreio).url || "") : "";
        const suporteBase = getNuvemshopSupportBaseUrl(loja);

        const pedidoHtml = pedido
          ? (pedidoUrl
            ? `<a href="${escapeHtml(pedidoUrl)}" target="_blank" rel="noopener">${escapeHtml(pedido)}</a>`
            : `<span>${escapeHtml(pedido)}</span>`)
          : "-";

        const rastreioHtml = rastreio
          ? (rastreioUrl
            ? `<a href="${escapeHtml(rastreioUrl)}" data-cal-rastreio="${escapeHtml(rastreio)}" data-cal-rastreio-url="${escapeHtml(rastreioUrl)}" target="_blank" rel="noopener">${escapeHtml(rastreio)}</a>`
            : `<span>${escapeHtml(rastreio)}</span>`)
          : "-";

        const pedidoCopyBtn = pedido
          ? `<button class="btn small copyBtn" data-copy-text="${escapeHtml(pedido)}" title="Copiar pedido" aria-label="Copiar pedido" style="padding:4px 6px; margin-left:6px; display:inline-flex; align-items:center; justify-content:center; line-height:1;">${copyIconSmall}</button>`
          : "";
        const clienteCopyBtn = cliente
          ? `<button class="btn small copyBtn" data-copy-text="${escapeHtml(cliente)}" title="Copiar cliente" aria-label="Copiar cliente" style="padding:4px 6px; margin-left:6px; display:inline-flex; align-items:center; justify-content:center; line-height:1;">${copyIconSmall}</button>`
          : "";
        const phoneCopyBtn = customerPhone
          ? `<button class="btn small copyBtn" data-copy-text="${escapeHtml(customerPhone)}" title="Copiar telefone" aria-label="Copiar telefone" style="padding:4px 6px; margin-left:6px; display:inline-flex; align-items:center; justify-content:center; line-height:1;">${copyIconSmall}</button>`
          : "";
        const customerWhatsappTarget = (customerWhatsappRaw || customerPhone || "").toString().trim();
        const phoneAction = customerWhatsappTarget
          ? `<button type="button" class="calPhoneLink" data-customer-whatsapp="${escapeHtml(customerWhatsappTarget)}" title="Enviar mensagem" aria-label="Enviar mensagem">${escapeHtml(customerPhone || customerWhatsappTarget)}</button>`
          : `${escapeHtml(customerPhone || "-")}`;
        const rastreioCopyBtn = rastreio
          ? `<button class="btn small copyBtn" data-copy-text="${escapeHtml(rastreio)}" title="Copiar rastreio" aria-label="Copiar rastreio" style="padding:4px 6px; margin-left:6px; display:inline-flex; align-items:center; justify-content:center; line-height:1;">${copyIconSmall}</button>`
          : "";

        const titleGreen = (t) => `<span style="color:#38d9a9; font-weight:800;">${t}</span>`;
        const prazoInfo = taskRef ? getLastPhasePrazoInfo(taskRef) : { date:"", time:"", has:false };
        const prazoResolucao = (prazoInfo.date || e.date || "").toString().trim();
        const prazoHora = (e.prazoHora || getEffectivePhaseTime(taskRef) || "").toString().trim();
        const prazoResolucaoLabel = prazoResolucao
          ? `${formatDateBR(prazoResolucao)}${prazoHora ? ` ${prazoHora}` : ""}`
          : "-";
        const prazoCopyBtn = prazoResolucao
          ? `<button class="btn small copyBtn copyBtnHidden" data-copy-text="${escapeHtml(prazoResolucaoLabel)}" title="Copiar prazo de resolu\u00e7\u00e3o" aria-label="Copiar prazo de resolu\u00e7\u00e3o" style="padding:4px 6px; margin-left:6px; display:inline-flex; align-items:center; justify-content:center; line-height:1;">${copyIconSmall}</button>`
          : "";
        const phaseInfo = (() => {
          const id = String(e.id || "");
          const fromTasks = (tasks || []).find(t => String(t.id || "") === id);
          const fromDone = (tasksDone || []).find(t => String(t.id || "") === id);
          const ref = fromTasks || fromDone;
          if(!ref){
            const fallback = Number.isFinite(e.phaseIdx)
              ? e.phaseIdx
              : Number.parseInt((e.phaseIdx || "0").toString(), 10);
            const idx = Number.isFinite(fallback) ? fallback : 0;
            return { idx, label: idx >= 0 ? String(idx + 1) : "-" };
          }
          const idx = getLastPhaseIndex(ref);
          return { idx, label: String(idx + 1) };
        })();
        const attentionInfo = (() => {
          const id = String(e.id || "");
          const fromTasks = (tasks || []).find(t => String(t.id || "") === id);
          const fromDone = (tasksDone || []).find(t => String(t.id || "") === id);
          const ref = fromTasks || fromDone;
          return ref ? getEffectivePhaseAttention(ref) : { has:false, note:"" };
        })();
        const phaseCopyBtn = (phaseInfo.label && phaseInfo.label !== "-")
          ? `<button class="btn small copyBtn copyBtnHidden" data-copy-text="${escapeHtml(phaseInfo.label)}" title="Copiar n\u00famero da fase" aria-label="Copiar n\u00famero da fase" style="padding:4px 6px; margin-left:6px; display:inline-flex; align-items:center; justify-content:center; line-height:1;">${copyIconSmall}</button>`
          : "";
        const metaLines = [
          `${titleGreen("Loja:")} ${escapeHtml(loja || "-")}`,
          `${titleGreen("Cliente:")} ${escapeHtml(cliente || "-")} ${clienteCopyBtn}`,
          `${titleGreen("Telefone:")} ${phoneAction} ${phoneCopyBtn}`,
          `${titleGreen("Pedido:")} ${pedidoHtml} ${pedidoCopyBtn}`,
          rastreio ? `${titleGreen("Rastreio:")} ${rastreioHtml} ${rastreioCopyBtn}` : "",
          `${titleGreen("Prazo de resolu\u00e7\u00e3o:")} ${escapeHtml(prazoResolucaoLabel)} ${prazoCopyBtn}`,
          `${titleGreen("N\u00famero da fase:")} ${escapeHtml(phaseInfo.label)} ${phaseCopyBtn}`
        ].filter(Boolean).map(line => `<div>${line}</div>`).join("");

        return `
          <div class="calDetailRow ${isOverdue ? "calOverdue" : ""}" data-cal-item-id="${escapeHtml(String(e.id || ""))}">
            <div class="dot ${cls} ${isOverdue ? "overdue" : ""}"></div>
            <div class="txt">
              <p class="title">${escapeHtml(e.assunto || "Sem assunto")}</p>
              <div class="meta">${metaLines}</div>
              ${!e.open ? `<div class="note" style="margin-top:6px;"><span style="color:#38d9a9; font-weight:800;">Resumo:</span> ${escapeHtml(closedSummaryText)}</div>` : ""}
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              ${attentionInfo.has ? `<button class="btn small iconBtn attentionBtn" data-cal-item-attn="${escapeHtml(String(e.id || ""))}" title="Aten\u00e7\u00e3o" aria-label="Aten\u00e7\u00e3o">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 9v4"></path>
                  <circle cx="12" cy="17" r="1"></circle>
                  <path d="M10.3 4.5h3.4l6.3 11.1a2 2 0 0 1-1.7 3H5.7a2 2 0 0 1-1.7-3z"></path>
                </svg>
              </button>` : ""}
              ${!e.open ? `<button class="btn small iconBtn" data-cal-item-reactivate="${escapeHtml(String(e.id || ""))}" title="Reativar" aria-label="Reativar">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 12a9 9 0 0 1 9-9"></path>
                  <polyline points="3 4 3 12 11 12"></polyline>
                  <path d="M21 12a9 9 0 0 1-9 9"></path>
                  <polyline points="21 20 21 12 13 12"></polyline>
                </svg>
              </button>` : ""}
              <button class="btn small iconBtn" data-cal-item-summary="${escapeHtml(String(e.id || ""))}" title="Resumo" aria-label="Resumo">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <line x1="6" y1="7" x2="20" y2="7"></line>
                  <line x1="6" y1="12" x2="20" y2="12"></line>
                  <line x1="6" y1="17" x2="20" y2="17"></line>
                  <circle cx="4" cy="7" r="1"></circle>
                  <circle cx="4" cy="12" r="1"></circle>
                  <circle cx="4" cy="17" r="1"></circle>
                </svg>
              </button>
              <button class="btn small iconBtn" data-cal-item-view="${escapeHtml(String(e.id || ""))}" data-cal-phase-idx="${escapeHtml(String(phaseInfo.idx))}" title="Ver fase" aria-label="Ver fase">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"></path>
                </svg>
              </button>
              <button class="btn small iconBtn" data-cal-item-editphase="${escapeHtml(String(e.id || ""))}" data-cal-phase-idx="${escapeHtml(String(phaseInfo.idx))}" title="Editar fase" aria-label="Editar fase">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5l4 4L7 21l-4 1 1-4 12.5-14.5z"></path>
                </svg>
              </button>
              ${suporteBase ? `<button class="btn small iconBtn" type="button" data-support-store="${escapeHtml(loja)}" title="Suporte Nuvemshop" aria-label="Suporte Nuvemshop">
                <svg class="nuvemIcon" viewBox="0 0 48 48" aria-hidden="true">
                  <circle class="nuvemLeft" cx="17.5" cy="26.5" r="9.5"></circle>
                  <circle class="nuvemRight" cx="30.5" cy="22.5" r="12.5"></circle>
                </svg>
              </button>` : ""}
              ${customerWhatsappUrl ? `<button class="btn small iconBtn" type="button" data-customer-whatsapp="${escapeHtml(customerWhatsappRaw)}" title="WhatsApp Cliente" aria-label="WhatsApp Cliente">
                <svg class="sakIcon" viewBox="0 0 48 48" aria-hidden="true">
                  <path class="sakFill" d="M24 4C13.5 4 5 10.8 5 19.2c0 5.1 3.1 9.5 7.9 12-0.2 1.9-0.8 4.4-2.7 7 3.3-0.4 5.8-1.4 7.8-2.3 1.8 0.4 3.8 0.7 5.9 0.7 10.5 0 19-6.8 19-15.2S34.5 4 24 4z"></path>
                </svg>
              </button>` : ""}
              <button class="btn small iconBtn" data-cal-item-add="${escapeHtml(String(e.id || ""))}" title="Adicionar" aria-label="Adicionar">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              ${e.open ? `<button class="btn small iconBtn" data-cal-item-close="${escapeHtml(String(e.id || ""))}" title="Encerrar tarefa" aria-label="Encerrar tarefa">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <polyline points="5 13 9 17 19 7"></polyline>
                </svg>
              </button>` : ""}
              <button class="btn small danger iconBtn" data-cal-item-del="${escapeHtml(String(e.id || ""))}" title="Excluir" aria-label="Excluir">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6h18"></path>
                  <path d="M8 6V4h8v2"></path>
                  <rect x="6" y="6" width="12" height="14" rx="2"></rect>
                  <path d="M10 10v6"></path>
                  <path d="M14 10v6"></path>
                </svg>
              </button>
            </div>
          </div>
        `;
      }).join("");

      // Botao "Limpar dia" (se existir container/UX ja previsto)
      const clearBtnHtml = `<button class="btn danger" type="button" data-cal-clear-day="${escapeHtml(iso)}">Limpar dia</button>`;

      const legend = `<div class="note" style="margin-top:6px; opacity:.85;">Verde = chamado em aberto | Vermelho = chamado removido (resolvido)</div>`;

      calDayDetails.innerHTML = html + clearBtnHtml + legend;

      // copiar (pedido / rastreio / cliente)
      calDayDetails.querySelectorAll("[data-copy-text]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const val = (btn.getAttribute("data-copy-text") || "").toString();
          if(!val) return;
          navigator.clipboard.writeText(val).then(()=>{
            btn.style.opacity = "0.6";
            setTimeout(()=>{ btn.style.opacity = "1"; }, 450);
          }).catch(()=> showAlert("NÒo foi possÝvel copiar."));
        });
      });
      calDayDetails.querySelectorAll("[data-cal-rastreio]").forEach(link=>{
        link.addEventListener("click", (e)=>{
          e.preventDefault();
          e.stopPropagation();
          const code = (link.getAttribute("data-cal-rastreio") || "").trim();
          const url = (link.getAttribute("data-cal-rastreio-url") || link.getAttribute("href") || "").trim();
          if(code) copyTextToClipboard(code, link, "Copiado!");
          if(url) window.open(url, "_blank");
        });
      });

      // excluir item (do calendario e da lista)
      calDayDetails.querySelectorAll("[data-cal-item-del]").forEach(btn=>{
        btn.addEventListener("click", async ()=>{
          const id = (btn.getAttribute("data-cal-item-del") || "").toString();
          if(!id) return;
          const result = await openPopup({
            title: "Remover tarefa",
            message: "Voc\u00ea quer deletar esta tarefa ou apenas marc\u00e1-la como conclu\u00edda?",
            okLabel: "Excluir tarefa",
            cancelLabel: "Concluir tarefa",
            showCancel: true,
            centerMessage: true,
          });
          if(!result && popupActionSource !== "ok" && popupActionSource !== "cancel") return;

          // remove da lista
          const taskRef = (tasks || []).find(t => String(t.id || "") === String(id));
          if(popupActionSource === "cancel"){
            if(taskRef && taskRef.isExtra){
              await closeExtraTask(id);
            }else{
              closeTaskAsDone(id);
            }
          }else{
            tasks = (tasks || []).filter(t => String(t.id) !== String(id));
            saveTasks(tasks);
            if(taskRef && taskRef.isExtra){
              calendarHistory = (calendarHistory || []).filter(e => String(e.id) !== String(id));
              saveCalendarHistory(calendarHistory);
            }else{
              markCalendarClosed(taskRef);
            }
          }

          // remove do calendario
          calendarHistory = (calendarHistory || []).filter(e => String(e.id) !== String(id));
          saveCalendarHistory(calendarHistory);

          // re-render
          renderTasks();
          renderCalendar();
          renderCalendarDayDetails(calSelectedISO);
        });
      });
      calDayDetails.querySelectorAll("[data-cal-item-close]").forEach(btn=>{
        btn.addEventListener("click", (e)=>{ e.preventDefault();
          const id = (btn.getAttribute("data-cal-item-close") || "").toString().trim();
          if(!id) return;
          openCloseTaskModal(id);
        });
      });

      calDayDetails.querySelectorAll("[data-cal-simple-del]").forEach(btn=>{
        btn.addEventListener("click", async ()=>{
          const id = (btn.getAttribute("data-cal-simple-del") || "").toString().trim();
          if(!id) return;
          const entry = (calendarHistory || []).find(e => String(e.id || "") === id);
          if(!entry){
            showAlert("Tarefa extra n\u00e3o encontrada.");
            return;
          }
          const isRecurring = isCalendarRepeatEntry(entry);
          if(!isRecurring){
            const ok = await showConfirm("Excluir esta tarefa extra?");
            if(!ok) return;
            calendarHistory = (calendarHistory || []).filter(e => String(e.id || "") !== id);
            saveCalendarHistory(calendarHistory);
            const extraIdx = (tasks || []).findIndex(t => String(t.id || "") === id);
            if(extraIdx >= 0){
              addTaskToDone(tasks[extraIdx], { closedById: (currentUser?.id || "").toString(), closedByName: (currentUser?.display_name || currentUser?.username || "").toString().trim(), isExtra: true });
              tasks.splice(extraIdx, 1);
              saveTasks(tasks);
            }
            renderCalendar();
            renderCalendarDayDetails(calSelectedISO);
            return;
          }

          const choice = await showRecurringDeletePopup();
          if(!choice) return;
          const occurrenceIso = (calSelectedISO || entry.date || "").toString().trim();
          if(!occurrenceIso){
            showAlert("Data da ocorr\u00eancia inv\u00e1lida.");
            return;
          }

          if(choice === "all"){
            calendarHistory = (calendarHistory || []).filter(e => String(e.id || "") !== id);
            saveCalendarHistory(calendarHistory);
            const extraIdx = (tasks || []).findIndex(t => String(t.id || "") === id);
            if(extraIdx >= 0){
              addTaskToDone(tasks[extraIdx], { closedById: (currentUser?.id || "").toString(), closedByName: (currentUser?.display_name || currentUser?.username || "").toString().trim(), isExtra: true });
              tasks.splice(extraIdx, 1);
              saveTasks(tasks);
            }
          }else if(choice === "this"){
            const exclusions = getRepeatExclusions(entry);
            if(!exclusions.includes(occurrenceIso)) exclusions.push(occurrenceIso);
            entry.repeatExclusions = exclusions;
            calendarHistory = (calendarHistory || []).map(e => String(e.id || "") === id ? { ...e, repeatExclusions: exclusions } : e);
            saveCalendarHistory(calendarHistory);
            const extraIdx = (tasks || []).findIndex(t => String(t.id || "") === id);
            if(extraIdx >= 0){
              tasks[extraIdx] = { ...tasks[extraIdx], repeatExclusions: exclusions };
              saveTasks(tasks);
            }
          }else if(choice === "this_future"){
            const untilIso = addDaysISO(occurrenceIso, -1);
            calendarHistory = (calendarHistory || []).map(e => String(e.id || "") === id ? { ...e, repeatUntil: untilIso } : e);
            saveCalendarHistory(calendarHistory);
            const extraIdx = (tasks || []).findIndex(t => String(t.id || "") === id);
            if(extraIdx >= 0){
              tasks[extraIdx] = { ...tasks[extraIdx], repeatUntil: untilIso };
              saveTasks(tasks);
            }
          }
          renderCalendar();
          renderCalendarDayDetails(calSelectedISO);
        });
      });
      calDayDetails.querySelectorAll("[data-cal-simple-edit]").forEach(btn=>{
        btn.addEventListener("click", (e)=>{
          e.preventDefault();
          e.stopPropagation();
          const id = (btn.getAttribute("data-cal-simple-edit") || "").toString().trim();
          if(!id) return;
          const entry = (calendarHistory || []).find(item => String(item.id || "") === id);
          if(!entry){
            showAlert("Tarefa extra n\u00e3o encontrada.");
            return;
          }
          openSimpleTaskModal(entry.date || calSelectedISO || todayISO(), entry);
        });
      });
      calDayDetails.querySelectorAll("[data-cal-simple-view]").forEach(btn=>{
        btn.addEventListener("click", (e)=>{
          e.preventDefault();
          e.stopPropagation();
          const id = (btn.getAttribute("data-cal-simple-view") || "").toString().trim();
          if(!id) return;
          const ref = (tasks || []).find(t => String(t.id || "") === id);
          if(!ref){
            showAlert("Tarefa extra n\u00e3o encontrada na lista.");
            return;
          }
          closeCalendar();

          tasksSearchQuery = "";
          tasksSearchStoreValue = "";
          tasksSearchPeriodValue = "ALL";
          tasksSearchPeriodFromValue = "";
          tasksSearchPeriodToValue = "";
          tasksSearchStatusValue = "";
          if(tasksSearch) tasksSearch.value = "";
          if(tasksSearchStore) tasksSearchStore.value = "";
          if(tasksSearchPeriod) tasksSearchPeriod.value = "ALL";
          if(tasksSearchPeriodCustom) tasksSearchPeriodCustom.style.display = "none";
          if(tasksSearchPeriodFrom) tasksSearchPeriodFrom.value = "";
          if(tasksSearchPeriodTo) tasksSearchPeriodTo.value = "";
          if(tasksSearchStatus) tasksSearchStatus.value = "";

          tasksShowAll = true;
          setView("tasks");
          renderTasks();

          requestAnimationFrame(()=>{
            if(!tasksList) return;
            const card = tasksList.querySelector(`[data-task-id="${CSS.escape(id)}"]`);
            if(!card){
              showAlert("Tarefa extra n\u00e3o encontrada na lista.");
              return;
            }
            card.scrollIntoView({ behavior:"smooth", block:"center" });
          });
        });
      });

      if(shouldScroll){
        const firstRow = calDayDetails.querySelector(".calDetailRow");
        const target = firstRow || calDayDetails;
        setTimeout(()=>{
          target.scrollIntoView({ behavior:"smooth", block:"start" });
        }, 0);
      }

      calDayDetails.querySelectorAll("[data-cal-item-view]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const id = (btn.getAttribute("data-cal-item-view") || "").toString().trim();
          const idxRaw = (btn.getAttribute("data-cal-phase-idx") || "0").toString();
          const phaseIdx = Number.parseInt(idxRaw, 10);
          if(!id) return;
          closeCalendar();

          tasksSearchQuery = "";
          tasksSearchStoreValue = "";
          tasksSearchPeriodValue = "ALL";
          tasksSearchPeriodFromValue = "";
          tasksSearchPeriodToValue = "";
          tasksSearchStatusValue = "";
          if(tasksSearch) tasksSearch.value = "";
          if(tasksSearchStore) tasksSearchStore.value = "";
          if(tasksSearchPeriod) tasksSearchPeriod.value = "ALL";
          if(tasksSearchPeriodCustom) tasksSearchPeriodCustom.style.display = "none";
          if(tasksSearchPeriodFrom) tasksSearchPeriodFrom.value = "";
          if(tasksSearchPeriodTo) tasksSearchPeriodTo.value = "";
          if(tasksSearchStatus) tasksSearchStatus.value = "";

          tasksShowAll = true;
          setView("tasks");
          renderTasks();

          requestAnimationFrame(()=>{
            if(!tasksList) return;
            const card = tasksList.querySelector(`[data-task-id="${CSS.escape(id)}"]`);
            if(!card){
              showAlert("Tarefa nÊo encontrada na lista.");
              return;
            }
            card.scrollIntoView({ behavior:"smooth", block:"center" });
            const phasesWrap = card.querySelector(`.linksBlock[data-task-phases="${CSS.escape(id)}"]`);
            if(phasesWrap){
              phasesWrap.classList.add("isExpanded");
              const phaseEl = phasesWrap.querySelector(`[data-phase-idx="${Number.isFinite(phaseIdx) ? String(phaseIdx) : "0"}"]`);
              if(phaseEl){
                phaseEl.classList.add("phaseFocus");
                phaseEl.scrollIntoView({ behavior:"smooth", block:"center" });
                setTimeout(()=> phaseEl.classList.remove("phaseFocus"), 1400);
              }
            }
          });
        });
      });

      calDayDetails.querySelectorAll("[data-cal-item-summary]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const id = (btn.getAttribute("data-cal-item-summary") || "").toString().trim();
          if(!id) return;
          const fromTasks = (tasks || []).find(t => String(t.id || "") === id);
          const fromDone = (tasksDone || []).find(t => String(t.id || "") === id);
          const ref = fromTasks || fromDone;
          if(!ref){
            showAlert("Tarefa nÊo encontrada.");
            return;
          }
          openTaskSummaryPopup(ref);
        });
      });

      calDayDetails.querySelectorAll("[data-cal-item-attn]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const id = (btn.getAttribute("data-cal-item-attn") || "").toString().trim();
          if(!id) return;
          const fromTasks = (tasks || []).find(t => String(t.id || "") === id);
          const fromDone = (tasksDone || []).find(t => String(t.id || "") === id);
          const ref = fromTasks || fromDone;
          if(!ref){
            showAlert("Tarefa nuo encontrada.");
            return;
          }
          const info = getEffectivePhaseAttention(ref);
          openAttentionPopup(info.note);
        });
      });

      calDayDetails.querySelectorAll("[data-cal-item-reactivate]").forEach(btn=>{
        btn.addEventListener("click", async ()=>{
          const id = (btn.getAttribute("data-cal-item-reactivate") || "").toString().trim();
          if(!id) return;
          const fromDone = (tasksDone || []).find(t => String(t.id || "") === id);
          if(!fromDone){
            showAlert("Tarefa nuo encontrada.");
            return;
          }
          const ok = await showConfirm("Reativar esta tarefa?");
          if(!ok) return;
          tasksDone = (tasksDone || []).filter(t => String(t.id || "") !== id);
          saveTasksDone(tasksDone);
          tasks = tasks || [];
          const revived = { ...fromDone };
          delete revived.closedAt;
          tasks.unshift(revived);
          saveTasks(tasks);
          const reopenedDate = (getEffectivePhaseDate(fromDone) || (fromDone.proxEtapa || "")).toString().trim();
          if(reopenedDate){
            upsertCalendarFromTask(fromDone);
          }else{
            calendarHistory = (calendarHistory || []).filter(e => String(e.id || "") !== id);
            saveCalendarHistory(calendarHistory);
          }
          renderTasks();
          renderCalendar();
          renderCalendarDayDetails(calSelectedISO);
        });
      });

      calDayDetails.querySelectorAll("[data-cal-item-add]").forEach(btn=>{
        btn.addEventListener("click", async ()=>{
          const id = (btn.getAttribute("data-cal-item-add") || "").toString().trim();
          if(!id) return;
          phaseEditOrigin = "calendar";
          const result = await openPopup({
            title: "Adicionar",
            message: "O que deseja criar?",
            okLabel: "Nova fase",
            cancelLabel: "Nova tarefa",
            showCancel: true,
            centerMessage: true,
          });
          if(result && popupActionSource === "ok"){
            addPhaseFromCard(id);
            return;
          }
          if(!result && popupActionSource === "cancel"){
            clearTasksForm();
            taskModalFromCalendar = true;
            if(taskOverlay) taskOverlay.classList.add("isCalendarContext");
            openTaskModal();
          }
        });
      });

      // limpar dia
      const clearBtn = calDayDetails.querySelector("[data-cal-clear-day]");
      if(clearBtn){
        clearBtn.addEventListener("click", async ()=>{
          const dayIso = (clearBtn.getAttribute("data-cal-clear-day") || "").trim();
          if(!dayIso) return;
          const ok = await showConfirm(`Limpar todos os registros do dia ${dayIso} no calend¯rio?\n\nIsso N+O remove as tarefas em aberto, apenas apaga os itens do calend¯rio deste dia.`);
          if(!ok) return;
          const next = (calendarHistory || []).filter(e => e.date !== dayIso);
          saveCalendarHistory(next);
          renderCalendar();
          renderCalendarDayDetails(dayIso);
        });
      }
    }

    function openCalendar(){
      if(!calendarOverlay) return;
      calendarOverlay.classList.add("show");
      // garante estado consistente
      syncCalendarOpenFlags();
      updateCalendarStoreFilterOptions();
      setCalendarFilterPanelOpen(false);
      renderCalendar();
      renderMiniCalendar();
      // se ainda n\u00e3o selecionou nada, mostra instru\u00e7\u00e3o
      if(calDayDetails && !calDayDetails.innerHTML.trim()){
        renderCalendarDayDetails("");
      }
    }

    function closeCalendar(){
      if(!calendarOverlay) return;
      calendarOverlay.classList.remove("show");
      // limpa sele\u00e7\u00e3o para evitar confus\u00e3o
      calSelectedISO = "";
      if(calDayTitle) calDayTitle.textContent = "";
      if(calDayDetails) calDayDetails.innerHTML = "";
      setCalendarFilterPanelOpen(false);
    }
    function safeJsonParse(text){
      try{ return JSON.parse(text); }catch(e){ return null; }
    }
    function uniq(arr){
      const out=[], seen=new Set();
      for(const x of (arr||[])){
        const k=(x||"").toString();
        if(!k) continue;
        if(seen.has(k)) continue;
        seen.add(k);
        out.push(k);
      }
      return out;
    }
    function pad2(n){ return String(n).padStart(2,"0"); }
    function scrollToTop(){ window.scrollTo({ top:0, behavior:"smooth" }); }
    function scrollToBottom(){ window.scrollTo({ top:document.documentElement.scrollHeight, behavior:"smooth" }); }

    function ensureMiniCalendarNavPlacement(){
      const body = document.querySelector(".miniCalendarBody");
      if(!body) return;
      const nav = document.querySelector(".miniCalHeaderNav");
      if(nav && nav.parentElement !== body){
        body.appendChild(nav);
      }
    }

    // senha apenas para PERGUNTAS e IMPORT
    async function requirePassword(actionName){
      return true;
    }

    function todayISO(){
      const d = new Date();
      const y = d.getFullYear();
      const m = pad2(d.getMonth()+1);
      const day = pad2(d.getDate());
      return `${y}-${m}-${day}`;
    }

    function formatDateBR(value){
      const s = (value || "").toString().trim();
      if(!s) return "-";
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if(m) return `${m[3]}/${m[2]}/${m[1]}`;
      return s;
    }
    function formatDateTimeBR(value){
      const raw = (value || "").toString().trim();
      if(!raw) return "-";
      const d = new Date(raw);
      if(Number.isNaN(d.getTime())) return raw;
      return d.toLocaleString("pt-BR");
    }
    function formatDateTimeFromTs(value){
      const ts = Number(value || 0);
      if(!ts) return "-";
      const d = new Date(ts * 1000);
      if(Number.isNaN(d.getTime())) return "-";
      return d.toLocaleString("pt-BR");
    }
    function formatTimeShort(){
      return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    function formatDuration(seconds){
      const total = Math.max(0, Number(seconds || 0));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = Math.floor(total % 60);
      if(h > 0) return `${h}h ${m}m`;
      if(m > 0) return `${m}m ${s}s`;
      return `${s}s`;
    }

    function stopActivityTracking(){
      if(activityPingTimer){
        clearInterval(activityPingTimer);
        activityPingTimer = null;
      }
      lastActivityPing = 0;
    }

    function sendActivityPing(force){
      if(!currentUser) return;
      const now = Date.now();
      if(!force && (now - lastActivityPing) < 60000) return;
      lastActivityPing = now;
      apiActivityPing().catch(() => {});
    }

    function startActivityTracking(){
      stopActivityTracking();
      sendActivityPing(true);
      activityPingTimer = setInterval(() => sendActivityPing(false), 60000);
    }

    function initActivityListeners(){
      const handler = () => sendActivityPing(false);
      document.addEventListener("mousemove", handler, { passive:true });
      document.addEventListener("keydown", handler, { passive:true });
      document.addEventListener("click", handler, { passive:true });
      document.addEventListener("scroll", handler, { passive:true });
      document.addEventListener("touchstart", handler, { passive:true });
      document.addEventListener("visibilitychange", () => {
        if(!document.hidden){
          sendActivityPing(true);
          if(currentView === "users"){
            refreshUsersView();
          }
        }
      });
    }

    function startUsersAutoRefresh(){
      if(usersAutoRefreshTimer){
        clearInterval(usersAutoRefreshTimer);
      }
      usersAutoRefreshTimer = setInterval(() => {
        if(currentView === "users" && !document.hidden){
          refreshUsersView();
        }
      }, 60000);
    }

    function stopUsersAutoRefresh(){
      if(usersAutoRefreshTimer){
        clearInterval(usersAutoRefreshTimer);
        usersAutoRefreshTimer = null;
      }
    }

    function setUsersRefreshStatus(message, isError){
      if(!usersRefreshStatus) return;
      if(usersRefreshStatusTimer){
        clearTimeout(usersRefreshStatusTimer);
        usersRefreshStatusTimer = null;
      }
      usersRefreshStatus.textContent = message || "";
      usersRefreshStatus.classList.toggle("isError", Boolean(isError));
      const shouldShow = Boolean(message);
      usersRefreshStatus.classList.toggle("isVisible", shouldShow);
      if(shouldShow){
        usersRefreshStatusTimer = setTimeout(()=>{
          usersRefreshStatus.classList.remove("isVisible", "isError");
          usersRefreshStatus.textContent = "";
        }, 2200);
      }
    }

    function isAdminUser(){
      if(!currentUser) return false;
      if(typeof currentUser.is_admin !== "undefined") return Boolean(currentUser.is_admin);
      if(!currentUser.username) return false;
      return String(currentUser.username).trim().toLowerCase() === String(ADMIN_USERNAME).trim().toLowerCase();
    }

    function normalizeUserRole(role){
      return String(role || "").toLowerCase() === "secundario" ? "secundario" : "principal";
    }

    function getCpfDigits(value){
      return (value || "").toString().replace(/\D/g, "");
    }

    function isValidCpf(value){
      const cpf = getCpfDigits(value);
      if(cpf.length !== 11) return false;
      if(/^(\d)\1{10}$/.test(cpf)) return false;
      let sum = 0;
      for(let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
      let d1 = (sum * 10) % 11;
      if(d1 === 10) d1 = 0;
      if(d1 !== Number(cpf[9])) return false;
      sum = 0;
      for(let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
      let d2 = (sum * 10) % 11;
      if(d2 === 10) d2 = 0;
      if(d2 !== Number(cpf[10])) return false;
      return true;
    }
    function isValidCnpj(value){
      const cnpj = getCpfDigits(value);
      if(cnpj.length !== 14) return false;
      if(/^(\d)\1{13}$/.test(cnpj)) return false;
      let length = 12;
      let numbers = cnpj.substring(0, length);
      let digits = cnpj.substring(length);
      let sum = 0;
      let pos = length - 7;
      for(let i = length; i >= 1; i--){
        sum += Number(numbers[length - i]) * pos--;
        if(pos < 2) pos = 9;
      }
      let result = (sum % 11) < 2 ? 0 : 11 - (sum % 11);
      if(result !== Number(digits[0])) return false;
      length = 13;
      numbers = cnpj.substring(0, length);
      sum = 0;
      pos = length - 7;
      for(let i = length; i >= 1; i--){
        sum += Number(numbers[length - i]) * pos--;
        if(pos < 2) pos = 9;
      }
      result = (sum % 11) < 2 ? 0 : 11 - (sum % 11);
      if(result !== Number(digits[1])) return false;
      return true;
    }

    function isSecondaryUser(){
      if(!currentUser) return false;
      return normalizeUserRole(currentUser.role) === "secundario";
    }

    function isPrincipalUser(){
      if(!currentUser) return false;
      return normalizeUserRole(currentUser.role) === "principal";
    }

    function canAccessUsersView(){
      return isAdminUser() || isPrincipalUser();
    }

    function getAccountOwnerId(){
      if(!currentUser) return 0;
      const ownerId = Number(currentUser.owner_user_id || 0);
      if(isSecondaryUser() && ownerId > 0) return ownerId;
      return Number(currentUser.id || 0);
    }


    function getNuvemshopOrderUrl(loja, pedido){
      const p = (pedido || "").trim();
      if(!p) return "";
      const l = (loja || "").trim();
      if(l === "Shop 80"){
        return buildOrdersUrl("Shop 80", p);
      }
      if(l === "Di\u00e1rio Nerdify"){
        return buildOrdersUrl("Di\u00e1rio Nerdify", p);
      }
      return "";
    }


    function uid(){
      return Math.random().toString(16).slice(2) + Date.now().toString(16);
    }

    function statusColors(status){
      const found = STATUS_OPTIONS.find(s => s.value === status);
      if(found) return { a: found.colorA, b: found.colorB };
      return { a: "#7c8cff", b: "#38d9a9" };
    }

    /***********************
     * VIEW SWITCH
     ***********************/
    function setView(view){
      const prevView = currentView;
      const allowedViews = ["search", "tasks", "done", "users", "userActivity"];
      currentView = allowedViews.includes(view) ? view : "search";
      storageSet(STORAGE_KEY_VIEW, currentView);
      const toTasks = currentView === "tasks";
      const toDone = currentView === "done";
      const toUsers = currentView === "users";
      const toUserActivity = currentView === "userActivity";
      if(currentView !== "users"){
        stopUsersAutoRefresh();
      }else{
        startUsersAutoRefresh();
      }

      if(searchInput){
        if(prevView === "tasks") tasksSearchQuery = (searchInput.value || "");
        if(prevView === "done") doneSearchQuery = (searchInput.value || "");
      }

      const animateFromRight = (el) => {
        if(!el) return;
        el.classList.remove("toLeft", "toRight");
        el.classList.add("toRight");
        requestAnimationFrame(() => {
          el.classList.remove("toRight");
        });
      };

      if(viewStack && viewSearch && viewTasks){
        if(viewDone && toDone){
          const isFirst = !viewStack.classList.contains("viewReady");
          if(isFirst) viewStack.classList.add("isInstant");
          viewStack.classList.add("viewReady");

          viewSearch.classList.remove("isActive", "toLeft", "toRight");
          viewTasks.classList.remove("isActive", "toLeft", "toRight");
          if(viewUsers) viewUsers.classList.remove("isActive", "toLeft", "toRight");
          if(viewUserActivity) viewUserActivity.classList.remove("isActive", "toLeft", "toRight");
          viewSearch.classList.add("viewHidden");
          viewTasks.classList.add("viewHidden");
          if(viewUsers) viewUsers.classList.add("viewHidden");
          if(viewUserActivity) viewUserActivity.classList.add("viewHidden");

          viewDone.classList.remove("viewHidden", "toLeft", "toRight");
          viewDone.classList.add("isActive", "toRight");

          requestAnimationFrame(() => {
            if(isFirst) viewStack.classList.remove("isInstant");
            viewDone.classList.remove("toRight");
          });
        }else if(viewUsers && toUsers){
          const isFirst = !viewStack.classList.contains("viewReady");
          if(isFirst) viewStack.classList.add("isInstant");
          viewStack.classList.add("viewReady");

          viewSearch.classList.remove("isActive", "toLeft", "toRight");
          viewTasks.classList.remove("isActive", "toLeft", "toRight");
          if(viewDone) viewDone.classList.remove("isActive", "toLeft", "toRight");
          if(viewUserActivity) viewUserActivity.classList.remove("isActive", "toLeft", "toRight");
          viewSearch.classList.add("viewHidden");
          viewTasks.classList.add("viewHidden");
          if(viewDone) viewDone.classList.add("viewHidden");
          if(viewUserActivity) viewUserActivity.classList.add("viewHidden");

          viewUsers.classList.remove("viewHidden", "toLeft", "toRight");
          viewUsers.classList.add("isActive", "toRight");

          requestAnimationFrame(() => {
            if(isFirst) viewStack.classList.remove("isInstant");
            viewUsers.classList.remove("toRight");
          });
        }else if(viewUserActivity && toUserActivity){
          const isFirst = !viewStack.classList.contains("viewReady");
          if(isFirst) viewStack.classList.add("isInstant");
          viewStack.classList.add("viewReady");

          viewSearch.classList.remove("isActive", "toLeft", "toRight");
          viewTasks.classList.remove("isActive", "toLeft", "toRight");
          if(viewDone) viewDone.classList.remove("isActive", "toLeft", "toRight");
          if(viewUsers) viewUsers.classList.remove("isActive", "toLeft", "toRight");
          viewSearch.classList.add("viewHidden");
          viewTasks.classList.add("viewHidden");
          if(viewDone) viewDone.classList.add("viewHidden");
          if(viewUsers) viewUsers.classList.add("viewHidden");

          viewUserActivity.classList.remove("viewHidden", "toLeft", "toRight");
          viewUserActivity.classList.add("isActive", "toRight");

          requestAnimationFrame(() => {
            if(isFirst) viewStack.classList.remove("isInstant");
            viewUserActivity.classList.remove("toRight");
          });
        }else{
          if(viewDone){
            viewDone.classList.remove("isActive", "toLeft", "toRight");
            viewDone.classList.add("viewHidden");
          }
          if(viewUsers){
            viewUsers.classList.remove("isActive", "toLeft", "toRight");
            viewUsers.classList.add("viewHidden");
          }
          if(viewUserActivity){
            viewUserActivity.classList.remove("isActive", "toLeft", "toRight");
            viewUserActivity.classList.add("viewHidden");
          }
          const incoming = toTasks ? viewTasks : viewSearch;
          const outgoing = toTasks ? viewSearch : viewTasks;
          const isFirst = !viewStack.classList.contains("viewReady");

          viewSearch.classList.remove("viewHidden");
          viewTasks.classList.remove("viewHidden");

          if(isFirst) viewStack.classList.add("isInstant");
          viewStack.classList.add("viewReady");

          incoming.classList.remove("toLeft", "toRight");
          incoming.classList.add("isActive", "toRight");
          outgoing.classList.remove("toLeft", "toRight");
          outgoing.classList.add("toLeft");
          outgoing.classList.remove("isActive");

          requestAnimationFrame(() => {
            if(isFirst) viewStack.classList.remove("isInstant");
            incoming.classList.remove("toLeft", "toRight");
          });
        }
      }

      if(prevView === "tasks" && currentView === "tasks"){
        animateFromRight(viewTasks);
      }
      if(prevView === "done" && currentView === "done"){
        animateFromRight(viewDone);
      }

      const showSearchRow = !toUserActivity;
      if(searchRow) searchRow.style.display = showSearchRow ? "" : "none";
      if(searchFilterBtn) searchFilterBtn.disabled = !showSearchRow;
      if(searchInput) searchInput.disabled = !showSearchRow;

      if(currentView === "tasks"){

        if(searchInput) searchInput.placeholder = "Buscar por cliente ou pedido...";
        if(searchInput){
          searchQueryCache = (searchInput.value || "");
          searchInput.value = tasksSearchQuery || "";
        }

        navToggleViewBtn.textContent = "Tarefas";
        navToggleViewBtn.classList.remove("primary");
        if(viewTitleText) viewTitleText.textContent = (tasksTypeFilter === "extra" ? "Tarefas extras" : "Tarefas Diarias");
if(goToSearchBtn){
          goToSearchBtn.classList.remove("isSearchView");
          goToSearchBtn.setAttribute("title", "Ir para o buscador");
          goToSearchBtn.setAttribute("aria-label", "Ir para o buscador");
        }
        if(goToTasksBtn){
          const isNormalTasks = tasksTypeFilter !== "extra";
          goToTasksBtn.classList.toggle("isTasksView", isNormalTasks);
          goToTasksBtn.setAttribute("title", "Tarefas");
          goToTasksBtn.setAttribute("aria-label", "Tarefas");
        }
        if(goToTasksExtraBtn){
          const isExtraTasks = tasksTypeFilter === "extra";
          goToTasksExtraBtn.classList.toggle("isTasksView", isExtraTasks);
          goToTasksExtraBtn.setAttribute("title", "Tarefas extras");
          goToTasksExtraBtn.setAttribute("aria-label", "Tarefas extras");
        }
        if(goToDoneTasksBtn){
          goToDoneTasksBtn.classList.remove("isDoneView");
          goToDoneTasksBtn.setAttribute("title", "Tarefas encerradas");
          goToDoneTasksBtn.setAttribute("aria-label", "Tarefas encerradas");
        }

        renderTasks();
        scrollToTop();
        updateFilterButtonsState();
        return;
      }

      if(currentView === "done"){
        if(searchInput) searchInput.placeholder = "Buscar tarefas encerradas...";
        if(searchInput) searchInput.value = doneSearchQuery || "";

        navToggleViewBtn.textContent = "Tarefas";
        navToggleViewBtn.classList.remove("primary");
        if(viewTitleText) viewTitleText.textContent = "Tarefas Encerradas";
        if(goToSearchBtn){
          goToSearchBtn.classList.remove("isSearchView");
          goToSearchBtn.setAttribute("title", "Ir para o buscador");
          goToSearchBtn.setAttribute("aria-label", "Ir para o buscador");
        }
        if(goToTasksBtn){
          goToTasksBtn.classList.remove("isTasksView");
          goToTasksBtn.setAttribute("title", "Tarefas");
          goToTasksBtn.setAttribute("aria-label", "Tarefas");
        }
        if(goToTasksExtraBtn){
          goToTasksExtraBtn.classList.remove("isTasksView");
          goToTasksExtraBtn.setAttribute("title", "Tarefas extras");
          goToTasksExtraBtn.setAttribute("aria-label", "Tarefas extras");
        }
        if(goToDoneTasksBtn){
          goToDoneTasksBtn.classList.add("isDoneView");
          goToDoneTasksBtn.setAttribute("title", "Tarefas encerradas");
          goToDoneTasksBtn.setAttribute("aria-label", "Tarefas encerradas");
        }
        if(goToUsersBtn){
          goToUsersBtn.classList.remove("isUsersView");
          goToUsersBtn.setAttribute("title", "Usu\u00e1rios");
          goToUsersBtn.setAttribute("aria-label", "Usu\u00e1rios");
        }

        renderDoneTasks();
        scrollToTop();
        updateFilterButtonsState();
        return;
      }

      if(currentView === "users"){
        navToggleViewBtn.textContent = "Tarefas";
        navToggleViewBtn.classList.remove("primary");
        if(viewTitleText) viewTitleText.textContent = "Usu\u00e1rios";
        if(searchInput){
          searchInput.placeholder = "Nome do usu\u00e1rio...";
          searchInput.value = usersSearchName || "";
        }
        if(goToSearchBtn){
          goToSearchBtn.classList.remove("isSearchView");
          goToSearchBtn.setAttribute("title", "Ir para o buscador");
          goToSearchBtn.setAttribute("aria-label", "Ir para o buscador");
        }
        if(goToTasksBtn){
          goToTasksBtn.classList.remove("isTasksView");
          goToTasksBtn.setAttribute("title", "Tarefas");
          goToTasksBtn.setAttribute("aria-label", "Tarefas");
        }
        if(goToTasksExtraBtn){
          goToTasksExtraBtn.classList.remove("isTasksView");
          goToTasksExtraBtn.setAttribute("title", "Tarefas extras");
          goToTasksExtraBtn.setAttribute("aria-label", "Tarefas extras");
        }
        if(goToDoneTasksBtn){
          goToDoneTasksBtn.classList.remove("isDoneView");
          goToDoneTasksBtn.setAttribute("title", "Tarefas encerradas");
          goToDoneTasksBtn.setAttribute("aria-label", "Tarefas encerradas");
        }
        if(goToUsersBtn){
          goToUsersBtn.classList.remove("isUsersView");
          goToUsersBtn.setAttribute("title", "Usu\u00e1rios");
          goToUsersBtn.setAttribute("aria-label", "Usu\u00e1rios");
        }
        if(goToUsersBtn){
          goToUsersBtn.classList.add("isUsersView");
          goToUsersBtn.setAttribute("title", "Usu\u00e1rios");
          goToUsersBtn.setAttribute("aria-label", "Usu\u00e1rios");
        }
        updateUsersStoreFilterOptions();
        updateUsersStatusFilterOptions();
        updateUsersFilterButtonState();
        refreshUsersView();
        scrollToTop();
        updateFilterButtonsState();
        return;
      }

      if(currentView === "userActivity"){
        navToggleViewBtn.textContent = "Tarefas";
        navToggleViewBtn.classList.remove("primary");
        if(viewTitleText) viewTitleText.textContent = "Resumo de atividades";
        if(goToSearchBtn){
          goToSearchBtn.classList.remove("isSearchView");
          goToSearchBtn.setAttribute("title", "Ir para o buscador");
          goToSearchBtn.setAttribute("aria-label", "Ir para o buscador");
        }
        if(goToTasksBtn){
          goToTasksBtn.classList.remove("isTasksView");
          goToTasksBtn.setAttribute("title", "Tarefas");
          goToTasksBtn.setAttribute("aria-label", "Tarefas");
        }
        if(goToTasksExtraBtn){
          goToTasksExtraBtn.classList.remove("isTasksView");
          goToTasksExtraBtn.setAttribute("title", "Tarefas extras");
          goToTasksExtraBtn.setAttribute("aria-label", "Tarefas extras");
        }
        if(goToDoneTasksBtn){
          goToDoneTasksBtn.classList.remove("isDoneView");
          goToDoneTasksBtn.setAttribute("title", "Tarefas encerradas");
          goToDoneTasksBtn.setAttribute("aria-label", "Tarefas encerradas");
        }
        if(goToUsersBtn){
          goToUsersBtn.classList.add("isUsersView");
          goToUsersBtn.setAttribute("title", "Usu\u00e1rios");
          goToUsersBtn.setAttribute("aria-label", "Usu\u00e1rios");
        }
        scrollToTop();
        updateFilterButtonsState();
        return;
      }

      if(searchInput) searchInput.placeholder = "Digite uma palavra-chave (ex: troca, prazo, rastreio, pix, tamanho...)";
      if(searchInput) searchInput.value = searchQueryCache || "";

      navToggleViewBtn.textContent = "Tarefas";
      navToggleViewBtn.classList.remove("primary");
      if(viewTitleText) viewTitleText.textContent = "Buscador de Solu\u00e7\u00f5es";
      if(goToSearchBtn){
        goToSearchBtn.classList.add("isSearchView");
        goToSearchBtn.setAttribute("title", "Ir para o buscador");
        goToSearchBtn.setAttribute("aria-label", "Ir para o buscador");
      }
      if(goToTasksBtn){
        goToTasksBtn.classList.remove("isTasksView");
        goToTasksBtn.setAttribute("title", "Tarefas");
        goToTasksBtn.setAttribute("aria-label", "Tarefas");
      }
      if(goToTasksExtraBtn){
        goToTasksExtraBtn.classList.remove("isTasksView");
        goToTasksExtraBtn.setAttribute("title", "Tarefas extras");
        goToTasksExtraBtn.setAttribute("aria-label", "Tarefas extras");
      }
      if(goToDoneTasksBtn){
        goToDoneTasksBtn.classList.remove("isDoneView");
        goToDoneTasksBtn.setAttribute("title", "Tarefas encerradas");
        goToDoneTasksBtn.setAttribute("aria-label", "Tarefas encerradas");
      }
      if(goToUsersBtn){
        goToUsersBtn.classList.remove("isUsersView");
        goToUsersBtn.setAttribute("title", "Usu\u00e1rios");
        goToUsersBtn.setAttribute("aria-label", "Usu\u00e1rios");
      }

      render();
      scrollToTop();
      updateFilterButtonsState();
    }

    /***********************
     * THEME
     ***********************/
    function applyTheme(mode){
      if(mode === "light"){
        document.body.classList.add("light");
        const iconMarkup = `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4"></circle>
            <line x1="12" y1="2" x2="12" y2="5"></line>
            <line x1="12" y1="19" x2="12" y2="22"></line>
            <line x1="2" y1="12" x2="5" y2="12"></line>
            <line x1="19" y1="12" x2="22" y2="12"></line>
            <line x1="4.5" y1="4.5" x2="6.8" y2="6.8"></line>
            <line x1="17.2" y1="17.2" x2="19.5" y2="19.5"></line>
            <line x1="17.2" y1="6.8" x2="19.5" y2="4.5"></line>
            <line x1="4.5" y1="19.5" x2="6.8" y2="17.2"></line>
          </svg>
        `;
        if(themeIcon) themeIcon.innerHTML = iconMarkup;
        if(themeIconMobile) themeIconMobile.innerHTML = iconMarkup;
      }else{
        document.body.classList.remove("light");
        const iconMarkup = `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5z"></path>
          </svg>
        `;
        if(themeIcon) themeIcon.innerHTML = iconMarkup;
        if(themeIconMobile) themeIconMobile.innerHTML = iconMarkup;
      }
      storageSet(STORAGE_KEY_THEME, mode);
    }
    function initTheme(){
      const saved = storageGet(STORAGE_KEY_THEME);
      if(saved === "light" || saved === "dark"){
        applyTheme(saved);
      }else{
        applyTheme("dark");
      }
    }
    function toggleTheme(){
      const isLight = document.body.classList.contains("light");
      applyTheme(isLight ? "dark" : "light");
    }

    function setSideMenuCollapsed(collapsed){
      if(!sideMenu) return;
      document.body.classList.toggle("sideMenuCollapsed", collapsed);
      sideMenu.classList.toggle("isCollapsed", collapsed);
      if(sideMenuToggle){
        const label = collapsed ? "Expandir menu" : "Recolher menu";
        sideMenuToggle.setAttribute("title", label);
        sideMenuToggle.setAttribute("aria-label", label);
      }
      updateTaskCountBadges();
      storageSet(STORAGE_KEY_SIDE_MENU, collapsed ? "1" : "0");
    }

    function initSideMenu(){
      const saved = storageGet(STORAGE_KEY_SIDE_MENU);
      const collapsed = saved === "1";
      setSideMenuCollapsed(collapsed);
    }

    

function fillPhaseStatusSelect(){
  if(!phaseEditStatus) return;

  // preserva sele\u00e7\u00e3o atual (evita perder o status ao abrir/editar)
  const prev = (phaseEditStatus.value || "").toString();

  // preenche apenas uma vez, mas sempre restaura o valor
  const alreadyFilled = (phaseEditStatus.dataset.filled === "1");

  if(!alreadyFilled){
    phaseEditStatus.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Selecione o status";
    phaseEditStatus.appendChild(opt0);

    PHASE_STATUS_OPTIONS.forEach(g=>{
      const og = document.createElement("optgroup");
      og.label = g.group;
      (g.options || []).forEach(txt=>{
        const o = document.createElement("option");
        o.value = txt;
        o.textContent = txt;
        og.appendChild(o);
      });
      phaseEditStatus.appendChild(og);
    });

    phaseEditStatus.dataset.filled = "1";
  }

  if(prev){
    phaseEditStatus.value = prev;
  }
}

function fillAssuntoSelect(){
  if(!tAssunto) return;

  const prev = (tAssunto.value || "").toString();
  const alreadyFilled = (tAssunto.dataset.filled === "1");

  if(!alreadyFilled){
    tAssunto.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Selecione o assunto";
    tAssunto.appendChild(opt0);

    PHASE_STATUS_OPTIONS.forEach(g=>{
      const og = document.createElement("optgroup");
      og.label = g.group;
      (g.options || []).forEach(txt=>{
        const o = document.createElement("option");
        o.value = txt;
        o.textContent = txt;
        og.appendChild(o);
      });
      tAssunto.appendChild(og);
    });

    tAssunto.dataset.filled = "1";
  }

  if(prev){
    tAssunto.value = prev;
  }
}
/***********************
     * STORAGE
     ***********************/
    function loadBase(){
      const raw = storageGet(STORAGE_KEY_BASE);
      if(!raw) return [];
      const parsed = safeJsonParse(raw);
      if(!Array.isArray(parsed)) return [];
      return parsed.map(it => ({
        store: ((it.store || "").toString().trim() || "Di\u00e1rio Nerdify"),
        q: (it.q || "").toString(),
        r: (it.r || "").toString(),
        links: (it.links || "").toString(),
        tags: Array.isArray(it.tags) ? it.tags.map(t => (t||"").toString()) : [],
        qImages: Array.isArray(it.qImages) ? it.qImages.map(x => (x||"").toString()) : [],
        qLinks: Array.isArray(it.qLinks) ? it.qLinks.map(l => ({ name:(l?.name||"").toString(), url:(l?.url||"").toString() })) : [],
        steps: Array.isArray(it.steps) ? it.steps.map(s => ({
          name: (s.name || "").toString(),
          text: (s.text || "").toString(),
          stepLinks: Array.isArray(s.stepLinks) ? s.stepLinks.map(l => ({ name:(l?.name||"").toString(), url:(l?.url||"").toString() })) : [],
          imageFilename: (s.imageFilename || "").toString(),
          link: (s.link || "").toString(),
          linkName: (s.linkName || "").toString(),
        })) : [],
        created_by_user_id: (it.created_by_user_id || it.createdByUserId || it.created_by || it.createdBy || "").toString(),
        created_by_username: (it.created_by_username || it.createdByUsername || it.created_by_name || it.createdByName || "").toString(),
      }));
    }
    function saveBase(next){ storageSet(STORAGE_KEY_BASE, JSON.stringify(next || [])); }

    function normalizeMenuButtons(arr){
      return (arr||[]).map(b => ({
        name: (b?.name || "").toString(),
        iconUrl: (b?.iconUrl || "").toString(),
        links: Array.isArray(b?.links)
          ? b.links.map(l => ({ name:(l?.name||"").toString(), url:(l?.url||"").toString() })).filter(x=>x.name||x.url)
          : (b?.url ? [{ name:(b?.name||"").toString(), url:(b?.url||"").toString() }] : []),
      })).filter(b => b.name);
    }

    function loadMenuButtons(){
      const raw = storageGet(STORAGE_KEY_MENU);
      const parsed = safeJsonParse(raw);
      if(Array.isArray(parsed)) return normalizeMenuButtons(parsed);

      const defaults = [
        {
          name:"Nuvemshop",
          iconUrl:"https://files.inhire.app/pages/career/vagasbyintera_nuvemshop-tiendanube-og.png",
          links:[
            { name:"Di\u00e1rio Nerdify", url:"https://diarionerdify.lojavirtualnuvem.com.br/admin/v2/dashboard" },
            { name:"Shop 80", url:"https://shop802.lojavirtualnuvem.com.br/admin/v2/dashboard" },
          ]
        },
        {
          name:"Contatar a gerente Carla Gomes",
          iconUrl:"https://nocodestartup.io/wp-content/uploads/2024/08/SaaS-IA-com-WhatsApp-01.png",
          links:[ { name:"Abrir WhatsApp", url:"https://api.whatsapp.com/send/?phone=5522992248997&text&type=phone_number&app_absent=0" } ]
        },
        {
          name:"E-mail",
          iconUrl:"https://upload.wikimedia.org/wikipedia/commons/4/4e/Mail_%28iOS%29.svg",
          links:[ { name:"Abrir Zoho Mail", url:"https://mail.zoho.com/zm/#mail/folder/inbox" } ]
        },
        {
          name:"Planilha de Tarefas Di\u00e1rias",
          iconUrl:"https://upload.wikimedia.org/wikipedia/commons/3/30/Google_Sheets_logo_%282014-2020%29.svg",
          links:[
            { name:"Di\u00e1rio Nerdify", url:"#"},
            { name:"Shop 80", url:"https://docs.google.com/spreadsheets/d/1hMmHzQlg4LtKWYEOc_VTvaWFRnOSHb9lvbsXEULC3qs/edit?gid=0#gid=0" }
          ]
        }
      ];
      storageSet(STORAGE_KEY_MENU, JSON.stringify(defaults));
      return defaults;
    }

    function saveMenuButtons(next){
      menuButtons = normalizeMenuButtons(next);
      storageSet(STORAGE_KEY_MENU, JSON.stringify(menuButtons));
      renderDrawer();
    }

    // tasks storage
    function normalizePhaseStates(phases){
      const list = Array.isArray(phases) ? phases : [];
      if(!list.length) return list;
      const hasAnyState = list.some(p => (p.state || "").trim());
      return list.map((p, idx) => {
        const isLast = idx === list.length - 1;
        if(hasAnyState){
          return {
            ...p,
            state: (p.state || "").trim() || (isLast ? PHASE_STATE_ACTIVE : PHASE_STATE_DONE)
          };
        }
        return {
          ...p,
          state: isLast ? PHASE_STATE_ACTIVE : PHASE_STATE_DONE
        };
      });
    }

    function normalizeTasks(arr){
      return (arr||[]).map(t => {
        // compat: vers\u00f3es antigas salvavam obs como array de strings
        const rawObs = t?.obs;
        let obsArr = [];

        if(Array.isArray(rawObs)){
          if(rawObs.length && typeof rawObs[0] === "object" && rawObs[0] !== null){
            obsArr = rawObs.map(o => ({
              text: (o?.text ?? o?.descricao ?? o?.obs ?? "").toString(),
              date: (o?.date ?? o?.data ?? "").toString(),
              prazo: (o?.prazo ?? o?.prazoResolucao ?? "").toString(),
              prazoHora: (o?.prazoHora ?? o?.hora ?? "").toString(),
              chamado: (o?.chamado ?? o?.numeroChamado ?? "").toString(),
              etiqueta: (o?.etiqueta ?? o?.etiquetaReversa ?? "").toString(),
              novoPedido: (o?.novoPedido ?? "").toString(),
              rastreio: (o?.rastreio ?? "").toString(),
              status: (o?.status ?? "").toString(),
              attention: Boolean(o?.attention),
              attentionNote: (o?.attentionNote ?? "").toString(),
              state: (o?.state ?? "").toString(),
            }));
          }else{
            obsArr = rawObs.map(v => ({
              text: String(v || ""),
              date: "",
              prazo: "",
              prazoHora: "",
              chamado: "",
              etiqueta: "",
              novoPedido: "",
              rastreio: "",
              status: "",
              attention: false,
              attentionNote: "",
              state: "",
            }));
          }
        }else if(typeof rawObs === "string" && rawObs.trim().length){
          obsArr = [{ text: rawObs.toString(), date: "", prazo: "", prazoHora: "", chamado: "", etiqueta: "", novoPedido: "", rastreio: "", status: "", attention: false, attentionNote: "", state: "" }];
        }

        // limpa objetos vazios
        obsArr = obsArr
          .map(o => ({
            text: (o.text||"").toString(),
            date: (o.date||"").toString(),
            prazo: (o.prazo||o.prazoResolucao||"").toString(),
            prazoHora: (o.prazoHora||o.hora||"").toString(),
            chamado: (o.chamado||o.numeroChamado||"").toString(),
            etiqueta: (o.etiqueta||o.etiquetaReversa||"").toString(),
            novoPedido: (o.novoPedido||"").toString(),
            rastreio: (o.rastreio||"").toString(),
            status: (o.status||"").toString(),
            attention: Boolean(o.attention),
            attentionNote: (o.attentionNote||"").toString(),
            state: (o.state||"").toString(),
          }))
          .filter(o =>
            (o.text||"").trim() ||
            (o.date||"").trim() ||
            (o.prazo||"").trim() ||
            (o.prazoHora||"").trim() ||
            (o.chamado||"").trim() ||
            (o.etiqueta||"").trim() ||
            (o.novoPedido||"").trim() ||
            (o.rastreio||"").trim() ||
            (o.status||"").trim() ||
            (o.attentionNote||"").trim() ||
            o.attention ||
            (o.state||"").trim()
          );
        obsArr = normalizePhaseStates(obsArr);

        return ({
        id: (t?.id || uid()).toString(),
        data: (t?.data || "").toString(),
        cliente: (t?.cliente || "").toString(),
        whatsapp: (t?.whatsapp || "").toString(),
        loja: (t?.loja || "Di\u00e1rio Nerdify").toString(),
        pedido: (t?.pedido || "").toString(),
        rastreio: (t?.rastreio || "").toString(),
        assunto: (t?.assunto || "").toString(),
        fonte: (t?.fonte || "").toString(),
        status: (t?.status || "").toString(),
        proxEtapa: (t?.proxEtapa || "").toString(),
        obs: obsArr,
        startTime: (t?.startTime || "").toString(),
        endTime: (t?.endTime || "").toString(),
        repeat: (t?.repeat || "").toString(),
        repeatWeekday: Number.isFinite(t?.repeatWeekday)
          ? t.repeatWeekday
          : (Number.isFinite(Number.parseInt((t?.repeatWeekday || "").toString(), 10))
            ? Number.parseInt((t?.repeatWeekday || "").toString(), 10)
            : null),
        repeatOrdinal: (t?.repeatOrdinal === "last")
          ? "last"
          : (Number.isFinite(t?.repeatOrdinal)
            ? t.repeatOrdinal
            : (Number.isFinite(Number.parseInt((t?.repeatOrdinal || "").toString(), 10))
              ? Number.parseInt((t?.repeatOrdinal || "").toString(), 10)
              : null)),
        repeatEvery: Number.isFinite(t?.repeatEvery)
          ? t.repeatEvery
          : (Number.isFinite(Number.parseInt((t?.repeatEvery || "").toString(), 10))
            ? Number.parseInt((t?.repeatEvery || "").toString(), 10)
            : null),
        repeatUnit: (t?.repeatUnit || "").toString(),
        repeatWeekdays: Array.isArray(t?.repeatWeekdays)
          ? t.repeatWeekdays.map(v => Number.parseInt(v, 10)).filter(v => Number.isFinite(v))
          : [],
        repeatMonthlyMode: (t?.repeatMonthlyMode || "").toString(),
        repeatUntil: (t?.repeatUntil || t?.repeatEnd || "").toString(),
        repeatCount: Number.isFinite(t?.repeatCount)
          ? t.repeatCount
          : (Number.isFinite(Number.parseInt((t?.repeatCount || "").toString(), 10))
            ? Number.parseInt((t?.repeatCount || "").toString(), 10)
            : null),
        repeatExclusions: Array.isArray(t?.repeatExclusions)
          ? t.repeatExclusions.map(v => (v || "").toString().trim()).filter(Boolean)
          : [],
        extraText: (t?.extraText || t?.text || "").toString(),
        isExtra: Boolean(t?.isExtra),
        created_by_user_id: (t?.created_by_user_id || t?.createdByUserId || t?.created_by || t?.createdBy || "").toString(),
        created_by_username: (t?.created_by_username || t?.createdByUsername || t?.created_by_name || t?.createdByName || "").toString(),
        createdAt: (t?.createdAt || "").toString(),
        updatedAt: (t?.updatedAt || "").toString(),
        closedAt: (t?.closedAt || "").toString(),
        closed_by_user_id: (t?.closed_by_user_id || t?.closedByUserId || "").toString(),
        closed_by_username: (t?.closed_by_username || t?.closedByUsername || "").toString(),
        });
      });
    }

    function hydrateTaskOwnership(list){
      const ownerId = getAccountOwnerId();
      const ownerIdStr = ownerId ? String(ownerId) : "";
      return (list || []).map(t => {
        const createdId = (t.created_by_user_id || "").toString();
        const createdName = (t.created_by_username || "").toString();
        const nextId = createdId || ownerIdStr;
        let nextName = createdName;
        if(!nextName && currentUser && String(currentUser.id || "") === nextId){
          nextName = (currentUser.username || "").toString();
        }
        return {
          ...t,
          created_by_user_id: nextId,
          created_by_username: nextName
        };
      });
    }

    function loadTasks(){
      const raw = storageGet(STORAGE_KEY_TASKS);
      const parsed = safeJsonParse(raw);
      if(Array.isArray(parsed)) return hydrateTaskOwnership(normalizeTasks(parsed));
      return [];
    }

    function saveTasks(next){
      tasks = normalizeTasks(next);
      storageSet(STORAGE_KEY_TASKS, JSON.stringify(tasks));
      updateTaskCountBadges();
      renderTasks();
      renderMiniCalendar();

      // mant\u00e9m o calend\u00e1rio consistente (verde = aberto, vermelho = removido)
      syncCalendarOpenFlags();
      if(calendarOverlay && calendarOverlay.classList.contains("show")){
        renderCalendar();
      }
    }

    // calend\u00e1rio storage (hist\u00f3rico)
    function normalizeCalendarHistory(arr){
      const out = [];
      for(const e of (arr||[])){
        if(!e) continue;
        const id = (e.id || "").toString();
        const date = (e.date || "").toString();
        const assunto = (e.assunto || "").toString();
        if(!id) continue;
        out.push({
          id,
          date,
          assunto,
          loja: (e.loja || "").toString(),
          pedido: (e.pedido || "").toString(),
          rastreio: (e.rastreio || "").toString(),
          cliente: (e.cliente || "").toString(),
          lastPhaseText: (e.lastPhaseText || "").toString(),
          prazoHora: (e.prazoHora || "").toString(),
          startTime: (e.startTime || "").toString(),
          endTime: (e.endTime || "").toString(),
          repeat: (e.repeat || "").toString(),
          repeatWeekday: Number.isFinite(e?.repeatWeekday)
            ? e.repeatWeekday
            : (Number.isFinite(Number.parseInt((e?.repeatWeekday || "").toString(), 10))
              ? Number.parseInt((e?.repeatWeekday || "").toString(), 10)
              : null),
          repeatOrdinal: (e?.repeatOrdinal === "last")
            ? "last"
            : (Number.isFinite(e?.repeatOrdinal)
              ? e.repeatOrdinal
              : (Number.isFinite(Number.parseInt((e?.repeatOrdinal || "").toString(), 10))
                ? Number.parseInt((e?.repeatOrdinal || "").toString(), 10)
                : null)),
          repeatEvery: Number.isFinite(e?.repeatEvery)
            ? e.repeatEvery
            : (Number.isFinite(Number.parseInt((e?.repeatEvery || "").toString(), 10))
              ? Number.parseInt((e?.repeatEvery || "").toString(), 10)
              : null),
          repeatUnit: (e?.repeatUnit || "").toString(),
          repeatWeekdays: Array.isArray(e?.repeatWeekdays)
            ? e.repeatWeekdays.map(v => Number.parseInt(v, 10)).filter(v => Number.isFinite(v))
            : [],
          repeatMonthlyMode: (e?.repeatMonthlyMode || "").toString(),
          repeatUntil: (e?.repeatUntil || e?.repeatEnd || "").toString(),
          repeatCount: Number.isFinite(e?.repeatCount)
            ? e.repeatCount
            : (Number.isFinite(Number.parseInt((e?.repeatCount || "").toString(), 10))
              ? Number.parseInt((e?.repeatCount || "").toString(), 10)
              : null),
          repeatExclusions: Array.isArray(e?.repeatExclusions)
            ? e.repeatExclusions.map(v => (v || "").toString().trim()).filter(Boolean)
            : [],
          extraText: (e.extraText || e.text || "").toString(),
          created_by_user_id: (e?.created_by_user_id || e?.createdByUserId || e?.created_by || e?.createdBy || "").toString(),
          created_by_username: (e?.created_by_username || e?.createdByUsername || e?.created_by_name || e?.createdByName || "").toString(),
          whatsapp: (e.whatsapp || "").toString(),
          phaseIdx: Number.isFinite(e.phaseIdx) ? e.phaseIdx : Number.parseInt((e.phaseIdx || "0").toString(), 10) || 0,
          extra: Boolean(e.extra || e.simple),
          open: Boolean(e.open),
          createdAt: (e.createdAt || "").toString(),
          updatedAt: (e.updatedAt || "").toString(),
        });
      }
      // dedupe por id (mant\u00e9m o mais recente)
      const map = new Map();
      for(const e of out){
        const prev = map.get(e.id);
        if(!prev){ map.set(e.id, e); continue; }
        const a = Date.parse(prev.updatedAt || prev.createdAt || "") || 0;
        const b = Date.parse(e.updatedAt || e.createdAt || "") || 0;
        if(b >= a) map.set(e.id, e);
      }
      return [...map.values()];
    }

    function hydrateCalendarOwnership(list){
      const ownerId = getAccountOwnerId();
      const ownerIdStr = ownerId ? String(ownerId) : "";
      return (list || []).map(e => {
        const createdId = (e.created_by_user_id || "").toString();
        const createdName = (e.created_by_username || "").toString();
        const nextId = createdId || ownerIdStr;
        let nextName = createdName;
        if(!nextName && currentUser && String(currentUser.id || "") === nextId){
          nextName = (currentUser.username || "").toString();
        }
        return {
          ...e,
          created_by_user_id: nextId,
          created_by_username: nextName
        };
      });
    }

    function loadCalendarHistory(){
      const raw = storageGet(STORAGE_KEY_CALENDAR);
      const parsed = safeJsonParse(raw);
      if(Array.isArray(parsed)) return hydrateCalendarOwnership(normalizeCalendarHistory(parsed));
      return [];
    }

    function saveCalendarHistory(next){
      calendarHistory = hydrateCalendarOwnership(normalizeCalendarHistory(next));
      storageSet(STORAGE_KEY_CALENDAR, JSON.stringify(calendarHistory));
      renderMiniCalendar();
    }

    /***********************
     * BACKUP (export/import)
     ***********************/
    function makeBackupFileName(){
      const d = new Date();
      const y = d.getFullYear();
      const m = pad2(d.getMonth()+1);
      const day = pad2(d.getDate());
      const hh = pad2(d.getHours());
      const mm = pad2(d.getMinutes());
      const ss = pad2(d.getSeconds());
      return `${FILE_NAME_PREFIX}_${y}-${m}-${day}_${hh}-${mm}-${ss}.txt`;
    }

    function exportFile(){
      const themePref = storageGet(STORAGE_KEY_THEME) || "";
      const data = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        items,
        menuButtons,
        stores,
        tasks,
        tasksDone,
        calendarHistory,
        quickLinks,
        nuvemLinks,
        searchTags,
        sizeTablesCustom,
        sizeTablesOverrides,
        productsCustom,
        themePref
      };
      const text = JSON.stringify(data, null, 2);
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = makeBackupFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function exportDoneTasks(){
      const data = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        tasksDone
      };
      const text = JSON.stringify(data, null, 2);
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `tarefas-concluidas_${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    // >>> tentativa de backup autom\u00e1tico ao fechar aba (melhor esfor\u00e7o; pode ser bloqueado pelo navegador)
    function autoExportOnClose(){
      try{
        // evita spam se o browser disparar mais de uma vez
        const key = "auto_backup_last_ts_v1";
        const now = Date.now();
        const last = Number(localStorage.getItem(key) || "0");
        if(now - last < 15000) return; // 15s
        localStorage.setItem(key, String(now));

        exportFile();
      }catch(e){}
    }

    function showImportChoiceModal(){
      return new Promise((resolve) => {
        function cleanup(){
          importChoiceOverlay.classList.remove("show");
          importOption1Btn.onclick = null;
          importOption2Btn.onclick = null;
          importCancelBtn.onclick = null;
          importChoiceCloseX.onclick = null;
          importChoiceOverlay.onclick = null;
          document.removeEventListener("keydown", onEsc);
        }
        function onEsc(e){
          if(e.key === "Escape"){
            cleanup();
            resolve("cancel");
          }
        }

        importChoiceOverlay.classList.add("show");

        importOption1Btn.onclick = () => { cleanup(); resolve("merge"); };
        importOption2Btn.onclick = () => { cleanup(); resolve("replace"); };
        importCancelBtn.onclick  = () => { cleanup(); resolve("cancel"); };
        importChoiceCloseX.onclick = () => { cleanup(); resolve("cancel"); };
        importChoiceOverlay.onclick = (e)=>{ if(e.target === importChoiceOverlay){ cleanup(); resolve("cancel"); } };

        document.addEventListener("keydown", onEsc);
      });
    }

    async function importFile(file){
      const reader = new FileReader();

      reader.onload = async () => {
        const parsed = safeJsonParse(reader.result);
        if(!parsed || !Array.isArray(parsed.items)){
          showAlert("Arquivo inv\u00e1lido. Gere o backup pelo bot\u00e3o do sistema e tente importar novamente.");
          return;
        }

        const importedItems = parsed.items.map(it => {
          const qImgs =
            Array.isArray(it.qImages) ? it.qImages.map(x => (x||"").toString()) :
            (it.qImageFilename ? [(it.qImageFilename||"").toString()] : []);

          const importedQLinks =
            Array.isArray(it.qLinks) ? it.qLinks.map(l => ({ name:(l?.name||"").toString(), url:(l?.url||"").toString() })) :
            [];

          return ({
            store: ((it.store || it.loja || "").toString().trim() || "Di\u00e1rio Nerdify"),
            q: (it.q || "").toString(),
            r: (it.r || "").toString(),
            links: (it.links || "").toString(),
            tags: Array.isArray(it.tags) ? it.tags.map(t => (t||"").toString()) : [],
            qImages: uniq(qImgs),
            qLinks: importedQLinks.filter(x=>x.name||x.url),
            steps: Array.isArray(it.steps) ? it.steps.map(s => ({
              name: (s.name || "").toString(),
              text: (s.text || "").toString(),
              imageFilename: (s.imageFilename || "").toString(),
              stepLinks: Array.isArray(s.stepLinks)
                ? s.stepLinks.map(l => ({ name:(l?.name||"").toString(), url:(l?.url||"").toString() }))
                : (s.link ? [{ name:(s.linkName||"Link").toString(), url:(s.link||"").toString() }] : []),
              link: "",
              linkName: ""
            })) : [],
          });
        });

        // tasks (se existir)
        const importedTasks = Array.isArray(parsed.tasks) ? normalizeTasks(parsed.tasks) : null;
        const importedDone = Array.isArray(parsed.tasksDone) ? normalizeTasks(parsed.tasksDone) : null;

        // calend\u00e1rio (se existir)
        const importedCalendar = Array.isArray(parsed.calendarHistory)
          ? normalizeCalendarHistory(parsed.calendarHistory)
          : null;

        if(Array.isArray(parsed.menuButtons)){
          const choice = await showImportChoiceModal();
          if(choice === "cancel"){
            showAlert("Importa\u00e7\u00e3o cancelada.");
            return;
          }

          items = importedItems;
          saveBase(items);

          if(choice === "replace"){
            saveMenuButtons(parsed.menuButtons);
          }else{
            const current = menuButtons.slice();
            const incoming = normalizeMenuButtons(parsed.menuButtons);

            for(const b of incoming){
              const idx = current.findIndex(x =>
                (x.name||"").toLowerCase() === (b.name||"").toLowerCase()
                && (x.iconUrl||"") === (b.iconUrl||"")
              );
              if(idx === -1){
                current.push(b);
              }else{
                const existingLinks = current[idx].links || [];
                const urls = new Set(existingLinks.map(l => (l.url||"").toLowerCase()));
                const add = (b.links||[]).filter(l => l.url && !urls.has(l.url.toLowerCase()));
                current[idx].links = existingLinks.concat(add);
              }
            }
            saveMenuButtons(current);
          }
        }else{
          items = importedItems;
          saveBase(items);
        }

        if(Array.isArray(parsed.stores)){
          saveStores(parsed.stores);
        }

        if(parsed.quickLinks && typeof parsed.quickLinks === "object"){
          saveQuickLinks(parsed.quickLinks);
        }

        if(parsed.nuvemLinks && typeof parsed.nuvemLinks === "object"){
          saveNuvemLinks(parsed.nuvemLinks);
        }

        if(Array.isArray(parsed.searchTags)){
          saveSearchTags(parsed.searchTags);
        }

        if(Array.isArray(parsed.sizeTablesCustom)){
          saveSizeTablesCustom(parsed.sizeTablesCustom);
        }

        if(Array.isArray(parsed.sizeTablesOverrides)){
          saveSizeTablesOverrides(parsed.sizeTablesOverrides);
        }

        if(Array.isArray(parsed.productsCustom)){
          saveProducts(parsed.productsCustom);
        }

        // aplica tasks importadas (se vier)
        if(importedTasks){
          saveTasks(importedTasks);
        }

        if(importedDone){
          saveTasksDone(importedDone);
        }

        // aplica calend\u00e1rio importado (se vier)
        if(importedCalendar){
          saveCalendarHistory(importedCalendar);
        }

        if(parsed.themePref === "light" || parsed.themePref === "dark"){
          applyTheme(parsed.themePref);
        }

        // sincroniza flags open/closed e datas do calend\u00e1rio com a lista atual
        syncCalendarOpenFlags();

        render();
        clearForm();
        showAlert("Importa\u00e7\u00e3o conclu\u00edda!");
      };

      reader.readAsText(file);
    }

    /***********************
     * DRAWER (menu) - SEM SENHA
     ***********************/
    function openDrawer(){ drawer.classList.add("show"); drawerBackdrop.classList.add("show"); }
    function closeDrawer(){ drawer.classList.remove("show"); drawerBackdrop.classList.remove("show"); }
    function openRightDrawer(){
      if(!rightDrawer || !rightDrawerBackdrop) return;
      rightDrawer.classList.add("show");
      rightDrawerBackdrop.classList.add("show");
      if(pendingRightDrawerReturn && isMobileViewport()){
        rightDrawer.dataset.returnDrawer = "1";
        if(closeRightDrawerBtn){
          if(!closeRightDrawerBtn.dataset.originalLabel) closeRightDrawerBtn.dataset.originalLabel = closeRightDrawerBtn.textContent;
          closeRightDrawerBtn.textContent = "Voltar";
        }
        pendingRightDrawerReturn = false;
      }
    }
    function closeRightDrawer(){
      if(!rightDrawer || !rightDrawerBackdrop) return;
      rightDrawer.classList.remove("show");
      rightDrawerBackdrop.classList.remove("show");
      const shouldReturn = isMobileViewport() && rightDrawer.dataset.returnDrawer === "1";
      if(rightDrawer.dataset.returnDrawer === "1") rightDrawer.dataset.returnDrawer = "";
      if(closeRightDrawerBtn && closeRightDrawerBtn.dataset.originalLabel){
        closeRightDrawerBtn.textContent = closeRightDrawerBtn.dataset.originalLabel;
        delete closeRightDrawerBtn.dataset.originalLabel;
      }
      if(shouldReturn) openDrawer();
    }

    let pendingDrawerReturn = false;
    function isMobileViewport(){
      return window.matchMedia && window.matchMedia("(max-width: 720px)").matches;
    }
    function markOverlayForDrawerReturn(overlay, closeButtons){
      if(!overlay || !pendingDrawerReturn || !isMobileViewport()) return;
      overlay.dataset.returnDrawer = "1";
      pendingDrawerReturn = false;
      (closeButtons || []).forEach((btn)=>{
        if(!btn) return;
        if(!btn.dataset.originalLabel) btn.dataset.originalLabel = btn.textContent;
        btn.textContent = "Voltar";
      });
    }
    function restoreCloseButtons(closeButtons){
      (closeButtons || []).forEach((btn)=>{
        if(!btn) return;
        if(!btn.dataset.originalLabel) return;
        btn.textContent = btn.dataset.originalLabel;
        delete btn.dataset.originalLabel;
      });
    }
    function handleDrawerReturnAfterClose(overlay, closeButtons){
      if(!overlay) return;
      const shouldReturn = isMobileViewport() && overlay.dataset.returnDrawer === "1";
      if(overlay.dataset.returnDrawer === "1") overlay.dataset.returnDrawer = "";
      restoreCloseButtons(closeButtons);
      if(shouldReturn) openDrawer();
    }
    function clearDrawerReturnState(overlay, closeButtons){
      if(!overlay) return;
      if(overlay.dataset.returnDrawer === "1") overlay.dataset.returnDrawer = "";
      restoreCloseButtons(closeButtons);
    }

    function setSizeTableUploadError(message){
      if(!sizeTableUploadError) return;
      const text = (message || "").toString().trim();
      sizeTableUploadError.textContent = text;
      sizeTableUploadError.style.display = text ? "block" : "none";
    }

    function openSizeTableUpload(options){
      if(!sizeTableUploadOverlay) return;
      const mode = options && options.mode === "update" ? "update" : "add";
      const name = (options && options.name ? options.name : "").toString().trim();
      const isCustom = Boolean(options && options.isCustom);
      sizeTableUploadMode = mode;
      sizeTableUploadIsCustom = isCustom;
      sizeTableUploadTargetName = name;
      if(sizeTableUploadTitle){
        sizeTableUploadTitle.textContent = mode === "update" && name
          ? `Enviar imagem - ${name}`
          : "Enviar imagem";
      }
      if(sizeTableUploadName){
        sizeTableUploadName.value = name;
        sizeTableUploadName.readOnly = mode === "update";
      }
      if(sizeTableUploadFile) sizeTableUploadFile.value = "";
      if(sizeTableUploadHint){
        sizeTableUploadHint.textContent = mode === "update"
          ? "Selecione a imagem para atualizar esta tabela."
          : "Informe o nome e selecione a imagem da tabela.";
      }
      setSizeTableUploadError("");
      sizeTableUploadOverlay.classList.add("show");
    }

    function closeSizeTableUpload(){
      if(!sizeTableUploadOverlay) return;
      sizeTableUploadOverlay.classList.remove("show");
      setSizeTableUploadError("");
    }

    function buildSizeTablesGrid(){
      if(!sizeTablesGrid) return;
      const basePath = PRODUCT_TABLE_BASE;
      const overrides = new Map((sizeTablesOverrides || []).map(t => [t.name, t.dataUrl]));
      const defaults = SIZE_TABLES.map(t => ({
        name: t.name,
        src: overrides.get(t.name) || encodeURI(basePath + t.file),
        isCustom: false
      }));
      const custom = (sizeTablesCustom || []).map(t => ({
        name: t.name,
        src: t.dataUrl,
        isCustom: true
      }));
      const all = defaults.concat(custom);
      sizeTablesGrid.innerHTML = all.map(t => {
        return `
          <div class="sizeTableCard" data-table-name="${escapeHtml(t.name)}" data-table-custom="${t.isCustom ? "1" : "0"}">
            <div class="sizeTableTitle">${escapeHtml(t.name)}</div>
            <img class="sizeTableImg" src="${escapeHtml(t.src)}" alt="Tabela ${escapeHtml(t.name)}" loading="lazy">
            <div class="sizeTableActions">
              <button class="btn small" data-customize-table="1">Enviar imagem</button>
              <button class="btn small" data-copy-table="${escapeHtml(t.src)}">Copiar imagem</button>
            </div>
          </div>
        `;
      }).join("");

      sizeTablesGrid.querySelectorAll("[data-copy-table]").forEach(btn => {
        btn.addEventListener("click", async ()=>{
          const src = (btn.getAttribute("data-copy-table") || "").trim();
          if(!src) return;
          await copyImageToClipboard(src, btn, "Copiar imagem");
        });
      });

      sizeTablesGrid.querySelectorAll("[data-customize-table]").forEach(btn => {
        btn.addEventListener("click", ()=>{
          const card = btn.closest(".sizeTableCard");
          if(!card) return;
          const name = (card.getAttribute("data-table-name") || "").trim();
          const isCustom = card.getAttribute("data-table-custom") === "1";
          if(!name) return;
          openSizeTableUpload({ mode: "update", name, isCustom });
        });
      });
    }

    function openSizeTables(){
      if(!sizeTablesOverlay) return;
      closeRightDrawer();
      buildSizeTablesGrid();
      sizeTablesOverlay.classList.add("show");
    }
    function closeSizeTables(){
      if(!sizeTablesOverlay) return;
      sizeTablesOverlay.classList.remove("show");
    }
    function setProductManageError(message){
      if(!productManageError) return;
      const text = (message || "").toString().trim();
      productManageError.textContent = text;
      productManageError.style.display = text ? "block" : "none";
    }

    function setProductManageFieldError(el, message){
      if(!el) return;
      const text = (message || "").toString().trim();
      el.textContent = text;
      el.style.display = text ? "block" : "none";
    }

    function clearProductManageFieldErrors(){
      setProductManageFieldError(productManageStoreError, "");
      setProductManageFieldError(productManageNameError, "");
      setProductManageFieldError(productManagePriceError, "");
      setProductManageFieldError(productManageStampsError, "");
      setProductManageFieldError(productManageSpecsError, "");
      setProductManageFieldError(productManageColorsError, "");
      setProductManageFieldError(productManageTableError, "");
      setProductManageError("");
    }
    function getProductsStoreList(){
      const names = getStoreNames();
      const storeSet = new Set(names);
      for(const item of (productsCustom || [])){
        if(item.store) storeSet.add(item.store);
      }
      return Array.from(storeSet);
    }
    function updateProductManageStoreOptions(){
      if(!productManageStore) return;
      const storesList = getProductsStoreList();
      const options = storesList.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`);
      productManageStore.innerHTML = options.join("");
    }
    function openProductManage(options){
      if(!productManageOverlay) return;
      const mode = options && options.mode === "edit" ? "edit" : "add";
      const item = options && options.item ? options.item : null;
      productManageMode = mode;
      productManageId = item ? item.id : "";
      const resolved = item ? resolveProductDetails(item) : { specs: PRODUCT_SPECS_INFO.slice(), colors: [], stampsUrl: "", tableUrl: "" };
      if(productManageStore){
        updateProductManageStoreOptions();
        if(item && item.store) productManageStore.value = item.store;
        if(options && options.store) productManageStore.value = options.store;
      }
      if(productManageName) productManageName.value = item ? item.name : "";
      if(productManagePrice) productManagePrice.value = item ? item.price : "";
      if(productManageStampsUrl){
        productManageStampsUrl.value = resolved.stampsUrl || "";
      }
      setProductManageSpecs(resolved.specs);
      setProductManageColors(resolved.colors);
      productManageTableUrl = resolved.tableUrl || "";
      if(productManageTableFile) productManageTableFile.value = "";
      if(productManageTableClearBtn){
        productManageTableClearBtn.disabled = !productManageTableUrl;
      }
      clearProductManageFieldErrors();
      productManageOverlay.classList.add("show");
    }
    function closeProductManage(){
      if(!productManageOverlay) return;
      productManageOverlay.classList.remove("show");
      clearProductManageFieldErrors();
      productManageMode = "add";
      productManageId = "";
      productManageTableUrl = "";
      productManageSpecsItems = [];
      productManageSelectedColors = [];
    }

    function buildProductsGrid(){
      if(!productsGrid) return;
      const storesList = getProductsStoreList();
      const list = productsCustom || [];
      productsGrid.innerHTML = storesList.map(storeName => {
        const rows = list.filter(p => p.store === storeName);
        const rowsHtml = rows.map(p => {
          const key = (p.key || productKeyFromName(p.name)).toString().trim();
          return `
            <div class="productsRow" data-product-id="${escapeHtml(p.id)}">
              <div class="productsItem">
                <span class="productName">${escapeHtml(p.name)}</span>
              </div>
              <div class="productsValue">${escapeHtml(p.price || "-")}</div>
              <div class="productsActions">
                <button class="btn small iconBtn" data-product-view="${escapeHtml(p.id)}" data-product-key="${escapeHtml(key)}" data-product-name="${escapeHtml(p.name)}" data-product-price="${escapeHtml(p.price)}" data-product-store="${escapeHtml(storeName)}" title="Ver detalhes" aria-label="Ver detalhes">
                  <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
                <button class="btn small iconBtn" data-product-edit="${escapeHtml(p.id)}" title="Editar" aria-label="Editar">
                  <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5l4 4L7 21l-4 1 1-4 12.5-14.5z"></path>
                  </svg>
                </button>
                <button class="btn small danger iconBtn" data-product-delete="${escapeHtml(p.id)}" title="Excluir" aria-label="Excluir">
                  <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 6h18"></path>
                    <path d="M8 6V4h8v2"></path>
                    <rect x="6" y="6" width="12" height="14" rx="2"></rect>
                    <path d="M10 10v6"></path>
                    <path d="M14 10v6"></path>
                  </svg>
                </button>
              </div>
            </div>
          `;
        }).join("");
        const emptyHtml = rows.length
          ? ""
          : `<div class="note productsEmpty">Nenhum item cadastrado.</div>`;
        return `
          <div class="productsCard" data-products-store="${escapeHtml(storeName)}">
            <div class="productsCardTop">
              <div class="productsTitle">${escapeHtml(storeName)}</div>
              <button class="btn small iconBtn" data-product-add="${escapeHtml(storeName)}" title="Adicionar" aria-label="Adicionar">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14"></path>
                  <path d="M5 12h14"></path>
                </svg>
              </button>
            </div>
            ${rowsHtml || emptyHtml}
          </div>
        `;
      }).join("");
    }

    function openProducts(){
      if(!productsOverlay) return;
      closeRightDrawer();
      updateProductManageStoreOptions();
      buildProductsGrid();
      productsOverlay.classList.add("show");
    }
    function closeProducts(){
      if(!productsOverlay) return;
      productsOverlay.classList.remove("show");
    }

    function buildProductSpecsText(price, details){
      const specs = Array.isArray(details?.specs) ? details.specs : [];
      const infoLines = specs.map(t => `- ${t}`);
      const priceLine = price ? [`- Valor do produto: ${price}`] : [];
      return [
        "Informa\u00e7\u00f5es do Produto",
        ...priceLine,
        ...infoLines,
      ].join("\n");
    }

    function buildProductColorsText(colors){
      const list = Array.isArray(colors) ? colors : [];
      const names = list.map(c => c.name);
      if(!names.length) return "";
      if(names.length === 1) return names[0];
      return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
    }

    function getStampsButtonLabel(key, name){
      const labelName = (name || "").trim() || "produto";
      const map = {
        "camiseta": "das",
        "manga-longa": "da",
        "baby-look": "da",
        "regata": "das",
        "plus-size": "das",
        "bones": "dos",
      };
      const article = map[key] || "do";
      return `Estampas ${article} ${labelName}`;
    }

    function resolveProductDetails(item){
      const key = (item?.key || productKeyFromName(item?.name || "")).toString().trim();
      const store = (item?.store || "").toString().trim();
      const isCustom = Boolean(item?.detailsCustom);
      const fallback = getDefaultProductDetails(key, store) || { specs: [], colors: [], stampsUrl: "", tableUrl: "" };
      if(isCustom){
        return {
          specs: Array.isArray(item?.specs) ? item.specs : [],
          colors: Array.isArray(item?.colors) ? item.colors : [],
          stampsUrl: (item?.stampsUrl || "").toString().trim(),
          tableUrl: (item?.tableUrl || "").toString().trim()
        };
      }
      const specs = (item?.specs && item.specs.length) ? item.specs : fallback.specs;
      const colors = (item?.colors && item.colors.length) ? item.colors : fallback.colors;
      const stampsUrl = (item?.stampsUrl || "").toString().trim() || fallback.stampsUrl || "";
      const tableUrl = (item?.tableUrl || "").toString().trim() || fallback.tableUrl || "";
      return { specs, colors, stampsUrl, tableUrl };
    }

    function renderProductDetails(info){
      if(!productDetailsTitle || !productDetailsMeta) return;
      const key = (info?.key || "").trim();
      const details = resolveProductDetails(info);
      const baseDetails = PRODUCT_DETAILS[key];
      const name = (info?.name || baseDetails?.title || "Produto").trim();
      const price = (info?.price || "-").trim();
      const store = (info?.store || "").trim();
      const storeData = getStoreByName(store);
      const storeLabel = storeData ? storeData.name : store;
      currentProductPrice = price;
      currentProductDetails = details || null;

      productDetailsTitle.innerHTML = `Detalhes do produto: ${escapeHtml(name)}`;
      productDetailsMeta.innerHTML = `
        <div class="productMetaItem">
          <div class="label">Produto</div>
          <strong>${escapeHtml(name)}</strong>
        </div>
        <div class="productMetaItem">
          <div class="label">Valor</div>
          <strong>${escapeHtml(price)}</strong>
        </div>
      `;

      if(productDetailsStore){
        if(storeLabel){
          productDetailsStore.textContent = `Loja: ${storeLabel}`;
        }else{
          productDetailsStore.textContent = "";
        }
      }

      const hasDetails =
        (details?.specs && details.specs.length) ||
        (details?.colors && details.colors.length) ||
        (details?.stampsUrl || "") ||
        (details?.tableUrl || "");
      if(!hasDetails){
        if(productDetailsEmpty) productDetailsEmpty.style.display = "block";
        if(productDetailsContent) productDetailsContent.style.display = "none";
        if(productDetailsStampsBtn){
          productDetailsStampsBtn.style.display = "none";
          productDetailsStampsBtn.href = "#";
        }
        if(productDetailsVideoSection){
          productDetailsVideoSection.style.display = "none";
        }
        if(productVideoTitle) productVideoTitle.textContent = "V\u00eddeo do produto";
        if(productVideoWhatsapp) productVideoWhatsapp.value = "";
        currentProductVideoUrl = "";
        currentProductVideoText = "";
        currentProductTableUrl = "";
        return;
      }

      if(productDetailsEmpty) productDetailsEmpty.style.display = "none";
      if(productDetailsContent) productDetailsContent.style.display = "block";
      const storeNormalized = store.toLowerCase();
      const isShop80 = storeNormalized.includes("shop 80");
      const isDiario = storeNormalized.includes("di\u00e1rio nerdify") || storeNormalized.includes("diario nerdify");

      if(productDetailsStampsBtn){
        const label = getStampsButtonLabel(key, name);
        productDetailsStampsBtn.setAttribute("title", label);
        productDetailsStampsBtn.setAttribute("aria-label", label);
        if(details?.stampsUrl){
          productDetailsStampsBtn.style.display = "inline-flex";
          productDetailsStampsBtn.href = details.stampsUrl;
        }else{
          productDetailsStampsBtn.style.display = "none";
          productDetailsStampsBtn.href = "#";
        }
      }

      if(productDetailsSpecs){
        const specs = [
          `Valor do produto: ${price}`,
          ...(details?.specs || []),
        ];
        productDetailsSpecs.innerHTML = specs.map(item => `<li>${escapeHtml(item)}</li>`).join("");
      }
      if(productColorsList){
        const colors = details?.colors || [];
        productColorsList.innerHTML = colors.map(color => {
          return `
            <div class="productColorRow">
              <span class="productColorSwatch" style="background:${escapeHtml(color.hex)};"></span>
              <span class="productColorName">${escapeHtml(color.name)}</span>
              <span class="productColorHex">${escapeHtml(color.hex)}</span>
              <button class="btn small iconBtn" data-copy-hex="${escapeHtml(color.hex)}" title="Copiar hex" aria-label="Copiar hex">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          `;
        }).join("");

        productColorsList.querySelectorAll("[data-copy-hex]").forEach(btn => {
          btn.addEventListener("click", async ()=>{
            const hex = (btn.getAttribute("data-copy-hex") || "").trim();
            if(!hex) return;
            await copyTextToClipboard(hex, btn, "Copiado!");
          });
        });
      }

      if(productDetailsTableSection){
        const hideTable = !details?.tableUrl;
        productDetailsTableSection.style.display = hideTable ? "none" : "flex";
        if(hideTable && productDetailsTableImg){
          productDetailsTableImg.removeAttribute("src");
          productDetailsTableImg.alt = "";
        }
      }
      if(productDetailsTableImg && details?.tableUrl){
        productDetailsTableImg.src = details.tableUrl;
        productDetailsTableImg.alt = `Tabela ${name}`;
        currentProductTableUrl = details.tableUrl;
      }else{
        currentProductTableUrl = "";
      }

      if(productDetailsVideoSection){
        const isBones = key === "bones";
        const isBaby = key === "baby-look";
        const showVideo = (isBones && (isDiario || isShop80)) || Boolean(baseDetails?.hasVideo) || isBaby;
        productDetailsVideoSection.style.display = showVideo ? "flex" : "none";
        if(showVideo){
          if(isBones){
            currentProductVideoUrl = isShop80 ? BONES_VIDEO_URL_SHOP : BONES_VIDEO_URL_DN;
            currentProductVideoText = BONES_VIDEO_TEXT;
            if(productVideoTitle) productVideoTitle.textContent = "V\u00eddeo do bon\u00e9";
          }else{
            currentProductVideoUrl = BABY_VIDEO_URL;
            currentProductVideoText = BABY_VIDEO_TEXT;
            if(productVideoTitle) productVideoTitle.textContent = "V\u00eddeo da baby look";
          }
        }else{
          currentProductVideoUrl = "";
          currentProductVideoText = "";
          if(productVideoTitle) productVideoTitle.textContent = "V\u00eddeo do produto";
        }
        if(productVideoWhatsapp) productVideoWhatsapp.value = "";
      }
    }

    function openProductDetails(info){
      if(!productDetailsOverlay) return;
      renderProductDetails(info);
      productDetailsOverlay.classList.add("show");
    }
    function closeProductDetails(){
      if(!productDetailsOverlay) return;
      productDetailsOverlay.classList.remove("show");
    }

    function firstTwoLetters(name){
      const t = (name||"").trim().replace(/\s+/g," ");
      if(!t) return "BT";
      const parts = t.split(" ");
      if(parts.length === 1) return parts[0].slice(0,2).toUpperCase();
      return (parts[0][0] + (parts[1] ? parts[1][0] : parts[0][1]||"")).toUpperCase();
    }

    function renderDrawer(){
      const totalPages = Math.max(1, Math.ceil(menuButtons.length / DRAWER_PAGE_SIZE));
      if(drawerPage > totalPages) drawerPage = totalPages;

      const start = (drawerPage - 1) * DRAWER_PAGE_SIZE;
      const pageItems = menuButtons.slice(start, start + DRAWER_PAGE_SIZE);

      drawerButtonsHost.innerHTML = pageItems.map((b, idxOnPage) => {
        const globalIndex = start + idxOnPage;

        const icon = (b.iconUrl || "").trim();
        const iconHtml = icon
          ? `<img alt="" src="${escapeHtml(icon)}" onerror="this.parentElement.innerHTML='<div class=\\'txt\\'>${escapeHtml(firstTwoLetters(b.name))}</div>'">`
          : `<div class="txt">${escapeHtml(firstTwoLetters(b.name))}</div>`;

        const subBtns = (b.links||[]).map(l => {
          const url = (l.url||"").trim();
          const nm = (l.name||"").trim() || "Abrir";
          return `<button class="btn small" data-open="${escapeHtml(url)}">${escapeHtml(nm)}</button>`;
        }).join("");

        const canUp = globalIndex > 0;
        const canDown = globalIndex < (menuButtons.length - 1);
        const title = (b.name || "Sem nome").toString();
        const linksHtml = subBtns || `<div class="note">Sem links.</div>`;

        return `
          <div class="menuCard" data-menu-idx="${escapeHtml(String(globalIndex))}">
            <div class="menuTop">
              <div class="menuIcon">${iconHtml}</div>
              <p class="menuTitle">${escapeHtml(title)}</p>
            </div>
            <div class="menuBtnsRow">
              ${linksHtml}
            </div>
            <div class="menuToolsRow">
              <button class="btn small" data-move-up ${canUp ? "" : "disabled"}>Subir</button>
              <button class="btn small" data-move-down ${canDown ? "" : "disabled"}>Descer</button>
              <button class="btn small iconBtn" data-edit-menu title="Editar" aria-label="Editar">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5l4 4L7 21l-4 1 1-4 12.5-14.5z"></path>
                </svg>
              </button>
              <button class="btn small danger" data-del-menu>Remover</button>
            </div>
          </div>
        `;
      }).join("");

      drawerPager.style.display = (menuButtons.length > DRAWER_PAGE_SIZE) ? "flex" : "none";
      drawerPageInfo.textContent = `P\u00e1gina ${drawerPage}/${totalPages}`;

      drawerPrev.disabled = drawerPage <= 1;
      drawerNext.disabled = drawerPage >= totalPages;

      // open links
      drawerButtonsHost.querySelectorAll("[data-open]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const url = btn.getAttribute("data-open") || "";
          if(!url) return;
          if(url === "#"){ showAlert("Link ainda n\u00e3o definido."); return; }
          window.open(url, "_blank", "noopener");
        });
      });

      // move up/down (sem senha)
      drawerButtonsHost.querySelectorAll("[data-move-up]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const card = btn.closest("[data-menu-idx]");
          const idx = Number(card.getAttribute("data-menu-idx"));
          if(idx <= 0) return;
          const next = menuButtons.slice();
          const tmp = next[idx-1];
          next[idx-1] = next[idx];
          next[idx] = tmp;
          saveMenuButtons(next);
          drawerPage = Math.floor((idx-1)/DRAWER_PAGE_SIZE)+1;
          renderDrawer();
        });
      });
      drawerButtonsHost.querySelectorAll("[data-move-down]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const card = btn.closest("[data-menu-idx]");
          const idx = Number(card.getAttribute("data-menu-idx"));
          if(idx >= menuButtons.length - 1) return;
          const next = menuButtons.slice();
          const tmp = next[idx+1];
          next[idx+1] = next[idx];
          next[idx] = tmp;
          saveMenuButtons(next);
          drawerPage = Math.floor((idx+1)/DRAWER_PAGE_SIZE)+1;
          renderDrawer();
        });
      });

      // edit / delete (sem senha)
      drawerButtonsHost.querySelectorAll("[data-edit-menu]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const card = btn.closest("[data-menu-idx]");
          const idx = Number(card.getAttribute("data-menu-idx"));
          openMenuEdit(idx);
        });
      });
      drawerButtonsHost.querySelectorAll("[data-del-menu]").forEach(btn=>{
        btn.addEventListener("click", async ()=>{
          const card = btn.closest("[data-menu-idx]");
          const idx = Number(card.getAttribute("data-menu-idx"));
          await removeMenuButton(idx);
        });
      });
    }

    function handleMenuIconUpload(fileInput, targetInput){
      if(!fileInput || !targetInput) return;
      fileInput.addEventListener("change", ()=>{
        const file = fileInput.files && fileInput.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          targetInput.value = String(reader.result || "");
          fileInput.value = "";
        };
        reader.readAsDataURL(file);
      });
    }

    function addCustomMenuButton(){
      const name = (newMenuBtnName.value || "").trim();
      const iconUrl = (newMenuBtnIcon.value || "").trim();
      const link = (newMenuBtnLink.value || "").trim();

      if(!name){ showAlert("Informe o nome do bot\u00e3o."); return; }
      if(!link){ showAlert("Informe o link do bot\u00e3o."); return; }

      const next = menuButtons.slice();
      next.push({ name, iconUrl, links: [{ name:"Abrir", url: link }] });

      saveMenuButtons(next);

      const totalPages = Math.max(1, Math.ceil(next.length / DRAWER_PAGE_SIZE));
      drawerPage = totalPages;
      renderDrawer();

      newMenuBtnName.value = "";
      newMenuBtnIcon.value = "";
      if(newMenuBtnIconFile) newMenuBtnIconFile.value = "";
      newMenuBtnLink.value = "";
    }

    function openMenuEdit(globalIdx){
      const b = menuButtons[globalIdx];
      if(!b) return;

      editingMenuGlobalIndex = globalIdx;
      menuEditName.value = b.name || "";
      menuEditIcon.value = b.iconUrl || "";
      if(menuEditIconFile) menuEditIconFile.value = "";
      editingMenuLinks = Array.isArray(b.links) ? b.links.map(l => ({ name:(l.name||""), url:(l.url||"") })) : [];

      renderMenuEditLinks();
      menuEditOverlay.classList.add("show");
    }

    function closeMenuEdit(){
      menuEditOverlay.classList.remove("show");
      editingMenuGlobalIndex = -1;
      editingMenuLinks = [];
      menuEditLinksHost.innerHTML = "";
      menuEditName.value = "";
      menuEditIcon.value = "";
      if(menuEditIconFile) menuEditIconFile.value = "";
    }

    function renderMenuEditLinks(){
      menuEditLinksHost.innerHTML = editingMenuLinks.map((l, i) => `
        <div class="linkRow">
          <input type="text" placeholder="Nome do link" value="${escapeHtml(l.name||"")}" data-mln="${i}">
          <input type="text" placeholder="https://..." value="${escapeHtml(l.url||"")}" data-mlu="${i}">
          <button class="btn small danger" data-mlrm="${i}">Remover</button>
        </div>
      `).join("");

      menuEditLinksHost.querySelectorAll("[data-mln]").forEach(inp=>{
        inp.addEventListener("input", ()=>{
          const i = Number(inp.getAttribute("data-mln"));
          editingMenuLinks[i].name = inp.value;
        });
      });
      menuEditLinksHost.querySelectorAll("[data-mlu]").forEach(inp=>{
        inp.addEventListener("input", ()=>{
          const i = Number(inp.getAttribute("data-mlu"));
          editingMenuLinks[i].url = inp.value;
        });
      });
      menuEditLinksHost.querySelectorAll("[data-mlrm]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const i = Number(btn.getAttribute("data-mlrm"));
          editingMenuLinks.splice(i,1);
          renderMenuEditLinks();
        });
      });
    }

    function saveMenuEdit(){
      if(editingMenuGlobalIndex < 0) return;
      const name = (menuEditName.value || "").trim();
      if(!name){ showAlert("Informe o nome do bot\u00e3o."); return; }

      const iconUrl = (menuEditIcon.value || "").trim();
      const links = editingMenuLinks
        .map(x => ({ name:(x.name||"").trim(), url:(x.url||"").trim() }))
        .filter(x => x.name || x.url);

      const next = menuButtons.slice();
      next[editingMenuGlobalIndex] = { name, iconUrl, links };
      saveMenuButtons(next);
      renderDrawer();
      closeMenuEdit();
    }

    async function removeMenuButton(globalIdx){
      const b = menuButtons[globalIdx];
      if(!b) return;

      const ok = await showConfirm(`Remover o bot\u00e3o do menu:\n\n"${b.name}"\n\nConfirmar?`);
      if(!ok) return;

      const next = menuButtons.slice();
      next.splice(globalIdx,1);
      saveMenuButtons(next);

      const totalPages = Math.max(1, Math.ceil(next.length / DRAWER_PAGE_SIZE));
      if(drawerPage > totalPages) drawerPage = totalPages;
      renderDrawer();
    }

    /***********************
     * FORM: LINKS DA PERGUNTA
     ***********************/
    function setQuestionLinksUI(list){
      qLinks = Array.isArray(list) ? list.map(l => ({
        name: (l?.name||"").toString(),
        url: (l?.url||"").toString()
      })) : [];
      renderQuestionLinksUI();
    }

    function renderQuestionLinksUI(){
      questionLinksHost.innerHTML = qLinks.map((l, idx) => `
        <div class="linkRow">
          <input type="text" placeholder="Nome do link" value="${escapeHtml(l.name||"")}" data-qname="${idx}">
          <input type="text" placeholder="https://..." value="${escapeHtml(l.url||"")}" data-qurl="${idx}">
          <button class="btn small danger" data-qrm="${idx}">Remover</button>
        </div>
      `).join("");

      questionLinksHost.querySelectorAll("[data-qname]").forEach(inp=>{
        inp.addEventListener("input", ()=>{
          const i = Number(inp.getAttribute("data-qname"));
          qLinks[i].name = inp.value;
        });
      });
      questionLinksHost.querySelectorAll("[data-qurl]").forEach(inp=>{
        inp.addEventListener("input", ()=>{
          const i = Number(inp.getAttribute("data-qurl"));
          qLinks[i].url = inp.value;
        });
      });
      questionLinksHost.querySelectorAll("[data-qrm]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const i = Number(btn.getAttribute("data-qrm"));
          qLinks.splice(i,1);
          renderQuestionLinksUI();
        });
      });
    }

    function addQuestionLinkRow(){
      qLinks.push({ name:"", url:"" });
      renderQuestionLinksUI();
    }

    /***********************
     * FORM: IMAGENS DA PERGUNTA
     ***********************/
    function setQuestionImagesUI(list){
      qImages = uniq(Array.isArray(list) ? list : []);
      qImgsCount.textContent = `${qImages.length} arquivo(s)`;
      renderQImgsPreview();
    }

    function queueImageDeletes(list){
      const names = (Array.isArray(list) ? list : [])
        .map(x => (x || "").toString().trim())
        .filter(Boolean);
      if(!names.length) return;
      pendingDeleteImages = uniq(pendingDeleteImages.concat(names));
    }

    async function deleteImagesNow(list){
      const names = uniq((Array.isArray(list) ? list : [])
        .map(x => (x || "").toString().trim())
        .filter(Boolean));
      if(!names.length) return;
      let hadError = false;
      for(const name of names){
        try{
          await apiDeleteImage(name);
        }catch(err){
          hadError = true;
        }
      }
      if(hadError){
        showAlert("N\u00e3o foi poss\u00edvel remover uma das imagens do servidor.");
      }
    }

    async function flushPendingImageDeletes(){
      if(!pendingDeleteImages.length) return;
      const list = pendingDeleteImages.slice();
      pendingDeleteImages = [];
      await deleteImagesNow(list);
    }

    function renderQImgsPreview(){
      if(!qImages.length){
        qImgsPreviewGrid.innerHTML = `
          <div class="qImgBox" style="min-height:140px;">
            <div class="note" style="padding:10px; text-align:center;">Pr\u00e9via das imagens (quando selecionar)</div>
          </div>
          <div class="qImgBox" style="min-height:140px;">
            <div class="note" style="padding:10px; text-align:center;">Voc\u00ea pode selecionar v\u00e1rias imagens</div>
          </div>
        `;
        return;
      }

      qImgsPreviewGrid.innerHTML = qImages.map((fn, i) => `
        <div class="qImgBox">
          <button type="button" class="qImgDelBtn" title="Remover imagem" data-qimg-remove="${i}">&times;</button>
          <img alt="Pr\u00e9via" src="${buildImagePath(fn, "respostas")}" onerror="this.style.display='none'">
          <div class="qImgName">${escapeHtml(fn)}</div>
        </div>
      `).join("");
    }

    /***********************
     * MODE
     ***********************/
    function updateModeLabel(){ modeLabel.textContent = ""; }
    function updateQCount(){ qCountEl.textContent = `${(qInput.value || "").length}/140`; }

    function openQuestionModal(mode){
      if(questionModalTitle){
        questionModalTitle.textContent = mode === "edit" ? "Editar pergunta" : "Cadastrar pergunta";
      }
      if(questionOverlay) questionOverlay.classList.add("show");
    }

    function closeQuestionModal(){
      if(questionOverlay) questionOverlay.classList.remove("show");
    }

    function openTaskModal(){
      fillAssuntoSelect();
      if(taskOverlay){
        if(!taskModalFromCalendar) taskOverlay.classList.remove("isCalendarContext");
        taskOverlay.classList.add("show");
      }
      if(tasksSaveBtn){
        tasksSaveBtn.textContent = tasksEditId ? "Salvar" : "Pr\u00f3ximo";
      }
      if(tData && !tData.value) tData.value = todayISO();
    }

    function closeTaskModal(){
      if(taskOverlay){
        taskOverlay.classList.remove("show");
        taskOverlay.classList.remove("isCalendarContext");
      }
      if(taskModalFromCalendar){
        taskModalFromCalendar = false;
        if(calendarOverlay && !calendarOverlay.classList.contains("show")){
          openCalendar();
        }
      }
    }

    function bindCalDayDetailsDelegation(){
      if(!calDayDetails || calDayDetailsBound) return;
      calDayDetailsBound = true;
      calDayDetails.addEventListener("click", (event)=>{
        const editBtn = event.target.closest("[data-cal-item-editphase]");
        if(!editBtn) return;
        event.preventDefault();
        event.stopPropagation();
        const id = (editBtn.getAttribute("data-cal-item-editphase") || "").toString().trim();
        const idxRaw = (editBtn.getAttribute("data-cal-phase-idx") || "").toString().trim();
        const idx = Number.parseInt(idxRaw || "-1", 10);
        if(!id) return;
        const ref = (tasks || []).find(t => String(t.id || "") === id);
        if(!ref){
          showAlert("Tarefa n\u00e3o encontrada na lista de abertas. Reative a tarefa para editar.");
          return;
        }
        phaseEditOrigin = "calendar";
        if(calendarOverlay) calendarOverlay.classList.remove("show");
        openPhaseEditor({ taskId:id, mode:"edit", index:idx });
      });
    }

/***********************
     * STEPS (UI)
     ***********************/
    function addStepUI(stepData){
      const step = stepData || { name:"", text:"", imageFilename:"", stepLinks:[] };

      const wrap = document.createElement("div");
      wrap.className = "item stepCard";
      wrap.style.marginTop = "10px";

      wrap.innerHTML = `
        <div class="row" style="align-items:center;">
          <div class="label" style="margin:0;">Passo</div>
          <button class="btn small danger" data-step-remove>Remover passo</button>
        </div>

        <div style="margin-top:10px;">
          <div class="label">Nome do passo</div>
          <input type="text" placeholder="Ex: Confirmar no sistema" data-step-name value="${escapeHtml(step.name||"")}">
        </div>

        <div style="margin-top:10px;">
          <div class="label">Texto do passo</div>
          <textarea data-step-text placeholder="O que fazer neste passo...">${escapeHtml(step.text||"")}</textarea>
        </div>

        <div style="margin-top:10px;">
          <div class="row" style="align-items:center;">
            <div class="label" style="margin:0;">Links do passo</div>
            <button class="btn small" data-step-addlink>+ Adicionar link</button>
          </div>
          <div class="linkRows" data-step-links></div>
        </div>

        <div style="margin-top:10px;">
          <div class="label">Imagem do passo <span class="count">opcional</span></div>
          <div class="row" style="gap:10px; align-items:center; flex-wrap:wrap;">
            <div class="count" data-step-imgname>${escapeHtml(step.imageFilename || "Nenhuma imagem")}</div>
            <button class="btn small" data-step-pick>Escolher imagem</button>
            <button class="btn small" data-step-clear>Limpar</button>
            <input type="file" accept="image/*" style="display:none" data-step-file>
          </div>
        </div>
      `;

      const nameEl = wrap.querySelector("[data-step-name]");
      const textEl = wrap.querySelector("[data-step-text]");
      const rmBtn = wrap.querySelector("[data-step-remove]");

      const pickBtn = wrap.querySelector("[data-step-pick]");
      const clearBtn = wrap.querySelector("[data-step-clear]");
      const fileEl = wrap.querySelector("[data-step-file]");
      const imgNameEl = wrap.querySelector("[data-step-imgname]");

      const addLinkBtn = wrap.querySelector("[data-step-addlink]");
      const linksHost = wrap.querySelector("[data-step-links]");

      let stepLinks = Array.isArray(step.stepLinks) ? step.stepLinks.slice() : [];
      if(step.link && !stepLinks.length){
        stepLinks = [{ name: (step.linkName||"Link"), url: step.link }];
      }

      function renderStepLinks(){
        linksHost.innerHTML = stepLinks.map((l, i) => `
          <div class="linkRow">
            <input type="text" placeholder="Nome do link" value="${escapeHtml(l.name||"")}" data-sln="${i}">
            <input type="text" placeholder="https://..." value="${escapeHtml(l.url||"")}" data-slu="${i}">
            <button class="btn small danger" data-slrm="${i}">Remover</button>
          </div>
        `).join("");

        linksHost.querySelectorAll("[data-sln]").forEach(inp=>{
          inp.addEventListener("input", ()=>{
            const i = Number(inp.getAttribute("data-sln"));
            stepLinks[i].name = inp.value;
          });
        });
        linksHost.querySelectorAll("[data-slu]").forEach(inp=>{
          inp.addEventListener("input", ()=>{
            const i = Number(inp.getAttribute("data-slu"));
            stepLinks[i].url = inp.value;
          });
        });
        linksHost.querySelectorAll("[data-slrm]").forEach(btn=>{
          btn.addEventListener("click", ()=>{
            const i = Number(btn.getAttribute("data-slrm"));
            stepLinks.splice(i,1);
            renderStepLinks();
          });
        });
      }
      renderStepLinks();

      addLinkBtn.addEventListener("click", ()=>{
        stepLinks.push({ name:"", url:"" });
        renderStepLinks();
      });

      rmBtn.addEventListener("click", ()=> wrap.remove());

      pickBtn.addEventListener("click", ()=> fileEl.click());

      fileEl.addEventListener("change", async ()=>{

      	const f = fileEl.files && fileEl.files[0];

      	if(!f) return;

      	fileEl.value = "";

      	try{

      		const filename = await apiUploadImage(f, "respostas");

      		if(filename){

      			imgNameEl.textContent = filename;

      		}

      	}catch(err){

      		showAlert("NÊo foi poss¦vel enviar a imagem do passo.");

      	}

      });

      clearBtn.addEventListener("click", ()=>{
        fileEl.value = "";
        imgNameEl.textContent = "Nenhuma imagem";
      });

      wrap.__getStep = () => ({
        name: nameEl.value || "",
        text: textEl.value || "",
        imageFilename: (imgNameEl.textContent === "Nenhuma imagem") ? "" : imgNameEl.textContent,
        stepLinks: stepLinks.filter(x => (x.name||"").trim() || (x.url||"").trim()),
        link: "",
        linkName: ""
      });

      stepsHost.appendChild(wrap);
    }

    function getStepsFromUI(){
      return [...stepsHost.querySelectorAll(".stepCard")]
        .map(n => (typeof n.__getStep === "function" ? n.__getStep() : null))
        .filter(Boolean);
    }
    function clearStepsUI(){ stepsHost.innerHTML = ""; }

    /***********************
     * SAVE / EDIT / DELETE (perguntas) - COM SENHA
     ***********************/
    function clearForm(){
      editIndex = -1;
      updateModeLabel();
      pendingDeleteImages = [];

      qInput.value = "";
      if(qStoreSelect) qStoreSelect.value = "ALL";
      rInput.value = "";
      linksInput.value = "";
      tagsInput.value = "";

      setQuestionImagesUI([]);
      setQuestionLinksUI([]);

      clearStepsUI();
      updateQCount();
    }

    function parseTags(raw){
      return (raw || "").split(",").map(s => s.trim()).filter(Boolean);
    }

    function handleSave(){
      const q = (qInput.value || "").trim();
      const r = (rInput.value || "").trim();

      if(!q){ showAlert("Informe a Pergunta."); return; }
      if(!r){ showAlert("Informe a Resposta."); return; }

      const store = (qStoreSelect ? (qStoreSelect.value || "").trim() : "");
      if(!store){ showAlert("Escolha a loja."); return; }

      const links = (linksInput.value || "").trim();
      const tags = parseTags(tagsInput.value);

      const steps = getStepsFromUI();

      const fallbackUserId = String(currentUser?.id || "");
      const fallbackUserName = (currentUser?.display_name || currentUser?.username || "").toString().trim();

      const payload = {
        store,
        q, r, links, tags,
        qImages: qImages.slice(),
        qLinks: qLinks.filter(l => (l.name||"").trim() || (l.url||"").trim()),
        steps,
        created_by_user_id: fallbackUserId,
        created_by_username: fallbackUserName
      };

      const next = items.slice();

      if(editIndex === -1){
        next.push(payload);
      }else{
        const prev = next[editIndex] || {};
        payload.created_by_user_id = (prev.created_by_user_id || "").toString() || payload.created_by_user_id;
        payload.created_by_username = (prev.created_by_username || "").toString() || payload.created_by_username;
        next[editIndex] = payload;
      }

      items = next;
      saveBase(items);

      void flushPendingImageDeletes();
      clearForm();
      render();
      scrollToTop();
      closeQuestionModal();
    }

    async function startEdit(idx){
      if(!await requirePassword("editar")) return;

      const it = items[idx];
      if(!it) return;

      pendingDeleteImages = [];
      editIndex = idx;
      updateModeLabel();

      qInput.value = it.q || "";
      if(qStoreSelect) qStoreSelect.value = (it.store || "Di\u00e1rio Nerdify");
      rInput.value = it.r || "";
      linksInput.value = it.links || "";
      tagsInput.value = (it.tags || []).join(", ");

      setQuestionImagesUI(Array.isArray(it.qImages) ? it.qImages : []);
      setQuestionLinksUI(Array.isArray(it.qLinks) ? it.qLinks : []);

      clearStepsUI();
      (Array.isArray(it.steps) ? it.steps : []).forEach(s => addStepUI(s));

      updateQCount();
      scrollToTop();
      openQuestionModal("edit");
    }

    async function deleteItem(idx){
      if(!await requirePassword("excluir")) return;

      const it = items[idx];
      if(!it) return;

      const ok = await showConfirm(`Excluir a pergunta:\n\n"${it.q}"\n\nConfirmar?`);
      if(!ok) return;

      items.splice(idx,1);
      saveBase(items);

      void deleteImagesNow(Array.isArray(it.qImages) ? it.qImages : []);
      if(editIndex === idx) clearForm();
      render();
      scrollToTop();
    }

    /***********************
     * SEARCH / RENDER
     ***********************/
    function includesTerm(text, term){
      return (text || "").toLowerCase().includes(term);
    }
    function itemMatches(it, term){
      if(!term) return true;

      const t = term.toLowerCase();
      if(includesTerm(it.q, t)) return true;
      if(includesTerm(it.r, t)) return true;
      if(includesTerm(it.links, t)) return true;

      if(Array.isArray(it.qLinks)){
        for(const l of it.qLinks){
          if(includesTerm(l.name, t) || includesTerm(l.url, t)) return true;
        }
      }

      if(Array.isArray(it.steps)){
        for(const s of it.steps){
          if(includesTerm(s.name, t) || includesTerm(s.text, t)) return true;

          if(Array.isArray(s.stepLinks)){
            for(const l of s.stepLinks){
              if(includesTerm(l.name, t) || includesTerm(l.url, t)) return true;
            }
          }
        }
      }

      if(Array.isArray(it.tags) && it.tags.join(" ").toLowerCase().includes(t)) return true;

      return false;
    }

    function loadTasksDone(){
      const raw = storageGet(STORAGE_KEY_TASKS_DONE);
      const parsed = safeJsonParse(raw);
      if(Array.isArray(parsed)) return hydrateTaskOwnership(normalizeTasks(parsed));
      return [];
    }

    function saveTasksDone(next){
      tasksDone = hydrateTaskOwnership(normalizeTasks(next));
      storageSet(STORAGE_KEY_TASKS_DONE, JSON.stringify(tasksDone));
      renderMiniCalendar();
      renderDoneTasks();
    }
    function renderLinksList(list){
      const arr = Array.isArray(list) ? list : [];
      if(!arr.length) return "";

      return `
        <div class="linkList">
          ${arr.map(l => {
            const name = (l && l.name) ? l.name : "Link";
            const url = (l && l.url) ? l.url : "";
            const urlHtml = url
              ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`
              : `<span class="note">Sem URL</span>`;
            return `
              <div class="linkItem">
                <div class="nm">${escapeHtml(name)}</div>
                ${urlHtml}
              </div>
            `;
          }).join("")}
        </div>
      `;
    }
    function renderCard(it, idx){
      const qText = (it.q || "").trim();
      const rText = (it.r || "").trim();
      const qLinksHtml = renderLinksList(it.qLinks);

      const stRaw = (((it && it.store) ? it.store : "Di\u00e1rio Nerdify") + "").trim();
      const storeLabel = (stRaw === "ALL") ? "Todas as lojas" : stRaw;
      const storeData = getStoreByName(storeLabel);
      const storeLogoUrl = (storeData && storeData.logoUrl)
        ? storeData.logoUrl
        : (storeLabel.toLowerCase().includes("shop 80") ? DEFAULT_SHOP80_LOGO : DEFAULT_DIARIO_LOGO);
      const storeBlockHtml = `
        <div class="questionStoreBlock">
          <img class="questionStoreLogo" src="${escapeHtml(storeLogoUrl)}" alt="Logo ${escapeHtml(storeLabel)}" loading="lazy">
          <div class="questionStoreLabel">Loja: ${escapeHtml(storeLabel)}</div>
        </div>
      `;
      const fallbackAuthor = (currentUser?.display_name || currentUser?.username || "").toString().trim();
      const questionAuthor = ((it.created_by_username || "").toString().trim() || fallbackAuthor || "N\u00e3o informado");
      if(!it.created_by_username && fallbackAuthor){
        it.created_by_user_id = (currentUser?.id || "").toString();
        it.created_by_username = fallbackAuthor;
      }
      const authorHtml = `<div class="note" style="margin-top:6px;">Usu\u00e1rio: <b>${escapeHtml(questionAuthor)}</b></div>`;

      const imgs = Array.isArray(it.qImages) ? it.qImages : [];
      const imgsHtml = imgs.length
        ? `
          <div class="linksBlock">
            <div class="label">Imagens da Pergunta <span class="count">${imgs.length} arquivo(s)</span></div>
            <div class="qImgsShowGrid">
              ${imgs.map(fn => `
                <img alt="Imagem da pergunta" src="${buildImagePath(fn, "respostas")}" onerror="this.style.display='none'">
              `).join("")}
            </div>
          </div>
        ` : "";

      const linksDmText = (it.links || "").trim();
      const linksDmBlock = linksDmText
        ? `
          <div class="linksBlock">
            <div class="copyRow">
              <div style="width:100%;">
                <div class="label">Links (para DM)</div>
                <div class="pre" data-copy="${escapeHtml(linksDmText)}">${escapeHtml(linksDmText)}</div>
              </div>
              <button class="btn small iconBtn copyBtn" data-copybtn title="Copiar" aria-label="Copiar">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="9" y="9" width="10" height="10" rx="2"></rect>
                  <rect x="5" y="5" width="10" height="10" rx="2"></rect>
                </svg>
              </button>
            </div>
          </div>
        ` : "";

      const steps = Array.isArray(it.steps) ? it.steps : [];
      const stepsBtn = steps.length ? `<button class="btn small" data-steps="${idx}">O que fazer (${steps.length})</button>` : "";

      const tags = Array.isArray(it.tags) ? it.tags : [];
      const tagsHtml = tags.length
        ? `
          <hr class="dashDivider tagsDivider">
          <div class="label">Tags:</div>
          <div class="tags">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
        `
        : "";

      return `
        <div class="item">
          <div class="row">
            <h3 class="itemTitle">${escapeHtml(qText || "Sem pergunta")}</h3>
            <div class="btnrow">
              <button class="btn small iconBtn" data-edit="${idx}" title="Editar" aria-label="Editar">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5l4 4L7 21l-4 1 1-4 12.5-14.5z"></path>
                </svg>
              </button>
              <button class="btn small danger iconBtn" data-del="${idx}" title="Excluir" aria-label="Excluir">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6h18"></path>
                  <path d="M8 6V4h8v2"></path>
                  <rect x="6" y="6" width="12" height="14" rx="2"></rect>
                  <path d="M10 10v6"></path>
                  <path d="M14 10v6"></path>
                </svg>
              </button>
            </div>
          </div>

          ${storeBlockHtml}
          ${authorHtml}

          ${rText ? `
            <div class="linksBlock">
              <div class="copyRow">
                <div style="width:100%;">
                  <div class="label">Resposta</div>
                  <div class="pre" data-copy="${escapeHtml(rText)}">${escapeHtml(rText)}</div>
                </div>
                <button class="btn small iconBtn copyBtn" data-copybtn title="Copiar" aria-label="Copiar">
                  <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="9" y="9" width="10" height="10" rx="2"></rect>
                    <rect x="5" y="5" width="10" height="10" rx="2"></rect>
                  </svg>
                </button>
              </div>
            </div>
          ` : ""}

          ${linksDmBlock}

          ${qLinksHtml ? `
            <div class="linksBlock">
              <div class="label">Links</div>
              ${qLinksHtml}
            </div>
          ` : ""}

          ${imgsHtml}
          ${tagsHtml}

          ${stepsBtn ? `<div class="stepsBtn">${stepsBtn}</div>` : ""}
        </div>
      `;
    }

    function renderNav(){
      const selectedStore = (searchStoreSelect ? (searchStoreSelect.value || "ALL").trim() : "ALL");
      const term = (searchInput.value || "").trim();
      if(term){ cardsNav.innerHTML = ""; return; }
      if(items.length <= 1){ cardsNav.innerHTML = ""; return; }

      if(showAllCards){
        cardsNav.innerHTML = `<button class="btn small" id="showSingleBtn">Exibir apenas uma pergunta por vez</button>`;
        document.getElementById("showSingleBtn").addEventListener("click", ()=>{
          showAllCards = false;
          currentSingleIndex = 0;
          render();
          scrollToTop();
        });
        return;
      }

      cardsNav.innerHTML = `
        <button class="btn small" id="nextQuestionBtn">Ver pr\u00f3xima</button>
        <button class="btn small" id="showAllBtn">Ver todas</button>
      `;

      document.getElementById("nextQuestionBtn").addEventListener("click", ()=>{
        currentSingleIndex = Math.min(items.length - 1, currentSingleIndex + 1);
        render();
        scrollToTop();
      });
      document.getElementById("showAllBtn").addEventListener("click", ()=>{
        showAllCards = true;
        render();
        scrollToTop();
      });
    }

    function render(){
      if(currentView !== "search") return;

      const selectedStore = (searchStoreSelect ? (searchStoreSelect.value || "ALL").trim() : "ALL");
      let backfilledAuthors = false;
      const fallbackAuthor = (currentUser?.display_name || currentUser?.username || "").toString().trim();
      if(fallbackAuthor){
        items.forEach((it)=>{
          if(it && !it.created_by_username){
            it.created_by_user_id = (currentUser?.id || "").toString();
            it.created_by_username = fallbackAuthor;
            backfilledAuthors = true;
          }
        });
        if(backfilledAuthors) saveBase(items);
      }
      if(searchInput) searchInput.disabled = false;
      const term = (searchInput.value || "").trim();
      const filtered = items
        .map((it, idx) => ({ it, idx }))
        .filter(x => {
          const st = ((x.it.store || "Di\u00e1rio Nerdify") + "").trim();
          return (!selectedStore || selectedStore === "ALL") ? true : (st === selectedStore || st === "ALL");
        })
        .filter(x => itemMatches(x.it, term))
        .filter(x => {
          if(!searchTagsFilter.length) return true;
          const tags = Array.isArray(x.it.tags) ? x.it.tags : [];
          const tagSet = new Set(tags.map(t => (t || "").toString().trim().toLowerCase()).filter(Boolean));
          return searchTagsFilter.some(t => tagSet.has(t));
        });

      countEl.textContent = `${filtered.length} item(ns)`;

      let listToRender = filtered;
      if(searchTagsFilter.length || (selectedStore && selectedStore !== "ALL")){
        listToRender = filtered;
      }else if(!term && !showAllCards){
        const realIndex = items.length - 1 - currentSingleIndex;
        const found = filtered.find(x => x.idx === realIndex);
        listToRender = found ? [found] : (filtered.length ? [filtered[0]] : []);
      }

      resultsEl.innerHTML = listToRender.map(x => renderCard(x.it, x.idx)).join("")
        || `<div class="note">Nenhum resultado encontrado.</div>`;

      resultsEl.querySelectorAll("[data-copybtn]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const pre = btn.parentElement.querySelector("[data-copy]");
          const text = pre ? pre.getAttribute("data-copy") : "";
          if(!text) return;
          navigator.clipboard.writeText(text).then(()=>{
            if(btn.classList.contains("iconBtn")){
              btn.style.opacity = "0.6";
              setTimeout(()=>{ btn.style.opacity = "1"; }, 450);
            }else{
              btn.textContent = "Copiado!";
              setTimeout(()=> btn.textContent = "Copiar", 900);
            }
          }).catch(()=> showAlert("N\u00e3o foi poss\u00edvel copiar."));
        });
      });

      resultsEl.querySelectorAll("[data-steps]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const idx = Number(btn.getAttribute("data-steps"));
          openModal(idx);
        });
      });

      resultsEl.querySelectorAll("[data-edit]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const idx = Number(btn.getAttribute("data-edit"));
          startEdit(idx);
        });
      });
      resultsEl.querySelectorAll("[data-del]").forEach(btn=>{
        btn.addEventListener("click", async ()=>{
          const idx = Number(btn.getAttribute("data-del"));
          await deleteItem(idx);
        });
      });

      renderNav();
    }

    /***********************
     * MODAL (O QUE FAZER)
     ***********************/
    function openModal(itemIdx){
      modalItemIndex = itemIdx;
      modalStepIndex = 0;
      overlay.classList.add("show");
      renderModalStep();
    }
    function closeModal(){
      overlay.classList.remove("show");
      modalItemIndex = -1;
      modalStepIndex = 0;
      modalBody.innerHTML = "";
    }
    function renderModalStep(){
      const it = items[modalItemIndex];
      const steps = (it && Array.isArray(it.steps)) ? it.steps : [];
      if(!steps.length){
        modalBody.innerHTML = `<div class="text">Nenhum passo cadastrado.</div>`;
        prevStepBtn.style.display = "none";
        nextStepBtn.style.display = "none";
        return;
      }

      const s = steps[modalStepIndex] || {};
      const stepNum = modalStepIndex + 1;

      const nameHtml = s.name ? `<p class="stepName">${escapeHtml(s.name)}</p>` : ``;

      const linksHtml = (Array.isArray(s.stepLinks) && s.stepLinks.length)
        ? `<div style="margin-top:8px;">${renderLinksList(s.stepLinks)}</div>`
        : ``;

      const imgHtml = s.imageFilename
        ? `<img alt="Imagem do passo" src="${buildImagePath(s.imageFilename, "respostas")}" onerror="this.style.display='none'">`
        : ``;

      modalBody.innerHTML = `
        <div class="stepView">
          <p class="stepNum">Passo ${stepNum}</p>
          ${nameHtml}
          <div class="text">${escapeHtml(s.text || "")}</div>
          ${linksHtml}
          ${imgHtml}
        </div>
      `;

      prevStepBtn.style.display = modalStepIndex > 0 ? "inline-block" : "none";
      nextStepBtn.style.display = modalStepIndex < steps.length - 1 ? "inline-block" : "none";
    }
    function nextStep(){
      const it = items[modalItemIndex];
      const steps = (it && Array.isArray(it.steps)) ? it.steps : [];
      if(modalStepIndex < steps.length - 1){
        modalStepIndex++;
        renderModalStep();
      }
    }
    function prevStep(){
      if(modalStepIndex > 0){
        modalStepIndex--;
        renderModalStep();
      }
    }

    /***********************
     * TAREFAS DI\u00c1RIAS
     ***********************/
    function fillSelectOptions(selectEl, options){
      if(!selectEl) return;
      selectEl.innerHTML = options.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    }

    function fillStatusOptions(){
      if(!tStatus) return;
      tStatus.innerHTML = STATUS_OPTIONS.map(s => `<option value="${escapeHtml(s.value)}">${escapeHtml(s.value)}</option>`).join("");
    }

    function setTasksModeLabel(){
      if(!tasksModeLabel) return;
      tasksModeLabel.textContent = tasksEditId ? "Modo: editando" : "Modo: novo";
    }

    
    // =========================
    // DESCRICAO (FASES + DATA + NOVO PEDIDO + RASTREIO)
    // =========================
    function getDescPhasesFromUI(){
      if(!obsList) return [];
      const blocks = Array.from(obsList.querySelectorAll(".descPhase"));
      const out = blocks.map((b, i) => {
        const textEl = b.querySelector("textarea.obsItem");
        const dateEl = b.querySelector("input.obsDate");
        const prazoEl = b.querySelector("input.obsPrazo");
        const prazoHoraEl = b.querySelector("input.obsPrazoHora");
        const chamadoEl = b.querySelector("input.obsChamado");
        const etiquetaEl = b.querySelector("input.obsEtiqueta");
        const novoEl = b.querySelector("input.obsNovoPedido");
        const rastEl = b.querySelector("input.obsRastreio");
        const statusEl = b.querySelector("select.obsStatus");
        const attentionEl = b.querySelector("input.obsAttention");
        const attentionNoteEl = b.querySelector("textarea.obsAttentionNote");
        return {
          text: ((textEl?.value || "").toString()).trim(),
          date: ((dateEl?.value || "").toString()).trim(),
          prazo: ((prazoEl?.value || "").toString()).trim(),
          prazoHora: ((prazoHoraEl?.value || "").toString()).trim(),
          chamado: ((chamadoEl?.value || "").toString()).trim(),
          etiqueta: ((etiquetaEl?.value || "").toString()).trim(),
          novoPedido: ((novoEl?.value || "").toString()).trim(),
          rastreio: ((rastEl?.value || "").toString()).trim(),
          status: ((statusEl?.value || "").toString()).trim(),
          attention: Boolean(attentionEl && attentionEl.checked),
          attentionNote: Boolean(attentionEl && attentionEl.checked)
            ? ((attentionNoteEl?.value || "").toString()).trim()
            : "",
          state: ((b.dataset.state || "").toString()).trim(),
          _i: i,
        };
      });

      // remove totalmente vazias
      const cleaned = out
        .map(o => ({ text:o.text, date:o.date, prazo:o.prazo, prazoHora:o.prazoHora, chamado:o.chamado, etiqueta:o.etiqueta, novoPedido:o.novoPedido, rastreio:o.rastreio, status:o.status, attention:o.attention, attentionNote:o.attentionNote, state:o.state }))
        .filter(o => o.text || o.date || o.prazo || o.prazoHora || o.chamado || o.etiqueta || o.novoPedido || o.rastreio || o.status || o.attention || o.attentionNote || o.state);

      return cleaned;
    }

    function createDescPhaseBlock(idx, data){
      const d = data || { text:"", date:"", prazo:"", prazoHora:"", chamado:"", etiqueta:"", novoPedido:"", rastreio:"", attention:false, attentionNote:"", state:"" };
      // monta as op\u00e7\u00f5es do select de status reutilizando PHASE_STATUS_OPTIONS
      const buildStatusOptions = (selected) => {
        const sel = (selected || "").toString().trim();
        const opts = ['<option value="">Selecione o status</option>'];
        PHASE_STATUS_OPTIONS.forEach(g => {
          opts.push(`<optgroup label="${escapeHtml(g.group)}">`);
          (g.options || []).forEach(txt => {
            const isSel = sel === txt ? ' selected' : '';
            opts.push(`<option value="${escapeHtml(txt)}"${isSel}>${escapeHtml(txt)}</option>`);
          });
          opts.push(`</optgroup>`);
        });
        return opts.join("");
      };
      const wrap = document.createElement("div");
      wrap.className = "descPhase";
      wrap.dataset.index = String(idx);
      wrap.dataset.state = (d.state || "").toString();
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.gap = "8px";

      const textarea = document.createElement("textarea");
      textarea.className = "obsItem";
      textarea.dataset.index = String(idx);
      textarea.placeholder = `Fase ${idx + 1} - descri\u00e7\u00e3o do caso...`;
      textarea.style.width = "100%";
      textarea.value = (d.text || "");

      const row = document.createElement("div");
      row.className = "row";
      row.style.gap = "10px";
      row.style.flexWrap = "wrap";
      row.style.alignItems = "flex-end";

      const colDate = document.createElement("div");
      colDate.style.flex = "1";
      colDate.style.minWidth = "180px";
      colDate.innerHTML = `<div class="label" style="margin-bottom:6px;">Data inicial da fase</div>`;
      const inputDate = document.createElement("input");
      inputDate.type = "date";
      inputDate.className = "obsDate";
      inputDate.dataset.index = String(idx);
      inputDate.value = (d.date || "");
      colDate.appendChild(inputDate);

      const colPrazo = document.createElement("div");
      colPrazo.style.flex = "1";
      colPrazo.style.minWidth = "180px";
      colPrazo.innerHTML = `<div class="label" style="margin-bottom:6px;">Prazo de resolu&ccedil;&atilde;o da fase</div>`;
      const inputPrazo = document.createElement("input");
      inputPrazo.type = "date";
      inputPrazo.className = "obsPrazo";
      inputPrazo.dataset.index = String(idx);
      inputPrazo.value = (d.prazo || "");
      colPrazo.appendChild(inputPrazo);

      const colPrazoHora = document.createElement("div");
      colPrazoHora.style.flex = "1";
      colPrazoHora.style.minWidth = "180px";
      colPrazoHora.innerHTML = `<div class="label" style="margin-bottom:6px;">Hor&aacute;rio do prazo</div>`;
      const inputPrazoHora = document.createElement("input");
      inputPrazoHora.type = "time";
      inputPrazoHora.className = "obsPrazoHora";
      inputPrazoHora.dataset.index = String(idx);
      inputPrazoHora.value = (d.prazoHora || "");
      colPrazoHora.appendChild(inputPrazoHora);

      const colChamado = document.createElement("div");
      colChamado.style.flex = "1";
      colChamado.style.minWidth = "180px";
      colChamado.innerHTML = `<div class="label" style="margin-bottom:6px;">N&uacute;mero do Chamado Nuvemshop</div>`;
      const inputChamado = document.createElement("input");
      inputChamado.type = "text";
      inputChamado.className = "obsChamado";
      inputChamado.dataset.index = String(idx);
      inputChamado.placeholder = "Opcional";
      inputChamado.value = (d.chamado || "");
      colChamado.appendChild(inputChamado);

      const colEtiqueta = document.createElement("div");
      colEtiqueta.style.flex = "1";
      colEtiqueta.style.minWidth = "180px";
      colEtiqueta.innerHTML = `<div class="label" style="margin-bottom:6px;">Etiqueta Reversa</div>`;
      const inputEtiqueta = document.createElement("input");
      inputEtiqueta.type = "text";
      inputEtiqueta.className = "obsEtiqueta";
      inputEtiqueta.dataset.index = String(idx);
      inputEtiqueta.placeholder = "Opcional";
      inputEtiqueta.value = (d.etiqueta || "");
      colEtiqueta.appendChild(inputEtiqueta);

      const colNovo = document.createElement("div");
      colNovo.style.flex = "1";
      colNovo.style.minWidth = "180px";
      colNovo.innerHTML = `<div class="label" style="margin-bottom:6px;">Novo pedido</div>`;
      const inputNovo = document.createElement("input");
      inputNovo.type = "text";
      inputNovo.className = "obsNovoPedido";
      inputNovo.dataset.index = String(idx);
      inputNovo.placeholder = "Se houver troca/novo envio";
      inputNovo.value = (d.novoPedido || "");
      colNovo.appendChild(inputNovo);

      const colRast = document.createElement("div");
      colRast.style.flex = "1";
      colRast.style.minWidth = "180px";
      colRast.innerHTML = `<div class="label" style="margin-bottom:6px;">Rastreio da fase</div>`;
      const inputRast = document.createElement("input");
      inputRast.type = "text";
      inputRast.className = "obsRastreio";
      inputRast.dataset.index = String(idx);
      inputRast.placeholder = "Opcional";
      inputRast.value = (d.rastreio || "");
      colRast.appendChild(inputRast);

      const colStatus = document.createElement("div");
      colStatus.style.flex = "1";
      colStatus.style.minWidth = "200px";
      colStatus.innerHTML = `<div class="label" style="margin-bottom:6px;">Status</div>`;
      const selectStatus = document.createElement("select");
      selectStatus.className = "obsStatus";
      selectStatus.dataset.index = String(idx);
      selectStatus.innerHTML = buildStatusOptions(d.status || "");
      colStatus.appendChild(selectStatus);

      row.appendChild(colDate);
      row.appendChild(colPrazo);
      row.appendChild(colPrazoHora);
      row.appendChild(colChamado);
      row.appendChild(colEtiqueta);
      row.appendChild(colNovo);
      row.appendChild(colRast);
      row.appendChild(colStatus);

      const attentionRow = document.createElement("div");
      attentionRow.className = "attentionRow";
      const attentionLabel = document.createElement("label");
      attentionLabel.className = "attentionToggle";
      const attentionInput = document.createElement("input");
      attentionInput.type = "checkbox";
      attentionInput.className = "obsAttention";
      attentionInput.dataset.index = String(idx);
      attentionInput.checked = Boolean(d.attention || d.attentionNote);
      attentionLabel.appendChild(attentionInput);
      attentionLabel.appendChild(document.createTextNode(" Aten¦Êo"));
      attentionRow.appendChild(attentionLabel);

      const attentionWrap = document.createElement("div");
      attentionWrap.className = "attentionNoteWrap";
      attentionWrap.style.display = attentionInput.checked ? "block" : "none";
      const attentionLabelText = document.createElement("div");
      attentionLabelText.className = "label";
      attentionLabelText.textContent = "Observa¦ºes";
      const attentionNote = document.createElement("textarea");
      attentionNote.className = "obsAttentionNote";
      attentionNote.dataset.index = String(idx);
      attentionNote.rows = 3;
      attentionNote.placeholder = "Digite as observa¦ºes...";
      attentionNote.value = (d.attentionNote || "");
      attentionWrap.appendChild(attentionLabelText);
      attentionWrap.appendChild(attentionNote);

      attentionInput.addEventListener("change", ()=>{
        attentionWrap.style.display = attentionInput.checked ? "block" : "none";
      });

      wrap.appendChild(textarea);
      wrap.appendChild(row);
      wrap.appendChild(attentionRow);
      wrap.appendChild(attentionWrap);
      return wrap;
    }

    function setDescPhasesToUI(phases){
      if(!obsList) return;

      const safe = Array.isArray(phases) ? phases : [];
      const list = (safe.length ? safe : [{ text:"", date:"", prazo:"", prazoHora:"", chamado:"", etiqueta:"", novoPedido:"", rastreio:"", attention:false, attentionNote:"", state:"" }]);

      obsList.innerHTML = "";
      list.forEach((p, idx) => {
        obsList.appendChild(createDescPhaseBlock(idx, p));
      });

      // garante regra de n\u00e3o deletar a \u00daltima fase
      updateDescPhaseButtonsState();
    }

    function updateDescPhaseButtonsState(){
      if(!obsList) return;
      const blocks = Array.from(obsList.querySelectorAll(".descPhase"));
      const onlyOne = blocks.length <= 1;
      blocks.forEach((b, idx) => {
        b.dataset.index = String(idx);
        const ta = b.querySelector("textarea.obsItem");
        if(ta){ ta.dataset.index = String(idx); ta.placeholder = `Fase ${idx + 1} - descri\u00e7\u00e3o do caso...`; }
        const d = b.querySelector("input.obsDate");
        if(d) d.dataset.index = String(idx);
        const p = b.querySelector("input.obsPrazo");
        if(p) p.dataset.index = String(idx);
        const ph = b.querySelector("input.obsPrazoHora");
        if(ph) ph.dataset.index = String(idx);
        const c = b.querySelector("input.obsChamado");
        if(c) c.dataset.index = String(idx);
        const e = b.querySelector("input.obsEtiqueta");
        if(e) e.dataset.index = String(idx);
        const n = b.querySelector("input.obsNovoPedido");
        if(n) n.dataset.index = String(idx);
        const r = b.querySelector("input.obsRastreio");
        if(r) r.dataset.index = String(idx);
        const s = b.querySelector("select.obsStatus");
        if(s) s.dataset.index = String(idx);
        const a = b.querySelector("input.obsAttention");
        if(a) a.dataset.index = String(idx);
        const an = b.querySelector("textarea.obsAttentionNote");
        if(an) an.dataset.index = String(idx);

        const add = b.querySelector("[data-obs-add]");
        if(add) add.setAttribute("data-obs-add", String(idx));
        const del = b.querySelector("[data-obs-del]");
        if(del){
          del.setAttribute("data-obs-del", String(idx));
          del.disabled = false;
          del.title = "";
        }
      });
    }

    function getEffectivePedidoFromTask(t){
      const base = ((t?.pedido || "").toString()).trim();
      const phases = Array.isArray(t?.obs) ? t.obs : [];
      for(let i = phases.length - 1; i >= 0; i--){
        const np = ((phases[i]?.novoPedido || "").toString()).trim();
        if(np) return np;
      }
      return base;
    }

    function getEffectiveRastreioFromTask(t){
      const base = ((t?.rastreio || "").toString()).trim();
      const phases = Array.isArray(t?.obs) ? t.obs : [];
      for(let i = phases.length - 1; i >= 0; i--){
        const rc = ((phases[i]?.rastreio || "").toString()).trim();
        if(rc) return rc;
      }
      return base;
    }

    function getEffectivePhaseDate(t){
      const phases = Array.isArray(t?.obs) ? t.obs : [];
      if(!phases.length){
        return ((t?.data || "").toString()).trim();
      }
      for(let i = phases.length - 1; i >= 0; i--){
        const prazo = ((phases[i]?.prazo || "").toString()).trim();
        if(prazo) return prazo;
      }
      for(let i = phases.length - 1; i >= 0; i--){
        const d = ((phases[i]?.date || "").toString()).trim();
        if(d) return d;
      }
      return "";
    }

    function getEffectivePhaseTime(t){
      const phases = Array.isArray(t?.obs) ? t.obs : [];
      if(!phases.length) return "";
      for(let i = phases.length - 1; i >= 0; i--){
        const prazo = ((phases[i]?.prazo || "").toString()).trim();
        if(prazo) return ((phases[i]?.prazoHora || phases[i]?.hora || "").toString()).trim();
      }
      for(let i = phases.length - 1; i >= 0; i--){
        const d = ((phases[i]?.date || "").toString()).trim();
        if(d) return ((phases[i]?.prazoHora || phases[i]?.hora || "").toString()).trim();
      }
      return "";
    }

    function getLastPhasePrazoInfo(t){
      const phases = Array.isArray(t?.obs) ? t.obs : [];
      for(let i = phases.length - 1; i >= 0; i--){
        const prazo = ((phases[i]?.prazo || "").toString()).trim();
        if(prazo){
          const time = ((phases[i]?.prazoHora || phases[i]?.hora || "").toString()).trim();
          return { date: prazo, time, has: true };
        }
      }
      return { date: "", time: "", has: false };
    }

    function isTaskOverdue(t, nowTs){
      if(!t || t.isExtra) return false;
      const info = getLastPhasePrazoInfo(t);
      if(!info.has) return false;
      const dueTs = getDueTimestamp(info.date, info.time);
      if(!Number.isFinite(dueTs)) return false;
      const now = Number.isFinite(nowTs) ? nowTs : Date.now();
      return now > dueTs;
    }

    function getTaskDisplayDate(t){
      const base = (getEffectivePhaseDate(t) || (t?.proxEtapa || "")).toString().trim();
      if(!base) return "";
      if(isTaskOverdue(t)) return addDaysISO(todayISO(), 1) || base;
      return base;
    }

    function getTaskSortTimestamp(t){
      if(!t) return Number.POSITIVE_INFINITY;
      if(isTaskOverdue(t)){
        const info = getLastPhasePrazoInfo(t);
        return getDueTimestamp(info.date, info.time);
      }
      return getDueTimestamp(getTaskDisplayDate(t), getEffectivePhaseTime(t));
    }

    function syncOverdueCalendarEntries(){
      const tomorrow = addDaysISO(todayISO(), 1);
      if(!tomorrow) return;
      let changed = false;
      const next = (calendarHistory || []).map((entry) => {
        if(!entry || entry.open === false) return entry;
        const taskRef = (tasks || []).find(t => String(t?.id || "") === String(entry.id || ""));
        if(!taskRef) return entry;
        if(!isTaskOverdue(taskRef)) return entry;
        if(entry.date == tomorrow) return entry;
        changed = true;
        return { ...entry, date: tomorrow, updatedAt: new Date().toISOString() };
      });
      if(changed){
        calendarHistory = next;
        saveCalendarHistory(next);
      }
    }

    function isCalendarEntryOverdue(entry){
      if(!entry || entry.open === false || entry.extra || entry.simple) return false;
      const taskRef = (tasks || []).find(t => String(t?.id || "") === String(entry.id || ""));
      return taskRef ? isTaskOverdue(taskRef) : false;
    }

    function getDueTimestamp(dateStr, timeStr){
      const date = (dateStr || "").toString().trim();
      if(!date) return Number.POSITIVE_INFINITY;
      const time = (timeStr || "").toString().trim() || "23:59";
      const ts = new Date(`${date}T${time}:00`).getTime();
      return Number.isNaN(ts) ? Number.POSITIVE_INFINITY : ts;
    }

    function getEffectivePhaseIndex(t){
      const phases = Array.isArray(t?.obs) ? t.obs : [];
      if(!phases.length) return 0;
      for(let i = phases.length - 1; i >= 0; i--){
        const prazo = ((phases[i]?.prazo || "").toString()).trim();
        if(prazo) return i;
      }
      for(let i = phases.length - 1; i >= 0; i--){
        const d = ((phases[i]?.date || "").toString()).trim();
        if(d) return i;
      }
      return phases.length - 1;
    }

    function getActivePhaseIndex(t){
      const phases = Array.isArray(t?.obs) ? t.obs : [];
      if(!phases.length) return 0;
      for(let i = phases.length - 1; i >= 0; i--){
        const st = ((phases[i]?.state || "").toString()).trim();
        if(st === PHASE_STATE_ACTIVE) return i;
      }
      return phases.length - 1;
    }

    function getLastPhaseIndex(t){
      const phases = Array.isArray(t?.obs) ? t.obs : [];
      return phases.length ? phases.length - 1 : 0;
    }

    function getEffectivePhaseStatus(t){
      const phases = Array.isArray(t?.obs) ? t.obs : [];
      for(let i = phases.length - 1; i >= 0; i--){
        const st = ((phases[i]?.status || "").toString()).trim();
        if(st) return st;
      }
      return "";
    }

    function getPhaseAttentionByIndex(t, idx){
      const phases = Array.isArray(t?.obs) ? t.obs : [];
      if(!Number.isFinite(idx) || idx < 0 || idx >= phases.length) return { has:false, note:"" };
      const phase = phases[idx] || {};
      const note = (phase.attentionNote || "").toString().trim();
      const has = Boolean(phase.attention || note);
      return { has, note };
    }

    function getPhaseDateByIndex(t, idx){
      const phases = Array.isArray(t?.obs) ? t.obs : [];
      if(!Number.isFinite(idx) || idx < 0 || idx >= phases.length) return "";
      const phase = phases[idx] || {};
      return ((phase.prazo || phase.date || "")).toString().trim();
    }

    function getEffectivePhaseAttention(t){
      const idx = getEffectivePhaseIndex(t);
      return getPhaseAttentionByIndex(t, idx);
    }

    function getCalendarAssuntoFromTask(t){
      const phases = Array.isArray(t?.obs) ? t.obs : [];
      const baseAssunto = (t.assunto || "").trim();
      if(phases.length <= 1){
        return baseAssunto || "(Sem assunto)";
      }
      const phaseStatus = getEffectivePhaseStatus(t);
      return (phaseStatus || baseAssunto || "(Sem assunto)");
    }

    function getLastPhaseText(t){
      const phases = Array.isArray(t?.obs) ? t.obs : [];
      for(let i = phases.length - 1; i >= 0; i--){
        const txt = ((phases[i]?.text || "").toString()).trim();
        if(txt) return txt;
      }
      return "";
    }

    function detectCarrierFromCode(code){
      const c = (code || "").toString().trim();
      if(!c) return { carrier:"", action:"copy", url:"" };

      // Jadlog: somente n\u00fameros (qualquer tamanho)
      if(/^\d+$/.test(c)){
        return { carrier:"jadlog", action:"open", url:`https://www.jadlog.com.br/jadlog/captcha?cte=${encodeURIComponent(c)}` };
      }
      const isAlphaNum = /^[A-Z0-9]+$/i.test(c);
      const hasLetters = /[A-Z]/i.test(c);
      const hasDigits = /\d/.test(c);
      const hasMix = isAlphaNum && hasLetters && hasDigits;
      if(hasMix && /BR$/i.test(c)){
        return { carrier:"correios", action:"copy+open", url:"https://rastreamento.correios.com.br/app/index.php" };
      }
      if(hasMix && !/BR$/i.test(c)){
        return { carrier:"loggi", action:"open", url:`https://app.loggi.com/rastreador/${encodeURIComponent(c)}` };
      }

      return { carrier:"", action:"copy+open", url:"https://rastreamento.correios.com.br/app/index.php" };
    }

    function handleTrackingButton(code){
      const c = (code || "").toString().trim();
      if(!c){
        showAlert("Nenhum c\u00f3digo de rastreio informado.");
        return;
      }

      const rule = detectCarrierFromCode(c);

      if(rule.action === "open"){
        window.open(rule.url, "_blank", "noopener");
        return;
      }

      // copy (e depois abre o site)
      navigator.clipboard.writeText(c).then(()=>{
        if(rule.url){
          window.open(rule.url, "_blank", "noopener");
        }
      }).catch(()=>{
        // fallback (sem copy) ainda abre o site
        if(rule.url){
          window.open(rule.url, "_blank", "noopener");
        }
        showAlert("N\u00e3o foi poss\u00edvel copiar automaticamente. Copie manualmente o c\u00f3digo exibido no card.");
      });
    }

    
    // WhatsApp Cliente (formata e gera link)
    function normalizeWhatsappNumber(raw){
      let s = (raw || "").toString().trim();
      if(!s) return "";
      // remove tudo que n\u00e3o for d\u00e1gito
      s = s.replace(/\D+/g, "");
      if(!s) return "";
      // se vier sem DDI, adiciona 55
      if(!s.startsWith("55")) s = "55" + s;
      return s;
    }
    function buildCustomerWhatsappUrl(raw){
      const n = normalizeWhatsappNumber(raw);
      if(!n) return "";
      return `https://api.whatsapp.com/send?phone=${n}`;
    }
    function openCustomerWhatsapp(raw){
      const url = buildCustomerWhatsappUrl(raw);
      if(!url){
        showAlert("Nenhum n\u00famero de WhatsApp informado.");
        return;
      }
      window.open(url, "_blank", "noopener");
    }
    function updateWhatsappPreview(){
      if(!tWhatsappPreview) return;
      const url = buildCustomerWhatsappUrl(tWhatsapp ? tWhatsapp.value : "");
      tWhatsappPreview.textContent = url ? `Link gerado: ${url}` : "Link gerado: -";
    }

function getNuvemshopSupportBaseUrl(lojaText){
      const l = (lojaText || "").trim();
      const store = getStoreByName(l);
      const custom = (store?.supportWhatsapp || "").toString().trim();
      if(custom) return custom;
      if(l === "Shop 80") return "https://api.whatsapp.com/send?phone=551140207216";
      return "https://api.whatsapp.com/send?phone=551150395895"; // Di\u00e1rio Nerdify (padr\u00e3o)
    }
    function getStorePublicUrl(lojaText){
      const l = (lojaText || "").trim();
      if(l === "Shop 80") return "https://shop80.com.br/";
      return "https://diarionerdify.com.br/";
    }
    function buildNuvemshopSupportUrl(lojaText, assunto, dataInicial, pedidoEfetivo, rastreioEfetivo){
      const base = getNuvemshopSupportBaseUrl(lojaText);
      const site = getStorePublicUrl(lojaText);
      const a = (assunto || "").trim() || "(Sem assunto)";
      const d = (dataInicial || "").trim() || "-";
      const p = (pedidoEfetivo || "").trim() || "-";
      const r = (rastreioEfetivo || "").trim() || "-";

      const lines = [
        `Ol\u00e1, abri um chamado sobre: ${a}`,
        `Gostaria de uma posi\u00e7\u00e3o sobre o chamado.`,
        `Na data: ${d}`,
        `Sobre o pedido: ${p}`,
        `Com rastreio: ${r}`,
        `Minha loja: ${site}`,
      ];

      const text = encodeURIComponent(lines.join("\n"));
      return `${base}&text=${text}`;
    }

    function addPhaseFromCard(taskId){
      const id = (taskId || "").trim();
      if(!id) return;
      openPhaseEditor({ taskId:id, mode:"add", index:-1 });
    }

    function openExtraTaskInCalendar(taskId){
      const id = (taskId || "").trim();
      if(!id) return;
      const ref = (tasks || []).find(t => String(t.id || "") === id);
      if(!ref) return;
      const date = (ref.data || ref.proxEtapa || "").toString().trim();
      if(!date){
        showAlert("Esta tarefa extra n\u00e3o possui data.");
        return;
      }
      const parts = date.split("-");
      if(parts.length === 3){
        const y = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        if(Number.isFinite(y) && Number.isFinite(m)){
          calViewYear = y;
          calViewMonth = m;
        }
      }
      if(calStoreFilter){
        calStoreFilterValue = "";
        calStoreFilter.value = "";
      }
      calSelectedISO = date;
      openCalendar();
      renderCalendarDayDetails(date, { scrollToFirst:true });
      requestAnimationFrame(()=>{
        if(!calDayDetails) return;
        const row = calDayDetails.querySelector(`[data-cal-simple-id="${CSS.escape(id)}"]`);
        if(!row) return;
        row.classList.add("isFocus");
        row.scrollIntoView({ behavior:"smooth", block:"center" });
        setTimeout(()=> row.classList.remove("isFocus"), 1400);
      });
    }

    let pendingCloseTaskId = "";
    function openCloseTaskModal(taskId){
      const id = (taskId || "").trim();
      if(!id || !closeTaskOverlay) return;
      pendingCloseTaskId = id;
      closeTaskOverlay.classList.add("show");
    }
    function closeCloseTaskModal(options){
      if(!closeTaskOverlay) return;
      closeTaskOverlay.classList.remove("show");
      pendingCloseTaskId = "";
      if(!(options && options.skipPending)){
        abortPendingPhaseSave();
      }
    }

    function closeTaskAsDone(taskId){
      const id = (taskId || "").trim();
      if(!id) return;
      const idx = tasks.findIndex(t => t.id === id);
      if(idx < 0) return;
      const t = tasks[idx];
      const closedAt = new Date().toISOString();
      const closedById = (currentUser?.id || "").toString();
      const closedByName = (currentUser?.display_name || currentUser?.username || "").toString().trim();
      if(pendingPhaseSave && pendingPhaseSave.taskId === id){
        applyPhaseToTaskData(t, { ...pendingPhaseSave.phase }, pendingPhaseSave.mode, pendingPhaseSave.index);
        pendingPhaseSave = null;
      }
      markCalendarClosed(t);
      addTaskToDone(t, { closedAt, closedById, closedByName, isExtra: false });
      tasks.splice(idx, 1);
      saveTasks(tasks);
      if(tasksEditId === id) clearTasksForm();
      renderTasks();
    }

    function addTaskToDone(task, options){
      if(!task) return;
      const closedAt = options?.closedAt || new Date().toISOString();
      const isExtra = options?.isExtra ?? Boolean(task.isExtra);
      const closedById = (options?.closedById || "").toString();
      const closedByName = (options?.closedByName || "").toString();
      const id = String(task.id || "");
      tasksDone = tasksDone || [];
      tasksDone = tasksDone.filter(t => String(t.id || "") !== id);
      tasksDone.unshift({ ...task, closedAt, closed_by_user_id: closedById, closed_by_username: closedByName, isExtra });
      saveTasksDone(tasksDone);
    }

    function togglePhaseEditAttention(){
      if(!phaseEditAttentionWrap) return;
      const show = Boolean(phaseEditAttention && phaseEditAttention.checked);
      phaseEditAttentionWrap.style.display = show ? "block" : "none";
      if(show && phaseEditAttentionNote){
        setTimeout(()=>{
          phaseEditAttentionNote.scrollIntoView({ behavior:"smooth", block:"start" });
          phaseEditAttentionNote.focus();
        }, 0);
      }
    }

    function togglePhaseSizeFields(){
      const statusValue = (phaseEditStatus?.value || "").toString();
      const show = /troca/i.test(statusValue);
      if(phaseEditSizeWrap) phaseEditSizeWrap.style.display = show ? "block" : "none";
      if(!show){
        if(phaseEditSizeFrom) phaseEditSizeFrom.value = "";
        if(phaseEditSizeTo) phaseEditSizeTo.value = "";
      }
    }

    function openPhaseEditor({ taskId, mode, index }){
      const id = (taskId || "").trim();
      if(!id) return;
      const t = tasks.find(x => x.id === id)
        || (pendingTaskDraft && String(pendingTaskDraft.id || "") === id ? pendingTaskDraft : null);
      if(!t) return false;

      phaseEditTaskId = id;
      phaseEditMode = (mode === "edit") ? "edit" : "add";
      phaseEditIndex = Number.isFinite(index) ? index : -1;

      if(!phaseEditOverlay) return;
      if(phaseEditOverlay){
        const backContext = (phaseEditOrigin === "calendar" || phaseEditOrigin === "taskModal");
        const inCalendar = phaseEditOrigin === "calendar";
        const inTaskModal = phaseEditOrigin === "taskModal";
        phaseEditOverlay.classList.toggle("isCalendarContext", inCalendar);
        phaseEditOverlay.classList.toggle("isTaskContext", inTaskModal);
        if(inTaskModal && taskOverlay){
          taskOverlay.classList.remove("show");
        }
        if(closePhaseEditBtn){
          closePhaseEditBtn.textContent = backContext ? "Voltar" : "Fechar";
          closePhaseEditBtn.setAttribute("aria-label", backContext ? "Voltar" : "Fechar");
        }
      }

      const obs = Array.isArray(t.obs) ? t.obs : [];
      const hasIndex = phaseEditMode === "edit" && phaseEditIndex >= 0 && phaseEditIndex < obs.length;
      const current = hasIndex ? (obs[phaseEditIndex] || {}) : {};

      // garante que o select de status esteja populado antes de setar o valor
      fillPhaseStatusSelect();

      if(phaseEditTitle){
        phaseEditTitle.textContent = phaseEditMode === "edit"
          ? `Editar fase ${phaseEditIndex + 1}`
          : "Nova fase";
      }

      if(phaseEditText) fillPhaseStatusSelect();
      if(phaseEditText) phaseEditText.value = (current.text || "");
      const lastPhase = (obs && obs.length) ? (obs[obs.length - 1] || {}) : {};
      const lastPedido = ((lastPhase.novoPedido || getEffectivePedidoFromTask(t) || t.pedido || "")).toString().trim();
      const lastRastreio = ((lastPhase.rastreio || getEffectiveRastreioFromTask(t) || t.rastreio || "")).toString().trim();
      const lastAttention = getEffectivePhaseAttention(t);
      const defaultPhaseDate = (phaseEditMode === "add")
        ? ((obs && obs.length)
            ? ((lastPhase.prazo || "").toString().trim() || (t.data || "").toString().trim())
            : ((t.data || "").toString().trim() || todayISO()))
        : "";
      if(phaseEditDate) phaseEditDate.value = (current.date || defaultPhaseDate);
      if(phaseEditNovoPedido) phaseEditNovoPedido.value = (current.novoPedido || (phaseEditMode === "add" ? lastPedido : ""));
      if(phaseEditRastreio) phaseEditRastreio.value = (current.rastreio || (phaseEditMode === "add" ? lastRastreio : ""));
      if(phaseEditSizeFrom) phaseEditSizeFrom.value = (current.sizeFrom || "");
      if(phaseEditSizeTo) phaseEditSizeTo.value = (current.sizeTo || "");
      if(phaseEditChamado) phaseEditChamado.value = (current.chamado || "");
      if(phaseEditEtiqueta) phaseEditEtiqueta.value = (current.etiqueta || "");
      if(phaseEditPrazo) phaseEditPrazo.value = (current.prazo || "");
      if(phaseEditPrazoHora) phaseEditPrazoHora.value = (current.prazoHora || "");
      const attentionValue = (phaseEditMode === "add")
        ? Boolean(lastAttention.has)
        : Boolean(current.attention || current.attentionNote);
      if(phaseEditAttention) phaseEditAttention.checked = attentionValue;
      if(phaseEditAttentionNote) phaseEditAttentionNote.value = (phaseEditMode === "add")
        ? (lastAttention.note || "")
        : (current.attentionNote || "");
      togglePhaseEditAttention();
      const phaseStatusValue = (phaseEditMode === "add")
        ? ((lastPhase.status || getEffectivePhaseStatus(t) || "").toString())
        : (current.status || "");
      if(phaseEditStatus) phaseEditStatus.value = phaseStatusValue.toString();
      togglePhaseSizeFields();

      // delete s\u00f3 no modo edit
      if(phaseEditDeleteBtn){
        phaseEditDeleteBtn.style.display = (phaseEditMode === "edit") ? "inline-flex" : "none";
      }

      phaseEditOverlay.classList.add("show");
      setTimeout(()=>{ if(phaseEditText) phaseEditText.focus(); }, 60);
    }

    function closePhaseEditor(){
      if(!phaseEditOverlay) return;
      phaseEditOverlay.classList.remove("show");
      phaseEditOverlay.classList.remove("isCalendarContext");
      phaseEditOverlay.classList.remove("isTaskContext");
      if(closePhaseEditBtn){
        closePhaseEditBtn.textContent = "Fechar";
        closePhaseEditBtn.setAttribute("aria-label", "Fechar");
      }
      if(phaseEditOrigin === "calendar" && calendarOverlay){
        calendarOverlay.classList.add("show");
      }
      if(phaseEditOrigin === "taskModal" && taskOverlay){
        taskOverlay.classList.add("show");
      }
      phaseEditTaskId = "";
      phaseEditIndex = -1;
      phaseEditMode = "add";
      phaseEditOrigin = "";
    }

    function applyPhaseToTaskData(task, phase, mode, index){
      if(!task) return;
      if(!Array.isArray(task.obs)) task.obs = [];
      if(mode === "edit"){
        if(index < 0 || index >= task.obs.length){
          showAlert("Fase inv\u00e1lida.");
          return;
        }
        phase.state = (task.obs[index]?.state || "").toString();
        task.obs[index] = phase;
      } else {
        const prevIdx = task.obs.length - 1;
        if(prevIdx >= 0 && task.obs[prevIdx]){
          task.obs[prevIdx].state = PHASE_STATE_DONE;
        }
        phase.state = PHASE_STATE_ACTIVE;
        task.obs.push(phase);
      }
      task.proxEtapa = getEffectivePhaseDate(task) || "";
    }

    function abortPendingPhaseSave(){
      if(!pendingPhaseSave) return;
      const origin = pendingPhaseSave.origin;
      const iso = pendingPhaseSave.calIso || calSelectedISO || "";
      pendingPhaseSave = null;
      if(origin === "calendar"){
        if(calendarOverlay && !calendarOverlay.classList.contains("show")){
          openCalendar();
        }
        if(iso) renderCalendarDayDetails(iso, { scrollToFirst:true });
      }
      showAlert("A fase n\u00e3o foi inserida porque o status foi marcado como conclu\u00edda, mas a tarefa n\u00e3o foi encerrada.");
    }

    function savePhaseEditor(){
      const id = (phaseEditTaskId || "").trim();
      if(!id) return false;
      const t = tasks.find(x => x.id === id)
        || (pendingTaskDraft && String(pendingTaskDraft.id || "") === id ? pendingTaskDraft : null);
      const usingDraft = Boolean(pendingTaskDraft && t === pendingTaskDraft);
      if(!t) return false;

      const next = {
        text: ((phaseEditText?.value || "").toString()).trim(),
        date: ((phaseEditDate?.value || "").toString()).trim(),
        prazo: ((phaseEditPrazo?.value || "").toString()).trim(),
        prazoHora: ((phaseEditPrazoHora?.value || "").toString()).trim(),
        chamado: ((phaseEditChamado?.value || "").toString()).trim(),
        etiqueta: ((phaseEditEtiqueta?.value || "").toString()).trim(),
        novoPedido: ((phaseEditNovoPedido?.value || "").toString()).trim(),
        rastreio: ((phaseEditRastreio?.value || "").toString()).trim(),
        sizeFrom: ((phaseEditSizeFrom?.value || "").toString()).trim(),
        sizeTo: ((phaseEditSizeTo?.value || "").toString()).trim(),
        status: ((phaseEditStatus?.value || "").toString()).trim(),
        attention: Boolean(phaseEditAttention && phaseEditAttention.checked),
        attentionNote: Boolean(phaseEditAttention && phaseEditAttention.checked)
          ? ((phaseEditAttentionNote?.value || "").toString()).trim()
          : "",
      };

      const existingPhase = (phaseEditMode === "edit" && Array.isArray(t.obs))
        ? (t.obs[phaseEditIndex] || {})
        : {};
      const phaseAuthorId = (existingPhase.created_by_user_id || currentUser?.id || "").toString();
      const phaseAuthorName = (existingPhase.created_by_username || currentUser?.display_name || currentUser?.username || "").toString().trim();
      if(phaseAuthorId) next.created_by_user_id = phaseAuthorId;
      if(phaseAuthorName) next.created_by_username = phaseAuthorName;

      clearFieldErrors([
        phaseEditText,
        phaseEditDate,
        phaseEditPrazo,
        phaseEditPrazoHora,
        phaseEditStatus,
        phaseEditNovoPedido,
        phaseEditSizeFrom,
        phaseEditSizeTo,
        phaseEditRastreio
      ]);

      let isOk = true;

      const minPhaseText = 5;
      if(phaseEditMode === "add"){
        if(!next.text){
          setFieldError(phaseEditText, "Preencha a descricao.");
          isOk = false;
        }else if(next.text.length < minPhaseText){
          setFieldError(phaseEditText, "Descricao muito curta.");
          isOk = false;
        }
        if(!next.date){
          setFieldError(phaseEditDate, "Preencha a data inicial.");
          isOk = false;
        }
        if(!next.prazo){
          setFieldError(phaseEditPrazo, "Preencha o prazo.");
          isOk = false;
        }
        if(!next.status){
          setFieldError(phaseEditStatus, "Selecione o status.");
          isOk = false;
        }
        if(!next.novoPedido){
          setFieldError(phaseEditNovoPedido, "Preencha o pedido.");
          isOk = false;
        }
        if(!next.rastreio){
          setFieldError(phaseEditRastreio, "Preencha o rastreio.");
          isOk = false;
        }
        if(phaseEditSizeWrap && phaseEditSizeWrap.style.display !== "none"){
          if(!next.sizeFrom){
            setFieldError(phaseEditSizeFrom, "Selecione o tamanho original.");
            isOk = false;
          }
          if(!next.sizeTo){
            setFieldError(phaseEditSizeTo, "Selecione o tamanho da troca.");
            isOk = false;
          }
        }
      }

      if(next.date && !isValidDateInput(next.date)){
        setFieldError(phaseEditDate, "Data invalida.");
        isOk = false;
      }
      if(next.prazo && !isValidDateInput(next.prazo)){
        setFieldError(phaseEditPrazo, "Data invalida.");
        isOk = false;
      }
      if(next.date && next.prazo && isValidDateInput(next.date) && isValidDateInput(next.prazo)){
        const dateRef = new Date(`${next.date}T00:00:00`);
        const prazoRef = new Date(`${next.prazo}T00:00:00`);
        if(prazoRef < dateRef){
          setFieldError(phaseEditPrazo, "Prazo nao pode ser menor que a data inicial.");
          isOk = false;
        }
      }
      if(next.prazoHora && !isValidTimeInput(next.prazoHora)){
        setFieldError(phaseEditPrazoHora, "Horario invalido.");
        isOk = false;
      }
      if(phaseEditMode === "add" || next.novoPedido){
        const pedidoCheck = validatePedido(next.novoPedido);
        if(!pedidoCheck.ok){
          setFieldError(phaseEditNovoPedido, pedidoCheck.message);
          isOk = false;
        }
      }

      if(phaseEditMode !== "add"){
        if(next.text && next.text.length < minPhaseText){
          setFieldError(phaseEditText, "Descricao muito curta.");
          isOk = false;
        }
        const hasAny = Boolean(next.status || next.text || next.date || next.prazo || next.prazoHora || next.chamado || next.etiqueta || next.novoPedido || next.rastreio || next.attention);
        if(!hasAny){
          setFieldError(phaseEditText, "Preencha pelo menos um campo.");
          isOk = false;
        }
      }

      if(!isOk) return false;

      if(!Array.isArray(t.obs)) t.obs = [];

      if(next.status === PHASE_STATE_DONE){
        pendingPhaseSave = {
          taskId: id,
          mode: phaseEditMode,
          index: phaseEditIndex,
          phase: { ...next },
          origin: phaseEditOrigin,
          calIso: calSelectedISO || ""
        };
        closePhaseEditor();
        openCloseTaskModal(id);
        return true;
      }

      applyPhaseToTaskData(t, next, phaseEditMode, phaseEditIndex);
      t.assunto = getEffectivePhaseStatus(t) || "";
      t.updatedAt = new Date().toISOString();

      if(usingDraft){
        tasks = tasks || [];
        tasks.unshift(t);
        saveTasks(tasks);
        upsertCalendarFromTask(t);
        renderTasks();
        pendingTaskDraft = null;
        clearTasksForm();
        closePhaseEditor();
        closeTaskModal();
        return true;
      }

      saveTasks(tasks);
      upsertCalendarFromTask(t);
      renderTasks();
      closePhaseEditor();
      return true;
    }

    async function deletePhaseEditor(){
      const id = (phaseEditTaskId || "").trim();
      if(!id) return;
      const t = tasks.find(x => x.id === id);
      if(!t) return false;
      if(!Array.isArray(t.obs) || !t.obs.length){
        showAlert("N\u00e3o h\u00e1 fases para excluir.");
        return;
      }
      if(phaseEditIndex < 0 || phaseEditIndex >= t.obs.length){
        showAlert("Fase inv\u00e1lida.");
        return;
      }
      const ok = await showConfirm(`Excluir a fase ${phaseEditIndex + 1}?`);
      if(!ok) return;

      t.obs.splice(phaseEditIndex, 1);

      t.proxEtapa = getEffectivePhaseDate(t) || "";
      saveTasks(tasks);
      upsertCalendarFromTask(t);
      renderTasks();
      closePhaseEditor();
    }
    function renderDescBlock(obs, lojaText, taskId){
      const loja = (lojaText || "").trim();
      const phases = Array.isArray(obs)
        ? obs.map((o, idx) => ({
            _idx: idx,
            text: (o?.text || "").toString().trim(),
            date: (o?.date || "").toString().trim(),
            prazo: (o?.prazo || "").toString().trim(),
            prazoHora: (o?.prazoHora || "").toString().trim(),
            chamado: (o?.chamado || "").toString().trim(),
            etiqueta: (o?.etiqueta || "").toString().trim(),
            novoPedido: (o?.novoPedido || "").toString().trim(),
            rastreio: (o?.rastreio || "").toString().trim(),
            sizeFrom: (o?.sizeFrom || "").toString().trim(),
            sizeTo: (o?.sizeTo || "").toString().trim(),
            status: (o?.status || "").toString().trim(),
            attention: Boolean(o?.attention),
            attentionNote: (o?.attentionNote || "").toString().trim(),
            state: (o?.state || "").toString().trim(),
          }))
        : [];

      const cleaned = phases.filter(o => o.text || o.date || o.prazo || o.prazoHora || o.chamado || o.etiqueta || o.novoPedido || o.rastreio || o.sizeFrom || o.sizeTo || o.status || o.attention || o.attentionNote || o.state);
      if(!cleaned.length) return "";

      const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

      const lastIdx = cleaned.length ? cleaned[cleaned.length - 1]._idx : -1;
      const etiquetaUrl = buildNuvemEnvioUrl(loja);
      const renderPhaseItem = (o) => {
        const parts = [];
        if(o.status) parts.push(`Status: <b>${escapeHtml(o.status)}</b>`);
        if(o.date) parts.push(`Data inicial: <b>${escapeHtml(formatDateBR(o.date))}</b>`);
        if(o.prazo) parts.push(`Prazo de resolu&ccedil;&atilde;o: <b>${escapeHtml(formatDateBR(o.prazo))}</b>`);
        if(o.prazoHora) parts.push(`Hor&aacute;rio: <b>${escapeHtml(o.prazoHora)}</b>`);
        if(o.chamado) parts.push(`Chamado Nuvemshop: <b>${escapeHtml(o.chamado)}</b>`);
        if(o.etiqueta){
          const etiquetaLink = `<a href="#" data-copy-etiqueta="${escapeHtml(o.etiqueta)}" data-etiqueta-url="${escapeHtml(etiquetaUrl)}" style="font-weight:600; text-decoration:underline;">${escapeHtml(o.etiqueta)}</a>`;
          const etiquetaCopyBtn = `<button type="button" class="btn small copyBtn" data-copy-etiqueta="${escapeHtml(o.etiqueta)}" data-etiqueta-url="${escapeHtml(etiquetaUrl)}" title="Copiar etiqueta reversa" aria-label="Copiar etiqueta reversa" style="padding:6px 8px; display:inline-flex; align-items:center; justify-content:center; gap:0; line-height:1;">${copyIcon}</button>`;
          parts.push(`Etiqueta Reversa: ${etiquetaLink} ${etiquetaCopyBtn}`);
        }

        if(o.novoPedido){
          const pedidoUrl = getNuvemshopOrderUrl(loja, o.novoPedido);
          const pedidoLink = pedidoUrl
            ? `<a class="pedidoNum" href="${pedidoUrl}" target="_blank" rel="noopener" style="font-weight:600; text-decoration:underline;">${escapeHtml(o.novoPedido)}</a>`
            : `<span class="pedidoNum" style="font-weight:600;">${escapeHtml(o.novoPedido)}</span>`;
          parts.push(
            `Novo pedido: ${pedidoLink} ` +
            `<button type="button" class="btn small copyBtn" data-copy-novopedido="${escapeHtml(o.novoPedido)}" title="Copiar novo pedido" aria-label="Copiar novo pedido" style="padding:6px 8px; display:inline-flex; align-items:center; justify-content:center; gap:0; line-height:1;">${copyIcon}</button>`
          );
        }

        if(o.sizeFrom || o.sizeTo){
          const from = o.sizeFrom || "-";
          const to = o.sizeTo || "-";
          parts.push(`Tamanhos da troca: <b>${escapeHtml(from)}</b> -> <b>${escapeHtml(to)}</b>`);
        }

        if(o.rastreio){
          parts.push(
            `Rastreio: <a href="#" data-track-code="${escapeHtml(o.rastreio)}" style="font-weight:800; text-decoration:underline;">${escapeHtml(o.rastreio)}</a> ` +
            `<button type="button" class="btn small copyBtn" data-copy-phaserastreio="${escapeHtml(o.rastreio)}" title="Copiar rastreio" aria-label="Copiar rastreio" style="padding:6px 8px; display:inline-flex; align-items:center; justify-content:center; gap:0; line-height:1;">${copyIcon}</button>`
          );
        }

        const metaHtml = parts.length
          ? `<div class="note" style="margin:16px 0 10px 0; font-size:13px; display:flex; flex-direction:column; gap:8px;">` +
            parts.map(p => `<div>${p}</div>`).join("") +
            `</div>`
          : "";

        const safeTaskId = (taskId || "").toString();
      const canEdit = !!safeTaskId;
      const phaseBtns = canEdit
        ? `<button type="button" class="btn small iconBtn" data-task-phase-editone="${escapeHtml(safeTaskId)}" data-phase-idx="${escapeHtml(String(o._idx))}" title="Editar" aria-label="Editar">
             <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
               <path d="M12 20h9"></path>
               <path d="M16.5 3.5l4 4L7 21l-4 1 1-4 12.5-14.5z"></path>
             </svg>
           </button>
           <button type="button" class="btn small danger iconBtn" data-task-phase-delone="${escapeHtml(safeTaskId)}" data-phase-idx="${escapeHtml(String(o._idx))}" title="Excluir" aria-label="Excluir">
             <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
               <path d="M3 6h18"></path>
               <path d="M8 6V4h8v2"></path>
               <rect x="6" y="6" width="12" height="14" rx="2"></rect>
               <path d="M10 10v6"></path>
               <path d="M14 10v6"></path>
             </svg>
           </button>`
        : "";

        const textRaw = (o.text || "").toString();
        const textSafe = escapeHtml(textRaw);
        const textWrapped = textSafe.replace(/([^\s]{20})/g, "$1&#8203;");
        const textHtml = textRaw
          ? `<div class="label" style="margin:16px 0 4px 0;">Descri&ccedil;&atilde;o</div><div class="pre" style="white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;">${textWrapped}</div>`
          : "";
        const stateValue = (o.state || "").trim() || (o._idx === lastIdx ? PHASE_STATE_ACTIVE : PHASE_STATE_DONE);
        const isActive = stateValue === PHASE_STATE_ACTIVE;
        const phaseStateHtml = `<div class="phaseState ${isActive ? "isActive" : "isDone"} phaseStateSmall"><span class="phaseDot"></span><span>${escapeHtml(stateValue)}</span></div>`;
        const showToggle = cleaned.length > 1 && o._idx === lastIdx;
        const showAttention = Boolean(o.attention || o.attentionNote);
        const attentionBtn = showAttention
          ? `<button type="button" class="btn small iconBtn attentionBtn" data-task-phase-attn="${escapeHtml(safeTaskId)}" data-phase-idx="${escapeHtml(String(o._idx))}" title="Aten\u00e7\u00e3o" aria-label="Aten\u00e7\u00e3o">
               <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                 <path d="M12 9v4"></path>
                 <circle cx="12" cy="17" r="1"></circle>
                 <path d="M10.3 4.5h3.4l6.3 11.1a2 2 0 0 1-1.7 3H5.7a2 2 0 0 1-1.7-3z"></path>
               </svg>
             </button>`
          : "";
        const summaryBtn = (o._idx === lastIdx)
          ? `<button type="button" class="btn small iconBtn" data-task-summary="${escapeHtml(safeTaskId)}" title="Resumo" aria-label="Resumo">
               <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                 <line x1="6" y1="7" x2="20" y2="7"></line>
                 <line x1="6" y1="12" x2="20" y2="12"></line>
                 <line x1="6" y1="17" x2="20" y2="17"></line>
                 <circle cx="4" cy="7" r="1"></circle>
                 <circle cx="4" cy="12" r="1"></circle>
                 <circle cx="4" cy="17" r="1"></circle>
               </svg>
             </button>`
          : "";
        const calendarBtn = (o._idx === lastIdx)
          ? `<button type="button" class="btn small iconBtn" data-task-phase-calendar="${escapeHtml(safeTaskId)}" data-phase-idx="${escapeHtml(String(o._idx))}" title="Calend¯rio" aria-label="Calend¯rio">
               <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                 <rect x="3" y="4" width="18" height="17" rx="2"></rect>
                 <line x1="16" y1="2" x2="16" y2="6"></line>
                 <line x1="8" y1="2" x2="8" y2="6"></line>
                 <line x1="3" y1="10" x2="21" y2="10"></line>
               </svg>
             </button>`
          : "";
        const toggleBtn = showToggle
          ? `<button type="button" class="btn small iconBtn" data-task-phases-toggle="${escapeHtml(String(taskId || ""))}" title="Ver todas as fases" aria-label="Ver todas as fases">
               <svg class="iconStroke phaseToggleIconOpen" viewBox="0 0 24 24" aria-hidden="true">
                 <circle cx="12" cy="12" r="3"></circle>
                 <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"></path>
               </svg>
               <svg class="iconStroke phaseToggleIconClosed" viewBox="0 0 24 24" aria-hidden="true">
                 <path d="M3 3l18 18"></path>
                 <path d="M10.5 10.5a3 3 0 0 0 3 3"></path>
                 <path d="M9.9 5.1A9.9 9.9 0 0 1 12 5c6 0 10 6 10 6a17.4 17.4 0 0 1-4.3 4.8"></path>
                 <path d="M6.2 6.2A16.4 16.4 0 0 0 2 11s4 6 10 6a9.9 9.9 0 0 0 4.1-.9"></path>
               </svg>
             </button>`
          : "";

        return `
          <div class="phaseItem" data-phase-idx="${escapeHtml(String(o._idx))}">
            <div class="phaseRow">
              <div class="label" style="margin:0;">Fase ${o._idx + 1}</div>
              ${phaseStateHtml}
            </div>
            ${metaHtml}
            ${textHtml}
            ${isActive && textHtml ? `<div class="phaseActionDivider"></div>` : ""}
            <div class="phaseBtnsRow">
              ${attentionBtn}
              ${summaryBtn}
              ${calendarBtn}
              ${toggleBtn}
              ${phaseBtns}
            </div>
          </div>
        `;
      };

      const activePhase = cleaned.find(o => (o.state || "").trim() === PHASE_STATE_ACTIVE);
      const currentPhase = activePhase || cleaned[cleaned.length - 1];
      const currentHtml = renderPhaseItem(currentPhase);
      const allHtml = cleaned.map(renderPhaseItem).join("");
      return `
        <div class="linksBlock phaseBlock" data-task-phases="${escapeHtml(String(taskId || ""))}">
          <div class="phaseList phaseListCurrent">
            ${currentHtml}
          </div>
          <div class="phaseList phaseListAll">
            ${allHtml}
          </div>
        </div>
      `;
    }


    function clearTasksForm(){
      tasksEditId = null;
      pendingTaskDraft = null;
      setTasksModeLabel();

      tData.value = "";
      tCliente.value = "";
      if(tWhatsapp) tWhatsapp.value = "";
      updateWhatsappPreview();
      if(tLoja) tLoja.value = "Todas as Lojas";
      tPedido.value = "";
      if(tAssunto) tAssunto.value = "";
      if(tRastreio) tRastreio.value = "";
      setDescPhasesToUI([]);
      clearFieldErrors([tData, tCliente, tWhatsapp, tLoja, tPedido]);

      if(tFonte && FONTE_OPTIONS.length) tFonte.value = FONTE_OPTIONS[0];
      if(tStatus && STATUS_OPTIONS.length) tStatus.value = STATUS_OPTIONS[0].value;

      if(tProxEtapa) tProxEtapa.value = "";
    }

    function validateTasksForm(){
      clearFieldErrors([tData, tCliente, tWhatsapp, tLoja, tPedido]);
      let ok = true;

      const data = (tData ? (tData.value||"") : "").trim();
      if(!data){
        setFieldError(tData, "Preencha a data inicial.");
        ok = false;
      }else if(!isValidDateInput(data)){
        setFieldError(tData, "Data invalida.");
        ok = false;
      }
      const c = (tCliente.value||"").trim();
      if(!c){
        setFieldError(tCliente, "Preencha o cliente.");
        ok = false;
      }else if(c.length < 3){
        setFieldError(tCliente, "Informe pelo menos 3 caracteres.");
        ok = false;
      }else if(/^[0-9]+$/.test(c) || !/[A-Za-z?-?]/.test(c)){
        setFieldError(tCliente, "Informe um nome valido.");
        ok = false;
      }
      const w = (tWhatsapp ? (tWhatsapp.value||"") : "").trim();
      if(!w){
        setFieldError(tWhatsapp, "Preencha o WhatsApp.");
        ok = false;
      }else{
        const phoneCheck = validateBrazilWhatsapp(w);
        if(!phoneCheck.ok){
          setFieldError(tWhatsapp, phoneCheck.message);
          ok = false;
        }
      }
      const loja = (tLoja ? (tLoja.value||"") : "").trim();
      if(!loja || loja === "Todas as Lojas"){
        setFieldError(tLoja, "Selecione a loja.");
        ok = false;
      }
      const p = (tPedido.value||"") .trim();
      const pedidoCheck = validatePedido(p);
      if(!pedidoCheck.ok){
        setFieldError(tPedido, pedidoCheck.message);
        ok = false;
      }
      return ok;
    }

    function buildTaskPayloadFromForm(options){
      const obs = Array.isArray(options?.obs) ? options.obs : getDescPhasesFromUI();
      const fallbackUserId = String(currentUser?.id || "");
      const fallbackUserName = (currentUser?.display_name || currentUser?.username || "").toString().trim();
      const assuntoFromPhase = getEffectivePhaseStatus({ obs }) || "";
      return {
        id: (options?.id || tasksEditId || uid()),
        data: (tData.value || "").trim(),
        cliente: (tCliente.value || "").trim(),
        whatsapp: normalizeWhatsappNumber(tWhatsapp ? tWhatsapp.value : ""),
        loja: (tLoja ? (tLoja.value || "").trim() : ""),
        pedido: (tPedido.value || "").trim(),
        rastreio: (tRastreio ? (tRastreio.value || "").trim() : ""),
        assunto: assuntoFromPhase,
        fonte: (tFonte ? (tFonte.value || "") : "").trim(),
        status: (tStatus ? (tStatus.value || "") : "").trim(),
        proxEtapa: (tProxEtapa ? (tProxEtapa.value || "") : "").trim(),
        obs: obs,
        created_by_user_id: fallbackUserId,
        created_by_username: fallbackUserName,
        createdAt: "",
        updatedAt: new Date().toISOString(),
      };
    }

    function startTaskPhaseFlow(){
      if(!validateTasksForm()) return;
      if(tasksEditId){
        saveTask();
        return;
      }
      const nowIso = new Date().toISOString();
      const payload = buildTaskPayloadFromForm({ id: uid(), obs: [] });
      payload.createdAt = nowIso;
      payload.updatedAt = nowIso;
      pendingTaskDraft = payload;
      phaseEditOrigin = "taskModal";
      if(taskOverlay) taskOverlay.classList.remove("show");
      openPhaseEditor({ taskId: payload.id, mode:"add", index:-1 });
    }

    function saveTask(){
      if(!validateTasksForm()) return;

      const payload = buildTaskPayloadFromForm({});
      const next = tasks.slice();

      if(!tasksEditId){
        payload.createdAt = new Date().toISOString();
        next.unshift(payload);
      }else{
        const idx = next.findIndex(t => t.id === tasksEditId);
        if(idx >= 0){
          const prev = next[idx];
          payload.createdAt = prev.createdAt || "";
          payload.created_by_user_id = (prev.created_by_user_id || "").toString() || payload.created_by_user_id;
          payload.created_by_username = (prev.created_by_username || "").toString() || payload.created_by_username;
          next[idx] = payload;
        }else{
          payload.createdAt = new Date().toISOString();
          next.unshift(payload);
        }
      }

      // atualiza hist\u00f3rico do calend\u00e1rio com base na Pr\u00f3xima Etapa
      upsertCalendarFromTask(payload);

      saveTasks(next);
      clearTasksForm();
      closeTaskModal();
    }

    function editTask(id){
      const t = tasks.find(x => x.id === id);
      if(!t) return false;

      tasksEditId = id;
      setTasksModeLabel();

      tData.value = t.data || "";
      tCliente.value = t.cliente || "";
      if(tWhatsapp) tWhatsapp.value = t.whatsapp || "";
      updateWhatsappPreview();
      if(tLoja) tLoja.value = t.loja || "Di\u00e1rio Nerdify";
      tPedido.value = t.pedido || "";
      if(tAssunto) tAssunto.value = t.assunto || "";
      if(tFonte) tFonte.value = t.fonte || (FONTE_OPTIONS[0] || "");
      if(tStatus) tStatus.value = t.status || (STATUS_OPTIONS[0]?.value || "");
      if(tProxEtapa) tProxEtapa.value = t.proxEtapa || "";
      if(tRastreio) tRastreio.value = t.rastreio || "";
      setDescPhasesToUI(t.obs);

      scrollToTop();
      openTaskModal();
    }

    async function removeTask(id){
      const t = tasks.find(x => x.id === id);
      if(!t) return false;

      const result = await openPopup({
        title: "Remover tarefa",
            message: "Voc\u00ea quer deletar esta tarefa ou apenas marc\u00e1-la como conclu\u00edda?",
        okLabel: "Excluir tarefa",
        cancelLabel: "Concluir tarefa",
        showCancel: true,
        centerMessage: true,
      });
      if(!result && popupActionSource !== "ok" && popupActionSource !== "cancel") return;

      if(popupActionSource === "cancel"){
        if(t.isExtra){
          await closeExtraTask(id);
        }else{
          closeTaskAsDone(id);
        }
        renderCalendar();
        renderCalendarDayDetails(calSelectedISO);
        return;
      }

      if(t.isExtra){
        calendarHistory = (calendarHistory || []).filter(e => String(e.id || "") !== String(id));
        saveCalendarHistory(calendarHistory);
      }else{
        markCalendarClosed(t);
      }

      const next = tasks.filter(x => x.id !== id);
      saveTasks(next);
      if(tasksEditId === id) clearTasksForm();
    }

    function matchesPeriod(dateStr, period){
      if(!period || period === "ALL") return true;
      const s = (dateStr || "").toString().trim();
      if(!s) return false;
      const d = new Date(`${s}T00:00:00`);
      if(Number.isNaN(d.getTime())) return false;
      const today = new Date(`${todayISO()}T00:00:00`);
      const msInDay = 24 * 60 * 60 * 1000;
      if(period === "TODAY"){
        return d.getTime() === today.getTime();
      }
      if(period === "NEXT7"){
        const max = new Date(today.getTime() + 7 * msInDay);
        return d >= today && d <= max;
      }
      if(period === "NEXT30"){
        const max = new Date(today.getTime() + 30 * msInDay);
        return d >= today && d <= max;
      }
      if(period === "MONTH"){
        return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
      }
      if(period === "CUSTOM"){
        const from = (tasksSearchPeriodFromValue || "").trim();
        const to = (tasksSearchPeriodToValue || "").trim();
        if(!from && !to) return true;
        const fromDate = from ? new Date(`${from}T00:00:00`) : null;
        const toDate = to ? new Date(`${to}T00:00:00`) : null;
        if(fromDate && Number.isNaN(fromDate.getTime())) return false;
        if(toDate && Number.isNaN(toDate.getTime())) return false;
        if(fromDate && d < fromDate) return false;
        if(toDate && d > toDate) return false;
        return true;
      }
      return true;
    }

    function getTasksPeriodLabel(){
      const period = (tasksSearchPeriodValue || "").trim() || "ALL";
      if(period === "ALL") return "Per\u00edodo: Todos";
      if(period === "TODAY") return "Per\u00edodo: Hoje";
      if(period === "NEXT7") return "Per\u00edodo: Pr\u00f3ximos 7 dias";
      if(period === "NEXT30") return "Per\u00edodo: Pr\u00f3ximos 30 dias";
      if(period === "MONTH") return "Per\u00edodo: Este m\u00eas";
      if(period === "CUSTOM"){
        const from = (tasksSearchPeriodFromValue || "").trim();
        const to = (tasksSearchPeriodToValue || "").trim();
        const fromLabel = from ? formatDateBR(from) : "";
        const toLabel = to ? formatDateBR(to) : "";
        if(fromLabel && toLabel) return `Per\u00edodo: ${fromLabel} \u2192 ${toLabel}`;
        if(fromLabel) return `Per\u00edodo: A partir de ${fromLabel}`;
        if(toLabel) return `Per\u00edodo: At\u00e9 ${toLabel}`;
        return "Per\u00edodo: Personalizado";
      }
      return "Per\u00edodo: -";
    }

    function isTaskVisibleToCurrentUser(t){
      if(!isSecondaryUser()) return true;
      const createdId = (t?.created_by_user_id || "").toString();
      return createdId !== "" && createdId === String(currentUser?.id || "");
    }

    function getVisibleTasksList(list){
      const base = Array.isArray(list) ? list : [];
      if(!isSecondaryUser()) return base.slice();
      return base.filter(isTaskVisibleToCurrentUser);
    }

    function getVisibleCalendarHistoryList(list){
      const base = Array.isArray(list) ? list : [];
      if(!isSecondaryUser()) return base.slice();
      return base.filter(entry => {
        const createdId = (entry?.created_by_user_id || "").toString();
        return createdId !== "" && createdId === String(currentUser?.id || "");
      });
    }

    function getFilteredTasks(){
      const q = (tasksSearchQuery || "").trim().toLowerCase();
      const storeFilter = (tasksSearchStoreValue || "").trim();
      const periodFilter = (tasksSearchPeriodValue || "").trim();
      const statusFilter = (tasksSearchStatusValue || "").trim();
      const typeFilter = (tasksTypeFilter || "normal").trim().toLowerCase();
      return getVisibleTasksList(tasks).filter(t => {
        const isExtraTask = Boolean(t.isExtra || t.extra);
        if(typeFilter === "extra" && !isExtraTask) return false;
        if(typeFilter !== "extra" && isExtraTask) return false;
        if(storeFilter && storeFilter !== "ALL"){
          const loja = (t.loja || "").toString().trim();
          if(loja !== storeFilter) return false;
        }
        if(isDailyRepeatTask(t)) return true;
        if(statusFilter){
          const st = (getEffectivePhaseStatus(t) || "").toString().trim();
          if(!st || st !== statusFilter) return false;
        }
        if(periodFilter && periodFilter !== "ALL"){
          const effDate = (getTaskDisplayDate(t) || "").toString().trim();
          if(!matchesPeriod(effDate, periodFilter)) return false;
        }
        if(!q) return true;
        const cliente = (t.cliente || "").toString().toLowerCase();
        const pedidoBase = (t.pedido || "").toString().toLowerCase();
        const pedidoEfetivo = getEffectivePedidoFromTask(t).toLowerCase();
        const assunto = (t.assunto || "").toString().toLowerCase();
        return cliente.includes(q) || pedidoBase.includes(q) || pedidoEfetivo.includes(q) || assunto.includes(q);
      }).sort((a,b) => {
        const overA = isTaskOverdue(a);
        const overB = isTaskOverdue(b);
        if(overA != overB) return overA ? -1 : 1;
        const ta = getTaskSortTimestamp(a);
        const tb = getTaskSortTimestamp(b);
        if(ta != tb) return ta - tb;
        const aa = (a.assunto || "").toString();
        const bb = (b.assunto || "").toString();
        return aa.localeCompare(bb);
      });
    }

    function updateTaskCountBadges(){
      const list = getVisibleTasksList(tasks);
      const normalCount = list.filter(t => !t.isExtra).length;
      const extraCount = list.filter(t => t.isExtra).length;
      const isCollapsed = document.body.classList.contains("sideMenuCollapsed");
      if(tasksCountBadge){
        tasksCountBadge.textContent = String(normalCount);
        tasksCountBadge.style.display = isCollapsed ? "none" : "inline-flex";
      }
      if(tasksExtraCountBadge){
        tasksExtraCountBadge.textContent = String(extraCount);
        tasksExtraCountBadge.style.display = isCollapsed ? "none" : "inline-flex";
      }
    }

    function renderTasks(){
      if(currentView !== "tasks") return;

      updateTaskCountBadges();
      syncOverdueCalendarEntries();
      const filtered = getFilteredTasks();

      tasksCount.textContent = `${filtered.length} item(ns)`;
      if(tasksPeriodLabel){
        const label = getTasksPeriodLabel();
        tasksPeriodLabel.textContent = label;
        tasksPeriodLabel.style.display = label ? "block" : "none";
      }

      if(!filtered.length){
        tasksList.innerHTML = `<div class="note">Nenhuma tarefa encontrada.</div>`;
        if(tasksNextBtn) tasksNextBtn.style.display = "none";
        if(tasksAllBtn) tasksAllBtn.style.display = "none";
        if(tasksSingleBtn) tasksSingleBtn.style.display = "none";
        renderMiniCalendar();
        return;
      }

      // garante \u00cdndice v\u00e1lido
      if(tasksSingleIndex < 0) tasksSingleIndex = 0;
      if(tasksSingleIndex >= filtered.length) tasksSingleIndex = 0;

      const show = tasksShowAll ? filtered : [filtered[tasksSingleIndex]];
      if(tasksShowAll){
        if(tasksNextBtn) tasksNextBtn.style.display = "none";
        if(tasksAllBtn) tasksAllBtn.style.display = "none";
        if(tasksSingleBtn) tasksSingleBtn.style.display = "inline-flex";
      }else{
        if(tasksNextBtn) tasksNextBtn.style.display = "inline-flex";
        if(tasksAllBtn) tasksAllBtn.style.display = "inline-flex";
        if(tasksSingleBtn) tasksSingleBtn.style.display = "none";
      }
      const today = todayISO();
      const repeatIconSvg = `<svg class="iconStroke" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.3-6.3"></path><polyline points="21 3 21 9 15 9"></polyline><path d="M21 12a9 9 0 0 1-15.3 6.3"></path><polyline points="3 21 3 15 9 15"></polyline></svg>`;

      tasksList.innerHTML = show.map(t => {
        const isExtra = Boolean(t.isExtra);
        const repeatLabel = (t.repeat || "").toString().trim();
        const hasDailyRepeat = isDailyRepeatTask(t);
        const hasExtraRepeat = isExtra && repeatLabel && !isNoRepeatLabel(repeatLabel);
        const showRepeatIcon = isExtra;
        const effDate = getTaskDisplayDate(t) || (t.proxEtapa || "").trim();
        const isOverdue = isTaskOverdue(t);
        const dueToday = (effDate && effDate === today);
        const colors = statusColors(t.status);

        const statusStyle = `background: linear-gradient(90deg, ${colors.a}, ${colors.b});`;
        const fonteText = (t.fonte || "-");
        const statusText = (t.status || "-");
        const startTime = (t.startTime || "").toString().trim();
        const endTime = (t.endTime || "").toString().trim();
        const timeLabel = (startTime || endTime) ? `${startTime || "--:--"} - ${endTime || "--:--"}` : "-";
        const prox = isExtra ? timeLabel : formatDateBR(effDate);
        const data = formatDateBR(t.data || "");

        const lojaTextRaw = (t.loja || "").toString().trim();
        const lojaText = isExtra ? lojaTextRaw : (lojaTextRaw || "Di\u00e1rio Nerdify");
        const lojaLogoUrl = lojaText
          ? (lojaText.toLowerCase().includes("shop 80")
            ? DEFAULT_SHOP80_LOGO
            : DEFAULT_DIARIO_LOGO)
          : "";
        const pedidoEfetivo = (getEffectivePedidoFromTask(t) || "").trim();
        const assuntoRaw = (t.assunto || "").trim();

        const statusTitle = getEffectivePhaseStatus(t) || assuntoRaw;
        const title = isExtra ? (assuntoRaw || "Tarefa extra") : (statusTitle || "Caso");
        const pedidoUrl = getNuvemshopOrderUrl(lojaText, pedidoEfetivo);

        const pedidoNumHtml = pedidoEfetivo
          ? (pedidoUrl
            ? `<a class="pedidoNum" href="${pedidoUrl}" target="_blank" rel="noopener" style="font-weight:600; text-decoration:underline;">${escapeHtml(pedidoEfetivo)}</a>`
            : `<span class="pedidoNum" style="font-weight:600;">${escapeHtml(pedidoEfetivo)}</span>`)
          : "";

        const pedidoHtml = pedidoEfetivo
          ? `Pedido: ${pedidoNumHtml} <button type="button" class="btn small copyBtn" data-copy-pedido="${escapeHtml(pedidoEfetivo)}" title="Copiar n\u00famero do pedido" aria-label="Copiar n\u00famero do pedido" style="padding:6px 8px; display:inline-flex; align-items:center; justify-content:center; gap:0; line-height:1;">` +
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
            `<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>` +
            `<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>` +
            `</svg></button>`
          : "";

        const clienteRaw = (t.cliente || "").trim();
        const clienteHtml = clienteRaw
          ? `Cliente: <span class="pedidoNum" style="font-weight:600;">${escapeHtml(clienteRaw)}</span> <button type="button" class="btn small copyBtn" data-copy-cliente="${escapeHtml(clienteRaw)}" title="Copiar nome do cliente" aria-label="Copiar nome do cliente" style="padding:6px 8px; display:inline-flex; align-items:center; justify-content:center; gap:0; line-height:1;">` +
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
            `<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>` +
            `<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>` +
            `</svg></button>`
          : "";

        const extraText = (t.extraText || "").toString().trim();
        const subtitleParts = isExtra ? [] : [pedidoHtml, clienteHtml].filter(Boolean);
        const subtitleHtml = isExtra
          ? (extraText ? `<div class="taskSubLine">${escapeHtml(extraText)}</div>` : `<div class="taskSubLine">-</div>`)
          : (subtitleParts.length
            ? subtitleParts.map((line)=> `<div class="taskSubLine">${line}</div>`).join("")
            : `<div class="taskSubLine">-</div>`);
        const logoHtml = lojaLogoUrl
          ? `<img src="${escapeHtml(lojaLogoUrl)}" alt="${escapeHtml(lojaText)}" style="height:22px; width:auto; display:block;" />`
          : "";

        const rastEfetivo = (getEffectiveRastreioFromTask(t) || "").trim();
        const repeatTitle = repeatLabel ? `Repeti\u00e7\u00e3o: ${repeatLabel}` : "Definir repeti\u00e7\u00e3o";
        const authorLabel = (t.created_by_username || "").toString().trim();
        const closedByLabel = (t.closed_by_username || "").toString().trim();
        const showAuthor = Boolean(authorLabel);
        const showClosedBy = Boolean(closedByLabel);

        return `
          <div class="taskCard ${dueToday ? "taskDueToday" : ""} ${isOverdue ? "taskOverdue" : ""} ${isExtra ? "taskExtra" : ""}" data-task-id="${escapeHtml(t.id)}">
            <div class="taskTopRow">
              <div class="taskMainInfo">
                <div class="taskTitleRow">
                  <p class="taskTitle ${isExtra ? "extraTitle" : ""}">${escapeHtml(title)}</p>
                </div>
                <div class="note taskSubMeta" style="margin-top:6px;">${subtitleHtml}</div>
              </div>
              ${logoHtml ? `<div class="taskLogoWrap">${logoHtml}</div>` : ""}
            </div>

            <div class="taskMeta">
              ${lojaText ? `<span class="pillMini">Loja: ${escapeHtml(lojaText)}</span>` : ""}
              <span class="pillMini">${isExtra ? "Hor\u00e1rio" : "Pr\u00f3xima Etapa"}: <b>${escapeHtml(prox)}</b></span>
              <span class="pillMini">Data inicial: <b>${escapeHtml(data)}</b></span>
              ${showAuthor ? `<span class="pillMini">Usu\u00e1rio: <b>${escapeHtml(authorLabel)}</b></span>` : ""}
            </div>

            <div class="taskActions">
              ${isExtra ? `<button class="btn small iconBtn" data-task-extra-calendar="${escapeHtml(t.id)}" title="Ver no calend\u00e1rio" aria-label="Ver no calend\u00e1rio">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"></path>
                </svg>
              </button>
              ${showRepeatIcon ? `<button class="btn small iconBtn" data-task-repeat-id="${escapeHtml(t.id)}" data-task-repeat="${escapeHtml(repeatLabel)}" title="${escapeHtml(repeatTitle)}" aria-label="${escapeHtml(repeatTitle)}">
                <svg class="iconStroke" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 0 1 15.3-6.3"></path>
                  <polyline points="21 3 21 9 15 9"></polyline>
                  <path d="M21 12a9 9 0 0 1-15.3 6.3"></path>
                  <polyline points="3 21 3 15 9 15"></polyline>
                </svg>
              </button>` : ""}` : `<button class="btn small iconBtn" data-task-phase-add="${escapeHtml(t.id)}" title="Nova fase" aria-label="Nova fase">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>`}
              <button class="btn small iconBtn" data-task-close="${escapeHtml(t.id)}" title="Concluir tarefa" aria-label="Concluir tarefa">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <polyline points="5 13 9 17 19 7"></polyline>
                </svg>
              </button>
              ${isExtra ? "" : `<button class="btn small iconBtn" type="button" data-support-store="${escapeHtml(lojaText)}" title="Suporte Nuvemshop" aria-label="Suporte Nuvemshop">
                <svg class="nuvemIcon" viewBox="0 0 48 48" aria-hidden="true">
                  <circle class="nuvemLeft" cx="17.5" cy="26.5" r="9.5"></circle>
                  <circle class="nuvemRight" cx="30.5" cy="22.5" r="12.5"></circle>
                </svg>
              </button>`}
              ${(!isExtra && buildCustomerWhatsappUrl(t.whatsapp||"")) ? `<button class="btn small iconBtn" type="button" data-customer-whatsapp="${escapeHtml(t.whatsapp || "")}" title="WhatsApp Cliente" aria-label="WhatsApp Cliente">
                <svg class="sakIcon" viewBox="0 0 48 48" aria-hidden="true">
                  <path class="sakFill" d="M24 4C13.5 4 5 10.8 5 19.2c0 5.1 3.1 9.5 7.9 12-0.2 1.9-0.8 4.4-2.7 7 3.3-0.4 5.8-1.4 7.8-2.3 1.8 0.4 3.8 0.7 5.9 0.7 10.5 0 19-6.8 19-15.2S34.5 4 24 4z"></path>
                </svg>
              </button>` : ``}
              <button class="btn small iconBtn" data-task-edit="${escapeHtml(t.id)}" title="Editar" aria-label="Editar">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5l4 4L7 21l-4 1 1-4 12.5-14.5z"></path>
                </svg>
              </button>
              <button class="btn small danger iconBtn" data-task-del="${escapeHtml(t.id)}" title="Remover" aria-label="Remover">
                <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6h18"></path>
                  <path d="M8 6V4h8v2"></path>
                  <rect x="6" y="6" width="12" height="14" rx="2"></rect>
                  <path d="M10 10v6"></path>
                  <path d="M14 10v6"></path>
                </svg>
              </button>
            </div>

            ${renderDescBlock(t.obs, lojaText, t.id)}
          </div>
        `;
      }).join("");

      tasksList.querySelectorAll("[data-task-edit]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const id = (btn.getAttribute("data-task-edit") || "").trim();
          if(!id) return;
          const ref = (tasks || []).find(t => String(t.id || "") === id);
          if(ref && ref.isExtra){
            const entry = {
              id,
              date: (ref.data || ref.proxEtapa || "").toString().trim(),
              assunto: (ref.assunto || "").toString().trim(),
              extraText: (ref.extraText || "").toString().trim(),
              startTime: (ref.startTime || "").toString().trim(),
              endTime: (ref.endTime || "").toString().trim(),
              repeat: (ref.repeat || "").toString().trim(),
            };
            openSimpleTaskModal(entry.date || todayISO(), entry);
            return;
          }
          editTask(id);
        });
      });
      tasksList.querySelectorAll("[data-task-del]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const id = btn.getAttribute("data-task-del");
          removeTask(id);
        });
      });
      // copiar numero do pedido (icone no card)
      tasksList.querySelectorAll("[data-copy-pedido]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const pedido = (btn.getAttribute("data-copy-pedido") || "").trim();
          if(!pedido) return;
          navigator.clipboard.writeText(pedido).then(()=>{
            btn.style.opacity = "0.6";
            setTimeout(()=>{ btn.style.opacity = "1"; }, 450);
          }).catch(()=> showAlert("N\u00e3o foi poss\u00edvel copiar."));
        });
      });

      // copiar nome do cliente
      tasksList.querySelectorAll("[data-copy-cliente]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const v = (btn.getAttribute("data-copy-cliente") || "").trim();
          if(!v) return;
          navigator.clipboard.writeText(v).then(()=>{
            btn.style.opacity = "0.6";
            setTimeout(()=>{ btn.style.opacity = "1"; }, 450);
          }).catch(()=> showAlert("N\u00e3o foi poss\u00edvel copiar."));
        });
      });

      // copiar rastreio (no card)
      tasksList.querySelectorAll("[data-copy-rastreio]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const v = (btn.getAttribute("data-copy-rastreio") || "").trim();
          if(!v) return;
          navigator.clipboard.writeText(v).then(()=>{
            btn.style.opacity = "0.6";
            setTimeout(()=>{ btn.style.opacity = "1"; }, 450);
          }).catch(()=> showAlert("N\u00e3o foi poss\u00edvel copiar."));
        });
      });

      // rastreio clic\u00e1vel (abre conforme regra)
      tasksList.querySelectorAll("[data-track-code]").forEach(a=>{
        a.addEventListener("click", (ev)=>{
          ev.preventDefault();
          const code = (a.getAttribute("data-track-code") || "").trim();
          handleTrackingButton(code);
        });
      });

      // copiar dados de fases (novo pedido / rastreio)
      tasksList.querySelectorAll("[data-copy-novopedido]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const v = (btn.getAttribute("data-copy-novopedido") || "").trim();
          if(!v) return;
          navigator.clipboard.writeText(v).then(()=>{
            btn.style.opacity = "0.6";
            setTimeout(()=>{ btn.style.opacity = "1"; }, 450);
          }).catch(()=> showAlert("N\u00e3o foi poss\u00edvel copiar."));
        });
      });
      tasksList.querySelectorAll("[data-copy-phaserastreio]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const v = (btn.getAttribute("data-copy-phaserastreio") || "").trim();
          if(!v) return;
          navigator.clipboard.writeText(v).then(()=>{
            btn.style.opacity = "0.6";
            setTimeout(()=>{ btn.style.opacity = "1"; }, 450);
          }).catch(()=> showAlert("N\u00e3o foi poss\u00edvel copiar."));
        });
      });
      tasksList.querySelectorAll("[data-copy-etiqueta]").forEach(el=>{
        el.addEventListener("click", (e)=>{
          e.preventDefault();
          const v = (el.getAttribute("data-copy-etiqueta") || "").trim();
          const url = (el.getAttribute("data-etiqueta-url") || "").trim();
          const openUrl = ()=>{
            if(url) window.open(url, "_blank", "noopener");
          };
          if(!v){
            openUrl();
            return;
          }
          navigator.clipboard.writeText(v).then(()=>{
            el.style.opacity = "0.6";
            setTimeout(()=>{ el.style.opacity = "1"; }, 450);
            openUrl();
          }).catch(()=>{
            showAlert("NÊo foi poss¦vel copiar.");
            openUrl();
          });
        });
      });
      // adicionar / editar fases direto pelo card
      tasksList.querySelectorAll("[data-task-phase-add]").forEach(btn=>{
        btn.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation();
          const id = (btn.getAttribute("data-task-phase-add") || "").trim();
          phaseEditOrigin = "tasks";
          addPhaseFromCard(id);
        });
      });
      tasksList.querySelectorAll("[data-task-phases-toggle]").forEach(btn=>{
        btn.addEventListener("click", (e)=>{
          e.preventDefault();
          const wrap = btn.closest(".linksBlock");
          if(!wrap) return;
          const expanded = wrap.classList.toggle("isExpanded");
          const label = expanded ? "Ocultar fases" : "Ver todas as fases";
          btn.setAttribute("title", label);
          btn.setAttribute("aria-label", label);
        });
      });
      tasksList.querySelectorAll("[data-task-summary]").forEach(btn=>{
        btn.addEventListener("click", (e)=>{
          e.preventDefault();
          e.stopPropagation();
          const id = (btn.getAttribute("data-task-summary") || "").toString().trim();
          if(!id) return;
          const ref = (tasks || []).find(t => String(t.id || "") === id);
          if(!ref){
            showAlert("Tarefa nuo encontrada.");
            return;
          }
          openTaskSummaryPopup(ref);
        });
      });
      tasksList.querySelectorAll("[data-task-phase-calendar]").forEach(btn=>{
        btn.addEventListener("click", (e)=>{
          e.preventDefault();
          e.stopPropagation();
          const id = (btn.getAttribute("data-task-phase-calendar") || "").toString().trim();
          const idxRaw = (btn.getAttribute("data-phase-idx") || "-1").toString();
          const phaseIdx = Number.parseInt(idxRaw, 10);
          if(!id) return;
          const ref = (tasks || []).find(t => String(t.id || "") === id);
          if(!ref){
            showAlert("Tarefa nÃoo encontrada.");
            return;
          }
          const date = getPhaseDateByIndex(ref, phaseIdx) || getEffectivePhaseDate(ref);
          if(!date){
            showAlert("Esta fase nÃoo possui data.");
            return;
          }
          const parts = date.split("-");
          if(parts.length === 3){
            const y = Number(parts[0]);
            const m = Number(parts[1]) - 1;
            if(Number.isFinite(y) && Number.isFinite(m)){
              calViewYear = y;
              calViewMonth = m;
            }
          }
          calSelectedISO = date;
          openCalendar();
          renderCalendarDayDetails(date);
          requestAnimationFrame(()=>{
            if(!calDayDetails) return;
            const row = calDayDetails.querySelector(`[data-cal-item-id="${CSS.escape(id)}"]`);
            if(!row) return;
            row.classList.add("isFocus");
            row.scrollIntoView({ behavior:"smooth", block:"center" });
            setTimeout(()=> row.classList.remove("isFocus"), 1400);
          });
        });
      });
      tasksList.querySelectorAll("[data-task-phase-attn]").forEach(btn=>{
        btn.addEventListener("click", (e)=>{
          e.preventDefault();
          e.stopPropagation();
          const id = (btn.getAttribute("data-task-phase-attn") || "").toString().trim();
          const idx = parseInt((btn.getAttribute("data-phase-idx") || "-1"), 10);
          if(!id) return;
          if(!Number.isFinite(idx) || idx < 0) return;
          const ref = (tasks || []).find(t => String(t.id || "") === id);
          if(!ref){
            showAlert("Tarefa nuo encontrada.");
            return;
          }
          const info = getPhaseAttentionByIndex(ref, idx);
          if(!info.has){
            openAttentionPopup("");
            return;
          }
          openAttentionPopup(info.note);
        });
      });
      tasksList.querySelectorAll("[data-task-extra-calendar]").forEach(btn=>{
        btn.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation();
          const id = (btn.getAttribute("data-task-extra-calendar") || "").trim();
          openExtraTaskInCalendar(id);
        });
      });
      tasksList.querySelectorAll("[data-task-close]").forEach(btn=>{
        btn.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation();
          const id = (btn.getAttribute("data-task-close") || "").trim();
          if(!id) return;
          const ref = (tasks || []).find(t => String(t.id || "") === id);
          if(ref && ref.isExtra){
            closeExtraTask(id);
            return;
          }
          openCloseTaskModal(id);
        });
      });
      if(tasksList && tasksList.dataset.supportBound !== "1"){
        tasksList.addEventListener("click", (e)=>{
          const btn = e.target.closest("[data-support-store]");
          if(!btn) return;
          e.preventDefault();
          e.stopPropagation();
          const storeName = (btn.getAttribute("data-support-store") || "").toString().trim();
          const card = btn.closest(".taskCard");
          const taskId = card ? (card.getAttribute("data-task-id") || "").trim() : "";
          openNuvemshopSupportPopup(storeName, taskId);
        });
        tasksList.dataset.supportBound = "1";
      }

      // editar/excluir fase espec\u00edfica (bot\u00f5es dentro de cada fase)
      tasksList.querySelectorAll("[data-task-phase-editone]").forEach(btn=>{
        btn.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation();
          const id = (btn.getAttribute("data-task-phase-editone") || "").trim();
          const idx = parseInt((btn.getAttribute("data-phase-idx") || "-1"), 10);
          if(!id) return;
          if(!Number.isFinite(idx) || idx < 0) return;
          phaseEditOrigin = "tasks";
          openPhaseEditor({ taskId:id, mode:"edit", index:idx });
        });
      });
      tasksList.querySelectorAll("[data-task-phase-delone]").forEach(btn=>{
        btn.addEventListener("click", async (e)=>{ e.preventDefault(); e.stopPropagation();
          const id = (btn.getAttribute("data-task-phase-delone") || "").trim();
          const idx = parseInt((btn.getAttribute("data-phase-idx") || "-1"), 10);
          if(!id) return;
          if(!Number.isFinite(idx) || idx < 0) return;
          const t = tasks.find(x => x.id === id);
      if(!t) return false;
          if(!Array.isArray(t.obs) || !t.obs.length){
            showAlert("N\u00e3o h\u00e1 fases para excluir.");
            return;
          }
          if(idx >= t.obs.length){
            showAlert("Fase inv\u00e1lida.");
            return;
          }
          const ok = await showConfirm(`Excluir a fase ${idx + 1}?`);
          if(!ok) return;
          t.obs.splice(idx, 1);
          t.proxEtapa = getEffectivePhaseDate(t) || "";
          saveTasks(tasks);
          upsertCalendarFromTask(t);
          renderTasks();
        });
      });
      tasksList.querySelectorAll("[data-task-repeat]").forEach(btn=>{
        btn.addEventListener("click", (e)=>{
          e.preventDefault();
          e.stopPropagation();
          const label = (btn.getAttribute("data-task-repeat") || "").toString().trim();
          if(label && !isNoRepeatLabel(label)){
            showAlert(`Repeti\u00e7\u00e3o: ${label}`);
            return;
          }
          const id = (btn.getAttribute("data-task-repeat-id") || "").toString().trim();
          if(!id) return;
          const ref = (tasks || []).find(t => String(t.id || "") === id);
          if(!ref || !ref.isExtra) return;
          const entry = {
            id,
            date: (ref.data || ref.proxEtapa || "").toString().trim(),
            assunto: (ref.assunto || "").toString().trim(),
            extraText: (ref.extraText || "").toString().trim(),
            loja: (ref.loja || "").toString().trim(),
            startTime: (ref.startTime || "").toString().trim(),
            endTime: (ref.endTime || "").toString().trim(),
            repeat: (ref.repeat || "").toString().trim(),
            repeatWeekday: ref.repeatWeekday,
            repeatOrdinal: ref.repeatOrdinal,
            repeatEvery: ref.repeatEvery,
            repeatUnit: (ref.repeatUnit || "").toString().trim(),
            repeatWeekdays: Array.isArray(ref.repeatWeekdays) ? ref.repeatWeekdays.slice() : [],
            repeatMonthlyMode: (ref.repeatMonthlyMode || "").toString().trim(),
            repeatUntil: (ref.repeatUntil || "").toString().trim(),
            repeatCount: ref.repeatCount,
            repeatExclusions: Array.isArray(ref.repeatExclusions) ? ref.repeatExclusions.slice() : []
          };
          openSimpleTaskModal(entry.date || todayISO(), entry);
        });
      });
      renderMiniCalendar();
    }

    function renderDoneTasks(){
      if(currentView !== "done") return;
      if(!doneTasksList || !doneTasksCount) return;

      let list = getVisibleTasksList(tasksDone);
      list.sort((a, b) => {
        const ta = new Date(a.closedAt || a.updatedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.closedAt || b.updatedAt || b.createdAt || 0).getTime();
        return tb - ta;
      });

      const q = (doneSearchQuery || "").trim().toLowerCase();
      const storeFilter = (doneSearchStoreValue || "").trim();
      const periodFilter = (doneSearchPeriodValue || "").trim();
      const statusFilter = (doneSearchStatusValue || "").trim();
      list = list.filter(t => {
        const isExtra = Boolean(t.isExtra);
        let loja = (t.loja || "").toString().trim();
        if(!loja && !isExtra) loja = "Di\u00e1rio Nerdify";
        if(storeFilter && storeFilter !== "ALL" && loja !== storeFilter) return false;
        if(statusFilter){
          const st = (getEffectivePhaseStatus(t) || "").toString().trim();
          if(!st || st !== statusFilter) return false;
        }
        if(periodFilter && periodFilter !== "ALL"){
          const effDate = (getEffectivePhaseDate(t) || (t.proxEtapa || "")).toString().trim();
          if(!matchesPeriod(effDate, periodFilter)) return false;
        }
        if(!q) return true;
        const cliente = (t.cliente || "").toString().toLowerCase();
        const pedidoBase = (t.pedido || "").toString().toLowerCase();
        const pedidoEfetivo = (getEffectivePedidoFromTask(t) || "").toString().toLowerCase();
        const assunto = (t.assunto || t.extraText || "").toString().toLowerCase();
        return cliente.includes(q) || pedidoBase.includes(q) || pedidoEfetivo.includes(q) || assunto.includes(q);
      });

      doneTasksCount.textContent = `${list.length} item(ns)`;

      if(!list.length){
        doneTasksList.innerHTML = `<div class="note">Nenhuma tarefa encerrada.</div>`;
        return;
      }

      doneTasksList.innerHTML = list.map(t => {
        const isExtra = Boolean(t.isExtra);
        const title = (t.assunto || "").trim() || (isExtra ? "Tarefa extra" : "Caso");
        const lojaRaw = (t.loja || "").toString().trim();
        const lojaText = isExtra ? lojaRaw : (lojaRaw || "Di\u00e1rio Nerdify");
        const effDate = getEffectivePhaseDate(t) || (t.proxEtapa || "").trim();
        const startTime = (t.startTime || "").toString().trim();
        const endTime = (t.endTime || "").toString().trim();
        const timeLabel = (startTime || endTime) ? `${startTime || "--:--"} - ${endTime || "--:--"}` : "-";
        const prox = isExtra ? timeLabel : formatDateBR(effDate);
        const data = formatDateBR(t.data || "");
        const closedAt = formatDateTimeBR(t.closedAt || t.updatedAt || t.createdAt || "");
        const authorLabel = (t.created_by_username || "").toString().trim();
        const closedByLabel = (t.closed_by_username || "").toString().trim();
        const showAuthor = Boolean(authorLabel);
        const showClosedBy = Boolean(closedByLabel);

        const extraText = (t.extraText || "").toString().trim();
        const pedidoEfetivo = (getEffectivePedidoFromTask(t) || "").trim();
        const cliente = (t.cliente || "").toString().trim();

        const copyIconSmall = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        const trashIcon = `<svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><rect x="6" y="6" width="12" height="14" rx="2"></rect><path d="M10 10v6"></path><path d="M14 10v6"></path></svg>`;
        const summaryBtn = (!isExtra && Array.isArray(t.obs) && t.obs.length)
          ? `<button type="button" class="btn small iconBtn" data-done-summary="${escapeHtml(String(t.id || ""))}" title="Resumo" aria-label="Resumo" style="padding:4px 6px; display:inline-flex; align-items:center; justify-content:center; line-height:1;">
               <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                 <line x1="6" y1="7" x2="20" y2="7"></line>
                 <line x1="6" y1="12" x2="20" y2="12"></line>
                 <line x1="6" y1="17" x2="20" y2="17"></line>
                 <circle cx="4" cy="7" r="1"></circle>
                 <circle cx="4" cy="12" r="1"></circle>
                 <circle cx="4" cy="17" r="1"></circle>
               </svg>
             </button>`
          : "";
        const reactivateBtn = `<button type="button" class="btn small iconBtn" data-done-reactivate="${escapeHtml(String(t.id || ""))}" title="Reativar tarefa" aria-label="Reativar tarefa" style="padding:4px 6px; display:inline-flex; align-items:center; justify-content:center; line-height:1;">
               <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                 <path d="M3 12a9 9 0 0 1 9-9"></path>
                 <polyline points="3 4 3 12 11 12"></polyline>
                 <path d="M21 12a9 9 0 0 1-9 9"></path>
                 <polyline points="21 20 21 12 13 12"></polyline>
               </svg>
             </button>`;

        const detailItems = [];
        if(isExtra && extraText) detailItems.push(escapeHtml(extraText));
        if(!isExtra && pedidoEfetivo) detailItems.push(`Pedido: <span style="font-weight:600;">${escapeHtml(pedidoEfetivo)}</span> <button type="button" class="btn small copyBtn" data-copy-done-pedido="${escapeHtml(pedidoEfetivo)}" title="Copiar pedido" aria-label="Copiar pedido" style="padding:4px 6px; display:inline-flex; align-items:center; justify-content:center; gap:0; line-height:1;">${copyIconSmall}</button>`);
        if(!isExtra && cliente) detailItems.push(`Cliente: <span style="font-weight:600;">${escapeHtml(cliente)}</span> <button type="button" class="btn small copyBtn" data-copy-done-cliente="${escapeHtml(cliente)}" title="Copiar cliente" aria-label="Copiar cliente" style="padding:4px 6px; display:inline-flex; align-items:center; justify-content:center; gap:0; line-height:1;">${copyIconSmall}</button>`);

        const detailsHtml = detailItems.length
          ? `<div class="doneTaskDetail" style="margin-top:16px;display:flex;flex-wrap:wrap;gap:16px;font-size:12px;color:var(--text);white-space:pre-wrap;word-break:break-word;">${detailItems.map(v => `<span style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;">${v}</span>`).join("")}</div>`
          : "";

        return `
          <div class="doneTaskCard ${isExtra ? "doneTaskExtra" : ""}" style="padding:16px;border-radius:14px;border:1px solid color-mix(in srgb, var(--line) 70%, transparent);background:color-mix(in srgb, var(--card) 80%, transparent);box-shadow:var(--shadow);">
            <div class="doneTaskStack">
            <div class="doneTaskHeader" style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
              <div class="doneTaskTitle" style="margin-bottom:16px;">${escapeHtml(title)}</div>
              <div class="doneTaskActions" style="display:inline-flex;align-items:center;gap:8px;">
                ${summaryBtn}
                ${reactivateBtn}
                <button type="button" class="btn small danger iconBtn" data-done-del="${escapeHtml(String(t.id || ""))}" title="Excluir tarefa" aria-label="Excluir tarefa" style="padding:4px 6px; display:inline-flex; align-items:center; justify-content:center; line-height:1;">${trashIcon}</button>
              </div>
            </div>
            <div class="doneMetaRow" style="margin-top:16px;display:flex;flex-wrap:wrap;gap:16px;">
              ${lojaText ? `<span class="pillMini donePill">Loja: ${escapeHtml(lojaText)}</span>` : ""}              <span class="pillMini donePill">Data inicial: <b>${escapeHtml(data)}</b></span>
              <span class="pillMini donePill">Encerrada em: <b>${escapeHtml(closedAt)}</b></span>
              ${showAuthor ? `<span class="pillMini donePill">Autor da tarefa: <b>${escapeHtml(authorLabel)}</b></span>` : ""}
              ${showClosedBy ? `<span class="pillMini donePill">Encerrada por: <b>${escapeHtml(closedByLabel)}</b></span>` : ""}
            </div>
            ${detailsHtml}
            </div>
          </div>
        `;
      }).join("");
      doneTasksList.querySelectorAll("[data-copy-done-pedido]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const v = (btn.getAttribute("data-copy-done-pedido") || "").trim();
          if(!v) return;
          navigator.clipboard.writeText(v).then(()=>{
            btn.style.opacity = "0.6";
            setTimeout(()=>{ btn.style.opacity = "1"; }, 450);
          }).catch(()=> showAlert("N\u00e3o foi poss\u00edvel copiar."));
        });
      });

      doneTasksList.querySelectorAll("[data-copy-done-cliente]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const v = (btn.getAttribute("data-copy-done-cliente") || "").trim();
          if(!v) return;
          navigator.clipboard.writeText(v).then(()=>{
            btn.style.opacity = "0.6";
            setTimeout(()=>{ btn.style.opacity = "1"; }, 450);
          }).catch(()=> showAlert("N\u00e3o foi poss\u00edvel copiar."));
        });

      });
      doneTasksList.querySelectorAll("[data-done-summary]").forEach(btn=>{
        btn.addEventListener("click", (e)=>{
          e.preventDefault();
          e.stopPropagation();
          const id = (btn.getAttribute("data-done-summary") || "").toString().trim();
          if(!id) return;
          const ref = (tasksDone || []).find(t => String(t.id || "") === id);
          if(!ref){
            showAlert("Tarefa n\u00e3o encontrada.");
            return;
          }
          openTaskSummaryPopup(ref);
        });
      });
      doneTasksList.querySelectorAll("[data-done-reactivate]").forEach(btn=>{
        btn.addEventListener("click", async (e)=>{
          e.preventDefault();
          e.stopPropagation();
          const id = (btn.getAttribute("data-done-reactivate") || "").toString().trim();
          if(!id) return;
          const ref = (tasksDone || []).find(t => String(t.id || "") === id);
          if(!ref){
            showAlert("Tarefa não encontrada.");
            return;
          }
          const ok = await showConfirm("Reativar esta tarefa?");
          if(!ok) return;
          tasksDone = (tasksDone || []).filter(t => String(t.id || "") !== id);
          saveTasksDone(tasksDone);
          tasks = tasks || [];
          const revived = { ...ref };
          delete revived.closedAt;
          tasks.unshift(revived);
          saveTasks(tasks);
          const reopenedDate = (getEffectivePhaseDate(ref) || (ref.proxEtapa || "")).toString().trim();
          if(reopenedDate){
            upsertCalendarFromTask(ref);
          }else{
            calendarHistory = (calendarHistory || []).filter(e => String(e.id || "") !== id);
            saveCalendarHistory(calendarHistory);
          }
          renderDoneTasks();
          renderTasks();
          renderCalendar();
          renderCalendarDayDetails(calSelectedISO);
        });
      });

      doneTasksList.querySelectorAll("[data-done-del]").forEach(btn=>{
        btn.addEventListener("click", async ()=>{
          const id = (btn.getAttribute("data-done-del") || "").trim();
          if(!id) return;
          const ref = (tasksDone || []).find(t => String(t.id || "") === id);
          const pedidoRef = ref ? (getEffectivePedidoFromTask(ref) || ref.pedido || "").toString().trim() : "";
          const clienteRef = ref ? (ref.cliente || "").toString().trim() : "";
          const assuntoRef = ref ? ((ref.assunto || ref.extraText || "").toString().trim()) : "";
          const ok = await showConfirm(`Excluir esta tarefa encerrada?\n\nAssunto: ${assuntoRef || "-"}\nCliente: ${clienteRef || "-"}\nPedido: ${pedidoRef || "-"}\n\nConfirmar?`);
          if(!ok) return;
          tasksDone = (tasksDone || []).filter(t => String(t.id || "") !== id);
          saveTasksDone(tasksDone);
          calendarHistory = (calendarHistory || []).filter(e => String(e.id || "") !== id);
          saveCalendarHistory(calendarHistory);
          renderDoneTasks();
          renderCalendar();
          renderCalendarDayDetails(calSelectedISO);
        });
      });
    }

    function getUserStoreLabel(u){
      return (u?.store || u?.loja || u?.store_name || u?.storeName || "").toString().trim();
    }

    function getUserPresenceInfo(u){
      const isBlocked = String(u?.access_blocked || "") === "1";
      const isPending = String(u?.access_pending || "") === "1";
      const lastActive = Number(u?.last_active_at || 0);
      const lastLogout = Number(u?.last_logout_at || 0);
      const isLoggedIn = lastActive > 0 && (!lastLogout || lastActive > lastLogout);
      let presenceClass = "presenceLoggedOut";
      let presenceLabel = "Deslogado";
      let presenceKey = "deslogado";
      if(isBlocked && isPending){
        presenceClass = "presencePending";
        presenceLabel = "Aguardando liberação";
        presenceKey = "aguardando";
      }else if(isBlocked){
        presenceClass = "presenceBlocked";
        presenceLabel = "Bloqueado";
        presenceKey = "bloqueado";
      }else if(lastActive > 0 && isLoggedIn){
        const diffMs = Date.now() - (lastActive * 1000);
        if(diffMs <= 5 * 60 * 1000){
          presenceClass = "presenceActive";
          presenceLabel = "Ativo";
          presenceKey = "ativo";
        }else if(diffMs < 30 * 60 * 1000){
          presenceClass = "presenceIdle";
          presenceLabel = "Inativo";
          presenceKey = "inativo";
        }else if(diffMs < 60 * 60 * 1000){
          presenceClass = "presenceStopped";
          presenceLabel = "Parado";
          presenceKey = "parado";
        }else{
          presenceClass = "presenceStopped";
          presenceLabel = "Parado";
          presenceKey = "parado";
        }
      }
      return { presenceClass, presenceLabel, presenceKey };
    }

    function updateUsersStoreFilterOptions(){
      if(!usersSearchStoreSelect) return;
      const names = getStoreNames();
      const options = ['<option value="ALL">Todas as lojas</option>']
        .concat(names.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`));
      usersSearchStoreSelect.innerHTML = options.join("");
      usersSearchStoreSelect.value = (usersSearchStore || "").trim() || "ALL";
    }

    function updateUsersStatusFilterOptions(){
      if(!usersSearchStatusSelect) return;
      const adminOnlyOptions = usersSearchStatusSelect.querySelectorAll("[data-admin-only]");
      adminOnlyOptions.forEach(opt => {
        opt.style.display = isAdminUser() ? "" : "none";
      });
      if(!isAdminUser() && (usersSearchStatus || "").trim() === "bloqueado"){
        usersSearchStatus = "";
        usersSearchStatusSelect.value = "";
      }
    }

    function updateUsersFilterButtonState(){
      if(!searchFilterBtn) return;
      const active = Boolean((usersSearchName || "").trim())
        || ((usersSearchStore || "").trim() && (usersSearchStore || "").trim() !== "ALL")
        || Boolean((usersSearchStatus || "").trim());
      searchFilterBtn.classList.toggle("isActive", active);
    }

    function renderUsersView(){
      if(currentView !== "users") return;
      if(!usersCards || !usersCount) return;

      const formatUsersCount = (count) => `${count} ${count === 1 ? "Usu\u00e1rio" : "Usu\u00e1rios"}`;

      if(!canAccessUsersView()){
        usersCount.textContent = formatUsersCount(0);
        usersCards.innerHTML = `<div class="muted">Acesso restrito.</div>`;
        return;
      }
      if(usersError){
        usersCount.textContent = formatUsersCount(0);
        usersCards.innerHTML = `<div class="muted">${escapeHtml(usersError)}</div>`;
        return;
      }

      const list = Array.isArray(usersCache) ? usersCache.slice() : [];
      const nameFilter = normalizeLabelText(usersSearchName || "");
      const storeFilter = (usersSearchStore || "").trim();
      const statusFilter = (usersSearchStatus || "").trim();
      const filtered = list.filter(u => {
        if(nameFilter){
          const username = normalizeLabelText(u?.username || "");
          if(!username.includes(nameFilter)) return false;
        }
        if(storeFilter && storeFilter !== "ALL"){
          const storeLabel = getUserStoreLabel(u);
          if(!storeLabel || storeLabel !== storeFilter) return false;
        }
        if(statusFilter){
          const info = getUserPresenceInfo(u);
          if(info.presenceKey !== statusFilter) return false;
        }
        return true;
      });

      usersCount.textContent = formatUsersCount(filtered.length);
      if(!filtered.length){
        usersCards.innerHTML = `<div class="muted">Nenhum usu&aacute;rio encontrado.</div>`;
        return;
      }

      const canBlockUsers = isAdminUser();
      usersCards.innerHTML = filtered.map(u => {
        const username = (u?.username || "").toString();
        const email = (u?.email || "").toString();
        const hash = (u?.password_hash || "").toString();
        const verified = Number(u?.email_verified) === 1;
        const statusLabel = verified ? "Confirmado" : "Pendente";
        const createdAt = formatDateTimeBR(u?.created_at || "");
        const isBlocked = String(u?.access_blocked || "") === "1";
        const presence = getUserPresenceInfo(u);
        const presenceClass = presence.presenceClass;
        const presenceLabel = presence.presenceLabel;
        return `
          <div class="userCard">
            <div class="userCardHead">
              <div class="userTitleRow">
                <div class="userCardTitle">${escapeHtml(username || "-")}</div>
              </div>
              <div class="userPresenceWrap">
                <div class="userPresenceLabel">${escapeHtml(presenceLabel)}</div>
                <div class="userPresence ${presenceClass}" title="${presenceLabel}" aria-label="${presenceLabel}"></div>
              </div>
            </div>
            <div class="userCardBody">
              <div class="userRow">
                <div class="userRowLabel">E-mail</div>
                <div class="userRowValue">${escapeHtml(email || "-")}</div>
              </div>
              <div class="userRowDivider"></div>
              <div class="userRow">
                <div class="userRowLabel">Senha (hash)</div>
                <div class="userRowValue userHash">${escapeHtml(hash || "-")}</div>
              </div>
              <div class="userRowDivider"></div>
              <div class="userRow">
                <div class="userRowLabel">Criado em</div>
                <div class="userRowValue">${escapeHtml(createdAt)}</div>
              </div>
              <div class="userRowDivider"></div>
              <div class="userRow">
                <div class="userRowLabel">Confirma&ccedil;&atilde;o de e-mail</div>
                <div class="userRowValue">${escapeHtml(statusLabel)}</div>
              </div>
              <div class="userRowDivider"></div>
              <div class="userRow userRowActions">
                <div class="userRowLabel">Resumo de atividades</div>
                <button class="btn small iconBtn userActivityBtn" type="button" data-user-activity="${escapeHtml(String(u?.id || ""))}" data-user-name="${escapeHtml(username || "-")}" title="Resumo de atividades" aria-label="Resumo de atividades">
                  <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                    <line x1="6" y1="7" x2="20" y2="7"></line>
                    <line x1="6" y1="12" x2="20" y2="12"></line>
                    <line x1="6" y1="17" x2="20" y2="17"></line>
                    <circle cx="4" cy="7" r="1"></circle>
                    <circle cx="4" cy="12" r="1"></circle>
                    <circle cx="4" cy="17" r="1"></circle>
                  </svg>
                </button>
              </div>
              <div class="userRowDivider"></div>
              <div class="userRow userRowActions">
                <div class="userRowLabel">A&ccedil;&otilde;es</div>
                <div class="userActionButtons">
                  ${canBlockUsers ? `
                  <button class="btn small iconBtn userBlockBtn${isBlocked ? " isBlocked" : ""}" type="button" data-user-action="${escapeHtml(String(u?.id || ""))}" data-user-blocked="${isBlocked ? "1" : "0"}" data-user-name="${escapeHtml(username || "-")}" title="${isBlocked ? "Liberar acesso" : "Limitar acesso"}" aria-label="${isBlocked ? "Liberar acesso" : "Limitar acesso"}">
                    ${isBlocked ? `
                      <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    ` : `
                      <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 5-5"></path>
                      </svg>
                    `}
                  </button>
                  ` : ""}
                  <button class="btn small iconBtn danger userDeleteBtn" type="button" data-user-delete="${escapeHtml(String(u?.id || ""))}" data-user-name="${escapeHtml(username || "-")}" title="Remover usu\u00e1rio" aria-label="Remover usu\u00e1rio">
                    <svg class="iconStroke" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 6h18"></path>
                      <path d="M8 6V4h8v2"></path>
                      <rect x="6" y="6" width="12" height="14" rx="2"></rect>
                      <path d="M10 10v6"></path>
                      <path d="M14 10v6"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");

      usersCards.querySelectorAll("[data-user-activity]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const userId = (btn.getAttribute("data-user-activity") || "").trim();
          const userName = (btn.getAttribute("data-user-name") || "").trim();
          if(!userId) return;
          await openUserActivity(userId, userName);
        });
      });

      usersCards.querySelectorAll("[data-user-action]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const userId = (btn.getAttribute("data-user-action") || "").trim();
          const isBlocked = (btn.getAttribute("data-user-blocked") || "") === "1";
          const userName = (btn.getAttribute("data-user-name") || "").trim();
          if(!userId) return;
          const action = isBlocked ? "unblock" : "block";
          const ok = await showConfirm(
            `${isBlocked ? "Desbloquear" : "Bloquear"} o acesso do usuário ${userName || ""}?`,
            isBlocked ? "Desbloquear acesso" : "Bloquear acesso"
          );
          if(!ok) return;
          try{
            await apiAdminUserAction(action, userId);
            await refreshUsersView();
          }catch(e){
            showAlert("N\u00e3o foi poss\u00edvel atualizar o acesso.");
          }
        });
      });

      usersCards.querySelectorAll("[data-user-delete]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const userId = (btn.getAttribute("data-user-delete") || "").trim();
          const userName = (btn.getAttribute("data-user-name") || "").trim();
          if(!userId) return;
          const ok = await showConfirm(
            `Remover o usu\u00e1rio ${userName || ""}? Esta a\u00e7\u00e3o \u00e9 definitiva.`,
            "Remover usu\u00e1rio"
          );
          if(!ok) return;
          try{
            await apiAdminUserAction("delete", userId);
            await refreshUsersView();
          }catch(e){
            showAlert("N\u00e3o foi poss\u00edvel remover o usu\u00e1rio.");
          }
        });
      });
    }

    async function openUserActivity(userId, userName){
      const usePage = Boolean(viewUserActivity && userActivityViewSummary && userActivityViewList);
      const titleText = `Atividade: ${userName || "Usu\u00e1rio"}`;
      const summaryEl = usePage ? userActivityViewSummary : userActivitySummary;
      const listEl = usePage ? userActivityViewList : userActivityList;

      if(!summaryEl || !listEl) return;
      if(usePage){
        if(userActivityViewTitle) userActivityViewTitle.textContent = titleText;
        if(userActivityViewMeta) userActivityViewMeta.textContent = "";
        setView("userActivity");
      }else{
        if(!userActivityOverlay) return;
        if(userActivityTitle) userActivityTitle.textContent = titleText;
        userActivityOverlay.classList.add("show");
      }

      summaryEl.textContent = "Carregando...";
      listEl.innerHTML = "";
      try{
        const data = await apiUserActivity(userId);
        const summary = data?.summary || {};
        const firstSeen = formatDateTimeFromTs(summary.first_seen);
        const lastSeen = formatDateTimeFromTs(summary.last_seen);
        const lastActive = formatDateTimeFromTs(summary.last_active_at);
        const lastLogout = formatDateTimeFromTs(summary.last_logout_at);
        summaryEl.innerHTML = `
          <div><strong>Primeira atividade:</strong> ${escapeHtml(firstSeen)}</div>
          <div><strong>\u00daltima atividade:</strong> ${escapeHtml(lastSeen)}</div>
          <div><strong>\u00daltimo ping:</strong> ${escapeHtml(lastActive)}</div>
          <div><strong>\u00daltimo logout:</strong> ${escapeHtml(lastLogout)}</div>
        `;
        const activePeriods = Array.isArray(data?.active_periods) ? data.active_periods : [];
        const inactivePeriods = Array.isArray(data?.inactive_periods) ? data.inactive_periods : [];
        const activeHtml = activePeriods.length ? activePeriods.map(p => {
          const start = formatDateTimeFromTs(p.start);
          const end = formatDateTimeFromTs(p.end);
          const duration = formatDuration(p.duration_sec);
          const ongoing = p.ongoing ? " (em andamento)" : "";
          return `
            <div class="activityItem">
              <div class="activityBadge">Ativo${ongoing}</div>
              <div class="activityRow"><span class="activityRowLabel">In\u00edcio</span><span>${escapeHtml(start)}</span></div>
              <div class="activityRow"><span class="activityRowLabel">Fim</span><span>${escapeHtml(end)}</span></div>
              <div class="activityRow"><span class="activityRowLabel">Dura\u00e7\u00e3o</span><span>${escapeHtml(duration)}</span></div>
            </div>
          `;
        }).join("") : `<div class="activityItem"><div class="activityRow">Nenhum per\u00edodo ativo registrado.</div></div>`;
        const inactiveSegments = [];
        inactivePeriods.forEach(p => {
          const startTs = Number(p.start || 0);
          const endTs = Number(p.end || 0);
          if(!startTs || !endTs || endTs <= startTs) return;
          const inactiveWindowEnd = startTs + (30 * 60);
          const firstEnd = Math.min(endTs, inactiveWindowEnd);
          const secondStart = Math.min(endTs, inactiveWindowEnd);
          if(firstEnd > startTs){
            inactiveSegments.push({
              label: "Inativo",
              start: startTs,
              end: firstEnd,
              ongoing: p.ongoing && endTs === firstEnd
            });
          }
          if(endTs > secondStart){
            inactiveSegments.push({
              label: "Parado",
              start: secondStart,
              end: endTs,
              ongoing: p.ongoing
            });
          }
        });

        const inactiveHtml = inactiveSegments.length ? inactiveSegments.map(seg => {
          const start = formatDateTimeFromTs(seg.start);
          const end = formatDateTimeFromTs(seg.end);
          const duration = formatDuration(seg.end - seg.start);
          const ongoing = seg.ongoing ? " (em andamento)" : "";
          return `
            <div class="activityItem">
              <div class="activityBadge">${escapeHtml(seg.label)}${ongoing}</div>
              <div class="activityRow"><span class="activityRowLabel">In\u00edcio</span><span>${escapeHtml(start)}</span></div>
              <div class="activityRow"><span class="activityRowLabel">Fim</span><span>${escapeHtml(end)}</span></div>
              <div class="activityRow"><span class="activityRowLabel">Dura\u00e7\u00e3o</span><span>${escapeHtml(duration)}</span></div>
            </div>
          `;
        }).join("") : `<div class="activityItem"><div class="activityRow">Nenhum per\u00edodo inativo registrado.</div></div>`;
        listEl.innerHTML = `
          <div class="activitySection">
            <div class="activitySectionTitle">Per\u00edodos ativos</div>
            ${activeHtml}
          </div>
          <div class="activitySection">
            <div class="activitySectionTitle">Per\u00edodos inativos (gap &gt; 15 min)</div>
            ${inactiveHtml}
          </div>
        `;
      }catch(err){
        summaryEl.textContent = "N\u00e3o foi poss\u00edvel carregar a atividade.";
      }
    }

    function closeUserActivity(){
      if(currentView === "userActivity"){
        setView("users");
        return;
      }
      if(userActivityOverlay) userActivityOverlay.classList.remove("show");
    }
    async function refreshUsersView(){
      if(!viewUsers) return false;
      usersError = "";
      try{
        const result = await apiAdminUsers();
        usersCache = Array.isArray(result?.users) ? result.users : [];
        renderUsersView();
        return true;
      }catch(err){
        usersCache = [];
        const msg = (err && err.message) ? String(err.message) : "";
        usersError = msg === "forbidden" ? "Acesso restrito." : "Nao foi possivel carregar os usuarios.";
        renderUsersView();
        return false;
      }
    }

    /***********************
     * EVENTS
     ***********************/
    initActivityListeners();
    searchInput.addEventListener("input", ()=>{
      if(currentView === "tasks"){
        tasksSearchQuery = (searchInput.value || "");
        tasksShowAll = false;
        tasksSingleIndex = 0;
        renderTasks();
        return;
      }
      if(currentView === "done"){
        doneSearchQuery = (searchInput.value || "");
        renderDoneTasks();
        return;
      }
      if(currentView === "users"){
        usersSearchName = (searchInput.value || "");
        renderUsersView();
        updateUsersFilterButtonState();
        return;
      }
      render();
    });
    if(searchStoreSelect){
      // obrigat\u00e9rio escolher a loja antes de pesquisar
      searchStoreSelect.addEventListener("change", ()=>{
        if(searchInput){ searchInput.value = ""; }
        showAllCards = false;
        currentSingleIndex = 0;
        render();
        updateFilterButtonsState();
      });
    }
    if(searchFilterBtn){
      searchFilterBtn.addEventListener("click", ()=>{
        if(currentView === "users"){
          updateUsersStoreFilterOptions();
          updateUsersStatusFilterOptions();
          if(usersSearchStatusSelect) usersSearchStatusSelect.value = (usersSearchStatus || "").trim();
          if(usersFiltersOverlay) usersFiltersOverlay.classList.add("show");
          return;
        }
        if(currentView === "tasks"){
          if(tasksSearchPeriodCustom && tasksSearchPeriod){
            const val = (tasksSearchPeriod.value || "").trim();
            tasksSearchPeriodCustom.style.display = val === "CUSTOM" ? "block" : "none";
          }
          if(tasksFiltersOverlay) tasksFiltersOverlay.classList.add("show");
          return;
        }
        if(currentView === "done"){
          if(doneSearchPeriodCustom && doneSearchPeriod){
            const val = (doneSearchPeriod.value || "").trim();
            doneSearchPeriodCustom.style.display = val === "CUSTOM" ? "block" : "none";
          }
          if(doneFiltersOverlay) doneFiltersOverlay.classList.add("show");
          return;
        }
        if(searchFiltersOverlay) searchFiltersOverlay.classList.add("show");
      });
    }
    if(searchFiltersCloseBtn && searchFiltersOverlay){
      searchFiltersCloseBtn.addEventListener("click", ()=> searchFiltersOverlay.classList.remove("show"));
    }
    if(searchFiltersApplyBtn && searchFiltersOverlay){
      searchFiltersApplyBtn.addEventListener("click", ()=>{
        if(!searchTagInputs.length) renderSearchTags();
        searchTagsFilter = searchTagInputs
          .filter(inp => inp.checked)
          .map(inp => (inp.value || "").toString().trim().toLowerCase())
          .filter(Boolean);
        searchFiltersOverlay.classList.remove("show");
        showAllCards = false;
        currentSingleIndex = 0;
        render();
        updateFilterButtonsState();
      });
    }
    if(searchFiltersClearBtn){
      searchFiltersClearBtn.addEventListener("click", ()=>{
        if(searchStoreSelect) searchStoreSelect.value = "";
        if(searchInput) searchInput.value = "";
        if(!searchTagInputs.length) renderSearchTags();
        searchTagInputs.forEach(inp => { inp.checked = false; });
        searchTagsFilter = [];
        showAllCards = false;
        currentSingleIndex = 0;
        render();
        updateFilterButtonsState();
      });
    }

    if(addSearchTagBtn){
      addSearchTagBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        const value = (searchTagNew ? searchTagNew.value : "").toString().trim().toLowerCase();
        if(!value) return;
        saveSearchTags([...(searchTags || []), value]);
        if(searchTagNew) searchTagNew.value = "";
        searchTagsFilter = Array.from(new Set([...searchTagsFilter, value]));
        renderSearchTags();
        updateFilterButtonsState();
      });
    }
    if(searchTagList){
      searchTagList.addEventListener("click", (e)=>{
        const btn = e.target.closest("[data-tag-remove]");
        if(!btn) return;
        e.preventDefault();
        const tag = (btn.getAttribute("data-tag-remove") || "").toString().trim().toLowerCase();
        if(!tag) return;
        searchTagsFilter = searchTagsFilter.filter(t => t !== tag);
        saveSearchTags((searchTags || []).filter(t => t !== tag));
        renderSearchTags();
        updateFilterButtonsState();
      });
    }
    if(searchTagNew){
      searchTagNew.addEventListener("keydown", (e)=>{
        if(e.key !== "Enter") return;
        e.preventDefault();
        if(addSearchTagBtn) addSearchTagBtn.click();
      });
    }

    qInput.addEventListener("input", updateQCount);

    addStepBtn.addEventListener("click", ()=> addStepUI(null));
    addQuestionLinkBtn.addEventListener("click", addQuestionLinkRow);

    saveBtn.addEventListener("click", handleSave);
    exportBtn.addEventListener("click", exportFile);

    // IMPORT: pede senha
    importBtn.addEventListener("click", async ()=>{
      if(!await requirePassword("importar arquivo")) return;
      filePicker.value = "";
      filePicker.click();
    });

    filePicker.addEventListener("change", ()=>{
      const file = filePicker.files && filePicker.files[0];
      if(file){
        if(backupOverlay) backupOverlay.classList.remove("show");
        importFile(file);
      }
    });

    // imagens (m\u00faltiplas)
    qPickImgsBtn.addEventListener("click", ()=> qImgsFile.click());
    qImgsFile.addEventListener("change", async ()=>{
    	const files = qImgsFile.files ? [...qImgsFile.files] : [];
    	if(!files.length) return;
    	qImgsFile.value = "";
    	const uploaded = [];
    	let hadError = false;
    	for(const f of files){
    		try{
    			const filename = await apiUploadImage(f, "respostas");
    			if(filename) uploaded.push(filename);
    		}catch(err){
    			hadError = true;
    		}
    	}
    	if(uploaded.length){
    		setQuestionImagesUI(qImages.concat(uploaded));
    	}
    	if(hadError){
    		showAlert("NÊo foi poss¦vel enviar uma das imagens.");
    	}
    });
    qClearImgsBtn.addEventListener("click", ()=>{
      const removed = qImages.slice();
      qImgsFile.value = "";
      setQuestionImagesUI([]);
      if(editIndex === -1){
        void deleteImagesNow(removed);
      }else{
        queueImageDeletes(removed);
      }
    });

    // remover imagem espec\u00edfica (pr\u00e9via)
    qImgsPreviewGrid.addEventListener("click", (e)=>{
      const btn = e.target.closest("[data-qimg-remove]");
      if(!btn) return;
      const idx = Number(btn.getAttribute("data-qimg-remove"));
      if(!Number.isFinite(idx)) return;
      const removed = [qImages[idx]];
      const next = qImages.slice();
      next.splice(idx, 1);
      setQuestionImagesUI(next);
      if(editIndex === -1){
        void deleteImagesNow(removed);
      }else{
        queueImageDeletes(removed);
      }
    });

    if(openQuestionModalBtn){
      openQuestionModalBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        clearForm();
        openQuestionModal("add");
      });
    }
    if(questionCloseBtn) questionCloseBtn.addEventListener("click", closeQuestionModal);
    if(questionOverlay){
      questionOverlay.addEventListener("click", (e)=>{ if(e.target === questionOverlay) closeQuestionModal(); });
      document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && questionOverlay.classList.contains("show")) closeQuestionModal(); });
    }

    if(openTaskModalBtn){
      openTaskModalBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        clearTasksForm();
        openTaskModal();
      });
    }
    if(openExtraTaskModalBtn){
      openExtraTaskModalBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        openSimpleTaskModal(todayISO());
      });
    }
    if(taskCloseBtn) taskCloseBtn.addEventListener("click", closeTaskModal);
    if(taskOverlay){
      taskOverlay.addEventListener("click", (e)=>{ if(e.target === taskOverlay) closeTaskModal(); });
      document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && taskOverlay.classList.contains("show")) closeTaskModal(); });
    }


    if(closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
    okModalBtn.addEventListener("click", closeModal);
    nextStepBtn.addEventListener("click", nextStep);
    prevStepBtn.addEventListener("click", prevStep);

    overlay.addEventListener("click", (e)=>{ if(e.target === overlay) closeModal(); });
    document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && overlay.classList.contains("show")) closeModal(); });

    if(popupOkBtn) popupOkBtn.addEventListener("click", ()=>{
      popupActionSource = "ok";
      closePopup(true);
    });
    if(popupCancelBtn) popupCancelBtn.addEventListener("click", ()=>{
      popupActionSource = "cancel";
      closePopup(false);
    });
    if(popupCloseBtn) popupCloseBtn.addEventListener("click", ()=>{
      popupActionSource = "close";
      closePopup(false);
    });
    if(popupOverlay){
      popupOverlay.addEventListener("click", (e)=>{
        if(e.target === popupOverlay){
          popupActionSource = "overlay";
          closePopup(false);
        }
      });
    }
    if(calAddSimpleBtn){
      calAddSimpleBtn.addEventListener("click", ()=>{
        if(!calSelectedISO){
          showAlert("Selecione um dia.");
          return;
        }
        openSimpleTaskModal(calSelectedISO);
      });
    }
    if(calAddTaskBtn){
      calAddTaskBtn.addEventListener("click", ()=>{
        if(!calSelectedISO){
          showAlert("Selecione um dia.");
          return;
        }
        taskModalFromCalendar = true;
        if(taskOverlay) taskOverlay.classList.add("isCalendarContext");
        clearTasksForm();
        if(tData) tData.value = calSelectedISO;
        openTaskModal();
      });
    }
    if(calStoreFilter){
      calStoreFilter.addEventListener("change", ()=>{
        calStoreFilterValue = (calStoreFilter.value || "").trim();
        renderCalendar();
        renderCalendarDayDetails(calSelectedISO);
        setCalendarFilterPanelOpen(false);
        updateFilterButtonsState();
      });
    }
    if(calFilterBtn){
      calFilterBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        e.stopPropagation();
        if(!calFilterPanel) return;
        const isOpen = calFilterPanel.style.display === "block";
        setCalendarFilterPanelOpen(!isOpen);
      });
    }
    if(miniCalPrev){
      miniCalPrev.addEventListener("click", (e)=>{
        e.preventDefault();
        calViewMonth -= 1;
        if(calViewMonth < 0){ calViewMonth = 11; calViewYear -= 1; }
        renderMiniCalendar();
      });
    }
    if(miniCalNext){
      miniCalNext.addEventListener("click", (e)=>{
        e.preventDefault();
        calViewMonth += 1;
        if(calViewMonth > 11){ calViewMonth = 0; calViewYear += 1; }
        renderMiniCalendar();
      });
    }
    if(simpleTaskCloseBtn) simpleTaskCloseBtn.addEventListener("click", closeSimpleTaskModal);
    if(simpleTaskCancelBtn) simpleTaskCancelBtn.addEventListener("click", closeSimpleTaskModal);
    if(simpleTaskSaveBtn) simpleTaskSaveBtn.addEventListener("click", saveSimpleTask);
    if(simpleTaskDate){
      simpleTaskDate.addEventListener("change", ()=>{
        const iso = (simpleTaskDate.value || "").toString().trim();
        updateSimpleTaskRepeatLabels(iso);
        updateRecurrenceMonthlyOptions(iso);
      });
    }
    if(simpleTaskRepeat){
      simpleTaskRepeat.addEventListener("change", ()=>{
        const value = (simpleTaskRepeat.value || "").toString().trim();
        if(value === "personalizar"){
          recurrenceModalConfirmed = false;
          openRecurrenceModal();
          return;
        }
        lastSimpleTaskRepeatValue = value || "nao_repite";
        syncSimpleTaskRepeatEditButton();
      });
    }
    if(simpleTaskRepeatEditBtn){
      simpleTaskRepeatEditBtn.addEventListener("click", ()=>{
        if(!simpleTaskRepeat) return;
        const value = (simpleTaskRepeat.value || "").toString().trim();
        if(value !== "personalizar") return;
        recurrenceModalConfirmed = false;
        openRecurrenceModal();
      });
    }
    if(simpleTaskOverlay){
      simpleTaskOverlay.addEventListener("click", (e)=>{ if(e.target === simpleTaskOverlay) closeSimpleTaskModal(); });
      document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && simpleTaskOverlay.classList.contains("show")) closeSimpleTaskModal(); });
    }
    if(recurrenceCloseBtn) recurrenceCloseBtn.addEventListener("click", closeRecurrenceModal);
    if(recurrenceCancelBtn) recurrenceCancelBtn.addEventListener("click", ()=>{
      const iso = (simpleTaskDate?.value || "").toString().trim() || todayISO();
      recurrenceDraft = getDefaultRecurrenceDraft(iso);
      recurrenceEndDraft = { mode:"never", date:"", count:null };
      applyRecurrenceDraftToUI();
      applyRecurrenceEndDraftToUI();
      updateRecurrenceMonthlyOptions(iso);
    });
    if(recurrenceDoneBtn) recurrenceDoneBtn.addEventListener("click", ()=>{
      recurrenceModalConfirmed = true;
      saveRecurrenceDraftFromUI();
      lastSimpleTaskRepeatValue = "personalizar";
      closeRecurrenceModal();
    });
    if(recurrenceFrequency){
      recurrenceFrequency.addEventListener("change", syncRecurrenceWeekdaysVisibility);
    }
    if(recurrenceWeekdays){
      recurrenceWeekdays.querySelectorAll(".recurrenceDayBtn").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          btn.classList.toggle("isActive");
        });
      });
    }
    if(recurrenceEndNever) recurrenceEndNever.addEventListener("change", syncRecurrenceEndInputs);
    if(recurrenceEndDate) recurrenceEndDate.addEventListener("change", syncRecurrenceEndInputs);
    if(recurrenceEndCount) recurrenceEndCount.addEventListener("change", syncRecurrenceEndInputs);
    if(recurrenceOverlay){
      recurrenceOverlay.addEventListener("click", (e)=>{ if(e.target === recurrenceOverlay) closeRecurrenceModal(); });
      document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && recurrenceOverlay.classList.contains("show")) closeRecurrenceModal(); });
    }
    if(popupInput){
      popupInput.addEventListener("keydown", (e)=>{
        const key = (e.key || "").toLowerCase();
        if(e.ctrlKey && (key === "p" || key === "o")){
          if(!popupShortcutContext) return;
          e.preventDefault();
          const list = key === "p" ? (popupShortcutContext.pedidos || []) : (popupShortcutContext.rastreios || []);
          if(!list.length){
            showAlert(key === "p" ? "Nenhum pedido encontrado para esta tarefa." : "Nenhum rastreio encontrado para esta tarefa.");
            return;
          }
          if(list.length === 1){
            insertPopupValue(list[0]);
            return;
          }
          showPopupQuickPick({
            items: list,
            label: key === "p" ? "Escolha o pedido" : "Escolha o rastreio",
            onPick: insertPopupValue
          });
          return;
        }
        if(e.key !== "Enter") return;
        e.preventDefault();
        closePopup(true);
      });
    }
    if(popupTextarea){
      popupTextarea.addEventListener("keydown", (e)=>{
        const key = (e.key || "").toLowerCase();
        if(e.ctrlKey && (key === "p" || key === "o")){
          if(!popupShortcutContext) return;
          e.preventDefault();
          const list = key === "p" ? (popupShortcutContext.pedidos || []) : (popupShortcutContext.rastreios || []);
          if(!list.length){
            showAlert(key === "p" ? "Nenhum pedido encontrado para esta tarefa." : "Nenhum rastreio encontrado para esta tarefa.");
            return;
          }
          if(list.length === 1){
            insertPopupValue(list[0]);
            return;
          }
          showPopupQuickPick({
            items: list,
            label: key === "p" ? "Escolha o pedido" : "Escolha o rastreio",
            onPick: insertPopupValue
          });
          return;
        }
        if(e.key === "Enter" && e.ctrlKey){
          e.preventDefault();
          closePopup(true);
        }
      });
    }
    document.addEventListener("keydown", (e)=>{
      if(e.key === "Escape" && popupOverlay && popupOverlay.classList.contains("show")){
        popupActionSource = "escape";
        closePopup(false);
      }
    });

    // drawer
    if(openDrawerBtn) openDrawerBtn.addEventListener("click", openDrawer);
    if(openDrawerBtnMobile) openDrawerBtnMobile.addEventListener("click", openDrawer);
    if(closeDrawerBtn) closeDrawerBtn.addEventListener("click", closeDrawer);
    if(drawerBackdrop) drawerBackdrop.addEventListener("click", closeDrawer);
    if(openRightDrawerBtn) openRightDrawerBtn.addEventListener("click", openRightDrawer);
    if(closeRightDrawerBtn) closeRightDrawerBtn.addEventListener("click", closeRightDrawer);
    if(rightDrawerBackdrop) rightDrawerBackdrop.addEventListener("click", closeRightDrawer);
    let pendingRightDrawerReturn = false;
    const mobileHeaderProxyBtns = document.querySelectorAll("[data-header-proxy]");
    const headerPopupTargets = new Set([
      "orderLookupBtn",
      "metaInboxBtn",
      "emailMenuBtn",
      "backupMenuBtn",
      "settingsBtn",
    ]);
    mobileHeaderProxyBtns.forEach((btn)=>{
      btn.addEventListener("click", ()=>{
        const targetId = (btn.getAttribute("data-header-proxy") || "").trim();
        if(!targetId) return;
        const target = document.getElementById(targetId);
        pendingDrawerReturn = headerPopupTargets.has(targetId) && isMobileViewport();
        if(targetId === "openRightDrawerBtn" && isMobileViewport()) pendingRightDrawerReturn = true;
        if(target) target.click();
        if(pendingDrawerReturn) pendingDrawerReturn = false;
        closeDrawer();
      });
    });
    if(openSizeTablesBtn) openSizeTablesBtn.addEventListener("click", openSizeTables);
    if(sizeTablesCloseBtn){
      sizeTablesCloseBtn.addEventListener("click", ()=>{
        closeSizeTables();
        openRightDrawer();
      });
    }
    if(openAddSizeTableBtn){
      openAddSizeTableBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        openSizeTableUpload({ mode: "add" });
      });
    }
    if(sizeTableUploadCloseBtn){
      sizeTableUploadCloseBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        closeSizeTableUpload();
      });
    }
    if(sizeTableUploadSaveBtn){
      sizeTableUploadSaveBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        const name = (sizeTableUploadName ? sizeTableUploadName.value : "").toString().trim();
        const file = sizeTableUploadFile && sizeTableUploadFile.files ? sizeTableUploadFile.files[0] : null;
        if(!name){
          setSizeTableUploadError("Informe o nome da tabela.");
          if(sizeTableUploadName) sizeTableUploadName.focus();
          return;
        }
        if(!file){
          setSizeTableUploadError("Selecione uma imagem.");
          if(sizeTableUploadFile) sizeTableUploadFile.focus();
          return;
        }
        setSizeTableUploadError("");
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || "");
          if(!dataUrl) return;
          if(sizeTableUploadMode === "add"){
            saveSizeTablesCustom([...(sizeTablesCustom || []), { name, dataUrl }]);
            closeSizeTableUpload();
            return;
          }
          const target = sizeTableUploadTargetName || name;
          if(sizeTableUploadIsCustom){
            const next = (sizeTablesCustom || []).map(t => (
              t.name === target ? { ...t, dataUrl } : t
            ));
            saveSizeTablesCustom(next);
          }else{
            const base = (sizeTablesOverrides || []).filter(t => t.name !== target);
            base.push({ name: target, dataUrl });
            saveSizeTablesOverrides(base);
          }
          closeSizeTableUpload();
        };
        reader.readAsDataURL(file);
      });
    }
    if(openProductsBtn) openProductsBtn.addEventListener("click", openProducts);
    if(productsCloseBtn){
      productsCloseBtn.addEventListener("click", ()=>{
        closeProducts();
        openRightDrawer();
      });
    }
    if(productManageCloseBtn){
      productManageCloseBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        closeProductManage();
      });
    }
    if(productManageSpecsAddBtn){
      productManageSpecsAddBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        addProductManageSpec();
      });
    }
    if(productManageSpecsInput){
      productManageSpecsInput.addEventListener("keydown", (e)=>{
        if(e.key !== "Enter") return;
        e.preventDefault();
        addProductManageSpec();
      });
    }
    if(productManageTableClearBtn){
      productManageTableClearBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        productManageTableUrl = "";
        if(productManageTableFile) productManageTableFile.value = "";
        productManageTableClearBtn.disabled = true;
      });
    }
    if(productManageTableFile && productManageTableClearBtn){
      productManageTableFile.addEventListener("change", ()=>{
        if(productManageTableFile.files && productManageTableFile.files.length){
          productManageTableClearBtn.disabled = false;
        }
      });
    }
    if(productManageSaveBtn){
      productManageSaveBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        clearProductManageFieldErrors();
        const store = (productManageStore ? productManageStore.value : "").toString().trim();
        const name = (productManageName ? productManageName.value : "").toString().trim();
        const price = (productManagePrice ? productManagePrice.value : "").toString().trim();
        const stampsRaw = (productManageStampsUrl ? productManageStampsUrl.value : "").toString().trim();
        const stampsUrl = stampsRaw ? normalizeQuickLinkUrl(stampsRaw) : "";
        const specs = productManageSpecsItems.slice();
        const colors = productManageSelectedColors.slice();
        const file = productManageTableFile && productManageTableFile.files ? productManageTableFile.files[0] : null;
        let hasError = false;
        if(!store){
          setProductManageFieldError(productManageStoreError, "Selecione a loja.");
          hasError = true;
        }
        if(!name){
          setProductManageFieldError(productManageNameError, "Informe o nome do produto.");
          hasError = true;
        }
        if(!price){
          setProductManageFieldError(productManagePriceError, "Informe o valor.");
          hasError = true;
        }
        if(!stampsUrl){
          setProductManageFieldError(productManageStampsError, "Informe o link das estampas.");
          hasError = true;
        }
        if(!specs.length){
          setProductManageFieldError(productManageSpecsError, "Adicione ao menos 1 especificacao.");
          hasError = true;
        }
        if(!colors.length){
          setProductManageFieldError(productManageColorsError, "Selecione ao menos 1 cor.");
          hasError = true;
        }
        const tableUrlValue = (productManageTableUrl || "").toString().trim();
        if(!file && !tableUrlValue){
          setProductManageFieldError(productManageTableError, "Envie a imagem da tabela.");
          hasError = true;
        }
        if(hasError) return;
        const isEdit = productManageMode === "edit";
        const saveWithTableUrl = (tableUrl)=>{
          const next = (productsCustom || []).slice();
          const key = productKeyFromName(name);
          const payload = {
            store,
            name,
            price,
            key,
            stampsUrl,
            specs,
            colors,
            tableUrl: (tableUrl || "").toString().trim(),
            detailsCustom: true
          };
          let savedItem = null;
          if(isEdit && productManageId){
            const idx = next.findIndex(p => p.id === productManageId);
            if(idx !== -1){
              savedItem = { ...next[idx], ...payload };
              next[idx] = savedItem;
            }
          }else{
            savedItem = { id: uid(), ...payload };
            next.push(savedItem);
          }
          saveProducts(next);
          closeProductManage();
          if(!isEdit && savedItem){
            openProductDetails(savedItem);
          }
        };
        if(file){
          const reader = new FileReader();
          reader.onload = () => {
            const tableUrl = String(reader.result || "");
            saveWithTableUrl(tableUrl);
          };
          reader.readAsDataURL(file);
          return;
        }
        saveWithTableUrl(productManageTableUrl);
      });
    }
    if(sizeTablesOverlay){
      sizeTablesOverlay.addEventListener("click", (e)=>{ if(e.target === sizeTablesOverlay) closeSizeTables(); });
    }
    if(productManageOverlay){
      productManageOverlay.addEventListener("click", (e)=>{ if(e.target === productManageOverlay) closeProductManage(); });
    }
    if(sizeTableUploadOverlay){
      sizeTableUploadOverlay.addEventListener("click", (e)=>{ if(e.target === sizeTableUploadOverlay) closeSizeTableUpload(); });
    }
    if(productsOverlay){
      productsOverlay.addEventListener("click", (e)=>{ if(e.target === productsOverlay) closeProducts(); });
    }
    document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && sizeTablesOverlay && sizeTablesOverlay.classList.contains("show")) closeSizeTables(); });
    document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && productManageOverlay && productManageOverlay.classList.contains("show")) closeProductManage(); });
    document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && sizeTableUploadOverlay && sizeTableUploadOverlay.classList.contains("show")) closeSizeTableUpload(); });
    document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && productsOverlay && productsOverlay.classList.contains("show")) closeProducts(); });

    if(productsOverlay){
      productsOverlay.addEventListener("click", async (e)=>{
        const addBtn = e.target.closest("[data-product-add]");
        if(addBtn){
          e.preventDefault();
          openProductManage({ mode: "add", store: addBtn.getAttribute("data-product-add") || "" });
          return;
        }
        const editBtn = e.target.closest("[data-product-edit]");
        if(editBtn){
          e.preventDefault();
          const id = editBtn.getAttribute("data-product-edit") || "";
          const item = (productsCustom || []).find(p => p.id === id);
          if(item) openProductManage({ mode: "edit", item });
          return;
        }
        const delBtn = e.target.closest("[data-product-delete]");
        if(delBtn){
          e.preventDefault();
          const id = delBtn.getAttribute("data-product-delete") || "";
          if(!id) return;
          const ok = await showConfirm("Remover este item?");
          if(!ok) return;
          const next = (productsCustom || []).filter(p => p.id !== id);
          saveProducts(next);
          return;
        }
        const btn = e.target.closest("[data-product-view]");
        if(!btn) return;
        e.preventDefault();
        const id = btn.getAttribute("data-product-view") || "";
        const item = (productsCustom || []).find(p => p.id === id);
        if(item){
          openProductDetails(item);
          return;
        }
        openProductDetails({
          key: btn.getAttribute("data-product-key") || "",
          name: btn.getAttribute("data-product-name") || btn.textContent || "",
          price: btn.getAttribute("data-product-price") || "",
          store: btn.getAttribute("data-product-store") || "",
        });
      });
    }

    if(productDetailsCloseBtn) productDetailsCloseBtn.addEventListener("click", closeProductDetails);
    if(productDetailsOverlay){
      productDetailsOverlay.addEventListener("click", (e)=>{ if(e.target === productDetailsOverlay) closeProductDetails(); });
      document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && productDetailsOverlay.classList.contains("show")) closeProductDetails(); });
    }

    if(copyProductSpecsBtn){
      copyProductSpecsBtn.addEventListener("click", async ()=>{
        const text = buildProductSpecsText(currentProductPrice, currentProductDetails);
        await copyTextToClipboard(text, copyProductSpecsBtn, "Copiado!");
      });
    }
    if(copyProductColorsBtn){
      copyProductColorsBtn.addEventListener("click", async ()=>{
        const text = buildProductColorsText(currentProductDetails?.colors);
        await copyTextToClipboard(text, copyProductColorsBtn, "Copiado!");
      });
    }
    if(copyProductTableBtn){
      copyProductTableBtn.addEventListener("click", async ()=>{
        if(!currentProductTableUrl){
          showAlert("Tabela nÊo dispon¦vel para este produto.");
          return;
        }
        await copyImageToClipboard(currentProductTableUrl, copyProductTableBtn, "Copiar imagem");
      });
    }

    if(productVideoWhatsapp){
      productVideoWhatsapp.addEventListener("input", ()=>{ clearFieldError(productVideoWhatsapp); });
    }

    if(productVideoSendBtn){
      productVideoSendBtn.addEventListener("click", ()=>{
        if(!productVideoWhatsapp){
          return;
        }
        clearFieldError(productVideoWhatsapp);
        const raw = (productVideoWhatsapp.value || "").trim();
        const phoneCheck = validateBrazilWhatsapp(raw);
        if(!phoneCheck.ok){
          setFieldError(productVideoWhatsapp, phoneCheck.message);
          productVideoWhatsapp.focus();
          return;
        }
        const phone = `55${phoneCheck.digits}`;
        if(!currentProductVideoUrl || !currentProductVideoText){
          showAlert("V¦deo nÊo dispon¦vel para este produto.");
          return;
        }
        const message = `${currentProductVideoText}\n\n${currentProductVideoUrl}`;
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, "_blank");
      });
    }

    drawerPrev.addEventListener("click", ()=>{
      drawerPage = Math.max(1, drawerPage - 1);
      renderDrawer();
    });
    drawerNext.addEventListener("click", ()=>{
      const totalPages = Math.max(1, Math.ceil(menuButtons.length / DRAWER_PAGE_SIZE));
      drawerPage = Math.min(totalPages, drawerPage + 1);
      renderDrawer();
    });

    if(newMenuBtnIconFile) handleMenuIconUpload(newMenuBtnIconFile, newMenuBtnIcon);
    if(menuEditIconFile) handleMenuIconUpload(menuEditIconFile, menuEditIcon);

    addMenuBtn.addEventListener("click", addCustomMenuButton);

    // menu edit modal events
    closeMenuEditBtn.addEventListener("click", closeMenuEdit);
    menuEditOverlay.addEventListener("click", (e)=>{ if(e.target === menuEditOverlay) closeMenuEdit(); });
    document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && menuEditOverlay.classList.contains("show")) closeMenuEdit(); });

    menuEditAddLink.addEventListener("click", ()=>{
      editingMenuLinks.push({ name:"", url:"" });
      renderMenuEditLinks();
    });
    menuEditSaveBtn.addEventListener("click", saveMenuEdit);
    menuEditDeleteBtn.addEventListener("click", ()=>{
      if(editingMenuGlobalIndex < 0) return;
      removeMenuButton(editingMenuGlobalIndex);
      closeMenuEdit();
    });

    // modal: fase (card)
    if(closePhaseEditBtn) closePhaseEditBtn.addEventListener("click", closePhaseEditor);
    if(phaseEditCancelBtn) phaseEditCancelBtn.addEventListener("click", closePhaseEditor);
    if(phaseEditSaveBtn) phaseEditSaveBtn.addEventListener("click", savePhaseEditor);
    if(phaseEditCloseTaskBtn) phaseEditCloseTaskBtn.addEventListener("click", ()=>{
      const id = (phaseEditTaskId || "").trim();
      if(!id) return;
      const saved = savePhaseEditor();
      if(!saved) return;
      if(closeTaskOverlay && closeTaskOverlay.classList.contains("show")) return;
      openCloseTaskModal(id);
    });
    if(phaseEditDeleteBtn) phaseEditDeleteBtn.addEventListener("click", deletePhaseEditor);
    if(phaseEditAttention) phaseEditAttention.addEventListener("change", togglePhaseEditAttention);
    if(phaseEditStatus) phaseEditStatus.addEventListener("change", togglePhaseSizeFields);
    const phaseEditFields = [phaseEditText, phaseEditDate, phaseEditPrazo, phaseEditPrazoHora, phaseEditStatus, phaseEditNovoPedido, phaseEditSizeFrom, phaseEditSizeTo, phaseEditRastreio];
    phaseEditFields.forEach(field=>{
      if(!field) return;
      const evt = (field.tagName === 'SELECT' || field.type === 'date' || field.type === 'time') ? 'change' : 'input';
      field.addEventListener(evt, ()=>{ clearFieldError(field); });
    });
    if(phaseEditOverlay){
      phaseEditOverlay.addEventListener("click", (e)=>{ if(e.target === phaseEditOverlay) closePhaseEditor(); });
      document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && phaseEditOverlay.classList.contains("show")) closePhaseEditor(); });
    }

    // scroll

    // theme
    themeToggleBtn.addEventListener("click", toggleTheme);
    if(sideMenuToggle){
      sideMenuToggle.addEventListener("click", ()=>{
        const isCollapsed = document.body.classList.contains("sideMenuCollapsed");
        setSideMenuCollapsed(!isCollapsed);
      });
    }

    // fechar app (PWA)
    function tryCloseApp(){
      allowAppClose = true;
      window.close();
      setTimeout(() => {
        if(!window.closed){
          showAlert("NÊo foi poss¦vel fechar a aba automaticamente. Feche manualmente.");
        }
        allowAppClose = false;
      }, 200);
    }

    function openCloseAppModal(){
      if(!closeAppOverlay) return;
      closeAppOverlay.classList.add("show");
    }
    function closeCloseAppModal(){
      if(!closeAppOverlay) return;
      closeAppOverlay.classList.remove("show");
    }

    if(appCloseBtn){
      appCloseBtn.addEventListener("click", openCloseAppModal);
    }
    if(closeTaskCancelBtn){
      closeTaskCancelBtn.addEventListener("click", closeCloseTaskModal);
    }
    if(closeTaskOverlay){
      closeTaskOverlay.addEventListener("click", (e)=>{ if(e.target === closeTaskOverlay) closeCloseTaskModal(); });
    }
    if(closeTaskNewPhaseBtn){
      closeTaskNewPhaseBtn.addEventListener("click", () => {
        const id = pendingCloseTaskId;
        const hasPending = pendingPhaseSave && pendingPhaseSave.taskId === id;
        closeCloseTaskModal();
        if(!hasPending){
          addPhaseFromCard(id);
        }
      });
    }
    if(closeTaskDoneBtn){
      closeTaskDoneBtn.addEventListener("click", () => {
        const id = pendingCloseTaskId;
        closeCloseTaskModal({ skipPending:true });
        closeTaskAsDone(id);
      });
    }
    if(backupMenuBtn){
      backupMenuBtn.addEventListener("click", ()=>{
        if(!backupOverlay) return;
        markOverlayForDrawerReturn(backupOverlay, [backupCloseBtn]);
        backupOverlay.classList.add("show");
      });
    }
    if(backupCloseBtn){
      backupCloseBtn.addEventListener("click", ()=>{
        if(backupOverlay) backupOverlay.classList.remove("show");
        handleDrawerReturnAfterClose(backupOverlay, [backupCloseBtn]);
      });
    }
    if(backupOverlay){
      backupOverlay.addEventListener("click", (e)=>{
        if(e.target !== backupOverlay) return;
        backupOverlay.classList.remove("show");
        handleDrawerReturnAfterClose(backupOverlay, [backupCloseBtn]);
      });
    }
    if(settingsBtn){
      settingsBtn.addEventListener("click", ()=>{
        if(!settingsOverlay) return;
        markOverlayForDrawerReturn(settingsOverlay, [settingsCloseBtn]);
        settingsOverlay.classList.add("show");
      });
    }
    if(settingsCloseBtn){
      settingsCloseBtn.addEventListener("click", ()=>{
        if(settingsOverlay) settingsOverlay.classList.remove("show");
        handleDrawerReturnAfterClose(settingsOverlay, [settingsCloseBtn]);
      });
    }
    if(settingsOverlay){
      settingsOverlay.addEventListener("click", (e)=>{
        if(e.target !== settingsOverlay) return;
        settingsOverlay.classList.remove("show");
        handleDrawerReturnAfterClose(settingsOverlay, [settingsCloseBtn]);
      });
      document.addEventListener("keydown", (e)=>{
        if(e.key !== "Escape" || !settingsOverlay.classList.contains("show")) return;
        settingsOverlay.classList.remove("show");
        handleDrawerReturnAfterClose(settingsOverlay, [settingsCloseBtn]);
      });
    }
    if(openStoresConfigBtn){
      openStoresConfigBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        if(settingsOverlay) settingsOverlay.classList.remove("show");
        clearDrawerReturnState(settingsOverlay, [settingsCloseBtn]);
        openStoresConfig();
      });
    }
    if(quickLinkSaveBtn){
      quickLinkSaveBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        saveQuickLinkModal();
      });
    }
    if(quickLinkCancelBtn){
      quickLinkCancelBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        closeQuickLinkModal();
        handleDrawerReturnAfterClose(quickLinkOverlay, [quickLinkCancelBtn]);
      });
    }
    if(quickLinkOverlay){
      quickLinkOverlay.addEventListener("click", (e)=>{
        if(e.target !== quickLinkOverlay) return;
        closeQuickLinkModal();
        handleDrawerReturnAfterClose(quickLinkOverlay, [quickLinkCancelBtn]);
      });
      document.addEventListener("keydown", (e)=>{
        if(e.key !== "Escape" || !quickLinkOverlay.classList.contains("show")) return;
        closeQuickLinkModal();
        handleDrawerReturnAfterClose(quickLinkOverlay, [quickLinkCancelBtn]);
      });
    }
    if(storesConfigAddBtn){
      storesConfigAddBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        if(storesDraft.length >= MAX_STORES) return;
        storesDraft.push({ name:"", logoUrl:"", siteUrl:"", stampsUrl:"", supportWhatsapp:"", instagramUrl:"", facebookUrl:"", tiktokUrl:"", youtubeUrl:"", pinterestUrl:"", metaInboxUrl:"", emailList: [] });
        renderStoresConfig();
        requestAnimationFrame(()=>{
          if(!storesConfigHost) return;
          const cards = storesConfigHost.querySelectorAll("[data-store-index]");
          const card = cards[cards.length - 1];
          if(!card) return;
          card.scrollIntoView({ behavior:"smooth", block:"start" });
          const firstInput = card.querySelector('input[data-store-field="name"]');
          if(firstInput) firstInput.focus();
        });
      });
    }
    if(storesConfigSaveBtn){
      storesConfigSaveBtn.addEventListener("click", async (e)=>{
        e.preventDefault();
        const next = collectStoresFromForm();
        if(!validateStoresConfigForm()) return;
        if(!next.length) return;
        const prevNames = getStoreNames();
        const nextNames = next.map(s => (s.name || "").toString()).filter(Boolean);
        const removedNames = prevNames.filter(name => !nextNames.includes(name));
        const hasStored = Boolean(storageGet(STORAGE_KEY_STORES));
        if(removedNames.length && hasStored){
          const lines = [
            "Voc\u00ea est\u00e1 removendo lojas do cadastro.",
            "",
            "Lojas removidas: " + removedNames.join(", "),
            "",
            "O sistema vai remover dados ligados a essas lojas:",
            "- Perguntas/Respostas e Tarefas Di\u00e1rias",
            "- Produtos e Hist\u00f3rico do Calend\u00e1rio",
            "- Links da Nuvemshop",
            "",
            "Os itens ser\u00e3o deletados definitivamente.",
            "",
            "Deseja continuar?"
          ];
          const ok = await showConfirm(lines.join("\n"), "Confirmar limpeza");
          if(!ok) return;
          cleanupStoreData(removedNames, nextNames);
        }
        saveStores(next);
        storesRequired = false;
        closeStoresConfig();
      });
    }
    if(storesConfigCloseBtn){
      storesConfigCloseBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        closeStoresConfig();
      });
    }
    if(storesConfigOverlay){
      storesConfigOverlay.addEventListener("click", (e)=>{ if(e.target === storesConfigOverlay) closeStoresConfig(); });
      document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && storesConfigOverlay.classList.contains("show")) closeStoresConfig(); });
    }
    if(storesConfigHost){
      storesConfigHost.addEventListener("click", async (e)=>{
        const addBtn = e.target.closest("[data-social-extra-add]");
        if(addBtn){
          const idx = Number(addBtn.getAttribute("data-social-extra-add"));
          if(Number.isNaN(idx) || !storesDraft[idx]) return;
          const next = storesDraft.slice();
          const extras = Array.isArray(next[idx].socialExtras) ? next[idx].socialExtras.slice() : [];
          extras.push({ name:"", url:"" });
          next[idx] = { ...next[idx], socialExtras: extras };
          storesDraft = next;
          renderStoresConfig();
          return;
        }
        const addEmailBtn = e.target.closest("[data-email-add]");
        if(addEmailBtn){
          const idx = Number(addEmailBtn.getAttribute("data-email-add"));
          if(Number.isNaN(idx) || !storesDraft[idx]) return;
          const next = storesDraft.slice();
          const emails = Array.isArray(next[idx].emailList) ? next[idx].emailList.slice() : [];
          emails.push({ email:"", openUrl:"" });
          next[idx] = { ...next[idx], emailList: emails };
          storesDraft = next;
          renderStoresConfig();
          return;
        }
        const removeExtraBtn = e.target.closest("[data-social-extra-remove]");
        if(removeExtraBtn){
          const row = removeExtraBtn.closest("[data-social-extra-row]");
          const card = removeExtraBtn.closest("[data-store-index]");
          if(!row || !card) return;
          const storeIdx = Number(card.getAttribute("data-store-index"));
          const extraIdx = Number(removeExtraBtn.getAttribute("data-social-extra-remove"));
          if(Number.isNaN(storeIdx) || Number.isNaN(extraIdx) || !storesDraft[storeIdx]) return;
          const next = storesDraft.slice();
          const extras = Array.isArray(next[storeIdx].socialExtras) ? next[storeIdx].socialExtras.slice() : [];
          extras.splice(extraIdx, 1);
          next[storeIdx] = { ...next[storeIdx], socialExtras: extras };
          storesDraft = next;
          renderStoresConfig();
          return;
        }
        const removeEmailBtn = e.target.closest("[data-email-remove]");
        if(removeEmailBtn){
          const row = removeEmailBtn.closest("[data-email-row]");
          const card = removeEmailBtn.closest("[data-store-index]");
          if(!row || !card) return;
          const storeIdx = Number(card.getAttribute("data-store-index"));
          const emailIdx = Number(removeEmailBtn.getAttribute("data-email-remove"));
          if(Number.isNaN(storeIdx) || Number.isNaN(emailIdx) || !storesDraft[storeIdx]) return;
          const next = storesDraft.slice();
          const emails = Array.isArray(next[storeIdx].emailList) ? next[storeIdx].emailList.slice() : [];
          emails.splice(emailIdx, 1);
          next[storeIdx] = { ...next[storeIdx], emailList: emails };
          storesDraft = next;
          renderStoresConfig();
          return;
        }
        const btn = e.target.closest("[data-store-remove]");
        if(!btn) return;
        const idx = Number(btn.getAttribute("data-store-remove"));
        if(Number.isNaN(idx)) return;
        const storeName = (storesDraft[idx]?.name || "").toString().trim() || `Loja ${idx + 1}`;
        const lines = [
          `Remover ${storeName}?`,
          "",
          "Os dados vinculados a essa loja ser\u00e3o deletados ao salvar.",
          "Deseja continuar?"
        ];
        const ok = await showConfirm(lines.join("\n"), "Confirmar remo\u00e7\u00e3o");
        if(!ok) return;
        storesDraft = storesDraft.filter((_, i) => i !== idx);
        renderStoresConfig();
      });
      storesConfigHost.addEventListener("input", (e)=>{
        const input = e.target;
        if(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement){
          clearFieldError(input);
        }
      });
      storesConfigHost.addEventListener("change", (e)=>{
        const input = e.target;
        if(!(input instanceof HTMLInputElement)) return;
        if(input.getAttribute("data-store-field") !== "logoFile") return;
        const file = input.files && input.files[0];
        if(!file) return;
        const card = input.closest("[data-store-index]");
        if(!card) return;
        const urlInput = card.querySelector('[data-store-field="logoUrl"]');
        const reader = new FileReader();
        reader.onload = () => {
          if(urlInput) urlInput.value = String(reader.result || "");
        };
        reader.readAsDataURL(file);
      });
    }
    if(quickLinksListAddBtn){
      quickLinksListAddBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        if(!currentQuickLinksListKey) return;
        closeQuickLinksListModal();
        clearDrawerReturnState(quickLinksListOverlay, [quickLinksListCloseBtn]);
        openQuickLinkModal(currentQuickLinksListKey, currentQuickLinksListLabel);
      });
    }
    if(quickLinksListCloseBtn){
      quickLinksListCloseBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        closeQuickLinksListModal();
        handleDrawerReturnAfterClose(quickLinksListOverlay, [quickLinksListCloseBtn]);
      });
    }
    if(quickLinksListOverlay){
      quickLinksListOverlay.addEventListener("click", (e)=>{
        if(e.target !== quickLinksListOverlay) return;
        closeQuickLinksListModal();
        handleDrawerReturnAfterClose(quickLinksListOverlay, [quickLinksListCloseBtn]);
      });
      document.addEventListener("keydown", (e)=>{
        if(e.key !== "Escape" || !quickLinksListOverlay.classList.contains("show")) return;
        closeQuickLinksListModal();
        handleDrawerReturnAfterClose(quickLinksListOverlay, [quickLinksListCloseBtn]);
      });
    }
    if(quickLinksListHost){
      quickLinksListHost.addEventListener("click", async (e)=>{
        const editBtn = e.target.closest("[data-quick-link-edit]");
        if(editBtn){
          const idx = parseInt((editBtn.getAttribute("data-quick-link-edit") || "-1"), 10);
          if(!Number.isFinite(idx) || idx < 0) return;
          openQuickLinkEditModal(currentQuickLinksListKey, currentQuickLinksListLabel, idx);
          return;
        }
        const delBtn = e.target.closest("[data-quick-link-del]");
        if(delBtn){
          const idx = parseInt((delBtn.getAttribute("data-quick-link-del") || "-1"), 10);
          if(!Number.isFinite(idx) || idx < 0) return;
          const list = Array.isArray(quickLinks[currentQuickLinksListKey]) ? quickLinks[currentQuickLinksListKey] : [];
          const item = list[idx];
          const label = item ? ((item.title || "").trim() || item.url) : "este link";
          const ok = await showConfirm(`Remover este bot\u00e3o?\n\n"${label}"\n\nConfirmar?`);
          if(!ok) return;
          deleteQuickLink(currentQuickLinksListKey, idx);
          renderQuickLinksList();
          return;
        }
        const btn = e.target.closest("[data-quick-link-url]");
        if(!btn) return;
        const url = (btn.getAttribute("data-quick-link-url") || "").trim();
        if(!url) return;
        window.open(url, "_blank");
      });
    }
    if(storeLinksGrid){
      storeLinksGrid.addEventListener("click", (e)=>{
        const btn = e.target.closest("[data-open-stores-config]");
        if(!btn) return;
        e.preventDefault();
        openStoresConfig();
      });
    }
    if(stampsLinksRow){
      stampsLinksRow.addEventListener("click", (e)=>{
        const btn = e.target.closest("[data-open-stores-config]");
        if(!btn) return;
        e.preventDefault();
        openStoresConfig();
      });
    }
    if(metaInboxGrid){
      metaInboxGrid.addEventListener("click", (e)=>{
        const btn = e.target.closest("[data-open-stores-config]");
        if(!btn) return;
        e.preventDefault();
        openStoresConfig();
      });
    }
    if(orderLookupBtn){
      orderLookupBtn.addEventListener("click", openHeaderNuvemshopSupport);
    }
    if(nuvemLinksCloseBtn){
      nuvemLinksCloseBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        closeNuvemLinksModal();
        handleDrawerReturnAfterClose(nuvemLinksOverlay, [nuvemLinksCloseBtn]);
      });
    }
    if(nuvemLinksOverlay){
      nuvemLinksOverlay.addEventListener("click", (e)=>{
        if(e.target !== nuvemLinksOverlay) return;
        closeNuvemLinksModal();
        handleDrawerReturnAfterClose(nuvemLinksOverlay, [nuvemLinksCloseBtn]);
      });
      document.addEventListener("keydown", (e)=>{
        if(e.key !== "Escape" || !nuvemLinksOverlay.classList.contains("show")) return;
        closeNuvemLinksModal();
        handleDrawerReturnAfterClose(nuvemLinksOverlay, [nuvemLinksCloseBtn]);
      });
    }
    if(nuvemLinksHost){
      nuvemLinksHost.addEventListener("click", (e)=>{
        const openBtn = e.target.closest("[data-nuvem-open]");
        if(openBtn){
          const store = (openBtn.getAttribute("data-nuvem-store") || "").trim();
          const id = (openBtn.getAttribute("data-nuvem-open") || "").trim();
          if(!store || !id) return;
          const item = findNuvemItem(store, id);
          if(item && item.url){
            window.open(item.url, "_blank");
          }else{
            openNuvemEditModal(store, id, false);
          }
          return;
        }
        const editBtn = e.target.closest("[data-nuvem-edit]");
        if(editBtn){
          const store = (editBtn.getAttribute("data-nuvem-store") || "").trim();
          const id = (editBtn.getAttribute("data-nuvem-edit") || "").trim();
          if(!store || !id) return;
          openNuvemEditModal(store, id, false);
          return;
        }
        const moveBtn = e.target.closest("[data-nuvem-move]");
        if(moveBtn){
          const store = (moveBtn.getAttribute("data-nuvem-store") || "").trim();
          const id = (moveBtn.getAttribute("data-nuvem-id") || "").trim();
          const dir = (moveBtn.getAttribute("data-nuvem-move") || "").trim();
          if(!store || !id || (dir !== "up" && dir !== "down")) return;
          const list = getNuvemList(store);
          const index = list.findIndex(item => item.id === id);
          if(index < 0) return;
          const target = dir === "up" ? index - 1 : index + 1;
          if(target < 0 || target >= list.length) return;
          const next = [...list];
          const temp = next[index];
          next[index] = next[target];
          next[target] = temp;
          saveNuvemLinks({ ...nuvemLinks, [store]: next });
          const newIndex = target;
          nuvemPageByStore[store] = Math.floor(newIndex / 3) + 1;
          return;
        }
        const prevBtn = e.target.closest("[data-nuvem-prev]");
        if(prevBtn){
          const store = (prevBtn.getAttribute("data-nuvem-prev") || "").trim();
          if(!store) return;
          const current = Number(nuvemPageByStore[store] || 1);
          nuvemPageByStore[store] = Math.max(1, current - 1);
          renderNuvemLinks();
          return;
        }
        const nextBtn = e.target.closest("[data-nuvem-next]");
        if(nextBtn){
          const store = (nextBtn.getAttribute("data-nuvem-next") || "").trim();
          if(!store) return;
          const list = getNuvemList(store);
          const totalPages = Math.max(1, Math.ceil(list.length / 3));
          const current = Number(nuvemPageByStore[store] || 1);
          nuvemPageByStore[store] = Math.min(totalPages, current + 1);
          renderNuvemLinks();
          return;
        }
        const addBtn = e.target.closest("[data-nuvem-add]");
        if(addBtn){
          const store = (addBtn.getAttribute("data-nuvem-add") || "").trim();
          if(!store) return;
          openNuvemEditModal(store, "", true);
        }
      });
    }
    if(nuvemEditSaveBtn){
      nuvemEditSaveBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        saveNuvemEditModal();
      });
    }
    if(nuvemEditCancelBtn){
      nuvemEditCancelBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        closeNuvemEditModal();
      });
    }
    if(nuvemEditCloseBtn){
      nuvemEditCloseBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        closeNuvemEditModal();
        openNuvemLinksModal();
      });
    }
    if(nuvemEditDeleteBtn){
      nuvemEditDeleteBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        deleteNuvemEditModal();
      });
    }
    if(nuvemEditOverlay){
      nuvemEditOverlay.addEventListener("click", (e)=>{ if(e.target === nuvemEditOverlay) closeNuvemEditModal(); });
      document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && nuvemEditOverlay.classList.contains("show")) closeNuvemEditModal(); });
    }
    if(storeLinksCloseBtn){
      storeLinksCloseBtn.addEventListener("click", ()=>{
        if(storeLinksOverlay) storeLinksOverlay.classList.remove("show");
        handleDrawerReturnAfterClose(storeLinksOverlay, [storeLinksCloseBtn]);
      });
    }
    if(storeLinksOverlay){
      storeLinksOverlay.addEventListener("click", (e)=>{
        if(e.target !== storeLinksOverlay) return;
        storeLinksOverlay.classList.remove("show");
        handleDrawerReturnAfterClose(storeLinksOverlay, [storeLinksCloseBtn]);
      });
      document.addEventListener("keydown", (e)=>{
        if(e.key !== "Escape" || !storeLinksOverlay.classList.contains("show")) return;
        storeLinksOverlay.classList.remove("show");
        handleDrawerReturnAfterClose(storeLinksOverlay, [storeLinksCloseBtn]);
      });
    }
    if(metaInboxCloseBtn){
      metaInboxCloseBtn.addEventListener("click", ()=>{
        if(metaInboxOverlay) metaInboxOverlay.classList.remove("show");
        handleDrawerReturnAfterClose(metaInboxOverlay, [metaInboxCloseBtn]);
      });
    }
    if(metaInboxOverlay){
      metaInboxOverlay.addEventListener("click", (e)=>{
        if(e.target !== metaInboxOverlay) return;
        metaInboxOverlay.classList.remove("show");
        handleDrawerReturnAfterClose(metaInboxOverlay, [metaInboxCloseBtn]);
      });
      document.addEventListener("keydown", (e)=>{
        if(e.key !== "Escape" || !metaInboxOverlay.classList.contains("show")) return;
        metaInboxOverlay.classList.remove("show");
        handleDrawerReturnAfterClose(metaInboxOverlay, [metaInboxCloseBtn]);
      });
    }
    if(emailMenuCloseBtn){
      emailMenuCloseBtn.addEventListener("click", ()=>{
        if(emailMenuOverlay) emailMenuOverlay.classList.remove("show");
        handleDrawerReturnAfterClose(emailMenuOverlay, [emailMenuCloseBtn]);
      });
    }
    if(emailMenuOverlay){
      emailMenuOverlay.addEventListener("click", (e)=>{
        if(e.target !== emailMenuOverlay) return;
        emailMenuOverlay.classList.remove("show");
        handleDrawerReturnAfterClose(emailMenuOverlay, [emailMenuCloseBtn]);
      });
      document.addEventListener("keydown", (e)=>{
        if(e.key !== "Escape" || !emailMenuOverlay.classList.contains("show")) return;
        emailMenuOverlay.classList.remove("show");
        handleDrawerReturnAfterClose(emailMenuOverlay, [emailMenuCloseBtn]);
      });
      emailMenuOverlay.addEventListener("click", async (e)=>{
        const btn = e.target.closest("[data-copy-email]");
        if(!btn) return;
        e.preventDefault();
        const email = (btn.getAttribute("data-copy-email") || "").trim();
        if(!email) return;
        await copyTextToClipboard(email, btn, "Copiado!");
      });
    }
    if(closeAppCancelBtn){
      closeAppCancelBtn.addEventListener("click", closeCloseAppModal);
    }
    if(closeAppOverlay){
      closeAppOverlay.addEventListener("click", (e)=>{ if(e.target === closeAppOverlay) closeCloseAppModal(); });
    }
    if(closeAppSaveBtn){
      closeAppSaveBtn.addEventListener("click", () => {
        exportFile();
        closeCloseAppModal();
        setTimeout(tryCloseApp, 150);
      });
    }
    if(closeAppCloseBtn){
      closeAppCloseBtn.addEventListener("click", () => {
        closeCloseAppModal();
        tryCloseApp();
      });
    }
    if(quickLinkButtons.length){
      quickLinkButtons.forEach((btn)=>{
        btn.addEventListener("click", (e)=>{
          const key = (btn.getAttribute("data-quick-link") || "").trim();
          if(!key) return;
          const label = (btn.getAttribute("title") || "atalho").trim();
          const list = Array.isArray(quickLinks[key]) ? quickLinks[key] : [];
          if(!list.length){
            if(key === "storeLinks" && storeLinksOverlay){
              storeLinksOverlay.classList.add("show");
              return;
            }
            if(key === "metaInbox" && metaInboxOverlay){
              markOverlayForDrawerReturn(metaInboxOverlay, [metaInboxCloseBtn]);
              metaInboxOverlay.classList.add("show");
              return;
            }
            if(key === "emailMenu" && emailMenuOverlay){
              markOverlayForDrawerReturn(emailMenuOverlay, [emailMenuCloseBtn]);
              emailMenuOverlay.classList.add("show");
              return;
            }
            e.preventDefault();
            openQuickLinkModal(key, label);
            return;
          }
          openQuickLinksListModal(key, label);
        });
      });
    }
    const quickLinkManageButtons = Array.from(document.querySelectorAll("[data-quick-link-manage]"));
    if(quickLinkManageButtons.length){
      quickLinkManageButtons.forEach((btn)=>{
        btn.addEventListener("click", (e)=>{
          e.preventDefault();
          const key = (btn.getAttribute("data-quick-link-manage") || "").trim();
          if(!key) return;
          const label = (btn.getAttribute("data-quick-link-label") || btn.getAttribute("title") || "Links").trim();
          openQuickLinksListModal(key, label, "manage");
        });
      });
    }

    // ===== Calend\u00e1rio (visualiza\u00e7\u00e3o) =====
    if(openCalendarBtn){
      openCalendarBtn.addEventListener("click", openCalendar);
    }
    if(closeCalendarBtn){
      closeCalendarBtn.addEventListener("click", closeCalendar);
    }
    if(calendarOverlay){
      calendarOverlay.addEventListener("click", (e)=>{
        if(e.target === calendarOverlay) closeCalendar();
        if(calFilterPanel && calFilterPanel.style.display === "block"){
          const isPanel = e.target.closest("#calFilterPanel");
          const isBtn = e.target.closest("#calFilterBtn");
          if(!isPanel && !isBtn){
            setCalendarFilterPanelOpen(false);
          }
        }
      });
      document.addEventListener("keydown", (e)=>{
        if(e.key === "Escape" && calendarOverlay.classList.contains("show")) closeCalendar();
      });
    }
    window.addEventListener("resize", ()=>{
      syncCalendarNavPlacement();
      renderCalendar();
    });
    if(miniCalendarGrid){
      miniCalendarGrid.addEventListener("click", (e)=>{
        const btn = e.target.closest("[data-mini-iso]");
        if(!btn) return;
        const iso = (btn.getAttribute("data-mini-iso") || "").trim();
        if(!iso) return;
        const parts = iso.split("-");
        if(parts.length === 3){
          const y = Number(parts[0]);
          const m = Number(parts[1]) - 1;
          if(Number.isFinite(y) && Number.isFinite(m)){
            calViewYear = y;
            calViewMonth = m;
          }
        }
        calSelectedISO = iso;
        openCalendar();
        renderCalendarDayDetails(iso, { scrollToFirst:true });
      });
    }
    if(calPrevMonth){
      calPrevMonth.addEventListener("click", ()=>{
        calViewMonth -= 1;
        if(calViewMonth < 0){ calViewMonth = 11; calViewYear -= 1; }
        renderCalendar();
      });
    }
    if(calNextMonth){
      calNextMonth.addEventListener("click", ()=>{
        calViewMonth += 1;
        if(calViewMonth > 11){ calViewMonth = 0; calViewYear += 1; }
        renderCalendar();
      });
    }
    if(calGrid){
      calGrid.addEventListener("click", (e)=>{
        const cell = e.target.closest("[data-iso],[data-cal-iso]");
        if(!cell) return;
        const iso = (cell.getAttribute("data-iso") || cell.getAttribute("data-cal-iso") || "").trim();
        if(!iso) return;
        if(calSelectedISO === iso){
          calSelectedISO = "";
          renderCalendar();
          renderCalendarDayDetails("");
          return;
        }
        calSelectedISO = iso;
        renderCalendar();
        renderCalendarDayDetails(iso, { scrollToFirst:true });
      });
      calGrid.addEventListener("keydown", (e)=>{
        if(e.key !== "Enter" && e.key !== " ") return;
        const cell = e.target.closest("[data-iso],[data-cal-iso]");
        if(!cell) return;
        e.preventDefault();
        const iso = (cell.getAttribute("data-iso") || cell.getAttribute("data-cal-iso") || "").trim();
        if(!iso) return;
        if(calSelectedISO === iso){
          calSelectedISO = "";
          renderCalendar();
          renderCalendarDayDetails("");
          return;
        }
        calSelectedISO = iso;
        renderCalendar();
        renderCalendarDayDetails(iso, { scrollToFirst:true });
      });
    }
    if(searchClearBtn){
      searchClearBtn.addEventListener("click", ()=>{
        if(searchInput) searchInput.value = "";
        if(currentView === "tasks"){
          tasksSearchQuery = "";
          tasksShowAll = false;
          tasksSingleIndex = 0;
          renderTasks();
          return;
        }
        if(currentView === "done"){
          doneSearchQuery = "";
          renderDoneTasks();
          return;
        }
        if(currentView === "users"){
          usersSearchName = "";
          usersSearchStore = "ALL";
          usersSearchStatus = "";
          if(usersSearchStoreSelect) usersSearchStoreSelect.value = "ALL";
          if(usersSearchStatusSelect) usersSearchStatusSelect.value = "";
          renderUsersView();
          updateUsersFilterButtonState();
          return;
        }
        if(searchStoreSelect) searchStoreSelect.value = "";
        showAllCards = false;
        currentSingleIndex = 0;
        render();
      });
    }
    document.addEventListener("click", (e)=>{
      const supportBtn = e.target.closest("[data-support-store],[data-cal-support-store]");
      if(supportBtn){
        e.preventDefault();
        e.stopPropagation();
        const storeName = (supportBtn.getAttribute("data-support-store") || supportBtn.getAttribute("data-cal-support-store") || "").toString().trim();
        let taskId = "";
        const calRow = supportBtn.closest(".calDetailRow");
        if(calRow){
          taskId = (calRow.getAttribute("data-cal-item-id") || "").trim();
        }else{
          const card = supportBtn.closest(".taskCard");
          taskId = card ? (card.getAttribute("data-task-id") || "").trim() : "";
        }
        openNuvemshopSupportPopup(storeName, taskId);
        return;
      }
      const customerBtn = e.target.closest("[data-customer-whatsapp]");
      if(!customerBtn) return;
      e.preventDefault();
      e.stopPropagation();
      const raw = (customerBtn.getAttribute("data-customer-whatsapp") || "").toString().trim();
      let taskId = "";
      const calRow = customerBtn.closest(".calDetailRow");
      if(calRow){
        taskId = (calRow.getAttribute("data-cal-item-id") || "").trim();
      }else{
        const card = customerBtn.closest(".taskCard");
        taskId = card ? (card.getAttribute("data-task-id") || "").trim() : "";
      }
      openCustomerWhatsappPopup(raw, taskId);
    });


    // ===== Buscar pedido (Nuvemshop) =====
    function openOrderLookup(){
      if(!orderLookupOverlay) return;
      markOverlayForDrawerReturn(orderLookupOverlay, [orderLookupCancelBtn]);
      orderLookupOverlay.classList.add("show");
      showOrderLookupMenu();
      if(orderLookupType) orderLookupType.value = "order";
      if(orderLookupQuery){
        orderLookupQuery.value = "";
        orderLookupQuery.placeholder = "Ex: 1701";
      }
    }
    function closeOrderLookup(){
      if(!orderLookupOverlay) return;
      orderLookupOverlay.classList.remove("show");
    }

    const ORDER_LINKS = {
      "Di\u00e1rio Nerdify": {
        produtos: "https://diarionerdify.lojavirtualnuvem.com.br/admin/v2/products?page=1",
        envios: "https://diarionerdify.lojavirtualnuvem.com.br/admin/v2/apps/nuvemenvio#/dashboard",
        mensagens: "https://diarionerdify.lojavirtualnuvem.com.br/admin/v2/messages?page=1",
        cupons: "https://diarionerdify.lojavirtualnuvem.com.br/admin/v2/coupons",
        novo: "https://diarionerdify.lojavirtualnuvem.com.br/admin/v2/draft-orders/new",
      },
      "Shop 80": {
        produtos: "https://shop802.lojavirtualnuvem.com.br/admin/v2/products?page=1",
        envios: "https://shop802.lojavirtualnuvem.com.br/admin/v2/apps/nuvemenvio#/dashboard",
        mensagens: "https://shop802.lojavirtualnuvem.com.br/admin/v2/messages?page=1",
        cupons: "https://shop802.lojavirtualnuvem.com.br/admin/v2/coupons",
        novo: "https://shop802.lojavirtualnuvem.com.br/admin/v2/draft-orders/new",
      }
    };

    function showOrderLookupMenu(){
      if(orderLookupMenu) orderLookupMenu.style.display = "grid";
      if(orderLookupFormWrap) orderLookupFormWrap.style.display = "none";
      if(closeOrderLookupBtn) closeOrderLookupBtn.style.display = "none";
      if(orderLookupGoBtn) orderLookupGoBtn.style.display = "none";
      if(orderLookupStore) orderLookupStore.value = "";
      if(orderLookupDetails) orderLookupDetails.style.display = "none";
    }

    function showOrderLookupSearch(store){
      if(orderLookupMenu) orderLookupMenu.style.display = "none";
      if(orderLookupFormWrap) orderLookupFormWrap.style.display = "block";
      if(closeOrderLookupBtn) closeOrderLookupBtn.style.display = "";
      if(orderLookupGoBtn) orderLookupGoBtn.style.display = "";
      if(orderLookupStore) orderLookupStore.value = store || "";
      if(orderLookupDetails) orderLookupDetails.style.display = store ? "block" : "none";
      if(orderLookupType) orderLookupType.value = "order";
      if(orderLookupQuery){
        orderLookupQuery.value = "";
        orderLookupQuery.placeholder = "Ex: 1701";
      }
    }
    function normalizeQueryForUrl(s){
      let q = encodeURIComponent((s||"").trim());
      // deixa parecido com o padr\u00e3o do exemplo (espa\u00e7os como +)
      q = q.replace(/%20/g, "+");
      return q;
    }
    function buildOrdersUrl(store, query){
      const base = (store === "Shop 80")
        ? "https://shop802.lojavirtualnuvem.com.br/admin/v2/orders?page=1&perPage=50&q="
        : "https://diarionerdify.lojavirtualnuvem.com.br/admin/v2/orders?page=1&perPage=50&q=";
      return base + normalizeQueryForUrl(query) + "&status=all";
    }
    function buildNuvemEnvioUrl(store){
      const raw = (store || "").toString();
      const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if(normalized.includes("shop 80")){
        return "https://shop802.lojavirtualnuvem.com.br/admin/v2/apps/nuvemenvio";
      }
      if(normalized.includes("diario nerdify") || normalized.includes("diario")){
        return "https://diarionerdify.lojavirtualnuvem.com.br/admin/v2/apps/nuvemenvio";
      }
      return "";
    }
    function runOrderLookup(){
      if(!orderLookupStore) return;
      const store = (orderLookupStore.value || "").trim();
      if(!store){
        showAlert("Escolha a loja.");
        return;
      }
      if(!orderLookupQuery){
        showAlert("Digite a informa\u00e7\u00e3o do cliente.");
        return;
      }
      const q = (orderLookupQuery.value || "").trim();
      if(!q){
        showAlert("Digite a informa\u00e7\u00e3o do cliente.");
        orderLookupQuery.focus();
        return;
      }
      const url = buildOrdersUrl(store, q);
      window.open(url, "_blank");
      closeOrderLookup();
      clearDrawerReturnState(orderLookupOverlay, [orderLookupCancelBtn]);
    }

    if(closeOrderLookupBtn){
      closeOrderLookupBtn.addEventListener("click", showOrderLookupMenu);
    }
    if(orderLookupCancelBtn){
      orderLookupCancelBtn.addEventListener("click", ()=>{
        closeOrderLookup();
        handleDrawerReturnAfterClose(orderLookupOverlay, [orderLookupCancelBtn]);
      });
    }
    if(orderLookupOverlay){
      orderLookupOverlay.addEventListener("click", (e)=>{
        if(e.target !== orderLookupOverlay) return;
        closeOrderLookup();
        handleDrawerReturnAfterClose(orderLookupOverlay, [orderLookupCancelBtn]);
      });
    }
    document.addEventListener("keydown", (e)=>{
      if(e.key !== "Escape" || !orderLookupOverlay || !orderLookupOverlay.classList.contains("show")) return;
      closeOrderLookup();
      handleDrawerReturnAfterClose(orderLookupOverlay, [orderLookupCancelBtn]);
    });

    if(orderLookupStore){
      orderLookupStore.addEventListener("change", ()=>{
        if(!orderLookupDetails) return;
        const v = (orderLookupStore.value || "").trim();
        orderLookupDetails.style.display = v ? "block" : "none";
      });
    }
    if(orderLookupMenu){
      orderLookupMenu.addEventListener("click", (e)=>{
        const btn = e.target.closest("[data-order-action]");
        if(!btn) return;
        e.preventDefault();
        const action = (btn.getAttribute("data-order-action") || "").trim();
        const store = (btn.getAttribute("data-order-store") || "").trim();
        if(action === "vendas"){
          showOrderLookupSearch(store);
          return;
        }
        const links = ORDER_LINKS[store];
        const url = links ? links[action] : "";
        if(url) window.open(url, "_blank");
      });
    }
    if(orderLookupType){
      orderLookupType.addEventListener("change", ()=>{
        if(!orderLookupQuery) return;
        const t = orderLookupType.value;
        if(t === "email"){
          orderLookupQuery.placeholder = "Ex: ana.abras@yahoo.com.br";
        }else if(t === "name"){
          orderLookupQuery.placeholder = "Ex: Ana Elisa Abras Nascimento";
        }else{
          orderLookupQuery.placeholder = "Ex: 1701";
        }
      });
    }
    if(orderLookupGoBtn){
      orderLookupGoBtn.addEventListener("click", runOrderLookup);
    }
    if(orderLookupQuery){
      orderLookupQuery.addEventListener("keydown", (e)=>{
        if(e.key === "Enter"){
          e.preventDefault();
          runOrderLookup();
        }
      });
    }


    // nav drawer (2 bot\u00f5es)
navAtalhosBtn.addEventListener("click", ()=>{
  // sempre volta para o buscador
  setView("search");
  closeDrawer();

  // depois rola at\u00e9 os atalhos
  setTimeout(() => {
    drawerBd.scrollTo({
      top: atalhosCreateCard.offsetTop - 8,
      behavior: "smooth"
    });
  }, 150);
});
    

    navToggleViewBtn.addEventListener("click", ()=>{
      tasksTypeFilter = "normal";
      setView("tasks");
      closeDrawer();
    });
    if(navTasksExtraBtn){
      navTasksExtraBtn.addEventListener("click", ()=>{
        tasksTypeFilter = "extra";
        setView("tasks");
        closeDrawer();
      });
    }
    if(navUsersBtn){
      navUsersBtn.addEventListener("click", ()=>{
        setView("users");
        closeDrawer();
      });
    }
    if(goToSearchBtn){
      goToSearchBtn.addEventListener("click", ()=>{
        setView("search");
      });
    }
    if(goToTasksBtn){
      goToTasksBtn.addEventListener("click", ()=>{
        tasksTypeFilter = "normal";
        setView("tasks");
      });
    }
    if(goToTasksExtraBtn){
      goToTasksExtraBtn.addEventListener("click", ()=>{
        tasksTypeFilter = "extra";
        setView("tasks");
      });
    }
    if(goToDoneTasksBtn){
      goToDoneTasksBtn.addEventListener("click", ()=>{
        setView("done");
      });
    }
    if(goToUsersBtn){
      goToUsersBtn.addEventListener("click", ()=>{
        setView("users");
      });
    }


    // tasks events (sem senha)
    tasksSaveBtn.addEventListener("click", startTaskPhaseFlow);
    tasksClearBtn.addEventListener("click", clearTasksForm);
    if(tData) tData.addEventListener("change", ()=>{ clearFieldError(tData); });
    if(tCliente) tCliente.addEventListener("input", ()=>{ clearFieldError(tCliente); });
    if(tLoja) tLoja.addEventListener("change", ()=>{ clearFieldError(tLoja); });
    if(tPedido) tPedido.addEventListener("input", ()=>{ clearFieldError(tPedido); });

    // WhatsApp Cliente
    if(tWhatsapp){
      tWhatsapp.addEventListener("input", ()=>{ clearFieldError(tWhatsapp); updateWhatsappPreview(); });
      updateWhatsappPreview();
    }
    if(tWhatsappBtn){
      tWhatsappBtn.addEventListener("click", (ev)=>{
        ev.preventDefault();
        openCustomerWhatsapp(tWhatsapp ? tWhatsapp.value : "");
      });
    }

    // descri\u00e7\u00e3o (fases) - adicionar/excluir via delega\u00e7\u00e3o
    if(obsList){
      obsList.addEventListener("click", (e)=>{
        const t = e.target;
        if(!(t instanceof Element)) return;

        const add = t.closest("[data-obs-add]");
        if(add){
          e.preventDefault();
          const blocks = obsList.querySelectorAll(".descPhase");
          const nextIdx = blocks.length;
          if(blocks.length){
            const prevStatus = blocks[blocks.length - 1].querySelector("select.obsStatus");
            if(prevStatus) prevStatus.value = PHASE_STATUS_DONE;
          }
          if(blocks.length){
            const prevBlock = blocks[blocks.length - 1];
            if(prevBlock) prevBlock.dataset.state = PHASE_STATE_DONE;
          }
          obsList.appendChild(createDescPhaseBlock(nextIdx, {
            text:"",
            date:"",
            novoPedido:"",
            rastreio:"",
            status: "",
            state: PHASE_STATE_ACTIVE
          }));
          updateDescPhaseButtonsState();
          const last = obsList.querySelector(`.descPhase[data-index="${nextIdx}"] textarea.obsItem`);
          if(last) last.focus();
          return;
        }

        const del = t.closest("[data-obs-del]");
        if(del){
          e.preventDefault();
          const blocks = Array.from(obsList.querySelectorAll(".descPhase"));
          if(blocks.length <= 1) return;
          const idx = Number(del.getAttribute("data-obs-del"));
          const el = blocks[idx];
          if(el && el.parentElement === obsList){
            obsList.removeChild(el);
            updateDescPhaseButtonsState();
          }
        }
      });
    }

    // busca + pagina\u00e7\u00e3o da lista de chamados
    if(tasksSearch){
      tasksSearch.addEventListener("input", ()=>{
        tasksSearchQuery = (tasksSearch.value || "");
        tasksShowAll = false;
        tasksSingleIndex = 0;
        renderTasks();
        updateFilterButtonsState();
      });
    }
    if(tasksSearchStore){
      tasksSearchStore.addEventListener("change", ()=>{
        tasksSearchStoreValue = (tasksSearchStore.value || "").trim();
        tasksShowAll = false;
        tasksSingleIndex = 0;
        renderTasks();
        updateFilterButtonsState();
      });
    }
    if(tasksSearchPeriod){
      tasksSearchPeriod.addEventListener("change", ()=>{
        tasksSearchPeriodValue = (tasksSearchPeriod.value || "").trim();
        if(tasksSearchPeriodCustom){
          tasksSearchPeriodCustom.style.display = tasksSearchPeriodValue === "CUSTOM" ? "block" : "none";
        }
        tasksShowAll = false;
        tasksSingleIndex = 0;
        renderTasks();
        updateFilterButtonsState();
      });
    }
    if(tasksSearchPeriodFrom){
      tasksSearchPeriodFrom.addEventListener("change", ()=>{
        tasksSearchPeriodFromValue = (tasksSearchPeriodFrom.value || "").trim();
        tasksShowAll = false;
        tasksSingleIndex = 0;
        renderTasks();
        updateFilterButtonsState();
      });
    }
    if(tasksSearchPeriodTo){
      tasksSearchPeriodTo.addEventListener("change", ()=>{
        tasksSearchPeriodToValue = (tasksSearchPeriodTo.value || "").trim();
        tasksShowAll = false;
        tasksSingleIndex = 0;
        renderTasks();
        updateFilterButtonsState();
      });
    }
    if(doneSearchStore){
      doneSearchStore.addEventListener("change", ()=>{
        doneSearchStoreValue = (doneSearchStore.value || "").trim();
        renderDoneTasks();
        updateFilterButtonsState();
      });
    }
    if(doneSearchPeriod){
      doneSearchPeriod.addEventListener("change", ()=>{
        doneSearchPeriodValue = (doneSearchPeriod.value || "").trim();
        if(doneSearchPeriodCustom){
          doneSearchPeriodCustom.style.display = doneSearchPeriodValue === "CUSTOM" ? "block" : "none";
        }
        renderDoneTasks();
        updateFilterButtonsState();
      });
    }
    if(doneSearchPeriodFrom){
      doneSearchPeriodFrom.addEventListener("change", ()=>{
        doneSearchPeriodFromValue = (doneSearchPeriodFrom.value || "").trim();
        renderDoneTasks();
        updateFilterButtonsState();
      });
    }
    if(doneSearchPeriodTo){
      doneSearchPeriodTo.addEventListener("change", ()=>{
        doneSearchPeriodToValue = (doneSearchPeriodTo.value || "").trim();
        renderDoneTasks();
        updateFilterButtonsState();
      });
    }
    if(tasksSearchStatus){
      const opts = ['<option value="" selected>Status: todos</option>'];
      PHASE_STATUS_OPTIONS.forEach(g => {
        opts.push(`<optgroup label="${escapeHtml(g.group)}">`);
        (g.options || []).forEach(txt => {
          opts.push(`<option value="${escapeHtml(txt)}">${escapeHtml(txt)}</option>`);
        });
        opts.push(`</optgroup>`);
      });
      tasksSearchStatus.innerHTML = opts.join("");
      tasksSearchStatus.addEventListener("change", ()=>{
        tasksSearchStatusValue = (tasksSearchStatus.value || "").trim();
        tasksShowAll = false;
        tasksSingleIndex = 0;
        renderTasks();
        updateFilterButtonsState();
      });
    }
    if(doneSearchStatus){
      const opts = ['<option value="" selected>Status: todos</option>'];
      PHASE_STATUS_OPTIONS.forEach(g => {
        opts.push(`<optgroup label="${escapeHtml(g.group)}">`);
        (g.options || []).forEach(txt => {
          opts.push(`<option value="${escapeHtml(txt)}">${escapeHtml(txt)}</option>`);
        });
        opts.push(`</optgroup>`);
      });
      doneSearchStatus.innerHTML = opts.join("");
      doneSearchStatus.addEventListener("change", ()=>{
        doneSearchStatusValue = (doneSearchStatus.value || "").trim();
        renderDoneTasks();
        updateFilterButtonsState();
      });
    }
    if(tasksFilterBtn && tasksFiltersOverlay){
      tasksFilterBtn.addEventListener("click", ()=>{
        if(tasksSearchPeriodCustom && tasksSearchPeriod){
          const val = (tasksSearchPeriod.value || "").trim();
          tasksSearchPeriodCustom.style.display = val === "CUSTOM" ? "block" : "none";
        }
        tasksFiltersOverlay.classList.add("show");
      });
    }
    if(tasksFiltersCloseBtn && tasksFiltersOverlay){
      tasksFiltersCloseBtn.addEventListener("click", ()=> tasksFiltersOverlay.classList.remove("show"));
    }
    if(tasksFiltersApplyBtn && tasksFiltersOverlay){
      tasksFiltersApplyBtn.addEventListener("click", ()=>{
        tasksSearchStoreValue = (tasksSearchStore ? (tasksSearchStore.value || "").trim() : "");
        tasksSearchPeriodValue = (tasksSearchPeriod ? (tasksSearchPeriod.value || "").trim() : "ALL");
        tasksSearchPeriodFromValue = (tasksSearchPeriodFrom ? (tasksSearchPeriodFrom.value || "").trim() : "");
        tasksSearchPeriodToValue = (tasksSearchPeriodTo ? (tasksSearchPeriodTo.value || "").trim() : "");
        tasksSearchStatusValue = (tasksSearchStatus ? (tasksSearchStatus.value || "").trim() : "");
        tasksShowAll = false;
        tasksSingleIndex = 0;
        renderTasks();
        tasksFiltersOverlay.classList.remove("show");
        updateFilterButtonsState();
      });
    }
    if(tasksFiltersClearBtn){
      tasksFiltersClearBtn.addEventListener("click", ()=>{
        if(tasksSearchStore) tasksSearchStore.value = "";
        if(tasksSearchPeriod) tasksSearchPeriod.value = "ALL";
        if(tasksSearchPeriodCustom) tasksSearchPeriodCustom.style.display = "none";
        if(tasksSearchPeriodFrom) tasksSearchPeriodFrom.value = "";
        if(tasksSearchPeriodTo) tasksSearchPeriodTo.value = "";
        if(tasksSearchStatus) tasksSearchStatus.value = "";
        tasksSearchStoreValue = "";
        tasksSearchPeriodValue = "ALL";
        tasksSearchPeriodFromValue = "";
        tasksSearchPeriodToValue = "";
        tasksSearchStatusValue = "";
        tasksShowAll = false;
        tasksSingleIndex = 0;
        renderTasks();
        updateFilterButtonsState();
      });
    }
    if(doneFiltersCloseBtn && doneFiltersOverlay){
      doneFiltersCloseBtn.addEventListener("click", ()=> doneFiltersOverlay.classList.remove("show"));
    }
    if(doneFiltersApplyBtn && doneFiltersOverlay){
      doneFiltersApplyBtn.addEventListener("click", ()=>{
        doneSearchStoreValue = (doneSearchStore ? (doneSearchStore.value || "").trim() : "");
        doneSearchPeriodValue = (doneSearchPeriod ? (doneSearchPeriod.value || "").trim() : "ALL");
        doneSearchPeriodFromValue = (doneSearchPeriodFrom ? (doneSearchPeriodFrom.value || "").trim() : "");
        doneSearchPeriodToValue = (doneSearchPeriodTo ? (doneSearchPeriodTo.value || "").trim() : "");
        doneSearchStatusValue = (doneSearchStatus ? (doneSearchStatus.value || "").trim() : "");
        renderDoneTasks();
        doneFiltersOverlay.classList.remove("show");
        updateFilterButtonsState();
      });
    }
    if(doneFiltersClearBtn){
      doneFiltersClearBtn.addEventListener("click", ()=>{
        if(doneSearchStore) doneSearchStore.value = "";
        if(doneSearchPeriod) doneSearchPeriod.value = "ALL";
        if(doneSearchPeriodCustom) doneSearchPeriodCustom.style.display = "none";
        if(doneSearchPeriodFrom) doneSearchPeriodFrom.value = "";
        if(doneSearchPeriodTo) doneSearchPeriodTo.value = "";
        if(doneSearchStatus) doneSearchStatus.value = "";
        doneSearchStoreValue = "";
        doneSearchPeriodValue = "ALL";
        doneSearchPeriodFromValue = "";
        doneSearchPeriodToValue = "";
        doneSearchStatusValue = "";
        renderDoneTasks();
        updateFilterButtonsState();
      });
    }
    if(tasksSearchClearBtn){
      tasksSearchClearBtn.addEventListener("click", ()=>{
        if(tasksSearch) tasksSearch.value = "";
        tasksSearchQuery = "";
        if(tasksSearchStore) tasksSearchStore.value = "";
        tasksSearchStoreValue = "";
        if(tasksSearchPeriod) tasksSearchPeriod.value = "ALL";
        tasksSearchPeriodValue = "ALL";
        if(tasksSearchPeriodCustom) tasksSearchPeriodCustom.style.display = "none";
        if(tasksSearchPeriodFrom) tasksSearchPeriodFrom.value = "";
        if(tasksSearchPeriodTo) tasksSearchPeriodTo.value = "";
        tasksSearchPeriodFromValue = "";
        tasksSearchPeriodToValue = "";
        if(tasksSearchStatus) tasksSearchStatus.value = "";
        tasksSearchStatusValue = "";
        tasksShowAll = false;
        tasksSingleIndex = 0;
        renderTasks();
        updateFilterButtonsState();
      });
    }
    if(tasksNextBtn){
      tasksNextBtn.addEventListener("click", ()=>{
        const filtered = getFilteredTasks();
        if(!filtered.length) return;
        tasksShowAll = false;
        tasksSingleIndex = (tasksSingleIndex + 1) % filtered.length;
        renderTasks();
      });
    }
    if(tasksAllBtn){
      tasksAllBtn.addEventListener("click", ()=>{
        tasksShowAll = true;
        renderTasks();
      });
    }
    if(tasksSingleBtn){
      tasksSingleBtn.addEventListener("click", ()=>{
        tasksShowAll = false;
        tasksSingleIndex = 0;
        renderTasks();
      });
    }
    if(loginForm){
      loginForm.addEventListener("submit", handleLoginSubmit);
    }
    if(loginPasswordToggle && loginPassword){
      loginPasswordToggle.addEventListener("click", ()=>{
        const isHidden = loginPassword.type === "password";
        loginPassword.type = isHidden ? "text" : "password";
        const label = isHidden ? "Ocultar senha" : "Mostrar senha";
        loginPasswordToggle.setAttribute("aria-label", label);
        loginPasswordToggle.setAttribute("title", label);
      });
    }
    if(setupForm){
      setupForm.addEventListener("submit", handleSetupSubmit);
    }
    if(resetRequestForm){
      resetRequestForm.addEventListener("submit", handleResetRequestSubmit);
    }
    if(resetPasswordForm){
      resetPasswordForm.addEventListener("submit", handleResetPasswordSubmit);
    }
    if(forgotPasswordLink){
      forgotPasswordLink.addEventListener("click", ()=>{
        showAuthOverlay("reset_request", "Informe seu e-mail ou usuario.");
      });
    }
    if(openRegisterBtn){
      openRegisterBtn.addEventListener("click", ()=>{
        if(currentUser && !isPrincipalUser() && !isAdminUser()){
          setAuthError("Apenas o usu\u00e1rio principal pode cadastrar novos usu\u00e1rios.");
          return;
        }
        showAuthOverlay("register");
      });
    }
    if(addUserBtn){
      addUserBtn.addEventListener("click", ()=>{
        showAuthOverlay("register", "Crie um usu\u00e1rio secund\u00e1rio.");
      });
    }
    if(usersRefreshBtn){
      usersRefreshBtn.addEventListener("click", async ()=>{
        if(!canAccessUsersView()) return;
        usersRefreshBtn.classList.remove("isSuccess", "isError");
        usersRefreshBtn.classList.add("isLoading");
        usersRefreshBtn.disabled = true;
        const ok = await refreshUsersView();
        usersRefreshBtn.disabled = false;
        usersRefreshBtn.classList.remove("isLoading");
        usersRefreshBtn.classList.add(ok ? "isSuccess" : "isError");
        setUsersRefreshStatus(
          ok ? `Atualizado \u00e0s ${formatTimeShort()}` : "Falha ao atualizar",
          !ok
        );
        setTimeout(()=> usersRefreshBtn.classList.remove("isSuccess", "isError"), 700);
      });
    }
    if(resendVerificationBtn){
      resendVerificationBtn.addEventListener("click", async ()=>{
        const username = (loginUsername?.value || "").trim();
        if(!username){
          setAuthError("Informe o usu\u00e1rio para reenviar o c\u00f3digo.");
          return;
        }
        try{
          await apiRequest(`${API_BASE}/resend_verification.php`, { username });
          setAuthError("Enviamos um novo e-mail de confirma\u00e7\u00e3o.");
          resendVerificationBtn.style.display = "none";
        }catch(err){
          const msg = (err && err.message) ? String(err.message) : "";
          if(msg === "email_already_verified"){
            setAuthError("Seu e-mail j\u00e1 est\u00e1 confirmado.");
          }else if(msg === "email_invalid"){
            setAuthError("E-mail do usu\u00e1rio n\u00e3o est\u00e1 v\u00e1lido.");
          }else if(msg === "user_not_found"){
            setAuthError("Usu\u00e1rio n\u00e3o encontrado.");
          }else if(msg === "email_send_failed"){
            setAuthError("N\u00e3o foi poss\u00edvel enviar o e-mail. Verifique a configura\u00e7\u00e3o do servidor.");
          }else{
            setAuthError("N\u00e3o foi poss\u00edvel reenviar o e-mail.");
          }
        }
      });
    }
      if(backToLoginBtn){
        backToLoginBtn.addEventListener("click", ()=>{
          if(authMode === "register" && authRegisterFromApp){
            hideAuthOverlay();
            return;
          }
          showAuthOverlay(needsSetupFlag ? "setup" : "login");
        });
      }
    if(setupCaptchaRefreshBtn){
      setupCaptchaRefreshBtn.addEventListener("click", (e)=>{
        e.preventDefault();
      });
    }
    if(openUserProfileBtn){
      openUserProfileBtn.addEventListener("click", ()=> openUserProfileOverlay({ required:false }));
    }
    if(userProfileCloseBtn){
      userProfileCloseBtn.addEventListener("click", closeUserProfileOverlay);
    }
    if(userProfileOverlay){
      userProfileOverlay.addEventListener("click", (e)=>{
        if(e.target !== userProfileOverlay) return;
        closeUserProfileOverlay();
      });
      document.addEventListener("keydown", (e)=>{
        if(e.key === "Escape" && userProfileOverlay.classList.contains("show")){
          closeUserProfileOverlay();
        }
      });
    }
    if(userActivityOverlay){
      userActivityOverlay.addEventListener("click", (e)=>{
        if(e.target !== userActivityOverlay) return;
        closeUserActivity();
      });
      document.addEventListener("keydown", (e)=>{
        if(e.key === "Escape" && userActivityOverlay.classList.contains("show")){
          closeUserActivity();
        }
      });
    }
    if(userActivityCloseBtn){
      userActivityCloseBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        closeUserActivity();
      });
    }
    if(usersFiltersCloseBtn && usersFiltersOverlay){
      usersFiltersCloseBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        usersFiltersOverlay.classList.remove("show");
      });
    }
    if(usersFiltersApplyBtn && usersFiltersOverlay){
      usersFiltersApplyBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        usersSearchStore = (usersSearchStoreSelect ? (usersSearchStoreSelect.value || "").trim() : "ALL") || "ALL";
        usersSearchStatus = (usersSearchStatusSelect ? (usersSearchStatusSelect.value || "").trim() : "");
        usersFiltersOverlay.classList.remove("show");
        renderUsersView();
        updateUsersFilterButtonState();
      });
    }
    if(usersFiltersClearBtn){
      usersFiltersClearBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        usersSearchStore = "ALL";
        usersSearchStatus = "";
        if(usersSearchStoreSelect) usersSearchStoreSelect.value = "ALL";
        if(usersSearchStatusSelect) usersSearchStatusSelect.value = "";
        if(usersFiltersOverlay) usersFiltersOverlay.classList.remove("show");
        renderUsersView();
        updateUsersFilterButtonState();
      });
    }
    if(userActivityBackBtn){
      userActivityBackBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        closeUserActivity();
      });
    }
    if(userProfileAvatarBtn && userProfileAvatarFile){
      userProfileAvatarBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        userProfileAvatarFile.value = "";
        userProfileAvatarFile.click();
      });
    }
    if(userProfileAvatarFile){
      userProfileAvatarFile.addEventListener("change", async ()=>{
        const file = userProfileAvatarFile.files && userProfileAvatarFile.files[0];
        if(!file) return;
        try{
          const filename = await apiUploadImage(file, "app/geral");
          userProfileAvatarPending = filename;
          const name = (userProfileName?.value || "").trim();
          setAvatarElements(userProfileAvatarImg, userProfileAvatarFallback, name, filename);
          clearFieldError(userProfileAvatarFile);
        }catch(err){
          setFieldError(userProfileAvatarFile, "Nao foi possivel enviar a imagem.");
        }
      });
    }
    if(userProfileAvatarClearBtn){
      userProfileAvatarClearBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        userProfileAvatarPending = "";
        const name = (userProfileName?.value || "").trim();
        setAvatarElements(userProfileAvatarImg, userProfileAvatarFallback, name, "");
      });
    }
    if(userProfileName){
      userProfileName.addEventListener("input", ()=>{
        clearFieldError(userProfileName);
        const name = (userProfileName.value || "").trim();
        setAvatarElements(userProfileAvatarImg, userProfileAvatarFallback, name, userProfileAvatarPending);
      });
    }
    if(userProfileDoc){
      userProfileDoc.addEventListener("input", ()=>{ clearFieldError(userProfileDoc); });
    }
    if(userProfileWhatsapp){
      userProfileWhatsapp.addEventListener("input", ()=>{ clearFieldError(userProfileWhatsapp); });
    }
    if(userProfileEmail){
      userProfileEmail.addEventListener("input", ()=>{ clearFieldError(userProfileEmail); });
    }
    if(userProfileSaveBtn){
      userProfileSaveBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        handleUserProfileSave();
      });
    }
    if(userProfileNextBtn){
      userProfileNextBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        handleUserProfileSave();
      });
    }
    if(userProfileLogoutBtn){
      userProfileLogoutBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        handleUserProfileLogout();
      });
    }
    if(userProfileStoresBtn){
      userProfileStoresBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        openStoresConfig();
      });
    }

    function hasOpenOverlay(){
      const overlays = [
        taskOverlay,
        questionOverlay,
        phaseEditOverlay,
        menuEditOverlay,
        closeTaskOverlay,
        backupOverlay,
        userProfileOverlay
      ].filter(Boolean);
      return overlays.some(el => el.classList.contains("show"));
    }

    window.addEventListener("beforeunload", (e) => {
      if(allowAppClose) return;
      if(!hasOpenOverlay()) return;
      e.preventDefault();
      e.returnValue = "";
    });


    /***********************
     * AUTH / STORAGE BOOTSTRAP
     ***********************/
    let authResolver = null;
    let authRegisterFromApp = false;

    function showAuthOverlay(mode, hint){
      if(!authOverlay) return;
      authMode = (mode === "register") ? "register" : (mode === "setup" ? "setup" : (mode === "reset_request" ? "reset_request" : (mode === "reset_password" ? "reset_password" : "login")));
      authRegisterFromApp = authMode === "register" && Boolean(currentUser && currentUser.id);
      const isSetup = authMode !== "login";
      if(loginForm) loginForm.style.display = authMode === "login" ? "flex" : "none";
      if(setupForm) setupForm.style.display = authMode === "setup" || authMode === "register" ? "flex" : "none";
      if(resetRequestForm) resetRequestForm.style.display = authMode === "reset_request" ? "flex" : "none";
      if(resetPasswordForm) resetPasswordForm.style.display = authMode === "reset_password" ? "flex" : "none";
      if(authTitle){
        authTitle.textContent = authMode === "setup"
          ? "Criar primeiro usuario"
          : (authMode === "register"
            ? "Criar conta"
            : (authMode === "reset_request"
              ? "Recuperar senha"
              : (authMode === "reset_password" ? "Definir nova senha" : "Entrar")));
      }
      if(authHint){
        const defaultHint = authMode === "setup"
          ? "Crie o primeiro usuario para comecar."
          : (authMode === "register"
            ? (authRegisterFromApp
              ? "Crie um usuario secundario."
              : "Crie sua conta, confirme o e-mail e aguarde liberacao.")
            : (authMode === "reset_request"
              ? "Informe seu e-mail ou usu\u00e1rio para receber o link."
              : (authMode === "reset_password" ? "Crie uma nova senha para acessar." : "")));
        authHint.textContent = hint || defaultHint;
      }
      if(authRegisterFromApp){
        if(authHint){
          authHint.textContent = "";
          authHint.style.display = "none";
        }
        if(authOr) authOr.style.display = "none";
        if(authGoogleBtn) authGoogleBtn.style.display = "none";
        if(authPartner) authPartner.style.display = "none";
        if(authCoupon) authCoupon.style.display = "none";
      }else{
        if(authHint) authHint.style.display = authHint.textContent ? "block" : "";
        if(authOr) authOr.style.display = "";
        if(authGoogleBtn) authGoogleBtn.style.display = "";
        if(authPartner) authPartner.style.display = "";
        if(authCoupon) authCoupon.style.display = "";
      }
      if(userRoleLabel){
        if(authMode === "setup"){
          userRoleLabel.textContent = "Usu\u00e1rio principal";
        }else if(authMode === "register"){
          userRoleLabel.textContent = authRegisterFromApp ? "Usu\u00e1rio secund\u00e1rio" : "Usu\u00e1rio principal";
        }else{
          userRoleLabel.textContent = "";
        }
      }
        if(authError){
          authError.style.display = "none";
          authError.textContent = "";
        }
        if(resendVerificationBtn) resendVerificationBtn.style.display = "none";
      if(isSetup) loadSetupCaptcha();
        if(authLoginActions) authLoginActions.style.display = authMode === "login" ? "flex" : "none";
        if(authSetupActions) authSetupActions.style.display = "none";
        if(backToLoginBtn) backToLoginBtn.style.display = authMode === "register" || authMode === "reset_request" || authMode === "reset_password" ? "inline-flex" : "none";
      authOverlay.classList.add("show");
      authOverlay.setAttribute("aria-hidden", "false");
    }

    function hideAuthOverlay(){
      if(!authOverlay) return;
      authOverlay.classList.remove("show");
      authOverlay.setAttribute("aria-hidden", "true");
    }

    function setAuthError(message, options){
      if(!authError) return;
      const msg = message || "Falha na autenticacao.";
      if(options && options.html){
        authError.innerHTML = msg;
      }else{
        authError.textContent = msg;
      }
      authError.style.display = "block";
    }

    async function loadSetupCaptcha(){
      return;
    }

    function getFieldErrorEl(field){
      if(!field) return null;
      const fieldId = field.getAttribute("id");
      if(!fieldId) return null;
      const scope = field.closest(".formGrid") || field.closest(".productDetailsSection") || field.closest(".mb") || document;
      return scope.querySelector(`.fieldError[data-error-for="${fieldId}"]`);
    }

    function setFieldError(field, message){
      const el = getFieldErrorEl(field);
      if(!el) return;
      if(message){
        el.textContent = message;
        el.style.display = "block";
      }else{
        el.textContent = "";
        el.style.display = "none";
      }
    }

    function clearFieldError(field){
      setFieldError(field, "");
    }

    function clearFieldErrors(fields){
      if(!Array.isArray(fields)) return;
      fields.forEach(clearFieldError);
    }

    function validateBrazilWhatsapp(raw){
      let digits = (raw || "").toString().trim().replace(/\D+/g, "");
      if(!digits) return { ok:false, message:"Informe o WhatsApp com DDD." };
      if(digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
      if(digits.length !== 11) return { ok:false, message:"Informe DDD + 9 digitos (11 numeros)." };
      if(/^(\d)\1+$/.test(digits)) return { ok:false, message:"Numero invalido." };
      const ddd = digits.slice(0, 2);
      if(ddd === "00" || Number(ddd) < 11) return { ok:false, message:"DDD invalido." };
      if(digits[2] !== "9") return { ok:false, message:"Celular deve ter 9 digitos." };
      return { ok:true, digits };
    }
    function isValidEmail(value){
      const email = (value || "").toString().trim();
      if(!email) return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function isValidUrl(value, options){
      const raw = (value || "").toString().trim();
      if(!raw) return false;
      if(options && options.allowData && raw.startsWith("data:")) return true;
      try{
        const url = new URL(raw);
        return url.protocol === "http:" || url.protocol === "https:";
      }catch(err){
        return false;
      }
    }

    function isValidDateInput(value){
      const v = (value || "").toString().trim();
      if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)) return false;
      const dt = new Date(`${v}T00:00:00`);
      return !Number.isNaN(dt.getTime());
    }

    function isValidTimeInput(value){
      const v = (value || "").toString().trim();
      if(!v) return true;
      return /^[0-9]{2}:[0-9]{2}$/.test(v);
    }

    function validatePedido(value){
      const raw = (value || "").toString().trim();
      if(!raw) return { ok:false, message:"Preencha o pedido." };
      const digits = raw.replace(/\D+/g, "");
      if(digits.length !== raw.length) return { ok:false, message:"Use apenas numeros." };
      if(digits.length < 3) return { ok:false, message:"Pedido muito curto." };
      return { ok:true };
    }


    function fillUserProfileForm(data){
      if(userProfileName) userProfileName.value = data.name || "";
      if(userProfileDoc) userProfileDoc.value = data.doc || "";
      if(userProfileWhatsapp) userProfileWhatsapp.value = data.whatsapp || "";
      if(userProfileEmail) userProfileEmail.value = data.email || "";
      userProfileAvatarPending = data.avatar || "";
      userProfileAvatarPrev = data.avatar || "";
      setAvatarElements(userProfileAvatarImg, userProfileAvatarFallback, data.name, data.avatar);
    }

        function openUserProfileOverlay(options){
      if(!userProfileOverlay) return;
      userProfileRequired = Boolean(options?.required);
      const data = normalizeUserProfile(userProfile);
      fillUserProfileForm(data);
      clearFieldErrors([userProfileName, userProfileDoc, userProfileWhatsapp, userProfileEmail, userProfileAvatarFile]);
      const secondaryRequired = userProfileRequired && isSecondaryUser();
      if(userProfileCloseBtn){
        userProfileCloseBtn.style.display = userProfileRequired ? "none" : "inline-flex";
      }
      if(userProfileStoresBtn) userProfileStoresBtn.style.display = userProfileRequired ? "none" : "inline-flex";
      if(userProfileLogoutBtn) userProfileLogoutBtn.style.display = userProfileRequired ? "none" : "inline-flex";
      if(userProfileSaveBtn) userProfileSaveBtn.style.display = secondaryRequired ? "inline-flex" : (userProfileRequired ? "none" : "inline-flex");
      if(userProfileNextBtn) userProfileNextBtn.style.display = secondaryRequired ? "none" : (userProfileRequired ? "inline-flex" : "none");
      userProfileOverlay.classList.add("show");
    }

    function closeUserProfileOverlay(){
      if(userProfileRequired) return;
      if(userProfileOverlay) userProfileOverlay.classList.remove("show");
    }

    async function handleUserProfileSave(){
      const name = (userProfileName?.value || "").trim();
      const doc = (userProfileDoc?.value || "").trim();
      const whatsapp = (userProfileWhatsapp?.value || "").trim();
      const email = (userProfileEmail?.value || "").trim();

      clearFieldErrors([userProfileName, userProfileDoc, userProfileWhatsapp, userProfileEmail]);

      let ok = true;
      if(!name){
        setFieldError(userProfileName, "Preencha o nome.");
        ok = false;
      }
      if(!doc){
        setFieldError(userProfileDoc, "Preencha o CPF/CNPJ.");
        ok = false;
      }else{
        const docDigits = getCpfDigits(doc);
        if(docDigits.length === 11){
          if(!isValidCpf(docDigits)){
            setFieldError(userProfileDoc, "CPF invalido.");
            ok = false;
          }
        }else if(docDigits.length === 14){
          if(!isValidCnpj(docDigits)){
            setFieldError(userProfileDoc, "CNPJ invalido.");
            ok = false;
          }
        }else{
          setFieldError(userProfileDoc, "Informe CPF ou CNPJ com 11 ou 14 numeros.");
          ok = false;
        }
      }
      if(!whatsapp){
        setFieldError(userProfileWhatsapp, "Preencha o WhatsApp.");
        ok = false;
      }else{
        const phoneCheck = validateBrazilWhatsapp(whatsapp);
        if(!phoneCheck.ok){
          setFieldError(userProfileWhatsapp, phoneCheck.message);
          ok = false;
        }
      }
      if(!email){
        setFieldError(userProfileEmail, "Preencha o e-mail.");
        ok = false;
      }else if(!isValidEmail(email)){
        setFieldError(userProfileEmail, "E-mail invalido.");
        ok = false;
      }
      if(!ok) return;

      const avatar = (userProfileAvatarPending || "").trim();
      if(userProfileAvatarPrev && userProfileAvatarPrev !== avatar){
        void apiDeleteImage(userProfileAvatarPrev);
      }
      saveUserProfile({ name, doc, whatsapp, email, avatar });
      const wasRequired = userProfileRequired;
      userProfileRequired = false;
      if(userProfileOverlay) userProfileOverlay.classList.remove("show");
      if(wasRequired){
        if(isSecondaryUser()){
          stores = loadStores();
          updateStoresUI();
        }else{
          openStoresConfig({ required:true });
        }
      }
    }

    async function handleUserProfileLogout(){
      try{
        await apiRequest(`${API_BASE}/logout.php`);
      }catch(e){
        // ignore
      }
      currentUser = null;
      stopActivityTracking();
      stopUsersAutoRefresh();
      storageCache = {};
      storageReady = false;
      updateAdminAccessUI();
      if(userProfileOverlay) userProfileOverlay.classList.remove("show");
      showAuthOverlay("login");
    }

    async function handleLoginSubmit(e){
      e.preventDefault();
      const username = (loginUsername?.value || "").trim();
      const password = (loginPassword?.value || "").toString();
      if(!username || !password){
        setAuthError("Preencha usuario e senha.");
        return;
      }
      try{
        const result = await apiRequest(`${API_BASE}/login.php`, { username, password });
        currentUser = result.user || null;
        updateAdminAccessUI();
        if(loginPassword) loginPassword.value = "";
        hideAuthOverlay();
        await refreshAppDataForUser();
        if(authResolver){
          authResolver();
          authResolver = null;
        }
      }catch(err){
        const msg = (err && err.message) ? String(err.message) : "";
        if(msg === "db_error" || msg === "db_schema_error" || msg === "server_error" || msg === "request_failed"){
          setAuthError("Erro no servidor. Tente novamente.");
        }else if(msg === "access_pending"){
          setAuthError("Aguardando a liberacao do administrador.");
        }else if(msg === "access_blocked"){
          setAuthError("Usuario bloqueado.");
        }else if(msg === "email_unverified"){
          setAuthError("Confirme seu e-mail antes de entrar.");
          if(resendVerificationBtn) resendVerificationBtn.style.display = "inline-flex";
        }else{
          setAuthError("Usuario ou senha invalidos.");
          if(resendVerificationBtn) resendVerificationBtn.style.display = "inline-flex";
        }
      }
    }

    async function handleSetupSubmit(e){
      e.preventDefault();
      const username = (setupUsername?.value || "").trim();
      const displayName = (setupDisplayName?.value || "").trim();
      const email = (setupEmail?.value || "").trim();
      const password = (setupPassword?.value || "").toString();
      if(!username || !password || !email){
        setAuthError("Preencha usuario, e-mail e senha.");
        return;
      }
      try{
        const endpoint = authMode === "register" ? `${API_BASE}/register.php` : `${API_BASE}/setup.php`;
        const result = await apiRequest(endpoint, {
          username,
          display_name: displayName,
          email,
          password
        });
        if(setupPassword) setupPassword.value = "";
        showAuthOverlay("login", "Enviamos um e-mail de confirmacao. Acesse o link para liberar o acesso.");
        if(resendVerificationBtn) resendVerificationBtn.style.display = "inline-flex";
        if(authResolver){
          authResolver();
          authResolver = null;
        }
      }catch(err){
        const msg = (err && err.message) ? String(err.message) : "";
        if(msg === "db_error" || msg === "db_schema_error" || msg === "server_error" || msg === "request_failed"){
          setAuthError("Erro no servidor. Tente novamente.");
        }else if(msg === "auth_required" || msg === "forbidden"){
          setAuthError("Somente o usu\u00e1rio principal pode cadastrar novos usu\u00e1rios.");
        }else if(msg === "secondary_limit"){
          setAuthError("Limite de usu\u00e1rios secund\u00e1rios atingido.");
        }else if(msg === "email_invalid"){
          setAuthError("E-mail invalido.");
        }else if(msg === "email_in_use"){
          setAuthError("E-mail ja cadastrado.");
        }else if(msg === "username_in_use"){
          setAuthError("Usuario ja cadastrado.");
        }else if(msg === "already_configured"){
          setAuthError("Cadastro inicial ja foi feito. Use Cadastre-se.");
        }else if(msg === "email_send_failed"){
          setAuthError("Falha ao enviar o e-mail de confirmacao.");
        }else{
          setAuthError("Nao foi possivel criar o usuario.");
        }
      }
    }

    async function handleResetRequestSubmit(e){
      e.preventDefault();
      const identifier = (resetIdentifier?.value || "").trim();
      if(!identifier){
        setAuthError("Informe o e-mail ou usuario.");
        return;
      }
      try{
        await apiRequest(`${API_BASE}/request_password_reset.php`, { identifier });
        showAuthOverlay("login", "Se o usuario existir, enviamos um link para redefinir a senha.");
      }catch(err){
        const msg = (err && err.message) ? String(err.message) : "";
        if(msg === "email_invalid"){
          setAuthError("E-mail invalido.");
        }else if(msg === "user_not_found"){
          setAuthError("Usuario nao encontrado.");
        }else if(msg === "email_send_failed"){
          setAuthError("Nao foi possivel enviar o e-mail.");
        }else{
          setAuthError("Nao foi possivel solicitar a recuperacao.");
        }
      }
    }

    async function handleResetPasswordSubmit(e){
      e.preventDefault();
      const token = (resetTokenInput?.value || "").trim();
      const password = (resetPassword?.value || "").toString();
      const confirm = (resetPasswordConfirm?.value || "").toString();
      if(!token){
        setAuthError("Token invalido.");
        return;
      }
      if(!password || !confirm){
        setAuthError("Informe a nova senha.");
        return;
      }
      if(password !== confirm){
        setAuthError("As senhas nao conferem.");
        return;
      }
      try{
        await apiRequest(`${API_BASE}/reset_password.php`, { token, password });
        if(resetPassword) resetPassword.value = "";
        if(resetPasswordConfirm) resetPasswordConfirm.value = "";
        showAuthOverlay("login", "Senha atualizada. Entre com a nova senha.");
      }catch(err){
        const msg = (err && err.message) ? String(err.message) : "";
        if(msg === "weak_password"){
          setAuthError("Senha fraca. Use pelo menos 6 caracteres.");
        }else if(msg === "token_invalid" || msg === "token_expired"){
          setAuthError("Link expirado. Solicite novamente.");
        }else{
          setAuthError("Nao foi possivel atualizar a senha.");
        }
      }
    }

    function getResetTokenFromUrl(){
      try{
        const params = new URLSearchParams(window.location.search || "");
        const token = params.get("reset") || "";
        return token.trim();
      }catch(_err){
        return "";
      }
    }

    async function ensureAuthenticated(){
      const session = await apiSession().catch(() => ({}));
      if(session && session.authenticated){
        currentUser = session.user || null;
        updateAdminAccessUI();
        return;
      }
      const setupStatus = await apiSetupStatus().catch(() => ({}));
      needsSetupFlag = Boolean(setupStatus?.needs_setup);
      const resetToken = getResetTokenFromUrl();
      if(resetToken){
        if(resetTokenInput) resetTokenInput.value = resetToken;
        showAuthOverlay("reset_password");
      }else{
        showAuthOverlay(needsSetupFlag ? "setup" : "login");
      }

      await new Promise((resolve) => {
        authResolver = resolve;
      });
    }

    async function bootstrapStorage(){
      try{
        const result = await apiStorageGetAll();
        storageCache = result?.data && typeof result.data === "object" ? result.data : {};
        storageReady = true;
      }catch(err){
        const msg = (err && err.message) ? String(err.message) : "";
        if(msg === "auth_required"){
          // User not authenticated yet (e.g., awaiting email confirmation).
          storageCache = {};
          storageReady = true;
          return;
        }
        throw err;
      }
    }

    /***********************
     * INIT
     ***********************/
    function initTasksUI(){
      fillSelectOptions(tFonte, FONTE_OPTIONS);
      fillStatusOptions();
      clearTasksForm();

      // default datas
      const today = todayISO();
      if(!tData.value) tData.value = today;
    }

    async function refreshAppDataForUser(){
      await bootstrapStorage();

      items = loadBase();
      menuButtons = loadMenuButtons();
      quickLinks = loadQuickLinks();
      stores = loadStores();
      searchTags = loadSearchTags();
      sizeTablesCustom = loadSizeTablesCustom();
      sizeTablesOverrides = loadSizeTablesOverrides();
      productsCustom = loadProducts();
      nuvemLinks = loadNuvemLinks();
      tasks = loadTasks();
      tasksDone = loadTasksDone();
      calendarHistory = loadCalendarHistory();
      seedTransportadorasLinks();
      userProfile = loadUserProfile();

      initTheme();
      initSideMenu();
      // mantem o calendario consistente na inicializacao
      syncCalendarOpenFlags();
      updateModeLabel();
      updateQCount();
      setQuestionImagesUI([]);
      setQuestionLinksUI([]);
      renderSearchTags();
      renderMiniCalendar();
      updateStoresUI();
      renderDrawer();
      renderExtraMenuLinks();
      render();
      updateUserProfileUI();
      updateAdminAccessUI();
      updateTaskCountBadges();
      initTasksUI();
      const savedView = (storageGet(STORAGE_KEY_VIEW) || "").toString().trim();
      const allowedViews = ["search", "tasks", "done", "users", "userActivity"];
      let initialView = allowedViews.includes(savedView) ? savedView : "search";
      if((initialView === "users" || initialView === "userActivity") && !canAccessUsersView()){
        initialView = "search";
      }
      setView(initialView);
      ensureMiniCalendarNavPlacement();
      startActivityTracking();
      startUsersAutoRefresh();

      if(!isUserProfileComplete(userProfile)){
        openUserProfileOverlay({ required:true });
        return;
      }
      if(!storageGet(STORAGE_KEY_STORES)){
        openStoresConfig({ required:true });
        return;
      }
    }

async function bootstrapApp(){
      await ensureAuthenticated();
      await refreshAppDataForUser();
    }

    bootstrapApp();


















































