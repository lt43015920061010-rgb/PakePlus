/**
 * MemoryOS Web UI
 * 架构：单一 App 对象管理所有状态和 DOM，参考 AuthApp 风格
 */
const App = {

  state: {
    page:         'gallery',
    photos:       [],
    photosTotal:  0,
    photosPage:   1,
    lightboxIndex: 0,
    running:      false,
  },

  dom: {
    // 导航
    navItems:      document.querySelectorAll('.nav-item'),
    pages:         document.querySelectorAll('.page'),
    statusDot:     document.getElementById('statusDot'),
    statusText:    document.getElementById('statusText'),
    // 照片页
    galleryGrid:   document.getElementById('galleryGrid'),
    galleryEmpty:  document.getElementById('galleryEmpty'),
    photoCount:    document.getElementById('photoCount'),
    btnToggle:     document.getElementById('btnToggleWatcher'),
    loadMore:      document.getElementById('loadMore'),
    btnLoadMore:   document.getElementById('btnLoadMore'),
    // 上传页
    uploadZone:    document.getElementById('uploadZone'),
    fileInput:     document.getElementById('fileInput'),
    btnSelectFiles:document.getElementById('btnSelectFiles'),
    uploadList:    document.getElementById('uploadList'),
    // 误判页
    reviewGrid:    document.getElementById('reviewGrid'),
    reviewEmpty:   document.getElementById('reviewEmpty'),
    // 日志页
    logList:       document.getElementById('logList'),
    btnRefreshLogs:document.getElementById('btnRefreshLogs'),
    // 设置页
    settingThreshold: document.getElementById('settingThreshold'),
    settingApiKey:    document.getElementById('settingApiKey'),
    settingApiSecret: document.getElementById('settingApiSecret'),
    settingScanDir:   document.getElementById('settingScanDir'),
    settingInterval:  document.getElementById('settingInterval'),
    btnSaveSettings:  document.getElementById('btnSaveSettings'),
    saveMsg:          document.getElementById('saveMsg'),
    // 灯箱
    lightbox:      document.getElementById('lightbox'),
    lightboxImg:   document.getElementById('lightboxImg'),
    lightboxClose: document.getElementById('lightboxClose'),
    lightboxPrev:  document.getElementById('lightboxPrev'),
    lightboxNext:  document.getElementById('lightboxNext'),
    // Toast
    toastContainer: document.getElementById('toastContainer'),
  },

  // ── 工具 ─────────────────────────────────────────────────────────────────

  toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    this.dom.toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  },

  async api(method, path, body) {
    const opts = { method, headers: {} };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch('/api' + path, opts);
    return res.json();
  },

  // ── 导航 ─────────────────────────────────────────────────────────────────

  switchPage(name) {
    this.state.page = name;
    this.dom.navItems.forEach(el => el.classList.toggle('active', el.dataset.page === name));
    this.dom.pages.forEach(el => el.classList.toggle('active', el.id === 'page-' + name));
    if (name === 'gallery')  this.loadGallery(true);
    if (name === 'review')   this.loadReview();
    if (name === 'logs')     this.loadLogs();
    if (name === 'settings') this.loadSettings();
  },

  // ── 状态 / watcher ────────────────────────────────────────────────────────

  async refreshStatus() {
    const data = await this.api('GET', '/status');
    this.state.running = data.running;
    this.dom.statusDot.classList.toggle('running', data.running);
    this.dom.statusText.textContent = data.running ? '监听中' : '已停止';
    this.dom.btnToggle.textContent  = data.running ? '停止监听' : '启动监听';
    if (data.stats) {
      const s = data.stats;
      this.dom.photoCount.textContent = `今日处理 ${s.processed} 张，保留 ${s.kept} 张`;
    }
  },

  async toggleWatcher() {
    const action = this.state.running ? '/watcher/stop' : '/watcher/start';
    const res    = await this.api('POST', action);
    this.toast(res.message, res.ok ? 'info' : 'error');
    await this.refreshStatus();
  },

  // ── 照片网格 ──────────────────────────────────────────────────────────────

  async loadGallery(reset = false) {
    if (reset) { this.state.photos = []; this.state.photosPage = 1; }
    const data = await this.api('GET', `/photos?page=${this.state.photosPage}&limit=50`);
    this.state.photosTotal = data.total;
    this.state.photos = reset ? data.photos : [...this.state.photos, ...data.photos];
    this.renderGallery();
    this.dom.loadMore.style.display =
      this.state.photos.length < this.state.photosTotal ? 'block' : 'none';
  },

  renderGallery() {
    const { photos } = this.state;
    this.dom.galleryEmpty.style.display = photos.length ? 'none' : 'block';
    // 保留 empty-state，重建其他卡片
    const existing = this.dom.galleryGrid.querySelectorAll('.photo-card');
    existing.forEach(el => el.remove());
    photos.forEach((photo, i) => {
      const card = document.createElement('div');
      card.className = 'photo-card';
      card.innerHTML = `
  <img src="/api/photos/thumb/${photo.name}" alt="${photo.name}">
        <div class="card-overlay"><span class="card-name">${photo.name}</span></div>
      `;
      card.addEventListener('click', () => this.openLightbox(i));
      this.dom.galleryGrid.appendChild(card);
    });
  },

  async loadMorePhotos() {
    this.state.photosPage++;
    await this.loadGallery(false);
  },

  // ── 灯箱 ─────────────────────────────────────────────────────────────────

  openLightbox(index) {
    this.state.lightboxIndex = index;
    this.dom.lightbox.classList.add('open');
    this.showLightboxPhoto();
  },

  showLightboxPhoto() {
    const photo = this.state.photos[this.state.lightboxIndex];
    if (!photo) return;
    this.dom.lightboxImg.src = '/api/photos/original/' + photo.url.split('/photos/original/')[1];
  },

  closeLightbox() { this.dom.lightbox.classList.remove('open'); },

  lightboxPrev() {
    this.state.lightboxIndex = Math.max(0, this.state.lightboxIndex - 1);
    this.showLightboxPhoto();
  },

  lightboxNext() {
    this.state.lightboxIndex = Math.min(this.state.photos.length - 1, this.state.lightboxIndex + 1);
    this.showLightboxPhoto();
  },

  // ── 上传 ─────────────────────────────────────────────────────────────────

  async uploadFile(file) {
    const item = document.createElement('div');
    item.className = 'upload-item';
    item.innerHTML = `<span>${file.name}</span><span class="upload-status pending">上传中...</span>`;
    this.dom.uploadList.prepend(item);
    const statusEl = item.querySelector('.upload-status');
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': file.type, 'x-filename': file.name },
        body: file,
      });
      const data = await res.json();
      if (data.ok) { statusEl.textContent = '已发送至 inbox'; statusEl.className = 'upload-status success'; }
      else throw new Error(data.message || '上传失败');
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'upload-status error';
    }
  },

  // ── 误判修正 ──────────────────────────────────────────────────────────────

  async loadReview() {
    const data = await this.api('GET', '/photos/ignored');
    const grid = this.dom.reviewGrid;
    grid.querySelectorAll('.photo-card').forEach(el => el.remove());
    this.dom.reviewEmpty.style.display = data.total ? 'none' : 'block';
    data.photos.forEach(name => {
      const card = document.createElement('div');
      card.className = 'photo-card review-card';
      card.innerHTML = `
        <img src="/api/photos/ignored/img/${encodeURIComponent(name)}" alt="${name}">
             onerror="this.style.opacity='.3'">
        <div class="card-overlay">
          <button class="btn-fix">移到保留</button>
        </div>
      `;
      card.querySelector('.btn-fix').addEventListener('click', async () => {
        await this.api('POST', '/fix/keep', { filename: name });
        this.toast('已移到保留', 'keep');
        card.remove();
      });
      grid.appendChild(card);
    });
  },

  // ── 日志 ─────────────────────────────────────────────────────────────────

  async loadLogs() {
    const logs = await this.api('GET', '/logs?n=100');
    this.dom.logList.innerHTML = logs.map(l => `
      <div class="log-item">
        <span class="log-time">${l.timestamp.replace('T', ' ').slice(0, 19)}</span>
        <span class="log-event ${l.event}">${l.event}</span>
        <span class="log-payload">${JSON.stringify(l.payload || {})}</span>
      </div>
    `).join('');
  },

  // ── 设置 ─────────────────────────────────────────────────────────────────

  async loadSettings() {
    const data = await this.api('GET', '/settings');
    this.dom.settingThreshold.value = data.threshold;
    this.dom.settingScanDir.value   = data.scanDir || '';
    this.dom.settingInterval.value  = data.intervalMinutes || 30;
  },

  async saveSettings() {
    const body = {
      threshold:       parseFloat(this.dom.settingThreshold.value),
      scanDir:         this.dom.settingScanDir.value.trim(),
      intervalMinutes: parseInt(this.dom.settingInterval.value),
    };
    if (this.dom.settingApiKey.value.trim())    body.apiKey    = this.dom.settingApiKey.value.trim();
    if (this.dom.settingApiSecret.value.trim()) body.apiSecret = this.dom.settingApiSecret.value.trim();
    const res = await this.api('POST', '/settings', body);
    this.dom.saveMsg.textContent = res.ok ? '已保存' : ('保存失败: ' + res.message);
    setTimeout(() => this.dom.saveMsg.textContent = '', 2500);
  },

  // ── SSE 实时进度 ──────────────────────────────────────────────────────────

  connectSSE() {
    const es = new EventSource('/api/events');
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.event === 'done') {
        const type = data.result === 'keep' ? 'keep' : 'info';
        this.toast(`${data.result === 'keep' ? '✓ 保留' : '✗ 忽略'}: ${data.file} (${(data.score * 100).toFixed(1)}%)`, type);
        if (data.result === 'keep' && this.state.page === 'gallery') {
          setTimeout(() => this.loadGallery(true), 500);
        }
        this.refreshStatus();
      }
      if (data.event === 'error') {
        this.toast('处理失败: ' + data.file, 'error');
      }
    };
  },

  // ── 初始化 ────────────────────────────────────────────────────────────────

  init() {
    // 导航点击
    this.dom.navItems.forEach(el => {
      el.addEventListener('click', () => this.switchPage(el.dataset.page));
    });

    // watcher 开关
    this.dom.btnToggle.addEventListener('click', () => this.toggleWatcher());

    // 加载更多
    this.dom.btnLoadMore.addEventListener('click', () => this.loadMorePhotos());

    // 灯箱
    this.dom.lightboxClose.addEventListener('click', () => this.closeLightbox());
    this.dom.lightboxPrev.addEventListener('click',  () => this.lightboxPrev());
    this.dom.lightboxNext.addEventListener('click',  () => this.lightboxNext());
    this.dom.lightbox.addEventListener('click', e => {
      if (e.target === this.dom.lightbox) this.closeLightbox();
    });
    document.addEventListener('keydown', e => {
      if (!this.dom.lightbox.classList.contains('open')) return;
      if (e.key === 'Escape')     this.closeLightbox();
      if (e.key === 'ArrowLeft')  this.lightboxPrev();
      if (e.key === 'ArrowRight') this.lightboxNext();
    });

    // 上传
    this.dom.btnSelectFiles.addEventListener('click', () => this.dom.fileInput.click());
    this.dom.fileInput.addEventListener('change', e => {
      [...e.target.files].forEach(f => this.uploadFile(f));
    });
    this.dom.uploadZone.addEventListener('dragover', e => {
      e.preventDefault(); this.dom.uploadZone.classList.add('drag-over');
    });
    this.dom.uploadZone.addEventListener('dragleave', () => {
      this.dom.uploadZone.classList.remove('drag-over');
    });
    this.dom.uploadZone.addEventListener('drop', e => {
      e.preventDefault();
      this.dom.uploadZone.classList.remove('drag-over');
      [...e.dataTransfer.files].filter(f => f.type.startsWith('image/')).forEach(f => this.uploadFile(f));
    });

    // 日志刷新
    this.dom.btnRefreshLogs.addEventListener('click', () => this.loadLogs());

    // 设置保存
    this.dom.btnSaveSettings.addEventListener('click', () => this.saveSettings());

    // 首次加载
    this.refreshStatus();
    this.loadGallery(true);
    this.connectSSE();

    // 定时刷新状态
    setInterval(() => this.refreshStatus(), 10000);
  },
};

App.init();
